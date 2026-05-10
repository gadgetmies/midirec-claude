import { type MouseEvent } from 'react';
import { ChevDownIcon } from '../icons/transport';
import { MSChip } from '../ms-chip/MSChip';
import type { DJActionTrack as DJActionTrackData } from '../../hooks/useDJActionTracks';
import './DJActionTrack.css';

interface DJActionTrackProps {
  track: DJActionTrackData;
  audible: boolean;
  onToggleCollapsed: () => void;
  onToggleMuted: () => void;
  onToggleSoloed: () => void;
}

export function DJActionTrack({
  track,
  audible,
  onToggleCollapsed,
  onToggleMuted,
  onToggleSoloed,
}: DJActionTrackProps) {
  const rowCount = Object.keys(track.actionMap).length;
  const placeholderRows = Object.keys(track.actionMap)
    .map((p) => Number(p))
    .sort((a, b) => a - b);

  const headerClick = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    onToggleCollapsed();
  };

  return (
    <div
      className="mr-djtrack"
      data-track-collapsed={track.collapsed ? 'true' : 'false'}
      data-muted={track.muted ? 'true' : 'false'}
      data-soloed={track.soloed ? 'true' : 'false'}
      data-audible={audible ? 'true' : 'false'}
    >
      <div className="mr-djtrack__hdr" onClick={headerClick}>
        <div className="mr-djtrack__hdr-left">
          <span className="mr-djtrack__chev">
            <ChevDownIcon />
          </span>
          <span
            className="mr-djtrack__swatch"
            style={{ background: track.color, color: track.color }}
          />
          <span className="mr-djtrack__name" style={{ color: track.color }}>
            {track.name}
          </span>
          <span className="mr-djtrack__sub">{rowCount} actions</span>
        </div>
        <div className="mr-djtrack__hdr-spacer" />
        <div className="mr-djtrack__hdr-right">
          <MSChip
            muted={track.muted}
            soloed={track.soloed}
            onMute={onToggleMuted}
            onSolo={onToggleSoloed}
          />
        </div>
      </div>
      {!track.collapsed && (
        <div className="mr-djtrack__body">
          {/* Sticky-left keys-spacer mirrors the 56px keys column used by
              Track / ParamLane (see KEYS_COLUMN_WIDTH in PianoRoll.tsx).
              Empty in 7a — placeholder for the ActionKeys column in 7b. */}
          <div className="mr-djtrack__keys-spacer" />
          <div className="mr-djtrack__rows">
            {placeholderRows.map((pitch) => (
              <div key={pitch} className="mr-djtrack__row" />
            ))}
            {rowCount > 0 && (
              <div className="mr-djtrack__placeholder">Action body — Slice 7b</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
