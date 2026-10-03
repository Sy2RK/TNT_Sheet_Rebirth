import { MAX_COLS, MAX_ROWS, MAX_EDIT_CELLS, type Range } from '../types';
export const key = (row: number, col: number) => `${row},${col}`;
export function columnName(col: number): string {
  let name = '';
  for (let n = col + 1; n > 0; n = Math.floor((n - 1) / 26))
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
}
export const address = (row: number, col: number) => `${columnName(col)}${row + 1}`;
export function normalize(r: Range): Range {
  return {
    r1: Math.min(r.r1, r.r2),
    c1: Math.min(r.c1, r.c2),
    r2: Math.max(r.r1, r.r2),
    c2: Math.max(r.c1, r.c2),
  };
}
export const rangeName = (range: Range) => {
  const r = normalize(range);
  const start = address(r.r1, r.c1);
  const end = address(r.r2, r.c2);
  return start === end ? start : `${start}:${end}`;
};
export function parseRange(input: string): Range {
  const parts = input.trim().toUpperCase().replace(/\$/g, '').split(':');
  if (!parts.length || parts.length > 2) throw new Error('请输入有效选区，例如 B2:D20。');
  const parse = (s: string) => {
    const match = /^([A-Z]{1,3})([1-9]\d*)$/.exec(s);
    if (!match) throw new Error('请输入有效单元格地址，例如 A1。');
    const col = [...match[1]].reduce((v, c) => v * 26 + c.charCodeAt(0) - 64, 0) - 1;
    return { row: Number(match[2]) - 1, col };
  };
  const a = parse(parts[0]);
  const b = parse(parts[1] || parts[0]);
  const r = normalize({ r1: a.row, c1: a.col, r2: b.row, c2: b.col });
  validateRange(r);
  return r;
}
export function validateRange(r: Range, limit = MAX_EDIT_CELLS) {
  if (
    !Object.values(r).every(Number.isInteger) ||
    r.r1 < 0 ||
    r.c1 < 0 ||
    r.r2 < r.r1 ||
    r.c2 < r.c1 ||
    r.r2 >= MAX_ROWS ||
    r.c2 >= MAX_COLS
  )
    throw new Error(`当前选区超出支持范围（最多 ${MAX_ROWS} 行、${MAX_COLS} 列）。`);
  if (area(r) > limit) throw new Error(`单次操作最多处理 ${limit.toLocaleString()} 个单元格，请缩小选区。`);
}
export const area = (r: Range) => (r.r2 - r.r1 + 1) * (r.c2 - r.c1 + 1);
export const contains = (r: Range, row: number, col: number) =>
  row >= r.r1 && row <= r.r2 && col >= r.c1 && col <= r.c2;
export const overlaps = (a: Range, b: Range) => a.r1 <= b.r2 && a.r2 >= b.r1 && a.c1 <= b.c2 && a.c2 >= b.c1;
export function eachCell(r: Range, fn: (row: number, col: number) => void) {
  validateRange(r);
  for (let row = r.r1; row <= r.r2; row++) for (let col = r.c1; col <= r.c2; col++) fn(row, col);
}
