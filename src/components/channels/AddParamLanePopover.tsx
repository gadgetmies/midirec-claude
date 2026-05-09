import { useEffect, useRef, useState } from 'react';
import { STANDARD_CCS, type ParamLane, type ParamLaneKind, type ChannelId } from '../../hooks/useChannels';

interface AddParamLanePopoverProps {
  channelId: ChannelId;
  existingLanes: ParamLane[];
  onAdd: (kind: ParamLaneKind, cc?: number) => void;
  onClose: () => void;
}

function laneExists(existing: ParamLane[], kind: ParamLaneKind, cc?: number): boolean {
  return existing.some((l) => l.kind === kind && l.cc === cc);
}

export function AddParamLanePopover({ existingLanes, onAdd, onClose }: AddParamLanePopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [customCC, setCustomCC] = useState('');

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!popoverRef.current) return;
      if (popoverRef.current.contains(event.target as Node)) return;
      onClose();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  const submitCustom = () => {
    const n = Number.parseInt(customCC, 10);
    if (!Number.isFinite(n) || n < 0 || n > 127) return;
    onAdd('cc', n);
  };

  return (
    <div ref={popoverRef} className="mr-param-lanes__popover" role="menu">
      {STANDARD_CCS.map((entry) => {
        const disabled = laneExists(existingLanes, 'cc', entry.cc);
        return (
          <button
            key={entry.cc}
            type="button"
            className="mr-param-lanes__popover-row"
            data-disabled={disabled ? 'true' : undefined}
            onClick={() => {
              if (disabled) return;
              onAdd('cc', entry.cc);
            }}
          >
            {entry.name} (CC {entry.cc})
          </button>
        );
      })}
      <div className="mr-param-lanes__popover-divider" />
      {(['pb', 'at'] as const).map((kind) => {
        const label = kind === 'pb' ? 'Pitch Bend' : 'Aftertouch';
        const disabled = laneExists(existingLanes, kind);
        return (
          <button
            key={kind}
            type="button"
            className="mr-param-lanes__popover-row"
            data-disabled={disabled ? 'true' : undefined}
            onClick={() => {
              if (disabled) return;
              onAdd(kind);
            }}
          >
            {label}
          </button>
        );
      })}
      <div className="mr-param-lanes__popover-divider" />
      <div className="mr-param-lanes__popover-custom">
        <label htmlFor="mr-add-cc-custom">Custom CC#</label>
        <input
          id="mr-add-cc-custom"
          type="number"
          min={0}
          max={127}
          value={customCC}
          onChange={(e) => setCustomCC(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submitCustom();
            }
          }}
        />
        <button type="button" onClick={submitCustom}>Add</button>
      </div>
    </div>
  );
}
