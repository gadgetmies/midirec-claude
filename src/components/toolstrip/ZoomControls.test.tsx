import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  TimelineZoomGesturesContext,
  type TimelineZoomGesturesValue,
} from '../shell/useTimelineZoomGestures';
import { ZoomControls } from './ZoomControls';

afterEach(() => cleanup());

function provide(value: TimelineZoomGesturesValue) {
  return render(
    <TimelineZoomGesturesContext.Provider value={value}>
      <ZoomControls />
    </TimelineZoomGesturesContext.Provider>,
  );
}

describe('Toolstrip ZoomControls', () => {
  test('renders three ASCII-glyph buttons with the spec aria-labels', () => {
    const noop = vi.fn();
    provide({ zoomIn: noop, zoomOut: noop, fit: noop });
    expect(screen.getByLabelText('Zoom out').textContent).toBe('-');
    expect(screen.getByLabelText('Fit timeline').textContent).toBe('Fit');
    expect(screen.getByLabelText('Zoom in').textContent).toBe('+');
  });

  test('clicking Zoom out / Fit / Zoom in calls the corresponding gesture handler', () => {
    const zoomIn = vi.fn();
    const zoomOut = vi.fn();
    const fit = vi.fn();
    provide({ zoomIn, zoomOut, fit });

    fireEvent.click(screen.getByLabelText('Zoom out'));
    fireEvent.click(screen.getByLabelText('Fit timeline'));
    fireEvent.click(screen.getByLabelText('Zoom in'));

    expect(zoomOut).toHaveBeenCalledOnce();
    expect(fit).toHaveBeenCalledOnce();
    expect(zoomIn).toHaveBeenCalledOnce();
  });

  test('renders nothing when the context is unavailable', () => {
    const { container } = render(<ZoomControls />);
    expect(container.firstChild).toBe(null);
  });
});
