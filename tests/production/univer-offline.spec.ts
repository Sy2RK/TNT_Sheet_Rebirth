import { test, expect } from '@playwright/test';
test('production never requests local developer credentials or exposes config routes', async ({
  page,
  request,
}) => {
  const configRequests: string[] = [];
  page.on('request', (req) => {
    if (req.url().includes('/_dev/')) configRequests.push(req.url());
  });
  await page.goto('/');
  await page.getByRole('button', { name: '偏好设置', exact: true }).click();
  expect(
    await page
      .getByLabel('API 密钥', { exact: true })
      .evaluate((element) => (element as HTMLInputElement).value === ''),
  ).toBe(true);
  expect(configRequests).toEqual([]);
  for (const path of ['/config.local.json', '/_dev/model-config']) {
    const response = await request.get(path, { headers: { 'X-TNT-Local-Config': '1' } });
    expect((await response.text()).includes('"providers"')).toBe(false);
    expect(response.headers()['content-type']).not.toContain('application/json');
  }
});
test('production editor and native file save work offline', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('canvas[id^="univer-sheet-main-canvas"]')).toBeVisible({ timeout: 60000 });
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('canvas[id^="univer-sheet-main-canvas"]')).toBeVisible();
  await page.locator('canvas[id^="univer-sheet-main-canvas"]').dblclick({ position: { x: 90, y: 248 } });
  await page.keyboard.type('offline', { delay: 100 });
  await page.keyboard.press('Enter');
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: '保存工作簿', exact: true }).click();
  expect((await event).suggestedFilename()).toMatch(/\.univer\.json$/);
  const xlsx = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 XLSX', exact: true }).click();
  expect((await xlsx).suggestedFilename()).toMatch(/\.xlsx$/);
  expect(errors).toEqual([]);
  await context.setOffline(false);
});
