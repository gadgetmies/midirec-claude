/* timeline-storage payload schema + serialise/deserialise.

   The persistable session surface is enumerated in
   openspec/changes/timeline-storage/specs/session-model/spec.md. This module
   is the only place that knows which fields cross the storage boundary; the
   per-provider hydrate(...) actions consume the slices this returns. */

import type { Channel, PianoRollTrack, ParamLane } from '../hooks/useChannels';
import type { DJActionTrack } from '../hooks/useDJActionTracks';
import type { ClockSource, QuantizeGrid } from '../hooks/useTransport';
import type { LoopRegion } from '../hooks/useStage';

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
}

export interface SessionPayload {
  channels: Channel[];
  rolls: PianoRollTrack[];
  lanes: ParamLane[];
  djActionTracks: DJActionTrack[];
  transportAuthoring: TransportAuthoringSlice;
  loopRegion: LoopRegion | null;
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
      },
      loopRegion: input.loopRegion,
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
  return {
    channels: {
      channels: s.channels,
      rolls: s.rolls,
      lanes: s.lanes,
    },
    djActionTracks: s.djActionTracks,
    transportAuthoring: s.transportAuthoring,
    loopRegion: s.loopRegion,
  };
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
  };
}
