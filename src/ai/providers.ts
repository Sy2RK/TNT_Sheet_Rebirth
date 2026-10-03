import { z } from 'zod';
import type { AIResponse, LLMSettings, ProviderKind } from '../types';
import { qwenModelCatalogUrl } from './qwen-endpoint';
export const providers: Record<ProviderKind, { name: string; endpoint: string; model: string }> = {
  local: { name: '本地模式（内置指令）', endpoint: '', model: '' },
  openai: { name: 'OpenAI', endpoint: 'https://api.openai.com/v1', model: '' },
  compatible: { name: 'OpenAI 兼容接口', endpoint: '', model: '' },
  anthropic: { name: 'Claude', endpoint: 'https://api.anthropic.com/v1', model: '' },
  gemini: { name: 'Gemini', endpoint: 'https://generativelanguage.googleapis.com/v1beta', model: '' },
  qwen: {
    name: '通义千问',
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen3.8-flash',
  },
  deepseek: { name: 'DeepSeek', endpoint: 'https://api.deepseek.com/v1', model: 'deepseek-flash' },
  ollama: { name: 'Ollama（本地模型）', endpoint: 'http://localhost:11434/v1', model: '' },
};
const responseSchema = z
  .object({
    message: z.string().max(30000),
    operations: z
      .array(z.object({ tool: z.string(), args: z.record(z.string(), z.unknown()) }).strict())
      .max(25),
    done: z.boolean(),
  })
  .strict();
export function parsePlan(text: string): AIResponse {
  const clean = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  try {
    return responseSchema.parse(JSON.parse(clean));
  } catch {
    throw new Error('AI 未能生成可执行的操作，工作簿未修改。请重新描述，或更换模型后重试。');
  }
}
export interface ModelMessage {
  role: 'user' | 'assistant';
  content: string;
}
export interface ModelProvider {
  complete(system: string, messages: ModelMessage[], signal: AbortSignal): Promise<AIResponse>;
}
export function validateEndpoint(endpoint: string) {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new Error('请输入完整的 API 地址。');
  }
  if (url.username || url.password || url.search || url.hash)
    throw new Error('API 地址中不能包含账号信息、查询参数或片段。');
  if (
    url.protocol !== 'https:' &&
    !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
  )
    throw new Error('远程模型地址必须使用 HTTPS；本地服务可以使用 HTTP。');
  return endpoint.trim().replace(/\/+$/, '');
}

export interface AvailableModel {
  id: string;
  name: string;
}
const listedModelSchema = z.looseObject({
  id: z.string().trim().min(1).max(200),
  name: z.string().optional(),
  display_name: z.string().optional(),
  output_modalities: z.array(z.string()).optional(),
});
const modelPageSchema = z.looseObject({
  data: z.array(listedModelSchema),
  has_more: z.boolean().optional(),
  last_id: z.string().optional(),
});
const geminiPageSchema = z.looseObject({
  models: z.array(
    z.looseObject({
      name: z
        .string()
        .regex(/^models\/.+/)
        .max(207),
      displayName: z.string().optional(),
      supportedGenerationMethods: z.array(z.string()),
    }),
  ),
  nextPageToken: z.string().optional(),
});
const qwenPageSchema = z.looseObject({
  success: z.boolean(),
  output: z.looseObject({
    total: z.number().int().nonnegative(),
    page_no: z.number().int().positive(),
    models: z.array(
      z.looseObject({
        model: z.string().trim().min(1).max(200),
        name: z.string().optional(),
        capabilities: z.array(z.string()),
        published_time: z.string().nullable().optional(),
        inference_metadata: z.object({
          request_modality: z.array(z.string()),
          response_modality: z.array(z.string()),
        }),
      }),
    ),
  }),
});

function authHeaders(provider: ProviderKind, key: string): Record<string, string> {
  if (provider === 'anthropic')
    return {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    };
  if (provider === 'gemini') return { 'x-goog-api-key': key };
  return key ? { Authorization: `Bearer ${key}` } : {};
}
function httpError(status: number, discovery = false) {
  if (status === 401 || status === 403)
    return new Error('模型认证失败，请检查 API 密钥是否正确，以及该密钥是否有访问权限。');
  if (status === 429) return new Error('请求过于频繁或额度不足，请稍后重试。');
  if (discovery && [404, 405, 501].includes(status))
    return new Error('此服务未提供模型列表，可以手动填写服务商提供的模型名称。');
  return new Error(`模型服务请求失败（错误代码 ${status}），请稍后重试。`);
}

