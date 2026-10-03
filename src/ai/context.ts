import type { SheetRuntime } from '../sheet/runtime';
import type { Skill, Target } from '../types';
import { rangeName } from '../sheet/address';
import { readRange } from './univer-tools';
export function buildContext(rt: SheetRuntime, target: Target, skill?: Skill) {
  const s = rt.getSheet(target.sheetId),
    r = target.range;
  return {
    workbook: {
      name: rt.workbook.getName(),
      sheets: rt.workbook.getSheets().map((s) => ({ id: s.getSheetId(), name: s.getSheetName() })),
    },
    selection: target.ranges.map(rangeName),
    activeCell: target.activeCell,
    sheet: { id: s.getSheetId(), name: s.getSheetName() },
    selected: readRange(rt, target.sheetId, rangeName(r), 200),
    nearby: readRange(
      rt,
      target.sheetId,
      rangeName({
        r1: Math.max(0, r.r1 - 2),
        c1: Math.max(0, r.c1 - 2),
        r2: Math.min(s.getMaxRows() - 1, r.r1 + 10),
        c2: Math.min(s.getMaxColumns() - 1, r.c1 + 6),
      }),
      100,
    ),
    sheetSample: readRange(
      rt,
      target.sheetId,
      `A1:${String.fromCharCode(65 + Math.min(11, s.getMaxColumns() - 1))}${Math.min(15, s.getMaxRows())}`,
      180,
    ),
    skill: skill ? { name: skill.name, instructions: skill.prompt, scope: skill.context } : null,
  };
}
