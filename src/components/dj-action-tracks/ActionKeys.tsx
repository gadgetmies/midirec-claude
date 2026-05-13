/* Sticky-left keys column for the dj-action-track body. One row per pitch
   in `track.actionMap`, top-to-bottom order matches
   `djActionRowOrderTopToBottom` (ascending `short`, then pitch). Each row
   shows the action's `short` (never the full `label`) so the row identity
   fits in 56px without truncation. The full `label` is surfaced via
   `title`. The M/S chip is hidden at rest and revealed on
   hover/focus-within; per-row muted/soloed state stays visible at rest via
   label styling. The keys column width matches KEYS_COLUMN_WIDTH (56px)
   so beat 0 lines up across both kinds of tracks. */

import { MSChip } from '../ms-chip/MSChip';
import { djActionRowOrderTopToBottom } from '../../data/dj';
import type { DJActionTrack } from '../../hooks/useDJActionTracks';
import { useStage } from '../../hooks/useStage';

interface ActionKeysProps {
  track: DJActionTrack;
  onToggleRowMuted: (pitch: number) => void;
  onToggleRowSoloed: (pitch: number) => void;
}

export function ActionKeys({ track, onToggleRowMuted, onToggleRowSoloed }: ActionKeysProps) {
  const { djActionSelection, setDJActionSelection } = useStage();

  const pitches = djActionRowOrderTopToBottom(track.actionMap);

  const selectRow = (pitch: number) => {
    setDJActionSelection({ trackId: track.id, pitch });
  };

  return (
    <div className="mr-djtrack__keys">
      {pitches.map((pitch) => {
        const action = track.actionMap[pitch];
        const muted = track.mutedRows.includes(pitch);
        const soloed = track.soloedRows.includes(pitch);
        const selected =
          djActionSelection?.trackId === track.id && djActionSelection.pitch === pitch;
        return (
          <div
            key={pitch}
            className="mr-actkey"
            title={action.label}
            tabIndex={0}
            data-row-muted={muted ? 'true' : undefined}
            data-row-soloed={soloed ? 'true' : undefined}
            data-selected={selected ? 'true' : undefined}
            onClick={(e) => {
              /* M/S chip clicks shouldn't change selection — the chip's own
                 buttons handle toggle. */
              if ((e.target as HTMLElement).closest('.mr-actkey__chip')) return;
              selectRow(pitch);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                selectRow(pitch);
              }
            }}
          >
            <span className="mr-actkey__label">{action.short}</span>
            <div className="mr-actkey__chip">
              <MSChip
                muted={muted}
                soloed={soloed}
                onMute={() => onToggleRowMuted(pitch)}
                onSolo={() => onToggleRowSoloed(pitch)}
                size="xs"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
