import { useStage } from '../../hooks/useStage';
import { PianoRoll } from '../piano-roll/PianoRoll';
import { Ruler } from '../ruler/Ruler';
import { Titlebar } from '../titlebar/Titlebar';
import { ToastViewport } from '../toast/Toast';
import './AppShell.css';

export function AppShell() {
  const stage = useStage();

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
          <Ruler totalT={stage.totalT} />
          <div className="mr-stage">
            <PianoRoll
              notes={stage.notes}
              lo={stage.lo}
              hi={stage.hi}
              totalT={stage.totalT}
              playheadT={stage.playheadT}
              marquee={stage.marquee}
              selectedIdx={stage.selectedIdx}
            />
          </div>
          <div className="mr-cc-lanes">
            <div className="mr-cc-slot">
              <span className="mr-stub">CC Lane 1</span>
            </div>
            <div className="mr-cc-slot">
              <span className="mr-stub">CC Lane 2</span>
            </div>
            <div className="mr-cc-slot">
              <span className="mr-stub">CC Lane 3</span>
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
