import type { PlatformAdapter } from './contracts';
import { MemorySecretStorage, BrowserWorkbookStorage } from './storage';
import { WebSpeechAdapter } from './speech';
export const platform: PlatformAdapter = {
  secrets: new MemorySecretStorage(),
  storage: new BrowserWorkbookStorage(),
  speech: new WebSpeechAdapter(),
  files: {
    async open(file) {
      if (file.size > 30 * 1024 * 1024) throw new Error('文件超过 30 MB，无法打开。请使用较小的文件。');
      if (/\.json$/i.test(file.name)) {
        const { validateSnapshot } = await import('../sheet/snapshot');
        return validateSnapshot(JSON.parse(await file.text()));
      }
      if (!/\.xlsx$/i.test(file.name)) throw new Error('请选择 .xlsx 或 .univer.json 格式的工作簿文件。');
      const { importXlsx } = await import('./xlsx');
      return importXlsx(await file.arrayBuffer(), file.name);
    },
    async save(w) {
      const { exportXlsx, downloadBlob } = await import('./xlsx');
      downloadBlob(
        new Blob([await exportXlsx(w)], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
        w.name + '.xlsx',
      );
    },
  },
  clipboard: {
    read: () => navigator.clipboard.readText(),
    write: (text) => navigator.clipboard.writeText(text),
  },
  haptics: {
    pulse() {
      navigator.vibrate?.(20);
    },
  },
  share: {
    async file(file) {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] });
      else {
        const { downloadBlob } = await import('./xlsx');
        downloadBlob(file, file.name);
      }
    },
  },
  permissions: {
    async microphone() {
      try {
        return (await navigator.permissions.query({ name: 'microphone' as PermissionName })).state;
      } catch {
        return 'unknown';
      }
    },
  },
};