/** Model IDs and capabilities come from the selected service, not a static catalog. */
export async function discoverModels(
  settings: Pick<LLMSettings, 'provider' | 'endpoint'>,
  apiKey: string,
  signal: AbortSignal,
): Promise<AvailableModel[]> {
  const { provider } = settings;
  if (provider === 'local') return [];
  const key = apiKey.trim();
  if (!key && provider !== 'ollama') throw new Error('请输入 API 密钥后获取模型列表。');
  const base = validateEndpoint(settings.endpoint);
  const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(15000)]);
  const qwenUrl = provider === 'qwen' ? qwenModelCatalogUrl(base) : undefined;
  if (qwenUrl) {
    const catalog = new Map<string, AvailableModel & { published: string }>();
    let received = 0;
    for (let page = 1; page <= 20; page++) {
      qwenUrl.search = new URLSearchParams({
        capabilities: 'TG',
        language: 'zh-CN',
        page_no: String(page),
        page_size: '100',
      }).toString();
      let response: Response;
      try {
        requestSignal.throwIfAborted();
        const url = import.meta.env.DEV
          ? '/_dev/qwen-models?url=' + encodeURIComponent(qwenUrl.toString())
          : qwenUrl.toString();
        response = await fetch(url, {
          headers: {
            ...authHeaders(provider, key),
            ...(import.meta.env.DEV ? { 'X-TNT-Local-Config': '1' } : {}),
          },
          signal: requestSignal,
          redirect: 'error',
        });
      } catch {
        signal.throwIfAborted();
        if (requestSignal.aborted) throw new Error('获取模型列表超时，请重试。');
        throw new Error(
          '无法获取百炼模型目录。请检查地址、地域与网络；此接口需要服务端中转，开发模式请重启本地服务。',
        );
      }
      if (!response.ok) throw httpError(response.status, true);
      let data: z.infer<typeof qwenPageSchema>;
      try {
        data = qwenPageSchema.parse(await response.json());
      } catch {
        signal.throwIfAborted();
        if (requestSignal.aborted) throw new Error('获取模型列表超时，请重试。');
        throw new Error('百炼返回的模型目录格式无效，请重试或手动填写模型名称。');
      }
      if (!data.success) throw new Error('百炼模型目录查询失败，请检查密钥与业务空间权限。');
      if (data.output.page_no !== page || (!data.output.models.length && received < data.output.total))
        throw new Error('模型列表分页异常，请重试。');
      received += data.output.models.length;
      for (const model of data.output.models) {
        if (
          !model.capabilities.includes('TG') ||
          !model.inference_metadata.request_modality.includes('Text') ||
          !model.inference_metadata.response_modality.includes('Text')
        )
          continue;
        catalog.set(model.model, {
          id: model.model,
          name: model.name?.trim() || model.model,
          published: model.published_time || '',
        });
      }
      if (received >= data.output.total) {
        if (!catalog.size) throw new Error('此服务没有返回可用的文本模型，请检查地域与配置。');
        return [...catalog.values()]
          .sort((a, b) => b.published.localeCompare(a.published) || a.id.localeCompare(b.id))
          .map(({ id, name }) => ({ id, name }));
      }
    }
    throw new Error('模型列表分页过多，请手动填写模型名称。');
  }
  const models = new Map<string, AvailableModel>();
  const cursors = new Set<string>();
  let cursor = '';
  for (let page = 0; page < 20; page++) {
    const url = new URL(base + '/models');
    if (cursor) url.searchParams.set(provider === 'gemini' ? 'pageToken' : 'after_id', cursor);
    if (provider === 'anthropic') url.searchParams.set('limit', '1000');
    let response: Response;
    try {
      requestSignal.throwIfAborted();
      response = await fetch(url.toString(), {
        headers: authHeaders(provider, key),
        signal: requestSignal,
        redirect: 'error',
      });
    } catch {
      signal.throwIfAborted();
      if (requestSignal.aborted) throw new Error('获取模型列表超时，请重试。');
      throw new Error('无法获取模型列表。请检查 API 地址和网络，并确认服务商允许浏览器访问。');
    }
    if (!response.ok) throw httpError(response.status, true);
    let next = '';
    try {
      const body: unknown = await response.json();
      if (provider === 'gemini') {
        const data = geminiPageSchema.parse(body);
        for (const model of data.models) {
          if (!model.supportedGenerationMethods.includes('generateContent')) continue;
          const id = model.name.slice('models/'.length);
          models.set(id, { id, name: model.displayName?.trim() || id });
        }
        next = data.nextPageToken || '';
      } else {
        const data = modelPageSchema.parse(body);
        for (const model of data.data) {
          if (model.output_modalities && !model.output_modalities.includes('text')) continue;
          models.set(model.id, {
            id: model.id,
            name: model.display_name?.trim() || model.name?.trim() || model.id,
          });
        }
        if (data.has_more) {
          next = data.last_id || data.data.at(-1)?.id || '';
          if (!next) throw new Error('Missing pagination cursor');
        }
      }
    } catch {
      signal.throwIfAborted();
      if (requestSignal.aborted) throw new Error('获取模型列表超时，请重试。');
      throw new Error('服务商返回的模型列表格式无效，请重试或手动填写模型名称。');
    }
    if (!next) {
      if (!models.size) throw new Error('此服务没有返回可用的文本模型，请检查密钥权限。');
      return [...models.values()];
    }
    if (cursors.has(next)) throw new Error('模型列表分页异常，请重试。');
    cursors.add(next);
    cursor = next;
  }
  throw new Error('模型列表分页过多，请手动填写模型名称。');
}
export function selectModel(models: AvailableModel[], provider: ProviderKind, current = '') {
  if (models.some((model) => model.id === current)) return current;
  const preferred = providers[provider].model;
  return models.find((model) => model.id === preferred)?.id || models[0]?.id || '';
}

