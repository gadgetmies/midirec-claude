// ────────────────────────────────────────────────────────────────────────
// DJ Action Map — alternate left-rail labels for the piano roll.
// Each MIDI note (pitch) can be mapped to a DJ action. When the lanes
// rail is in "actions" mode, the keys column shows the mapped action
// names instead of note names, and notes in the roll inherit the action
// category color.
// ────────────────────────────────────────────────────────────────────────

// Action categories — used for grouping/labeling only.
const DJ_CATEGORIES = {
  transport: { label: "Transport" },
  cue:       { label: "Cue"       },
  hotcue:    { label: "Hot Cue"   },
  loop:      { label: "Loop"      },
  fx:        { label: "FX"        },
  deck:      { label: "Deck"      },
  mixer:     { label: "Mixer"     },
};

// Devices — drive color. Each device == a controller surface (deck, fx unit, mixer, global).
const DJ_DEVICES = {
  "deck1":  { label: "Deck 1",   short: "D1", color: "oklch(72% 0.16 200)" }, // teal-cyan
  "deck2":  { label: "Deck 2",   short: "D2", color: "oklch(70% 0.20 30)"  }, // coral-red
  "deck3":  { label: "Deck 3",   short: "D3", color: "oklch(76% 0.16 145)" }, // green
  "deck4":  { label: "Deck 4",   short: "D4", color: "oklch(74% 0.16 80)"  }, // amber-yellow
  "fx1":    { label: "FX 1",     short: "FX1", color: "oklch(72% 0.18 310)" }, // magenta
  "fx2":    { label: "FX 2",     short: "FX2", color: "oklch(70% 0.16 270)" }, // violet
  "mixer":  { label: "Mixer",    short: "MX",  color: "oklch(78% 0.06 240)" }, // cool gray-blue
  "global": { label: "Global",   short: "GL",  color: "oklch(70% 0.04 80)"  }, // warm neutral
};

function devColor(device) { return (DJ_DEVICES[device] || DJ_DEVICES.global).color; }
function devShort(device) { return (DJ_DEVICES[device] || DJ_DEVICES.global).short; }
function devLabel(device) { return (DJ_DEVICES[device] || DJ_DEVICES.global).label; }

// Default action map. Pitch → action.
const DEFAULT_ACTION_MAP = {
  // Deck 1
  48: { id: "play",      cat: "transport", label: "Play / Pause", short: "PLAY",   device: "deck1" },
  49: { id: "cue",       cat: "cue",       label: "Cue",          short: "CUE",    device: "deck1" },
  50: { id: "sync",      cat: "transport", label: "Sync",         short: "SYNC",   device: "deck1" },
  51: { id: "rev",       cat: "transport", label: "Reverse",      short: "REV",    device: "deck1" },
  52: { id: "loop_in",   cat: "loop",      label: "Loop In",      short: "L·IN",   device: "deck1" },
  53: { id: "loop_out",  cat: "loop",      label: "Loop Out",     short: "L·OUT",  device: "deck1" },
  54: { id: "loop_x2",   cat: "loop",      label: "Loop ×2",      short: "L×2",    device: "deck1" },
  55: { id: "loop_half", cat: "loop",      label: "Loop ÷2",      short: "L÷2",    device: "deck1" },
  56: { id: "hc1", cat: "hotcue", label: "Hot Cue 1", short: "HC1", device: "deck1", pad: true, pressure: true },
  57: { id: "hc2", cat: "hotcue", label: "Hot Cue 2", short: "HC2", device: "deck1", pad: true },
  58: { id: "hc3", cat: "hotcue", label: "Hot Cue 3", short: "HC3", device: "deck1", pad: true },
  59: { id: "hc4", cat: "hotcue", label: "Hot Cue 4", short: "HC4", device: "deck1", pad: true },
  // FX 1
  60: { id: "fx1_on",  cat: "fx", label: "FX 1 On",    short: "ON",    device: "fx1" },
  61: { id: "fx1_beat",cat: "fx", label: "FX 1 Beats", short: "BEATS", device: "fx1" },
  62: { id: "fx1_dry", cat: "fx", label: "FX 1 Dry/Wet", short: "D/W", device: "fx1" },
  // FX 2
  63: { id: "fx2_on",  cat: "fx", label: "FX 2 On",    short: "ON",    device: "fx2" },
  64: { id: "fx2_beat",cat: "fx", label: "FX 2 Beats", short: "BEATS", device: "fx2" },
  // Deck 2
  65: { id: "play_b",   cat: "transport", label: "Play / Pause",  short: "PLAY",  device: "deck2" },
  66: { id: "cue_b",    cat: "cue",       label: "Cue",           short: "CUE",   device: "deck2" },
  67: { id: "sync_b",   cat: "transport", label: "Sync",          short: "SYNC",  device: "deck2" },
  68: { id: "loop_in_b",cat: "loop",      label: "Loop In",       short: "L·IN",  device: "deck2" },
  69: { id: "hc1_b",    cat: "hotcue",    label: "Hot Cue 1",     short: "HC1",   device: "deck2" },
  70: { id: "hc2_b",    cat: "hotcue",    label: "Hot Cue 2",     short: "HC2",   device: "deck2" },
  // Mixer
  71: { id: "xfade_a",  cat: "mixer", label: "Crossfade ◀", short: "X◀", device: "mixer" },
  72: { id: "xfade_b",  cat: "mixer", label: "Crossfade ▶", short: "X▶", device: "mixer" },
  73: { id: "load_a",   cat: "deck",  label: "Load Deck 1", short: "LD·1", device: "mixer" },
  74: { id: "load_b",   cat: "deck",  label: "Load Deck 2", short: "LD·2", device: "mixer" },
  // Global
  75: { id: "tap",      cat: "transport", label: "Tap Tempo",  short: "TAP",  device: "global" },
};

