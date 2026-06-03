import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor, within } from '@testing-library/react';
import { ToastProvider } from '../toast/Toast';
import { TransportProvider } from '../../hooks/useTransport';
import {
  ControlMapStoreProvider,
  useControlMapStore,
  type ControlMapStoreValue,
} from '../../hooks/useControlMapStore';
import { MidiRuntimeProvider } from '../../midi/MidiRuntimeProvider';
import { MidiClockProvider } from '../../midi/MidiClockProvider';
import { MidiClockSendProvider } from '../../midi/MidiClockSendProvider';
import {
  MidiControlProvider,
  useMidiControl,
  type MidiControlValue,
} from '../../midi/MidiControlProvider';
import { __resetAccessCacheForTests } from '../../midi/access';
import type { ControlMapStore } from '../../storage/controlMapStore';
import type { ControlMapState } from '../../midi/controlMap';
import { MapModeToggle } from './MapModeToggle';
import { MapBadge } from './MapBadge';
import { MappingsPanel } from './MappingsPanel';
import { MappingConfig } from './MappingConfig';
import { ControlInputPicker } from './ControlInputPicker';

afterEach(() => cleanup());

function fakeAccess(inputIds: string[] = []): MIDIAccess {
  const inputs = new Map<string, unknown>();
  for (const id of inputIds) {
    inputs.set(id, { id, name: id, manufacturer: '', state: 'connected', onmidimessage: null });
  }
  return {
    inputs,
    outputs: new Map(),
    addEventListener() {},
    removeEventListener() {},
    onstatechange: null,
  } as unknown as MIDIAccess;
}

function fakeStore(initial: ControlMapState): ControlMapStore {
  let held: ControlMapState | null = initial;
  return { isFallback: true, async load() { return held; }, async save(s) { held = s; } };
}

interface Cap {
  control: MidiControlValue | null;
  store: ControlMapStoreValue | null;
}

async function harness(initial: ControlMapState) {
  __resetAccessCacheForTests();
  const cap: Cap = { control: null, store: null };
  function Probe() {
    cap.control = useMidiControl();
    cap.store = useControlMapStore();
    return null;
  }
  const utils = render(
    <ToastProvider>
      <TransportProvider>
        <MidiRuntimeProvider requestMIDIAccessImpl={async () => fakeAccess()} supported>
          <MidiClockProvider>
            <MidiClockSendProvider>
              <ControlMapStoreProvider createStore={async () => fakeStore(initial)}>
                <MidiControlProvider>
                  <Probe />
                  <MapModeToggle />
                  <MapBadge target="play" />
                  <MapBadge target="cue" />
                  <MappingsPanel />
                  <MappingConfig />
                </MidiControlProvider>
              </ControlMapStoreProvider>
            </MidiClockSendProvider>
          </MidiClockProvider>
        </MidiRuntimeProvider>
      </TransportProvider>
    </ToastProvider>,
  );
  await waitFor(() => expect(cap.store?.loaded).toBe(true));
  return { cap, ...utils };
}

const twoMappings: ControlMapState = {
  version: 1,
  mappings: [
    { target: 'play', source: { kind: 'note', portId: 'p', channel: 1, data: 60 }, edge: 'press', minValue: 1 },
    { target: 'toggleLoop', source: { kind: 'cc', portId: 'p', channel: 1, data: 14 }, edge: 'press', buttonMode: 'toggle', minValue: 1 },
  ],
};

describe('MapModeToggle', () => {
  it('reflects and toggles map mode on click', async () => {
    const { cap, getByTitle } = await harness({ version: 1, mappings: [] });
    expect(cap.control!.mapMode).toBe(false);
    act(() => {
      fireEvent.click(getByTitle('MIDI map mode (M)'));
    });
    expect(cap.control!.mapMode).toBe(true);
  });

  it('toggles map mode on the M key', async () => {
    const { cap } = await harness({ version: 1, mappings: [] });
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm' }));
    });
    expect(cap.control!.mapMode).toBe(true);
  });
});

describe('MapBadge', () => {
  it('shows the mapped source in map mode and arms on click', async () => {
    const { cap, container } = await harness(twoMappings);
    act(() => cap.control!.enterMapMode());
    // play is mapped to note 60 → C4
    const badge = await waitFor(() => {
      const el = container.querySelector('[data-mr-map-target="play"]');
      if (!el) throw new Error('badge not yet rendered');
      return el as HTMLElement;
    });
    expect(badge.textContent).toContain('C4');
    // cue is unmapped — flagged via data-unmapped, with no text label
    const cueBadge = container.querySelector('[data-mr-map-target="cue"]') as HTMLElement;
    expect(cueBadge.getAttribute('data-unmapped')).toBe('true');
    expect(cueBadge.textContent).toBe('');
    act(() => fireEvent.click(badge));
    expect(cap.control!.armedTarget).toBe('play');
  });
});

