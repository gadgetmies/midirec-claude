import type { Channel, ChannelId, ParamLane, PianoRollTrack } from '../hooks/useChannels';
import { channelHasContent } from '../hooks/useChannels';
import type { PressurePoint } from '../data/dj';
import { resolvedDjRowOutputCc } from '../data/dj';
import type { DJActionTrack, DJTrackId } from '../hooks/useDJActionTracks';
import { isDJRowAudible } from '../hooks/useDJActionTracks';
import { DEFAULT_MIDI_TPQ, beatsToMidiTicks, toMidi7FromNormVel } from '../midi/timelineTicks';

export type ExportRow =
  | { kind: 'channel'; channelId: ChannelId; key: string }
  | { kind: 'dj'; trackId: DJTrackId; key: string };

export function channelExportKey(channelId: ChannelId): string {
  return `channel:${channelId}`;
}

export function djExportKey(trackId: DJTrackId): string {
  return `dj:${trackId}`;
}

export function buildExportRows(
  channels: Channel[],
  rolls: PianoRollTrack[],
  lanes: ParamLane[],
  djActionTracks: DJActionTrack[],
): ExportRow[] {
  const hideEmptyInstrumentShell = djActionTracks.length > 0;
  const instrumentRows = hideEmptyInstrumentShell
    ? channels.filter((c) => channelHasContent(c, rolls, lanes))
    : [...channels];

  instrumentRows.sort((a, b) => a.id - b.id);

  const out: ExportRow[] = instrumentRows.map((c) => ({
    kind: 'channel',
    channelId: c.id,
    key: channelExportKey(c.id),
  }));

  for (const t of djActionTracks) {
    out.push({ kind: 'dj', trackId: t.id, key: djExportKey(t.id) });
  }

  return out;
}

export type ExportRangeChoice = 'whole' | 'selection' | 'loop';

export interface ExportSelectionResolved {
  channelId: ChannelId;
  indexes: number[];
}

export interface ExportLoopResolved {
  start: number;
  end: number;
}

export function computeResolvedExportRange(
  range: ExportRangeChoice,
  rolls: PianoRollTrack[],
  lanes: ParamLane[],
  djActionTracks: DJActionTrack[],
  resolvedSelection: ExportSelectionResolved | null,
  loopRegion: ExportLoopResolved | null,
): [number, number] {
  if (range === 'loop' && loopRegion) {
    return [loopRegion.start, loopRegion.end];
  }
  if (range === 'selection' && resolvedSelection) {
    const roll = rolls.find((r) => r.channelId === resolvedSelection.channelId);
    if (roll) {
      let lo = Infinity;
      let hi = -Infinity;
      for (const idx of resolvedSelection.indexes) {
        const n = roll.notes[idx];
        if (!n) continue;
        if (n.t < lo) lo = n.t;
        if (n.t + n.dur > hi) hi = n.t + n.dur;
      }
      if (Number.isFinite(lo)) return [lo, hi];
    }
  }
  let hi = 0;
  for (const r of rolls) {
    for (const n of r.notes) {
      const end = n.t + n.dur;
      if (end > hi) hi = end;
    }
  }
  for (const l of lanes) {
    for (const p of l.points) {
      if (p.t > hi) hi = p.t;
    }
  }
  for (const tr of djActionTracks) {
    for (const e of tr.events) {
      const end = e.t + e.dur;
      if (end > hi) hi = end;
    }
  }
  return [0, hi];
}

export function countDjCatalogEvents(track: DJActionTrack): { actions: number; events: number } {
  const actions = Object.keys(track.actionMap).length;
  const events = track.events.filter((e) =>
    Object.prototype.hasOwnProperty.call(track.actionMap, e.pitch),
  ).length;
  return { actions, events };
}

