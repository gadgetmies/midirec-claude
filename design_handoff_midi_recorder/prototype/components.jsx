// ────────────────────────────────────────────────────────────────────────
// MIDI Recorder — mock components used inside design canvas artboards.
// All shells render at fixed pixel sizes so the canvas can show them
// honestly. Theme is set per-artboard via data-mr-theme/data-mr-density
// on the root .mr-app element.
// ────────────────────────────────────────────────────────────────────────

const { useState, useEffect, useRef, useMemo } = React;

// ── Icons (sharp, console feel) ───────────────────────────────────────
const Icon = {
  play:    (<svg viewBox="0 0 14 14" fill="currentColor"><path d="M3 2v10l9-5z"/></svg>),
  pause:   (<svg viewBox="0 0 14 14" fill="currentColor"><rect x="3" y="2" width="3" height="10"/><rect x="8" y="2" width="3" height="10"/></svg>),
  stop:    (<svg viewBox="0 0 14 14" fill="currentColor"><rect x="3" y="3" width="8" height="8"/></svg>),
  rec:     (<svg viewBox="0 0 14 14" fill="currentColor"><circle cx="7" cy="7" r="4"/></svg>),
  rew:     (<svg viewBox="0 0 14 14" fill="currentColor"><path d="M2 2v10h2V2zm10 0L5 7l7 5z"/></svg>),
  ffw:     (<svg viewBox="0 0 14 14" fill="currentColor"><path d="M12 2v10h-2V2zM2 2l7 5-7 5z"/></svg>),
  cue:     (<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M7 2v10M3 7h8"/></svg>),
  loop:    (<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M3 5a3 3 0 013-3h5l-2-2m2 2l-2 2M11 9a3 3 0 01-3 3H3l2 2m-2-2l2-2"/></svg>),
  metro:   (<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M5 1h4l2 11H3z"/><path d="M5 11l4-7"/></svg>),
  mic:     (<svg viewBox="0 0 14 14" fill="currentColor"><rect x="5" y="1" width="4" height="8" rx="2"/><path fill="none" stroke="currentColor" d="M3 7v1a4 4 0 008 0V7M7 12v2"/></svg>),
  chev:    (<svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M3 2l4 3-4 3"/></svg>),
  pencil:  (<svg viewBox="0 0 12 12" fill="currentColor"><path d="M9 1l2 2-7 7H2V8z"/></svg>),
  eraser:  (<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M2 8l5-5 3 3-5 5H2z"/></svg>),
  select:  (<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M2 2l8 3-3 1-1 3z"/></svg>),
  scissor: (<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2"><circle cx="3" cy="9" r="2"/><circle cx="9" cy="9" r="2"/><path d="M4 7l6-5M8 7L2 2"/></svg>),
  zoom:    (<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="5" cy="5" r="3"/><path d="M7 7l3 3"/></svg>),
  grid:    (<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1"><path d="M1 4h10M1 8h10M4 1v10M8 1v10"/></svg>),
  knob:    (<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2"><circle cx="6" cy="6" r="4"/><path d="M6 4v2"/></svg>),
  upload:  (<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M6 9V2M3 5l3-3 3 3M2 10h8"/></svg>),
  download:(<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M6 2v7M3 6l3 3 3-3M2 10h8"/></svg>),
  filter:  (<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M1 2h10l-4 5v3l-2 1V7z"/></svg>),
  route:   (<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2"><circle cx="2.5" cy="3" r="1"/><circle cx="2.5" cy="9" r="1"/><circle cx="9.5" cy="6" r="1"/><path d="M3.5 3h2a3 3 0 013 3M3.5 9h2a3 3 0 003-3"/></svg>),
};

// ── Brand mark ────────────────────────────────────────────────────────
function Brand({ subtitle = "v0.4.2" }) {
  return (
    <div className="mr-brand">
      <div className="mr-brand__mark"></div>
      <div style={{display:'flex', flexDirection:'column', gap:1, lineHeight:1}}>
        <span className="mr-brand__name">MIDI Recorder</span>
        <span className="mr-brand__ver">{subtitle}</span>
      </div>
    </div>
  );
}

// ── Transport bar ─────────────────────────────────────────────────────
function Transport({ mode = "stop", time = "00:01:23.456", bar = "13.2.1", bpm = 124, sig = "4/4", recording = false, hideBrand = false, quantizeGrid = "1/16", quantizeOn = true }) {
  const playing = mode === "play";
  return (
    <div className="mr-transport mr-app__transport">
      {!hideBrand && <Brand />}
      <div className="mr-tgroup">
        <button className="mr-tbtn" title="Cue start">{Icon.rew}</button>
        <button className="mr-tbtn" title="Skip back">{Icon.cue}</button>
        <button className="mr-tbtn" data-on={playing}>{playing ? Icon.pause : Icon.play}</button>
        <button className="mr-tbtn" title="Stop">{Icon.stop}</button>
        <button className="mr-tbtn" data-rec="true" data-on={recording}>{Icon.rec}</button>
        <button className="mr-tbtn" title="Skip end">{Icon.ffw}</button>
      </div>
      <div className="mr-timecode">
        <span className="mr-timecode__big">{time.split(".")[0]}</span>
        <span className="mr-timecode__big" style={{color:'var(--mr-text-3)'}}>.{time.split(".")[1]}</span>
      </div>
      <div className="mr-meta-row">
        <div className="mr-meta">
          <span className="mr-meta__lbl">Bar</span>
          <span className="mr-meta__val">{bar}</span>
        </div>
        <div className="mr-meta">
          <span className="mr-meta__lbl">BPM</span>
          <span className="mr-meta__val">{bpm}</span>
        </div>
        <div className="mr-meta">
          <span className="mr-meta__lbl">Sig</span>
          <span className="mr-meta__val">{sig}</span>
        </div>
      </div>
      <div className="mr-tgroup">
        <button className="mr-tbtn" data-on={false} title="Loop">{Icon.loop}</button>
        <button className="mr-tbtn" data-on={true}  title="Metronome">{Icon.metro}</button>
      </div>
      <div className="mr-tgroup mr-quant" title="Quantize on record & edit" style={{padding:'0 6px', gap:6, alignItems:'center', position:'relative'}}>
        <span style={{fontFamily:'var(--mr-font-mono)', fontSize:9, color:'var(--mr-text-3)', textTransform:'uppercase', letterSpacing:'0.08em'}}>Q</span>
        <button className="mr-tbtn" data-on={quantizeOn} title={quantizeOn ? "Quantize on" : "Quantize off — bypass"} style={{width:18, height:18}}>
          <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M7 2v4"/><path d="M3.5 4.5a4 4 0 107 0"/></svg>
        </button>
        {/*
          Quantize grid picker — opens as a popover anchored to this button.
          Menu contents (handled by .mr-qchip styling, kept in app.css for the future popover):
            Straight: 1/4   1/8   1/16   1/32
            Triplet:  1/8T  1/16T            (italicized + dimmer + data-triplet="true")
          Triplet grids = 3-in-the-space-of-2 — for swung/triplet recordings.
          When power toggle is off, every chip fades (data-dim="true") and grid value is bypassed at record/edit time.
        */}
        <button
          className="mr-tbtn mr-quant__value"
          data-on={quantizeOn}
          data-dim={!quantizeOn}
          title={`Grid: ${quantizeGrid}${quantizeOn ? "" : " (bypassed)"} — click to change`}
          style={{width:'auto', padding:'0 8px', height:22, fontFamily:'var(--mr-font-mono)', fontSize:11, fontWeight:600, gap:4, display:'inline-flex', alignItems:'center'}}
        >
          <span>{quantizeGrid}</span>
          <svg viewBox="0 0 10 10" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" style={{opacity:0.55}}><path d="M2 4l3 3 3-3"/></svg>
        </button>
      </div>
      <div className="mr-spacer"></div>
      <div className="mr-status">
        <span className="mr-led" data-state={recording ? "rec" : (playing ? "play" : "idle")}></span>
        <span style={{color: recording ? 'var(--mr-rec)' : 'var(--mr-text-2)', fontFamily:'var(--mr-font-mono)', fontSize:11}}>
          {recording ? "REC" : (playing ? "PLAY" : "IDLE")}
        </span>
        <span style={{color:'var(--mr-text-3)', fontFamily:'var(--mr-font-mono)', fontSize:11}}>·</span>
        <span className="mr-led" data-state="midi"></span>
        <span style={{color:'var(--mr-text-2)', fontFamily:'var(--mr-font-mono)', fontSize:11}}>MIDI IN</span>
      </div>
    </div>
  );
}

// ── Sidebar (devices, filter, routing) ────────────────────────────────
function CollapseChev({ open }) {
  return (
    <span className="mr-chev" style={{transform: open ? 'rotate(90deg)' : 'rotate(0)'}}>
      {Icon.chev}
    </span>
  );
}
function PanelHead({ icon, title, count, open = true }) {
  return (
    <div className="mr-panel__head">
      <div className="mr-panel__head-l">
        <CollapseChev open={open} />
        {icon}
        <span>{title}</span>
      </div>
      {count != null && <span className="mr-panel__count">{count}</span>}
    </div>
  );
}

function Sidebar({ lanesMode = "piano", actionMap, selectedPitch }) {
  return (
    <aside className="mr-sidebar mr-app__sidebar">
      {/* Devices */}
      <div className="mr-panel" data-open="true">
        <PanelHead icon={Icon.mic} title="MIDI Inputs" count="2 / 3" />
        <div className="mr-panel__body">
          <div className="mr-dev" data-active="true">
            <span className="mr-led" data-state="midi"></span>
            <span className="mr-dev__name">Korg minilogue xd</span>
            <span className="mr-dev__ch">CH·1</span>
          </div>
          <div className="mr-dev" data-active="true">
            <span className="mr-led" data-state="midi"></span>
            <span className="mr-dev__name">Arturia KeyStep Pro</span>
            <span className="mr-dev__ch">CH·1–4</span>
          </div>
          <div className="mr-dev">
            <span className="mr-led"></span>
            <span className="mr-dev__name">IAC Driver Bus 1</span>
            <span className="mr-dev__ch">—</span>
          </div>
        </div>
      </div>

      {/* Outputs */}
      <div className="mr-panel" data-open="true">
        <PanelHead icon={Icon.route} title="MIDI Outputs" count="1" />
        <div className="mr-panel__body">
          <div className="mr-dev" data-active="true">
            <span className="mr-led" data-state="play"></span>
            <span className="mr-dev__name">Logic Pro · Track 4</span>
            <span className="mr-dev__ch">CH·1</span>
          </div>
          <div className="mr-dev">
            <span className="mr-led"></span>
            <span className="mr-dev__name">Korg minilogue xd</span>
            <span className="mr-dev__ch">CH·1</span>
          </div>
        </div>
      </div>

      {/* Action map (DJ mode) — replaces Record Filter when active */}
      {lanesMode === "actions" && (
        <ActionMapPanel actionMap={actionMap || DEFAULT_ACTION_MAP} selectedPitch={selectedPitch}/>
      )}

      {/* Record filter */}
      {lanesMode !== "actions" && <div className="mr-panel" data-open="true">
        <PanelHead icon={Icon.filter} title="Record Filter" />
        <div className="mr-panel__body">
          <div className="mr-row">
            <span className="mr-row-lbl">Notes</span>
            <div className="mr-switch" data-on="true"></div>
          </div>
          <div className="mr-row">
            <span className="mr-row-lbl">Control change</span>
            <div className="mr-switch" data-on="true"></div>
          </div>
          <div className="mr-row">
            <span className="mr-row-lbl">Pitch bend</span>
            <div className="mr-switch" data-on="true"></div>
          </div>
          <div className="mr-row">
            <span className="mr-row-lbl">Aftertouch</span>
            <div className="mr-switch" data-on="false"></div>
          </div>
          <div className="mr-row">
            <span className="mr-row-lbl">Program change</span>
            <div className="mr-switch" data-on="false"></div>
          </div>
          <div className="mr-row">
            <span className="mr-row-lbl">SysEx</span>
            <div className="mr-switch" data-on="false"></div>
          </div>
          <div style={{display:'flex', gap:4, marginTop:6, flexWrap:'wrap'}}>
            <button className="mr-chip" data-on="true">CH 1</button>
            <button className="mr-chip" data-on="true">CH 2</button>
            <button className="mr-chip">CH 3</button>
            <button className="mr-chip">CH 4</button>
            <button className="mr-chip" data-on="true">CH 10</button>
            <button className="mr-chip">+10</button>
          </div>
        </div>
      </div>}

      {/* Routing matrix */}
      <div className="mr-panel" data-open="true">
        <PanelHead icon={Icon.route} title="Routing" />
        <div className="mr-panel__body" style={{padding:'4px 12px 12px'}}>
          <RoutingMatrix />
        </div>
      </div>
    </aside>
  );
}

function RoutingMatrix() {
  const ins  = ["minilogue", "KeyStep", "IAC 1"];
  const outs = ["Logic Tr 4", "minilogue", "File"];
  const grid = [
    [1,0,0],
    [1,1,0],
    [0,0,1],
  ];
  return (
    <div style={{
      display:'grid',
      gridTemplateColumns:'70px repeat(3, 1fr)',
      fontSize: 10,
      fontFamily:'var(--mr-font-mono)',
      gap: 1,
      background: 'var(--mr-line-1)',
      padding: 1,
      borderRadius: 'var(--mr-r-1)',
    }}>
      <div></div>
      {outs.map(o => (
        <div key={o} style={{
          background:'var(--mr-bg-panel)',
          padding:'4px 6px',
          color:'var(--mr-text-2)',
          textAlign:'center',
          textTransform:'uppercase',
          fontSize:9,
          letterSpacing:'0.06em',
        }}>{o}</div>
      ))}
      {ins.map((label, ri) => (
        <React.Fragment key={label}>
          <div style={{
            background:'var(--mr-bg-panel)',
            padding:'4px 6px',
            color:'var(--mr-text-2)',
            fontSize:10,
          }}>{label}</div>
          {grid[ri].map((on, ci) => (
            <div key={ci} style={{
              background:'var(--mr-bg-panel)',
              display:'flex',
              alignItems:'center',
              justifyContent:'center',
              padding:'4px',
            }}>
              <div style={{
                width: 14, height: 14,
                borderRadius: 2,
                border: '1px solid var(--mr-line-2)',
                background: on ? 'var(--mr-accent-soft)' : 'transparent',
                position: 'relative',
              }}>
                {on === 1 && (
                  <svg viewBox="0 0 12 12" style={{position:'absolute', inset:0, color:'var(--mr-accent)'}} fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6l2 2 4-5"/>
                  </svg>
                )}
              </div>
            </div>
          ))}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Stage / timeline ──────────────────────────────────────────────────
const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const BLACK = [1,3,6,8,10];

// Pseudo-random but stable note layout (used in all themes)
function makeNotes(count = 38, seed = 7) {
  const rand = (n) => { seed = (seed * 9301 + 49297) % 233280; return (seed / 233280) * n; };
  const notes = [];
  let t = 0;
  for (let i = 0; i < count; i++) {
    const dur = 0.25 + rand(1.5);
    const pitch = 48 + Math.floor(rand(28));
    const vel = 0.45 + rand(0.55);
    notes.push({ t, dur, pitch, vel });
    t += rand(0.7) + 0.15;
  }
  return notes;
}

function PianoKeys({ height, lo = 48, hi = 76 }) {
  // hi exclusive — render from lo (low) to hi (high), bottom-up
  const range = hi - lo;
  const rowH = height / range;
  const keys = [];
  for (let p = lo; p < hi; p++) {
    const idx = p - lo;
    const top = height - (idx + 1) * rowH;
    const isBlack = BLACK.includes(p % 12);
    const name = NOTE_NAMES[p % 12] + (Math.floor(p / 12) - 1);
    keys.push(
      <div key={p} className="mr-key" data-black={isBlack}
        style={{ top, height: rowH }}>
        {(p % 12 === 0) ? name : ""}
      </div>
    );
  }
  return <div className="mr-keys" style={{height}}>{keys}</div>;
}

function PianoRoll({ width, height, notes, lo = 48, hi = 76, totalT = 16, playheadT = 6.2, accent = "note", marquee = null, selectedIdx = [7], trackColor = null }) {
  const range = hi - lo;
  const rowH = height / range;
  const px = width / totalT;
  const lanes = [];
  for (let p = lo; p < hi; p++) {
    const idx = p - lo;
    const top = height - (idx + 1) * rowH;
    const isBlack = BLACK.includes(p % 12);
    lanes.push(
      <div key={p} className="mr-lane" data-black={isBlack}
        style={{ top, height: rowH }}/>
    );
  }
  // beat tick lines
  const ticks = [];
  for (let i = 0; i <= totalT; i++) {
    ticks.push(
      <div key={i} style={{
        position:'absolute',
        top:0, bottom:0,
        left: i * px,
        width: 1,
        background: i % 4 === 0 ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.025)',
      }}/>
    );
  }
  const noteEls = notes.map((n, i) => {
    if (n.pitch < lo || n.pitch >= hi) return null;
    const idx = n.pitch - lo;
    const top = height - (idx + 1) * rowH;
    const left = n.t * px;
    const w = Math.max(2, n.dur * px);
    const sel = selectedIdx.includes(i);
    const baseColor = trackColor
      ? `color-mix(in oklab, ${trackColor} ${50 + n.vel * 50}%, transparent)`
      : (accent === "note"
          ? `oklch(68% ${0.06 + n.vel * 0.10} 240 / ${0.5 + n.vel * 0.5})`
          : `oklch(68% 0.14 240 / ${0.5 + n.vel * 0.5})`);
    return (
      <div key={i} className="mr-note" data-sel={sel}
        style={{ top: top + 1, left, width: w, height: Math.max(5, rowH - 2),
          background: sel ? 'var(--mr-note-sel)' : baseColor }}/>
    );
  });
  // Marquee rectangle: { t0, t1, p0, p1 } in time units / pitch
  let marqueeEl = null;
  let marqueeBadge = null;
  if (marquee) {
    const x0 = Math.min(marquee.t0, marquee.t1) * px;
    const x1 = Math.max(marquee.t0, marquee.t1) * px;
    const pTop = Math.max(marquee.p0, marquee.p1);
    const pBot = Math.min(marquee.p0, marquee.p1);
    const yTop = height - (pTop - lo + 1) * rowH;
    const yBot = height - (pBot - lo) * rowH;
    marqueeEl = (
      <div className="mr-marquee" style={{
        left: x0, top: yTop, width: x1 - x0, height: yBot - yTop,
      }}>
        <span className="mr-marquee__corner" data-c="tl"></span>
        <span className="mr-marquee__corner" data-c="tr"></span>
        <span className="mr-marquee__corner" data-c="bl"></span>
        <span className="mr-marquee__corner" data-c="br"></span>
      </div>
    );
    const count = selectedIdx.length;
    marqueeBadge = (
      <div className="mr-marquee__badge" style={{ left: x1 + 6, top: yTop }}>
        <span className="mr-marquee__count">{count}</span>
        <span className="mr-marquee__lbl">selected</span>
      </div>
    );
  }
  return (
    <div className="mr-roll" style={{height}}>
      <PianoKeys height={height} lo={lo} hi={hi}/>
      <div className="mr-roll__lanes">
        {lanes}
        {ticks}
        {noteEls}
        {marqueeEl}
        <div className="mr-playhead" style={{left: playheadT * px}}/>
        {marqueeBadge}
      </div>
    </div>
  );
}

function Ruler({ width, totalT = 16 }) {
  const px = width / totalT;
  const ticks = [];
  for (let i = 0; i <= totalT; i++) {
    const major = i % 4 === 0;
    ticks.push(<div key={i} className={`mr-ruler__tick ${major ? 'mr-ruler__tick--major':''}`} style={{ left: i * px }}/>);
    if (major) ticks.push(
      <div key={"l"+i} className="mr-ruler__lbl" style={{ left: i * px }}>{1 + i/4 | 0}.{(i%4)+1}</div>
    );
  }
  return <div className="mr-ruler" style={{width}}>{ticks}</div>;
}

// ── M/S chip — used by tracks, CC lanes, DJ units, and per-control rows.
// Solo composes: when ANY row in the stage is soloed, only soloed rows play.
// Mute is per-row.
function MSChip({ muted, soloed, size = "sm" }) {
  return (
    <div className="mr-ms" data-size={size}>
      <button className="mr-ms__btn" data-kind="m" data-on={!!muted} title={muted ? "Unmute" : "Mute"}>M</button>
      <button className="mr-ms__btn" data-kind="s" data-on={!!soloed} title={soloed ? "Unsolo" : "Solo"}>S</button>
    </div>
  );
}

// CC lane — discrete bars (one per grid cell). MIDI is fundamentally a stream
// of discrete commands so the lane renders one bar per 1/16 step rather than a
// pseudo-analog curve. Painting interactions:
//   • paint:    click + drag across cells  → each cell takes the cursor's Y
//   • interp:   click cell A, shift+click B → linear ramp A→B across cells
// State variations show the interactive affordances.
function CCLane({ width, name, cc, color, totalT = 16, points, resolution = 64, paint, interp, hover, muted = false, soloed = false }) {
  // Convert the input curve sample-points into discrete cell values by
  // averaging the nearest samples for each cell. Output: array of {v} length=resolution.
  const bars = useMemo(()=>{
    if (!points || !points.length) return new Array(resolution).fill(null).map(()=>({v: 0}));
    const arr = [];
    const cellT = totalT / resolution;
    for (let i = 0; i < resolution; i++) {
      const tCenter = (i + 0.5) * cellT;
      // find sample closest to tCenter
      let best = points[0], bestD = Math.abs(points[0].t - tCenter);
      for (let j = 1; j < points.length; j++) {
        const d = Math.abs(points[j].t - tCenter);
        if (d < bestD) { best = points[j]; bestD = d; }
      }
      arr.push({ v: best.v });
    }
    return arr;
  }, [points, resolution, totalT]);

  const plotW = width - 56;
  const cellW = plotW / resolution;
  // Thin tick-bars: each bar represents one discrete CC event in time, not a
  // gate-style duration. Render at 1.5px regardless of cell pitch — the cell
  // width controls how often events are spaced, not how wide each event reads.
  const innerW = 1.5;
  const trackH = 56;
  const top = 8;

  return (
    <div className="mr-cc-lane" data-muted={muted} data-soloed={soloed}>
      <div className="mr-cc-lane__hdr">
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:4}}>
          <span className="mr-cc-lane__name">{name}</span>
          <MSChip muted={muted} soloed={soloed}/>
        </div>
        <span className="mr-cc-lane__cc">CC {cc}</span>
      </div>
      <div className="mr-cc-lane__plot" data-cc-lane>
        <svg width="100%" height="72" preserveAspectRatio="none" viewBox={`0 0 ${plotW} 72`}>
          {/* mid line is provided by the lane background */}
          {bars.map((b, i) => {
            const h = b.v * trackH;
            // Center the thin bar in its cell so the event reads at its true time
            const x = i * cellW + (cellW - innerW) / 2;
            const y = top + (trackH - h);
            // Hover preview cell
            const isHover = hover != null && hover.idx === i;
            // Interp endpoints + ramp visualization
            const interpA = interp && interp.a != null && interp.a === i;
            const interpB = interp && interp.b != null && interp.b === i;
            const inInterpRange = interp && interp.a != null && interp.b != null
              && i > Math.min(interp.a, interp.b) && i < Math.max(interp.a, interp.b);
            // Paint trail
            const inPaint = paint && paint.includes(i);
            const fill = (interpA || interpB) ? 'var(--mr-accent)'
              : inInterpRange ? color
              : inPaint ? color
              : color;
            const fillOpacity = (interpA || interpB) ? 1
              : inInterpRange ? 0.95
              : inPaint ? 1
              : 0.78;
            return (
              <g key={i}>
                <rect x={x} y={y} width={innerW} height={h}
                  fill={fill} opacity={fillOpacity}
                  shapeRendering="crispEdges"/>
                {/* small dot at the value point so individual events read clearly */}
                <rect x={x - 0.5} y={y - 0.5} width={innerW + 1} height={2}
                  fill={(interpA || interpB) ? 'var(--mr-accent)' : color}
                  opacity={(interpA || interpB) ? 1 : 1}
                  shapeRendering="crispEdges"/>
              </g>
            );
          })}
          {/* hover ghost bar — full cell column tinted, thin bar previewed */}
          {hover && (() => {
            const cellX = hover.idx * cellW;
            const tickX = cellX + (cellW - innerW) / 2;
            const h = hover.v * trackH;
            const y = top + (trackH - h);
            return (
              <g>
                <rect x={cellX} y={top} width={cellW} height={trackH}
                  fill="var(--mr-accent)" opacity="0.10" shapeRendering="crispEdges"/>
                <rect x={tickX} y={y} width={innerW} height={h}
                  fill="var(--mr-accent)" opacity="0.7" shapeRendering="crispEdges"/>
              </g>
            );
          })()}
          {/* interp guide line A→B */}
          {interp && interp.a != null && interp.b != null && (() => {
            const a = interp.a, b = interp.b;
            const va = bars[a]?.v ?? 0;
            const vb = bars[b]?.v ?? 0;
            const xA = a * cellW + cellW / 2;
            const xB = b * cellW + cellW / 2;
            const yA = top + (1 - va) * trackH;
            const yB = top + (1 - vb) * trackH;
            return (
              <line x1={xA} y1={yA} x2={xB} y2={yB}
                stroke="var(--mr-accent)" strokeWidth="1" strokeDasharray="3 2"
                opacity="0.9"/>
            );
          })()}
        </svg>
        {/* paint cursor indicator */}
        {paint && paint.length > 0 && (
          <div className="mr-cc-cursor" style={{
            left: (paint[paint.length - 1] * cellW + innerW / 2) + 'px',
            top: top + 'px',
            height: trackH + 'px',
          }}>
            <span className="mr-cc-cursor__hint">PAINT</span>
          </div>
        )}
        {interp && interp.a != null && interp.b == null && (
          <div className="mr-cc-cursor" data-mode="interp" style={{
            left: (interp.a * cellW + innerW / 2) + 'px',
            top: top + 'px',
            height: trackH + 'px',
          }}>
            <span className="mr-cc-cursor__hint">⇧ + CLICK B</span>
          </div>
        )}
      </div>
    </div>
  );
}

function Toolstrip({ tool = "select", lanesMode = "piano" }) {
  return (
    <div className="mr-toolstrip">
      <div className="mr-toolstrip__group">
        <button className="mr-tool" data-on={tool==="select"}>{Icon.select}</button>
        <button className="mr-tool" data-on={tool==="pencil"}>{Icon.pencil}</button>
        <button className="mr-tool" data-on={tool==="erase"}>{Icon.eraser}</button>
        <button className="mr-tool" data-on={tool==="cut"}>{Icon.scissor}</button>
      </div>
      <div className="mr-toolstrip__group">
        <button className="mr-tool">{Icon.zoom}</button>
        <button className="mr-tool" data-on={true}>{Icon.grid}</button>
        <span style={{
          fontFamily:'var(--mr-font-mono)',
          fontSize:10, color:'var(--mr-text-3)',
          padding:'0 6px',
        }}>1/16</span>
      </div>
      <div className="mr-toolstrip__group">
        <span style={{fontFamily:'var(--mr-font-mono)',fontSize:10,color:'var(--mr-text-3)',padding:'0 6px'}}>Track</span>
        <button className="mr-chip" data-on="true">M</button>
        <button className="mr-chip">S</button>
      </div>
      <div style={{flex:1}}></div>
      <div className="mr-toolstrip__group">
        <span style={{fontFamily:'var(--mr-font-mono)',fontSize:10,color:'var(--mr-text-3)',padding:'0 6px'}}>Lanes</span>
        <button className="mr-chip" data-on={lanesMode === "piano"}>Piano</button>
        <button className="mr-chip" data-on={lanesMode === "actions"}>Actions</button>
      </div>
      <div className="mr-toolstrip__group" style={{borderRight:0}}>
        <button className="mr-tool" title="Import">{Icon.upload}</button>
        <button className="mr-tool" title="Export">{Icon.download}</button>
      </div>
    </div>
  );
}

function Stage({ width, height, recording = false, playing = true, theme = "console", lanesMode = "piano", actionMap, selectedPitch, showMapEditor = false, marquee = null, marqueeSelectedIdx }) {
  const notes = useMemo(()=>makeNotes(38, 7), []);
  // Auto-resolve which notes are inside the marquee rectangle if caller didn't pass an explicit list
  const resolvedSel = useMemo(()=>{
    if (marqueeSelectedIdx) return marqueeSelectedIdx;
    if (!marquee) return [7];
    const t0 = Math.min(marquee.t0, marquee.t1);
    const t1 = Math.max(marquee.t0, marquee.t1);
    const p0 = Math.min(marquee.p0, marquee.p1);
    const p1 = Math.max(marquee.p0, marquee.p1);
    const out = [];
    notes.forEach((n, i) => {
      const noteEnd = n.t + n.dur;
      const overlaps = noteEnd > t0 && n.t < t1;
      const inPitch = n.pitch >= p0 && n.pitch <= p1;
      if (overlaps && inPitch) out.push(i);
    });
    return out;
  }, [notes, marquee, marqueeSelectedIdx]);
  const ccPoints1 = useMemo(()=>{
    const arr = []; let v = 0.5;
    for (let i = 0; i <= 16; i += 0.5) { v = Math.max(0.1, Math.min(1, v + (Math.sin(i*1.3)*0.18))); arr.push({t:i,v}); }
    return arr;
  }, []);
  const ccPoints2 = useMemo(()=>{
    const arr = [];
    for (let i = 0; i <= 16; i += 1) { arr.push({t:i, v: 0.3 + 0.5 * Math.abs(Math.sin(i*0.6))}); }
    return arr;
  }, []);
  const ccPoints3 = useMemo(()=>{
    const arr = [{t:0,v:0.5}];
    for (let i = 0.4; i <= 16; i += 0.4) { arr.push({t:i, v: 0.5 + 0.4*Math.sin(i*2.1)}); }
    return arr;
  }, []);
  // DJ-flavored CC streams: crossfader (sweep), EQ (steppy), jog (rapid)
  const ccXfade = useMemo(()=>{
    const arr = [{t:0, v:0.5}];
    arr.push({t:2, v:0.5}, {t:3.4, v:0.0}, {t:6, v:0.0}, {t:7, v:1.0}, {t:10, v:1.0}, {t:11.4, v:0.5}, {t:16, v:0.5});
    return arr;
  }, []);
  const ccEq = useMemo(()=>{
    const arr = [];
    const steps = [0.7, 0.7, 0.7, 0.0, 0.0, 0.0, 0.0, 1.0, 1.0, 1.0, 0.6, 0.6, 0.8, 0.8, 0.8, 0.8, 0.8];
    steps.forEach((v, i) => { arr.push({t: i, v}); arr.push({t: i + 0.99, v}); });
    return arr;
  }, []);
  const ccJog = useMemo(()=>{
    const arr = [];
    for (let i = 0; i <= 16; i += 0.15) {
      const v = 0.5 + 0.45 * Math.sin(i * 4.2) * (1 - Math.abs((i - 8)/12));
      arr.push({t: i, v});
    }
    return arr;
  }, []);

  const rollH = height - 32 /*tools*/ - 28 /*ruler*/ - (3 * 72) /*cc*/ - 1;
  const am = actionMap || (typeof DEFAULT_ACTION_MAP !== 'undefined' ? DEFAULT_ACTION_MAP : {});
  const isDJ = lanesMode === "actions";

  // ── Multi-track stack (piano mode) ─────────────────────────────
  // Three default tracks, each with its own subset of notes. Track 1 expanded,
  // Tracks 2 & 3 expanded by default but collapsible. Solo on Track 2 below
  // demonstrates the soloing affordance.
  const tracks = useMemo(()=>[
    { id:"t1", name:"Lead",  ch:"CH 1", color:"oklch(72% 0.14 240)", notes: makeNotes(22, 7),  open:true,  muted:false, soloed:false },
    { id:"t2", name:"Bass",  ch:"CH 2", color:"oklch(70% 0.16 30)",  notes: makeNotes(16, 11), open:true,  muted:false, soloed:false },
    { id:"t3", name:"Pads",  ch:"CH 3", color:"oklch(74% 0.10 145)", notes: makeNotes(12, 19), open:false, muted:true,  soloed:false },
  ], []);
  const anySolo = tracks.some(t => t.soloed) || (!isDJ && false);
  const trackHdrH = 22, trackCollapsedH = 18;
  const openTracks = tracks.filter(t => t.open);
  const closedTracks = tracks.filter(t => !t.open);
  const totalChromeH = tracks.length * trackHdrH + closedTracks.length * trackCollapsedH;
  const perOpenH = openTracks.length ? Math.max(80, (rollH - totalChromeH) / openTracks.length) : 0;

  // ── DJ Units (action mode) ─────────────────────────────────────
  // Group action map entries by device, collapse into unit sections.
  const djUnits = useMemo(()=>{
    if (!isDJ) return [];
    const groups = {};
    Object.entries(am).forEach(([p, a]) => {
      const k = a.device || "global";
      (groups[k] = groups[k] || []).push({ pitch: +p, ...a });
    });
    return Object.keys(DJ_DEVICES)
      .filter(k => groups[k])
      .map(k => ({
        id: k,
        device: k,
        info: DJ_DEVICES[k],
        rows: groups[k].sort((a,b)=>a.pitch - b.pitch),
      }));
  }, [am, isDJ]);
  // Open/muted/soloed defaults for the mock — Deck 1 expanded, FX 1 soloed,
  // Deck 2 muted, others collapsed.
  const unitState = {
    deck1:  { open:true,  muted:false, soloed:false },
    deck2:  { open:true,  muted:true,  soloed:false },
    fx1:    { open:true,  muted:false, soloed:true  },
    fx2:    { open:false, muted:false, soloed:false },
    mixer:  { open:false, muted:false, soloed:false },
    global: { open:false, muted:false, soloed:false },
  };
  const anyDJSolo = djUnits.some(u => unitState[u.id]?.soloed);

  // CC mute/solo defaults for the mock
  const ccMS = {
    cc1: { muted:false, soloed:false },
    cc2: { muted:false, soloed:false },
    cc3: { muted:true,  soloed:false },
    xfade: { muted:false, soloed:true },
    eq:    { muted:false, soloed:false },
    jog:   { muted:false, soloed:false },
  };
  const anyCCSolo = Object.values(ccMS).some(x => x.soloed);
  const stageSoloing = anySolo || anyDJSolo || anyCCSolo;

  return (
    <div className="mr-stage mr-app__main" style={{width, height}} data-soloing={stageSoloing}>
      <Toolstrip lanesMode={lanesMode}/>
      <Ruler width={width} totalT={16} />
      {lanesMode === "actions" ? (
        <div style={{position:'relative', flex:'0 0 auto', overflow:'auto', maxHeight: rollH}}>
          {djUnits.map(u => {
            const st = unitState[u.id];
            const open = st.open;
            const lo = u.rows[0].pitch, hi = u.rows[u.rows.length-1].pitch + 1;
            const unitMap = {};
            u.rows.forEach(r => { unitMap[r.pitch] = r; });
            const rowH = open ? Math.max(120, u.rows.length * 18) : 0;
            return (
              <div key={u.id} className="mr-unit" data-unit-open={open}
                data-muted={st.muted} data-soloed={st.soloed}>
                <div className="mr-unit__hdr">
                  <div className="mr-unit__stripe" style={{background: u.info.color, boxShadow:`0 0 8px color-mix(in oklab, ${u.info.color} 50%, transparent)`}}></div>
                  <span className="mr-unit__chev">▾</span>
                  <span className="mr-unit__name" style={{color: u.info.color}}>{u.info.label}</span>
                  <span className="mr-unit__count">{u.rows.length} actions</span>
                  <div style={{flex:1}}></div>
                  <MSChip muted={st.muted} soloed={st.soloed}/>
                </div>
                {open && (
                  <div className="mr-unit__rows">
                    <ActionRollUnit width={width} height={rowH} rows={u.rows} unitMap={unitMap} lo={lo} hi={hi} totalT={16}
                      playheadT={recording ? 8.4 : 6.2}
                      selectedPitch={selectedPitch} unitColor={u.info.color}
                      perRowMS={u.id === "deck1"} />
                  </div>
                )}
              </div>
            );
          })}
          {showMapEditor && selectedPitch != null && (
            <MapNoteEditor pitch={selectedPitch} action={am[selectedPitch]} onClose={()=>{}}/>
          )}
        </div>
      ) : (
        <div style={{position:'relative', flex:'0 0 auto', display:'flex', flexDirection:'column'}}>
          {tracks.map((tr, ti) => {
            const open = tr.open;
            return (
              <div key={tr.id} className="mr-track" data-track-open={open}
                data-muted={tr.muted} data-soloed={tr.soloed}
                style={{flex: open ? '0 0 auto' : '0 0 auto'}}>
                <div className="mr-track__hdr">
                  <span className="mr-track__chev">▾</span>
                  <span className="mr-track__swatch" style={{background: tr.color, color: tr.color}}></span>
                  <span className="mr-track__name">{tr.name}</span>
                  <span className="mr-track__sub">{tr.ch} · {tr.notes.length} notes</span>
                  <div className="mr-track__spacer"></div>
                  <MSChip muted={tr.muted} soloed={tr.soloed}/>
                </div>
                {open ? (
                  <div className="mr-track__roll" style={{height: perOpenH}}>
                    <PianoRoll width={width} height={perOpenH} notes={tr.notes} lo={48} hi={76} totalT={16}
                      playheadT={recording ? 8.4 : 6.2}
                      marquee={ti === 0 ? marquee : null}
                      selectedIdx={ti === 0 ? resolvedSel : []}
                      trackColor={tr.color}/>
                  </div>
                ) : (
                  <div className="mr-track__collapsed">
                    <span>collapsed</span>
                    <div className="mr-track__minimap">
                      {tr.notes.slice(0, 24).map((n, i) => (
                        <span key={i} style={{
                          position:'absolute',
                          left: (n.t / 16) * 100 + '%',
                          width: Math.max(2, (n.dur / 16) * 100) + '%',
                          top: 1, bottom: 1,
                          background: tr.color,
                          opacity: 0.5 + n.vel * 0.4,
                          borderRadius: 1,
                        }}></span>
                      ))}
                    </div>
                    <span>{tr.notes.length} events · 4 bars</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <div className="mr-cc-lanes">
        {isDJ ? (
          <>
            <CCLane width={width} name="Crossfader" cc="31" color="oklch(70% 0.06 240)"   points={ccXfade} muted={ccMS.xfade.muted} soloed={ccMS.xfade.soloed}/>
            <CCLane width={width} name="EQ Low · A" cc="22" color="oklch(70% 0.20 30)"    points={ccEq}    muted={ccMS.eq.muted}    soloed={ccMS.eq.soloed}/>
            <CCLane width={width} name="Jog · A"    cc="48" color="oklch(72% 0.16 200)"   points={ccJog}   muted={ccMS.jog.muted}   soloed={ccMS.jog.soloed}/>
          </>
        ) : (
          <>
            <CCLane width={width} name="Mod Wheel"   cc="01"  color="var(--mr-cc)"    points={ccPoints1} muted={ccMS.cc1.muted} soloed={ccMS.cc1.soloed}/>
            <CCLane width={width} name="Pitch Bend"  cc="PB"  color="var(--mr-pitch)" points={ccPoints2} muted={ccMS.cc2.muted} soloed={ccMS.cc2.soloed}/>
            <CCLane width={width} name="Velocity"    cc="VEL" color="var(--mr-aftertouch)" points={ccPoints3} muted={ccMS.cc3.muted} soloed={ccMS.cc3.soloed}/>
          </>
        )}
      </div>
    </div>
  );
}

// ── Inspector ─────────────────────────────────────────────────────────
function Inspector({ lanesMode = "piano", selectedPitch = 57, multiSelectCount = 0 }) {
  const action = lanesMode === "actions" && typeof DEFAULT_ACTION_MAP !== 'undefined'
    ? DEFAULT_ACTION_MAP[selectedPitch] : null;
  const actionColor = action ? devColor(action.device) : null;
  const actionDevLabel = action ? devLabel(action.device) : null;
  return (
    <aside className="mr-inspector mr-app__inspector">
      <div className="mr-insp-tabs">
        <span className="mr-insp-tab" data-on="true">{lanesMode === "actions" ? "Action" : "Note"}</span>
        <span className="mr-insp-tab">Track</span>
        <span className="mr-insp-tab">File</span>
      </div>
      <div style={{padding:'12px 16px', display:'flex', flexDirection:'column', gap:14, overflow:'auto'}}>
        {multiSelectCount > 0 ? (
          <section style={{display:'flex', flexDirection:'column', gap:10}}>
            <div style={{display:'flex', alignItems:'center', gap:10}}>
              <div style={{
                width:28, height:28, borderRadius:2,
                background:'repeating-linear-gradient(135deg, var(--mr-note-sel), var(--mr-note-sel) 4px, color-mix(in oklab, var(--mr-note-sel) 60%, transparent) 4px, color-mix(in oklab, var(--mr-note-sel) 60%, transparent) 8px)',
                boxShadow: `0 0 0 1px var(--mr-accent), 0 0 14px color-mix(in oklab, var(--mr-accent) 40%, transparent)`
              }}></div>
              <div>
                <div style={{fontSize:13, fontWeight:600}}>{multiSelectCount} notes selected</div>
                <div style={{fontFamily:'var(--mr-font-mono)', fontSize:10, color:'var(--mr-text-3)'}}>multi · 4 pitches · 3 bars</div>
              </div>
            </div>
            <div className="mr-kv"><span className="mr-kv__k">Range</span><span className="mr-kv__v">02.1.1 → 04.4.4</span></div>
            <div className="mr-kv"><span className="mr-kv__k">Pitches</span><span className="mr-kv__v">C4 · D4 · F4 · A4</span></div>
            <div className="mr-kv"><span className="mr-kv__k">Velocity</span>
              <div style={{display:'flex', alignItems:'center', gap:8}}>
                <div className="mr-slider" data-mixed="true">
                  <div className="mr-slider__fill" style={{width:'68%'}}></div>
                  <div className="mr-slider__thumb" style={{left:'68%'}}></div>
                </div>
                <span className="mr-kv__v" style={{minWidth:32, fontFamily:'var(--mr-font-mono)'}}>~ 84</span>
              </div>
            </div>
            <div className="mr-kv"><span className="mr-kv__k">Length</span><span className="mr-kv__v" style={{fontStyle:'italic', color:'var(--mr-text-3)'}}>mixed (0.12 – 0.75s)</span></div>
            <div className="mr-kv"><span className="mr-kv__k">Channel</span><span className="mr-kv__v">CH 1</span></div>
            <div style={{height:1, background:'var(--mr-line-1)', marginTop:4}}></div>
            <div className="ds-eyebrow" style={{margin:0}}>Bulk actions</div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:6}}>
              <button className="mr-btn" style={{height:26, padding:'0 8px', fontSize:10}}>Quantize</button>
              <button className="mr-btn" style={{height:26, padding:'0 8px', fontSize:10}}>Nudge ←→</button>
              <button className="mr-btn" style={{height:26, padding:'0 8px', fontSize:10}}>Transpose</button>
              <button className="mr-btn" style={{height:26, padding:'0 8px', fontSize:10}}>Velocity ±</button>
              <button className="mr-btn" style={{height:26, padding:'0 8px', fontSize:10, gridColumn:'1 / -1'}}>Duplicate</button>
              <button className="mr-btn" data-danger="true" style={{height:26, padding:'0 8px', fontSize:10, gridColumn:'1 / -1'}}>Delete {multiSelectCount}</button>
            </div>
          </section>
        ) : lanesMode === "actions" && action ? (
          <section style={{display:'flex', flexDirection:'column', gap:8}}>
            <div style={{display:'flex', alignItems:'center', gap:10}}>
              <div style={{width: 28, height: 28, background: actionColor, borderRadius: 2, boxShadow: `0 0 12px color-mix(in oklab, ${actionColor} 50%, transparent)`}}></div>
              <div>
                <div style={{fontSize:13, fontWeight:600}}>{action.label}</div>
                <div style={{fontFamily:'var(--mr-font-mono)', fontSize:10, color:'var(--mr-text-3)'}}>{actionDevLabel} · {pitchLabel(selectedPitch)} · note {selectedPitch}</div>
              </div>
            </div>
            <div className="mr-kv"><span className="mr-kv__k">Bound to</span><span className="mr-kv__v" style={{color: actionColor}}>{action.short}</span></div>
            <div className="mr-kv"><span className="mr-kv__k">Device</span><span className="mr-kv__v" style={{color: actionColor}}>{actionDevLabel}</span></div>
            <div className="mr-kv"><span className="mr-kv__k">Trigger</span><span className="mr-kv__v">momentary</span></div>
            <div className="mr-kv"><span className="mr-kv__k">Velocity</span>
              <div style={{display:'flex', alignItems:'center', gap:8}}>
                <div className="mr-slider"><div className="mr-slider__fill" style={{width:'72%', background: actionColor}}></div><div className="mr-slider__thumb" style={{left:'72%'}}></div></div>
                <span className="mr-kv__v" style={{minWidth:24, fontFamily:'var(--mr-font-mono)'}}>92</span>
              </div>
            </div>
            {action.pressure && (
              <>
                <div style={{height:1, background:'var(--mr-line-1)', marginTop:6}}></div>
                <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                  <div className="ds-eyebrow" style={{margin:0}}>Pressure</div>
                  <span style={{
                    fontFamily:'var(--mr-font-mono)', fontSize:8, fontWeight:700,
                    color:'#fff', background:`color-mix(in oklab, ${actionColor} 50%, transparent)`,
                    padding:'1px 4px', borderRadius:1, letterSpacing:'0.04em',
                  }}>AT</span>
                </div>
                {/* Mini pressure editor — same discrete-bar render as CC lanes */}
                <div style={{
                  position:'relative',
                  height: 64,
                  background:'var(--mr-bg-app)',
                  border:'1px solid var(--mr-line-1)',
                  borderRadius:'var(--mr-r-1)',
                  overflow:'hidden',
                }}>
                  <svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 256 64">
                    {/* mid line */}
                    <line x1="0" y1="32" x2="256" y2="32" stroke="rgba(255,255,255,0.06)" strokeWidth="1"/>
                    {Array.from({length: 16}).map((_, i) => {
                      // demo curve — rises and falls
                      const u = i / 15;
                      const v = Math.max(0.06, Math.sin(u * Math.PI) * 0.85);
                      const cellW = 256 / 16;
                      const x = i * cellW + cellW * 0.3;
                      const barH = v * 56;
                      return (
                        <g key={i}>
                          <rect x={x} y={64 - barH - 4} width={cellW * 0.4} height={barH}
                            fill={actionColor} opacity="0.85" shapeRendering="crispEdges"/>
                          <rect x={x - 0.5} y={64 - barH - 5} width={cellW * 0.4 + 1} height="1.5"
                            fill={actionColor} shapeRendering="crispEdges"/>
                        </g>
                      );
                    })}
                  </svg>
                </div>
                <div style={{display:'flex', justifyContent:'space-between', fontFamily:'var(--mr-font-mono)', fontSize:9, color:'var(--mr-text-3)'}}>
                  <span>14 events</span>
                  <span>peak 0.86 · avg 0.54</span>
                </div>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4}}>
                  <button className="mr-btn" style={{height:22, padding:'0 6px', fontSize:9}}>Smooth</button>
                  <button className="mr-btn" style={{height:22, padding:'0 6px', fontSize:9}}>Flatten</button>
                  <button className="mr-btn" style={{height:22, padding:'0 6px', fontSize:9}}>Clear</button>
                </div>
                <div style={{display:'flex', gap:4}}>
                  <button className="mr-chip" data-on="true" style={{flex:1}}>Curve</button>
                  <button className="mr-chip" style={{flex:1}}>Step</button>
                </div>
              </>
            )}
            <div style={{display:'flex', gap:6, marginTop:6}}>
              <button className="mr-btn" style={{height:24, padding:'0 10px', fontSize:10, flex:1}}>Remap…</button>
              <button className="mr-btn" data-danger="true" style={{height:24, padding:'0 10px', fontSize:10}}>Clear</button>
            </div>
          </section>
        ) : (
        <section style={{display:'flex', flexDirection:'column', gap:8}}>
          <div style={{display:'flex', alignItems:'center', gap:10}}>
            <div style={{width: 28, height: 28, background:'var(--mr-note-sel)', borderRadius: 2}}></div>
            <div>
              <div style={{fontSize:13, fontWeight:600}}>D♯4</div>
              <div style={{fontFamily:'var(--mr-font-mono)', fontSize:10, color:'var(--mr-text-3)'}}>id 0x2F · note 63</div>
            </div>
          </div>
          <div className="mr-kv"><span className="mr-kv__k">Start</span><span className="mr-kv__v">02.3.4 · 240t</span></div>
          <div className="mr-kv"><span className="mr-kv__k">Length</span><span className="mr-kv__v">0.500s · ♩</span></div>
          <div className="mr-kv"><span className="mr-kv__k">Velocity</span>
            <div style={{display:'flex', alignItems:'center', gap:8}}>
              <div className="mr-slider"><div className="mr-slider__fill" style={{width:'72%'}}></div><div className="mr-slider__thumb" style={{left:'72%'}}></div></div>
              <span className="mr-kv__v" style={{minWidth:24}}>92</span>
            </div>
          </div>
          <div className="mr-kv"><span className="mr-kv__k">Channel</span><span className="mr-kv__v">CH 1</span></div>
        </section>
        )}
      </div>
    </aside>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────
function Toast({ children = "Recording saved · 1.4 MB · 1,238 events" }) {
  return (
    <div className="mr-toast">
      <span className="mr-toast__dot"></span>
      <span style={{color:'var(--mr-text-1)', fontSize: 11}}>{children}</span>
      <span style={{color:'var(--mr-text-3)', fontFamily:'var(--mr-font-mono)', fontSize:10}}>⌘Z</span>
    </div>
  );
}

// ── Dialog (Export) ───────────────────────────────────────────────────
function ExportDialog() {
  return (
    <div className="mr-dialog-scrim">
      <div className="mr-dialog">
        <div className="mr-dialog__hd">
          <h3>Export recording</h3>
          <p>Choose format · 4 bars · 2 tracks · 1,238 events</p>
        </div>
        <div className="mr-dialog__body">
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
            <label style={{
              border:'1px solid var(--mr-accent)',
              borderRadius:'var(--mr-r-2)',
              padding:'10px 12px',
              background:'var(--mr-accent-soft)',
              display:'flex', flexDirection:'column', gap:2, cursor:'pointer'
            }}>
              <span style={{fontSize:11, fontWeight:600}}>Standard MIDI File</span>
              <span style={{fontSize:10, color:'var(--mr-text-3)', fontFamily:'var(--mr-font-mono)'}}>.mid · type 1</span>
            </label>
            <label style={{
              border:'1px solid var(--mr-line-2)',
              borderRadius:'var(--mr-r-2)',
              padding:'10px 12px',
              display:'flex', flexDirection:'column', gap:2, cursor:'pointer'
            }}>
              <span style={{fontSize:11, fontWeight:600}}>NDJSON</span>
              <span style={{fontSize:10, color:'var(--mr-text-3)', fontFamily:'var(--mr-font-mono)'}}>.ndjson · raw events</span>
            </label>
          </div>
          <div className="mr-row">
            <span className="mr-row-lbl">Filename</span>
            <input className="mr-input" defaultValue="session-2026-05-07.mid" style={{flex:2}}/>
          </div>
          <div className="mr-row">
            <span className="mr-row-lbl">Quantize on export</span>
            <div className="mr-switch" data-on="false"></div>
          </div>
          <div className="mr-row">
            <span className="mr-row-lbl">Include CC lanes</span>
            <div className="mr-switch" data-on="true"></div>
          </div>
        </div>
        <div className="mr-dialog__ft">
          <button className="mr-btn">Cancel</button>
          <button className="mr-btn" data-primary="true">Save · ⌘S</button>
        </div>
      </div>
    </div>
  );
}

// ── Full app shell — used per direction artboard ──────────────────────
function AppShell({ width, height, theme = "console", density = "balanced", state = "play", showToast = false, showDialog = false, accentH, lanesMode = "piano", selectedPitch = 57, showMapEditor = false, marquee = null, marqueeSelectedIdx, multiSelectInspector = false }) {
  // Pre-compute selection from marquee for the inspector multi-select count
  const computedSel = useMemo(()=>{
    if (marqueeSelectedIdx) return marqueeSelectedIdx;
    if (!marquee) return null;
    const notes = makeNotes(38, 7);
    const t0 = Math.min(marquee.t0, marquee.t1);
    const t1 = Math.max(marquee.t0, marquee.t1);
    const p0 = Math.min(marquee.p0, marquee.p1);
    const p1 = Math.max(marquee.p0, marquee.p1);
    const out = [];
    notes.forEach((n, i) => {
      if ((n.t + n.dur) > t0 && n.t < t1 && n.pitch >= p0 && n.pitch <= p1) out.push(i);
    });
    return out;
  }, [marquee, marqueeSelectedIdx]);
  const multiCount = multiSelectInspector ? (computedSel ? computedSel.length : 0) : 0;
  const styleVars = accentH ? { '--mr-accent-h': accentH,
    '--mr-accent':       `oklch(72% 0.16 ${accentH})`,
    '--mr-accent-hover': `oklch(78% 0.16 ${accentH})`,
    '--mr-accent-soft':  `oklch(72% 0.16 ${accentH} / 0.16)`,
  } : {};
  return (
    <div className="mr-app"
      data-mr-theme={theme}
      data-mr-density={density === "balanced" ? undefined : density}
      style={{width, height, ...styleVars}}>
      <Transport
        mode={state === "play" || state === "rec" ? "play" : "stop"}
        recording={state === "rec"}
        time={state === "rec" ? "00:00:08.420" : "00:01:23.456"}
        bar={state === "rec" ? "03.1.1" : "13.2.1"}
      />
      <Sidebar lanesMode={lanesMode} selectedPitch={selectedPitch}/>
      <Stage width={width - 280 - 320} height={height - 44}
        recording={state === "rec"} playing={state === "play"} theme={theme}
        lanesMode={lanesMode} selectedPitch={selectedPitch} showMapEditor={showMapEditor}
        marquee={marquee} marqueeSelectedIdx={computedSel}/>
      <Inspector lanesMode={lanesMode} selectedPitch={selectedPitch} multiSelectCount={multiCount}/>
      {showToast && <Toast />}
      {showDialog && <ExportDialog />}
    </div>
  );
}

// Expose to other Babel scripts.
Object.assign(window, {
  Icon, Brand, Transport, Sidebar, RoutingMatrix,
  Stage, PianoRoll, Ruler, CCLane, Toolstrip,
  Inspector, Toast, ExportDialog, AppShell,
});
