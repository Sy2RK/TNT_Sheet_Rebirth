import { z } from 'zod';
import { area, parseRange } from '../sheet/address';
import { MAX_COLS, type Operation } from '../types';
const range = z.string().max(30).describe('A1 notation, e.g. B2:B20');
const sheet = z.string().max(100).optional().describe('sheet id or name; defaults to locked sheet');
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const style = z
  .object({
    fontFamily: z.string().max(100).optional(),
    fontSize: z.number().min(8).max(72).optional(),
    bold: z.boolean().optional(),
    italic: z.boolean().optional(),
    color: color.optional(),
    background: color.optional(),
    align: z.enum(['left', 'center', 'right']).optional(),
    verticalAlign: z.enum(['top', 'middle', 'bottom']).optional(),
    wrap: z.boolean().optional(),
    numberFormat: z.string().max(100).optional(),
    border: z.enum(['none', 'all', 'bottom']).optional(),
  })
  .strict();
const value = z.union([z.string().max(32767), z.number().finite(), z.boolean(), z.null()]);
const scope = { sheet, range };
export const schemas = {
  read_range: z.object({ ...scope }).strict(),
  write_range: z
    .object({ sheet, start: range, values: z.array(z.array(value).max(MAX_COLS)).max(1000) })
    .strict(),
  clear_range: z.object({ ...scope }).strict(),
  set_formula: z.object({ sheet, cell: range, formula: z.string().startsWith('=').max(8192) }).strict(),
  set_format: z.object({ ...scope, style }).strict(),
  sort: z
    .object({
      ...scope,
      column: z
        .number()
        .int()
        .min(0)
        .max(MAX_COLS - 1),
      descending: z.boolean(),
      hasHeader: z.boolean().optional(),
    })
    .strict(),
  filter: z
    .object({
      ...scope,
      column: z
        .number()
        .int()
        .min(0)
        .max(MAX_COLS - 1),
      query: z.string().max(500),
    })
    .strict(),
  clear_filter: z.object({ sheet }).strict(),
  insert_rows: z
    .object({ sheet, index: z.number().int().min(0), count: z.number().int().min(1).max(100) })
    .strict(),
  delete_rows: z
    .object({ sheet, index: z.number().int().min(0), count: z.number().int().min(1).max(100) })
    .strict(),
  insert_columns: z
    .object({ sheet, index: z.number().int().min(0), count: z.number().int().min(1).max(100) })
    .strict(),
  delete_columns: z
    .object({ sheet, index: z.number().int().min(0), count: z.number().int().min(1).max(100) })
    .strict(),
  create_sheet: z.object({ name: z.string().min(1).max(31) }).strict(),
  rename_sheet: z.object({ sheet, name: z.string().min(1).max(31) }).strict(),
  delete_sheet: z.object({ sheet }).strict(),
  merge_cells: z.object({ ...scope, unmerge: z.boolean().optional() }).strict(),
  resize: z
    .object({
      sheet,
      axis: z.enum(['row', 'column']),
      index: z.number().int().min(0),
      size: z.number().min(20).max(1000),
    })
    .strict(),
  highlight: z
    .object({ ...scope, operator: z.enum(['gt', 'lt', 'eq']), threshold: z.number().finite(), style })
    .strict(),
  clean_data: z
    .object({ ...scope, trim: z.boolean().optional(), normalizeNumbers: z.boolean().optional() })
    .strict(),
  summarize: z
    .object({
      ...scope,
      groupColumn: z.number().int().min(0),
      valueColumn: z.number().int().min(0),
      newSheetName: z.string().max(31),
      hasHeader: z.boolean().optional(),
    })
    .strict(),
  undo: z.object({}).strict(),
  redo: z.object({}).strict(),
};
export type ToolName = keyof typeof schemas;
export const toolLabels: Record<ToolName, string> = {
  read_range: '读取选区',
  write_range: '写入数据',
  clear_range: '清空选区',
  set_formula: '设置公式',
  set_format: '调整格式',
  sort: '排序数据',
  filter: '筛选数据',
  clear_filter: '取消筛选',
  insert_rows: '插入行',
  delete_rows: '删除行',
  insert_columns: '插入列',
  delete_columns: '删除列',
  create_sheet: '创建工作表',
  rename_sheet: '重命名工作表',
  delete_sheet: '删除工作表',
  merge_cells: '合并单元格',
  resize: '调整行列尺寸',
  highlight: '标记符合条件的数据',
  clean_data: '清洗数据',
  summarize: '分组汇总至新表',
  undo: '撤销上一步',
  redo: '重做上一步',
};
export const toolCatalog = Object.entries(schemas).map(([name, schema]) => ({
  name,
  description: toolLabels[name as ToolName],
  parameters: z.toJSONSchema(schema),
}));
export function validateOperation(op: Operation): Operation {
  const schema = schemas[op.tool as ToolName];
  if (!schema) throw new Error('当前指令包含无法识别的操作，工作簿未修改。');
  return { tool: op.tool, args: schema.parse(op.args) as Record<string, unknown> };
}
export const isReadOnly = (tool: string) => tool === 'read_range';
export function operationRisk(op: Operation): string | null {
  const a = op.args;
  if (op.tool === 'delete_sheet') return '删除整张工作表';
  if (op.tool === 'clear_range' && area(parseRange(a.range as string)) > 200)
    return '将清空 200 个以上的单元格';
  if (op.tool === 'write_range' && (a.values as unknown[][]).reduce((n, r) => n + r.length, 0) > 500)
    return '将写入 500 个以上的单元格';
  if (op.tool.startsWith('delete_')) return '删除行或列及其中的内容';
  if (op.tool.startsWith('insert_') && Number(a.count) > 20) return '将批量插入行或列';
  if (op.tool === 'merge_cells' && !a.unmerge) return '合并单元格会保留左上角内容，其他单元格内容将被清除';
  return null;
}
