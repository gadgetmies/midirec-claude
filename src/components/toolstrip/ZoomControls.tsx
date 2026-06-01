/* Toolstrip buttons that mirror the keyboard zoom shortcuts. Delegates to
   the AppShell's `useTimelineZoomGestures` hook via context so the wheel,
   keyboard, and button gestures all share the same handlers (and the same
   playhead-anchored / fit-session logic). */

import { useTimelineZoomGesturesContext } from '../shell/useTimelineZoomGestures';
import './ZoomControls.css';

export function ZoomControls() {
  const ctx = useTimelineZoomGesturesContext();
  if (!ctx) return null;
  return (
    <div className="mr-tool-zoom" data-testid="zoom-controls">
      <button
        type="button"
        className="mr-tool mr-tool-zoom__btn"
        aria-label="Zoom out"
        onClick={ctx.zoomOut}
      >
        -
      </button>
      <button
        type="button"
        className="mr-tool mr-tool-zoom__btn"
        aria-label="Fit timeline"
        onClick={ctx.fit}
      >
        Fit
      </button>
      <button
        type="button"
        className="mr-tool mr-tool-zoom__btn"
        aria-label="Zoom in"
        onClick={ctx.zoomIn}
      >
        +
      </button>
    </div>
  );
}
