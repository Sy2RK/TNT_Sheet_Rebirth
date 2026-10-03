import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebSpeechAdapter } from '../src/platform/speech';
import type { SpeechCallbacks } from '../src/platform/contracts';
type ResultEvent = { resultIndex: number; results: { isFinal: boolean; 0: { transcript: string } }[] };
class Recognition {
  static instances: Recognition[] = [];
  lang = '';
  continuous = false;
  interimResults = false;
  onstart: (() => void) | null = null;
  onresult: ((e: ResultEvent) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();
  constructor() {
    Recognition.instances.push(this);
  }
  result(text: string, final = false) {
    this.onresult?.({ resultIndex: 0, results: [{ isFinal: final, 0: { transcript: text } }] });
  }
}
const callbacks = () => ({
  onState: vi.fn<NonNullable<SpeechCallbacks['onState']>>(),
  onPartial: vi.fn<SpeechCallbacks['onPartial']>(),
  onFinal: vi.fn<SpeechCallbacks['onFinal']>(),
  onError: vi.fn<SpeechCallbacks['onError']>(),
  onEnd: vi.fn<SpeechCallbacks['onEnd']>(),
});
beforeEach(() => {
  vi.useFakeTimers();
  Recognition.instances = [];
  vi.stubGlobal('window', { isSecureContext: true, SpeechRecognition: Recognition });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe('Web Speech lifecycle', () => {
  it('waits for service start, emits partial text, and submits final text once', () => {
    const adapter = new WebSpeechAdapter(),
      cb = callbacks();
    adapter.start('zh-CN', cb);
    const r = Recognition.instances[0];
    expect(cb.onState).toHaveBeenLastCalledWith('starting');
    r.onstart?.();
    expect(cb.onState).toHaveBeenLastCalledWith('listening');
    r.result('加粗');
    expect(cb.onPartial).toHaveBeenCalledWith('加粗');
    adapter.stop();
    adapter.stop();
    expect(r.stop).toHaveBeenCalledTimes(1);
    expect(cb.onState).toHaveBeenLastCalledWith('recognizing');
    r.result(' 加粗 ', true);
    r.onend?.();
    expect(cb.onFinal).toHaveBeenCalledExactlyOnceWith('加粗');
    expect(cb.onError).not.toHaveBeenCalled();
    expect(cb.onEnd).toHaveBeenCalledTimes(1);
    vi.runAllTimers();
    expect(cb.onError).not.toHaveBeenCalled();
  });
  it('queues release until startup and ignores duplicate pointer releases', () => {
    const adapter = new WebSpeechAdapter();
    adapter.start('zh-CN', callbacks());
    const r = Recognition.instances[0];
    adapter.stop();
    adapter.stop();
    expect(r.stop).not.toHaveBeenCalled();
    r.onstart?.();
    adapter.stop();
    expect(r.stop).toHaveBeenCalledTimes(1);
    adapter.cancel();
  });
  it.each([
    'network',
    'not-allowed',
    'audio-capture',
    'no-speech',
    'service-not-allowed',
    'language-not-supported',
  ])('reports %s and always ends without submitting', (error) => {
    const adapter = new WebSpeechAdapter(),
      cb = callbacks();
    adapter.start('zh-CN', cb);
    const r = Recognition.instances[0];
    const end = r.onend;
    r.onerror?.({ error });
    end?.();
    expect(cb.onError).toHaveBeenCalledWith(expect.stringContaining(error));
    expect(cb.onEnd).toHaveBeenCalledTimes(1);
    expect(cb.onFinal).not.toHaveBeenCalled();
    expect(r.abort).toHaveBeenCalledTimes(1);
  });
  it('explains empty results and preserves unconfirmed text without executing it', () => {
    const adapter = new WebSpeechAdapter(),
      empty = callbacks(),
      partial = callbacks();
    adapter.start('zh-CN', empty);
    Recognition.instances[0].onend?.();
    expect(empty.onError).toHaveBeenCalledWith(expect.stringContaining('没有返回文字'));
    adapter.start('zh-CN', partial);
    Recognition.instances[1].result('删除工作表');
    Recognition.instances[1].onend?.();
    expect(partial.onError).toHaveBeenCalledWith(expect.stringContaining('删除工作表'));
    expect(partial.onFinal).not.toHaveBeenCalled();
  });
  it('times out startup and finalization instead of showing an endless listening state', () => {
    const adapter = new WebSpeechAdapter(),
      startup = callbacks(),
      final = callbacks();
    adapter.start('zh-CN', startup);
    vi.advanceTimersByTime(15000);
    expect(startup.onError).toHaveBeenCalledWith(expect.stringContaining('15 秒'));
    expect(startup.onEnd).toHaveBeenCalledTimes(1);
    adapter.start('zh-CN', final);
    Recognition.instances[1].onstart?.();
    adapter.stop();
    vi.advanceTimersByTime(8000);
    expect(final.onError).toHaveBeenCalledWith(expect.stringContaining('最终识别结果超时'));
    expect(final.onEnd).toHaveBeenCalledTimes(1);
    expect(final.onFinal).not.toHaveBeenCalled();
  });
  it('never executes a confirmed prefix while the end of the command is unconfirmed', () => {
    const adapter = new WebSpeechAdapter(),
      cb = callbacks();
    adapter.start('zh-CN', cb);
    const r = Recognition.instances[0];
    r.onresult?.({
      resultIndex: 0,
      results: [
        { isFinal: true, 0: { transcript: '删除工作表' } },
        { isFinal: false, 0: { transcript: '不要执行' } },
      ],
    });
    r.onend?.();
    expect(cb.onFinal).not.toHaveBeenCalled();
    expect(cb.onError).toHaveBeenCalledWith(expect.stringContaining('删除工作表不要执行'));
  });
  it('ignores events from canceled sessions and clears their timers', () => {
    const adapter = new WebSpeechAdapter(),
      old = callbacks(),
      current = callbacks();
    adapter.start('zh-CN', old);
    const r = Recognition.instances[0],
      staleResult = r.onresult,
      staleError = r.onerror,
      staleEnd = r.onend;
    adapter.cancel();
    adapter.start('zh-CN', current);
    staleResult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: 'old instruction' } }] });
    staleError?.({ error: 'network' });
    staleEnd?.();
    expect(old.onPartial).not.toHaveBeenCalled();
    expect(old.onFinal).not.toHaveBeenCalled();
    expect(old.onError).not.toHaveBeenCalled();
    expect(current.onError).not.toHaveBeenCalled();
    adapter.cancel();
    vi.runAllTimers();
    expect(current.onError).not.toHaveBeenCalled();
  });
  it('rejects unsupported and insecure contexts without creating a recognizer', () => {
    vi.stubGlobal('window', {});
    expect(() => new WebSpeechAdapter().start('zh-CN', callbacks())).toThrow('不支持');
    vi.stubGlobal('window', { isSecureContext: false, SpeechRecognition: Recognition });
    expect(() => new WebSpeechAdapter().start('zh-CN', callbacks())).toThrow('HTTPS');
    expect(Recognition.instances).toHaveLength(0);
  });
});
