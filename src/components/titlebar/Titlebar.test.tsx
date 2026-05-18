import { describe, expect, test, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { Titlebar } from './Titlebar';
import { TransportProvider, useTransport, type TransportValue } from '../../hooks/useTransport';

vi.mock('../../hooks/useStatusbar', () => ({
  useStatusbar: () => ({ active: false }),
}));

vi.mock('../../midi/MidiRuntimeProvider', () => ({
  useMidiInputs: () => ({ inputs: [{ id: 'in1', name: 'Input 1' }] }),
}));

vi.mock('../toast/Toast', async () => {
  const actual = await vi.importActual<object>('../toast/Toast');
  return {
    ...actual,
    useToast: () => ({ show: vi.fn() }),
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
