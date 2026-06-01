/* timeline-storage payload schema + serialise/deserialise.

   The persistable session surface is enumerated in
   openspec/changes/timeline-storage/specs/session-model/spec.md. This module
   is the only place that knows which fields cross the storage boundary; the
   per-provider hydrate(...) actions consume the slices this returns. */

import type { Channel, PianoRollTrack, ParamLane } from '../hooks/useChannels';
import type { DJActionTrack } from '../hooks/useDJActionTracks';
import type { ClockSource, QuantizeGrid } from '../hooks/useTransport';
import type { LoopRegion } from '../hooks/useStage';
import { DEFAULT_PX_PER_BEAT, clampPxPerBeat } from '../session/timelineZoom';

export const STORAGE_SCHEMA_VERSION = 1;

declare const __APP_VERSION__: string | undefined;

export function getAppVersion(): string {
  if (typeof __APP_VERSION__ === 'string' && __APP_VERSION__.length > 0) {
    return __APP_VERSION__;
  }
  return '0.0.0';
}

export interface TransportAuthoringSlice {
  bpm: number;
  sig: string;
  quantizeOn: boolean;
  quantizeGrid: QuantizeGrid;
  snapAbsoluteOn: boolean;
  looping: boolean;
  metronomeOn: boolean;
  clockSource: ClockSource;
  cuePointTicks: number;
}

export interface SessionPayload {
  channels: Channel[];
  rolls: PianoRollTrack[];
  lanes: ParamLane[];
  djActionTracks: DJActionTrack[];
  transportAuthoring: TransportAuthoringSlice;
  loopRegion: LoopRegion | null;
  /** Horizontal timeline zoom. Optional on read (legacy payloads omit it);
      always emitted by writers under the current schema. */
  pxPerBeat?: number;
}

export interface TimelinePayload {
  version: number;
  appVersion: string;
  name: string;
  savedAt: number;
  session: SessionPayload;
}

export interface SerializeInput {
  channels: Channel[];
  rolls: PianoRollTrack[];
  lanes: ParamLane[];
  djActionTracks: DJActionTrack[];
  transport: TransportAuthoringSlice;
  loopRegion: LoopRegion | null;
  /** Optional — defaults to `DEFAULT_PX_PER_BEAT` when omitted by callers. */
  pxPerBeat?: number;
}

export function serializeTimeline(input: SerializeInput, name: string): TimelinePayload {
  const trimmed = name.trim();
  return {
    version: STORAGE_SCHEMA_VERSION,
    appVersion: getAppVersion(),
    name: trimmed,
    savedAt: Date.now(),
    session: {
      channels: input.channels,
      rolls: input.rolls,
      lanes: input.lanes,
      djActionTracks: input.djActionTracks,
      transportAuthoring: {
        bpm: input.transport.bpm,
        sig: input.transport.sig,
        quantizeOn: input.transport.quantizeOn,
        quantizeGrid: input.transport.quantizeGrid,
        snapAbsoluteOn: input.transport.snapAbsoluteOn,
        looping: input.transport.looping,
        metronomeOn: input.transport.metronomeOn,
        clockSource: input.transport.clockSource,
        cuePointTicks: input.transport.cuePointTicks,
      },
      loopRegion: input.loopRegion,
      pxPerBeat:
        typeof input.pxPerBeat === 'number' ? input.pxPerBeat : DEFAULT_PX_PER_BEAT,
    },
  };
}

export class PayloadVersionError extends Error {
  readonly payloadVersion: number;
  readonly expectedVersion: number;
  constructor(payloadVersion: number, expectedVersion: number, name?: string) {
    super(
      `Timeline payload${name ? ` "${name}"` : ''} has version ${payloadVersion}, expected ${expectedVersion}`,
    );
    this.name = 'PayloadVersionError';
    this.payloadVersion = payloadVersion;
    this.expectedVersion = expectedVersion;
  }
}

export class PayloadShapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PayloadShapeError';
  }
}

