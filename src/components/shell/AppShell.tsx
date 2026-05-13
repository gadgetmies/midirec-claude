import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useStage } from '../../hooks/useStage';
import { ChannelGroup } from '../channels/ChannelGroup';
import { DJActionTrack } from '../dj-action-tracks/DJActionTrack';
import { Inspector } from '../inspector/Inspector';
import { Ruler } from '../ruler/Ruler';
import { Sidebar } from '../sidebar/Sidebar';
import { Statusbar } from '../statusbar/Statusbar';
import { Titlebar } from '../titlebar/Titlebar';
import { ToastViewport } from '../toast/Toast';
import { Toolstrip } from '../toolstrip/Toolstrip';
import { ExportDialog } from '../dialog/ExportDialog';
import { isDJTrackAudible } from '../../hooks/useDJActionTracks';
import { DEFAULT_PX_PER_BEAT, KEYS_COLUMN_WIDTH } from '../piano-roll/PianoRoll';
import {
  SCROLL_EXTENSION_MARGIN_BEATS,
  clampTimelineScroll,
  horizonBeatsForViewportRightEdge,
} from '../../session/layoutHorizon';

/* Dj-action-track row height in pixels — must match the `--mr-h-row` token
   used by ActionKeys.css so the keys column and the lane area line up. */
const DJ_ROW_HEIGHT = 22;
import './AppShell.css';

export function AppShell() {
  const stage = useStage();
  const tl = stage.selectedTimelineTrack;
  const timelineRef = useRef<HTMLDivElement>(null);

  const floor = stage.sessionHorizonFloorBeats;
  const floorRef = useRef(floor);
  floorRef.current = floor;

  const [layoutHorizonBeats, setLayoutHorizonBeats] = useState(floor);

  useLayoutEffect(() => {
    setLayoutHorizonBeats((h) => Math.max(h, floor));
  }, [floor]);

  const clampAndExpandHorizon = useCallback(() => {
    const el = timelineRef.current;
    if (!el) return;
    clampTimelineScroll(el);
    const fromViewport = horizonBeatsForViewportRightEdge(
      el.scrollLeft,
      el.clientWidth,
      KEYS_COLUMN_WIDTH,
      DEFAULT_PX_PER_BEAT,
      SCROLL_EXTENSION_MARGIN_BEATS,
    );
    const need = Math.max(floorRef.current, fromViewport);
    setLayoutHorizonBeats((h) => (h >= need ? h : need));
  }, []);

  useLayoutEffect(() => {
    const el = timelineRef.current;
    if (!el) return;
    clampAndExpandHorizon();
    const ro = new ResizeObserver(clampAndExpandHorizon);
    ro.observe(el);
    return () => ro.disconnect();
  }, [clampAndExpandHorizon]);

  useLayoutEffect(() => {
    clampAndExpandHorizon();
  }, [floor, clampAndExpandHorizon]);

  const viewProps = {
    lo: stage.lo,
    hi: stage.hi,
    totalT: stage.totalT,
    playheadT: stage.playheadT,
  };

  return (
    <div className="mr-shell">
      <header className="mr-titlebar">
        <Titlebar />
      </header>
      <div className="mr-body">
        <aside className="mr-sidebar">
          <Sidebar />
        </aside>
        <main className="mr-center">
          <div className="mr-toolstrip">
            <Toolstrip />
          </div>
          <div
            ref={timelineRef}
            className="mr-timeline"
            data-soloing={stage.soloing ? 'true' : undefined}
            onScroll={clampAndExpandHorizon}
          >
            <div
              className="mr-timeline__inner"
              style={{
                width: KEYS_COLUMN_WIDTH + layoutHorizonBeats * DEFAULT_PX_PER_BEAT,
              }}
            >
              <Ruler layoutHorizonBeats={layoutHorizonBeats} />
              {stage.visibleChannels.map((channel) => {
                const roll = stage.rolls.find((r) => r.channelId === channel.id);
                const channelLanes = stage.lanes.filter((l) => l.channelId === channel.id);
                const isSelected = stage.selectedChannelId === channel.id;
                const channelTlSelected =
                  tl?.kind === 'channel' && tl.channelId === channel.id;
                return (
                  <ChannelGroup
                    key={channel.id}
                    channel={channel}
                    roll={roll}
                    lanes={channelLanes}
                    channels={stage.channels}
                    soloing={stage.soloing}
                    viewProps={viewProps}
                    isSelected={isSelected}
                    marquee={isSelected ? stage.marquee : null}
                    selectedIdx={isSelected ? stage.selectedIdx : []}
                    layoutHorizonBeats={layoutHorizonBeats}
                    onToggleChannelCollapsed={() => stage.toggleChannelCollapsed(channel.id)}
                    onToggleChannelMuted={() => stage.toggleChannelMuted(channel.id)}
                    onToggleChannelSoloed={() => stage.toggleChannelSoloed(channel.id)}
                    onToggleRollCollapsed={() => stage.toggleRollCollapsed(channel.id)}
                    onToggleRollMuted={() => stage.toggleRollMuted(channel.id)}
                    onToggleRollSoloed={() => stage.toggleRollSoloed(channel.id)}
                    onToggleLaneCollapsed={(kind, cc) => stage.toggleLaneCollapsed(channel.id, kind, cc)}
                    onToggleLaneMuted={(kind, cc) => stage.toggleLaneMuted(channel.id, kind, cc)}
                    onToggleLaneSoloed={(kind, cc) => stage.toggleLaneSoloed(channel.id, kind, cc)}
                    onAddParamLane={stage.addParamLane}
                    onSelectTimelineChannel={() =>
                      stage.setSelectedTimelineTrack({ kind: 'channel', channelId: channel.id })
                    }
                    timelineHeaderSelected={channelTlSelected}
                  />
                );
              })}
              {stage.djActionTracks.map((track) => {
                const djTlSelected = tl?.kind === 'dj' && tl.trackId === track.id;
                return (
                  <DJActionTrack
                    key={track.id}
                    track={track}
                    audible={isDJTrackAudible(track, stage.soloing)}
                    soloing={stage.soloing}
                    layoutHorizonBeats={layoutHorizonBeats}
                    pxPerBeat={DEFAULT_PX_PER_BEAT}
                    rowHeight={DJ_ROW_HEIGHT}
                    playheadT={stage.playheadT}
                    onToggleCollapsed={() => stage.toggleDJTrackCollapsed(track.id)}
                    onToggleMuted={() => stage.toggleDJTrackMuted(track.id)}
                    onToggleSoloed={() => stage.toggleDJTrackSoloed(track.id)}
                    onToggleRowMuted={(pitch) => stage.toggleDJTrackRowMuted(track.id, pitch)}
                    onToggleRowSoloed={(pitch) => stage.toggleDJTrackRowSoloed(track.id, pitch)}
                    onSelectTimelineTrack={() => stage.selectDJTimelineTrack(track.id)}
                    timelineHeaderSelected={djTlSelected}
                  />
                );
              })}
            </div>
          </div>
        </main>
        <aside className="mr-inspector">
          <Inspector />
        </aside>
      </div>
      <footer className="mr-statusbar">
        <Statusbar />
      </footer>
      <ToastViewport />
      {stage.dialogOpen && <ExportDialog />}
    </div>
  );
}
