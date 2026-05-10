import type { MouseEvent } from 'react';
import { ChevDownIcon } from '../icons/transport';
import { MSChip } from '../ms-chip/MSChip';
import { DEFAULT_PX_PER_BEAT, KEYS_COLUMN_WIDTH, PianoRoll } from '../piano-roll/PianoRoll';
import type { Marquee } from '../piano-roll/notes';
import { Minimap } from './Minimap';
import type { Channel, PianoRollTrack } from '../../hooks/useChannels';
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
  channel: Channel;
  roll: PianoRollTrack;
  viewProps: TrackViewProps;
  isSelected: boolean;
  marquee: Marquee | null;
  selectedIdx: number[] | undefined;
  audible: boolean;
  onToggleCollapsed: () => void;
  onToggleMuted: () => void;
  onToggleSoloed: () => void;
}

export function Track({
  channel,
  roll,
  viewProps,
  isSelected,
  marquee,
  selectedIdx,
  audible,
  onToggleCollapsed,
  onToggleMuted,
  onToggleSoloed,
}: TrackProps) {
  const headerClick = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    onToggleCollapsed();
  };

  return (
    <div
      className="mr-track"
      data-track-collapsed={roll.collapsed ? 'true' : 'false'}
      data-muted={roll.muted ? 'true' : 'false'}
      data-soloed={roll.soloed ? 'true' : 'false'}
      data-audible={audible ? 'true' : 'false'}
    >
      <div className="mr-track__hdr" onClick={headerClick}>
        <div className="mr-track__hdr-left">
          <span className="mr-track__chev">
            <ChevDownIcon />
          </span>
          <span className="mr-track__name">Notes</span>
          <span className="mr-track__sub">{roll.notes.length} notes</span>
        </div>
        <div className="mr-track__hdr-spacer" />
        <div className="mr-track__hdr-right">
          <MSChip
            muted={roll.muted}
            soloed={roll.soloed}
            onMute={onToggleMuted}
            onSolo={onToggleSoloed}
          />
        </div>
      </div>
      {roll.collapsed ? (
        <div className="mr-track__collapsed">
          <div className="mr-track__keys-spacer" />
          <Minimap
            notes={roll.notes}
            color={channel.color}
            viewT0={viewProps.viewT0 ?? 0}
            totalT={viewProps.totalT ?? 16}
            pxPerBeat={viewProps.pxPerBeat ?? DEFAULT_PX_PER_BEAT}
          />
          <div
            className="mr-playhead"
            style={{
              left:
                KEYS_COLUMN_WIDTH +
                (viewProps.playheadT ?? 0) * (viewProps.pxPerBeat ?? DEFAULT_PX_PER_BEAT),
            }}
          />
        </div>
      ) : (
        <div className="mr-track__roll">
          <PianoRoll
            notes={roll.notes}
            trackColor={channel.color}
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
      )}
    </div>
  );
}
