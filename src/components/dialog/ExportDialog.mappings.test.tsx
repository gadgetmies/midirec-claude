import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { ToastProvider } from '../toast/Toast';
import { TransportProvider } from '../../hooks/useTransport';
import { StageProvider } from '../../hooks/useStage';
import {
  ControlMapStoreProvider,
  useControlMapStore,
  type ControlMapStoreValue,
} from '../../hooks/useControlMapStore';
import { ExportDialog } from './ExportDialog';
import { serializeControlMap, type ControlMapState } from '../../midi/controlMap';
import type { ControlMapStore } from '../../storage/controlMapStore';

afterEach(() => cleanup());

function fakeStore(initial: ControlMapState): ControlMapStore {
  let held: ControlMapState | null = initial;
  return { isFallback: true, async load() { return held; }, async save(s) { held = s; } };
}

function fileWithText(text: string): File {
  return { text: () => Promise.resolve(text) } as unknown as File;
}

async function harness(initial: ControlMapState) {
  const cap: { store: ControlMapStoreValue | null } = { store: null };
  function Probe() {
    cap.store = useControlMapStore();
    return null;
  }
  const utils = render(
    <ToastProvider>
      <TransportProvider>
        <ControlMapStoreProvider createStore={async () => fakeStore(initial)}>
          <StageProvider>
            <Probe />
            <ExportDialog />
          </StageProvider>
        </ControlMapStoreProvider>
      </TransportProvider>
    </ToastProvider>,
  );
  await waitFor(() => expect(cap.store?.loaded).toBe(true));
  return { cap, ...utils };
}

const empty: ControlMapState = { version: 1, mappings: [] };

describe('ExportDialog — MIDI mappings import/export', () => {
  it('offers export and import controls', async () => {
    const { getByText } = await harness(empty);
    expect(getByText('Export mappings')).toBeTruthy();
    expect(getByText('Import mappings')).toBeTruthy();
  });

  it('imports a valid mapping file, replacing the active set', async () => {
    const { cap, getByLabelText } = await harness(empty);
    const json = serializeControlMap({
      version: 1,
      mappings: [{ target: 'cue', source: { kind: 'note', portId: 'p', channel: 2, data: 40 } }],
    });
    const input = getByLabelText('Import MIDI mappings file') as HTMLInputElement;
    act(() => {
      fireEvent.change(input, { target: { files: [fileWithText(json)] } });
    });
    await waitFor(() => {
      expect(cap.store!.state.mappings).toHaveLength(1);
      expect(cap.store!.state.mappings[0]!.target).toBe('cue');
    });
  });

  it('rejects an invalid file and leaves mappings unchanged', async () => {
    const seeded: ControlMapState = {
      version: 1,
      mappings: [{ target: 'play', source: { kind: 'note', portId: 'p', channel: 1, data: 60 } }],
    };
    const { cap, getByLabelText } = await harness(seeded);
    const input = getByLabelText('Import MIDI mappings file') as HTMLInputElement;
    act(() => {
      fireEvent.change(input, { target: { files: [fileWithText('{ not valid')] } });
    });
    // Give the rejected promise a tick to settle, then assert unchanged.
    await waitFor(() => {
      expect(cap.store!.state.mappings).toHaveLength(1);
      expect(cap.store!.state.mappings[0]!.target).toBe('play');
    });
  });
});
