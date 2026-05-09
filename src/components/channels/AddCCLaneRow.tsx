import { useState, type MouseEvent } from 'react';
import { AddCCLanePopover } from './AddCCLanePopover';
import type { CCLane, CCLaneKind, ChannelId } from '../../hooks/useChannels';

interface AddCCLaneRowProps {
  channelId: ChannelId;
  existingLanes: CCLane[];
  onAdd: (kind: CCLaneKind, cc?: number) => void;
}

export function AddCCLaneRow({ channelId, existingLanes, onAdd }: AddCCLaneRowProps) {
  const [open, setOpen] = useState(false);

  const onClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setOpen((v) => !v);
  };

  return (
    <div className="mr-cc-lanes__add" onClick={(e) => e.stopPropagation()}>
      <button type="button" className="mr-cc-lanes__add-btn" onClick={onClick} aria-haspopup="menu" aria-expanded={open}>
        + Add CC
      </button>
      {open && (
        <AddCCLanePopover
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
