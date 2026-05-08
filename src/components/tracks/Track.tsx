import type { MouseEvent } from 'react';
import { MSChip } from '../ms-chip/MSChip';
import { PianoRoll } from '../piano-roll/PianoRoll';
import type { Marquee } from '../piano-roll/notes';
import { Minimap } from './Minimap';
import type { Track as TrackType } from '../../hooks/useTracks';
import './Track.css';

export interface TrackViewProps {
  pxPerBeat?: number;
  rowHeight?: number;
  lo?: number;
  hi?: number;
  totalT?: number;
  playheadT?: number;
  viewT0?: number;
}

interface TrackProps {
  track: TrackType;
  viewProps: TrackViewProps;
  isSelected: boolean;
  marquee: Marquee | null;
  selectedIdx: number[] | undefined;
  onToggleOpen: () => void;
  onToggleMuted: () => void;
  onToggleSoloed: () => void;
}

export function Track({
  track,
  viewProps,
  isSelected,
  marquee,
  selectedIdx,
  onToggleOpen,
  onToggleMuted,
  onToggleSoloed,
}: TrackProps) {
  const headerClick = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    onToggleOpen();
  };

  return (
    <div
      className="mr-track"
      data-track-open={track.open ? 'true' : 'false'}
      data-muted={track.muted ? 'true' : 'false'}
      data-soloed={track.soloed ? 'true' : 'false'}
    >
      <div className="mr-track__hdr" onClick={headerClick}>
        <span className="mr-track__chev">▾</span>
        <span
          className="mr-track__swatch"
          style={{ background: track.color, color: track.color }}
        />
        <span className="mr-track__name">{track.name}</span>
        <span className="mr-track__sub">
          {track.channel} · {track.notes.length} notes
        </span>
        <div className="mr-track__spacer" />
        <MSChip
          muted={track.muted}
          soloed={track.soloed}
          onMute={onToggleMuted}
          onSolo={onToggleSoloed}
        />
      </div>
      {track.open ? (
        <div className="mr-track__roll">
          <PianoRoll
            notes={track.notes}
            trackColor={track.color}
            marquee={isSelected ? marquee : null}
            selectedIdx={isSelected ? selectedIdx : []}
            pxPerBeat={viewProps.pxPerBeat}
            rowHeight={viewProps.rowHeight}
            lo={viewProps.lo}
            hi={viewProps.hi}
            totalT={viewProps.totalT}
            playheadT={viewProps.playheadT}
          />
        </div>
      ) : (
        <div className="mr-track__collapsed">
          <span>collapsed</span>
          <Minimap
            notes={track.notes}
            color={track.color}
            viewT0={viewProps.viewT0 ?? 0}
            totalT={viewProps.totalT ?? 16}
          />
          <span>{track.notes.length} events · 4 bars</span>
        </div>
      )}
    </div>
  );
}
