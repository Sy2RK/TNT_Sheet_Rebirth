import type { IWorkbookData as Workbook } from '@univerjs/core';
export interface SecretStorage {
  get(id: string): string | undefined;
  set(id: string, value: string): void;
  delete(id: string): void;
}
export interface WorkbookStorage {
  load(): Promise<Workbook | null>;
  save(workbook: Workbook): Promise<void>;
}
export type SpeechPhase = 'starting' | 'listening' | 'recognizing';
export interface SpeechCallbacks {
  onState?(phase: SpeechPhase): void;
  onPartial(text: string): void;
  onFinal(text: string): void;
  onError(message: string): void;
  onEnd(): void;
}
export interface SpeechAdapter {
  readonly supported: boolean;
  start(language: string, callbacks: SpeechCallbacks): void;
  stop(): void;
  cancel(): void;
}
export interface FileAdapter {
  open(file: File): Promise<Workbook>;
  save(workbook: Workbook): Promise<void>;
}
export interface PlatformAdapter {
  secrets: SecretStorage;
  storage: WorkbookStorage;
  speech: SpeechAdapter;
  files: FileAdapter;
  clipboard: { read(): Promise<string>; write(text: string): Promise<void> };
  haptics: { pulse(): void };
  share: { file(file: File): Promise<void> };
  permissions: { microphone(): Promise<PermissionState | 'unknown'> };
}
