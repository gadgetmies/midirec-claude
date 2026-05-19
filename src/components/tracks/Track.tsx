import type { MouseEvent } from 'react';
import { ChevDownIcon } from '../icons/transport';
import { MSChip } from '../ms-chip/MSChip';
import { KEYS_COLUMN_WIDTH, PianoRoll } from '../piano-roll/PianoRoll';
import type { Marquee } from '../piano-roll/notes';
import { Minimap } from './Minimap';
import type { Channel, PianoRollTrack } from '../../hooks/useChannels';
import type { QuantizeGrid } from '../../midi/quantizeGrid';
import './Track.css';

export interface TrackViewProps {
  pxPerBeat?: number;
  pxPerTick: number;
  rowHeight?: number;
  lo?: number;
  hi?: number;
  totalT?: number;
  playheadT?: number;
  playheadTicks: number;
  viewT0?: number;
  viewT0Ticks?: number;
  layoutHorizonTicks: number;
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
  onSelectTimelineChannel?: () => void;
  onRollNoteSelect?: (noteIndex: number) => void;
  onRollNoteMove?: (noteIndex: number, nextTTicks: number) => void;
  quantizeOn?: boolean;
  quantizeGrid?: QuantizeGrid;
  snapAbsoluteOn?: boolean;
  trackHeaderSelected?: boolean;
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
  onSelectTimelineChannel,
  onRollNoteSelect,
  onRollNoteMove,
  quantizeOn,
  quantizeGrid,
  snapAbsoluteOn,
  trackHeaderSelected,
}: TrackProps) {
  const selectHeader = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    onSelectTimelineChannel?.();
  };

  const chevronToggle = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onToggleCollapsed();
  };

  const v0 = viewProps.viewT0Ticks ?? 0;

  return (
    <div
      className="mr-track"
      data-track-collapsed={roll.collapsed ? 'true' : 'false'}
      data-muted={roll.muted ? 'true' : 'false'}
      data-soloed={roll.soloed ? 'true' : 'false'}
      data-audible={audible ? 'true' : 'false'}
    >
      <div
        className="mr-track__hdr"
        onClick={selectHeader}
        data-timeline-selected={trackHeaderSelected ? 'true' : undefined}
      >
        <div className="mr-track__hdr-left">
          <button
            type="button"
            className="mr-track__chev-btn"
            aria-expanded={!roll.collapsed}
            aria-label={roll.collapsed ? 'Expand notes track' : 'Collapse notes track'}
            onClick={chevronToggle}
          >
            <span className="mr-track__chev">
              <ChevDownIcon />
            </span>
          </button>
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
            viewT0Ticks={v0}
            layoutHorizonTicks={viewProps.layoutHorizonTicks}
            pxPerTick={viewProps.pxPerTick}
          />
          <div
            className="mr-playhead"
            style={{
              left:
                KEYS_COLUMN_WIDTH +
                (viewProps.playheadTicks - v0) * viewProps.pxPerTick,
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
            layoutHorizonTicks={viewProps.layoutHorizonTicks}
            viewT0Ticks={v0}
            playheadTicks={viewProps.playheadTicks}
            onNoteSelect={onRollNoteSelect}
            onNoteMove={onRollNoteMove}
            quantizeOn={quantizeOn}
            quantizeGrid={quantizeGrid}
            snapAbsoluteOn={snapAbsoluteOn}
          />
        </div>
      )}
    </div>
  );
}
