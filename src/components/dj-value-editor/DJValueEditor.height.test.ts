/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import {
  DJ_VALUE_EDITOR_HEIGHT_DEFAULT,
  DJ_VALUE_EDITOR_HEIGHT_KEY,
  clampEditorHeight,
  readPersistedHeight,
} from './DJValueEditor';

describe('DJValueEditor height persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  test('clampEditorHeight enforces 48..400', () => {
    expect(clampEditorHeight(0)).toBe(48);
    expect(clampEditorHeight(48)).toBe(48);
    expect(clampEditorHeight(96)).toBe(96);
    expect(clampEditorHeight(400)).toBe(400);
    expect(clampEditorHeight(600)).toBe(400);
    expect(clampEditorHeight(-100)).toBe(48);
  });

  test('readPersistedHeight returns default with no stored value', () => {
    expect(readPersistedHeight()).toBe(DJ_VALUE_EDITOR_HEIGHT_DEFAULT);
    expect(readPersistedHeight()).toBe(96);
  });

  test('readPersistedHeight restores stored value within clamp', () => {
    localStorage.setItem(DJ_VALUE_EDITOR_HEIGHT_KEY, '180');
    expect(readPersistedHeight()).toBe(180);
  });

  test('readPersistedHeight clamps an oversized stored value to 400', () => {
    localStorage.setItem(DJ_VALUE_EDITOR_HEIGHT_KEY, '600');
    expect(readPersistedHeight()).toBe(400);
  });

  test('readPersistedHeight clamps an undersized stored value to 48', () => {
    localStorage.setItem(DJ_VALUE_EDITOR_HEIGHT_KEY, '10');
    expect(readPersistedHeight()).toBe(48);
  });

  test('readPersistedHeight ignores non-numeric stored value', () => {
    localStorage.setItem(DJ_VALUE_EDITOR_HEIGHT_KEY, 'not-a-number');
    expect(readPersistedHeight()).toBe(96);
  });
});
