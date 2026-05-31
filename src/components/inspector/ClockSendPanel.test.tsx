import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { ClockSendPanel } from './ClockSendPanel';
import type { MidiClockSendValue } from '../../midi/MidiClockSendProvider';

let mockOutputs: Array<{ id: string; name: string }> = [];
let mockOutputsStatus: 'granted' | 'unsupported' | 'requesting' | 'denied' = 'granted';
let mockTransport = {
  mode: 'idle' as 'idle' | 'play' | 'record',
  bpm: 124,
  clockSource: 'internal' as 'internal' | 'external-clock' | 'external-mtc',
  sig: '4/4',
  playheadTicks: 0,
};
const setEnabledSpy = vi.fn<(b: boolean) => void>();
const toggleOutputSpy = vi.fn<(id: string) => void>();
const setSelectedOutputsSpy = vi.fn<(ids: string[]) => void>();
const syncSpy = vi.fn<() => void>();
const setGridAlignmentSpy = vi.fn<(p: unknown) => void>();
const fireGridAlignmentSpy = vi.fn<() => void>();

let mockSend: MidiClockSendValue = {
  enabled: false,
  selectedOutputIds: new Set<string>(),
  txPulse: 0,
  txPulseByOutputId: new Map<string, number>(),
  gridAlignment: {
    enabled: false,
    outputId: null,
    message: { kind: 'note', channel: 1, note: 60, velocity: 127 },
    boundary: 'bar',
    phraseBars: 8,
  },
  setEnabled: setEnabledSpy,
  toggleOutput: toggleOutputSpy,
  setSelectedOutputs: setSelectedOutputsSpy,
  sync: syncSpy,
  setGridAlignment: setGridAlignmentSpy,
  fireGridAlignment: fireGridAlignmentSpy,
};

vi.mock('../../midi/MidiClockSendProvider', () => ({
  useMidiClockSend: () => mockSend,
}));

vi.mock('../../midi/MidiRuntimeProvider', () => ({
  useMidiOutputs: () => ({ outputs: mockOutputs, status: mockOutputsStatus }),
}));

vi.mock('../../hooks/useTransport', () => ({
  useTransport: () => mockTransport,
}));

function resetMocks() {
  setEnabledSpy.mockClear();
  toggleOutputSpy.mockClear();
  setSelectedOutputsSpy.mockClear();
  syncSpy.mockClear();
  setGridAlignmentSpy.mockClear();
  fireGridAlignmentSpy.mockClear();
  mockOutputs = [];
  mockOutputsStatus = 'granted';
  mockTransport = {
    mode: 'idle',
    bpm: 124,
    clockSource: 'internal',
    sig: '4/4',
    playheadTicks: 0,
  };
  mockSend = {
    enabled: false,
    selectedOutputIds: new Set<string>(),
    txPulse: 0,
    txPulseByOutputId: new Map<string, number>(),
    gridAlignment: {
      enabled: false,
      outputId: null,
      message: { kind: 'note', channel: 1, note: 60, velocity: 127 },
      boundary: 'bar',
      phraseBars: 8,
    },
    setEnabled: setEnabledSpy,
    toggleOutput: toggleOutputSpy,
    setSelectedOutputs: setSelectedOutputsSpy,
    sync: syncSpy,
    setGridAlignment: setGridAlignmentSpy,
    fireGridAlignment: fireGridAlignmentSpy,
  };
}

beforeEach(() => resetMocks());
afterEach(() => cleanup());

