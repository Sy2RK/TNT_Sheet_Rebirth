import { z } from 'zod';
import type { ProviderKind } from '../types';
import { validateEndpoint } from '../ai/providers';

const connectionSchema = z.object({
  endpoint: z.string(),
  model: z.string().trim().min(1).max(200),
  apiKey: z.string().trim().min(1),
});
const configSchema = z.object({
  providers: z.object({
    deepseek: connectionSchema.optional(),
    qwen: connectionSchema.optional(),
  }),
});
type DevelopmentConnection = z.infer<typeof connectionSchema>;
let connections: Partial<Record<ProviderKind, DevelopmentConnection>> = {};

export async function loadDevelopmentConnections(): Promise<string | undefined> {
  connections = {};
  if (!import.meta.env.DEV) return;
  try {
    const response = await fetch('/_dev/model-config', {
      headers: { 'X-TNT-Local-Config': '1' },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) throw new Error();
    const { providers } = configSchema.parse(await response.json());
    for (const [provider, value] of Object.entries(providers)) {
      if (value)
        connections[provider as ProviderKind] = { ...value, endpoint: validateEndpoint(value.endpoint) };
    }
  } catch {
    connections = {};
    return '无法读取本地开发模型配置，可在设置中手动输入，或检查 config.local.json。';
  }
}

export function getDevelopmentConnection(provider: ProviderKind, endpoint?: string) {
  if (!import.meta.env.DEV) return;
  const connection = connections[provider];
  if (!connection) return;
  if (endpoint !== undefined) {
    try {
      if (validateEndpoint(endpoint) !== connection.endpoint) return;
    } catch {
      return;
    }
  }
  return connection;
}
