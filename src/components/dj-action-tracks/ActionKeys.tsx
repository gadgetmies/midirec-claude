/* Sticky-left keys column for the dj-action-track body. One row per pitch
   in `track.actionMap`, ascending. Each row shows the action's `short`
   code (PLAY, CUE, HC1, HC2, ON, X◀ — never the full label) so the row
   identity fits in 56px without any truncation. The full `label` is
   surfaced via the row's `title` attribute (browser-native tooltip).
   The M/S chip is hidden at rest and revealed on hover/focus-within;
   per-row muted/soloed state stays visible at rest via label styling
   (dim text for muted, accent color for soloed). The keys column width
   matches the channel-track's KEYS_COLUMN_WIDTH (56px) so beat 0 lines
   up across both kinds of tracks. */

import { MSChip } from '../ms-chip/MSChip';
import type { DJActionTrack } from '../../hooks/useDJActionTracks';

interface ActionKeysProps {
  track: DJActionTrack;
  onToggleRowMuted: (pitch: number) => void;
  onToggleRowSoloed: (pitch: number) => void;
}

export function ActionKeys({ track, onToggleRowMuted, onToggleRowSoloed }: ActionKeysProps) {
  /* Descending pitch order so DOM-first = top of the keys column. This
     matches ActionRoll, which places the highest pitch at top via absolute
     positioning. ActionKeys uses flex-column DOM order, so descending sort
     gives the same row alignment. */
  const pitches = Object.keys(track.actionMap)
    .map(Number)
    .sort((a, b) => b - a);

  return (
    <div className="mr-djtrack__keys">
      {pitches.map((pitch) => {
        const action = track.actionMap[pitch];
        const muted = track.mutedRows.includes(pitch);
        const soloed = track.soloedRows.includes(pitch);
        return (
          <div
            key={pitch}
            className="mr-actkey"
            title={action.label}
            data-row-muted={muted ? 'true' : undefined}
            data-row-soloed={soloed ? 'true' : undefined}
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
