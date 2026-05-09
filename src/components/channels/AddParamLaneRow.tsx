import { useState, type MouseEvent } from 'react';
import { AddParamLanePopover } from './AddParamLanePopover';
import type { ParamLane, ParamLaneKind, ChannelId } from '../../hooks/useChannels';

interface AddParamLaneRowProps {
  channelId: ChannelId;
  existingLanes: ParamLane[];
  onAdd: (kind: ParamLaneKind, cc?: number) => void;
}

export function AddParamLaneRow({ channelId, existingLanes, onAdd }: AddParamLaneRowProps) {
  const [open, setOpen] = useState(false);

  const onClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setOpen((v) => !v);
  };

  return (
    <div className="mr-param-lanes__add" onClick={(e) => e.stopPropagation()}>
      <button type="button" className="mr-param-lanes__add-btn" onClick={onClick} aria-haspopup="menu" aria-expanded={open}>
        + Add Lane
      </button>
      {open && (
        <AddParamLanePopover
          channelId={channelId}
          existingLanes={existingLanes}
          onAdd={(kind, cc) => {
            onAdd(kind, cc);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