// Pitch → MIDI note label (e.g. 60 → "C3")
function pitchLabel(p) {
  return NOTE_NAMES[p % 12] + (Math.floor(p / 12) - 1);
}

// ── Action rail (replaces piano keys in actions mode) ─────────────────
function ActionKeys({ height, lo = 48, hi = 76, actionMap, selectedPitch }) {
  const range = hi - lo;
  const rowH = height / range;
  const rows = [];
  for (let p = lo; p < hi; p++) {
    const idx = p - lo;
    const top = height - (idx + 1) * rowH;
    const action = actionMap[p];
    const color = action ? devColor(action.device) : null;
    const isSel = p === selectedPitch;
    rows.push(
      <div key={p} className={"mr-actkey" + (isSel ? " is-sel" : "")}
        style={{
          top, height: rowH,
          borderLeft: color ? `3px solid ${color}` : `3px solid transparent`,
        }}>
        <div className="mr-actkey__l">
          {action ? (
            <>
              <span className="mr-actkey__short" style={{color}}>{action.short}</span>
              <span className="mr-actkey__label">{action.label}</span>
            </>
          ) : (
            <span className="mr-actkey__unmapped">— unmapped —</span>
          )}
        </div>
        <div className="mr-actkey__r">
          {action && (
            <span className="mr-actkey__deck"
              style={{color, borderColor: `color-mix(in oklab, ${color} 40%, transparent)`}}>
              {devShort(action.device)}
            </span>
          )}
          <span className="mr-actkey__note">{pitchLabel(p)}</span>
        </div>
      </div>
    );
  }
  return (
    <div className="mr-keys mr-keys--actions" style={{height, width: 192}}>
      {rows}
    </div>
  );
}

