/* Modal asking the user whether to save the current (unsaved) timeline
   before opening a dropped or uploaded file. Reuses the Export dialog's
   `.mr-dialog-scrim` / `.mr-dialog` chrome. Three exits: Save, Discard,
   Cancel — the parent owns what each does. */

import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import './Dialog.css';

export type SaveBeforeOpenChoice = 'save' | 'discard' | 'cancel';

export interface SaveBeforeOpenDialogProps {
  /** Short description of what's about to be opened (e.g. the filename). */
  incomingLabel: string;
  /** Returns the resolved choice. `name` is non-empty only when choice === 'save'. */
  onResolve: (result: { choice: SaveBeforeOpenChoice; name: string }) => void;
}

export function SaveBeforeOpenDialog({ incomingLabel, onResolve }: SaveBeforeOpenDialogProps) {
  const [name, setName] = useState('');
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<Element | null>(null);

  const trimmedName = name.trim();
  const saveDisabled = trimmedName.length === 0;

  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    const root = dialogRef.current;
    if (root) {
      const focusables = root.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled])',
      );
      if (focusables.length > 0) focusables[0]?.focus();
    }
    return () => {
      const prev = previousFocusRef.current;
      if (prev instanceof HTMLElement) prev.focus();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onResolve({ choice: 'cancel', name: '' });
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onResolve]);

  const handleScrim = (e: SyntheticEvent) => {
    if (e.target === e.currentTarget) onResolve({ choice: 'cancel', name: '' });
  };

  const handleSave = () => {
    if (saveDisabled) return;
    onResolve({ choice: 'save', name: trimmedName });
  };

  return (
    <div className="mr-dialog-scrim" onClick={handleScrim}>
      <div
        className="mr-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mr-save-prompt-title"
        ref={dialogRef}
      >
        <div className="mr-dialog__hd">
          <h3 id="mr-save-prompt-title">Save before opening?</h3>
          <p>
            You have unsaved changes. Opening <strong>{incomingLabel}</strong> will discard them.
          </p>
        </div>
        <div className="mr-dialog__body">
          <div className="mr-row">
            <span className="mr-row-lbl">Save as</span>
            <input
              className="mr-input"
              type="text"
              placeholder="Name…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSave();
                }
              }}
              style={{ flex: 2 }}
            />
          </div>
        </div>
        <div className="mr-dialog__ft">
          <button
            type="button"
            className="mr-btn"
            onClick={() => onResolve({ choice: 'cancel', name: '' })}
          >
            Cancel
          </button>
          <button
            type="button"
            className="mr-btn"
            data-danger="true"
            onClick={() => onResolve({ choice: 'discard', name: '' })}
          >
            Discard
          </button>
          <button
            type="button"
            className="mr-btn"
            data-primary="true"
            disabled={saveDisabled}
            onClick={handleSave}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
