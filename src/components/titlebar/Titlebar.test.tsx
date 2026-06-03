import { describe, expect, test, vi, afterEach, beforeEach } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { Titlebar } from './Titlebar';
import { TransportProvider, useTransport, type TransportValue } from '../../hooks/useTransport';
import type { MidiClockValue, ClockSourceSelection } from '../../midi/MidiClockProvider';
import type { MidiClockSendValue } from '../../midi/MidiClockSendProvider';

let mockInputs: Array<{ id: string; name: string }> = [{ id: 'in1', name: 'Input 1' }];
let mockOutputs: Array<{ id: string; name: string }> = [];
const setSelectionSpy = vi.fn<(sel: ClockSourceSelection) => void>();
const setStrictStartSpy = vi.fn<(b: boolean) => void>();
const toastShowSpy = vi.fn<(...args: unknown[]) => void>();
const setSendEnabledSpy = vi.fn<(b: boolean) => void>();
const toggleSendOutputSpy = vi.fn<(id: string) => void>();
const setSendSelectedOutputsSpy = vi.fn<(ids: string[]) => void>();
const syncSpy = vi.fn<() => void>();
let mockClock: MidiClockValue = {
  present: false,
  bpm: null,
  pulse: 0,
  beat: 0,
  running: false,
  selection: 'auto',
  strictStart: false,
  setSelection: setSelectionSpy,
  setStrictStart: setStrictStartSpy,
  onPulse: () => () => {},
  onStart: () => () => {},
};

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
  setEnabled: setSendEnabledSpy,
  toggleOutput: toggleSendOutputSpy,
  setSelectedOutputs: setSendSelectedOutputsSpy,
  sync: syncSpy,
  setGridAlignment: () => {},
  fireGridAlignment: () => {},
};

vi.mock('../../hooks/useStatusbar', () => ({
  useStatusbar: () => ({ active: false }),
}));

vi.mock('../../midi/MidiRuntimeProvider', () => ({
  useMidiInputs: () => ({ inputs: mockInputs, status: 'granted' }),
  useMidiOutputs: () => ({ outputs: mockOutputs, status: 'granted' }),
}));

vi.mock('../../midi/MidiClockProvider', () => ({
  useMidiClock: () => mockClock,
}));

vi.mock('../../midi/MidiClockSendProvider', () => ({
  useMidiClockSend: () => mockSend,
}));

vi.mock('../toast/Toast', async () => {
  const actual = await vi.importActual<object>('../toast/Toast');
  return {
    ...actual,
    useToast: () => ({ show: toastShowSpy }),
  };
});

beforeEach(() => {
  setSelectionSpy.mockClear();
  setStrictStartSpy.mockClear();
  toastShowSpy.mockClear();
  setSendEnabledSpy.mockClear();
  toggleSendOutputSpy.mockClear();
  setSendSelectedOutputsSpy.mockClear();
  syncSpy.mockClear();
  mockInputs = [{ id: 'in1', name: 'Input 1' }];
  mockOutputs = [];
  mockClock = {
    present: false,
    bpm: null,
    pulse: 0,
    beat: 0,
    running: false,
    selection: 'auto',
    strictStart: false,
    setSelection: setSelectionSpy,
    setStrictStart: setStrictStartSpy,
    onPulse: () => () => {},
    onStart: () => () => {},
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
    setEnabled: setSendEnabledSpy,
    toggleOutput: toggleSendOutputSpy,
    setSelectedOutputs: setSendSelectedOutputsSpy,
    sync: syncSpy,
    setGridAlignment: () => {},
    fireGridAlignment: () => {},
  };
});

afterEach(() => {
  cleanup();
});

function renderTitlebar() {
  const captured: { current: TransportValue | null } = { current: null };
  function Probe() {
    captured.current = useTransport();
    return null;
  }
  const utils = render(
    <TransportProvider>
      <Probe />
      <Titlebar />
    </TransportProvider>,
  );
  return { ...utils, transport: captured };
}