describe('ClockSendPanel — section structure', () => {
  test('renders MIDI CLOCK SEND header and is open by default', () => {
    const { container } = render(<ClockSendPanel />);
    const header = container.querySelector('.mr-insp-clock-send__head');
    expect(header).toBeTruthy();
    expect(header!.textContent).toContain('MIDI CLOCK SEND');
    expect(
      container.querySelector('.mr-insp-clock-send')?.getAttribute('data-open'),
    ).toBe('true');
  });

  test('clicking header toggles open state', () => {
    const { container } = render(<ClockSendPanel />);
    const header = container.querySelector('.mr-insp-clock-send__head') as HTMLButtonElement;
    fireEvent.click(header);
    expect(
      container.querySelector('.mr-insp-clock-send')?.getAttribute('data-open'),
    ).toBe('false');
  });

  test('Body DOM order: master, sync, CADENCE, STATUS, outputs, grid-align, footer', () => {
    mockOutputs = [{ id: 'a', name: 'A' }];
    const { container } = render(<ClockSendPanel />);
    const body = container.querySelector('.mr-insp-clock-send__body')!;
    const children = Array.from(body.children);
    /* The body contains a sequence of children — verify the key ones are
       present and in the right relative order. */
    const findIdx = (selector: string) =>
      children.findIndex((c) => c.matches(selector));
    expect(findIdx('.mr-insp-clock-send__master')).toBeLessThan(
      findIdx('.mr-insp-clock-send__sync'),
    );
    expect(findIdx('.mr-insp-clock-send__sync')).toBeLessThan(
      findIdx('.mr-insp-clock-send__outputs'),
    );
    expect(findIdx('.mr-insp-clock-send__outputs')).toBeLessThan(
      findIdx('.mr-insp-grid-align'),
    );
    expect(findIdx('.mr-insp-grid-align')).toBeLessThan(
      findIdx('.mr-insp-clock-send__footer'),
    );
  });
});

describe('ClockSendPanel — master row + cadence source', () => {
  test('master rocker toggles setEnabled', () => {
    const { container } = render(<ClockSendPanel />);
    const rocker = container.querySelector(
      '.mr-insp-clock-send__rocker',
    ) as HTMLButtonElement;
    fireEvent.click(rocker);
    expect(setEnabledSpy).toHaveBeenCalledTimes(1);
    expect(setEnabledSpy).toHaveBeenCalledWith(true);
  });

  test('cadence source reads "Internal" when clockSource === internal', () => {
    const { container } = render(<ClockSendPanel />);
    expect(container.textContent).toContain('Internal');
  });

  test('cadence source reads "External (relay)" when external-clock', () => {
    mockTransport = { ...mockTransport, clockSource: 'external-clock' };
    const { container } = render(<ClockSendPanel />);
    expect(container.textContent).toContain('External (relay)');
  });
});

