// ────────────────────────────────────────────────────────────────────────
// Design System page — tokens, type, components, spec for handoff.
// ────────────────────────────────────────────────────────────────────────

function DSPage({ width = 1440 }) {
  return (
    <div className="ds-page" data-mr-theme="console" style={{width}}>
      <header style={{display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap:24}}>
        <div>
          <p className="ds-eyebrow">MIDI Recorder · v0.4 redesign</p>
          <h1 className="ds-h1">Design system — Console (dark)</h1>
          <p style={{margin:'8px 0 0', color:'var(--mr-text-2)', fontSize:13, maxWidth:560, lineHeight:1.5}}>
            Tokens, type, and components driving the redesign. Dark-mode-first,
            studio-tool aesthetic. All values live in <code style={{fontFamily:'var(--mr-font-mono)', color:'var(--mr-text-1)'}}>tokens.css</code>.
            Components consume tokens — no hard-coded colors.
          </p>
        </div>
        <div style={{display:'flex', gap:8, fontFamily:'var(--mr-font-mono)', fontSize:10, color:'var(--mr-text-3)'}}>
          <div style={{padding:'6px 10px', border:'1px solid var(--mr-line-2)', borderRadius:'var(--mr-r-1)'}}>tokens.css · 184 vars</div>
          <div style={{padding:'6px 10px', border:'1px solid var(--mr-line-2)', borderRadius:'var(--mr-r-1)'}}>WCAG AA target</div>
        </div>
      </header>

      {/* Surfaces */}
      <section className="ds-section">
        <h2 className="ds-h2">Surfaces & lines</h2>
        <div className="ds-grid" style={{gridTemplateColumns:'repeat(6, 1fr)'}}>
          {[
            ['--mr-bg-app',      '#0a0b0d', 'app'],
            ['--mr-bg-panel',    '#111316', 'panel'],
            ['--mr-bg-panel-2',  '#16191d', 'panel-2'],
            ['--mr-bg-input',    '#0d0f12', 'input'],
            ['--mr-bg-timeline', '#0c0d0f', 'timeline'],
            ['--mr-bg-lane-odd', '#0e1013', 'lane-odd'],
          ].map(([k,v,name])=>(
            <div key={k} className="ds-swatch">
              <div className="ds-swatch__chip" style={{background:v}}></div>
              <span className="ds-swatch__name">{name}</span>
              <span className="ds-swatch__val">{k}</span>
              <span className="ds-swatch__val">{v}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Functional accents */}
      <section className="ds-section">
        <h2 className="ds-h2">Functional palette</h2>
        <p style={{margin:'-4px 0 0', color:'var(--mr-text-3)', fontSize:11}}>
          Each role binds to a single hue. Notes don't share color with record. Mute is desaturated by design.
        </p>
        <div className="ds-grid" style={{gridTemplateColumns:'repeat(8, 1fr)'}}>
          {[
            ['accent', 'oklch(72% 0.16 145)', 'primary action · play'],
            ['rec',    'oklch(64% 0.22 25)',  'record · destructive'],
            ['cue',    'oklch(80% 0.14 90)',  'cue · locator'],
            ['solo',   'oklch(82% 0.14 90)',  'solo'],
            ['note',   'oklch(68% 0.14 240)', 'MIDI notes'],
            ['cc',     'oklch(70% 0.14 310)', 'CC lanes'],
            ['pitch',  'oklch(72% 0.14 200)', 'pitch bend'],
            ['after',  'oklch(74% 0.12 30)',  'aftertouch'],
          ].map(([name, val, desc]) => (
            <div key={name} className="ds-swatch">
              <div className="ds-swatch__chip" style={{background:val, border:'1px solid var(--mr-line-2)'}}></div>
              <span className="ds-swatch__name">{name}</span>
              <span className="ds-swatch__val" style={{color:'var(--mr-text-3)'}}>{desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Type */}
      <section className="ds-section">
        <h2 className="ds-h2">Typography</h2>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:24}}>
          <div className="ds-card">
            <div className="ds-eyebrow">UI · Inter Tight</div>
            <div style={{display:'flex', flexDirection:'column', gap:8, marginTop:8}}>
              <div style={{fontSize:28, fontWeight:600, letterSpacing:'-0.01em'}}>Track properties</div>
              <div style={{fontSize:16, fontWeight:600}}>Section heading · 16/600</div>
              <div style={{fontSize:14, fontWeight:600}}>Body emphasized · 14/600</div>
              <div style={{fontSize:13}}>Body · 13/400</div>
              <div style={{fontSize:12, color:'var(--mr-text-2)'}}>Panel default · 12/400</div>
              <div style={{fontSize:11, color:'var(--mr-text-3)'}}>Hint / label · 11/400</div>
              <div style={{fontSize:10, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--mr-text-3)'}}>Eyebrow · 10/600 / 0.08em</div>
            </div>
          </div>
          <div className="ds-card">
            <div className="ds-eyebrow">Mono · JetBrains Mono</div>
            <div style={{display:'flex', flexDirection:'column', gap:8, marginTop:8, fontFamily:'var(--mr-font-mono)'}}>
              <div style={{fontSize:28, fontWeight:500, letterSpacing:'0.02em'}}>00:01:23.456</div>
              <div style={{fontSize:20}}>♩= 124 · 4/4</div>
              <div style={{fontSize:13}}>CH·1  vel 92  len 240t</div>
              <div style={{fontSize:11, color:'var(--mr-text-2)'}}>0x9F 3C 5E (note on)</div>
              <div style={{fontSize:10, color:'var(--mr-text-3)'}}>1,238 events · 1.4 MB</div>
            </div>
          </div>
        </div>
      </section>

      {/* Spacing + radii */}
      <section className="ds-section">
        <h2 className="ds-h2">Spacing & radii</h2>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:24}}>
          <div className="ds-card">
            <div className="ds-eyebrow">Spacing · 4px base</div>
            <div style={{display:'flex', alignItems:'flex-end', gap:8, marginTop:12}}>
              {[
                ['1', 2], ['2', 4], ['3', 6], ['4', 8], ['5', 12],
                ['6', 16], ['7', 20], ['8', 24], ['9', 32], ['10', 48],
              ].map(([k, v]) => (
                <div key={k} style={{display:'flex', flexDirection:'column', alignItems:'center', gap:4, minWidth:28}}>
                  <div style={{width: v, height: v, background:'var(--mr-accent)', borderRadius:1}}></div>
                  <div style={{fontFamily:'var(--mr-font-mono)', fontSize:9, color:'var(--mr-text-3)'}}>{v}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="ds-card">
            <div className="ds-eyebrow">Radii — sharp by default</div>
            <div style={{display:'flex', gap:14, marginTop:12, alignItems:'center'}}>
              {[['1', 2, 'btn/note'], ['2', 4, 'input/panel'], ['3', 6, 'card/dialog'], ['pill', 999, 'switch']].map(([k, r, lbl])=>(
                <div key={k} style={{display:'flex', flexDirection:'column', alignItems:'center', gap:6}}>
                  <div style={{width:48, height:48, background:'var(--mr-bg-panel-2)', border:'1px solid var(--mr-line-3)', borderRadius:r}}></div>
                  <div style={{fontFamily:'var(--mr-font-mono)', fontSize:9, color:'var(--mr-text-3)'}}>r-{k} · {lbl}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Interaction states */}
      <section className="ds-section">
        <h2 className="ds-h2">Interaction states · transport button</h2>
        <div style={{display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:12}}>
          {[
            ['Default',   {}],
            ['Hover',     {background:'var(--mr-bg-panel-2)', color:'var(--mr-text-1)'}],
            ['Active',    {background:'var(--mr-accent-soft)', color:'var(--mr-accent)'}],
            ['Focus',     {boxShadow:'0 0 0 2px oklch(72% 0.16 145 / 0.5)', color:'var(--mr-text-1)'}],
            ['Disabled',  {color:'var(--mr-text-4)', opacity:0.5}],
          ].map(([lbl, st]) => (
            <div key={lbl} className="ds-card" style={{display:'flex', flexDirection:'column', alignItems:'center', gap:10}}>
              <button className="mr-tbtn" style={{width:36, height:36, ...st, transition:'none'}}>
                {Icon.play}
              </button>
              <span style={{fontSize:10, color:'var(--mr-text-3)', textTransform:'uppercase', letterSpacing:'0.08em'}}>{lbl}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Component samples */}
      <section className="ds-section">
        <h2 className="ds-h2">Component primitives</h2>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14}}>
          <div className="ds-card">
            <div className="ds-eyebrow">Buttons</div>
            <div style={{display:'flex', flexDirection:'column', gap:8, marginTop:10}}>
              <button className="mr-btn" data-primary="true">Save · ⌘S</button>
              <button className="mr-btn">Cancel</button>
              <button className="mr-btn" data-danger="true">Discard</button>
            </div>
          </div>
          <div className="ds-card">
            <div className="ds-eyebrow">Chips & switches</div>
            <div style={{display:'flex', flexDirection:'column', gap:10, marginTop:10}}>
              <div style={{display:'flex', gap:4, flexWrap:'wrap'}}>
                <button className="mr-chip" data-on="true">CH 1</button>
                <button className="mr-chip" data-on="true">CH 2</button>
                <button className="mr-chip">CH 3</button>
                <button className="mr-chip">CH 4</button>
              </div>
              <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:11, color:'var(--mr-text-2)'}}>
                <span>Notes</span><div className="mr-switch" data-on="true"></div>
              </div>
              <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:11, color:'var(--mr-text-2)'}}>
                <span>SysEx</span><div className="mr-switch" data-on="false"></div>
              </div>
            </div>
          </div>
          <div className="ds-card">
            <div className="ds-eyebrow">Inputs</div>
            <div style={{display:'flex', flexDirection:'column', gap:10, marginTop:10}}>
              <input className="mr-input" defaultValue="session-2026-05-07" />
              <select className="mr-select" defaultValue="logic">
                <option value="logic">Logic Pro · Track 4</option>
              </select>
              <div style={{display:'flex', alignItems:'center', gap:8}}>
                <div className="mr-slider"><div className="mr-slider__fill" style={{width:'60%'}}></div><div className="mr-slider__thumb" style={{left:'60%'}}></div></div>
                <span style={{fontFamily:'var(--mr-font-mono)', fontSize:10, color:'var(--mr-text-3)'}}>0.60</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

window.DSPage = DSPage;
