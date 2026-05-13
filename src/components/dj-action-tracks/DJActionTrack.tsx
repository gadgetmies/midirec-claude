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
  layoutHorizonBeats: number;
  pxPerBeat: number;
  rowHeight: number;
  playheadT?: number;
  onToggleCollapsed: () => void;
  onToggleMuted: () => void;
  onToggleSoloed: () => void;
  onToggleRowMuted: (pitch: number) => void;
  onToggleRowSoloed: (pitch: number) => void;
  onSelectTimelineTrack?: () => void;
  timelineHeaderSelected?: boolean;
}

export function DJActionTrack({
  track,
  audible,
  soloing,
  layoutHorizonBeats,
  pxPerBeat,
  rowHeight,
  playheadT,
  onToggleCollapsed,
  onToggleMuted,
  onToggleSoloed,
  onToggleRowMuted,
  onToggleRowSoloed,
  onSelectTimelineTrack,
  timelineHeaderSelected,
}: DJActionTrackProps) {
  const rowCount = Object.keys(track.actionMap).length;

  const selectHeader = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    onSelectTimelineTrack?.();
  };

  const chevronToggle = (event: MouseEvent<HTMLButtonElement>) => {
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
      <div
        className="mr-djtrack__hdr"
        onClick={selectHeader}
        data-timeline-selected={timelineHeaderSelected ? 'true' : undefined}
      >
        <div className="mr-djtrack__hdr-left">
          <button
            type="button"
            className="mr-djtrack__chev-btn"
            aria-expanded={!track.collapsed}
            aria-label={track.collapsed ? 'Expand DJ track' : 'Collapse DJ track'}
            onClick={chevronToggle}
          >
            <span className="mr-djtrack__chev">
              <ChevDownIcon />
            </span>
          </button>
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
            layoutHorizonBeats={layoutHorizonBeats}
            pxPerBeat={pxPerBeat}
            rowHeight={rowHeight}
            playheadT={playheadT}
          />
        </div>
      )}
    </div>
  );
}
