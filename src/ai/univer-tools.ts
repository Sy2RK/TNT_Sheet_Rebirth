import { BorderStyleTypes, BorderType, type ICellData } from '@univerjs/core';
import type { FRange } from '@univerjs/sheets/facade';
import { address, parseRange, rangeName, validateRange } from '../sheet/address';
import type { CellStyle, Operation, Target } from '../types';
import type { SheetRuntime } from '../sheet/runtime';
import { isReadOnly, validateOperation } from './tools';

export function readRange(rt: SheetRuntime, sheetId: string, notation: string, limit = 1000) {
  const s = rt.getSheet(sheetId),
    r = parseRange(notation),
    cells = [];
  for (let row = r.r1; row <= r.r2; row++)
    for (let col = r.c1; col <= r.c2; col++) {
      if (cells.length >= limit) return { sheet: s.getSheetName(), range: notation, cells, truncated: true };
      const range = s.getRange(row, col, 1, 1),
        cell = range.getCellData();
      cells.push({
        address: address(row, col),
        value: range.getRawValue() ?? null,
        formula: cell?.f,
        style: range.getCellStyleData(),
      });
    }
  return { sheet: s.getSheetName(), range: notation, cells, truncated: false };
}
export function applyStyle(r: FRange, s: CellStyle) {
  if (s.bold !== undefined) r.setFontWeight(s.bold ? 'bold' : 'normal');
  if (s.italic !== undefined) r.setFontStyle(s.italic ? 'italic' : 'normal');
  if (s.fontFamily) r.setFontFamily(s.fontFamily);
  if (s.fontSize) r.setFontSize(s.fontSize);
  if (s.color) r.setFontColor(s.color);
  if (s.background) r.setBackground(s.background);
  if (s.align) r.setHorizontalAlignment(s.align === 'right' ? 'normal' : s.align);
  if (s.verticalAlign) r.setVerticalAlignment(s.verticalAlign);
  if (s.wrap !== undefined) r.setWrap(s.wrap);
  if (s.numberFormat) r.setNumberFormat(s.numberFormat);
  if (s.border)
    r.setBorder(
      s.border === 'all' ? BorderType.ALL : s.border === 'bottom' ? BorderType.BOTTOM : BorderType.NONE,
      BorderStyleTypes.THIN,
      '#b7c7c0',
    );
}
export async function executeTool(rt: SheetRuntime, target: Target, raw: Operation): Promise<unknown> {
  const op = validateOperation(raw),
    a = op.args,
    s = rt.getSheet((a.sheet as string) || target.sheetId);
  // These operations consume computed values, both in the draft and during commit.
  if (['read_range', 'sort', 'filter', 'highlight', 'summarize'].includes(op.tool))
    await rt.api.getFormula().onCalculationResultApplied(10000);
  if (!isReadOnly(op.tool) && !['undo', 'redo'].includes(op.tool)) {
    if (!rt.workbook.getWorkbookPermission().canEdit()) throw new Error('当前工作簿为只读状态，无法修改。');
    if (!s.getWorksheetPermission().canEdit()) throw new Error('当前工作表已受保护，无法修改。');
    const affected = (a.range || a.start || a.cell) as string | undefined;
    if (affected) {
      const r = parseRange(affected);
      if (op.tool === 'write_range') {
        const rows = a.values as unknown[][];
        r.r2 = r.r1 + Math.max(1, rows.length) - 1;
        r.c2 = r.c1 + Math.max(1, ...rows.map((row) => row.length)) - 1;
        validateRange(r);
      }
      const permission = s.getWorksheetPermission();
      for (let row = r.r1; row <= r.r2; row++)
        for (let col = r.c1; col <= r.c2; col++)
          if (!permission.canEditCell(row, col)) throw new Error('选区中的部分单元格已受保护，无法修改。');
    }
  }
  const range = () => {
    parseRange(a.range as string);
    return s.getRange(a.range as string);
  };
  const bounded = (index: number, count: number, axis: 'row' | 'column', remove = false) => {
    const total = axis === 'row' ? s.getMaxRows() : s.getMaxColumns();
    if (index >= total || (remove && index + count > total) || (remove && count >= total))
      throw new Error('指定的行列范围无效，无法完成操作。');
  };
  switch (op.tool) {
    case 'read_range':
      return readRange(rt, s.getSheetId(), a.range as string);
    case 'write_range': {
      const start = parseRange(a.start as string),
        rows = a.values as (string | number | boolean | null)[][];
      if (!rows.length || !rows.some((r) => r.length)) return '无数据';
      const width = Math.max(...rows.map((r) => r.length));
      validateRange({ ...start, r2: start.r1 + rows.length - 1, c2: start.c1 + width - 1 });
      const values: ICellData[][] = rows.map((row) =>
        Array.from({ length: width }, (_, i) => {
          const v = row[i] ?? null;
          return typeof v === 'string' && v.startsWith('=')
            ? { f: v, v: null, p: null }
            : { v, f: null, p: null };
        }),
      );
      s.getRange(start.r1, start.c1, rows.length, width).setValues(values);
      break;
    }
    case 'set_formula': {
      const r = parseRange(a.cell as string);
      if (r.r1 !== r.r2 || r.c1 !== r.c2) throw new Error('公式只能写入单个单元格。');
      s.getRange(a.cell as string).setValue(a.formula as string);
      break;
    }
    case 'clear_range':
      range().clearContent();
      break;
    case 'set_format':
      applyStyle(range(), a.style as CellStyle);
      break;
    case 'sort': {
      const r = parseRange(a.range as string),
        col = Number(a.column);
      if (col < r.c1 || col > r.c2) throw new Error('排序列必须位于当前选区内。');
      if (a.hasHeader) r.r1++;
      if (r.r1 > r.r2) throw new Error('当前选区中没有可排序的数据。');
      s.getRange(rangeName(r)).sort({ column: col - r.c1, ascending: !a.descending });
      break;
    }
    case 'filter': {
      const r = parseRange(a.range as string),
        col = Number(a.column);
      if (col < r.c1 || col > r.c2) throw new Error('筛选列必须位于当前选区内。');
      s.getFilter()?.remove();
      const filter = range().createFilter();
      if (!filter) throw new Error('无法在当前选区创建筛选。');
      const values = s
        .getRange(r.r1 + 1, col, Math.max(1, r.r2 - r.r1), 1)
        .getDisplayValues()
        .flat()
        .filter((v) => v.includes(String(a.query)));
      filter.setColumnFilterCriteria(col, { colId: col, filters: { filters: [...new Set(values)] } });
      break;
    }
    case 'clear_filter':
      s.getFilter()?.remove();
      break;
    case 'insert_rows':
      bounded(Number(a.index), Number(a.count), 'row');
      s.insertRows(Number(a.index), Number(a.count));
      break;
    case 'delete_rows':
      bounded(Number(a.index), Number(a.count), 'row', true);
      s.deleteRows(Number(a.index), Number(a.count));
      break;
    case 'insert_columns':
      bounded(Number(a.index), Number(a.count), 'column');
      s.insertColumns(Number(a.index), Number(a.count));
      break;
    case 'delete_columns':
      bounded(Number(a.index), Number(a.count), 'column', true);
      s.deleteColumns(Number(a.index), Number(a.count));
      break;
    case 'create_sheet':
      return { sheet: rt.workbook.insertSheet(a.name as string).getSheetName() };
    case 'rename_sheet':
      s.setName(a.name as string);
      break;
    case 'delete_sheet':
      if (rt.workbook.getSheets().length < 2) throw new Error('至少需要保留一张工作表，无法删除最后一张。');
      if (!rt.workbook.deleteSheet(s)) throw new Error('无法删除这张工作表，请重试。');
      break;
    case 'merge_cells':
      if (a.unmerge) range().breakApart();
      else range().merge();
      break;
    case 'resize':
      if (a.axis === 'row') s.setRowHeight(Number(a.index), Number(a.size));
      else s.setColumnWidth(Number(a.index), Number(a.size));
      break;
    case 'highlight': {
      const r = parseRange(a.range as string),
        values = range().getRawValues();
      values.forEach((row, i) =>
        row.forEach((v, j) => {
          if (
            typeof v === 'number' &&
            (a.operator === 'gt'
              ? v > Number(a.threshold)
              : a.operator === 'lt'
                ? v < Number(a.threshold)
                : v === a.threshold)
          )
            applyStyle(s.getRange(r.r1 + i, r.c1 + j, 1, 1), a.style as CellStyle);
        }),
      );
      break;
    }
    case 'clean_data': {
      const r = parseRange(a.range as string),
        grid = range().getCellDataGrid();
      grid.forEach((row, i) =>
        row.forEach((c, j) => {
          if (!c || c.f || c.p || typeof c.v !== 'string') return;
          let v: string | number = c.v;
          if (a.trim) v = v.trim().replace(/[\s\u3000]+/g, ' ');
          if (a.normalizeNumbers && /^-?(?:0|[1-9]\d{0,2}(?:,\d{3})+|[1-9]\d*)(?:\.\d+)?$/.test(v))
            v = Number(v.replaceAll(',', ''));
          if (v !== c.v) s.getRange(r.r1 + i, r.c1 + j, 1, 1).setValue({ v, f: null, p: null });
        }),
      );
      break;
    }
    case 'summarize': {
      const r = parseRange(a.range as string),
        g = Number(a.groupColumn) - r.c1,
        v = Number(a.valueColumn) - r.c1;
      if (g < 0 || v < 0 || g > r.c2 - r.c1 || v > r.c2 - r.c1)
        throw new Error('用于分组和汇总的列必须位于当前选区内。');
      const totals = new Map<string, number>();
      range()
        .getRawValues()
        .slice(a.hasHeader ? 1 : 0)
        .forEach((row) => {
          if (typeof row[v] === 'number') {
            const key = String(row[g] ?? '（空白）');
            totals.set(key, (totals.get(key) || 0) + Number(row[v]));
          }
        });
      const result = rt.workbook.insertSheet(a.newSheetName as string),
        rows = [['分组', '汇总金额'], ...totals.entries()];
      result.getRange(0, 0, rows.length, 2).setValues(rows);
      applyStyle(result.getRange('A1:B1'), { bold: true, background: '#e8f3ed' });
      result.getRange(1, 1, Math.max(1, totals.size), 1).setNumberFormat('#,##0.00');
      return { sheet: result.getSheetName(), groups: totals.size };
    }
    case 'undo':
      if (!(await rt.api.undo())) throw new Error('没有可撤销的操作。');
      break;
    case 'redo':
      if (!(await rt.api.redo())) throw new Error('没有可重做的操作。');
      break;
    default:
      throw new Error('暂时无法执行这项操作。');
  }
  return { ok: true };
}
