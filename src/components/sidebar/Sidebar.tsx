import { Panel } from './Panel';
import { InputMappingPanel } from './InputMappingPanel';
import { MicIcon, RouteIcon, FilterIcon } from '../icons/transport';
import './Sidebar.css';

/* Fixture data — mirrors design_handoff_midi_recorder/prototype/components.jsx
   Sidebar() (lines 144–239). Slice 10 will replace these with live Web MIDI
   enumeration; until then keep them in sync with the prototype. */

type LedState = 'midi' | 'play' | 'rec' | 'off';
type Device = { name: string; channel: string; led: LedState; active: boolean };

const INPUTS: Device[] = [
  { name: 'Korg minilogue xd', channel: 'CH·1', led: 'midi', active: true },
  { name: 'Arturia KeyStep Pro', channel: 'CH·1–4', led: 'midi', active: true },
  { name: 'IAC Driver Bus 1', channel: '—', led: 'off', active: false },
];

const OUTPUTS: Device[] = [
  { name: 'Logic Pro · Track 4', channel: 'CH·1', led: 'play', active: true },
  { name: 'Korg minilogue xd', channel: 'CH·1', led: 'off', active: false },
];

const FILTERS: { label: string; on: boolean }[] = [
  { label: 'Notes', on: true },
  { label: 'Control change', on: true },
  { label: 'Pitch bend', on: true },
  { label: 'Aftertouch', on: false },
  { label: 'Program change', on: false },
  { label: 'SysEx', on: false },
];

const CHANNEL_CHIPS: { label: string; on: boolean }[] = [
  { label: 'CH 1', on: true },
  { label: 'CH 2', on: true },
  { label: 'CH 3', on: false },
  { label: 'CH 4', on: false },
  { label: 'CH 10', on: true },
  { label: '+10', on: false },
];

const ROUTING = {
  inputs: ['minilogue', 'KeyStep', 'IAC 1'],
  outputs: ['Logic Tr 4', 'minilogue', 'File'],
  // grid[input][output] — 1 means routed, 0 means not.
  grid: [
    [1, 0, 0],
    [1, 1, 0],
    [0, 0, 1],
  ] as const,
};

function DeviceRow({ device }: { device: Device }) {
  return (
    <div className="mr-dev" data-active={device.active ? 'true' : undefined}>
      <span className="mr-led" {...(device.led !== 'off' ? { 'data-state': device.led } : {})} />
      <span className="mr-dev__name">{device.name}</span>
      <span className="mr-dev__ch">{device.channel}</span>
    </div>
  );
}

function RoutingMatrix() {
  return (
    <div className="mr-routing">
      <div className="mr-routing__cell mr-routing__corner" />
      {ROUTING.outputs.map((out) => (
        <div key={out} className="mr-routing__cell mr-routing__hdr">
          {out}
        </div>
      ))}
      {ROUTING.inputs.map((label, ri) => (
        <RoutingRow key={label} label={label} row={ROUTING.grid[ri]} />
      ))}
    </div>
  );
}

function RoutingRow({ label, row }: { label: string; row: readonly (0 | 1)[] }) {
  return (
    <>
      <div className="mr-routing__cell mr-routing__lbl">{label}</div>
      {row.map((on, ci) => (
        <div key={ci} className="mr-routing__cell">
          <div className="mr-routing__cb" data-on={on === 1 ? 'true' : 'false'}>
            {on === 1 && (
              <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6l2 2 4-5" />
              </svg>
            )}
          </div>
        </div>
      ))}
    </>
  );
}

export function Sidebar() {
  return (
    <>
      <InputMappingPanel />

      <Panel icon={<MicIcon />} title="MIDI Inputs" count="2 / 3">
        {INPUTS.map((d) => (
          <DeviceRow key={d.name} device={d} />
        ))}
      </Panel>

      <Panel icon={<RouteIcon />} title="MIDI Outputs" count="1">
        {OUTPUTS.map((d) => (
          <DeviceRow key={d.name} device={d} />
        ))}
      </Panel>

      <Panel icon={<FilterIcon />} title="Record Filter">
        {FILTERS.map((f) => (
          <div key={f.label} className="mr-row">
            <span className="mr-row-lbl">{f.label}</span>
            <button
              type="button"
              className="mr-switch"
              data-on={f.on ? 'true' : 'false'}
              aria-pressed={f.on}
              aria-label={`${f.label} ${f.on ? 'on' : 'off'}`}
            />
          </div>
        ))}
        <div className="mr-sidebar__chip-strip">
          {CHANNEL_CHIPS.map((c) => (
            <button
              key={c.label}
              type="button"
              className="mr-chip"
              data-on={c.on ? 'true' : 'false'}
            >
              {c.label}
            </button>
          ))}
        </div>
      </Panel>

      <Panel icon={<RouteIcon />} title="Routing">
        <RoutingMatrix />
      </Panel>
    </>
  );
}