// ── Action-mode piano roll (notes colored by category) ────────────────
function ActionRoll({ width, height, notes, lo = 48, hi = 76, totalT = 16, playheadT = 6.2, actionMap, selectedPitch }) {
  const range = hi - lo;
  const rowH = height / range;
  const px = width / totalT;
  const lanes = [];
  for (let p = lo; p < hi; p++) {
    const idx = p - lo;
    const top = height - (idx + 1) * rowH;
    const action = actionMap[p];
    const color = action ? devColor(action.device) : null;
    const isSel = p === selectedPitch;
    lanes.push(
      <div key={p} className="mr-lane mr-lane--action" data-mapped={!!action} data-sel={isSel}
        style={{
          top, height: rowH,
          background: isSel
            ? `color-mix(in oklab, ${color || 'transparent'} 14%, transparent)`
            : (action ? 'rgba(255,255,255,0.012)' : 'rgba(0,0,0,0.25)'),
          borderTop: isSel && color ? `1px solid ${color}` : undefined,
          borderBottom: isSel && color ? `1px solid ${color}` : undefined,
        }}/>
    );
  }
  // ticks
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
  // notes — colored by category
  const noteEls = notes.map((n, i) => {
    if (n.pitch < lo || n.pitch >= hi) return null;
    const idx = n.pitch - lo;
    const top = height - (idx + 1) * rowH;
    const left = n.t * px;
    const action = actionMap[n.pitch];
    const color = action ? devColor(action.device) : 'var(--mr-note)';
    const isTrigger = action && (action.cat === "cue" || action.cat === "hotcue" || action.cat === "transport");
    const w = isTrigger ? 6 : Math.max(3, n.dur * px);
    const sel = i === 7;
    return (
      <div key={i}
        className={"mr-note mr-note--action" + (isTrigger ? " is-trig" : "")}
        data-sel={sel}
        title={action ? `${action.label} · ${devLabel(action.device)} · ${pitchLabel(n.pitch)}` : pitchLabel(n.pitch)}
        style={{
          top: top + 1, left, width: w, height: Math.max(5, rowH - 2),
          background: isTrigger ? color : `color-mix(in oklab, ${color} ${40 + n.vel * 50}%, transparent)`,
          borderRadius: isTrigger ? 1 : 2,
          boxShadow: sel
            ? `inset 0 0 0 0.5px rgba(255,255,255,0.5), 0 0 0 1px ${color}`
            : (isTrigger
                ? `0 0 6px color-mix(in oklab, ${color} 60%, transparent)`
                : 'inset 0 0 0 0.5px rgba(255,255,255,0.2), inset 0 -2px 0 rgba(0,0,0,0.18)'),
        }}/>
    );
  });
  return (
    <div className="mr-roll" style={{height}}>
      <ActionKeys height={height} lo={lo} hi={hi} actionMap={actionMap} selectedPitch={selectedPitch}/>
      <div className="mr-roll__lanes">
        {lanes}
        {ticks}
        {noteEls}
        <div className="mr-playhead" style={{left: playheadT * px}}/>
      </div>
    </div>
  );
}