describe('ClockSendPanel — Sync button', () => {
  test('disabled when enabled is false', () => {
    const { container } = render(<ClockSendPanel />);
    const btn = container.querySelector(
      '.mr-insp-clock-send__sync',
    ) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  test('disabled when no connected+selected output', () => {
    mockSend = { ...mockSend, enabled: true, selectedOutputIds: new Set(['ghost']) };
    const { container } = render(<ClockSendPanel />);
    const btn = container.querySelector(
      '.mr-insp-clock-send__sync',
    ) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  test('enabled with connected+selected output; clicking calls sync()', () => {
    mockOutputs = [{ id: 'a', name: 'A' }];
    mockSend = { ...mockSend, enabled: true, selectedOutputIds: new Set(['a']) };
    const { container } = render(<ClockSendPanel />);
    const btn = container.querySelector(
      '.mr-insp-clock-send__sync',
    ) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    expect(syncSpy).toHaveBeenCalledTimes(1);
    /* Flash class applied. */
    expect(btn.getAttribute('data-flash')).toBe('true');
  });
});

describe('ClockSendPanel — CADENCE and STATUS rows', () => {
  test('CADENCE row reflects bpm at 124 → 124.0 BPM · 49.6 Hz · 24 PPQ', () => {
    const { container } = render(<ClockSendPanel />);
    expect(container.textContent).toContain('124.0 BPM · 49.6 Hz · 24 PPQ');
  });

  test('STATUS reads "idle" when disabled', () => {
    const { container } = render(<ClockSendPanel />);
    expect(container.textContent).toContain('idle');
  });

  test('STATUS reads "enabled · no outs" when enabled with no connected outs', () => {
    mockSend = { ...mockSend, enabled: true };
    const { container } = render(<ClockSendPanel />);
    expect(container.textContent).toContain('enabled · no outs');
  });

  test('STATUS reads "transmitting · 2 outs" when enabled with connected outs', () => {
    mockOutputs = [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ];
    mockSend = {
      ...mockSend,
      enabled: true,
      selectedOutputIds: new Set(['a', 'b']),
    };
    const { container } = render(<ClockSendPanel />);
    expect(container.textContent).toContain('transmitting · 2 outs');
  });
});

describe('ClockSendPanel — outputs list', () => {
  test('renders one row per connected output', () => {
    mockOutputs = [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
      { id: 'c', name: 'C' },
    ];
    const { container } = render(<ClockSendPanel />);
    const rows = container.querySelectorAll('.mr-insp-clock-send__output');
    expect(rows.length).toBe(3);
  });

  test('output row reflects selection (aria-checked + data-on)', () => {
    mockOutputs = [{ id: 'a', name: 'A' }];
    mockSend = { ...mockSend, selectedOutputIds: new Set(['a']) };
    const { container } = render(<ClockSendPanel />);
    const row = container.querySelector(
      '.mr-insp-clock-send__output',
    ) as HTMLElement;
    expect(row.getAttribute('aria-checked')).toBe('true');
    expect(row.getAttribute('data-on')).toBe('true');
  });

  test('clicking output row toggles selection', () => {
    mockOutputs = [{ id: 'a', name: 'A' }];
    const { container } = render(<ClockSendPanel />);
    const row = container.querySelector(
      '.mr-insp-clock-send__output',
    ) as HTMLButtonElement;
    fireEvent.click(row);
    expect(toggleOutputSpy).toHaveBeenCalledWith('a');
  });

  test('offline row renders for selected-but-disconnected ids', () => {
    mockOutputs = [{ id: 'a', name: 'A' }];
    mockSend = { ...mockSend, selectedOutputIds: new Set(['a', 'b']) };
    const { container } = render(<ClockSendPanel />);
    const rows = Array.from(container.querySelectorAll('.mr-insp-clock-send__output'));
    /* a + b offline = 2 rows. */
    expect(rows.length).toBe(2);
    /* b's text should include (offline). */
    expect(rows[1].textContent).toMatch(/\(offline\)/);
  });
});

describe('ClockSendPanel — footer', () => {
  test('Select all invokes setSelectedOutputs(all ids)', () => {
    mockOutputs = [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ];
    const { container } = render(<ClockSendPanel />);
    const btns = Array.from(
      container.querySelectorAll('.mr-insp-clock-send__footer-btn'),
    ) as HTMLButtonElement[];
    fireEvent.click(btns[0]);
    expect(setSelectedOutputsSpy).toHaveBeenCalledWith(['a', 'b']);
  });

  test('Clear invokes setSelectedOutputs([])', () => {
    mockOutputs = [{ id: 'a', name: 'A' }];
    const { container } = render(<ClockSendPanel />);
    const btns = Array.from(
      container.querySelectorAll('.mr-insp-clock-send__footer-btn'),
    ) as HTMLButtonElement[];
    fireEvent.click(btns[1]);
    expect(setSelectedOutputsSpy).toHaveBeenCalledWith([]);
  });
});

describe('ClockSendPanel — MIDI access not granted', () => {
  test('renders placeholder and disabled master switch', () => {
    mockOutputsStatus = 'unsupported';
    const { container } = render(<ClockSendPanel />);
    expect(container.textContent).toContain('MIDI access not granted');
    const switchBtn = container.querySelector(
      '.mr-insp-clock-send__master [role="switch"]',
    ) as HTMLButtonElement;
    expect(switchBtn.getAttribute('aria-disabled')).toBe('true');
  });
});

describe('ClockSendPanel — Grid Alignment subsection', () => {
  test('renders subsection with default open=true', () => {
    const { container } = render(<ClockSendPanel />);
    const sub = container.querySelector('.mr-insp-grid-align');
    expect(sub).toBeTruthy();
    expect(sub!.getAttribute('data-open')).toBe('true');
  });

  test('Enable rocker calls setGridAlignment({ enabled: true })', () => {
    const { container } = render(<ClockSendPanel />);
    const sub = container.querySelector('.mr-insp-grid-align')!;
    const rocker = sub.querySelector('[role="switch"]') as HTMLButtonElement;
    fireEvent.click(rocker);
    expect(setGridAlignmentSpy).toHaveBeenCalledWith({ enabled: true });
  });

  test('OUTPUT picker lists (none) plus each output', () => {
    mockOutputs = [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ];
    const { container } = render(<ClockSendPanel />);
    const select = container.querySelector(
      '.mr-insp-grid-align select',
    ) as HTMLSelectElement;
    const optionTexts = Array.from(select.options).map((o) => o.textContent);
    expect(optionTexts).toEqual(['(none)', 'A', 'B']);
  });

  test('TRIGGER radiogroup reflects boundary and clicking commits', () => {
    const { container } = render(<ClockSendPanel />);
    const radios = Array.from(
      container.querySelectorAll('.mr-insp-grid-align [role="radio"]'),
    ) as HTMLButtonElement[];
    /* First 3 radios are TRIGGER. */
    expect(radios[0].textContent).toBe('Bar');
    expect(radios[1].textContent).toBe('Phrase');
    expect(radios[2].textContent).toBe('Manual');
    fireEvent.click(radios[1]);
    expect(setGridAlignmentSpy).toHaveBeenCalledWith({ boundary: 'phrase' });
  });

  test('PHRASE row appears only when boundary === "phrase"', () => {
    const { container, rerender } = render(<ClockSendPanel />);
    expect(container.textContent).not.toContain('PHRASE');
    mockSend = {
      ...mockSend,
      gridAlignment: { ...mockSend.gridAlignment, boundary: 'phrase' },
    };
    rerender(<ClockSendPanel />);
    expect(container.textContent).toContain('PHRASE');
  });

  test('MESSAGE label flips N#/VEL vs CC#/VAL based on kind', () => {
    const { container, rerender } = render(<ClockSendPanel />);
    expect(container.textContent).toContain('N#');
    expect(container.textContent).toContain('VEL');
    mockSend = {
      ...mockSend,
      gridAlignment: {
        ...mockSend.gridAlignment,
        message: { kind: 'cc', channel: 1, cc: 20, value: 64 },
      },
    };
    rerender(<ClockSendPanel />);
    expect(container.textContent).toContain('CC#');
    expect(container.textContent).toContain('VAL');
  });

  test('Fire now is disabled when outputId === null', () => {
    const { container } = render(<ClockSendPanel />);
    const fireBtn = container.querySelector(
      '.mr-insp-grid-align__fire',
    ) as HTMLButtonElement;
    expect(fireBtn.disabled).toBe(true);
  });

  test('Fire now invokes fireGridAlignment when outputId resolves to a connected output', () => {
    mockOutputs = [{ id: 'a', name: 'A' }];
    mockSend = {
      ...mockSend,
      gridAlignment: { ...mockSend.gridAlignment, outputId: 'a' },
    };
    const { container } = render(<ClockSendPanel />);
    const fireBtn = container.querySelector(
      '.mr-insp-grid-align__fire',
    ) as HTMLButtonElement;
    expect(fireBtn.disabled).toBe(false);
    fireEvent.click(fireBtn);
    expect(fireGridAlignmentSpy).toHaveBeenCalledTimes(1);
  });
});
