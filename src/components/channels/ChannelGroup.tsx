import { type MouseEvent } from 'react';
import { MSChip } from '../ms-chip/MSChip';
import { Track, type TrackViewProps } from '../tracks/Track';
import { CCLane } from '../cc-lanes/CCLane';
import { AddCCLaneRow } from './AddCCLaneRow';
import type { Marquee } from '../piano-roll/notes';
import {
  isChannelAudible,
  isLaneAudible,
  isRollAudible,
  laneKeyOf,
  type CCLane as CCLaneType,
  type CCLaneKind,
  type Channel,
  type ChannelId,
  type PianoRollTrack,
} from '../../hooks/useChannels';
import './ChannelGroup.css';

interface ChannelGroupProps {
  channel: Channel;
  roll: PianoRollTrack | undefined;
  lanes: CCLaneType[];
  state: { channels: Channel[]; rolls: PianoRollTrack[]; lanes: CCLaneType[] };
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
  onToggleLaneCollapsed: (kind: CCLaneKind, cc?: number) => void;
  onToggleLaneMuted: (kind: CCLaneKind, cc?: number) => void;
  onToggleLaneSoloed: (kind: CCLaneKind, cc?: number) => void;
  onAddCCLane: (channelId: ChannelId, kind: CCLaneKind, cc?: number) => void;
}

export function ChannelGroup({
  channel,
  roll,
  lanes,
  state,
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
  onAddCCLane,
}: ChannelGroupProps) {
  const headerClick = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    onToggleChannelCollapsed();
  };

  const channelAudible = isChannelAudible(channel, state);

  return (
    <div
      className="mr-channel"
      data-channel={channel.id}
      data-channel-collapsed={channel.collapsed ? 'true' : 'false'}
      data-muted={channel.muted ? 'true' : 'false'}
      data-soloed={channel.soloed ? 'true' : 'false'}
      data-audible={channelAudible ? 'true' : 'false'}
    >
      <div className="mr-channel__hdr" onClick={headerClick}>
        <div className="mr-channel__hdr-left">
          <span className="mr-channel__chev">▾</span>
          <span
            className="mr-channel__swatch"
            style={{ background: channel.color, color: channel.color }}
          />
          <span className="mr-channel__name">{channel.name}</span>
          <span className="mr-channel__sub">CH {channel.id}</span>
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
              audible={isRollAudible(roll, state)}
              onToggleCollapsed={onToggleRollCollapsed}
              onToggleMuted={onToggleRollMuted}
              onToggleSoloed={onToggleRollSoloed}
            />
          )}
          {lanes.map((lane) => (
            <CCLane
              key={laneKeyOf(lane)}
              lane={lane}
              totalT={totalT}
              pxPerBeat={viewProps.pxPerBeat}
              playheadT={viewProps.playheadT}
              audible={isLaneAudible(lane, state)}
              onToggleCollapsed={() => onToggleLaneCollapsed(lane.kind, lane.cc)}
              onToggleMuted={() => onToggleLaneMuted(lane.kind, lane.cc)}
              onToggleSoloed={() => onToggleLaneSoloed(lane.kind, lane.cc)}
            />
          ))}
          <AddCCLaneRow
            channelId={channel.id}
            existingLanes={lanes}
            onAdd={(kind, cc) => onAddCCLane(channel.id, kind, cc)}
          />
        </>
      )}
    </div>
  );
}
