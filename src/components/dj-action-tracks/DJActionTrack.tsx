import { type MouseEvent } from 'react';
import { ChevDownIcon } from '../icons/transport';
import { MSChip } from '../ms-chip/MSChip';
import { ActionKeys } from './ActionKeys';
import { ActionRoll } from './ActionRoll';
import type { DJActionTrack as DJActionTrackData } from '../../hooks/useDJActionTracks';
import './DJActionTrack.css';
import './ActionKeys.css';
import './ActionRoll.css';

interface DJActionTrackProps {
  track: DJActionTrackData;
  audible: boolean;
  soloing: boolean;
  totalT: number;
  pxPerBeat: number;
  rowHeight: number;
  playheadT?: number;
  onToggleCollapsed: () => void;
  onToggleMuted: () => void;
  onToggleSoloed: () => void;
  onToggleRowMuted: (pitch: number) => void;
  onToggleRowSoloed: (pitch: number) => void;
}

export function DJActionTrack({
  track,
  audible,
  soloing,
  totalT,
  pxPerBeat,
  rowHeight,
  playheadT,
  onToggleCollapsed,
  onToggleMuted,
  onToggleSoloed,
  onToggleRowMuted,
  onToggleRowSoloed,
}: DJActionTrackProps) {
  const rowCount = Object.keys(track.actionMap).length;

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
          <ActionKeys
            track={track}
            onToggleRowMuted={onToggleRowMuted}
            onToggleRowSoloed={onToggleRowSoloed}
          />
          <ActionRoll
            track={track}
            soloing={soloing}
            totalT={totalT}
            pxPerBeat={pxPerBeat}
            rowHeight={rowHeight}
            playheadT={playheadT}
          />
        </div>
      )}
    </div>
  );
}
