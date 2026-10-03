export type CellValue = string | number | boolean | null;
export interface Range {
  r1: number;
  c1: number;
  r2: number;
  c2: number;
}
// AI operation limits only; the native editor is not restricted by these values.
export const MAX_ROWS = 1048576,
  MAX_COLS = 16384,
  MAX_EDIT_CELLS = 100000;
export interface CellStyle {
  fontFamily?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  color?: string;
  background?: string;
  align?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  wrap?: boolean;
  numberFormat?: string;
  border?: 'none' | 'all' | 'bottom';
}
export type Mode = 'ask' | 'edit' | 'agent';
export type ProviderKind =
  'local' | 'openai' | 'compatible' | 'anthropic' | 'gemini' | 'qwen' | 'deepseek' | 'ollama';
export interface LLMSettings {
  provider: ProviderKind;
  endpoint: string;
  model: string;
  temperature: number;
}
export interface Settings {
  llm: LLMSettings;
  speechLanguage: string;
  autosave: boolean;
}
export interface Skill {
  id: string;
  name: string;
  description: string;
  prompt: string;
  enabled: boolean;
  tools: string[];
  triggers: string[];
  slashCommand: string;
  context: 'selection' | 'sheet';
}
export interface Target {
  workbookId: string;
  sheetId: string;
  range: Range;
  ranges: Range[];
  activeCell: { row: number; col: number };
  revision: number;
}
export interface Operation {
  tool: string;
  args: Record<string, unknown>;
}
export interface ToolResult {
  tool: string;
  result: unknown;
}
export interface AIResponse {
  message: string;
  operations: Operation[];
  done: boolean;
}
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  mode?: Mode;
  target?: string;
  steps?: string[];
  error?: boolean;
}
export const DEFAULT_SETTINGS: Settings = {
  llm: {
    provider: 'deepseek',
    endpoint: 'https://api.deepseek.com/v1',
    model: 'deepseek-flash',
    temperature: 0.2,
  },
  speechLanguage: 'zh-CN',
  autosave: true,
};
