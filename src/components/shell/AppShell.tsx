import { useStage } from '../../hooks/useStage';
import { MultiTrackStage } from '../tracks/MultiTrackStage';
import { CCLanesBlock } from '../cc-lanes/CCLanesBlock';
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
          <div className="mr-timeline">
            <div
              className="mr-timeline__inner"
              style={{ width: KEYS_COLUMN_WIDTH + stage.totalT * DEFAULT_PX_PER_BEAT }}
            >
              <Ruler totalT={stage.totalT} />
              <MultiTrackStage
                tracks={stage.tracks}
                viewProps={viewProps}
                selectedTrackId={stage.selectedTrackId}
                marquee={stage.marquee}
                selectedIdx={stage.selectedIdx}
                onToggleOpen={stage.toggleTrackOpen}
                onToggleMuted={stage.toggleTrackMuted}
                onToggleSoloed={stage.toggleTrackSoloed}
              />
              <CCLanesBlock
                lanes={stage.ccLanes}
                totalT={stage.totalT}
                onToggleMuted={stage.toggleCCLaneMuted}
                onToggleSoloed={stage.toggleCCLaneSoloed}
              />
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
