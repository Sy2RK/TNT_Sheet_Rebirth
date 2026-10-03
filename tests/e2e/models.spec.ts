import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.route('**/_dev/model-config', (route) => route.fulfill({ json: { providers: {} } }));
});

const listed = {
  data: [
    { id: 'deepseek-v4-pro', name: 'DeepSeek-V4-Pro' },
    { id: 'deepseek-flash', name: 'DeepSeek-V4.1-Flash' },
  ],
};
test('URL and key automatically load models, prefer Flash and keep keys session-only', async ({ page }) => {
  let requests = 0;
  await page.route('https://api.deepseek.com/v1/models', async (route) => {
    requests++;
    expect(route.request().headers().authorization).toBe('Bearer test-session-key');
    await route.fulfill({ json: listed });
  });
  await page.goto('/');
  await page.getByRole('button', { name: '偏好设置', exact: true }).click();
  await expect(page.getByLabel('模型服务')).toHaveValue('deepseek');
  await page.getByLabel('API 密钥', { exact: true }).fill('test-session-key');
  await expect(page.getByLabel('模型', { exact: true })).toBeEnabled();
  await expect(page.getByLabel('模型', { exact: true })).toHaveValue('deepseek-flash');
  await expect(
    page.getByRole('option', { name: 'DeepSeek-V4.1-Flash · deepseek-flash', exact: true }),
  ).toHaveCount(1);
  await page.getByLabel('模型', { exact: true }).selectOption('deepseek-v4-pro');
  await page.getByRole('button', { name: '刷新模型列表', exact: true }).click();
  await expect.poll(() => requests).toBe(2);
  await expect(page.getByLabel('模型', { exact: true })).toBeEnabled();
  await expect(page.getByLabel('模型', { exact: true })).toHaveValue('deepseek-v4-pro');
  await page.getByRole('button', { name: '保存设置', exact: true }).click();
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage }))).not.toContain('test-session-key');
  await page.reload();
  await page.getByRole('button', { name: '偏好设置', exact: true }).click();
  await expect(page.getByLabel('API 密钥', { exact: true })).toHaveValue('');
});

test('failed discovery allows manual configuration and retry', async ({ page }) => {
  let fail = true;
  await page.route('https://api.deepseek.com/v1/models', async (route) => {
    await route.fulfill(fail ? { status: 404, body: 'Unavailable' } : { json: listed });
  });
  await page.goto('/');
  await page.getByRole('button', { name: '偏好设置', exact: true }).click();
  await page.getByLabel('API 密钥', { exact: true }).fill('test-key');
  await expect(page.getByText('此服务未提供模型列表', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: '手动填写模型', exact: true }).click();
  await page.getByLabel('模型名称', { exact: true }).fill('custom-model');
  fail = false;
  await page.getByRole('button', { name: '刷新模型列表', exact: true }).click();
  await expect(page.getByText('已获取 2 个模型', { exact: true })).toBeVisible();
  await expect(page.getByLabel('模型名称', { exact: true })).toHaveValue('custom-model');
  await page.getByRole('button', { name: '从列表选择', exact: true }).click();
  await expect(page.getByLabel('模型', { exact: true })).toHaveValue('deepseek-flash');
});

test('an old connection response cannot replace models from a new URL', async ({ page }) => {
  let started = false;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('https://api.deepseek.com/v1/models', async (route) => {
    started = true;
    await gate;
    await route.fulfill({ json: listed }).catch(() => {});
  });
  await page.route('https://new.example/v1/models', async (route) => {
    await route.fulfill({ json: { data: [{ id: 'new-model', name: 'New Model' }] } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: '偏好设置', exact: true }).click();
  await page.getByLabel('API 密钥', { exact: true }).fill('test-key');
  await expect.poll(() => started).toBe(true);
  await page.getByLabel('API 地址', { exact: true }).fill('https://new.example/v1');
  await expect(page.getByLabel('模型', { exact: true })).toHaveValue('new-model');
  release();
  await expect(page.getByLabel('模型', { exact: true })).toHaveValue('new-model');
  await expect(page.getByRole('option', { name: /DeepSeek-V4/ })).toHaveCount(0);
});

test('local config restores both providers, filters Qwen models and clears an automatic key on URL changes', async ({
  page,
}) => {
  await page.route('**/_dev/model-config', (route) =>
    route.fulfill({
      json: {
        providers: {
          deepseek: {
            endpoint: 'https://api.deepseek.com/v1',
            model: 'deepseek-flash',
            apiKey: 'fake-local-deepseek',
          },
          qwen: {
            endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
            model: 'qwen3.8-flash',
            apiKey: 'fake-local-qwen',
          },
        },
      },
    }),
  );
  await page.route('https://api.deepseek.com/v1/models', (route) => route.fulfill({ json: listed }));
  await page.route('**/_dev/qwen-models?**', (route) => {
    expect(route.request().headers().authorization).toBe('Bearer fake-local-qwen');
    return route.fulfill({
      json: {
        success: true,
        output: {
          total: 2,
          page_no: 1,
          models: [
            {
              model: 'qwen3.8-flash',
              name: 'Qwen3.8-Flash',
              capabilities: ['TG'],
              inference_metadata: { request_modality: ['Text'], response_modality: ['Text'] },
            },
            {
              model: 'qwen-audio-3.1-asr-flash-filetrans',
              capabilities: ['ASR'],
              inference_metadata: { request_modality: ['Audio'], response_modality: ['Text'] },
            },
          ],
        },
      },
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: '偏好设置', exact: true }).click();
  await expect(page.getByLabel('API 密钥', { exact: true })).toHaveValue('fake-local-deepseek');
  await page.getByLabel('模型服务').selectOption('qwen');
  await expect(page.getByLabel('API 密钥', { exact: true })).toHaveValue('fake-local-qwen');
  await expect(page.getByLabel('模型', { exact: true })).toHaveValue('qwen3.8-flash');
  await expect(page.getByText('已获取 1 个文本模型', { exact: false })).toBeVisible();
  await expect(page.getByRole('option', { name: /asr-flash-filetrans/ })).toHaveCount(0);
  await page.getByRole('button', { name: '保存设置', exact: true }).click();
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage }))).not.toContain('fake-local');
  await page.reload();
  await page.getByRole('button', { name: '偏好设置', exact: true }).click();
  await expect(page.getByLabel('API 密钥', { exact: true })).toHaveValue('fake-local-qwen');
  await page.getByLabel('API 地址', { exact: true }).fill('https://other.example/v1');
  await expect(page.getByLabel('API 密钥', { exact: true })).toHaveValue('');
});

test('development config cannot be downloaded as a file or read without the local request header', async ({
  request,
}) => {
  for (const path of [
    '/config.local.json',
    '/@fs/D:/Workspace/TNT_sheet_rebirth/config.local.json',
    '/_dev/model-config',
  ]) {
    const response = await request.get(path);
    expect(response.status()).toBe(403);
    expect(await response.text()).not.toContain('sk-');
  }
  const crossOrigin = await request.get('/_dev/model-config', {
    headers: { 'X-TNT-Local-Config': '1', Origin: 'https://other.example' },
  });
  expect(crossOrigin.status()).toBe(403);
  for (const target of [
    'http://127.0.0.1/api/v1/models',
    'https://other.example/api/v1/models',
    'https://dashscope.aliyuncs.com/api/v1/tasks',
  ]) {
    const proxy = await request.get('/_dev/qwen-models?url=' + encodeURIComponent(target), {
      headers: { 'X-TNT-Local-Config': '1', Authorization: 'Bearer fake-test-key' },
    });
    expect(proxy.status()).toBe(400);
  }
});