export interface DeserializedSlices {
  channels: { channels: Channel[]; rolls: PianoRollTrack[]; lanes: ParamLane[] };
  djActionTracks: DJActionTrack[];
  transportAuthoring: TransportAuthoringSlice;
  loopRegion: LoopRegion | null;
  /** Hydration slice for `pxPerBeat`. Present iff the payload carried a
      finite, in-range value; absent values default to
      `DEFAULT_PX_PER_BEAT` at the consumer (`useStage.hydrateView`). */
  view: { pxPerBeat?: number };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function assertShape(payload: unknown): asserts payload is TimelinePayload {
  if (!isObject(payload)) throw new PayloadShapeError('payload is not an object');
  if (typeof payload.version !== 'number') throw new PayloadShapeError('payload.version is not a number');
  if (typeof payload.appVersion !== 'string') throw new PayloadShapeError('payload.appVersion is not a string');
  if (typeof payload.name !== 'string') throw new PayloadShapeError('payload.name is not a string');
  if (typeof payload.savedAt !== 'number') throw new PayloadShapeError('payload.savedAt is not a number');
  if (!isObject(payload.session)) throw new PayloadShapeError('payload.session is not an object');

  const s = payload.session as Record<string, unknown>;
  if (!Array.isArray(s.channels)) throw new PayloadShapeError('session.channels is not an array');
  if (!Array.isArray(s.rolls)) throw new PayloadShapeError('session.rolls is not an array');
  if (!Array.isArray(s.lanes)) throw new PayloadShapeError('session.lanes is not an array');
  if (!Array.isArray(s.djActionTracks)) throw new PayloadShapeError('session.djActionTracks is not an array');
  if (!isObject(s.transportAuthoring)) throw new PayloadShapeError('session.transportAuthoring is not an object');
}

export function deserializeTimeline(payload: unknown): DeserializedSlices {
  assertShape(payload);
  if (payload.version !== STORAGE_SCHEMA_VERSION) {
    throw new PayloadVersionError(payload.version, STORAGE_SCHEMA_VERSION, payload.name);
  }
  const s = payload.session;
  /* Older payloads predate `cuePointTicks` on the transport-authoring slice.
     Default to 0 (start of timeline) so loads of pre-cue saves are silent. */
  const ta = s.transportAuthoring;
  const cuePointTicks =
    typeof (ta as TransportAuthoringSlice).cuePointTicks === 'number'
      ? (ta as TransportAuthoringSlice).cuePointTicks
      : 0;
  return {
    channels: {
      channels: s.channels,
      rolls: s.rolls,
      lanes: s.lanes,
    },
    djActionTracks: s.djActionTracks,
    transportAuthoring: { ...ta, cuePointTicks },
    loopRegion: s.loopRegion,
    view: extractViewSlice(s.pxPerBeat),
  };
}

/* `extractViewSlice` lives at module scope (not inside `deserializeTimeline`)
   so the JSONL codec can reuse the same legacy-/corruption-/clamp rules. */
export function extractViewSlice(raw: unknown): { pxPerBeat?: number } {
  if (raw === undefined) return {};
  if (typeof raw !== 'number') {
    console.warn('deserializeTimeline: session.pxPerBeat is not a number — falling back to default');
    return {};
  }
  if (!Number.isFinite(raw)) {
    console.warn('deserializeTimeline: session.pxPerBeat is non-finite — falling back to default');
    return {};
  }
  return { pxPerBeat: clampPxPerBeat(raw) };
}

/* Empty-session defaults used by newTimeline(). Mirrors construction defaults
   for an editor opened without any seeded demo. */
export function emptyTransportAuthoring(): TransportAuthoringSlice {
  return {
    bpm: 124,
    sig: '4/4',
    quantizeOn: true,
    quantizeGrid: '1/16',
    snapAbsoluteOn: false,
    looping: false,
    metronomeOn: true,
    clockSource: 'internal',
    cuePointTicks: 0,
  };
}

export function emptySessionPayload(): SessionPayload {
  return {
    channels: [],
    rolls: [],
    lanes: [],
    djActionTracks: [],
    transportAuthoring: emptyTransportAuthoring(),
    loopRegion: null,
    pxPerBeat: DEFAULT_PX_PER_BEAT,
  };
}
