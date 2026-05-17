import type { Marquee, Note } from '../components/piano-roll/notes';
import type { CCPoint } from '../components/param-lanes/ccPoints';
import type { ActionEvent } from '../data/dj';
import type { DJActionTrack } from '../hooks/useDJActionTracks';
import type { ParamLane, PianoRollTrack } from '../hooks/useChannels';
import { beatsToSessionTicks } from './sessionTicks';
import { DEFAULT_MIDI_TPQ } from './timelineTicks';

type LegacyTimed = { t?: number; dur?: number };

export function migrateNote(raw: Note | (LegacyTimed & Pick<Note, 'pitch' | 'vel'>), tpq = DEFAULT_MIDI_TPQ): Note {
  const draft = raw as Note & LegacyTimed;
  if (Number.isFinite(draft.tTicks) && Number.isFinite(draft.durTicks)) {
    return {
      pitch: draft.pitch,
      vel: draft.vel,
      tTicks: Math.max(0, Math.round(draft.tTicks)),
      durTicks: Math.max(1, Math.round(draft.durTicks)),
    };
  }
  const t = Number(draft.t) || 0;
  const dur = Number(draft.dur) || 0;
  return {
    pitch: draft.pitch,
    vel: draft.vel,
    tTicks: beatsToSessionTicks(t, tpq),
    durTicks: Math.max(1, beatsToSessionTicks(dur, tpq)),
  };
}

export function migrateActionEvent(
  raw: ActionEvent | (LegacyTimed & Pick<ActionEvent, 'pitch' | 'vel'> & Partial<Pick<ActionEvent, 'pressure'>>),
  tpq = DEFAULT_MIDI_TPQ,
): ActionEvent {
  const draft = raw as ActionEvent & LegacyTimed;
  const base = migrateNote(draft, tpq);
  const out: ActionEvent = { pitch: base.pitch, vel: base.vel, tTicks: base.tTicks, durTicks: base.durTicks };
  if (draft.pressure !== undefined) out.pressure = draft.pressure;
  return out;
}

export function migrateCCPoint(raw: CCPoint | (LegacyTimed & Pick<CCPoint, 'v'>), tpq = DEFAULT_MIDI_TPQ): CCPoint {
  const draft = raw as CCPoint & LegacyTimed;
  if (Number.isFinite(draft.tTicks)) {
    return { v: draft.v, tTicks: Math.max(0, Math.round(draft.tTicks)) };
  }
  const t = Number(draft.t) || 0;
  return { v: draft.v, tTicks: beatsToSessionTicks(t, tpq) };
}

export function migrateMarquee(
  raw: Marquee | { t0?: number; t1?: number; t0Ticks?: number; t1Ticks?: number; p0: number; p1: number },
  tpq = DEFAULT_MIDI_TPQ,
): Marquee {
  const draft = raw as Marquee & { t0?: number; t1?: number };
  if (Number.isFinite(draft.t0Ticks) && Number.isFinite(draft.t1Ticks)) {
    return { t0Ticks: draft.t0Ticks, t1Ticks: draft.t1Ticks, p0: draft.p0, p1: draft.p1 };
  }
  const t0 = Number(draft.t0) || 0;
  const t1 = Number(draft.t1) || 0;
  return {
    t0Ticks: beatsToSessionTicks(t0, tpq),
    t1Ticks: beatsToSessionTicks(t1, tpq),
    p0: draft.p0,
    p1: draft.p1,
  };
}

export interface SessionTickMigrationSnapshot {
  rolls: PianoRollTrack[];
  lanes: ParamLane[];
  djTracks: DJActionTrack[];
}

export function migrateSessionBeatsToTicks(inp: SessionTickMigrationSnapshot, tpq = DEFAULT_MIDI_TPQ): SessionTickMigrationSnapshot {
  return {
    rolls: inp.rolls.map((r) => ({
      ...r,
      notes: r.notes.map((n) => migrateNote(n, tpq)),
    })),
    lanes: inp.lanes.map((l) => ({
      ...l,
      points: l.points.map((p) => migrateCCPoint(p, tpq)),
    })),
    djTracks: inp.djTracks.map((t) => ({
      ...t,
      events: t.events.map((e) => migrateActionEvent(e, tpq)),
    })),
  };
}
