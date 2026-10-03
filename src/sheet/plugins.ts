import { Univer, LocaleType, mergeLocales, UniverInstanceType, type IWorkbookData } from '@univerjs/core';
import { FUniver } from '@univerjs/core/facade';
import '@univerjs/design/lib/index.css';
import DesignLocale from '@univerjs/design/locale/zh-CN';
import { UniverRenderEnginePlugin } from '@univerjs/engine-render';
import { UniverFormulaEnginePlugin } from '@univerjs/engine-formula';
import L1 from '@univerjs/engine-formula/locale/zh-CN';
import '@univerjs/engine-formula/facade';
import { UniverUIPlugin, UniverMobileUIPlugin } from '@univerjs/ui';
import L2 from '@univerjs/ui/locale/zh-CN';
import '@univerjs/ui/lib/index.css';
import '@univerjs/ui/facade';
import { UniverDocsPlugin } from '@univerjs/docs';
import '@univerjs/docs/facade';
import { UniverDocsUIPlugin } from '@univerjs/docs-ui';
import L4 from '@univerjs/docs-ui/locale/zh-CN';
import '@univerjs/docs-ui/lib/index.css';
import '@univerjs/docs-ui/facade';
import { UniverSheetsPlugin } from '@univerjs/sheets';
import L5 from '@univerjs/sheets/locale/zh-CN';
import '@univerjs/sheets/facade';
import { UniverSheetsUIPlugin, UniverSheetsMobileUIPlugin } from '@univerjs/sheets-ui';
import L6 from '@univerjs/sheets-ui/locale/zh-CN';
import '@univerjs/sheets-ui/lib/index.css';
import '@univerjs/sheets-ui/facade';
import { UniverSheetsFormulaPlugin } from '@univerjs/sheets-formula';
import L7 from '@univerjs/sheets-formula/locale/zh-CN';
import '@univerjs/sheets-formula/facade';
import { UniverSheetsFormulaUIPlugin, UniverSheetsFormulaMobileUIPlugin } from '@univerjs/sheets-formula-ui';
import L8 from '@univerjs/sheets-formula-ui/locale/zh-CN';
import '@univerjs/sheets-formula-ui/lib/index.css';
import '@univerjs/sheets-formula-ui/facade';
import { UniverSheetsNumfmtPlugin } from '@univerjs/sheets-numfmt';
import '@univerjs/sheets-numfmt/facade';
import { UniverSheetsNumfmtUIPlugin, UniverSheetsNumfmtMobileUIPlugin } from '@univerjs/sheets-numfmt-ui';
import L10 from '@univerjs/sheets-numfmt-ui/locale/zh-CN';
import '@univerjs/sheets-numfmt-ui/lib/index.css';
import { UniverSheetsFilterPlugin } from '@univerjs/sheets-filter';
import L11 from '@univerjs/sheets-filter/locale/zh-CN';
import '@univerjs/sheets-filter/facade';
import { UniverSheetsFilterUIPlugin, UniverSheetsFilterMobileUIPlugin } from '@univerjs/sheets-filter-ui';
import L12 from '@univerjs/sheets-filter-ui/locale/zh-CN';
import '@univerjs/sheets-filter-ui/lib/index.css';
import { UniverSheetsSortPlugin } from '@univerjs/sheets-sort';
import '@univerjs/sheets-sort/facade';
import { UniverSheetsSortUIPlugin, UniverSheetsSortMobileUIPlugin } from '@univerjs/sheets-sort-ui';
import L14 from '@univerjs/sheets-sort-ui/locale/zh-CN';
import '@univerjs/sheets-sort-ui/lib/index.css';
import { UniverSheetsConditionalFormattingPlugin } from '@univerjs/sheets-conditional-formatting';
import L15 from '@univerjs/sheets-conditional-formatting/locale/zh-CN';
import '@univerjs/sheets-conditional-formatting/facade';
import {
  UniverSheetsConditionalFormattingUIPlugin,
  UniverSheetsConditionalFormattingMobileUIPlugin,
} from '@univerjs/sheets-conditional-formatting-ui';
import L16 from '@univerjs/sheets-conditional-formatting-ui/locale/zh-CN';
import '@univerjs/sheets-conditional-formatting-ui/lib/index.css';
import { UniverDataValidationPlugin } from '@univerjs/data-validation';
import L17 from '@univerjs/data-validation/locale/zh-CN';
import { UniverSheetsDataValidationPlugin } from '@univerjs/sheets-data-validation';
import L18 from '@univerjs/sheets-data-validation/locale/zh-CN';
import '@univerjs/sheets-data-validation/facade';
import {
  UniverSheetsDataValidationUIPlugin,
  UniverSheetsDataValidationMobileUIPlugin,
} from '@univerjs/sheets-data-validation-ui';
import L19 from '@univerjs/sheets-data-validation-ui/locale/zh-CN';
import '@univerjs/sheets-data-validation-ui/lib/index.css';
import { UniverSheetsHyperLinkPlugin } from '@univerjs/sheets-hyper-link';
import L20 from '@univerjs/sheets-hyper-link/locale/zh-CN';
import '@univerjs/sheets-hyper-link/facade';
import {
  UniverSheetsHyperLinkUIPlugin,
  UniverSheetsHyperLinkMobileUIPlugin,
} from '@univerjs/sheets-hyper-link-ui';
import L21 from '@univerjs/sheets-hyper-link-ui/locale/zh-CN';
import '@univerjs/sheets-hyper-link-ui/lib/index.css';
import '@univerjs/sheets-hyper-link-ui/facade';
import { UniverFindReplacePlugin, UniverFindReplaceMobileUIPlugin } from '@univerjs/find-replace';
import L22 from '@univerjs/find-replace/locale/zh-CN';
import '@univerjs/find-replace/lib/index.css';
import {
  UniverSheetsFindReplacePlugin,
  UniverSheetsFindReplaceMobileUIPlugin,
} from '@univerjs/sheets-find-replace';
import '@univerjs/sheets-find-replace/facade';
import { UniverDrawingPlugin } from '@univerjs/drawing';
import { UniverDrawingUIPlugin, UniverDrawingMobileUIPlugin } from '@univerjs/drawing-ui';
import L25 from '@univerjs/drawing-ui/locale/zh-CN';
import '@univerjs/drawing-ui/lib/index.css';
import { UniverSheetsDrawingPlugin } from '@univerjs/sheets-drawing';
import '@univerjs/sheets-drawing/facade';
import { UniverSheetsDrawingUIPlugin, UniverSheetsDrawingMobileUIPlugin } from '@univerjs/sheets-drawing-ui';
import L27 from '@univerjs/sheets-drawing-ui/locale/zh-CN';
import '@univerjs/sheets-drawing-ui/lib/index.css';
import '@univerjs/sheets-drawing-ui/facade';
import { UniverThreadCommentPlugin } from '@univerjs/thread-comment';
import '@univerjs/thread-comment/facade';
import { UniverThreadCommentUIPlugin, UniverThreadCommentMobileUIPlugin } from '@univerjs/thread-comment-ui';
import L29 from '@univerjs/thread-comment-ui/locale/zh-CN';
import '@univerjs/thread-comment-ui/lib/index.css';
import { UniverSheetsThreadCommentPlugin } from '@univerjs/sheets-thread-comment';
import '@univerjs/sheets-thread-comment/facade';
import {
  UniverSheetsThreadCommentUIPlugin,
  UniverSheetsThreadCommentMobileUIPlugin,
} from '@univerjs/sheets-thread-comment-ui';
import L31 from '@univerjs/sheets-thread-comment-ui/locale/zh-CN';
import '@univerjs/sheets-thread-comment-ui/lib/index.css';
import { UniverSheetsNotePlugin } from '@univerjs/sheets-note';
import '@univerjs/sheets-note/facade';
import { UniverSheetsTablePlugin } from '@univerjs/sheets-table';
import L33 from '@univerjs/sheets-table/locale/zh-CN';
import '@univerjs/sheets-table/facade';
import { UniverSheetsTableUIPlugin, UniverSheetsTableMobileUIPlugin } from '@univerjs/sheets-table-ui';
import L34 from '@univerjs/sheets-table-ui/locale/zh-CN';
import '@univerjs/sheets-table-ui/lib/index.css';
import {
  UniverSheetsCrosshairHighlightPlugin,
  UniverSheetsCrosshairHighlightMobileUIPlugin,
} from '@univerjs/sheets-crosshair-highlight';
import L35 from '@univerjs/sheets-crosshair-highlight/locale/zh-CN';
import '@univerjs/sheets-crosshair-highlight/lib/index.css';
import '@univerjs/sheets-crosshair-highlight/facade';
import { UniverWatermarkPlugin } from '@univerjs/watermark';
import '@univerjs/watermark/facade';

