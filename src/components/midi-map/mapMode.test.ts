import { describe, expect, it } from 'vitest';
import { mappableTargetGroups, noteName, sourceBadgeLabel } from './mapMode';

describe('noteName', () => {
  it('names middle C (60) as C4', () => {
    expect(noteName(60)).toBe('C4');
  });
  it('names 61 as C#4', () => {
    expect(noteName(61)).toBe('C#4');
  });
});

describe('sourceBadgeLabel', () => {
  it('labels a note by name', () => {
    expect(sourceBadgeLabel({ kind: 'note', portId: 'p', channel: 1, data: 60 })).toBe('C4');
  });
  it('labels a CC by controller number', () => {
    expect(sourceBadgeLabel({ kind: 'cc', portId: 'p', channel: 1, data: 14 })).toBe('CC14');
  });
  it('labels pressure as AT and pitch-bend as PB', () => {
    expect(sourceBadgeLabel({ kind: 'pressure', portId: 'p', channel: 1, data: 0 })).toBe('AT');
    expect(sourceBadgeLabel({ kind: 'pb', portId: 'p', channel: 1, data: 0 })).toBe('PB');
  });
});

describe('mappableTargetGroups', () => {
  it('groups targets by kind and includes the transport triggers', () => {
    const groups = mappableTargetGroups();
    const trigger = groups.find((g) => g.kind === 'trigger');
    expect(trigger).toBeTruthy();
    const keys = trigger!.targets.map((t) => t.key);
    expect(keys).toContain('rewind');
    expect(keys).toContain('phraseForward');
  });

  it('places play (play/pause) in the toggle group with a button mode', () => {
    const groups = mappableTargetGroups();
    expect(groups.find((g) => g.kind === 'toggle')!.targets.map((t) => t.key)).toContain('play');
  });

  it('places continuous (BPM) and enum (grid/clock) in their own groups', () => {
    const groups = mappableTargetGroups();
    expect(groups.find((g) => g.kind === 'continuous')!.targets.map((t) => t.key)).toContain('setBpm');
    expect(groups.find((g) => g.kind === 'enum')!.targets.map((t) => t.key)).toContain('cycleQuantizeGrid');
  });
});
