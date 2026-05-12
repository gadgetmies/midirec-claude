import { Panel } from './Panel';
import { InputMappingPanel } from './InputMappingPanel';
import { TrackInputMappingPanel } from './TrackInputMappingPanel';
import { MicIcon, RouteIcon, FilterIcon } from '../icons/transport';
import { MidiPermissionBanner } from '../midi-runtime/MidiPermissionBanner';
import { useMidiInputs, useMidiOutputs } from '../../midi/MidiRuntimeProvider';
import type { MidiDevice } from '../../midi/access';
import './Sidebar.css';

/* Filter switches and channel chips are still hardcoded — mirrors
   design_handoff_midi_recorder/prototype/components.jsx Sidebar()
   (lines 144–239). Device data (inputs, outputs, routing labels) is
   sourced from the Web MIDI runtime via useMidiInputs/useMidiOutputs. */

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

function countString(devices: MidiDevice[]): string {
  const connected = devices.filter((d) => d.state === 'connected').length;
  return `${connected} / ${devices.length}`;
}

function DeviceRow({ device }: { device: MidiDevice }) {
  const active = device.state === 'connected';
  return (
    <div className="mr-dev" data-active={active ? 'true' : undefined}>
      <span className="mr-led" />
      <span className="mr-dev__name">{device.name}</span>
      <span className="mr-dev__ch">—</span>
    </div>
  );
}

function EmptyDeviceHint({ message }: { message: string }) {
  return (
    <div className="mr-dev mr-dev--empty">
      <span className="mr-dev__name">{message}</span>
    </div>
  );
}

function RoutingMatrix({ inputs, outputs }: { inputs: MidiDevice[]; outputs: MidiDevice[] }) {
  if (inputs.length === 0 || outputs.length === 0) {
    return (
      <div className="mr-routing__hint">
        Routing unavailable — connect MIDI devices to configure routes.
      </div>
    );
  }
  const columns = `70px repeat(${outputs.length}, 1fr)`;
  return (
    <div className="mr-routing" style={{ gridTemplateColumns: columns }}>
      <div className="mr-routing__cell mr-routing__corner" />
      {outputs.map((out) => (
        <div key={out.id} className="mr-routing__cell mr-routing__hdr">
          {out.name}
        </div>
      ))}
      {inputs.map((input) => (
        <RoutingRow key={input.id} input={input} outputCount={outputs.length} />
      ))}
    </div>
  );
}

function RoutingRow({ input, outputCount }: { input: MidiDevice; outputCount: number }) {
  return (
    <>
      <div className="mr-routing__cell mr-routing__lbl">{input.name}</div>
      {Array.from({ length: outputCount }, (_, ci) => (
        <div key={ci} className="mr-routing__cell">
          <div className="mr-routing__cb" data-on="false" />
        </div>
      ))}
    </>
  );
}

export function Sidebar() {
  const { inputs } = useMidiInputs();
  const { outputs } = useMidiOutputs();

  return (
    <>
      <MidiPermissionBanner />
      <TrackInputMappingPanel />
      <InputMappingPanel />

      <Panel icon={<MicIcon />} title="MIDI Inputs" count={countString(inputs)}>
        {inputs.length === 0 ? (
          <EmptyDeviceHint message="No MIDI inputs" />
        ) : (
          inputs.map((d) => <DeviceRow key={d.id} device={d} />)
        )}
      </Panel>

      <Panel icon={<RouteIcon />} title="MIDI Outputs" count={countString(outputs)}>
        {outputs.length === 0 ? (
          <EmptyDeviceHint message="No MIDI outputs" />
        ) : (
          outputs.map((d) => <DeviceRow key={d.id} device={d} />)
        )}
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
        <RoutingMatrix inputs={inputs} outputs={outputs} />
      </Panel>
    </>
  );
}
