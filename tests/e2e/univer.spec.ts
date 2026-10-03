import { test, expect, type Page } from '@playwright/test';
// Existing editor tests exercise the offline rule provider independently of model settings.
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
async function ready(page: Page) {
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => !!window.__tnt)).toBe(true);
  await expect
    .poll(() => page.evaluate(() => window.__tnt!.runtime.getSheet().getRange('G2').getRawValue()))
    .toBe(0.856);
}
async function select(page: Page, range: string) {
  await page.evaluate((r) => {
    const s = window.__tnt!.runtime.getSheet();
    s.setActiveSelection(s.getRange(r));
  }, range);
}
test('native editor starts with all OSS plugins', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('#univer-editor canvas:visible').first()).toBeVisible({ timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: test.info().outputPath('univer-desktop.png'), fullPage: true });
  expect(errors).toEqual([]);
  await expect.poll(() => page.evaluate(() => !!window.__tnt)).toBe(true);
});

test('native keyboard editing and formula calculation', async ({ page }) => {
  await ready(page);
  await page.locator('canvas[id^="univer-sheet-main-canvas"]').dblclick({ position: { x: 90, y: 248 } });
  await page.keyboard.type('42', { delay: 100 });
  await page.keyboard.press('Enter');
  await expect
    .poll(() => page.evaluate(() => window.__tnt!.runtime.getSheet().getRange('A10').getRawValue()))
    .toBe(42);
  await page.evaluate(() => window.__tnt!.runtime.getSheet().getRange('A11').setValue('=A10*2'));
  await expect
    .poll(() => page.evaluate(() => window.__tnt!.runtime.getSheet().getRange('A11').getRawValue()))
    .toBe(84);
});

test('AI multiple edits use one native undo and redo', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await ready(page);
  await select(page, 'G2:G7');
  const before = await page.evaluate(() =>
    Array.from({ length: 6 }, (_, i) => {
      const r = window.__tnt!.runtime.getSheet().getRange(i + 1, 6, 1, 1);
      return { v: r.getRawValue(), f: r.getCellData()?.f, s: r.getCellStyleData() };
    }),
  );
  await page.getByRole('button', { name: '编辑 编辑表格', exact: true }).click();
  await page.getByLabel('输入问题或操作').fill('改成百分比，并把超过 80% 的标红，加粗');
  await page.getByLabel('发送内容').click();
  await expect(page.locator('.message-text').last()).toContainText('已完成', { timeout: 30000 });
  expect(
    await page.evaluate(() => window.__tnt!.runtime.getSheet().getRange('G2').getCellStyleData()?.cl?.rgb),
  ).toBe('#be4353');
  await page.evaluate(() => window.__tnt!.runtime.api.undo());
  expect(
    await page.evaluate(() =>
      Array.from({ length: 6 }, (_, i) => {
        const r = window.__tnt!.runtime.getSheet().getRange(i + 1, 6, 1, 1);
        return { v: r.getRawValue(), f: r.getCellData()?.f, s: r.getCellStyleData() };
      }),
    ),
  ).toEqual(before);
  await page.evaluate(() => window.__tnt!.runtime.api.redo());
  expect(
    await page.evaluate(() => window.__tnt!.runtime.getSheet().getRange('G2').getCellStyleData()?.bl),
  ).toBe(1);
  expect(errors).toEqual([]);
});

test('AI summary creates native sheet and undo removes it', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: /按部门汇总金额/ }).click();
  await expect(page.locator('.message-text').last()).toContainText('已完成', { timeout: 30000 });
  expect(
    await page.evaluate(() =>
      window.__tnt!.runtime.workbook.getSheetByName('部门汇总')?.getRange('A1:B4').getRawValues(),
    ),
  ).toEqual([
    ['分组', '汇总金额'],
    ['华东销售部', 108000],
    ['华南销售部', 105400],
    ['华北销售部', 151600],
  ]);
  await page.evaluate(() => window.__tnt!.runtime.api.undo());
  expect(await page.evaluate(() => !!window.__tnt!.runtime.workbook.getSheetByName('部门汇总'))).toBe(false);
});

test('plugin resources persist across native save and reload', async ({ page }) => {
  await ready(page);
  await page.evaluate(async () => {
    const rt = window.__tnt!.runtime,
      s = rt.getSheet(),
      api = rt.api;
    s.getRange('J2:J4').setDataValidation(api.newDataValidation().requireNumberBetween(1, 10).build());
    await s.getRange('B2').addCommentAsync('核对客户名称');
    s.getRange('A1:I7').createFilter();
    s.getRange('B3').createOrUpdateNote({ note: '本地注释', width: 180, height: 100 });
    s.addConditionalFormattingRule(
      s
        .getRange('E2:E7')
        .createConditionalFormattingRule()
        .whenCellNotEmpty()
        .setBackground('#ffeecc')
        .build(),
    );
    await s.addTable('SalesTable', s.getRange('L1:M4').getRange(), 'sales-table');
    const image = await s
      .newOverGridImage()
      .setSource(
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
        api.Enum.ImageSourceType.BASE64,
      )
      .setRow(10)
      .setColumn(2)
      .setWidth(30)
      .setHeight(30)
      .buildAsync();
    s.insertImages([image]);
  });
  const snapshot = await page.evaluate(() => window.__tnt!.runtime.snapshot());
  expect(snapshot.resources?.some((r) => r.data.includes('核对客户名称'))).toBe(true);
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '保存工作簿', exact: true }).click();
  expect((await downloadEvent).suggestedFilename()).toMatch(/\.univer\.json$/);
  await expect(page.locator('.save-status')).toContainText('已保存');
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!window.__tnt)).toBe(true);
  expect(
    await page.evaluate(() => !!window.__tnt!.runtime.getSheet().getRange('J2').getDataValidation()),
  ).toBe(true);
  expect(await page.evaluate(() => !!window.__tnt!.runtime.getSheet().getRange('B2').getComment())).toBe(
    true,
  );
  expect(await page.evaluate(() => !!window.__tnt!.runtime.getSheet().getFilter())).toBe(true);
  expect(await page.evaluate(() => window.__tnt!.runtime.getSheet().getRange('B3').getNote()?.note)).toBe(
    '本地注释',
  );
  expect(
    await page.evaluate(
      () => window.__tnt!.runtime.getSheet().getRange('E2').getConditionalFormattingRules().length,
    ),
  ).toBe(1);
  expect(await page.evaluate(() => window.__tnt!.runtime.getSheet().getImages().length)).toBe(1);
  expect(await page.evaluate(() => !!window.__tnt!.runtime.workbook.getTableInfo('sales-table'))).toBe(true);
});

