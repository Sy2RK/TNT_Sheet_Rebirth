import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpModelProvider, parsePlan, validateEndpoint } from '../src/ai/providers';
import { MemorySecretStorage } from '../src/platform/storage';
const plan = { message: 'done', operations: [], done: true };
afterEach(() => vi.unstubAllGlobals());
describe('model provider contracts', () => {
  it.each(['qwen3-32b', 'qwen3-235b-a22b-thinking-2507', 'qwen3.8-flash'])(
    'reads streamed plans from %s across UTF-8 and event boundaries',
    async (modelName) => {
      const expected = { ...plan, message: '已完成表格分析' },
        json = JSON.stringify(expected);
      const events =
        [
          { choices: [{ delta: { reasoning_content: 'internal reasoning' } }] },
          { choices: [{ delta: { content: json.slice(0, 12) } }] },
          { choices: [{ delta: { content: json.slice(12) } }] },
          { choices: [], usage: { completion_tokens: 20 } },
        ]
          .map((data) => `data: ${JSON.stringify(data)}\r\n\r\n`)
          .join('') + 'data: [DONE]\r\n\r\n';
      const bytes = new TextEncoder().encode(events);
      const fetch = vi.fn().mockResolvedValue(
        new Response(
          new ReadableStream({
            start(controller) {
              for (let i = 0; i < bytes.length; i += 3) controller.enqueue(bytes.slice(i, i + 3));
              controller.close();
            },
          }),
          { headers: { 'Content-Type': 'text/event-stream' } },
        ),
      );
      vi.stubGlobal('fetch', fetch);
      const model = new HttpModelProvider(
        {
          provider: 'qwen',
          endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
          model: modelName,
          temperature: 0.2,
        },
        'test-key',
      );
      expect(
        await model.complete('system', [{ role: 'user', content: 'hello' }], new AbortController().signal),
      ).toEqual(expected);
      expect(JSON.parse(fetch.mock.calls[0][1].body).stream).toBe(true);
    },
  );
  it('reports interrupted streams without returning a partial plan', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('data: broken-json\n\n', {
          headers: { 'Content-Type': 'text/event-stream' },
        }),
      ),
    );
    const model = new HttpModelProvider(
      { provider: 'qwen', endpoint: 'https://example.com/v1', model: 'qwen3-32b', temperature: 0.2 },
      'test-key',
    );
    await expect(
      model.complete('system', [{ role: 'user', content: 'hello' }], new AbortController().signal),
    ).rejects.toThrow('回复读取失败');
  });
  it('uses the Anthropic request and response protocol', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(plan) }] }), {
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetch);
    const model = new HttpModelProvider(
      {
        provider: 'anthropic',
        endpoint: 'https://api.anthropic.com/v1',
        model: 'user-model',
        temperature: 0.2,
      },
      'secret',
    );
    expect(
      await model.complete('system', [{ role: 'user', content: 'hello' }], new AbortController().signal),
    ).toEqual(plan);
    expect(fetch.mock.calls[0][0]).toBe('https://api.anthropic.com/v1/messages');
    const options = fetch.mock.calls[0][1];
    expect(options.headers['x-api-key']).toBe('secret');
    expect(JSON.parse(options.body).system).toBe('system');
  });
  it('uses the Gemini request and response protocol', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(plan) }] } }] }),
          { status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetch);
    const model = new HttpModelProvider(
      {
        provider: 'gemini',
        endpoint: 'https://generativelanguage.googleapis.com/v1beta',
        model: 'user-model',
        temperature: 0.2,
      },
      'secret',
    );
    expect(
      await model.complete('system', [{ role: 'user', content: 'hello' }], new AbortController().signal),
    ).toEqual(plan);
    expect(fetch.mock.calls[0][0]).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/user-model:generateContent',
    );
    expect(fetch.mock.calls[0][1].headers['x-goog-api-key']).toBe('secret');
    expect(JSON.parse(fetch.mock.calls[0][1].body).contents[0].parts[0].text).toBe('hello');
  });
  it('rejects unsafe endpoints and malformed model plans', () => {
    expect(() => validateEndpoint('http://untrusted.example/v1')).toThrow();
    expect(() => validateEndpoint('https://user:secret@example.com/v1')).toThrow();
    expect(() => validateEndpoint('https://example.com/v1?key=secret')).toThrow();
    expect(validateEndpoint('http://localhost:11434/v1/')).toBe('http://localhost:11434/v1');
    expect(() => parsePlan('some arbitrary text')).toThrow();
    expect(parsePlan('```json\n' + JSON.stringify(plan) + '\n```')).toEqual(plan);
  });
  it('surfaces authentication errors without including provider response secrets', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Sensitive details', { status: 401 })));
    const model = new HttpModelProvider(
      { provider: 'compatible', endpoint: 'https://example.com/v1', model: 'test', temperature: 0.2 },
      'secret',
    );
    await expect(
      model.complete('system', [{ role: 'user', content: 'hi' }], new AbortController().signal),
    ).rejects.toThrow('模型认证失败');
  });
  it('keeps secrets isolated and session-only', () => {
    const store = new MemorySecretStorage();
    store.set('provider', 'test');
    expect(store.get('provider')).toBe('test');
    expect(new MemorySecretStorage().get('provider')).toBeUndefined();
    store.delete('provider');
    expect(store.get('provider')).toBeUndefined();
  });
});