export const OPEN_SOURCE_PLUGINS = [
  'engine-render',
  'engine-formula',
  'ui',
  'docs',
  'docs-ui',
  'sheets',
  'sheets-ui',
  'sheets-formula',
  'sheets-formula-ui',
  'sheets-numfmt',
  'sheets-numfmt-ui',
  'sheets-filter',
  'sheets-filter-ui',
  'sheets-sort',
  'sheets-sort-ui',
  'sheets-conditional-formatting',
  'sheets-conditional-formatting-ui',
  'data-validation',
  'sheets-data-validation',
  'sheets-data-validation-ui',
  'sheets-hyper-link',
  'sheets-hyper-link-ui',
  'find-replace',
  'sheets-find-replace',
  'drawing',
  'drawing-ui',
  'sheets-drawing',
  'sheets-drawing-ui',
  'thread-comment',
  'thread-comment-ui',
  'sheets-thread-comment',
  'sheets-thread-comment-ui',
  'sheets-note',
  'sheets-table',
  'sheets-table-ui',
  'sheets-crosshair-highlight',
  'watermark',
] as const;
export const UNIVER_VERSION = '1.0.3';
export function createEditor(container: HTMLElement, snapshot: IWorkbookData, mobile = false) {
  const univer = new Univer({
    locale: LocaleType.ZH_CN,
    locales: {
      [LocaleType.ZH_CN]: mergeLocales(
        DesignLocale,
        L1,
        L2,
        L4,
        L5,
        L6,
        L7,
        L8,
        L10,
        L11,
        L12,
        L14,
        L15,
        L16,
        L17,
        L18,
        L19,
        L20,
        L21,
        L22,
        L25,
        L27,
        L29,
        L31,
        L33,
        L34,
        L35,
      ),
    },
    logCommandExecution: false,
  });
  univer.registerPlugin(UniverRenderEnginePlugin);
  univer.registerPlugin(UniverFormulaEnginePlugin);
  univer.registerPlugin(mobile ? UniverMobileUIPlugin : UniverUIPlugin, {
    container,
    disableAutoFocus: true,
  });
  univer.registerPlugin(UniverDocsPlugin);
  univer.registerPlugin(UniverDocsUIPlugin);
  univer.registerPlugin(UniverSheetsPlugin);
  univer.registerPlugin(mobile ? UniverSheetsMobileUIPlugin : UniverSheetsUIPlugin);
  univer.registerPlugin(UniverSheetsFormulaPlugin);
  univer.registerPlugin(mobile ? UniverSheetsFormulaMobileUIPlugin : UniverSheetsFormulaUIPlugin);
  univer.registerPlugin(UniverSheetsNumfmtPlugin);
  univer.registerPlugin(mobile ? UniverSheetsNumfmtMobileUIPlugin : UniverSheetsNumfmtUIPlugin);
  univer.registerPlugin(UniverSheetsFilterPlugin);
  univer.registerPlugin(mobile ? UniverSheetsFilterMobileUIPlugin : UniverSheetsFilterUIPlugin);
  univer.registerPlugin(UniverSheetsSortPlugin);
  univer.registerPlugin(mobile ? UniverSheetsSortMobileUIPlugin : UniverSheetsSortUIPlugin);
  univer.registerPlugin(UniverSheetsConditionalFormattingPlugin);
  univer.registerPlugin(
    mobile ? UniverSheetsConditionalFormattingMobileUIPlugin : UniverSheetsConditionalFormattingUIPlugin,
  );
  univer.registerPlugin(UniverDataValidationPlugin);
  univer.registerPlugin(UniverSheetsDataValidationPlugin);
  univer.registerPlugin(
    mobile ? UniverSheetsDataValidationMobileUIPlugin : UniverSheetsDataValidationUIPlugin,
  );
  univer.registerPlugin(UniverSheetsHyperLinkPlugin);
  univer.registerPlugin(mobile ? UniverSheetsHyperLinkMobileUIPlugin : UniverSheetsHyperLinkUIPlugin);
  univer.registerPlugin(mobile ? UniverFindReplaceMobileUIPlugin : UniverFindReplacePlugin);
  univer.registerPlugin(mobile ? UniverSheetsFindReplaceMobileUIPlugin : UniverSheetsFindReplacePlugin);
  univer.registerPlugin(UniverDrawingPlugin);
  univer.registerPlugin(mobile ? UniverDrawingMobileUIPlugin : UniverDrawingUIPlugin);
  univer.registerPlugin(UniverSheetsDrawingPlugin);
  univer.registerPlugin(mobile ? UniverSheetsDrawingMobileUIPlugin : UniverSheetsDrawingUIPlugin);
  univer.registerPlugin(UniverThreadCommentPlugin);
  univer.registerPlugin(mobile ? UniverThreadCommentMobileUIPlugin : UniverThreadCommentUIPlugin);
  univer.registerPlugin(UniverSheetsThreadCommentPlugin);
  univer.registerPlugin(mobile ? UniverSheetsThreadCommentMobileUIPlugin : UniverSheetsThreadCommentUIPlugin);
  univer.registerPlugin(UniverSheetsNotePlugin);
  univer.registerPlugin(UniverSheetsTablePlugin);
  univer.registerPlugin(mobile ? UniverSheetsTableMobileUIPlugin : UniverSheetsTableUIPlugin);
  univer.registerPlugin(
    mobile ? UniverSheetsCrosshairHighlightMobileUIPlugin : UniverSheetsCrosshairHighlightPlugin,
  );
  univer.registerPlugin(UniverWatermarkPlugin);
  univer.createUnit(UniverInstanceType.UNIVER_SHEET, snapshot);
  const api = FUniver.newAPI(univer);
  return { univer, api };
}