export function countExportTallyEvents(
  rolls: PianoRollTrack[],
  lanes: ParamLane[],
  djActionTracks: DJActionTrack[],
  [t0, t1]: [number, number],
  tracksOn: Set<string>,
  includeChannelCc: boolean,
  soloing: boolean,
): number {
  let count = 0;
  for (const r of rolls) {
    if (!tracksOn.has(channelExportKey(r.channelId))) continue;
    for (const n of r.notes) {
      if (n.t >= t0 && n.t < t1) count++;
    }
  }
  if (includeChannelCc) {
    for (const l of lanes) {
      if (!tracksOn.has(channelExportKey(l.channelId))) continue;
      for (const p of l.points) {
        if (p.t >= t0 && p.t < t1) count++;
      }
    }
  }
  for (const track of djActionTracks) {
    if (!tracksOn.has(djExportKey(track.id))) continue;
    if (track.muted) continue;
    for (const ev of track.events) {
      if (!Object.prototype.hasOwnProperty.call(track.actionMap, ev.pitch)) continue;
      if (!(ev.t >= t0 && ev.t < t1)) continue;
      if (!isDJRowAudible(track, ev.pitch, soloing)) continue;
      count++;
    }
  }
  return count;
}

export type DjExportJsonNoteLine = {
  kind: 'dj.action';
  version: 2;
  message: 'note';
  tick: number;
  tpq: number;
  midiChannel: number;
  trackId: DJTrackId;
  trackName: string;
  actionId: string;
  pitch: number;
  velocity: number;
  durationTicks: number;
  pressure?: PressurePoint[];
};

export type DjExportJsonCcLine = {
  kind: 'dj.action';
  version: 2;
  message: 'cc';
  tick: number;
  tpq: number;
  midiChannel: number;
  trackId: DJTrackId;
  trackName: string;
  actionId: string;
  controller: number;
  value: number;
};

export type DjExportJsonLine = DjExportJsonNoteLine | DjExportJsonCcLine;

function resolvedEmitMidiChannel(track: DJActionTrack, pitch: number): number {
  const o = track.outputMap[pitch];
  if (o && o.channel >= 1 && o.channel <= 16) return Math.round(o.channel);
  const ch = track.midiChannel;
  return ch >= 1 && ch <= 16 ? Math.round(ch) : 1;
}

function resolvedEmitPitch(track: DJActionTrack, rowPitch: number, eventPitch: number): number {
  const o = track.outputMap[rowPitch];
  if (o && Number.isFinite(o.pitch)) {
    const p = Math.round(o.pitch);
    return Math.max(0, Math.min(127, p));
  }
  return Math.max(0, Math.min(127, Math.round(eventPitch)));
}

export function collectDjExportJsonLines(
  djActionTracks: DJActionTrack[],
  tracksOn: Set<string>,
  soloing: boolean,
  [t0, t1]: [number, number],
  tpq: number = DEFAULT_MIDI_TPQ,
): DjExportJsonLine[] {
  const rows: DjExportJsonLine[] = [];
  for (const track of djActionTracks) {
    if (!tracksOn.has(djExportKey(track.id))) continue;
    if (track.muted) continue;
    const base = {
      kind: 'dj.action' as const,
      version: 2 as const,
      tpq,
      trackId: track.id,
      trackName: track.name,
    };
    for (const ev of track.events) {
      if (!Object.prototype.hasOwnProperty.call(track.actionMap, ev.pitch)) continue;
      if (!(ev.t >= t0 && ev.t < t1)) continue;
      if (!isDJRowAudible(track, ev.pitch, soloing)) continue;
      const action = track.actionMap[ev.pitch];
      const chOut = resolvedEmitMidiChannel(track, ev.pitch);
      const ccNum = resolvedDjRowOutputCc(track.actionMap, track.outputMap, ev.pitch);
      const tick = beatsToMidiTicks(ev.t, tpq);

      if (ccNum !== undefined) {
        rows.push({
          ...base,
          message: 'cc',
          tick,
          midiChannel: chOut,
          actionId: action.id,
          controller: ccNum,
          value: toMidi7FromNormVel(ev.vel),
        });
        continue;
      }

      const pitchOut = resolvedEmitPitch(track, ev.pitch, ev.pitch);
      const line: DjExportJsonNoteLine = {
        ...base,
        message: 'note',
        tick,
        midiChannel: chOut,
        actionId: action.id,
        pitch: pitchOut,
        velocity: toMidi7FromNormVel(ev.vel),
        durationTicks: Math.max(0, beatsToMidiTicks(ev.dur, tpq)),
      };
      if (ev.pressure !== undefined) line.pressure = ev.pressure;
      rows.push(line);
    }
  }
  return rows;
}
