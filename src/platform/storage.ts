import { z } from 'zod';
import { DEFAULT_SETTINGS, type Settings } from '../types';
import type { IWorkbookData as Workbook } from '@univerjs/core';
import { validateSnapshot } from '../sheet/snapshot';
import type { SecretStorage, WorkbookStorage } from './contracts';
export class MemorySecretStorage implements SecretStorage {
  private secrets = new Map<string, string>();
  get(id: string) {
    return this.secrets.get(id);
  }
  set(id: string, value: string) {
    this.secrets.set(id, value);
  }
  delete(id: string) {
    this.secrets.delete(id);
  }
}
const settingsSchema = z.object({
  llm: z.object({
    provider: z.enum(['local', 'openai', 'compatible', 'anthropic', 'gemini', 'qwen', 'deepseek', 'ollama']),
    endpoint: z.string().max(2000),
    model: z.string().max(200),
    temperature: z.number().min(0).max(2),
  }),
  speechLanguage: z.string().max(20),
  autosave: z.boolean(),
});
export function loadSettings(): Settings {
  try {
    return settingsSchema.parse(JSON.parse(localStorage.getItem('tnt-settings') || ''));
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}
export function saveSettings(settings: Settings) {
  localStorage.setItem('tnt-settings', JSON.stringify(settingsSchema.parse(settings)));
}
export class BrowserWorkbookStorage implements WorkbookStorage {
  private async db() {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('tnt-ai-sheet', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('workbooks');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  async load() {
    const db = await this.db();
    try {
      return await new Promise<Workbook | null>((resolve, reject) => {
        const tx = db.transaction('workbooks', 'readonly');
        const req = tx.objectStore('workbooks').get('univer-current-v1');
        req.onsuccess = () => {
          try {
            resolve(req.result ? validateSnapshot(req.result) : null);
          } catch (e) {
            reject(e);
          }
        };
        req.onerror = () => reject(req.error);
      });
    } finally {
      db.close();
    }
  }
  async save(workbook: Workbook) {
    const db = await this.db();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('workbooks', 'readwrite');
        tx.objectStore('workbooks').put(structuredClone(workbook), 'univer-current-v1');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }
}
