/* Inspector PRESSURE section — rendered inside ActionPanel when an event
   on a pressure-bearing DJ action is selected. Bar-graph view of the
   per-event aftertouch curve (synthesised or stored) plus summary
   readout, bulk-op buttons (Smooth/Flatten/Clear), and a Curve/Step
   mode toggle.

   Visibility predicate is owned by the parent (ActionPanel) — this
   component assumes its props are already valid (event exists, action
   has pressure capability). */

import {
  devColor,
  type ActionMapEntry,
  type PressurePoint,
} from '../../data/dj';
import {
  rasterizePressure,
  smoothPressure,
  flattenPressure,
  summarizePressure,
  synthesizePressure,
  EDITOR_BINS,
} from '../../data/pressure';
import type { DJActionTrack } from '../../hooks/useDJActionTracks';
import { useStage } from '../../hooks/useStage';
import './PressureEditor.css';

interface PressureEditorProps {
  track: DJActionTrack;
  pitch: number;
  eventIdx: number;
  entry: ActionMapEntry;
}

const GRAPH_W = 168;
const GRAPH_H = 56;
const BAR_W = 1.5;
const MIN_BAR_H_FRAC = 0.06;

export function PressureEditor({ track, pitch, eventIdx, entry }: PressureEditorProps) {
  const { pressureRenderMode, setPressureRenderMode, setEventPressure } = useStage();
  const event = track.events[eventIdx];

  /* perPitchIndex matches what ActionRoll computes for this event (so the
     synthesised curve in the editor matches what the lane body draws for
     untouched events). It's the count of events with the same pitch that
     precede this one in the events array. */
  let perPitchIndex = 0;
  for (let i = 0; i < eventIdx; i++) {
    if (track.events[i].pitch === pitch) perPitchIndex += 1;
  }

  const points: PressurePoint[] =
    event.pressure !== undefined ? event.pressure : synthesizePressure(event, perPitchIndex);
  const bins = rasterizePressure(points, EDITOR_BINS);
  const summary = summarizePressure(points, EDITOR_BINS);

  const handleSmooth = () => {
    setEventPressure(track.id, pitch, eventIdx, smoothPressure(points));
  };
  const handleFlatten = () => {
    setEventPressure(track.id, pitch, eventIdx, flattenPressure(points));
  };
  const handleClear = () => {
    setEventPressure(track.id, pitch, eventIdx, []);
  };

  const colW = GRAPH_W / EDITOR_BINS;
  const bars: JSX.Element[] = [];
  const dots: JSX.Element[] = [];
  for (let i = 0; i < EDITOR_BINS; i++) {
    const v = bins[i];
    const h = Math.max(MIN_BAR_H_FRAC * GRAPH_H, v * GRAPH_H);
    const cx = (i + 0.5) * colW;
    const x = cx - BAR_W / 2;
    const y = GRAPH_H - h;
    bars.push(
      <rect
        key={`b${i}`}
        className="mr-pressure__bar"
        x={x}
        y={y}
        width={BAR_W}
        height={h}
        shapeRendering="crispEdges"
      />,
    );
    dots.push(
      <rect
        key={`d${i}`}
        className="mr-pressure__dot"
        x={x}
        y={y}
        width={BAR_W}
        height={1.5}
        shapeRendering="crispEdges"
      />,
    );
  }

  return (
    <section
      className="mr-pressure"
      data-mr-dj-selection-region="true"
      style={{ ['--action-color' as 'color']: devColor(entry.device) }}
    >
      <div className="mr-pressure__eyebrow">Pressure</div>
      <div className="mr-pressure__graph">
        <svg
          width={GRAPH_W}
          height={GRAPH_H}
          data-mode={pressureRenderMode}
          preserveAspectRatio="none"
        >
          {bars}
          {dots}
        </svg>
      </div>
      <div className="mr-pressure__summary">
        {summary.count} events · peak {summary.peak.toFixed(2)} · avg {summary.avg.toFixed(2)}
      </div>
      <div className="mr-pressure__bulk">
        <button type="button" className="mr-btn" onClick={handleSmooth}>Smooth</button>
        <button type="button" className="mr-btn" onClick={handleFlatten}>Flatten</button>
        <button type="button" className="mr-btn" onClick={handleClear}>Clear</button>
      </div>
      <div className="mr-pressure__mode">
        <button
          type="button"
          className="mr-pressure__mode-chip"
          data-on={pressureRenderMode === 'curve' ? 'true' : undefined}
          onClick={() => setPressureRenderMode('curve')}
        >
          Curve
        </button>
        <button
          type="button"
          className="mr-pressure__mode-chip"
          data-on={pressureRenderMode === 'step' ? 'true' : undefined}
          onClick={() => setPressureRenderMode('step')}
        >
          Step
        </button>
      </div>
    </section>
  );
}
