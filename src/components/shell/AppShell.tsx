import { useStage } from '../../hooks/useStage';
import { ChannelGroup } from '../channels/ChannelGroup';
import { Ruler } from '../ruler/Ruler';
import { Titlebar } from '../titlebar/Titlebar';
import { ToastViewport } from '../toast/Toast';
import { DEFAULT_PX_PER_BEAT, KEYS_COLUMN_WIDTH } from '../piano-roll/PianoRoll';
import './AppShell.css';

export function AppShell() {
  const stage = useStage();

  const viewProps = {
    lo: stage.lo,
    hi: stage.hi,
    totalT: stage.totalT,
    playheadT: stage.playheadT,
  };

  const state = { channels: stage.channels, rolls: stage.rolls, lanes: stage.lanes };

  return (
    <div className="mr-shell">
      <header className="mr-titlebar">
        <Titlebar />
      </header>
      <div className="mr-body">
        <aside className="mr-sidebar">
          <span className="mr-stub">Sidebar</span>
        </aside>
        <main className="mr-center">
          <div className="mr-toolstrip">
            <span className="mr-stub">Toolstrip</span>
          </div>
          <div className="mr-timeline" data-soloing={stage.soloing ? 'true' : undefined}>
            <div
              className="mr-timeline__inner"
              style={{ width: KEYS_COLUMN_WIDTH + stage.totalT * DEFAULT_PX_PER_BEAT }}
            >
              <Ruler totalT={stage.totalT} />
              {stage.visibleChannels.map((channel) => {
                const roll = stage.rolls.find((r) => r.channelId === channel.id);
                const channelLanes = stage.lanes.filter((l) => l.channelId === channel.id);
                const isSelected = stage.selectedChannelId === channel.id;
                return (
                  <ChannelGroup
                    key={channel.id}
                    channel={channel}
                    roll={roll}
                    lanes={channelLanes}
                    state={state}
                    viewProps={viewProps}
                    isSelected={isSelected}
                    marquee={isSelected ? stage.marquee : null}
                    selectedIdx={isSelected ? stage.selectedIdx : []}
                    totalT={stage.totalT}
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
                  />
                );
              })}
            </div>
          </div>
        </main>
        <aside className="mr-inspector">
          <span className="mr-stub">Inspector</span>
        </aside>
      </div>
      <footer className="mr-statusbar">
        <span className="mr-stub">Statusbar</span>
      </footer>
      <ToastViewport />
    </div>
  );
}
