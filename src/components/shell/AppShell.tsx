import './AppShell.css';

export function AppShell() {
  return (
    <div className="mr-shell">
      <header className="mr-titlebar">
        <span className="mr-stub">Titlebar</span>
      </header>
      <div className="mr-body">
        <aside className="mr-sidebar">
          <span className="mr-stub">Sidebar</span>
        </aside>
        <main className="mr-center">
          <div className="mr-toolstrip">
            <span className="mr-stub">Toolstrip</span>
          </div>
          <div className="mr-ruler">
            <span className="mr-stub">Ruler</span>
          </div>
          <div className="mr-stage">
            <span className="mr-stub">Stage</span>
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
    </div>
  );
}
