import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownWideNarrow,
  ArrowUp,
  Check,
  ChevronDown,
  FileJson,
  LockKeyhole,
  Mic,
  Plus,
  Puzzle,
  ScanLine,
  Settings2,
  ShieldCheck,
  Sparkles,
  Square,
  Table2,
  Trash2,
  Upload,
  WandSparkles,
  X,
} from 'lucide-react';
import type { ChatMessage, Mode, Settings, Skill, ProviderKind } from '../types';
import {
  providers,
  validateEndpoint,
  discoverModels,
  selectModel,
  type AvailableModel,
} from '../ai/providers';
import { parseSkill } from '../ai/skills';
import { toolLabels } from '../ai/tools';
import { Modal } from './Modal';
import { getDevelopmentConnection } from '../platform/development';
interface AIProps {
  messages: ChatMessage[];
  mode: Mode;
  setMode: (m: Mode) => void;
  selection: string;
  sheetName: string;
  providerName: string;
  busy: string;
  onSend: (text: string, mode?: Mode) => void;
  onCancel: () => void;
  onClose: () => void;
  onSettings: () => void;
  onSkills: () => void;
  onTalkStart: () => void;
  onTalkEnd: () => void;
  onTalkCancel: () => void;
  listening: boolean;
  skills: Skill[];
}
export function AIPanel(p: AIProps) {
  const [text, setText] = useState('');
  const bottom = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' });
  }, [p.messages, p.busy]);
  const send = () => {
    if (text.trim() && !p.busy) {
      p.onSend(text.trim());
      setText('');
    }
  };
  const suggestions = [
    {
      icon: ArrowDownWideNarrow,
      title: '按首列降序排列',
      desc: '按当前选区第一列从大到小排序',
      prompt: '按当前选区第一列从大到小排序',
      mode: 'edit' as Mode,
    },
    {
      icon: ScanLine,
      title: '检查数值异常',
      desc: '查找当前工作表中明显偏离的数据',
      prompt: '分析当前工作表，找出明显异常数据',
      mode: 'ask' as Mode,
    },
    {
      icon: WandSparkles,
      title: '清理选区数据',
      desc: '去除多余空格，并规范可识别的数字',
      prompt: '清理当前选区中的多余空格和数字文本',
      mode: 'edit' as Mode,
    },
    {
      icon: Table2,
      title: '按部门汇总金额',
      desc: '将统计结果放到新工作表',
      prompt: '按部门汇总金额，并将结果放到新工作表',
      mode: 'agent' as Mode,
    },
  ];
  return (
    <aside className="ai-panel" aria-label="AI 助手">
      <div className="ai-header">
        <div className="ai-title">
          <Sparkles size={19} />
          <strong>AI 助手</strong>
          <span>测试版</span>
        </div>
        <div>
          <button className="icon-button" title="模型设置" aria-label="模型设置" onClick={p.onSettings}>
            <Settings2 size={16} />
          </button>
          <button className="icon-button" aria-label="关闭 AI 助手" onClick={p.onClose}>
            <X size={18} />
          </button>
        </div>
      </div>
      <div className="ai-mode-tabs">
        {(['ask', 'edit', 'agent'] as Mode[]).map((m) => (
          <button key={m} className={p.mode === m ? 'active' : ''} onClick={() => p.setMode(m)}>
            <span>{m === 'ask' ? '问答' : m === 'edit' ? '编辑' : '多步任务'}</span>
            {m === 'ask' ? '仅分析' : m === 'edit' ? '编辑表格' : '执行多步操作'}
          </button>
        ))}
      </div>
      <div className="ai-conversation">
        {!p.messages.length ? (
          <div className="ai-welcome">
            <div className="ai-orbit">
              <div className="orbit-ring one" />
              <div className="orbit-ring two" />
              <Sparkles size={32} strokeWidth={1.5} />
              <span className="orbit-dot" />
              <i>✦</i>
            </div>
            <div className="eyebrow">表格 AI 助手</div>
            <h2>
              用自然语言
              <br />
              处理表格。
            </h2>
            <p>
              选择单元格或区域，再输入问题或操作。
              <br />
              也可以按住麦克风，说出问题或操作。
            </p>
            <div className="suggestion-list">
              {suggestions.map(({ icon: Icon, title, desc, prompt, mode }) => (
                <button
                  key={title}
                  onClick={() => {
                    p.setMode(mode);
                    p.onSend(prompt, mode);
                  }}
                >
                  <span className="suggestion-icon">
                    <Icon size={18} />
                  </span>
                  <span>
                    <strong>{title}</strong>
                    <small>{desc}</small>
                  </span>
                  <span className="suggestion-arrow">↗</span>
                </button>
              ))}
            </div>
            <div className="ai-tip">
              <span>✧</span>
              <p>
                选择要处理的区域后，长按麦克风，
                <br />
                说出问题或操作。
              </p>
            </div>
          </div>
        ) : (
          p.messages.map((m) => (
            <div key={m.id} className={`chat-message ${m.role} ${m.error ? 'error' : ''}`}>
              <div className="message-author">
                {m.role === 'assistant' ? <Sparkles size={15} /> : <span className="user-avatar">我</span>}
                <span>{m.role === 'assistant' ? 'TNT AI' : '你'}</span>
                {m.target && <small>{m.target}</small>}
              </div>
              <div className="message-text">{m.text}</div>
              {m.steps?.length ? (
                <details className="message-steps">
                  <summary>
                    <Check size={14} /> {m.error ? '操作记录' : `已执行 ${m.steps.length} 个步骤`}
                  </summary>
                  {m.steps.map((step, i) => (
                    <div key={i}>
                      <Check size={12} />
                      {step}
                    </div>
                  ))}
                </details>
              ) : null}
            </div>
          ))
        )}
        {p.busy && (
          <div className="ai-busy">
            <span className="spinner" />
            {p.busy}
            <button onClick={p.onCancel} aria-label="取消 AI 操作">
              <Square size={13} />
            </button>
          </div>
        )}
        <div ref={bottom} />
      </div>
      <div className="ai-composer-area">
        <div className="context-chip">
          <ScanLine size={13} />
          <span>{p.sheetName}</span>
          <b>{p.selection}</b>
          <span className="context-dot" />
          当前选区
        </div>
        <div className="ai-composer">
          <textarea
            ref={input}
            aria-label="输入问题或操作"
            placeholder={
              p.mode === 'ask'
                ? '关于当前选区，你想了解什么？'
                : p.mode === 'agent'
                  ? '描述要完成的任务…'
                  : '描述要修改的内容…'
            }
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
          />
          {text.startsWith('/') && (
            <div className="slash-menu">
              {p.skills
                .filter((s) => s.enabled && ('/' + s.slashCommand).startsWith(text))
                .map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setText('/' + s.slashCommand + ' ');
                      input.current?.focus();
                    }}
                  >
                    <Puzzle size={14} />
                    {s.name}
                    <small>/{s.slashCommand}</small>
                  </button>
                ))}
            </div>
          )}
          <div className="composer-actions">
            <button title="技能管理" aria-label="技能管理" onClick={p.onSkills}>
              <Puzzle size={16} />
              <span>技能</span>
            </button>
            <button
              className={p.listening ? 'listening' : ''}
              title="按住开始语音输入"
              aria-label="按住开始语音输入"
              onPointerDown={(e) => {
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                p.onTalkStart();
              }}
              onPointerUp={p.onTalkEnd}
              onPointerCancel={p.onTalkCancel}
            >
              <Mic size={16} />
            </button>
            <span className="composer-key">↵ 发送</span>
            <button
              className="send-button"
              title="发送内容"
              aria-label="发送内容"
              disabled={!text.trim() || !!p.busy}
              onClick={send}
            >
              <ArrowUp size={18} />
            </button>
          </div>
        </div>
        <div className="model-indicator">
          <button onClick={p.onSettings}>
            <span className="green-dot" />
            {p.providerName}
            <ChevronDown size={12} />
          </button>
          <span>{p.mode === 'ask' ? '只分析，不修改表格' : 'AI 修改可一次撤销'}</span>
        </div>
      </div>
    </aside>
  );
}
export function SettingsModal({
  settings,
  apiKey,
  onSave,
  onClose,
}: {
  settings: Settings;
  apiKey: string;
  onSave: (s: Settings, key: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(structuredClone(settings)),
    [secret, setSecret] = useState(apiKey),
    [error, setError] = useState('');
  const [models, setModels] = useState<AvailableModel[]>([]),
    [modelState, setModelState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle'),
    [modelNotice, setModelNotice] = useState(''),
    [refresh, setRefresh] = useState(0),
    [manual, setManual] = useState(false);
  const manualRef = useRef(manual);
  manualRef.current = manual;
  useEffect(() => {
    const { provider, endpoint } = draft.llm;
    const abort = new AbortController();
    let alive = true;
    setModels([]);
    setModelState('idle');
    setModelNotice('');
    if (provider === 'local' || !endpoint.trim() || (!secret.trim() && provider !== 'ollama')) return;
    const timer = setTimeout(async () => {
      setModelState('loading');
      try {
        const list = await discoverModels({ provider, endpoint }, secret, abort.signal);
        if (!alive) return;
        setModels(list);
        setModelState('ready');
        setModelNotice(
          provider === 'qwen'
            ? `已获取 ${list.length} 个文本模型；目录不代表均已开通，调用权限以实际请求为准。`
            : `已获取 ${list.length} 个模型`,
        );
        if (!manualRef.current)
          setDraft((previous) => ({
            ...previous,
            llm: { ...previous.llm, model: selectModel(list, provider, previous.llm.model) },
          }));
      } catch (e) {
        if (!alive || abort.signal.aborted) return;
        setModelState('error');
        setModelNotice((e as Error).message);
      }
    }, 650);
    return () => {
      alive = false;
      clearTimeout(timer);
      abort.abort();
    };
  }, [draft.llm.provider, draft.llm.endpoint, secret, refresh]);
  const changeProvider = (provider: ProviderKind) => {
    const local = getDevelopmentConnection(provider);
    setDraft({
      ...draft,
      llm: {
        ...draft.llm,
        provider,
        endpoint: local?.endpoint || providers[provider].endpoint,
        model: local?.model || providers[provider].model,
      },
    });
    setSecret(local?.apiKey || '');
    setManual(false);
    setError('');
  };
  const localConnection = getDevelopmentConnection(draft.llm.provider, draft.llm.endpoint);
  const usingLocalKey = Boolean(localConnection && secret === localConnection.apiKey);
  const changeEndpoint = (endpoint: string) => {
    const next = getDevelopmentConnection(draft.llm.provider, endpoint);
    if (usingLocalKey || !secret) setSecret(next?.apiKey || '');
    setDraft({ ...draft, llm: { ...draft.llm, endpoint } });
  };
  return (
    <Modal title="偏好设置" subtitle="设置模型、语音输入和自动保存。" onClose={onClose}>
      <div className="modal-body">
        <div className="section-label">
          <Sparkles size={15} />
          模型连接
        </div>
        <label className="field">
          模型服务
          <select
            aria-label="模型服务"
            value={draft.llm.provider}
            onChange={(e) => changeProvider(e.target.value as ProviderKind)}
          >
            {Object.entries(providers).map(([key, p]) => (
              <option key={key} value={key}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        {draft.llm.provider === 'local' ? (
          <div className="info-card">
            <ShieldCheck size={22} />
            <div>
              <strong>本地模式，无需配置</strong>
              <p>
                可处理排序、格式、统计、清洗和汇总等常见操作。指令由浏览器内置规则处理，不会将工作簿数据发送至模型服务。
              </p>
            </div>
          </div>
        ) : (
          <>
            <label className="field">
              API 地址
              <input
                aria-label="API 地址"
                placeholder="粘贴服务商提供的 API 地址"
                value={draft.llm.endpoint}
                onChange={(e) => changeEndpoint(e.target.value)}
              />
            </label>
            <label className="field">
              API 密钥 {draft.llm.provider === 'ollama' && <small>（可选）</small>}
              <input
                aria-label="API 密钥"
                type="password"
                autoComplete="off"
                placeholder="输入 API 密钥"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
              />
            </label>
            {usingLocalKey && <p className="field-hint">已从本地开发配置载入密钥，刷新后会自动恢复。</p>}
            <label className="field">
              模型
              {manual ? (
                <input
                  aria-label="模型名称"
                  placeholder="填写服务商提供的模型名称"
                  value={draft.llm.model}
                  onChange={(e) => setDraft({ ...draft, llm: { ...draft.llm, model: e.target.value } })}
                />
              ) : (
                <select
                  aria-label="模型"
                  value={draft.llm.model}
                  disabled={modelState !== 'ready'}
                  onChange={(e) => setDraft({ ...draft, llm: { ...draft.llm, model: e.target.value } })}
                >
                  {!models.some((model) => model.id === draft.llm.model) && (
                    <option value={draft.llm.model}>
                      {draft.llm.model ? `${draft.llm.model}（当前配置）` : '请先获取模型列表'}
                    </option>
                  )}
                  {models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name === model.id ? model.id : `${model.name} · ${model.id}`}
                    </option>
                  ))}
                </select>
              )}
            </label>
            <div className="model-discovery-actions">
              <button
                className="text-button"
                disabled={
                  modelState === 'loading' ||
                  !draft.llm.endpoint.trim() ||
                  (!secret.trim() && draft.llm.provider !== 'ollama')
                }
                onClick={() => setRefresh((value) => value + 1)}
              >
                {modelState === 'loading' ? '正在获取…' : '刷新模型列表'}
              </button>
              <button
                className="text-button"
                onClick={() => {
                  if (manual && models.length)
                    setDraft((previous) => ({
                      ...previous,
                      llm: {
                        ...previous.llm,
                        model: selectModel(models, previous.llm.provider, previous.llm.model),
                      },
                    }));
                  setManual(!manual);
                }}
              >
                {manual ? '从列表选择' : '手动填写模型'}
              </button>
            </div>
            <p className={modelState === 'error' ? 'error-box' : 'field-hint'} role="status">
              {modelState === 'loading'
                ? '正在获取可用模型…'
                : modelNotice || '输入 API 地址和密钥后，将自动获取可用模型。'}
            </p>
            <div className="field-hint">
              <LockKeyhole size={14} />
              手动输入的密钥仅用于本次会话；开发模式可从本地配置自动载入。提交 AI
              请求时，当前选区及必要的周边数据会发送给所选服务商。若无法连接，请确认服务商允许浏览器访问。
            </div>
          </>
        )}
        <div className="section-label spaced">
          <Mic size={15} />
          语音与存储
        </div>
        <label className="field">
          识别语言
          <select
            value={draft.speechLanguage}
            onChange={(e) => setDraft({ ...draft, speechLanguage: e.target.value })}
          >
            <option value="zh-CN">中文（普通话）</option>
            <option value="en-US">英语（美国）</option>
            <option value="zh-HK">中文（粤语）</option>
          </select>
        </label>
        <div className="toggle-row">
          <div>
            <strong>自动保存工作簿</strong>
            <p>将工作簿保存在此浏览器中，下次打开时可继续编辑。</p>
          </div>
          <button
            role="switch"
            aria-label="自动保存工作簿"
            aria-checked={draft.autosave}
            className={`toggle ${draft.autosave ? 'on' : ''}`}
            onClick={() => setDraft({ ...draft, autosave: !draft.autosave })}
          />
        </div>
        <p className="field-hint">
          语音识别由浏览器提供，可能需要联网。按住麦克风开始识别，松开后提交内容；是否修改表格取决于当前模式。
        </p>
        {error && <div className="error-box">{error}</div>}
      </div>
      <div className="modal-footer">
        <button className="secondary-button" onClick={onClose}>
          取消
        </button>
        <button
          className="primary-button"
          onClick={() => {
            try {
              if (draft.llm.provider !== 'local') {
                validateEndpoint(draft.llm.endpoint);
                if (!draft.llm.model.trim()) throw new Error('请选择模型，或手动填写模型名称。');
              }
              onSave(
                {
                  ...draft,
                  llm: {
                    ...draft.llm,
                    endpoint: draft.llm.endpoint.trim().replace(/\/+$/, ''),
                    model: draft.llm.model.trim(),
                  },
                },
                secret.trim(),
              );
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          保存设置
        </button>
      </div>
    </Modal>
  );
}
const sampleSkill = {
  id: 'my-skill',
  name: '自定义技能',
  description: '说明此技能适用的场景',
  prompt: '处理选区前先读取数据，并保留已有公式和原始数据结构。',
  enabled: true,
  tools: ['read_range', 'set_format'],
  triggers: ['自定义'],
  slashCommand: 'custom',
  context: 'selection',
};
export function SkillsModal({
  skills,
  onChange,
  onClose,
  onError,
}: {
  skills: Skill[];
  onChange: (s: Skill[]) => void;
  onClose: () => void;
  onError: (s: string) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null),
    [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const install = (text: string) => {
    try {
      const skill = parseSkill(text);
      if (skills.some((s) => s.id !== skill.id && s.slashCommand === skill.slashCommand))
        throw new Error('此斜杠命令已被其他技能使用');
      onChange([...skills.filter((s) => s.id !== skill.id), skill]);
      setEditing(null);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <Modal title="我的技能" subtitle="为 AI 指定处理数据时的规则和可用操作。" onClose={onClose} wide>
      <div className="modal-body">
        <div className="skills-toolbar">
          <span>
            {skills.filter((s) => s.enabled).length} 项已启用 / 共 {skills.length} 项
          </span>
          <button className="secondary-button" onClick={() => input.current?.click()}>
            <Upload size={15} />
            导入技能（JSON）
          </button>
          <button className="primary-button" onClick={() => setEditing(JSON.stringify(sampleSkill, null, 2))}>
            <Plus size={15} />
            新建技能
          </button>
          <input
            ref={input}
            type="file"
            hidden
            accept=".json,application/json"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                if (file.size > 100000) {
                  onError('技能文件不能超过 100 KB。');
                  return;
                }
                install(await file.text());
              }
              e.target.value = '';
            }}
          />
        </div>
        {editing !== null ? (
          <div className="skill-editor">
            <label className="field">
              技能配置（JSON）
              <textarea
                aria-label="技能配置（JSON）"
                spellCheck={false}
                value={editing}
                onChange={(e) => setEditing(e.target.value)}
              />
            </label>
            <p className="field-hint">可用操作：{Object.values(toolLabels).join('、')}</p>
            <div className="inline-actions">
              <button className="secondary-button" onClick={() => setEditing(null)}>
                返回列表
              </button>
              <button className="primary-button" onClick={() => install(editing)}>
                保存技能
              </button>
            </div>
          </div>
        ) : (
          <div className="skill-list">
            {skills.map((s) => (
              <div className="skill-card" key={s.id}>
                <div className="skill-icon">
                  <Puzzle size={22} />
                </div>
                <div className="skill-info">
                  <div>
                    <strong>{s.name}</strong>
                    <code>/{s.slashCommand}</code>
                  </div>
                  <p>{s.description}</p>
                  <button className="text-button" onClick={() => setEditing(JSON.stringify(s, null, 2))}>
                    编辑技能规则
                  </button>
                </div>
                <div className="skill-actions">
                  <button
                    role="switch"
                    aria-label={`${s.name} 开关`}
                    aria-checked={s.enabled}
                    className={`toggle ${s.enabled ? 'on' : ''}`}
                    onClick={() =>
                      onChange(skills.map((x) => (x.id === s.id ? { ...x, enabled: !x.enabled } : x)))
                    }
                  />
                  <button
                    className="icon-button"
                    aria-label={`删除 ${s.name}`}
                    onClick={() => onChange(skills.filter((x) => x.id !== s.id))}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {error && <div className="error-box">技能配置有误：{error}</div>}
        <div className="skill-note">
          <FileJson size={17} />
          <p>
            输入 <code>/</code> 调用技能时，会限制 AI 可使用的表格操作。普通指令自动匹配的技能提供处理规则。
          </p>
        </div>
      </div>
    </Modal>
  );
}
