/* DJValueEditor mode derivation — pure function over selection state.

   The editor mounts only when the derived mode is non-hidden; this module
   is the single source of truth for that decision so the component, tests,
   and AppShell mount-gate all read the same rule. */

import { actionMode, resolveOutKind, type ActionEvent, type ActionMapEntry, type OutputMapping } from '../../data/dj';
import type { DJActionTrack } from '../../hooks/useDJActionTracks';
import type { DJActionSelection, DJEventSelection } from '../../hooks/useStage';

export type DJTrackId = string;

export type EditorMode =
  | { kind: 'cc'; trackId: DJTrackId; pitch: number }
  | { kind: 'pb'; trackId: DJTrackId; pitch: number }
  | { kind: 'at'; trackId: DJTrackId; pitch: number; eventIdx: number }
  | { kind: 'hidden' };

export interface StageSubsetForEditor {
  djActionTracks: readonly DJActionTrack[];
  djActionSelection: DJActionSelection | null;
  djEventSelection: DJEventSelection | null;
}

const HIDDEN: EditorMode = { kind: 'hidden' };

/** Derive the editor's mode from selection state. Pure; safe to call on every
 *  render. The component's shift-anchor SHALL clear whenever the returned
 *  target identity changes. */
export function deriveEditorMode(stage: StageSubsetForEditor): EditorMode {
  const evtSel = stage.djEventSelection;
  const actSel = stage.djActionSelection;

  if (evtSel) {
    const track = stage.djActionTracks.find((t) => t.id === evtSel.trackId);
    const action: ActionMapEntry | undefined = track?.actionMap[evtSel.pitch];
    const event: ActionEvent | undefined = track?.events[evtSel.eventIdx];
    /* An event selection produces AT mode ONLY when it points at a valid
       event on a pressure-bearing row. Otherwise (e.g. user clicked a
       CC/PB cluster — fireEventClick sets both selections) the editor
       falls through to the action-selection branch so the same click
       opens the editor in CC/PB mode. */
    if (track && action && event && event.pitch === evtSel.pitch && action.pressure === true) {
      return {
        kind: 'at',
        trackId: evtSel.trackId,
        pitch: evtSel.pitch,
        eventIdx: evtSel.eventIdx,
      };
    }
  }

  if (actSel) {
    const track = stage.djActionTracks.find((t) => t.id === actSel.trackId);
    if (!track) return HIDDEN;
    const action: ActionMapEntry | undefined = track.actionMap[actSel.pitch];
    if (!action) return HIDDEN;
    const mode = actionMode(action);
    if (mode === 'trigger' || mode === 'fallback') return HIDDEN;
    const mapping: OutputMapping | undefined = track.outputMap[actSel.pitch];
    const kind = resolveOutKind(mapping);
    if (kind === 'pb') {
      return { kind: 'pb', trackId: actSel.trackId, pitch: actSel.pitch };
    }
    if (kind === 'cc') {
      return { kind: 'cc', trackId: actSel.trackId, pitch: actSel.pitch };
    }
    /* note-mode rows: no value to paint via this editor */
    return HIDDEN;
  }

  return HIDDEN;
}

/** Stable identity key for the editor's current target. Components compare
 *  this across renders to decide when to clear the shift-anchor. */
export function editorTargetKey(mode: EditorMode): string {
  switch (mode.kind) {
    case 'cc':
    case 'pb':
      return `${mode.kind}|${mode.trackId}|${mode.pitch}`;
    case 'at':
      return `at|${mode.trackId}|${mode.pitch}|${mode.eventIdx}`;
    case 'hidden':
      return 'hidden';
  }
}
