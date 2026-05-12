import { type MouseEvent } from 'react';
import { ChevDownIcon } from '../icons/transport';
import { MSChip } from '../ms-chip/MSChip';
import { Track, type TrackViewProps } from '../tracks/Track';
import { ParamLane } from '../param-lanes/ParamLane';
import { AddParamLaneRow } from './AddParamLaneRow';
import type { Marquee } from '../piano-roll/notes';
import {
  isChannelAudible,
  isLaneAudible,
  isRollAudible,
  laneKeyOf,
  type ParamLane as ParamLaneType,
  type ParamLaneKind,
  type Channel,
  type ChannelId,
  type PianoRollTrack,
} from '../../hooks/useChannels';
import './ChannelGroup.css';

interface ChannelGroupProps {
  channel: Channel;
  roll: PianoRollTrack | undefined;
  lanes: ParamLaneType[];
  channels: Channel[];
  soloing: boolean;
  viewProps: TrackViewProps;
  isSelected: boolean;
  marquee: Marquee | null;
  selectedIdx: number[] | undefined;
  totalT: number;
  onToggleChannelCollapsed: () => void;
  onToggleChannelMuted: () => void;
  onToggleChannelSoloed: () => void;
  onToggleRollCollapsed: () => void;
  onToggleRollMuted: () => void;
  onToggleRollSoloed: () => void;
  onToggleLaneCollapsed: (kind: ParamLaneKind, cc?: number) => void;
  onToggleLaneMuted: (kind: ParamLaneKind, cc?: number) => void;
  onToggleLaneSoloed: (kind: ParamLaneKind, cc?: number) => void;
  onAddParamLane: (channelId: ChannelId, kind: ParamLaneKind, cc?: number) => void;
  onSelectTimelineChannel?: () => void;
  timelineHeaderSelected?: boolean;
}

export function ChannelGroup({
  channel,
  roll,
  lanes,
  channels,
  soloing,
  viewProps,
  isSelected,
  marquee,
  selectedIdx,
  totalT,
  onToggleChannelCollapsed,
  onToggleChannelMuted,
  onToggleChannelSoloed,
  onToggleRollCollapsed,
  onToggleRollMuted,
  onToggleRollSoloed,
  onToggleLaneCollapsed,
  onToggleLaneMuted,
  onToggleLaneSoloed,
  onAddParamLane,
  onSelectTimelineChannel,
  timelineHeaderSelected,
}: ChannelGroupProps) {
  const selectHeader = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    onSelectTimelineChannel?.();
  };

  const chevronToggle = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onToggleChannelCollapsed();
  };

  const channelAudible = isChannelAudible(channel, soloing);

  return (
    <div
      className="mr-channel"
      data-channel={channel.id}
      data-channel-collapsed={channel.collapsed ? 'true' : 'false'}
      data-muted={channel.muted ? 'true' : 'false'}
      data-soloed={channel.soloed ? 'true' : 'false'}
      data-audible={channelAudible ? 'true' : 'false'}
    >
      <div
        className="mr-channel__hdr"
        onClick={selectHeader}
        data-timeline-selected={timelineHeaderSelected ? 'true' : undefined}
      >
        <div className="mr-channel__hdr-left">
          <button
            type="button"
            className="mr-channel__chev-btn"
            aria-expanded={!channel.collapsed}
            aria-label={channel.collapsed ? 'Expand channel' : 'Collapse channel'}
            onClick={chevronToggle}
          >
            <span className="mr-channel__chev">
              <ChevDownIcon />
            </span>
          </button>
          <span
            className="mr-channel__swatch"
            style={{ background: channel.color, color: channel.color }}
          />
          <span className="mr-channel__name">{channel.name}</span>
        </div>
        <div className="mr-channel__hdr-spacer" />
        <div className="mr-channel__hdr-right">
          <MSChip
            muted={channel.muted}
            soloed={channel.soloed}
            onMute={onToggleChannelMuted}
            onSolo={onToggleChannelSoloed}
          />
        </div>
      </div>

      {!channel.collapsed && (
        <>
          {roll && (
            <Track
              channel={channel}
              roll={roll}
              viewProps={viewProps}
              isSelected={isSelected}
              marquee={marquee}
              selectedIdx={selectedIdx}
              audible={isRollAudible(roll, channels, soloing)}
              onToggleCollapsed={onToggleRollCollapsed}
              onToggleMuted={onToggleRollMuted}
              onToggleSoloed={onToggleRollSoloed}
              onSelectTimelineChannel={onSelectTimelineChannel}
              trackHeaderSelected={timelineHeaderSelected}
            />
          )}
          {lanes.map((lane) => (
            <ParamLane
              key={laneKeyOf(lane)}
              lane={lane}
              totalT={totalT}
              pxPerBeat={viewProps.pxPerBeat}
              playheadT={viewProps.playheadT}
              audible={isLaneAudible(lane, channels, soloing)}
              onToggleCollapsed={() => onToggleLaneCollapsed(lane.kind, lane.cc)}
              onToggleMuted={() => onToggleLaneMuted(lane.kind, lane.cc)}
              onToggleSoloed={() => onToggleLaneSoloed(lane.kind, lane.cc)}
            />
          ))}
          <AddParamLaneRow
            channelId={channel.id}
            existingLanes={lanes}
            onAdd={(kind, cc) => onAddParamLane(channel.id, kind, cc)}
          />
        </>
      )}
    </div>
  );
}