async function readStreamContent(response: Response) {
  if (!response.body) throw new Error('Empty model response');
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let buffer = '',
    content = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split('\n');
      buffer = done ? '' : lines.pop()!;
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') return content;
        if (!payload) continue;
        const part = JSON.parse(payload).choices?.[0]?.delta?.content;
        if (typeof part === 'string') content += part;
      }
      if (done) return content;
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
}
export class HttpModelProvider implements ModelProvider {
  constructor(
    private settings: LLMSettings,
    private apiKey: string,
  ) {}
  async complete(system: string, messages: ModelMessage[], signal: AbortSignal) {
    const { provider, model, endpoint, temperature } = this.settings;
    if (!model.trim()) throw new Error('请先在设置中填写模型名称。');
    if (!this.apiKey && provider !== 'ollama')
      throw new Error('请先在设置中输入 API 密钥。页面刷新后需要重新输入。');
    const base = validateEndpoint(endpoint);
    let url = base + '/chat/completions';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    let body: unknown;
    if (provider === 'anthropic') {
      url = base + '/messages';
      headers['x-api-key'] = this.apiKey;
      headers['anthropic-version'] = '2023-06-01';
      headers['anthropic-dangerous-direct-browser-access'] = 'true';
      body = { model, system, messages, max_tokens: 8192, temperature };
    } else if (provider === 'gemini') {
      url = base + '/models/' + encodeURIComponent(model) + ':generateContent';
      headers['x-goog-api-key'] = this.apiKey;
      body = {
        systemInstruction: { parts: [{ text: system }] },
        contents: messages.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
        generationConfig: { temperature, responseMimeType: 'application/json' },
      };
    } else {
      if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;
      body = {
        model,
        messages: [{ role: 'system', content: system }, ...messages],
        temperature,
        // Some catalogued Qwen models only support streamed completions.
        stream: provider === 'qwen',
        ...(provider === 'qwen' && /^qwen3\.8-(max|flash)(?:-|$)/.test(model)
          ? { enable_thinking: false }
          : {}),
      };
    }
    let response: Response;
    const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(60000)]);
    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: requestSignal,
      });
    } catch (error) {
      if (signal.aborted) throw new Error('操作已取消。');
      if (error instanceof DOMException && error.name === 'TimeoutError')
        throw new Error('模型请求超时，请重试。');
      throw new Error('无法连接模型。请检查 API 地址和网络，并确认服务商允许浏览器访问。');
    }
    if (!response.ok)
      throw new Error(
        response.status === 401 || response.status === 403
          ? '模型认证失败，请检查 API 密钥是否正确，以及该密钥是否有访问权限。'
          : response.status === 429
            ? '模型调用次数已达限制或请求过于频繁，请稍后重试。'
            : `模型服务暂时无法完成请求（错误代码 ${response.status}）。工作簿未修改，请稍后重试。`,
      );
    let content: string | undefined;
    try {
      if (provider === 'qwen' && response.headers.get('content-type')?.includes('text/event-stream'))
        content = await readStreamContent(response);
      else {
        const data = await response.json();
        if (provider === 'anthropic')
          content = data.content
            ?.filter((p: { type: string }) => p.type === 'text')
            .map((p: { text: string }) => p.text)
            .join('');
        else if (provider === 'gemini')
          content = data.candidates?.[0]?.content?.parts?.map((p: { text: string }) => p.text || '').join('');
        else content = data.choices?.[0]?.message?.content;
      }
    } catch {
      if (signal.aborted) throw new Error('操作已取消。');
      if (requestSignal.aborted) throw new Error('模型请求超时，请重试。');
      throw new Error('模型回复读取失败，请重试。');
    }
    if (typeof content !== 'string') throw new Error('模型没有返回可用的回复，请重试或更换模型。');
    return parsePlan(content);
  }
}
