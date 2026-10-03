import {
  CommandType,
  ICommandService,
  IUndoRedoService,
  type IWorkbookData,
  type IRange,
} from '@univerjs/core';
import type { FWorksheet } from '@univerjs/sheets/facade';
import { SetWorksheetActiveOperation } from '@univerjs/sheets';
import type { Range, Target } from '../types';
import { createEditor } from './plugins';

export const toRange = (r: IRange): Range => ({
  r1: r.startRow,
  c1: r.startColumn,
  r2: r.endRow,
  c2: r.endColumn,
});
export class SheetRuntime {
  readonly editor;
  revision = 0;
  private listeners = new Set<() => void>();
  private subscription;
  constructor(container: HTMLElement, snapshot: IWorkbookData, mobile = false) {
    this.editor = createEditor(container, snapshot, mobile);
    this.subscription = this.editor.univer
      .__getInjector()
      .get(ICommandService)
      .onCommandExecuted((info) => {
        // Calculation cache updates are not independent user edits.
        if (info.type === CommandType.MUTATION) {
          if (!/formula.*(result|calculation)|set-formula-calculation/i.test(info.id)) this.revision++;
          this.listeners.forEach((fn) => fn());
        }
      });
  }
  get api() {
    return this.editor.api;
  }
  get workbook() {
    const w = this.api.getActiveWorkbook();
    if (!w) throw new Error('请先打开工作簿。');
    return w;
  }
  get history() {
    return this.editor.univer.__getInjector().get(IUndoRedoService);
  }
  getSheet(id?: string): FWorksheet {
    const w = this.workbook,
      s = id ? w.getSheetBySheetId(id) || w.getSheetByName(id) : w.getActiveSheet();
    if (!s) throw new Error('找不到指定的工作表。');
    return s;
  }
  target(): Target {
    const s = this.getSheet(),
      selection = s.getSelection();
    const ranges = selection?.getActiveRangeList().map((r) => toRange(r.getRange())) || [];
    const range = toRange(
      selection?.getActiveRange()?.getRange() || { startRow: 0, startColumn: 0, endRow: 0, endColumn: 0 },
    );
    const cell = selection?.getCurrentCell();
    return {
      workbookId: this.workbook.getId(),
      sheetId: s.getSheetId(),
      range,
      ranges: ranges.length ? ranges : [range],
      activeCell: { row: cell?.actualRow ?? range.r1, col: cell?.actualColumn ?? range.c1 },
      revision: this.revision,
    };
  }
  assertCurrent(target: Target) {
    if (target.workbookId !== this.workbook.getId() || target.revision !== this.revision)
      throw new Error('处理期间工作簿内容发生变化，本次修改已取消。请确认内容后重新提交指令。');
  }
  snapshot() {
    return this.workbook.save();
  }
  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
  replace(snapshot: IWorkbookData) {
    this.api.disposeUnit(this.workbook.getId());
    this.api.createWorkbook(snapshot);
    this.revision++;
    this.listeners.forEach((fn) => fn());
  }
  async transaction(work: () => Promise<void>) {
    const id = this.workbook.getId(),
      originalSheet = this.getSheet().getSheetId(),
      before = this.history.pitchTopUndoElement();
    const group = this.history.beginUndoRedoGroup(id, crypto.randomUUID(), 'append');
    const recordSheetActivation = () => {
      const item = this.history.pitchTopUndoElement(),
        activeSheet = this.getSheet().getSheetId();
      if (
        item &&
        item !== before &&
        activeSheet !== originalSheet &&
        this.workbook.getSheetBySheetId(originalSheet)
      ) {
        // Restore a live sheet before undo removes the newly active sheet. Otherwise
        // Univer can lose its render skeleton and interrupt later value mutations.
        item.undoMutations.unshift({
          id: SetWorksheetActiveOperation.id,
          params: { unitId: id, subUnitId: originalSheet },
        });
        item.redoMutations.push({
          id: SetWorksheetActiveOperation.id,
          params: { unitId: id, subUnitId: activeSheet },
        });
      }
    };
    try {
      await work();
      recordSheetActivation();
    } catch (error) {
      group.dispose();
      recordSheetActivation();
      if (this.history.pitchTopUndoElement() !== before) await this.api.undo();
      throw error;
    } finally {
      group.dispose();
    }
  }
  dispose() {
    this.subscription.dispose();
    this.listeners.clear();
    this.editor.univer.dispose();
  }
}