// ── "Map note" inline editor — opens when a row is selected in actions mode
function MapNoteEditor({ pitch, action, onClose }) {
  const cat = action ? DJ_CATEGORIES[action.cat] : DJ_CATEGORIES.transport;
  return (
    <div style={{
      position:'absolute',
      top: 12, right: 12,
      width: 280,
      background: 'var(--mr-bg-panel)',
      border: '1px solid var(--mr-line-2)',
      borderRadius: 'var(--mr-r-3)',
      boxShadow: 'var(--mr-shadow-md)',
      padding: 14,
      display: 'flex', flexDirection: 'column', gap: 10,
      zIndex: 6,
      fontSize: 11,
    }}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <div className="ds-eyebrow" style={{margin:0}}>Map note</div>
        <span style={{fontFamily:'var(--mr-font-mono)', fontSize:10, color:'var(--mr-text-3)'}}>
          {pitchLabel(pitch)} · note {pitch}
        </span>
      </div>
      <div style={{display:'flex', flexDirection:'column', gap:4}}>
        <span style={{color:'var(--mr-text-3)', fontSize:10, textTransform:'uppercase', letterSpacing:'0.08em'}}>Category</span>
        <div style={{display:'flex', gap:4, flexWrap:'wrap'}}>
          {Object.entries(DJ_CATEGORIES).map(([k, c]) => (
            <button key={k}
              className="mr-chip"
              data-on={action && action.cat === k}
              style={action && action.cat === k ? { borderColor: c.color, color: c.color, background: `color-mix(in oklab, ${c.color} 14%, transparent)` } : {}}>
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{display:'flex', flexDirection:'column', gap:4}}>
        <span style={{color:'var(--mr-text-3)', fontSize:10, textTransform:'uppercase', letterSpacing:'0.08em'}}>Action</span>
        <select className="mr-select" defaultValue={action ? action.id : ""} style={{width:'100%'}}>
          <option value="">— unmapped —</option>
          <option value="play">Play / Pause</option>
          <option value="cue">Cue</option>
          <option value="sync">Sync</option>
          <option value="loop_in">Loop In</option>
          <option value="loop_out">Loop Out</option>
          <option value="hc1">Hot Cue 1</option>
          <option value="hc2">Hot Cue 2</option>
          <option value="fx1_on">FX 1 On</option>
        </select>
      </div>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
        <div style={{display:'flex', flexDirection:'column', gap:4}}>
          <span style={{color:'var(--mr-text-3)', fontSize:10, textTransform:'uppercase', letterSpacing:'0.08em'}}>Deck</span>
          <select className="mr-select" defaultValue={action ? action.deck : "—"}>
            <option>A</option><option>B</option><option>—</option>
          </select>
        </div>
        <div style={{display:'flex', flexDirection:'column', gap:4}}>
          <span style={{color:'var(--mr-text-3)', fontSize:10, textTransform:'uppercase', letterSpacing:'0.08em'}}>Trigger</span>
          <select className="mr-select" defaultValue="momentary">
            <option>momentary</option>
            <option>toggle</option>
          </select>
        </div>
      </div>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:4}}>
        <button className="mr-btn" style={{height:24, padding:'0 8px', fontSize:10}}>Learn</button>
        <div style={{display:'flex', gap:6}}>
          <button className="mr-btn" style={{height:24, padding:'0 10px', fontSize:10}} onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

// ── Sidebar panel: "Action Map" — lists all bindings, grouped ─────────
function ActionMapPanel({ actionMap, selectedPitch }) {
  // Group entries by device for display.
  const groups = {};
  Object.entries(actionMap).forEach(([p, a]) => {
    const k = a.device || "global";
    (groups[k] = groups[k] || []).push({ pitch: +p, ...a });
  });
  // Preserve a stable device order matching DJ_DEVICES keys.
  const orderedKeys = Object.keys(DJ_DEVICES).filter(k => groups[k]);
  return (
    <div className="mr-panel" data-open="true">
      <PanelHead icon={Icon.knob} title="Action Map" count={`${Object.keys(actionMap).length}`} />
      <div className="mr-panel__body" style={{gap: 8}}>
        {orderedKeys.map(devK => {
          const dev = DJ_DEVICES[devK];
          const items = groups[devK];
          return (
            <div key={devK} style={{display:'flex', flexDirection:'column', gap:2}}>
              <div style={{
                display:'flex', alignItems:'center', gap:6,
                fontSize:9, textTransform:'uppercase', letterSpacing:'0.08em',
                color: 'var(--mr-text-3)',
              }}>
                <span style={{
                  width:6, height:6, borderRadius:1,
                  background: dev.color,
                  boxShadow:`0 0 6px color-mix(in oklab, ${dev.color} 50%, transparent)`,
                }}></span>
                {dev.label}
                <span style={{flex:1}}></span>
                <span style={{fontFamily:'var(--mr-font-mono)'}}>{items.length}</span>
              </div>
              {items.map(it => (
                <div key={it.pitch}
                  className="mr-dev"
                  data-active={it.pitch === selectedPitch}
                  style={{height: 20}}>
                  <span style={{
                    width: 36, padding:'0 2px',
                    fontFamily:'var(--mr-font-mono)', fontSize:9,
                    color: dev.color, textAlign:'left',
                    flexShrink: 0,
                  }}>{it.short}</span>
                  <span className="mr-dev__name" style={{fontSize: 11}}>{it.label}</span>
                  <span className="mr-dev__ch">{pitchLabel(it.pitch)}</span>
                </div>
              ))}
            </div>
          );
        })}
        <div style={{display:'flex', gap:6, marginTop:6}}>
          <button className="mr-btn" style={{height:22, padding:'0 8px', fontSize:10, flex:1}}>+ Add binding</button>
          <button className="mr-btn" style={{height:22, padding:'0 8px', fontSize:10}}>Learn</button>
        </div>
      </div>
    </div>
  );
}

// ── Per-unit action roll body ────────────────────────────────────────
// Renders just the action rows for ONE unit (deck, fx, mixer…), with the
// keys column showing the action label + per-row M/S chips. Used inside
// the collapsible <Unit> sections in the DJ-mode timeline.
function ActionRollUnit({ width, height, rows, unitMap, lo, hi, totalT = 16, playheadT = 6.2, selectedPitch, unitColor, perRowMS = false }) {
  const range = hi - lo;
  const rowH = Math.max(14, height / range);
  const totalH = rowH * range;
  const keysW = 192;
  const px = (width - keysW) / totalT;

  // keys column — action label + M/S chip per row
  const keys = [];
  for (let p = lo; p < hi; p++) {
    const idx = p - lo;
    const top = totalH - (idx + 1) * rowH;
    const action = unitMap[p];
    const isSel = p === selectedPitch;
    if (!action) {
      keys.push(
        <div key={p} className="mr-actkey" style={{top, height: rowH, borderLeft:'3px solid transparent'}}>
          <span className="mr-actkey__unmapped">— unmapped —</span>
          <div style={{flex:1}}></div>
          <span className="mr-actkey__note">{pitchLabel(p)}</span>
        </div>
      );
      continue;
    }
    keys.push(
      <div key={p} className={"mr-actkey" + (isSel ? " is-sel" : "")}
        style={{top, height: rowH, borderLeft:`3px solid ${unitColor}`}}>
        <div className="mr-actkey__l" style={{minWidth: 0, flex:1}}>
          <span className="mr-actkey__short" style={{color: unitColor}}>{action.short}</span>
          <span className="mr-actkey__label">{action.label}</span>
        </div>
        <div className="mr-actkey__r" style={{gap:6}}>
          {perRowMS && <MSChip muted={false} soloed={false}/>}
          <span className="mr-actkey__note">{pitchLabel(p)}</span>
        </div>
      </div>
    );
  }

  // lanes
  const lanes = [];
  for (let p = lo; p < hi; p++) {
    const idx = p - lo;
    const top = totalH - (idx + 1) * rowH;
    const isSel = p === selectedPitch;
    const action = unitMap[p];
    lanes.push(
      <div key={p} className="mr-lane mr-lane--action" data-mapped={!!action} data-sel={isSel}
        style={{
          top, height: rowH,
          background: isSel
            ? `color-mix(in oklab, ${unitColor} 14%, transparent)`
            : (action ? 'rgba(255,255,255,0.012)' : 'rgba(0,0,0,0.25)'),
          borderTop: isSel ? `1px solid ${unitColor}` : undefined,
          borderBottom: isSel ? `1px solid ${unitColor}` : undefined,
        }}/>
    );
  }
  // beat ticks
  const ticks = [];
  for (let i = 0; i <= totalT; i++) {
    ticks.push(
      <div key={i} style={{
        position:'absolute', top:0, bottom:0, left: i * px, width: 1,
        background: i % 4 === 0 ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.025)',
      }}/>
    );
  }
  // generate notes scoped to this unit's rows — simple deterministic pattern
  const noteEls = [];
  rows.forEach((r, ri) => {
    const idx = r.pitch - lo;
    const top = totalH - (idx + 1) * rowH;
    const isTrigger = r.cat === "cue" || r.cat === "hotcue" || r.cat === "transport";
    // Velocity-sensitive only for sampler/pad-mode actions. Hot Cues with
    // r.pad === true (e.g. Sampler-mode pads) get velocity-encoded opacity.
    const velocitySensitive = r.pad === true || r.cat === "sampler";
    // Aftertouch-capable: pad pressure / channel AT. Renders inner bar graph.
    const hasPressure = r.pressure === true;
    // 2-3 events per row, deterministic from pitch
    const seed = (r.pitch * 13 + 7) % 100;
    const evs = (seed % 3) + 2;
    for (let e = 0; e < evs; e++) {
      const t = ((seed + e * 41) % 1500) / 100;
      if (t > 16) continue;
      const vel = 0.5 + ((seed + e * 17) % 50) / 100;
      const left = t * px;
      const w = isTrigger && !hasPressure ? 6 : (hasPressure ? 80 + (seed % 40) : 30 + (seed % 60));
      const noteH = Math.max(5, rowH - 2);
      // Determine fill opacity: velocity-sensitive → encode velocity; else fixed ~85%.
      const baseOpacityPct = isTrigger && !hasPressure
        ? 100
        : (velocitySensitive ? Math.round(40 + vel * 50) : 85);
      const isSelectedNote = e === 1 && hasPressure && r.pitch === selectedPitch;
      // Inner pressure bars — discrete ticks across the note's gate
      const pressureCells = 14;
      const innerBars = [];
      if (hasPressure) {
        for (let pi = 0; pi < pressureCells; pi++) {
          // synthesize a pressure curve: rises, peaks, falls
          const u = pi / (pressureCells - 1);
          const pVal = Math.min(1, Math.max(0.05,
            (e === 0 ? Math.sin(u * Math.PI) * 0.85
            : e === 1 ? 0.2 + u * 0.7
            : 0.6 - Math.abs(u - 0.5) * 0.8)));
          const cellW = w / pressureCells;
          const barH = pVal * (noteH * 0.55);
          innerBars.push(
            <rect key={pi}
              x={pi * cellW + cellW * 0.25}
              y={noteH - barH - 1}
              width={Math.max(1, cellW * 0.5)}
              height={barH}
              fill="#fff"
              opacity="0.65"
              shapeRendering="crispEdges"/>
          );
        }
      }
      noteEls.push(
        <div key={`${r.pitch}-${e}`}
          className={"mr-note mr-note--action" + (isTrigger ? " is-trig" : "")}
          data-sel={isSelectedNote}
          style={{
            top: top + 1, left, width: w, height: noteH,
            background: isTrigger && !hasPressure
              ? unitColor
              : `color-mix(in oklab, ${unitColor} ${baseOpacityPct}%, transparent)`,
            borderRadius: isTrigger && !hasPressure ? 1 : 2,
            boxShadow: isSelectedNote
              ? `inset 0 0 0 0.5px rgba(255,255,255,0.6), 0 0 0 1px ${unitColor}, 0 0 10px color-mix(in oklab, ${unitColor} 60%, transparent)`
              : (isTrigger && !hasPressure
                  ? `0 0 6px color-mix(in oklab, ${unitColor} 60%, transparent)`
                  : 'inset 0 0 0 0.5px rgba(255,255,255,0.2), inset 0 -2px 0 rgba(0,0,0,0.18)'),
            position:'absolute',
            overflow:'hidden',
          }}>
          {/* velocity tick at left edge — single discrete value at note-on */}
          {!isTrigger && velocitySensitive && (
            <span style={{
              position:'absolute', left:0, top:0, bottom:0, width:2,
              background:'#fff', opacity: 0.4 + vel * 0.5,
            }}></span>
          )}
          {/* inner pressure bar graph */}
          {hasPressure && (
            <svg width={w} height={noteH} style={{position:'absolute', inset:0, pointerEvents:'none'}} preserveAspectRatio="none">
              {innerBars}
            </svg>
          )}
          {/* AT badge */}
          {hasPressure && w > 30 && (
            <span style={{
              position:'absolute', top:1, right:2,
              fontFamily:'var(--mr-font-mono)', fontSize:7, fontWeight:700,
              color:'#fff', opacity:0.85,
              letterSpacing:'0.04em',
              padding:'0 2px',
              background:'rgba(0,0,0,0.35)',
              borderRadius:1,
              lineHeight:'9px',
            }}>AT</span>
          )}
        </div>
      );
    }
  });

  return (
    <div className="mr-roll" style={{height: totalH}}>
      <div className="mr-keys mr-keys--actions" style={{height: totalH, width: keysW}}>{keys}</div>
      <div className="mr-roll__lanes">
        {lanes}
        {ticks}
        {noteEls}
        <div className="mr-playhead" style={{left: playheadT * px}}/>
      </div>
    </div>
  );
}

Object.assign(window, {
  DJ_CATEGORIES, DJ_DEVICES, DEFAULT_ACTION_MAP, pitchLabel,
  devColor, devShort, devLabel,
  ActionKeys, ActionRoll, ActionRollUnit, MapNoteEditor, ActionMapPanel,
});
