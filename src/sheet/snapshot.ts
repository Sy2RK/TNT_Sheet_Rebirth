import { LocaleType, type IWorkbookData, type IWorksheetData, type ICellData } from '@univerjs/core';
import { z } from 'zod';

const schema = z.looseObject({
  id: z.string().min(1),
  name: z.string(),
  appVersion: z.string(),
  locale: z.string(),
  sheetOrder: z.array(z.string()).min(1),
  styles: z.record(z.string(), z.unknown()),
  sheets: z.record(
    z.string(),
    z.looseObject({
      id: z.string().optional(),
      name: z.string().min(1),
      rowCount: z.number().int().positive().max(1048576).optional(),
      columnCount: z.number().int().positive().max(16384).optional(),
      cellData: z
        .record(z.string().regex(/^\d+$/), z.record(z.string().regex(/^\d+$/), z.looseObject({}).nullable()))
        .optional(),
    }),
  ),
  resources: z.array(z.looseObject({ name: z.string(), data: z.string() })).optional(),
});
/** Validate without stripping Univer fields or plugin resources. */
export function validateSnapshot(input: unknown): IWorkbookData {
  const data = schema.parse(input);
  if (
    new Set(data.sheetOrder).size !== data.sheetOrder.length ||
    data.sheetOrder.some((id) => !data.sheets[id])
  )
    throw new Error('工作簿中的工作表信息有误，无法打开。');
  if (!data.sheetOrder.some((id) => !data.sheets[id].hidden))
    throw new Error('工作簿至少需要一张可见工作表。');
  return data as unknown as IWorkbookData;
}
export function blankWorkbook(name = '未命名工作簿'): IWorkbookData {
  const id = crypto.randomUUID(),
    sheetId = crypto.randomUUID();
  return {
    id,
    name,
    appVersion: '1.0.3',
    locale: LocaleType.ZH_CN,
    styles: {},
    sheetOrder: [sheetId],
    sheets: { [sheetId]: { id: sheetId, name: '工作表 1', rowCount: 1000, columnCount: 26, cellData: {} } },
    resources: [],
  };
}
export function demoWorkbook(): IWorkbookData {
  const w = blankWorkbook('销售经营表'),
    s = w.sheets[w.sheetOrder[0]];
  s.name = '销售明细';
  const rows = [
    [
      '订单编号',
      '客户名称',
      '所属部门',
      '产品系列',
      '销售金额',
      '目标金额',
      '完成率',
      '签约日期',
      '订单状态',
    ],
    ['SO-001', '山海设计', '华东销售部', 'TNT Pro', 42800, 50000, '=E2/F2', '2026-07-03', '已完成'],
    ['SO-002', '蓝鲸科技', '华南销售部', 'TNT Studio', 86500, 80000, '=E3/F3', '2026-07-08', '已完成'],
    ['SO-003', '原野创意', '华北销售部', 'TNT Air', 23600, 30000, '=E4/F4', '2026-07-12', '进行中'],
    ['SO-004', '木白建筑', '华东销售部', 'TNT Pro', 65200, 60000, '=E5/F5', '2026-07-18', '已完成'],
    ['SO-005', '有光文化', '华南销售部', 'TNT Air', 18900, 25000, '=E6/F6', '2026-07-25', '进行中'],
    ['SO-006', '栖云智能', '华北销售部', 'TNT Studio', 128000, 100000, '=E7/F7', '2026-08-02', '已完成'],
  ];
  s.cellData = {};
  rows.forEach((row, r) => {
    s.cellData![r] = {};
    row.forEach((v, c) => {
      const cell: ICellData = typeof v === 'string' && v.startsWith('=') ? { f: v } : { v };
      cell.s =
        r === 0
          ? { bg: { rgb: '#246d52' }, cl: { rgb: '#ffffff' }, bl: 1 }
          : c === 6
            ? { n: { pattern: '0.00%' } }
            : c === 4 || c === 5
              ? { n: { pattern: '¥#,##0.00' } }
              : {};
      s.cellData![r][c] = cell;
    });
  });
  s.columnData = Object.fromEntries(rows[0].map((_, c) => [c, { w: c === 1 || c === 2 ? 160 : 120 }]));
  const noteId = crypto.randomUUID();
  w.sheetOrder.push(noteId);
  w.sheets[noteId] = {
    id: noteId,
    name: '使用说明',
    rowCount: 100,
    columnCount: 12,
    columnData: { 0: { w: 640 } },
    cellData: {
      0: { 0: { v: '使用菜单和工具栏编辑表格。' } },
      1: { 0: { v: '选择数据后，可在 AI 助手中输入问题或操作，也可以按住麦克风说话。' } },
      2: { 0: { v: '使用“保存工作簿”保留完整内容；导出为 XLSX 时，部分功能可能无法保留。' } },
    },
  } satisfies Partial<IWorksheetData>;
  return w;
}
