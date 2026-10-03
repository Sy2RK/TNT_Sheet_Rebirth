import type { SheetRuntime } from '../sheet/runtime';
import { toRange } from '../sheet/runtime';
import type { AIResponse, Mode, Operation, Target } from '../types';
import { address, rangeName, validateRange } from '../sheet/address';
export function localPlan(text: string, rt: SheetRuntime, target: Target, mode: Mode): AIResponse {
  const s = rt.getSheet(target.sheetId),
    r = target.range;
  validateRange(r);
  const range = rangeName(r),
    grid = s.getRange(range).getCellDataGrid(),
    values = s.getRange(range).getRawValues(),
    numbers = values.flat().filter((v): v is number => typeof v === 'number');
  const t = text.toLowerCase(),
    operations: Operation[] = [];
  if (/公式|怎么算|怎么.*计算|formula/.test(t)) {
    const formulas = grid
      .flatMap((row, i) =>
        row.flatMap((c, j) =>
          c?.f
            ? [`${address(r.r1 + i, r.c1 + j)}：公式 ${c.f}；计算结果：${values[i][j] ?? '暂不可用'}`]
            : [],
        ),
      )
      .slice(0, 12);
    return { message: formulas.join('\n') || '当前选区中没有公式。', operations, done: true };
  }
  if (/异常|分析/.test(t)) {
    const used = s.getDataRange(),
      ur = toRange(used.getRange());
    validateRange(ur);
    const vals = used.getRawValues(),
      findings: string[] = [];
    for (let c = 0; c < (vals[0]?.length || 0); c++) {
      const ns = vals
        .slice(1)
        .map((row) => row[c])
        .filter((v): v is number => typeof v === 'number')
        .sort((a, b) => a - b);
      if (ns.length < 4) continue;
      const q1 = ns[Math.floor((ns.length - 1) * 0.25)],
        q3 = ns[Math.floor((ns.length - 1) * 0.75)],
        iqr = q3 - q1;
      vals.forEach((row, i) => {
        const v = row[c];
        if (typeof v === 'number' && iqr > 0 && (v < q1 - 1.5 * iqr || v > q3 + 1.5 * iqr))
          findings.push(`${address(ur.r1 + i, ur.c1 + c)}：数值 ${v}，明显偏离该列其他数据`);
      });
    }
    return {
      message: `已检查“${s.getSheetName()}”。\n${findings.slice(0, 20).join('\n') || '未发现明显异常数值。'}\n本次根据数值分布识别明显偏离项，结果供参考。`,
      operations,
      done: true,
    };
  }
  if (mode === 'ask')
    return {
      message: `当前选区 ${range} 包含 ${numbers.length} 个数值，合计 ${numbers.reduce((a, b) => a + b, 0)}，平均值 ${numbers.length ? numbers.reduce((a, b) => a + b, 0) / numbers.length : '—'}。问答模式只分析，不会修改表格。`,
      operations,
      done: true,
    };
  if (/^(撤销|撤回|undo)(上一步|刚才的操作)?[。！!]?$/i.test(t.trim()))
    operations.push({ tool: 'undo', args: {} });
  else if (/^(重做|redo)(上一步)?[。！!]?$/i.test(t.trim())) operations.push({ tool: 'redo', args: {} });
  else if (/部门|汇总|\/summary/.test(t)) {
    const wholeSheet = /整表|全表|整个工作表|whole sheet/.test(t),
      selectionOnly = /选区|选中|所选|selection/.test(t),
      singleCell = r.r1 === r.r2 && r.c1 === r.c2,
      ur = wholeSheet || (!selectionOnly && singleCell) ? toRange(s.getDataRange().getRange()) : { ...r };
    validateRange(ur);
    const header = s.getRange(ur.r1, ur.c1, 1, ur.c2 - ur.c1 + 1).getRawValues()[0],
      gc = header.findIndex((v) => /部门|类别|分组/.test(String(v))),
      vc = header.findIndex((v) => /金额|销售额/.test(String(v)));
    if (gc < 0 || vc < 0) throw new Error('选区中需要包含“部门”或“类别”列，以及“金额”或“销售额”列。');
    while (ur.r2 > ur.r1 && /合计|总计/.test(String(s.getRange(ur.r2, ur.c1, 1, 1).getRawValue()))) ur.r2--;
    let name = '部门汇总',
      i = 2;
    while (rt.workbook.getSheetByName(name)) name = `部门汇总 ${i++}`;
    operations.push({
      tool: 'summarize',
      args: {
        range: rangeName(ur),
        groupColumn: ur.c1 + gc,
        valueColumn: ur.c1 + vc,
        newSheetName: name,
        hasHeader: true,
      },
    });
  } else {
    if (/求和|加起来|平均|sum|average/.test(t)) {
      const cell = address(r.r2 + 1, r.c1);
      if (!numbers.length || s.getRange(cell).getRawValue() != null)
        throw new Error('请选择包含数值的区域，并确保区域下方的目标单元格为空。');
      operations.push({
        tool: 'set_formula',
        args: { cell, formula: `=${/平均|average/.test(t) ? 'AVERAGE' : 'SUM'}(${range})` },
      });
    }
    for (const selected of target.ranges) {
      const rn = rangeName(selected);
      if (/百分比|percent/.test(t))
        operations.push({ tool: 'set_format', args: { range: rn, style: { numberFormat: '0.00%' } } });
      if (/货币|人民币/.test(t))
        operations.push({ tool: 'set_format', args: { range: rn, style: { numberFormat: '¥#,##0.00' } } });
      if (/加粗|bold/.test(t))
        operations.push({ tool: 'set_format', args: { range: rn, style: { bold: true } } });
      if (/清洗|清理|\/clean/.test(t))
        operations.push({ tool: 'clean_data', args: { range: rn, trim: true, normalizeNumbers: true } });
      const threshold = /(?:超过|大于|高于|小于|低于)\s*(一万|\d+(?:\.\d+)?)\s*(万|%|％)?/.exec(t);
      if (threshold && /标|高亮|颜色|红/.test(t)) {
        let n = threshold[1] === '一万' ? 10000 : Number(threshold[1]);
        if (threshold[2] === '万') n *= 10000;
        if (['%', '％'].includes(threshold[2])) n /= 100;
        operations.push({
          tool: 'highlight',
          args: {
            range: rn,
            operator: /小于|低于/.test(threshold[0]) ? 'lt' : 'gt',
            threshold: n,
            style: { color: '#be4353', background: '#fff0f0', bold: true },
          },
        });
      }
      if (/排序|从大到小|从小到大|降序|升序/.test(t))
        operations.push({
          tool: 'sort',
          args: {
            range: rn,
            column: selected.c1,
            descending: /从大到小|降序/.test(t),
            hasHeader: sortHasHeader(t, s.getRange(rn).getRawValues()),
          },
        });
    }
  }
  if (!operations.length)
    throw new Error('内置指令暂不支持这项操作。请在设置中连接模型，或尝试排序、设置百分比、清洗和汇总。');
  return { message: '操作已完成。可使用撤销恢复本次修改。', operations, done: true };
}

function sortHasHeader(text: string, values: unknown[][]) {
  if (/无表头|没有表头|不含表头|无标题|没有标题|no headers?/.test(text)) return false;
  if (/有表头|含表头|首行.*(?:表头|标题)|with headers?/.test(text)) return true;
  const first = values[0]?.[0];
  return (
    typeof first === 'string' &&
    (/^(编号|名称|姓名|部门|类别|日期|金额|销售额|数量|name|id|date|amount)$/i.test(first.trim()) ||
      (Number.isNaN(Number(first)) && values.slice(1).some((row) => typeof row[0] === 'number')))
  );
}
