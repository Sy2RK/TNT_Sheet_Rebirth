import { describe, it, expect } from 'vitest';
import { blankWorkbook, demoWorkbook, validateSnapshot } from '../src/sheet/snapshot';
import { exportXlsx, importXlsx } from '../src/platform/xlsx';
import ExcelJS from 'exceljs';
import { DateSystem } from '@univerjs/core';

describe('native persistence and OSS Excel exchange', () => {
  it('retains opaque plugin resources, rich text, metadata and future fields', () => {
    const w = demoWorkbook();
    w.resources = [{ name: 'conditionalFormatting', data: '{"rules":[1,2,3]}' }];
    w.sheets[w.sheetOrder[0]].custom = { original: true };
    const input = { ...w, futureFeature: { enabled: true } };
    expect(validateSnapshot(JSON.parse(JSON.stringify(input)))).toEqual(input);
  });
  it('rejects corrupt and empty sheet indexes', () => {
    const w = blankWorkbook();
    expect(() => validateSnapshot({ ...w, sheetOrder: [] })).toThrow();
    expect(() => validateSnapshot({ ...w, sheetOrder: ['missing'] })).toThrow();
    expect(() => validateSnapshot({ ...w, sheetOrder: [...w.sheetOrder, ...w.sheetOrder] })).toThrow();
  });
  it('round trips multiple sheets, formulas, styles, borders, merges and dimensions', async () => {
    const w = demoWorkbook(),
      s = w.sheets[w.sheetOrder[0]];
    s.mergeData = [{ startRow: 9, startColumn: 0, endRow: 9, endColumn: 1 }];
    s.cellData![9] = {
      0: {
        v: 'Merged',
        s: { bl: 1, it: 1, bg: { rgb: '#abcdef' }, bd: { b: { s: 1, cl: { rgb: '#112233' } } } },
      },
    };
    s.rowData = { 9: { h: 40 } };
    const bytes = await exportXlsx(w),
      read = await importXlsx(bytes, 'roundtrip.xlsx'),
      rs = read.sheets[read.sheetOrder[0]];
    expect(read.sheetOrder).toHaveLength(2);
    expect(rs.cellData?.[1][6]?.f).toBe('=E2/F2');
    expect(rs.cellData?.[1][4]?.v).toBe(42800);
    expect(rs.mergeData).toEqual(s.mergeData);
    expect(rs.rowData?.[9].h).toBeCloseTo(40);
    expect(rs.cellData?.[9][0]?.s).toMatchObject({ bl: 1, it: 1, bg: { rgb: '#abcdef' } });
    const excel = new ExcelJS.Workbook();
    await excel.xlsx.load(bytes as never);
    expect(excel.worksheets[0].getCell('G2').numFmt).toBe('0.00%');
  });
  it('preserves the 1904 date system and date display', async () => {
    const excel = new ExcelJS.Workbook();
    excel.properties.date1904 = true;
    const s = excel.addWorksheet('Dates');
    s.getCell('A1').value = new Date('2026-01-02T00:00:00Z');
    s.getCell('A1').numFmt = 'yyyy-mm-dd';
    const bytes = new Uint8Array((await excel.xlsx.writeBuffer()) as ArrayBuffer).buffer;
    const w = await importXlsx(bytes, 'Dates.xlsx');
    expect(w.dateSystem).toBe(DateSystem.Date1904);
    const out = new ExcelJS.Workbook();
    await out.xlsx.load((await exportXlsx(w)) as never);
    expect(out.worksheets[0].getCell('A1').value).toEqual(new Date('2026-01-02T00:00:00Z'));
  });
  it('retains formatted empty template cells and does not materialize empty gaps', async () => {
    const excel = new ExcelJS.Workbook(),
      sheet = excel.addWorksheet('Template');
    sheet.getCell('A1').value = 'Ratio';
    sheet.getCell('A2').numFmt = '0.00%';
    sheet.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
    sheet.getCell('AF10').numFmt = '#,##0.00';
    sheet.getRow(10).height = 30;
    const w = await importXlsx(
        new Uint8Array((await excel.xlsx.writeBuffer()) as ArrayBuffer).buffer,
        'template.xlsx',
      ),
      s = w.sheets[w.sheetOrder[0]];
    expect(s.cellData?.[1]?.[0]).toMatchObject({
      v: null,
      s: { n: { pattern: '0.00%' }, bg: { rgb: '#ff0000' } },
    });
    expect(s.cellData?.[9]?.[31]?.s).toMatchObject({ n: { pattern: '#,##0.00' } });
    expect(s.columnCount).toBeGreaterThan(31);
    expect(Object.keys(s.cellData!)).toHaveLength(3);
    const out = new ExcelJS.Workbook();
    await out.xlsx.load((await exportXlsx(w)) as never);
    expect(out.worksheets[0].getCell('A2').numFmt).toBe('0.00%');
    expect(out.worksheets[0].getCell('A2').fill).toMatchObject({ fgColor: { argb: 'FFff0000' } });
    expect(out.worksheets[0].getRow(10).height).toBe(30);
  });
  it('round trips worksheet default dimensions and explicit overrides', async () => {
    const excel = new ExcelJS.Workbook(),
      sheet = excel.addWorksheet('Dimensions');
    sheet.properties.defaultRowHeight = 30;
    sheet.properties.defaultColWidth = 20;
    sheet.getCell('A1').value = 'Default size';
    sheet.getRow(3).height = 45;
    sheet.getColumn(2).width = 25;
    const w = await importXlsx(
        new Uint8Array((await excel.xlsx.writeBuffer()) as ArrayBuffer).buffer,
        'dimensions.xlsx',
      ),
      s = w.sheets[w.sheetOrder[0]];
    expect(s.defaultRowHeight).toBe(40);
    expect(s.defaultColumnWidth).toBe(145);
    expect(s.rowData?.[2]?.h).toBe(60);
    expect(s.columnData?.[1]?.w).toBe(180);
    const out = new ExcelJS.Workbook();
    await out.xlsx.load((await exportXlsx(w)) as never);
    expect(out.worksheets[0].properties.defaultRowHeight).toBe(30);
    expect(out.worksheets[0].properties.defaultColWidth).toBe(20);
    expect(out.worksheets[0].getColumn(2).width).toBe(25);
  });
});
