import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ToastProvider } from '../toast/Toast';
import { StageProvider } from '../../hooks/useStage';
import { TimelineDropProvider } from '../../hooks/useTimelineDrop';
import { TimelineStorageProvider } from '../../hooks/useTimelineStorage';
import { TransportProvider } from '../../hooks/useTransport';
import { StorageControls } from './StorageControls';

beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).indexedDB = new IDBFactory();
});

afterEach(() => {
  cleanup();
});

function Tree({ children }: { children: ReactNode }) {
  return (
    <TransportProvider>
      <ToastProvider>
        <StageProvider>
          <TimelineStorageProvider>
            <TimelineDropProvider>{children}</TimelineDropProvider>
          </TimelineStorageProvider>
        </StageProvider>
      </ToastProvider>
    </TransportProvider>
  );
}

async function mountAndReady() {
  const utils = render(
    <Tree>
      <StorageControls />
    </Tree>,
  );
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
  return utils;
}

describe('Toolstrip StorageControls — Save popover', () => {
  test('Save icon button opens a popover with name input + Save + Download', async () => {
    await mountAndReady();
    expect(screen.queryByPlaceholderText('Name…')).toBe(null);

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Save timeline'));
    });

    expect(screen.getByPlaceholderText('Name…')).toBeDefined();
    expect(screen.getByRole('button', { name: /^Save$/ })).toBeDefined();
    expect(screen.getByRole('button', { name: /Download/ })).toBeDefined();
  });

  test('Save is disabled when the trimmed name is empty', async () => {
    await mountAndReady();
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Save timeline'));
    });
    const saveBtn = screen.getByRole('button', { name: /^Save$/ }) as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);

    const input = screen.getByPlaceholderText('Name…') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'mix1' } });
    expect(saveBtn.disabled).toBe(false);
  });

  test('clicking Save saves and closes the popover', async () => {
    await mountAndReady();
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Save timeline'));
    });
    const input = screen.getByPlaceholderText('Name…') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: 'take1' } });
      fireEvent.click(screen.getByRole('button', { name: /^Save$/ }));
    });

    // Popover should close.
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Name…')).toBe(null);
    });

    // Reopen via Open dropdown and verify the entry exists.
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Open timeline'));
    });
    expect(screen.getByText('take1')).toBeDefined();
  });

  test('Save button label flips to "Overwrite" when an entry under the name exists', async () => {
    await mountAndReady();
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Save timeline'));
    });
    const input = screen.getByPlaceholderText('Name…') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: 'demo' } });
      fireEvent.click(screen.getByRole('button', { name: /^Save$/ }));
    });
    await waitFor(() => expect(screen.queryByPlaceholderText('Name…')).toBe(null));

    // Let store list + entries propagation settle before reopening.
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });
    }

    // Reopen the popover. The persisted nameInput is still "demo" so the
    // button should immediately read Overwrite.
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Save timeline'));
    });
    expect(screen.getByRole('button', { name: /^Overwrite$/ })).toBeDefined();
  });
});

describe('Toolstrip StorageControls — Open dropdown', () => {
  test('Open icon button opens a dropdown; empty state shows placeholder + Upload row', async () => {
    await mountAndReady();
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Open timeline'));
    });
    expect(screen.getByText('No saved timelines')).toBeDefined();
    expect(screen.getByText(/Upload \.jsonl/)).toBeDefined();
  });

  test('Escape closes the dropdown', async () => {
    await mountAndReady();
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Open timeline'));
    });
    expect(screen.getByText('No saved timelines')).toBeDefined();
    await act(async () => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });
    expect(screen.queryByText('No saved timelines')).toBe(null);
  });

  test('name input defaults to the currently-loaded timeline name', async () => {
    await mountAndReady();

    // Save a timeline named "session-a".
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Save timeline'));
    });
    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('Name…') as HTMLInputElement, {
        target: { value: 'session-a' },
      });
      fireEvent.click(screen.getByRole('button', { name: /^Save$/ }));
    });
    await waitFor(() => expect(screen.queryByPlaceholderText('Name…')).toBe(null));

    // Reopen Save: the input should default back to "session-a".
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Save timeline'));
    });
    expect((screen.getByPlaceholderText('Name…') as HTMLInputElement).value).toBe('session-a');

    // Close and load "session-a" from the Open dropdown. The Save input
    // should still default to "session-a" afterwards.
    await act(async () => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Open timeline'));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'session-a' }));
    });

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Save timeline'));
    });
    expect((screen.getByPlaceholderText('Name…') as HTMLInputElement).value).toBe('session-a');
  });

  test('opening Save closes a previously-open Open dropdown', async () => {
    await mountAndReady();
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Open timeline'));
    });
    expect(screen.getByText('No saved timelines')).toBeDefined();
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Save timeline'));
    });
    expect(screen.queryByText('No saved timelines')).toBe(null);
    expect(screen.getByPlaceholderText('Name…')).toBeDefined();
  });
});
