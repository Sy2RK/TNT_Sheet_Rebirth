import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      'tnt-settings',
      JSON.stringify({
        llm: { provider: 'local', endpoint: '', model: '', temperature: 0.2 },
        speechLanguage: 'zh-CN',
        autosave: true,
      }),
    ),
  );
});
test('service errors explain missing text and clear the voice overlay', async ({ page }) => {
  await page.addInitScript(`window.SpeechRecognition=class {
    start(){setTimeout(()=>this.onerror?.({error:'network'}),300)} stop(){} abort(){}
  }`);
  await page.goto('/');
  const mic = page.locator('.app-footer').getByRole('button', { name: '按住开始语音输入', exact: true });
  await expect(mic).toBeEnabled();
  const box = await mic.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await expect(page.locator('.voice-overlay')).toContainText('正在启动语音服务');
  await expect(page.locator('.toast')).toContainText('network');
  await expect(page.locator('.voice-overlay')).toHaveCount(0);
  await page.mouse.up();
  await expect(mic).toContainText('按住说话');
});
test('unconfirmed text is visible and never submitted as an AI instruction', async ({ page }) => {
  await page.addInitScript(`window.SpeechRecognition=class {
    start(){setTimeout(()=>{this.onstart?.();this.onresult?.({results:[{isFinal:false,0:{transcript:'删除工作表'}}],resultIndex:0})},30)}
    stop(){this.onend?.()} abort(){}
  }`);
  await page.goto('/');
  const mic = page.locator('.app-footer').getByRole('button', { name: '按住开始语音输入', exact: true });
  await expect(mic).toBeEnabled();
  const box = await mic.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await expect(page.locator('.voice-overlay')).toContainText('删除工作表');
  await page.mouse.up();
  await expect(page.locator('.toast')).toContainText('未确认');
  await expect(page.locator('.toast')).toContainText('删除工作表');
  await expect(page.locator('.message-text')).toHaveCount(0);
});
