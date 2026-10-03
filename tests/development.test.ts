import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDevelopmentConnection, loadDevelopmentConnections } from '../src/platform/development';

afterEach(() => vi.unstubAllGlobals());
describe('local development credentials', () => {
  it('restores configured providers in memory and only matches the exact saved endpoint', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          providers: {
            deepseek: {
              endpoint: 'https://api.deepseek.com/v1/',
              model: 'deepseek-flash',
              apiKey: 'fake-deepseek',
            },
            qwen: {
              endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
              model: 'qwen3.8-flash',
              apiKey: 'fake-qwen',
            },
          },
        }),
      ),
    );
    vi.stubGlobal('fetch', fetch);
    expect(await loadDevelopmentConnections()).toBeUndefined();
    expect(fetch).toHaveBeenCalledWith(
      '/_dev/model-config',
      expect.objectContaining({
        headers: { 'X-TNT-Local-Config': '1' },
        cache: 'no-store',
        redirect: 'error',
      }),
    );
    expect(getDevelopmentConnection('deepseek', ' https://api.deepseek.com/v1/// ')?.apiKey).toBe(
      'fake-deepseek',
    );
    expect(getDevelopmentConnection('qwen')?.model).toBe('qwen3.8-flash');
    expect(getDevelopmentConnection('deepseek', 'https://other.example/v1')).toBeUndefined();
    expect(getDevelopmentConnection('deepseek', 'https://api.deepseek.com/v1?key=wrong')).toBeUndefined();
    expect(getDevelopmentConnection('compatible')).toBeUndefined();
  });
  it('allows an absent file and clears credentials when configuration fails', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('{"providers":{}}'))
      .mockResolvedValueOnce(new Response('{"providers":{"qwen":{"apiKey":"fake-secret"}}}'));
    vi.stubGlobal('fetch', fetch);
    expect(await loadDevelopmentConnections()).toBeUndefined();
    expect(await loadDevelopmentConnections()).toContain('无法读取本地开发');
    expect(getDevelopmentConnection('qwen')).toBeUndefined();
  });
});
