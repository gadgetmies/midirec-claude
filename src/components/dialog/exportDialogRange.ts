import { useState } from 'react';

export type ExportDialogRangeChoice = 'whole' | 'selection' | 'loop';

export type ExportFormatChoice = 'mid' | 'jsonl';

export const EXPORT_FILENAME_EXT: Record<ExportFormatChoice, string> = {
  mid: 'mid',
  jsonl: 'jsonl',
};

export function useExportDialogRange() {
  return useState<ExportDialogRangeChoice>('whole');
}

export function useExportFormatChoice() {
  return useState<ExportFormatChoice>('mid');
}