test('Ask and failed multi-step plans never change the live workbook', async ({ page }) => {
  await ready(page);
  const results = await page.evaluate(async () => {
    const { runtime: rt, engine } = window.__tnt!,
      target = rt.target(),
      before = JSON.stringify(rt.snapshot().sheets);
    const settings = {
      llm: { provider: 'local' as const, endpoint: '', model: '', temperature: 0.2 },
      speechLanguage: 'zh-CN',
      autosave: false,
    };
    const cases = [
      { mode: 'ask' as const, operations: [{ tool: 'clear_range', args: { range: 'A1' } }] },
      {
        mode: 'edit' as const,
        operations: [
          { tool: 'write_range', args: { start: 'A1', values: [['bad']] } },
          { tool: 'sort', args: { range: 'A1:B2', column: 20, descending: true } },
        ],
      },
    ];
    const errors = [];
    for (const c of cases) {
      try {
        await engine.run(
          { text: 'test', mode: c.mode, source: 'text', target },
          settings,
          [],
          '',
          new AbortController().signal,
          () => {},
          [],
          { complete: async () => ({ message: 'test', operations: c.operations, done: true }) },
        );
      } catch (e) {
        errors.push((e as Error).message);
      }
    }
    return { errors, unchanged: before === JSON.stringify(rt.snapshot().sheets) };
  });
  expect(results.unchanged).toBe(true);
  expect(results.errors).toHaveLength(2);
});

test('mobile editor starts with touch plugins', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage(),
    errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await ready(page);
  await expect(page.locator('#univer-editor canvas:visible').first()).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('univer-mobile.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  await context.close();
});

test('native menus expose optional OSS features without a custom ribbon', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: '切换 AI 助手' }).click();
  await page.getByRole('tab', { name: '数据', exact: true }).click();
  await expect(page.getByRole('button', { name: '数据验证', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '数据验证', exact: true }).click();
  await expect(page.getByText('管理数据验证', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: '插入', exact: true }).click();
  await expect(page.getByRole('button', { name: '图片', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '添加评论', exact: true })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('univer-plugins.png'), fullPage: true });
});

test('voice locks the selected range and routes final text through AI', async ({ page }) => {
  await page.addInitScript(`window.SpeechRecognition=class {
    start(){setTimeout(()=>this.onresult?.({results:[{isFinal:false,0:{transcript:'加粗'}}],resultIndex:0}),20)}
    stop(){this.onresult?.({results:[{isFinal:true,0:{transcript:'加粗'}}],resultIndex:0});this.onend?.()}
    abort(){}
  }`);
  await ready(page);
  await page.getByRole('button', { name: '编辑 编辑表格', exact: true }).click();
  await select(page, 'G2:G7');
  const canvas = await page.locator('canvas[id^="univer-sheet-main-canvas"]').boundingBox();
  await page.mouse.move(canvas!.x + 890, canvas!.y + 55);
  await page.mouse.down();
  await expect(page.locator('.voice-overlay')).toContainText('G2:G7');
  await expect(page.locator('.voice-overlay')).toContainText('加粗');
  await page.mouse.up();
  await expect(page.locator('.message-text').last()).toContainText('已完成');
  expect(
    await page.evaluate(() => window.__tnt!.runtime.getSheet().getRange('G7').getCellStyleData()?.bl),
  ).toBe(1);
});

test('stale targets and cancellation cannot overwrite concurrent native edits', async ({ page }) => {
  await ready(page);
  const outcome = await page.evaluate(async () => {
    const { runtime: rt, engine } = window.__tnt!,
      settings = {
        llm: { provider: 'local' as const, endpoint: '', model: '', temperature: 0.2 },
        speechLanguage: 'zh-CN',
        autosave: false,
      };
    const signal = new AbortController(),
      intent = { text: 'test', mode: 'edit' as const, source: 'text' as const, target: rt.target() };
    const pending = engine
      .run(intent, settings, [], '', signal.signal, () => {}, [], {
        complete: async () => {
          rt.getSheet().getRange('K2').setValue('new edit');
          return {
            message: 'done',
            operations: [{ tool: 'write_range', args: { start: 'K2', values: [['stale']] } }],
            done: true,
          };
        },
      })
      .catch((e) => e.message);
    const conflict = await pending;
    const canceled = await engine
      .run({ ...intent, target: rt.target() }, settings, [], '', signal.signal, () => {}, [], {
        complete: async () => {
          signal.abort();
          return {
            message: 'done',
            operations: [{ tool: 'clear_range', args: { range: 'K2' } }],
            done: true,
          };
        },
      })
      .catch((e) => e.name);
    return { conflict, canceled, value: rt.getSheet().getRange('K2').getRawValue() };
  });
  expect(outcome.conflict).toContain('工作簿内容发生变化');
  expect(outcome.canceled).toBe('AbortError');
  expect(outcome.value).toBe('new edit');
});
