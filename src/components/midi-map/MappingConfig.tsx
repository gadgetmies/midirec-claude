import { useState } from 'react';
import { useMidiControl } from '../../midi/MidiControlProvider';
import { useControlMapStore } from '../../hooks/useControlMapStore';
import { useMidiInputs, useMidiOutputs } from '../../midi/MidiRuntimeProvider';
import {
  TARGET_REGISTRY,
  type ContinuousConfig,
  type ControlSource,
  type FeedbackConfig,
  type RelativeEncoding,
  type SourceKind,
  type TargetKey,
} from '../../midi/controlMap';
import { mappingForTarget } from './mapMode';
import './midiMap.css';

/** Manual source editor — set a control's source without learning. Creating or
    editing the source goes through `assign`, which preserves any existing
    advanced config and enforces one-source-to-one-target. */
function SourceEditor({ target }: { target: TargetKey }) {
  const { state, assign } = useControlMapStore();
  const { inputs } = useMidiInputs();
  const existing = mappingForTarget(state, target)?.source;
  const [draft, setDraft] = useState<ControlSource>(
    () =>
      existing ?? {
        kind: 'note',
        portId: inputs[0]?.id ?? '',
        channel: 1,
        data: 60,
        anyPort: true,
      },
  );

  const apply = (patch: Partial<ControlSource>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    assign(target, next);
  };

  const showData = draft.kind === 'note' || draft.kind === 'cc';

  return (
    <fieldset className="mr-map-fieldset" data-mr-map-source-editor>
      <legend className="mr-map-field__lbl">Source (manual)</legend>
      <label className="mr-map-field">
        <span className="mr-map-field__lbl">Type</span>
        <select
          value={draft.kind}
          onChange={(e) => apply({ kind: e.target.value as SourceKind })}
        >
          <option value="note">Note</option>
          <option value="cc">CC</option>
          <option value="pressure">Aftertouch</option>
          <option value="pb">Pitch bend</option>
        </select>
      </label>
      <label className="mr-map-field">
        <span className="mr-map-field__lbl">Channel</span>
        <input
          type="number"
          min={1}
          max={16}
          value={draft.channel}
          onChange={(e) => apply({ channel: Number(e.target.value) })}
        />
      </label>
      {showData && (
        <label className="mr-map-field">
          <span className="mr-map-field__lbl">{draft.kind === 'cc' ? 'CC #' : 'Note #'}</span>
          <input
            type="number"
            min={0}
            max={127}
            value={draft.data}
            onChange={(e) => apply({ data: Number(e.target.value) })}
          />
        </label>
      )}
      <label className="mr-map-field mr-map-field--check">
        <input
          type="checkbox"
          checked={draft.anyPort ?? false}
          onChange={(e) => apply({ anyPort: e.target.checked })}
        />
        <span className="mr-map-field__lbl">Any device</span>
      </label>
      {!draft.anyPort && (
        <label className="mr-map-field">
          <span className="mr-map-field__lbl">Device</span>
          <select value={draft.portId} onChange={(e) => apply({ portId: e.target.value })}>
            <option value="">(none)</option>
            {inputs.map((dev) => (
              <option key={dev.id} value={dev.id}>
                {dev.name}
              </option>
            ))}
          </select>
        </label>
      )}
    </fieldset>
  );
}

const PHRASE_TARGETS = new Set(['phraseForward', 'phraseBack']);

const DEFAULT_CONTINUOUS: ContinuousConfig = {
  mode: 'absolute',
  min: 60,
  max: 200,
  takeover: true,
  encoding: 'twosComplement',
  step: 1,
};

const DEFAULT_FEEDBACK: FeedbackConfig = {
  enabled: false,
  portId: '',
  channel: 1,
  kind: 'note',
  data: 36,
  onValue: 127,
  offValue: 0,
};

/** The Inspector-dock advanced-config panel shown in map mode. Exposes only the
    fields relevant to the armed target's kind; edits persist to the store. */
