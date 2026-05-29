import { describe, expect, test, vi, afterEach, beforeEach } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { Titlebar } from './Titlebar';
import { TransportProvider, useTransport, type TransportValue } from '../../hooks/useTransport';
import type { MidiClockValue, ClockSourceSelection } from '../../midi/MidiClockProvider';

let mockInputs: Array<{ id: string; name: string }> = [{ id: 'in1', name: 'Input 1' }];
const setSelectionSpy = vi.fn<(sel: ClockSourceSelection) => void>();
let mockClock: MidiClockValue = {
  present: false,
  bpm: null,
  pulse: 0,
  beat: 0,
  running: false,
  selection: 'auto',
  setSelection: setSelectionSpy,
};

vi.mock('../../hooks/useStatusbar', () => ({
  useStatusbar: () => ({ active: false }),
}));

vi.mock('../../midi/MidiRuntimeProvider', () => ({
  useMidiInputs: () => ({ inputs: mockInputs }),
}));

vi.mock('../../midi/MidiClockProvider', () => ({
  useMidiClock: () => mockClock,
}));

vi.mock('../toast/Toast', async () => {
  const actual = await vi.importActual<object>('../toast/Toast');
  return {
    ...actual,
    useToast: () => ({ show: vi.fn() }),
  };
});

beforeEach(() => {
  setSelectionSpy.mockClear();
  mockInputs = [{ id: 'in1', name: 'Input 1' }];
  mockClock = {
    present: false,
    bpm: null,
    pulse: 0,
    beat: 0,
    running: false,
    selection: 'auto',
    setSelection: setSelectionSpy,
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
    const children = Array.from(quantWidget!.children);
    const labels = children.filter((c) => c.classList.contains('mr-quant__lbl'));
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
