import { describe, expect, test, afterEach } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { TransportProvider, useTransport, type TransportValue } from './useTransport';

afterEach(() => {
  cleanup();
});

function harness() {
  const captured: { current: TransportValue | null } = { current: null };
  function Probe() {
    captured.current = useTransport();
    return null;
  }
  render(
    <TransportProvider>
      <Probe />
    </TransportProvider>,
  );
  return captured;
}

describe('useTransport snapAbsoluteOn', () => {
  test('defaults to false at hook init', () => {
    const t = harness();
    expect(t.current!.snapAbsoluteOn).toBe(false);
  });

  test('toggleSnapAbsolute flips the flag', () => {
    const t = harness();
    expect(t.current!.snapAbsoluteOn).toBe(false);
    act(() => {
      t.current!.toggleSnapAbsolute();
    });
    expect(t.current!.snapAbsoluteOn).toBe(true);
    act(() => {
      t.current!.toggleSnapAbsolute();
    });
    expect(t.current!.snapAbsoluteOn).toBe(false);
  });

  test('toggleSnapAbsolute does not affect quantizeOn or quantizeGrid', () => {
    const t = harness();
    const before = { qOn: t.current!.quantizeOn, qGrid: t.current!.quantizeGrid };
    act(() => {
      t.current!.toggleSnapAbsolute();
    });
    expect(t.current!.quantizeOn).toBe(before.qOn);
    expect(t.current!.quantizeGrid).toBe(before.qGrid);
  });
});

describe('useTransport setQuantizeGrid', () => {
  test('updates quantizeGrid to the given value', () => {
    const t = harness();
    expect(t.current!.quantizeGrid).toBe('1/16');
    act(() => {
      t.current!.setQuantizeGrid('1/8');
    });
    expect(t.current!.quantizeGrid).toBe('1/8');
    act(() => {
      t.current!.setQuantizeGrid('1/32');
    });
    expect(t.current!.quantizeGrid).toBe('1/32');
  });

  test('does not affect quantizeOn or snapAbsoluteOn', () => {
    const t = harness();
    const before = { qOn: t.current!.quantizeOn, snap: t.current!.snapAbsoluteOn };
    act(() => {
      t.current!.setQuantizeGrid('1/4');
    });
    expect(t.current!.quantizeOn).toBe(before.qOn);
    expect(t.current!.snapAbsoluteOn).toBe(before.snap);
  });
});