export function MappingConfig() {
  const { armedTarget } = useMidiControl();
  const { state, updateMapping, clear } = useControlMapStore();
  const { outputs } = useMidiOutputs();

  if (!armedTarget) {
    return (
      <div className="mr-map-config" data-mr-map-panel="config">
        <p className="mr-map-config__hint">Select a mapping to configure its advanced options.</p>
      </div>
    );
  }

  const def = TARGET_REGISTRY[armedTarget];
  const mapping = mappingForTarget(state, armedTarget);

  if (!mapping) {
    return (
      <div className="mr-map-config" data-mr-map-panel="config">
        <div className="mr-map-config__head mr-mono">{def.label}</div>
        <p className="mr-map-config__hint">
          Move a MIDI control to learn this target, or set the source manually:
        </p>
        <SourceEditor key={armedTarget} target={armedTarget} />
      </div>
    );
  }

  const cont = mapping.continuous ?? DEFAULT_CONTINUOUS;
  const fb = mapping.feedback ?? DEFAULT_FEEDBACK;
  const patchContinuous = (patch: Partial<ContinuousConfig>) =>
    updateMapping(armedTarget, { continuous: { ...cont, ...patch } });
  const patchFeedback = (patch: Partial<FeedbackConfig>) =>
    updateMapping(armedTarget, { feedback: { ...fb, ...patch } });

  return (
    <div className="mr-map-config" data-mr-map-panel="config">
      <div className="mr-map-config__head mr-mono">{def.label}</div>

      <SourceEditor key={armedTarget} target={armedTarget} />

      {(def.kind === 'trigger' || def.kind === 'toggle') && (
        <label className="mr-map-field">
          <span className="mr-map-field__lbl">Edge</span>
          <select
            value={mapping.edge ?? 'press'}
            onChange={(e) => updateMapping(armedTarget, { edge: e.target.value as 'press' | 'release' })}
          >
            <option value="press">Press</option>
            <option value="release">Release</option>
          </select>
        </label>
      )}

      {def.kind === 'toggle' && (
        <label className="mr-map-field">
          <span className="mr-map-field__lbl">Button mode</span>
          <select
            value={mapping.buttonMode ?? 'toggle'}
            onChange={(e) =>
              updateMapping(armedTarget, { buttonMode: e.target.value as 'toggle' | 'momentary' })
            }
          >
            <option value="toggle">Toggle</option>
            <option value="momentary">Momentary</option>
          </select>
        </label>
      )}

      {(def.kind === 'trigger' || def.kind === 'toggle') && (
        <label className="mr-map-field">
          <span className="mr-map-field__lbl">Threshold</span>
          <input
            type="number"
            min={0}
            max={127}
            value={mapping.minValue ?? 1}
            onChange={(e) => updateMapping(armedTarget, { minValue: Number(e.target.value) })}
          />
        </label>
      )}

      {PHRASE_TARGETS.has(armedTarget) && (
        <label className="mr-map-field">
          <span className="mr-map-field__lbl">Bars / phrase</span>
          <input
            type="number"
            min={1}
            max={32}
            value={mapping.barsPerPhrase ?? 8}
            onChange={(e) => updateMapping(armedTarget, { barsPerPhrase: Number(e.target.value) })}
          />
        </label>
      )}

      {def.kind === 'continuous' && (
        <>
          <label className="mr-map-field">
            <span className="mr-map-field__lbl">Mode</span>
            <select
              value={cont.mode}
              onChange={(e) => patchContinuous({ mode: e.target.value as 'absolute' | 'relative' })}
            >
              <option value="absolute">Absolute</option>
              <option value="relative">Relative</option>
            </select>
          </label>
          <label className="mr-map-field">
            <span className="mr-map-field__lbl">Min</span>
            <input
              type="number"
              value={cont.min}
              onChange={(e) => patchContinuous({ min: Number(e.target.value) })}
            />
          </label>
          <label className="mr-map-field">
            <span className="mr-map-field__lbl">Max</span>
            <input
              type="number"
              value={cont.max}
              onChange={(e) => patchContinuous({ max: Number(e.target.value) })}
            />
          </label>
          {cont.mode === 'absolute' && (
            <label className="mr-map-field mr-map-field--check">
              <input
                type="checkbox"
                checked={cont.takeover}
                onChange={(e) => patchContinuous({ takeover: e.target.checked })}
              />
              <span className="mr-map-field__lbl">Soft takeover</span>
            </label>
          )}
          {cont.mode === 'relative' && (
            <>
              <label className="mr-map-field">
                <span className="mr-map-field__lbl">Encoding</span>
                <select
                  value={cont.encoding ?? 'twosComplement'}
                  onChange={(e) => patchContinuous({ encoding: e.target.value as RelativeEncoding })}
                >
                  <option value="twosComplement">Two&rsquo;s complement</option>
                  <option value="signMagnitude">Sign-magnitude</option>
                  <option value="offsetBinary">Offset binary (64)</option>
                </select>
              </label>
              <label className="mr-map-field">
                <span className="mr-map-field__lbl">Step</span>
                <input
                  type="number"
                  min={1}
                  value={cont.step ?? 1}
                  onChange={(e) => patchContinuous({ step: Number(e.target.value) })}
                />
              </label>
            </>
          )}
        </>
      )}

      {def.kind === 'enum' && (
        <label className="mr-map-field">
          <span className="mr-map-field__lbl">Step mode</span>
          <select
            value={mapping.enumMode ?? 'cycle'}
            onChange={(e) => updateMapping(armedTarget, { enumMode: e.target.value as 'cycle' | 'select' })}
          >
            <option value="cycle">Cycle (advance on press)</option>
            <option value="select">Select (value picks option)</option>
          </select>
        </label>
      )}

      {(def.kind === 'toggle' || def.kind === 'enum') && (
        <fieldset className="mr-map-fieldset">
          <legend className="mr-map-field__lbl">LED feedback</legend>
          <label className="mr-map-field mr-map-field--check">
            <input
              type="checkbox"
              checked={fb.enabled}
              onChange={(e) => patchFeedback({ enabled: e.target.checked })}
            />
            <span className="mr-map-field__lbl">Enabled</span>
          </label>
          {fb.enabled && (
            <>
              <label className="mr-map-field">
                <span className="mr-map-field__lbl">Port</span>
                <select value={fb.portId} onChange={(e) => patchFeedback({ portId: e.target.value })}>
                  <option value="">(none)</option>
                  {outputs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mr-map-field">
                <span className="mr-map-field__lbl">Kind</span>
                <select
                  value={fb.kind}
                  onChange={(e) => patchFeedback({ kind: e.target.value as 'note' | 'cc' })}
                >
                  <option value="note">Note</option>
                  <option value="cc">CC</option>
                </select>
              </label>
              <label className="mr-map-field">
                <span className="mr-map-field__lbl">Data</span>
                <input
                  type="number"
                  min={0}
                  max={127}
                  value={fb.data}
                  onChange={(e) => patchFeedback({ data: Number(e.target.value) })}
                />
              </label>
            </>
          )}
        </fieldset>
      )}

      <button
        type="button"
        className="mr-map-config__clear"
        onClick={() => clear(armedTarget)}
      >
        Clear mapping
      </button>
    </div>
  );
}
