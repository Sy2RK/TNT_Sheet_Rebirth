import { afterEach, describe, expect, it, vi } from 'vitest';
import { discoverModels, selectModel, HttpModelProvider } from '../src/ai/providers';
import type { ProviderKind } from '../src/types';

afterEach(() => vi.unstubAllGlobals());
const signal = () => new AbortController().signal;
const response = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
describe('model discovery', () => {
  it('uses the official Qwen catalog, paginates and filters models by input and output capability', async () => {
    const text = (model: string, published_time: string) => ({
      model,
      name: model.toUpperCase(),
      published_time,
      capabilities: ['TG'],
      inference_metadata: { request_modality: ['Text'], response_modality: ['Text'] },
    });
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        response({
          success: true,
          output: {
            total: 5,
            page_no: 1,
            models: [
              text('older', '2025-01-01'),
              {
                ...text('image', ''),
                inference_metadata: { request_modality: ['Text'], response_modality: ['Image'] },
              },
              {
                ...text('asr', ''),
                capabilities: ['ASR'],
                inference_metadata: { request_modality: ['Audio'], response_modality: ['Text'] },
              },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(
        response({
          success: true,
          output: {
            total: 5,
            page_no: 2,
            models: [text('qwen3.8-flash', '2026-09-01'), text('older', '2025-01-01')],
          },
        }),
      );
    vi.stubGlobal('fetch', fetch);
    const models = await discoverModels(
      { provider: 'qwen', endpoint: 'https://workspace.cn-beijing.maas.aliyuncs.com/compatible-mode/v1' },
      'secret',
      signal(),
    );
    expect(models.map((m) => m.id)).toEqual(['qwen3.8-flash', 'older']);
    expect(selectModel(models, 'qwen')).toBe('qwen3.8-flash');
    const proxyUrl = new URL(fetch.mock.calls[1][0], 'http://localhost');
    expect(proxyUrl.pathname).toBe('/_dev/qwen-models');
    const url = new URL(proxyUrl.searchParams.get('url')!);
    expect(url.origin).toBe('https://workspace.cn-beijing.maas.aliyuncs.com');
    expect(url.pathname).toBe('/api/v1/models');
    expect(url.searchParams.get('capabilities')).toBe('TG');
    expect(url.searchParams.get('page_no')).toBe('2');
    expect(fetch.mock.calls[0][1].headers).toEqual({
      Authorization: 'Bearer secret',
      'X-TNT-Local-Config': '1',
    });
  });
  it('rejects empty, malformed and repeated Qwen catalog pages without trusting the total', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response({ success: true, output: { total: 1, page_no: 1, models: [] } }))
      .mockResolvedValueOnce(response({ success: false }))
      .mockResolvedValueOnce(response({ success: true, output: { total: 0, page_no: 1, models: [] } }));
    vi.stubGlobal('fetch', fetch);
    const settings = {
      provider: 'qwen' as const,
      endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    };
    await expect(discoverModels(settings, 'secret', signal())).rejects.toThrow('分页异常');
    await expect(discoverModels(settings, 'secret', signal())).rejects.toThrow('格式无效');
    await expect(discoverModels(settings, 'secret', signal())).rejects.toThrow('没有返回可用');
  });
  it('requests a non-thinking JSON plan from the tested Qwen 3.8 model', async () => {
    const plan = { message: 'ok', operations: [], done: true };
    const fetch = vi
      .fn()
      .mockResolvedValue(response({ choices: [{ message: { content: JSON.stringify(plan) } }] }));
    vi.stubGlobal('fetch', fetch);
    const provider = new HttpModelProvider(
      {
        provider: 'qwen',
        endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        model: 'qwen3.8-flash',
        temperature: 0.2,
      },
      'secret',
    );
    expect(await provider.complete('Return JSON.', [{ role: 'user', content: 'hello' }], signal())).toEqual(
      plan,
    );
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({
      model: 'qwen3.8-flash',
      enable_thinking: false,
    });
  });
  it.each(['deepseek', 'compatible', 'openai', 'qwen', 'ollama'] as ProviderKind[])(
    'reads the %s model list without sending workbook data',
    async (provider) => {
      const fetch = vi.fn().mockResolvedValue(
        response({
          data: [
            { id: 'deepseek-v4-pro', name: 'DeepSeek-V4-Pro' },
            { id: 'deepseek-flash', name: 'DeepSeek-V4.1-Flash' },
          ],
        }),
      );
      vi.stubGlobal('fetch', fetch);
      const models = await discoverModels(
        { provider, endpoint: ' https://example.com/v1/// ' },
        ' secret ',
        signal(),
      );
      expect(models[1]).toEqual({ id: 'deepseek-flash', name: 'DeepSeek-V4.1-Flash' });
      expect(fetch.mock.calls[0][0]).toBe('https://example.com/v1/models');
      expect(fetch.mock.calls[0][1]).toMatchObject({
        headers: { Authorization: 'Bearer secret' },
        redirect: 'error',
      });
      expect(fetch.mock.calls[0][1].body).toBeUndefined();
      expect(selectModel(models, 'deepseek')).toBe('deepseek-flash');
      expect(selectModel(models, 'deepseek', 'deepseek-v4-pro')).toBe('deepseek-v4-pro');
      expect(selectModel(models, 'compatible', 'retired-model')).toBe('deepseek-v4-pro');
    },
  );
  it('uses Claude authentication and follows pagination while removing duplicates', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        response({
          data: [{ id: 'claude-a', display_name: 'Claude A' }],
          has_more: true,
          last_id: 'claude-a',
        }),
      )
      .mockResolvedValueOnce(response({ data: [{ id: 'claude-a' }, { id: 'claude-b' }], has_more: false }));
    vi.stubGlobal('fetch', fetch);
    const models = await discoverModels(
      { provider: 'anthropic', endpoint: 'https://example.com/v1' },
      'secret',
      signal(),
    );
    expect(models.map((model) => model.id)).toEqual(['claude-a', 'claude-b']);
    expect(fetch.mock.calls[0][1].headers).toMatchObject({
      'x-api-key': 'secret',
      'anthropic-version': '2023-06-01',
    });
    expect(fetch.mock.calls[1][0]).toContain('after_id=claude-a');
  });
  it('normalizes Gemini IDs, filters non-generation models and follows pagination', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        response({
          models: [
            { name: 'models/embedding', supportedGenerationMethods: ['embedContent'] },
            {
              name: 'models/gemini-flash',
              displayName: 'Gemini Flash',
              supportedGenerationMethods: ['generateContent'],
            },
          ],
          nextPageToken: 'next page',
        }),
      )
      .mockResolvedValueOnce(
        response({
          models: [{ name: 'models/gemini-pro', supportedGenerationMethods: ['generateContent'] }],
        }),
      );
    vi.stubGlobal('fetch', fetch);
    expect(
      await discoverModels(
        { provider: 'gemini', endpoint: 'https://example.com/v1beta' },
        'secret',
        signal(),
      ),
    ).toEqual([
      { id: 'gemini-flash', name: 'Gemini Flash' },
      { id: 'gemini-pro', name: 'gemini-pro' },
    ]);
    expect(fetch.mock.calls[0][1].headers).toEqual({ 'x-goog-api-key': 'secret' });
    expect(fetch.mock.calls[1][0]).toContain('pageToken=next+page');
    expect(fetch.mock.calls[1][0]).not.toContain('secret');
  });
  it('permits keyless Ollama, and performs no request for local rules or missing keys', async () => {
    const fetch = vi.fn().mockResolvedValue(response({ data: [{ id: 'local-model' }] }));
    vi.stubGlobal('fetch', fetch);
    await discoverModels({ provider: 'ollama', endpoint: 'http://localhost:11434/v1' }, '', signal());
    expect(fetch.mock.calls[0][1].headers).toEqual({});
    expect(await discoverModels({ provider: 'local', endpoint: '' }, '', signal())).toEqual([]);
    await expect(
      discoverModels({ provider: 'deepseek', endpoint: 'https://api.deepseek.com/v1' }, '', signal()),
    ).rejects.toThrow('请输入 API 密钥');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each([401, 404, 429, 500])('reports HTTP %i without exposing response details', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('server-secret', { status })));
    await expect(
      discoverModels({ provider: 'compatible', endpoint: 'https://example.com/v1' }, 'secret', signal()),
    ).rejects.toThrow(
      status === 401 ? '认证失败' : status === 404 ? '未提供模型列表' : status === 429 ? '过于频繁' : '500',
    );
  });
  it('rejects invalid and empty responses and incompatible output modalities', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response({ data: [{ id: 123 }] }))
      .mockResolvedValueOnce(response({ data: [{ id: 'image-model', output_modalities: ['image'] }] }));
    vi.stubGlobal('fetch', fetch);
    const settings = { provider: 'deepseek' as const, endpoint: 'https://example.com/v1' };
    await expect(discoverModels(settings, 'secret', signal())).rejects.toThrow('格式无效');
    await expect(discoverModels(settings, 'secret', signal())).rejects.toThrow('没有返回可用');
  });
  it('stops repeated pagination and supports cancellation', async () => {
    const fetch = vi
      .fn()
      .mockImplementation(async () => response({ data: [{ id: 'same' }], has_more: true }));
    vi.stubGlobal('fetch', fetch);
    const settings = { provider: 'anthropic' as const, endpoint: 'https://example.com/v1' };
    await expect(discoverModels(settings, 'secret', signal())).rejects.toThrow('分页异常');
    expect(fetch).toHaveBeenCalledTimes(2);
    const controller = new AbortController();
    controller.abort();
    await expect(discoverModels(settings, 'secret', controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
