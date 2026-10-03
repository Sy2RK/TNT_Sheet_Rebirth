import { useEffect, useRef, useState } from 'react';
import type { IWorkbookData } from '@univerjs/core';
import {
  FilePlus2,
  FolderOpen,
  Download,
  Save,
  Mic,
  Sparkles,
  Settings2,
  Puzzle,
  X,
  Info,
} from 'lucide-react';
import { SheetRuntime } from './sheet/runtime';
import { blankWorkbook } from './sheet/snapshot';
import { OPEN_SOURCE_PLUGINS, UNIVER_VERSION } from './sheet/plugins';
import { contains, rangeName } from './sheet/address';
import { OperationEngine, type PreparedPlan } from './ai/engine';
import { providers } from './ai/providers';
import { loadSkills, saveSkills } from './ai/skills';
import { loadSettings, saveSettings } from './platform/storage';
import { platform } from './platform/browser';
import { getDevelopmentConnection } from './platform/development';
import type { SpeechPhase } from './platform/contracts';
import { downloadBlob } from './platform/download';
import { AIPanel, SettingsModal, SkillsModal } from './ui/Panels';
import { Modal } from './ui/Modal';
import type { ChatMessage, Mode, Target } from './types';
import './styles.css';

declare global {
  interface Window {
    __tnt?: { runtime: SheetRuntime; engine: OperationEngine };
  }
}
export default function App({ initial, bootError }: { initial: IWorkbookData; bootError?: string }) {
  const container = useRef<HTMLDivElement>(null),
    rtRef = useRef<SheetRuntime | null>(null),
    fileInput = useRef<HTMLInputElement>(null);
  const [runtime, setRuntime] = useState<SheetRuntime | null>(null),
    [name, setName] = useState(initial.name),
    [selection, setSelection] = useState('A1'),
    [sheetName, setSheetName] = useState('');
  const [settings, setSettings] = useState(loadSettings),
    [skills, setSkills] = useState(loadSkills),
    [apiKey, setApiKey] = useState(
      () => getDevelopmentConnection(settings.llm.provider, settings.llm.endpoint)?.apiKey || '',
    );
  const [panel, setPanel] = useState(() => window.innerWidth > 900),
    [dialog, setDialog] = useState<'settings' | 'skills' | 'about' | null>(null);
  const [mode, setMode] = useState<Mode>('ask'),
    [messages, setMessages] = useState<ChatMessage[]>([]),
    [busy, setBusy] = useState(''),
    [notice, setNotice] = useState(bootError || '');
  const [saved, setSaved] = useState('工作簿已打开'),
    [listening, setListening] = useState(false),
    [voicePhase, setVoicePhase] = useState<SpeechPhase>('starting'),
    [transcript, setTranscript] = useState(''),
    [pending, setPending] = useState<PreparedPlan | null>(null);
  const controller = useRef<AbortController | null>(null),
    busyRef = useRef(false),
    voiceTarget = useRef<Target | null>(null),
    hold = useRef<ReturnType<typeof setTimeout> | null>(null),
    voiceActive = useRef(false);
  const voiceStartRef = useRef<(target?: Target) => void>(() => {}),
    voiceEndRef = useRef(() => {});
  const pointerStart = useRef<{ x: number; y: number; target: Target } | null>(null);
  const error = (e: unknown) => setNotice(e instanceof Error ? e.message : String(e));
  useEffect(() => {
    if (!container.current) return;
    let rt: SheetRuntime;
    try {
      rt = new SheetRuntime(
        container.current,
        initial,
        window.matchMedia('(pointer: coarse) and (max-width: 900px)').matches,
      );
    } catch (e) {
      error(e);
      return;
    }
    rtRef.current = rt;
    setRuntime(rt);
    const update = () => {
      try {
        const t = rt.target();
        setSelection(t.ranges.map(rangeName).join(', '));
        setSheetName(rt.getSheet(t.sheetId).getSheetName());
        setName(rt.workbook.getName());
      } catch {
        /* disposal */
      }
    };
    update();
    const events = [
      rt.api.addEvent(rt.api.Event.SelectionChanged, update),
      rt.api.addEvent(rt.api.Event.ActiveSheetChanged, update),
      rt.api.addEvent(rt.api.Event.CellPointerDown, (e) => {
        if (busyRef.current || voiceActive.current) return;
        const t = pointerStart.current?.target;
        if (
          !t ||
          t.sheetId !== e.worksheet.getSheetId() ||
          !t.ranges.some((r) => contains(r, e.row, e.column))
        )
          return;
        if (hold.current) clearTimeout(hold.current);
        hold.current = setTimeout(() => {
          hold.current = null;
          voiceStartRef.current(t);
        }, 650);
      }),
      rt.api.addEvent(rt.api.Event.CellPointerUp, () => voiceEndRef.current()),
    ];
    const unsubscribe = rt.subscribe(update);
    const release = () => voiceEndRef.current();
    document.addEventListener('pointerup', release);
    if (import.meta.env.DEV) window.__tnt = { runtime: rt, engine: new OperationEngine(rt) };
    return () => {
      if (hold.current) clearTimeout(hold.current);
      controller.current?.abort();
      platform.speech.cancel();
      document.removeEventListener('pointerup', release);
      events.forEach((e) => e.dispose());
      unsubscribe();
      rt.dispose();
      rtRef.current = null;
      delete window.__tnt;
    };
  }, []);
  useEffect(() => {
    if (!runtime || !settings.autosave) return;
    let timer: ReturnType<typeof setTimeout> | undefined,
      alive = true;
    const save = () => {
      if (timer) clearTimeout(timer);
      setSaved('正在保存…');
      timer = setTimeout(() => {
        const snapshot = runtime.snapshot();
        platform.storage
          .save(snapshot)
          .then(() => {
            if (alive) setSaved('已保存在此浏览器');
          })
          .catch((e) => {
            if (alive) {
              setSaved('保存失败');
              error(e);
            }
          });
      }, 650);
    };
    const off = runtime.subscribe(save);
    save();
    return () => {
      alive = false;
      off();
      if (timer) clearTimeout(timer);
    };
  }, [runtime, settings.autosave]);
  async function send(text: string, nextMode = mode, target?: Target) {
    const rt = rtRef.current;
    if (!rt || busyRef.current || pending) return;
    busyRef.current = true;
    setBusy('正在分析指令');
    setPanel(true);
    const abort = new AbortController();
    controller.current = abort;
    const locked = target || rt.target();
    setMessages((m) => [
      ...m,
      { id: crypto.randomUUID(), role: 'user', text, mode: nextMode, target: rangeName(locked.range) },
    ]);
    try {
      const result = await new OperationEngine(rt).run(
        { text, mode: nextMode, source: target ? 'voice' : 'text', target: locked },
        settings,
        skills,
        apiKey,
        abort.signal,
        setBusy,
        messages,
      );
      if (result.pending) setPending(result.pending);
      else
        setMessages((m) => [
          ...m,
          { id: crypto.randomUUID(), role: 'assistant', text: result.message, steps: result.steps },
        ]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: abort.signal.aborted ? '操作已取消，未提交修改。' : (e as Error).message,
          error: true,
        },
      ]);
    } finally {
      busyRef.current = false;
      setBusy('');
      controller.current = null;
    }
  }
  function talkStart(target?: Target) {
    const rt = rtRef.current;
    if (!rt || busyRef.current || pending || voiceActive.current) return;
    voiceTarget.current = target || rt.target();
    setTranscript('');
    voiceActive.current = true;
    setVoicePhase('starting');
    setListening(true);
    try {
      platform.speech.start(settings.speechLanguage, {
        onState: setVoicePhase,
        onPartial: setTranscript,
        onFinal: (text) => {
          const locked = voiceTarget.current;
          if (locked) void send(text, mode, locked);
        },
        onError: error,
        onEnd: () => {
          voiceActive.current = false;
          setListening(false);
        },
      });
      platform.haptics.pulse();
    } catch (e) {
      platform.speech.cancel();
      voiceActive.current = false;
      setListening(false);
      error(e);
    }
  }
  function talkEnd() {
    if (hold.current) {
      clearTimeout(hold.current);
      hold.current = null;
    }
    if (voiceActive.current) platform.speech.stop();
  }
  voiceStartRef.current = talkStart;
  voiceEndRef.current = talkEnd;
  function cancelVoice() {
    if (hold.current) clearTimeout(hold.current);
    hold.current = null;
    platform.speech.cancel();
    voiceActive.current = false;
    setListening(false);
    voiceTarget.current = null;
  }
  async function saveNative() {
    if (!runtime) return;
    try {
      const w = runtime.snapshot();
      await platform.storage.save(w);
      downloadBlob(new Blob([JSON.stringify(w)], { type: 'application/json' }), w.name + '.univer.json');
      setSaved('已保存并下载');
    } catch (e) {
      error(e);
    }
  }
  async function open(file: File) {
    if (!runtime) return;
    try {
      const snapshot = await platform.files.open(file);
      if (!confirm('打开此文件会替换当前工作簿。请先保存需要保留的修改。继续打开吗？')) return;
      runtime.replace(snapshot);
      setMessages([]);
      setNotice(
        /xlsx$/i.test(file.name)
          ? 'XLSX 文件已打开。图片、批注、条件格式和数据验证等内容可能无法完整导入。'
          : '工作簿已打开。',
      );
    } catch (e) {
      error(e);
    }
  }
  const cancel = () => controller.current?.abort();
  const voiceStatus =
    voicePhase === 'starting'
      ? '正在启动语音服务，请确认麦克风授权…'
      : voicePhase === 'recognizing'
        ? '正在等待最终识别文字…'
        : '正在聆听，请说出操作…';
  return (
    <main className="tnt-app">
      <header className="tnt-ui app-header">
        <div className="brand">
          <span className="brand-symbol">T</span>
          <div>
            <strong>TNT AI Sheet</strong>
            <small>用自然语言与语音处理表格</small>
          </div>
        </div>
        <input
          className="workbook-title"
          aria-label="工作簿名称"
          value={name}
          disabled={!runtime || !!busy}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            if (name.trim() && runtime) runtime.workbook.setName(name.trim());
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
        />
        <div className="header-actions">
          <button
            disabled={!runtime || !!busy || !!pending}
            title="新建工作簿"
            aria-label="新建工作簿"
            onClick={() => {
              if (confirm('新建工作簿会替换当前内容。请先保存需要保留的修改。继续新建吗？')) {
                runtime?.replace(blankWorkbook());
                setMessages([]);
              }
            }}
          >
            <FilePlus2 size={17} />
          </button>
          <button disabled={!runtime || !!busy || !!pending} onClick={() => fileInput.current?.click()}>
            <FolderOpen size={17} />
            <span>打开</span>
          </button>
          <button disabled={!runtime || !!busy} onClick={() => void saveNative()}>
            <Save size={17} />
            <span>保存工作簿</span>
          </button>
          <button
            disabled={!runtime || !!busy}
            onClick={() => {
              if (runtime)
                void platform.files
                  .save(runtime.snapshot())
                  .then(() =>
                    setNotice(
                      'XLSX 文件已导出。图片、批注、条件格式和数据验证等内容可能无法完整保留；如需保留全部工作簿内容，请使用“保存工作簿”。',
                    ),
                  )
                  .catch(error);
            }}
          >
            <Download size={17} />
            <span>导出 XLSX</span>
          </button>
          <button aria-label="偏好设置" title="偏好设置" onClick={() => setDialog('settings')}>
            <Settings2 size={17} />
          </button>
          <button
            className={panel ? 'active' : ''}
            aria-label="切换 AI 助手"
            onClick={() => setPanel(!panel)}
          >
            <Sparkles size={17} />
            <span>AI 助手</span>
          </button>
        </div>
        <input
          ref={fileInput}
          aria-label="打开工作簿文件"
          type="file"
          hidden
          accept=".xlsx,.json"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void open(file);
            e.target.value = '';
          }}
        />
      </header>
      <div className="workspace">
        <section
          className="editor-wrap"
          aria-label="Univer 表格编辑器"
          onPointerDownCapture={(e) => {
            if (rtRef.current && (e.target as HTMLElement).id?.startsWith('univer-sheet-main-canvas')) {
              pointerStart.current = { x: e.clientX, y: e.clientY, target: rtRef.current.target() };
            } else pointerStart.current = null;
          }}
          onPointerMove={(e) => {
            const start = pointerStart.current;
            if (hold.current && start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8) {
              clearTimeout(hold.current);
              hold.current = null;
            }
          }}
          onPointerUp={talkEnd}
          onPointerCancel={cancelVoice}
          onContextMenu={(e) => {
            if (voiceActive.current) e.preventDefault();
          }}
        >
          <div ref={container} id="univer-editor" className="univer-editor" inert={!!busy || !!pending} />
          {!!busy && (
            <div className="tnt-ui editor-busy">
              <span className="spinner" />
              {busy}
              <button onClick={cancel}>取消</button>
            </div>
          )}
        </section>
        {panel && (
          <div className="tnt-ui panel-wrap">
            <AIPanel
              messages={messages}
              mode={mode}
              setMode={setMode}
              selection={selection}
              sheetName={sheetName}
              providerName={providers[settings.llm.provider].name}
              busy={busy}
              onSend={send}
              onCancel={cancel}
              onClose={() => setPanel(false)}
              onSettings={() => setDialog('settings')}
              onSkills={() => setDialog('skills')}
              onTalkStart={talkStart}
              onTalkEnd={talkEnd}
              onTalkCancel={cancelVoice}
              listening={listening}
              skills={skills}
            />
          </div>
        )}
      </div>
      <footer className="tnt-ui app-footer">
        <span className="save-status">{settings.autosave ? saved : '自动保存已关闭'}</span>
        <button aria-label="关于 TNT AI Sheet" onClick={() => setDialog('about')}>
          <Info size={14} />
          表格引擎：Univer 开源版
        </button>
        <span className="footer-spacer" />
        <button aria-label="技能管理" onClick={() => setDialog('skills')}>
          <Puzzle size={15} />
          <span>技能</span>
        </button>
        <button
          className={'talk-button ' + (listening ? 'listening' : '')}
          aria-label="按住开始语音输入"
          disabled={!runtime || !!busy || !!pending}
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            talkStart();
          }}
          onPointerUp={talkEnd}
          onPointerCancel={cancelVoice}
          onKeyDown={(e) => {
            if (e.code === 'Space' && !e.repeat) {
              e.preventDefault();
              talkStart();
            }
          }}
          onKeyUp={(e) => {
            if (e.code === 'Space') talkEnd();
          }}
        >
          <Mic size={17} />
          {listening
            ? voicePhase === 'starting'
              ? '正在连接…'
              : voicePhase === 'recognizing'
                ? '正在识别…'
                : '正在聆听…'
            : '按住说话'}
          <small>{selection}</small>
        </button>
      </footer>
      {notice && (
        <div className="tnt-ui toast" role="status">
          <span>{notice}</span>
          <button aria-label="关闭提示" onClick={() => setNotice('')}>
            <X size={16} />
          </button>
        </div>
      )}
      {listening && (
        <div className="tnt-ui voice-overlay">
          <span className="voice-dot" />
          <strong>{transcript || voiceStatus}</strong>
          <small>
            已选中 {voiceTarget.current ? rangeName(voiceTarget.current.range) : selection} ·{' '}
            {transcript ? voiceStatus : '松开后等待最终识别结果'}
          </small>
          <button onClick={cancelVoice}>取消</button>
        </div>
      )}
      <div className="tnt-ui">
        {dialog === 'settings' && (
          <SettingsModal
            settings={settings}
            apiKey={apiKey}
            onClose={() => setDialog(null)}
            onSave={(s, k) => {
              try {
                saveSettings(s);
                setSettings(s);
                setApiKey(k);
                platform.secrets.set('model', k);
                setDialog(null);
              } catch (e) {
                error(e);
              }
            }}
          />
        )}
        {dialog === 'skills' && (
          <SkillsModal
            skills={skills}
            onChange={(s) => {
              try {
                saveSkills(s);
                setSkills(s);
              } catch (e) {
                error(e);
              }
            }}
            onClose={() => setDialog(null)}
            onError={setNotice}
          />
        )}
        {dialog === 'about' && (
          <Modal title="关于 TNT AI Sheet" onClose={() => setDialog(null)}>
            <div className="modal-body">
              <p>
                表格引擎使用 Univer {UNIVER_VERSION}，已加载 {OPEN_SOURCE_PLUGINS.length} 个开源扩展。
              </p>
              <p>
                菜单中提供公式、格式、排序筛选、条件格式、数据验证、图片、批注、超链接、查找替换、冻结和保护等功能。
              </p>
              <p>
                “保存工作簿”会下载完整的 .univer.json 文件。XLSX
                导出支持基础数据、公式、多工作表和常见格式；图片、批注、条件格式等内容可能无法完整保留。
              </p>
              <p>
                当前版本不支持图表、数据透视表、打印、云端协作和版本历史。移动端界面基于 Univer
                的实验性支持，部分操作可能与桌面不同。
              </p>
              <details>
                <summary>已加载扩展</summary>
                <ul>
                  {OPEN_SOURCE_PLUGINS.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </details>
            </div>
          </Modal>
        )}
        {pending && (
          <Modal title="确认修改" onClose={() => setPending(null)}>
            <div className="modal-body">
              <p>将执行以下修改：</p>
              <ul>
                {[...new Set(pending.risks)].map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <p>当前选区：{rangeName(pending.target.range)}</p>
              <ol>
                {pending.steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </div>
            <div className="modal-footer">
              <button onClick={() => setPending(null)}>取消</button>
              <button
                className="primary-button"
                onClick={async () => {
                  if (!runtime) return;
                  const plan = pending;
                  setPending(null);
                  busyRef.current = true;
                  setBusy('正在应用修改');
                  try {
                    await new OperationEngine(runtime).commit(plan, new AbortController().signal);
                    setMessages((m) => [
                      ...m,
                      { id: crypto.randomUUID(), role: 'assistant', text: plan.message, steps: plan.steps },
                    ]);
                  } catch (e) {
                    error(e);
                  } finally {
                    busyRef.current = false;
                    setBusy('');
                  }
                }}
              >
                确认并修改
              </button>
            </div>
          </Modal>
        )}
      </div>
    </main>
  );
}
