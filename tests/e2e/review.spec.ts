import { test, expect, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/_dev/model-config', (route) => route.fulfill({ json: { providers: {} } }));
  await page.addInitScript(() =>
    localStorage.setItem(
      'tnt-settings',
      JSON.stringify({
        llm: { provider: 'local', endpoint: '', model: '', temperature: 0.2 },
        speechLanguage: 'zh-CN',
        autosave: false,
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

test('formula-dependent tools use fresh results in the draft and commit, with one undo', async ({ page }) => {
  await ready(page);
  const result = await page.evaluate(async () => {
    const { runtime: rt, engine } = window.__tnt!,
      s = rt.getSheet();
    s.getRange('L1:M3').setValues([
      ['Group', 'Amount'],
      ['A', 1],
      ['A', 2],
    ]);
    const settings = {
      llm: { provider: 'local' as const, endpoint: '', model: '', temperature: 0.2 },
      speechLanguage: 'zh-CN',
      autosave: false,
    };
    let round = 0,
      staged = '';
    await engine.run(
      { text: 'test', mode: 'agent', source: 'text', target: rt.target() },
      settings,
      [],
      '',
      new AbortController().signal,
      () => {},
      [],
      {
        complete: async (_system, messages) => {
          if (!round++)
            return {
              message: 'done',
              done: false,
              operations: [
                { tool: 'set_formula', args: { cell: 'M2', formula: '=10*10' } },
                {
                  tool: 'summarize',
                  args: {
                    range: 'L1:M3',
                    groupColumn: 11,
                    valueColumn: 12,
                    newSheetName: '计算汇总',
                    hasHeader: true,
                  },
                },
                { tool: 'read_range', args: { sheet: '计算汇总', range: 'A2:B2' } },
                {
                  tool: 'highlight',
                  args: { range: 'M2', operator: 'gt', threshold: 90, style: { bold: true } },
                },
              ],
            };
          staged = messages.at(-1)!.content;
          return { message: 'done', done: true, operations: [] };
        },
      },
    );
    const committed = rt.workbook.getSheetByName('计算汇总')!.getRange('B2').getRawValue(),
      bold = s.getRange('M2').getCellStyleData()?.bl;
    const undone = await rt.api.undo();
    await rt.api.getFormula().onCalculationResultApplied(10000);
    const restored = s.getRange('M2').getRawValue(),
      removed = !rt.workbook.getSheetByName('计算汇总');
    const redone = await rt.api.redo();
    await rt.api.getFormula().onCalculationResultApplied(10000);
    return {
      staged,
      committed,
      bold,
      restored,
      removed,
      undone,
      redone,
      redoValue: rt.workbook.getSheetByName('计算汇总')!.getRange('B2').getRawValue(),
      redoFormula: s.getRange('M2').getRawValue(),
    };
  });
  expect(result.staged).toContain('102');
  expect(result.committed).toBe(102);
  expect(result.bold).toBe(1);
  expect(result.restored).toBe(1);
  expect(result.removed).toBe(true);
  expect(result.undone).toBe(true);
  expect(result.redone).toBe(true);
  expect(result.redoValue).toBe(102);
  expect(result.redoFormula).toBe(100);
});

test('filters match displayed percentages and preserve native undo', async ({ page }) => {
  await ready(page);
  const result = await page.evaluate(async () => {
    const { runtime: rt, engine } = window.__tnt!,
      s = rt.getSheet();
    s.getRange('L1:L3').setValues([['Rate'], [0.5], [0.75]]);
    s.getRange('L2:L3').setNumberFormat('0%');
    const settings = {
      llm: { provider: 'local' as const, endpoint: '', model: '', temperature: 0.2 },
      speechLanguage: 'zh-CN',
      autosave: false,
    };
    await engine.run(
      { text: 'test', mode: 'edit', source: 'text', target: rt.target() },
      settings,
      [],
      '',
      new AbortController().signal,
      () => {},
      [],
      {
        complete: async () => ({
          message: 'done',
          done: true,
          operations: [{ tool: 'filter', args: { range: 'L1:L3', column: 11, query: '50%' } }],
        }),
      },
    );
    const hidden = s.getFilter()!.getFilteredOutRows();
    await rt.api.undo();
    return { hidden, removed: !s.getFilter() };
  });
  expect(result.hidden).toEqual([2]);
  expect(result.removed).toBe(true);
});

test('local summary respects a selected subset and an explicit whole-sheet request', async ({ page }) => {
  await ready(page);
  const result = await page.evaluate(async () => {
    const { runtime: rt, engine } = window.__tnt!,
      s = rt.getSheet();
    const settings = {
      llm: { provider: 'local' as const, endpoint: '', model: '', temperature: 0.2 },
      speechLanguage: 'zh-CN',
      autosave: false,
    };
    s.setActiveSelection(s.getRange('A1:I2'));
    await engine.run(
      { text: '只汇总当前选区，按部门汇总金额', mode: 'agent', source: 'text', target: rt.target() },
      settings,
      [],
      '',
      new AbortController().signal,
      () => {},
    );
    const subset = rt.workbook.getSheetByName('部门汇总')!.getRange('A1:B2').getRawValues();
    rt.workbook.setActiveSheet(s);
    s.setActiveSelection(s.getRange('A1:I2'));
    await engine.run(
      { text: '按部门汇总全表金额', mode: 'agent', source: 'text', target: rt.target() },
      settings,
      [],
      '',
      new AbortController().signal,
      () => {},
    );
    return { subset, whole: rt.workbook.getSheetByName('部门汇总 2')!.getRange('A1:B4').getRawValues() };
  });
  expect(result.subset).toEqual([
    ['分组', '汇总金额'],
    ['华东销售部', 42800],
  ]);
  expect(result.whole).toEqual([
    ['分组', '汇总金额'],
    ['华东销售部', 108000],
    ['华南销售部', 105400],
    ['华北销售部', 151600],
  ]);
});

test('local text sorting respects explicit headers and includes the first data row', async ({ page }) => {
  await ready(page);
  const result = await page.evaluate(async () => {
    const { runtime: rt, engine } = window.__tnt!,
      s = rt.getSheet();
    const settings = {
        llm: { provider: 'local' as const, endpoint: '', model: '', temperature: 0.2 },
        speechLanguage: 'zh-CN',
        autosave: false,
      },
      outputs = [];
    for (const item of [
      { values: [['A'], ['C'], ['B']], text: '没有表头，从大到小排序' },
      { values: [['A'], ['C'], ['B']], text: '从大到小排序' },
      { values: [['名称'], ['A'], ['C']], text: '有表头，从大到小排序' },
    ]) {
      s.getRange('L20:L22').setValues(item.values);
      s.setActiveSelection(s.getRange('L20:L22'));
      await engine.run(
        { text: item.text, mode: 'edit', source: 'text', target: rt.target() },
        settings,
        [],
        '',
        new AbortController().signal,
        () => {},
      );
      outputs.push(s.getRange('L20:L22').getRawValues().flat());
    }
    return outputs;
  });
  expect(result).toEqual([
    ['C', 'B', 'A'],
    ['C', 'B', 'A'],
    ['名称', 'C', 'A'],
  ]);
});

test('automatic skill hints allow compound commands while explicit skills retain permissions', async ({
  page,
}) => {
  await ready(page);
  const result = await page.evaluate(async () => {
    const path = '/src/ai/skills.ts',
      { builtinSkills } = await import(path);
    const { runtime: rt, engine } = window.__tnt!,
      s = rt.getSheet();
    const settings = {
      llm: { provider: 'local' as const, endpoint: '', model: '', temperature: 0.2 },
      speechLanguage: 'zh-CN',
      autosave: false,
    };
    s.getRange('L20:L22').setValues([[{ v: ' 2 ', t: 1 }], [{ v: '10', t: 1 }], [{ v: ' 1 ', t: 1 }]]);
    s.setActiveSelection(s.getRange('L20:L22'));
    await engine.run(
      { text: '清理当前选区并降序排列，没有表头', mode: 'edit', source: 'text', target: rt.target() },
      settings,
      builtinSkills,
      '',
      new AbortController().signal,
      () => {},
    );
    const combined = s.getRange('L20:L22').getRawValues().flat();
    await rt.api.undo();
    const restored = s.getRange('L20:L22').getRawValues().flat();
    let error = '';
    try {
      await engine.run(
        { text: '/clean 清理并降序排列，没有表头', mode: 'edit', source: 'text', target: rt.target() },
        settings,
        builtinSkills,
        '',
        new AbortController().signal,
        () => {},
      );
    } catch (e) {
      error = (e as Error).message;
    }
    return {
      combined,
      restored,
      error,
      unchanged: JSON.stringify(restored) === JSON.stringify(s.getRange('L20:L22').getRawValues().flat()),
    };
  });
  expect(result.combined).toEqual([10, 2, 1]);
  expect(result.restored).toEqual([' 2 ', '10', ' 1 ']);
  expect(result.error).toContain('当前技能未启用');
  expect(result.unchanged).toBe(true);
});

for (const surface of ['.ai-panel', '.app-footer']) {
  test(`${surface} pointer cancellation never submits confirmed speech`, async ({ page }) => {
    await page.addInitScript(`window.SpeechRecognition=class {
    start(){this.lateEnd=this.onend;setTimeout(()=>{this.onstart?.();this.onresult?.({results:[{isFinal:true,0:{transcript:'加粗'}}],resultIndex:0})},20)}
    stop(){this.onend?.()} abort(){setTimeout(()=>this.lateEnd?.(),20)}
  }`);
    await ready(page);
    await page.getByRole('button', { name: '编辑 编辑表格', exact: true }).click();
    await page.evaluate(() => {
      const s = window.__tnt!.runtime.getSheet();
      s.setActiveSelection(s.getRange('G2'));
    });
    const mic = page.locator(surface).getByRole('button', { name: '按住开始语音输入', exact: true }),
      box = await mic.boundingBox();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await expect(page.locator('.voice-overlay')).toContainText('加粗');
    await mic.dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse' });
    await expect(page.locator('.voice-overlay')).toHaveCount(0);
    await page.mouse.up();
    await page.waitForTimeout(150);
    expect(
      await page.evaluate(() => window.__tnt!.runtime.getSheet().getRange('G2').getCellStyleData()?.bl === 1),
    ).toBe(false);
    await expect(page.locator('.message-text')).toHaveCount(0);
  });
}
