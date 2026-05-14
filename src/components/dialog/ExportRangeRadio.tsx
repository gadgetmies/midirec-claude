import type { ExportDialogRangeChoice } from './exportDialogRange';

interface RangeRadioProps {
  lbl: string;
  value: ExportDialogRangeChoice;
  checked: boolean;
  disabled?: boolean;
  selectRange(next: ExportDialogRangeChoice): void;
}

export function ExportRangeRadio({ lbl, value, checked, disabled, selectRange }: RangeRadioProps) {
  return (
    <label className="mr-range-radio">
      <input
        type="radio"
        name="mr-export-range"
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => selectRange(value)}
      />
      <span>{lbl}</span>
    </label>
  );
}
