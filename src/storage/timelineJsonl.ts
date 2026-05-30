/* Whole-timeline JSONL format. One line per high-level slice of the
   TimelinePayload, line-delimited so the file streams naturally and remains
   diff-friendly. This format is symmetric: serialise → write → read → parse
   round-trips back to the same slices the IndexedDB store would have written. */

import type { Channel, PianoRollTrack, ParamLane } from '../hooks/useChannels';
import type { DJActionTrack } from '../hooks/useDJActionTracks';
import type { LoopRegion } from '../hooks/useStage';
import {
  PayloadShapeError,
  PayloadVersionError,
  STORAGE_SCHEMA_VERSION,
  emptySessionPayload,
  getAppVersion,
  type DeserializedSlices,
  type SerializeInput,
  type TransportAuthoringSlice,
} from './timelinePayload';

/* ── Line discriminators ────────────────────────────────────────────────── */

interface MetaLine {
  kind: 'meta';
  version: number;
  appVersion: string;
  name: string;
  savedAt: number;
}

interface TransportLine {
  kind: 'transport';
  slice: TransportAuthoringSlice;
}

interface LoopLine {
  kind: 'loop';
  region: LoopRegion | null;
}

interface ChannelLine {
  kind: 'channel';
  channel: Channel;
}

interface RollLine {
  kind: 'roll';
  roll: PianoRollTrack;
}

interface LaneLine {
  kind: 'lane';
  lane: ParamLane;
}

interface DJTrackLine {
  kind: 'dj.track';
  track: DJActionTrack;
}

export type TimelineJsonlLine =
  | MetaLine
  | TransportLine
  | LoopLine
  | ChannelLine
  | RollLine
  | LaneLine
  | DJTrackLine;

export const JSONL_FILE_EXT = 'jsonl';

/* ── Serialise ──────────────────────────────────────────────────────────── */

export interface SerializeJsonlInput extends SerializeInput {
  name: string;
}

export function serializeTimelineToJsonl(input: SerializeJsonlInput): string {
  const lines: TimelineJsonlLine[] = [];
  lines.push({
    kind: 'meta',
    version: STORAGE_SCHEMA_VERSION,
    appVersion: getAppVersion(),
    name: input.name.trim(),
    savedAt: Date.now(),
  });
  lines.push({ kind: 'transport', slice: input.transport });
  lines.push({ kind: 'loop', region: input.loopRegion });
  for (const channel of input.channels) lines.push({ kind: 'channel', channel });
  for (const roll of input.rolls) lines.push({ kind: 'roll', roll });
  for (const lane of input.lanes) lines.push({ kind: 'lane', lane });
  for (const track of input.djActionTracks) lines.push({ kind: 'dj.track', track });
  return lines.map((line) => JSON.stringify(line)).join('\n') + '\n';
}

/* ── Parse ──────────────────────────────────────────────────────────────── */

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export interface ParsedTimelineJsonl {
  /** Name from the `meta` line. May be empty if absent. */
  name: string;
  slices: DeserializedSlices;
}

export function parseTimelineJsonl(text: string): ParsedTimelineJsonl {
  const empty = emptySessionPayload();
  const slices: DeserializedSlices = {
    channels: { channels: [], rolls: [], lanes: [] },
    djActionTracks: [],
    transportAuthoring: empty.transportAuthoring,
    loopRegion: null,
  };
  let name = '';
  let sawMeta = false;

  /* Accept LF or CRLF; ignore blank lines so files round-tripped through
     editors that add trailing newlines still parse. */
  const rawLines = text.split(/\r?\n/);
  for (let idx = 0; idx < rawLines.length; idx++) {
    const raw = rawLines[idx]!.trim();
    if (raw.length === 0) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new PayloadShapeError(`line ${idx + 1}: not valid JSON (${(err as Error).message})`);
    }
    if (!isObject(parsed) || typeof parsed.kind !== 'string') {
      throw new PayloadShapeError(`line ${idx + 1}: missing string "kind"`);
    }
    switch (parsed.kind) {
      case 'meta': {
        if (typeof parsed.version !== 'number') {
          throw new PayloadShapeError(`line ${idx + 1}: meta.version is not a number`);
        }
        if (parsed.version !== STORAGE_SCHEMA_VERSION) {
          throw new PayloadVersionError(
            parsed.version,
            STORAGE_SCHEMA_VERSION,
            typeof parsed.name === 'string' ? parsed.name : undefined,
          );
        }
        name = typeof parsed.name === 'string' ? parsed.name : '';
        sawMeta = true;
        break;
      }
      case 'transport': {
        if (!isObject(parsed.slice)) {
          throw new PayloadShapeError(`line ${idx + 1}: transport.slice is missing`);
        }
        const slice = parsed.slice as unknown as TransportAuthoringSlice;
        /* Older payloads predate `cuePointTicks`; default to 0 so loads of
           legacy JSONL files are silent. */
        const cuePointTicks = typeof slice.cuePointTicks === 'number' ? slice.cuePointTicks : 0;
        slices.transportAuthoring = { ...slice, cuePointTicks };
        break;
      }
      case 'loop': {
        slices.loopRegion = (parsed.region ?? null) as LoopRegion | null;
        break;
      }
      case 'channel': {
        if (!isObject(parsed.channel)) {
          throw new PayloadShapeError(`line ${idx + 1}: channel.channel is missing`);
        }
        slices.channels.channels.push(parsed.channel as unknown as Channel);
        break;
      }
      case 'roll': {
        if (!isObject(parsed.roll)) {
          throw new PayloadShapeError(`line ${idx + 1}: roll.roll is missing`);
        }
        slices.channels.rolls.push(parsed.roll as unknown as PianoRollTrack);
        break;
      }
      case 'lane': {
        if (!isObject(parsed.lane)) {
          throw new PayloadShapeError(`line ${idx + 1}: lane.lane is missing`);
        }
        slices.channels.lanes.push(parsed.lane as unknown as ParamLane);
        break;
      }
      case 'dj.track': {
        if (!isObject(parsed.track)) {
          throw new PayloadShapeError(`line ${idx + 1}: dj.track.track is missing`);
        }
        slices.djActionTracks.push(parsed.track as unknown as DJActionTrack);
        break;
      }
      default:
        /* Unknown kinds are skipped (forward-compat with future line kinds
           added in a higher schema version that the consumer doesn't know
           about). The version check on `meta` is the authoritative gate. */
        break;
    }
  }

  if (!sawMeta) {
    throw new PayloadShapeError('missing meta line (every payload must start with a meta record)');
  }
  return { name, slices };
}
