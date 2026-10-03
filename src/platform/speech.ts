import type { SpeechAdapter, SpeechCallbacks } from './contracts';
interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};
export class WebSpeechAdapter implements SpeechAdapter {
  private session: {
    recognition: Recognition;
    callbacks: SpeechCallbacks;
    finalText: string;
    partialText: string;
    started: boolean;
    stopRequested: boolean;
    stopSent: boolean;
    timer?: ReturnType<typeof setTimeout>;
  } | null = null;
  get supported() {
    return (
      typeof window !== 'undefined' &&
      !!((window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition)
    );
  }
  private detach(session: NonNullable<WebSpeechAdapter['session']>) {
    if (session.timer) clearTimeout(session.timer);
    session.recognition.onstart = null;
    session.recognition.onresult = null;
    session.recognition.onerror = null;
    session.recognition.onend = null;
    if (this.session === session) this.session = null;
  }
  private fail(session: NonNullable<WebSpeechAdapter['session']>, message: string) {
    if (this.session !== session) return;
    this.detach(session);
    try {
      session.recognition.abort();
    } catch {
      /* already ended */
    }
    try {
      session.callbacks.onError(message);
    } finally {
      session.callbacks.onEnd();
    }
  }
  private requestStop(session: NonNullable<WebSpeechAdapter['session']>) {
    if (this.session !== session || session.stopSent || !session.started) return;
    session.stopSent = true;
    session.callbacks.onState?.('recognizing');
    if (session.timer) clearTimeout(session.timer);
    session.timer = setTimeout(
      () =>
        this.fail(
          session,
          '等待最终识别结果超时，本次语音未提交。浏览器语音服务可能不可用，请重试或改用文字输入。',
        ),
      8000,
    );
    try {
      session.recognition.stop();
    } catch {
      this.fail(session, '无法结束本次语音识别，请重新尝试。');
    }
  }
  start(language: string, callbacks: SpeechCallbacks) {
    if (!this.supported)
      throw new Error('当前浏览器不支持语音识别。请在侧栏输入文字，或更换支持语音识别的浏览器。');
    if (window.isSecureContext === false)
      throw new Error('语音输入需要 HTTPS 或 localhost 地址。请使用安全连接后重试。');
    this.cancel();
    const Constructor =
      (window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition!;
    const recognition = new Constructor();
    const session: NonNullable<WebSpeechAdapter['session']> = {
      recognition,
      callbacks,
      finalText: '',
      partialText: '',
      started: false,
      stopRequested: false,
      stopSent: false,
    };
    this.session = session;
    recognition.lang = language;
    recognition.continuous = true;
    recognition.interimResults = true;
    const started = () => {
      if (this.session !== session || session.started) return;
      session.started = true;
      if (session.timer) clearTimeout(session.timer);
      callbacks.onState?.('listening');
      // Permission and connection are asynchronous; do not stop before startup.
      if (session.stopRequested) this.requestStop(session);
    };
    recognition.onstart = started;
    recognition.onresult = (e) => {
      if (this.session !== session) return;
      let finalText = '',
        partialText = '';
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
        else partialText += e.results[i][0].transcript;
      }
      session.finalText = finalText;
      session.partialText = partialText;
      callbacks.onPartial(finalText + partialText);
      started();
    };
    recognition.onerror = (e) => {
      const errors: Record<string, string> = {
        'not-allowed': '麦克风权限被拒绝。请检查 Chrome 站点权限和系统麦克风隐私设置。',
        'audio-capture': '未检测到可用的麦克风。请检查浏览器所选输入设备和设备连接。',
        network: '浏览器语音识别服务连接失败。麦克风授权不等于识别服务可用，请检查网络或使用专用 ASR。',
        'no-speech': '浏览器没有检测到语音。请检查麦克风输入音量和所选设备，并在“正在聆听”后说话。',
        'service-not-allowed': '浏览器语音服务不可用，即使已允许麦克风也无法识别。请改用文字输入或专用 ASR。',
        'language-not-supported': '浏览器语音服务不支持当前识别语言，请调整语言或使用专用 ASR。',
        'language-unavailable': '当前语言的语音识别服务不可用，请调整语言或使用专用 ASR。',
        aborted: '浏览器中止了本次语音识别，本次语音未提交，请重试。',
      };
      this.fail(session, `${errors[e.error] || '语音识别失败，请重试或改用文字输入。'}（${e.error}）`);
    };
    recognition.onend = () => {
      if (this.session !== session) return;
      this.detach(session);
      try {
        if (session.finalText.trim() && !session.partialText.trim())
          callbacks.onFinal(session.finalText.trim());
        else
          callbacks.onError(
            session.partialText.trim()
              ? `识别文字仍有未确认部分：“${(session.finalText + session.partialText).trim()}”。本次语音未提交，请重新尝试。`
              : '语音识别已结束，但没有返回文字。本次未提交，请检查麦克风输入和浏览器语音服务。',
          );
      } finally {
        callbacks.onEnd();
      }
    };
    callbacks.onState?.('starting');
    session.timer = setTimeout(
      () =>
        this.fail(
          session,
          '浏览器语音服务未能在 15 秒内启动。请确认麦克风授权；若已授权，检查识别服务连接或使用专用 ASR。',
        ),
      15000,
    );
    try {
      recognition.start();
    } catch (error) {
      this.detach(session);
      try {
        recognition.abort();
      } catch {
        /* start failed */
      }
      throw error;
    }
  }
  stop() {
    const session = this.session;
    if (!session) return;
    session.stopRequested = true;
    this.requestStop(session);
  }
  cancel() {
    const session = this.session;
    if (!session) return;
    this.detach(session);
    try {
      session.recognition.abort();
    } catch {
      /* already ended */
    }
  }
}
