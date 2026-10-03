import { Component, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

import { demoWorkbook } from './sheet/snapshot';
import { platform } from './platform/browser';
import { loadDevelopmentConnections } from './platform/development';
class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    return this.state.error ? (
      <div style={{ padding: 48, fontFamily: 'sans-serif' }}>
        <h1>应用遇到问题，暂时无法正常显示。</h1>
        <p>错误信息：{this.state.error}</p>
        <p>如果已开启自动保存，可重新加载后尝试恢复工作簿。</p>
        <button onClick={() => location.reload()}>重新加载页面</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
async function boot() {
  let workbook = demoWorkbook(),
    bootError: string | undefined;
  try {
    const restored = await platform.storage.load();
    if (restored) workbook = restored;
  } catch {
    bootError = '无法读取上次保存的工作簿，已打开示例工作簿。请检查浏览器的存储权限。';
  }

  if (import.meta.env.DEV) {
    const configError = await loadDevelopmentConnections();
    if (configError) bootError = [bootError, configError].filter(Boolean).join(' ');
  }
  createRoot(document.getElementById('root')!).render(
    <ErrorBoundary>
      <App initial={workbook} bootError={bootError} />
    </ErrorBoundary>,
  );
}
void boot();
