// ExcelJS is a file-format adapter only. Univer owns all editing, formulas and history.
import ExcelJS from 'exceljs';
import {
  DateSystem,
  BorderStyleTypes,
  HorizontalAlign,
  VerticalAlign,
  WrapStrategy,
  type ICellData,
  type IStyleData,
  type IWorkbookData,
} from '@univerjs/core';
import { blankWorkbook } from '../sheet/snapshot';
import { parseRange, rangeName } from '../sheet/address';

const colors = [
  'FFFFFF',
  '000000',
  'EEECE1',
  '1F497D',
  '4F81BD',
  'C0504D',
  '9BBB59',
  '8064A2',
  '4BACC6',
  'F79646',
  '0000FF',
  '800080',
];
function rgb(color: Partial<ExcelJS.Color> | undefined) {
  if (!color) return undefined;
  const base = color.argb?.slice(-6) ?? (color.theme !== undefined ? colors[color.theme] : undefined);
  if (!base) return undefined;
  const tint = (color as Partial<ExcelJS.Color> & { tint?: number }).tint || 0;
  return (
    '#' +
    base
      .match(/../g)!
      .map((v) => {
        const n = parseInt(v, 16);
        return Math.round(tint < 0 ? n * (1 + tint) : n + (255 - n) * tint)
          .toString(16)
          .padStart(2, '0');
      })
      .join('')
  );
}
const borderMap: Record<string, BorderStyleTypes> = {
  thin: BorderStyleTypes.THIN,
  medium: BorderStyleTypes.MEDIUM,
  thick: BorderStyleTypes.THICK,
  dashed: BorderStyleTypes.DASHED,
  dotted: BorderStyleTypes.DOTTED,
  double: BorderStyleTypes.DOUBLE,
  hair: BorderStyleTypes.HAIR,
};
function fromStyle(c: ExcelJS.Cell): IStyleData {
  const f = c.font || {},
    a = c.alignment || {},
    bg = c.fill?.type === 'pattern' ? rgb(c.fill.fgColor) : undefined;
  const style: IStyleData = {
    ff: f.name,
    fs: f.size,
    bl: f.bold ? 1 : 0,
    it: f.italic ? 1 : 0,
    cl: rgb(f.color) ? { rgb: rgb(f.color)! } : undefined,
    bg: bg ? { rgb: bg } : undefined,
    ht:
      a.horizontal === 'center'
        ? HorizontalAlign.CENTER
        : a.horizontal === 'right'
          ? HorizontalAlign.RIGHT
          : HorizontalAlign.LEFT,
    vt:
      a.vertical === 'top'
        ? VerticalAlign.TOP
        : a.vertical === 'bottom'
          ? VerticalAlign.BOTTOM
          : VerticalAlign.MIDDLE,
    tb: a.wrapText ? WrapStrategy.WRAP : WrapStrategy.OVERFLOW,
    n: c.numFmt ? { pattern: c.numFmt } : undefined,
  };
  if (f.underline) style.ul = { s: 1 };
  if (f.strike) style.st = { s: 1 };
  for (const [key, side] of [
    ['t', 'top'],
    ['b', 'bottom'],
    ['l', 'left'],
    ['r', 'right'],
  ] as const) {
    const b = c.border?.[side];
    if (b?.style) {
      style.bd ??= {};
      style.bd[key] = {
        s: borderMap[b.style] || BorderStyleTypes.THIN,
        cl: { rgb: rgb(b.color) || '#000000' },
      };
    }
  }
  return style;
}
export async function importXlsx(buffer: ArrayBuffer, name: string): Promise<IWorkbookData> {
  const excel = new ExcelJS.Workbook();
  await excel.xlsx.load(buffer as never);
  const w = blankWorkbook(name.replace(/\.xlsx$/i, ''));
  w.sheetOrder = [];
  w.sheets = {};
  w.dateSystem = excel.properties.date1904 ? DateSystem.Date1904 : DateSystem.Date1900;
  excel.worksheets.forEach((ws) => {
    const id = crypto.randomUUID(),
      cellData: Record<number, Record<number, ICellData>> = {};
    if (ws.rowCount > 1048576 || ws.columnCount > 16384)
      throw new Error('工作簿的行数或列数超出支持范围，无法导入。');
    const rowData: Record<number, { h?: number; hd?: 0 | 1 }> = {},
      columnData: Record<number, { w?: number; hd?: 0 | 1 }> = {};
    let lastColumn = ws.columnCount;
    // This public sparse row list includes rows whose only cells are styled blanks.
    ws.getSheetValues().forEach((_, r) => {
      const row = ws.getRow(r);
      if (row.height || row.hidden)
        rowData[r - 1] = { h: row.height ? (row.height * 4) / 3 : undefined, hd: row.hidden ? 1 : 0 };
      row.eachCell({ includeEmpty: true }, (c, col) => {
        if (c.value == null && !Object.keys(c.style).length) return;
        if (c.isMerged && c.master.address !== c.address) return;
        lastColumn = Math.max(lastColumn, col);
        const cell: ICellData = { s: fromStyle(c) },
          v = c.value;
        if (c.formula) {
          cell.f = '=' + c.formula;
          const result = c.result;
          cell.v = typeof result === 'object' ? null : (result ?? null);
        } else if (v instanceof Date) {
          cell.v = v.getTime() / 86400000 + (excel.properties.date1904 ? 24107 : 25569);
          if (!(cell.s as IStyleData).n) (cell.s as IStyleData).n = { pattern: 'yyyy-mm-dd' };
        } else if (v && typeof v === 'object') {
          if ('richText' in v) cell.v = v.richText.map((t) => t.text).join('');
          else if ('text' in v) cell.v = v.text;
          else if ('error' in v) cell.v = v.error;
        } else cell.v = v ?? null;
        cellData[r - 1] ??= {};
        cellData[r - 1][col - 1] = cell;
      });
    });
    (ws.columns || []).forEach((c, i) => {
      if (c.isCustomWidth || c.hidden)
        columnData[i] = {
          w: c.isCustomWidth && c.width !== undefined ? c.width * 7 + 5 : undefined,
          hd: c.hidden ? 1 : 0,
        };
    });
    const view = (ws.views || []).find((v) => v.state === 'frozen') as
      Partial<ExcelJS.WorksheetViewFrozen> | undefined;
    w.sheetOrder.push(id);
    w.sheets[id] = {
      id,
      name: ws.name,
      rowCount: Math.max(1000, ws.rowCount + 50),
      columnCount: Math.max(26, lastColumn + 5),
      defaultRowHeight: (ws.properties.defaultRowHeight * 4) / 3,
      defaultColumnWidth: (ws.properties.defaultColWidth ?? 8.43) * 7 + 5,
      cellData,
      rowData,
      columnData,
      hidden: ws.state === 'veryHidden' ? 2 : ws.state === 'hidden' ? 1 : 0,
      freeze: view
        ? {
            startRow: view.ySplit || 0,
            startColumn: view.xSplit || 0,
            ySplit: view.ySplit || 0,
            xSplit: view.xSplit || 0,
          }
        : undefined,
      mergeData: (ws.model.merges || []).map((m) => {
        const r = parseRange(m);
        return { startRow: r.r1, startColumn: r.c1, endRow: r.r2, endColumn: r.c2 };
      }),
    };
  });
  if (!w.sheetOrder.length) throw new Error('文件中没有可打开的工作表。');
  return w;
}
export async function exportXlsx(w: IWorkbookData): Promise<ArrayBuffer> {
  const excel = new ExcelJS.Workbook();
  excel.creator = 'TNT AI Sheet · Univer';
  excel.properties.date1904 = w.dateSystem === DateSystem.Date1904;
  for (const id of w.sheetOrder) {
    const s = w.sheets[id],
      ws = excel.addWorksheet(s.name || 'Sheet');
    ws.state = s.hidden === 2 ? 'veryHidden' : s.hidden === 1 ? 'hidden' : 'visible';
    if (s.defaultRowHeight) ws.properties.defaultRowHeight = (s.defaultRowHeight * 3) / 4;
    if (s.defaultColumnWidth) ws.properties.defaultColWidth = Math.max(1, (s.defaultColumnWidth - 5) / 7);
    const resolve = (v: IStyleData | string | null | undefined | void) =>
      typeof v === 'string' ? w.styles[v] || {} : v || {};
    for (const [row, cols] of Object.entries(s.cellData || {}))
      for (const [col, data] of Object.entries(cols as Record<string, ICellData>)) {
        if (!data) continue;
        const c = ws.getCell(Number(row) + 1, Number(col) + 1);
        if (data.f)
          c.value = {
            formula: data.f.replace(/^=/, ''),
            result: data.v ?? undefined,
          } as ExcelJS.CellFormulaValue;
        else c.value = data.p?.body?.dataStream?.replace(/\r?\n$/, '') ?? data.v ?? null;
        const st = {
          ...resolve(w.defaultStyle),
          ...resolve(s.defaultStyle),
          ...resolve(s.columnData?.[Number(col)]?.s),
          ...resolve(s.rowData?.[Number(row)]?.s),
          ...resolve(data.s),
        };
        c.font = {
          name: st.ff || 'Arial',
          size: st.fs || 11,
          bold: st.bl === 1,
          italic: st.it === 1,
          underline: st.ul?.s === 1,
          strike: st.st?.s === 1,
          color: st.cl?.rgb ? { argb: 'FF' + st.cl.rgb.replace('#', '') } : undefined,
        };
        if (st.bg?.rgb)
          c.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF' + st.bg.rgb.replace('#', '') },
          };
        c.alignment = {
          horizontal:
            st.ht === HorizontalAlign.CENTER ? 'center' : st.ht === HorizontalAlign.RIGHT ? 'right' : 'left',
          vertical:
            st.vt === VerticalAlign.TOP ? 'top' : st.vt === VerticalAlign.BOTTOM ? 'bottom' : 'middle',
          wrapText: st.tb === WrapStrategy.WRAP,
        };
        if (st.n?.pattern) c.numFmt = st.n.pattern;
        for (const [key, side] of [
          ['t', 'top'],
          ['b', 'bottom'],
          ['l', 'left'],
          ['r', 'right'],
        ] as const) {
          const b = st.bd?.[key];
          if (b)
            c.border = {
              ...c.border,
              [side]: {
                style: Object.entries(borderMap).find(([, v]) => v === b.s)?.[0] || 'thin',
                color: { argb: 'FF' + (b.cl?.rgb || '#000000').replace('#', '') },
              },
            };
        }
      }
    Object.entries(s.rowData || {}).forEach(([r, d]) => {
      if (d.h) ws.getRow(Number(r) + 1).height = (d.h * 3) / 4;
      ws.getRow(Number(r) + 1).hidden = d.hd === 1;
    });
    Object.entries(s.columnData || {}).forEach(([c, d]) => {
      if (d.w) ws.getColumn(Number(c) + 1).width = Math.max(1, (d.w - 5) / 7);
      ws.getColumn(Number(c) + 1).hidden = d.hd === 1;
    });
    for (const r of s.mergeData || [])
      ws.mergeCells(rangeName({ r1: r.startRow, c1: r.startColumn, r2: r.endRow, c2: r.endColumn }));
    if (s.freeze?.xSplit || s.freeze?.ySplit)
      ws.views = [{ state: 'frozen', xSplit: s.freeze.xSplit, ySplit: s.freeze.ySplit }];
  }
  const buffer = await excel.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer).slice().buffer;
}
export { downloadBlob } from './download';