describe('Titlebar A chip', () => {
  test('renders Q and A before the grid-value chip', () => {
    const { container } = renderTitlebar();
    const quantWidget = container.querySelector('.mr-quant');
    expect(quantWidget).toBeTruthy();
    // Q and A are wrapped in map-badge anchors, so query descendants (not just
    // direct children) for the labels.
    const labels = Array.from(quantWidget!.querySelectorAll('.mr-quant__lbl'));
    expect(labels.map((l) => l.textContent)).toEqual(['Q', 'A']);
    /* Both labels must come before the grid chip. */
    const gridChip = container.querySelector('.mr-quant__value')!;
    const aLabel = labels[1]!;
    expect(
      aLabel.compareDocumentPosition(gridChip) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test('data-on reflects snapAbsoluteOn', () => {
    const { container, transport } = renderTitlebar();
    const aBtn = container.querySelectorAll('.mr-quant__lbl')[1] as HTMLButtonElement;
    expect(aBtn.getAttribute('data-on')).toBeNull();
    fireEvent.click(aBtn);
    expect(transport.current!.snapAbsoluteOn).toBe(true);
    const aBtnAfter = container.querySelectorAll('.mr-quant__lbl')[1] as HTMLButtonElement;
    expect(aBtnAfter.getAttribute('data-on')).toBe('true');
  });

  test('click toggles snapAbsolute when quantize is on', () => {
    const { container, transport } = renderTitlebar();
    expect(transport.current!.quantizeOn).toBe(true);
    const aBtn = container.querySelectorAll('.mr-quant__lbl')[1] as HTMLButtonElement;
    fireEvent.click(aBtn);
    expect(transport.current!.snapAbsoluteOn).toBe(true);
    fireEvent.click(container.querySelectorAll('.mr-quant__lbl')[1] as HTMLButtonElement);
    expect(transport.current!.snapAbsoluteOn).toBe(false);
  });

  test('data-disabled and click no-op when quantize is off', () => {
    const { container, transport } = renderTitlebar();
    const qBtn = container.querySelectorAll('.mr-quant__lbl')[0] as HTMLButtonElement;
    fireEvent.click(qBtn);
    expect(transport.current!.quantizeOn).toBe(false);
    const aBtn = container.querySelectorAll('.mr-quant__lbl')[1] as HTMLButtonElement;
    expect(aBtn.getAttribute('data-disabled')).toBe('true');
    fireEvent.click(aBtn);
    expect(transport.current!.snapAbsoluteOn).toBe(false);
  });

  test('tooltip communicates the dependency when disabled', () => {
    const { container, transport } = renderTitlebar();
    const qBtn = container.querySelectorAll('.mr-quant__lbl')[0] as HTMLButtonElement;
    fireEvent.click(qBtn);
    expect(transport.current!.quantizeOn).toBe(false);
    const aBtn = container.querySelectorAll('.mr-quant__lbl')[1] as HTMLButtonElement;
    expect(aBtn.getAttribute('title')).toMatch(/Enable Quantize/i);
  });
});

describe('Titlebar quantize grid select', () => {
  test('clicking the grid chip opens a menu listing all grid options', () => {
    const { container } = renderTitlebar();
    const gridChip = container.querySelector('.mr-quant__value') as HTMLButtonElement;
    expect(container.querySelector('.mr-quant__menu')).toBeNull();
    fireEvent.click(gridChip);
    const menu = container.querySelector('.mr-quant__menu');
    expect(menu).toBeTruthy();
    const rows = Array.from(menu!.querySelectorAll('.mr-quant__menu-row'));
    expect(rows.map((r) => r.textContent)).toEqual(['1/4', '1/8', '1/16', '1/32']);
  });

  test('current grid is marked selected in the menu', () => {
    const { container, transport } = renderTitlebar();
    expect(transport.current!.quantizeGrid).toBe('1/16');
    fireEvent.click(container.querySelector('.mr-quant__value') as HTMLButtonElement);
    const selected = container.querySelector(
      '.mr-quant__menu-row[aria-selected="true"]',
    ) as HTMLButtonElement;
    expect(selected.textContent).toBe('1/16');
  });

  test('selecting an option updates quantizeGrid and closes the menu', () => {
    const { container, transport } = renderTitlebar();
    fireEvent.click(container.querySelector('.mr-quant__value') as HTMLButtonElement);
    const rows = container.querySelectorAll('.mr-quant__menu-row');
    fireEvent.click(rows[1] as HTMLButtonElement); /* 1/8 */
    expect(transport.current!.quantizeGrid).toBe('1/8');
    expect(container.querySelector('.mr-quant__menu')).toBeNull();
    expect((container.querySelector('.mr-quant__value') as HTMLElement).textContent).toContain(
      '1/8',
    );
  });

  test('grid chip is disabled and does not open menu when quantize is off', () => {
    const { container, transport } = renderTitlebar();
    fireEvent.click(container.querySelectorAll('.mr-quant__lbl')[0] as HTMLButtonElement);
    expect(transport.current!.quantizeOn).toBe(false);
    const gridChip = container.querySelector('.mr-quant__value') as HTMLButtonElement;
    expect(gridChip.disabled).toBe(true);
    fireEvent.click(gridChip);
    expect(container.querySelector('.mr-quant__menu')).toBeNull();
  });
});

describe('Titlebar BPM cell mirrors external clock', () => {
  test('BPM cell renders 128 after external pulse injects bpm=128', () => {
    const { container, transport } = renderTitlebar();
    const metaCells = container.querySelectorAll('.mr-meta');
    const bpmCell = metaCells[1]!;
    expect(bpmCell.querySelector('.mr-meta__lbl')!.textContent).toBe('BPM');
    expect(bpmCell.querySelector('.mr-meta__val')!.textContent).toBe('124');

    act(() => {
      transport.current!.applyExternalPulse(0, 128);
    });
    expect(bpmCell.querySelector('.mr-meta__val')!.textContent).toBe('128');

    // Clk cell flips to Ext as well (3rd meta cell).
    const clkCell = metaCells[2]!;
    expect(clkCell.querySelector('.mr-meta__lbl')!.textContent).toBe('Clk');
    expect(clkCell.querySelector('.mr-meta__val')!.textContent).toBe('Ext');

    // Reverting clears it.
    act(() => {
      transport.current!.revertToInternalClock();
    });
    expect(bpmCell.querySelector('.mr-meta__val')!.textContent).toBe('124');
    expect(clkCell.querySelector('.mr-meta__val')!.textContent).toBe('Int');
  });
});

describe('Titlebar Clk picker', () => {
  test('Clk cell renders as a button with aria-haspopup="listbox"', () => {
    const { container } = renderTitlebar();
    const clkBtn = container.querySelector('.mr-meta--clk .mr-meta__val--btn') as HTMLButtonElement;
    expect(clkBtn).toBeTruthy();
    expect(clkBtn.tagName).toBe('BUTTON');
    expect(clkBtn.getAttribute('aria-haspopup')).toBe('listbox');
    expect(clkBtn.getAttribute('aria-expanded')).toBe('false');
    expect(clkBtn.textContent).toContain('Int');
  });

  test('clicking the Clk button opens menu with Auto + Internal + each device row', () => {
    mockInputs = [
      { id: 'a', name: 'Korg' },
      { id: 'b', name: 'MicroFreak' },
    ];
    const { container } = renderTitlebar();
    expect(container.querySelector('.mr-clk__menu')).toBeNull();

    const clkBtn = container.querySelector('.mr-meta--clk .mr-meta__val--btn') as HTMLButtonElement;
    fireEvent.click(clkBtn);

    const menu = container.querySelector('.mr-clk__menu');
    expect(menu).toBeTruthy();
    expect(menu!.getAttribute('role')).toBe('listbox');
    expect(clkBtn.getAttribute('aria-expanded')).toBe('true');

    const rows = Array.from(menu!.querySelectorAll('.mr-clk__menu-row'));
    expect(rows.map((r) => r.textContent)).toEqual(['Auto', 'Internal', 'Korg', 'MicroFreak']);
  });

  test('selected row carries data-on and aria-selected matching current selection', () => {
    mockClock = { ...mockClock, selection: 'internal' };
    const { container } = renderTitlebar();
    const clkBtn = container.querySelector('.mr-meta--clk .mr-meta__val--btn') as HTMLButtonElement;
    fireEvent.click(clkBtn);

    const rows = Array.from(container.querySelectorAll('.mr-clk__menu-row')) as HTMLButtonElement[];
    const auto = rows.find((r) => r.textContent === 'Auto')!;
    const internal = rows.find((r) => r.textContent === 'Internal')!;
    expect(auto.getAttribute('data-on')).toBeNull();
    expect(auto.getAttribute('aria-selected')).toBe('false');
    expect(internal.getAttribute('data-on')).toBe('true');
    expect(internal.getAttribute('aria-selected')).toBe('true');
  });

  test('clicking Internal row calls setSelection("internal") and closes menu', () => {
    const { container } = renderTitlebar();
    const clkBtn = container.querySelector('.mr-meta--clk .mr-meta__val--btn') as HTMLButtonElement;
    fireEvent.click(clkBtn);

    const internalRow = Array.from(container.querySelectorAll('.mr-clk__menu-row')).find(
      (r) => r.textContent === 'Internal',
    ) as HTMLButtonElement;
    fireEvent.click(internalRow);

    expect(setSelectionSpy).toHaveBeenCalledTimes(1);
    expect(setSelectionSpy).toHaveBeenCalledWith('internal');
    expect(container.querySelector('.mr-clk__menu')).toBeNull();
  });

  test('clicking a device row calls setSelection with the device id', () => {
    mockInputs = [{ id: 'micro-1', name: 'MicroFreak' }];
    const { container } = renderTitlebar();
    const clkBtn = container.querySelector('.mr-meta--clk .mr-meta__val--btn') as HTMLButtonElement;
    fireEvent.click(clkBtn);

    const deviceRow = Array.from(container.querySelectorAll('.mr-clk__menu-row')).find(
      (r) => r.textContent === 'MicroFreak',
    ) as HTMLButtonElement;
    fireEvent.click(deviceRow);

    expect(setSelectionSpy).toHaveBeenCalledWith('micro-1');
  });

  test('outside click closes menu without changing selection', () => {
    const { container } = renderTitlebar();
    const clkBtn = container.querySelector('.mr-meta--clk .mr-meta__val--btn') as HTMLButtonElement;
    fireEvent.click(clkBtn);
    expect(container.querySelector('.mr-clk__menu')).toBeTruthy();

    fireEvent.pointerDown(document.body);
    expect(container.querySelector('.mr-clk__menu')).toBeNull();
    expect(setSelectionSpy).not.toHaveBeenCalled();
  });

  test('Escape closes menu without changing selection', () => {
    const { container } = renderTitlebar();
    const clkBtn = container.querySelector('.mr-meta--clk .mr-meta__val--btn') as HTMLButtonElement;
    fireEvent.click(clkBtn);
    expect(container.querySelector('.mr-clk__menu')).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(container.querySelector('.mr-clk__menu')).toBeNull();
    expect(setSelectionSpy).not.toHaveBeenCalled();
  });

  test('menu still shows Auto + Internal when no devices are connected', () => {
    mockInputs = [];
    const { container } = renderTitlebar();
    const clkBtn = container.querySelector('.mr-meta--clk .mr-meta__val--btn') as HTMLButtonElement;
    fireEvent.click(clkBtn);

    const rows = Array.from(container.querySelectorAll('.mr-clk__menu-row'));
    expect(rows.map((r) => r.textContent)).toEqual(['Auto', 'Internal']);
  });
});

describe('Titlebar transport-group-A buttons', () => {
  test('4.2 renders exactly five .mr-tbtn buttons in spec order, no Stop button', () => {
    const { container } = renderTitlebar();
    const groupA = container.querySelector('.mr-tgroup');
    expect(groupA).toBeTruthy();
    const buttons = Array.from(groupA!.querySelectorAll('.mr-tbtn')) as HTMLButtonElement[];
    expect(buttons.length).toBe(5);
    const labels = buttons.map((b) => b.getAttribute('aria-label'));
    expect(labels).toEqual(['Rewind', 'Play', 'Cue', 'Record', 'Fast forward']);
    expect(labels).not.toContain('Stop');
  });

  test('4.3 clicking Rewind resets playheadTicks and timecodeMs to 0', () => {
    const { container, transport } = renderTitlebar();
    act(() => {
      transport.current!.seek(2500);
    });
    expect(transport.current!.playheadTicks).toBeGreaterThan(0);
    const rewindBtn = container.querySelector('.mr-tgroup .mr-tbtn[aria-label="Rewind"]') as HTMLButtonElement;
    fireEvent.click(rewindBtn);
    expect(transport.current!.playheadTicks).toBe(0);
    expect(transport.current!.timecodeMs).toBe(0);
  });

  test('4.4 clicking Cue from idle stores playhead into cuePointTicks', () => {
    const { container, transport } = renderTitlebar();
    act(() => {
      transport.current!.seek(1500);
    });
    const ticks = transport.current!.playheadTicks;
    expect(ticks).toBeGreaterThan(0);
    expect(transport.current!.mode).toBe('idle');
    const cueBtn = container.querySelector('.mr-tgroup .mr-tbtn[aria-label="Cue"]') as HTMLButtonElement;
    fireEvent.click(cueBtn);
    expect(transport.current!.cuePointTicks).toBe(ticks);
    expect(transport.current!.mode).toBe('idle');
  });

  test('4.5 clicking Cue from play snaps playhead to cuePointTicks and idles', () => {
    const { container, transport } = renderTitlebar();
    act(() => {
      transport.current!.seek(1500);
    });
    act(() => {
      transport.current!.cue();
    });
    const cue = transport.current!.cuePointTicks;
    expect(cue).toBeGreaterThan(0);
    act(() => {
      transport.current!.play();
    });
    act(() => {
      transport.current!.seek(3000);
    });
    expect(transport.current!.mode).toBe('play');
    expect(transport.current!.playheadTicks).not.toBe(cue);
    const cueBtn = container.querySelector('.mr-tgroup .mr-tbtn[aria-label="Cue"]') as HTMLButtonElement;
    fireEvent.click(cueBtn);
    expect(transport.current!.mode).toBe('idle');
    expect(transport.current!.playheadTicks).toBe(cue);
  });

  test('4.6 Play-Pause resumes recording when a take is paused', () => {
    const { container, transport } = renderTitlebar();
    act(() => {
      transport.current!.record();
    });
    const stamp = transport.current!.recordingStartedAt;
    expect(stamp).not.toBeNull();
    act(() => {
      transport.current!.seek(1500);
    });
    const ms = transport.current!.timecodeMs;
    const ticks = transport.current!.playheadTicks;

    const playBtn = container.querySelector('.mr-tgroup .mr-tbtn[aria-label="Pause"]') as HTMLButtonElement;
    fireEvent.click(playBtn);
    expect(transport.current!.mode).toBe('idle');
    expect(transport.current!.recordingStartedAt).toBe(stamp);

    const playBtnAgain = container.querySelector('.mr-tgroup .mr-tbtn[aria-label="Play"]') as HTMLButtonElement;
    fireEvent.click(playBtnAgain);
    expect(transport.current!.mode).toBe('record');
    expect(transport.current!.recordingStartedAt).toBe(stamp);
    expect(transport.current!.timecodeMs).toBe(ms);
    expect(transport.current!.playheadTicks).toBe(ticks);
  });

  test('4.7 play-after-pause-from-play starts fresh play and emits the "Started · BPM" toast', () => {
    const { container, transport } = renderTitlebar();
    act(() => {
      transport.current!.play();
    });
    expect(transport.current!.mode).toBe('play');

    const pauseBtn = container.querySelector('.mr-tgroup .mr-tbtn[aria-label="Pause"]') as HTMLButtonElement;
    fireEvent.click(pauseBtn);
    expect(transport.current!.mode).toBe('idle');
    expect(transport.current!.recordingStartedAt).toBeNull();

    toastShowSpy.mockClear();
    const playBtn = container.querySelector('.mr-tgroup .mr-tbtn[aria-label="Play"]') as HTMLButtonElement;
    fireEvent.click(playBtn);
    expect(transport.current!.mode).toBe('play');
    expect(toastShowSpy).toHaveBeenCalledTimes(1);
    expect(toastShowSpy.mock.calls[0]![0]).toMatch(/Started · \d+ BPM/);
  });
});

describe('Titlebar Snd pill', () => {
  test('Snd cell renders immediately after Clk cell with aria-haspopup and TX LED', () => {
    const { container } = renderTitlebar();
    const meta = Array.from(container.querySelectorAll('.mr-meta'));
    /* DOM order: Bar, BPM, Clk, Snd, Sig (5 cells). */
    const clkIdx = meta.findIndex((el) => el.classList.contains('mr-meta--clk'));
    const sndIdx = meta.findIndex((el) => el.classList.contains('mr-meta--snd'));
    expect(sndIdx).toBe(clkIdx + 1);
    const sndBtn = meta[sndIdx].querySelector('.mr-meta__val--btn') as HTMLButtonElement;
    expect(sndBtn).toBeTruthy();
    expect(sndBtn.tagName).toBe('BUTTON');
    expect(sndBtn.getAttribute('aria-haspopup')).toBe('listbox');
    expect(sndBtn.getAttribute('aria-expanded')).toBe('false');
    expect(meta[sndIdx].querySelector('.mr-led[aria-hidden="true"]')).toBeTruthy();
  });

  test('Off state text when send disabled', () => {
    const { container } = renderTitlebar();
    const sndBtn = container.querySelector(
      '.mr-meta--snd .mr-meta__val--btn',
    ) as HTMLButtonElement;
    expect(sndBtn.textContent).toContain('Off');
  });

  test('No outs text when enabled with empty selection', () => {
    mockSend = { ...mockSend, enabled: true };
    const { container } = renderTitlebar();
    const sndBtn = container.querySelector(
      '.mr-meta--snd .mr-meta__val--btn',
    ) as HTMLButtonElement;
    expect(sndBtn.textContent).toContain('No outs');
  });

  test('<n> outs text with two or more selected', () => {
    mockSend = {
      ...mockSend,
      enabled: true,
      selectedOutputIds: new Set(['a', 'b', 'c']),
    };
    const { container } = renderTitlebar();
    const sndBtn = container.querySelector(
      '.mr-meta--snd .mr-meta__val--btn',
    ) as HTMLButtonElement;
    expect(sndBtn.textContent).toContain('3 outs');
  });

  test('Single-output truncated name when one selected', () => {
    mockOutputs = [{ id: 'out-a', name: 'IAC Driver — Bus 1' }];
    mockSend = {
      ...mockSend,
      enabled: true,
      selectedOutputIds: new Set(['out-a']),
    };
    const { container } = renderTitlebar();
    const sndBtn = container.querySelector(
      '.mr-meta--snd .mr-meta__val--btn',
    ) as HTMLButtonElement;
    /* 12-char truncation = 11 chars + ellipsis. */
    expect(sndBtn.textContent).toMatch(/IAC Driver/);
    expect(sndBtn.textContent).toContain('…');
  });

  test('clicking Snd button opens menu with Enable row + output rows + footer', () => {
    mockOutputs = [
      { id: 'a', name: 'IAC' },
      { id: 'b', name: 'USB MIDI' },
    ];
    const { container } = renderTitlebar();
    expect(container.querySelector('.mr-snd__menu')).toBeNull();
    const sndBtn = container.querySelector(
      '.mr-meta--snd .mr-meta__val--btn',
    ) as HTMLButtonElement;
    fireEvent.click(sndBtn);
    const menu = container.querySelector('.mr-snd__menu');
    expect(menu).toBeTruthy();
    expect(menu!.getAttribute('role')).toBe('listbox');
    expect(sndBtn.getAttribute('aria-expanded')).toBe('true');
    /* Enable switch row */
    expect(menu!.querySelector('[role="switch"]')).toBeTruthy();
    /* Two option rows */
    const optionRows = menu!.querySelectorAll('[role="option"]');
    expect(optionRows.length).toBe(2);
    /* Footer with Select all, Clear, Sync slaves now */
    const footer = menu!.querySelector('.mr-snd__menu-footer');
    expect(footer).toBeTruthy();
    const footerBtns = Array.from(
      footer!.querySelectorAll('.mr-snd__menu-footer-btn'),
    );
    expect(footerBtns.map((b) => b.textContent)).toEqual([
      'Select all',
      'Clear',
      'Sync slaves now',
    ]);
  });

  test('clicking Enable row toggles setEnabled and keeps menu open', () => {
    const { container } = renderTitlebar();
    fireEvent.click(container.querySelector('.mr-meta--snd .mr-meta__val--btn') as HTMLButtonElement);
    const enableRow = container.querySelector(
      '.mr-snd__menu [role="switch"]',
    ) as HTMLButtonElement;
    fireEvent.click(enableRow);
    expect(setSendEnabledSpy).toHaveBeenCalledTimes(1);
    expect(setSendEnabledSpy).toHaveBeenCalledWith(true);
    expect(container.querySelector('.mr-snd__menu')).toBeTruthy();
  });

  test('clicking a device row toggles output and keeps menu open', () => {
    mockOutputs = [{ id: 'out-a', name: 'IAC' }];
    const { container } = renderTitlebar();
    fireEvent.click(container.querySelector('.mr-meta--snd .mr-meta__val--btn') as HTMLButtonElement);
    const optionRow = container.querySelector(
      '.mr-snd__menu [role="option"]',
    ) as HTMLButtonElement;
    fireEvent.click(optionRow);
    expect(toggleSendOutputSpy).toHaveBeenCalledTimes(1);
    expect(toggleSendOutputSpy).toHaveBeenCalledWith('out-a');
    expect(container.querySelector('.mr-snd__menu')).toBeTruthy();
  });

  test('Select all + Clear + Sync slaves now footer buttons wire up correctly', () => {
    mockOutputs = [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ];
    mockSend = {
      ...mockSend,
      enabled: true,
      selectedOutputIds: new Set(['a']),
    };
    const { container } = renderTitlebar();
    fireEvent.click(container.querySelector('.mr-meta--snd .mr-meta__val--btn') as HTMLButtonElement);
    const footerBtns = Array.from(
      container.querySelectorAll('.mr-snd__menu-footer-btn'),
    ) as HTMLButtonElement[];
    fireEvent.click(footerBtns[0]); // Select all
    expect(setSendSelectedOutputsSpy).toHaveBeenCalledWith(['a', 'b']);
    fireEvent.click(footerBtns[1]); // Clear
    expect(setSendSelectedOutputsSpy).toHaveBeenCalledWith([]);
    fireEvent.click(footerBtns[2]); // Sync slaves now
    expect(syncSpy).toHaveBeenCalledTimes(1);
  });

  test('Outside click closes Snd menu', () => {
    const { container } = renderTitlebar();
    fireEvent.click(container.querySelector('.mr-meta--snd .mr-meta__val--btn') as HTMLButtonElement);
    expect(container.querySelector('.mr-snd__menu')).toBeTruthy();
    fireEvent.pointerDown(document.body);
    expect(container.querySelector('.mr-snd__menu')).toBeNull();
  });
});

describe('Titlebar Clk menu — Strict Start row', () => {
  test('Strict Start row is the last child of the Clk menu', () => {
    mockInputs = [{ id: 'a', name: 'Korg' }];
    const { container } = renderTitlebar();
    fireEvent.click(container.querySelector('.mr-meta--clk .mr-meta__val--btn') as HTMLButtonElement);
    const menu = container.querySelector('.mr-clk__menu')!;
    const last = menu.lastElementChild;
    expect(last?.classList.contains('mr-clk__menu-row--strict')).toBe(true);
    expect(last?.getAttribute('role')).toBe('switch');
  });

  test('Strict Start row carries data-on and aria-checked when enabled', () => {
    mockClock = { ...mockClock, strictStart: true };
    const { container } = renderTitlebar();
    fireEvent.click(container.querySelector('.mr-meta--clk .mr-meta__val--btn') as HTMLButtonElement);
    const strictRow = container.querySelector(
      '.mr-clk__menu-row--strict',
    ) as HTMLElement;
    expect(strictRow.getAttribute('aria-checked')).toBe('true');
    expect(strictRow.getAttribute('data-on')).toBe('true');
  });

  test('clicking Strict Start row toggles strictStart and keeps Clk menu open', () => {
    mockClock = { ...mockClock, strictStart: false };
    const { container } = renderTitlebar();
    fireEvent.click(container.querySelector('.mr-meta--clk .mr-meta__val--btn') as HTMLButtonElement);
    const strictRow = container.querySelector(
      '.mr-clk__menu-row--strict',
    ) as HTMLElement;
    fireEvent.click(strictRow);
    expect(setStrictStartSpy).toHaveBeenCalledTimes(1);
    expect(setStrictStartSpy).toHaveBeenCalledWith(true);
    /* Menu stays open. */
    expect(container.querySelector('.mr-clk__menu')).toBeTruthy();
  });

  test('Strict Start row renders even with no input devices', () => {
    mockInputs = [];
    const { container } = renderTitlebar();
    fireEvent.click(container.querySelector('.mr-meta--clk .mr-meta__val--btn') as HTMLButtonElement);
    expect(container.querySelector('.mr-clk__menu-row--strict')).toBeTruthy();
  });
});