describe('MappingsPanel', () => {
  it('lists current mappings and arms the target on row click', async () => {
    const { cap, container } = await harness(twoMappings);
    act(() => cap.control!.enterMapMode());
    const playRow = await waitFor(() => {
      const el = container.querySelector('[data-mr-map-row="play"]');
      if (!el) throw new Error('row not rendered');
      return el as HTMLElement;
    });
    expect(container.querySelector('[data-mr-map-row="toggleLoop"]')).toBeTruthy();
    act(() => fireEvent.click(within(playRow).getByRole('button', { pressed: false })));
    expect(cap.control!.armedTarget).toBe('play');
  });
});

describe('MappingConfig', () => {
  it('shows kind-relevant fields and persists an edit', async () => {
    const { cap, container } = await harness(twoMappings);
    act(() => {
      cap.control!.enterMapMode();
      cap.control!.arm('toggleLoop');
    });
    // The first select outside the manual source editor is the Edge select.
    const edgeSelect = await waitFor(() => {
      const editorSelects = Array.from(
        container.querySelectorAll('[data-mr-map-source-editor] select'),
      );
      const outside = Array.from(container.querySelectorAll('.mr-map-config select')).filter(
        (s) => !editorSelects.includes(s),
      );
      if (outside.length === 0) throw new Error('config not rendered');
      return outside[0] as HTMLSelectElement;
    });
    act(() => fireEvent.change(edgeSelect, { target: { value: 'release' } }));
    await waitFor(() => {
      const m = cap.store!.state.mappings.find((x) => x.target === 'toggleLoop');
      expect(m?.edge).toBe('release');
    });
  });

  it('lets the user map a control manually (no learning)', async () => {
    const { cap, container } = await harness({ version: 1, mappings: [] });
    act(() => {
      cap.control!.enterMapMode();
      cap.control!.arm('cue'); // unmapped target
    });
    const channelInput = await waitFor(() => {
      const el = container.querySelector('[data-mr-map-source-editor] input[type="number"]');
      if (!el) throw new Error('source editor not rendered');
      return el as HTMLInputElement;
    });
    act(() => fireEvent.change(channelInput, { target: { value: '5' } }));
    await waitFor(() => {
      const m = cap.store!.state.mappings.find((x) => x.target === 'cue');
      expect(m?.source.channel).toBe(5);
      expect(m?.source.kind).toBe('note');
    });
  });
});

describe('ControlInputPicker', () => {
  async function pickerHarness(initial: ControlMapState, inputIds: string[]) {
    __resetAccessCacheForTests();
    const cap: { store: ControlMapStoreValue | null } = { store: null };
    function Probe() {
      cap.store = useControlMapStore();
      return null;
    }
    const utils = render(
      <ToastProvider>
        <TransportProvider>
          <MidiRuntimeProvider requestMIDIAccessImpl={async () => fakeAccess(inputIds)} supported>
            <ControlMapStoreProvider createStore={async () => fakeStore(initial)}>
              <Probe />
              <ControlInputPicker />
            </ControlMapStoreProvider>
          </MidiRuntimeProvider>
        </TransportProvider>
      </ToastProvider>,
    );
    await waitFor(() => expect(cap.store?.loaded).toBe(true));
    return { cap, ...utils };
  }

  it('defaults to "all devices" on, with the device list hidden', async () => {
    const { container } = await pickerHarness({ version: 1, mappings: [] }, ['dev-1']);
    const allSwitch = container.querySelector('[data-mr-listen-all]') as HTMLElement;
    expect(allSwitch.getAttribute('aria-checked')).toBe('true');
    expect(container.querySelector('[data-mr-listen-input="dev-1"]')).toBeNull();
  });

  it('turning the switch off restricts to explicit devices', async () => {
    const { cap, container } = await pickerHarness({ version: 1, mappings: [] }, ['dev-1']);
    const allSwitch = container.querySelector('[data-mr-listen-all]') as HTMLElement;
    act(() => fireEvent.click(allSwitch));
    await waitFor(() => {
      expect(cap.store!.state.listenInputIds).toEqual(['dev-1']);
      expect(container.querySelector('[data-mr-listen-input="dev-1"]')).toBeTruthy();
    });
  });
});
