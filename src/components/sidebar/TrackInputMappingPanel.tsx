import { useStage } from '../../hooks/useStage';
import type { ChannelId } from '../../hooks/useChannels';
import { useMidiInputs } from '../../midi/MidiRuntimeProvider';
import { Panel } from './Panel';
import { MicIcon } from '../icons/transport';

const ALL_MIDI_CHANNELS: ChannelId[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];

function channelsAreAllSelected(channels: ChannelId[]): boolean {
  if (channels.length !== 16) return false;
  const set = new Set(channels);
  for (let i = 1; i <= 16; i++) {
    if (!set.has(i as ChannelId)) return false;
  }
  return true;
}

export function TrackInputMappingPanel() {
  const stage = useStage();
  const { inputs } = useMidiInputs();
  const sel = stage.selectedTimelineTrack;

  const rowFor = (deviceId: string) => {
    if (!sel || sel.kind !== 'channel') return undefined;
    const ch = stage.channels.find((c) => c.id === sel.channelId);
    return ch?.inputSources.find((r) => r.inputDeviceId === deviceId);
  };

  const setChannelsForDevice = (deviceId: string, next: ChannelId[]) => {
    if (!sel || sel.kind !== 'channel') return;
    stage.setChannelInputSourceChannels(sel.channelId, deviceId, next);
  };

  const toggleChannel = (deviceId: string, ch: ChannelId) => {
    const cur = rowFor(deviceId)?.channels ?? [];
    const has = cur.includes(ch);
    const next = has ? cur.filter((c) => c !== ch) : [...cur, ch];
    setChannelsForDevice(deviceId, next);
  };

  const deviceEnabled = (deviceId: string) => (rowFor(deviceId)?.channels.length ?? 0) > 0;

  const toggleDevice = (deviceId: string) => {
    if (deviceEnabled(deviceId)) {
      setChannelsForDevice(deviceId, []);
    } else {
      setChannelsForDevice(deviceId, [1]);
    }
  };

  const toggleAllChannels = (deviceId: string) => {
    const cur = rowFor(deviceId)?.channels ?? [];
    if (channelsAreAllSelected(cur)) {
      setChannelsForDevice(deviceId, []);
    } else {
      setChannelsForDevice(deviceId, [...ALL_MIDI_CHANNELS]);
    }
  };

  if (!sel) {
    return (
      <Panel icon={<MicIcon />} title="Track input">
        <p className="mr-track-in__hint">Select a track in the timeline to configure MIDI input.</p>
      </Panel>
    );
  }

  if (sel.kind === 'dj') {
    const track = stage.djActionTracks.find((t) => t.id === sel.trackId);
    if (!track) {
      return (
        <Panel icon={<MicIcon />} title="Track input">
          <p className="mr-track-in__hint">DJ track not found.</p>
        </Panel>
      );
    }
    return (
      <div data-mr-selection-region="true">
        <Panel icon={<MicIcon />} title="Track input">
          <p className="mr-track-in__target">{track.name}</p>
          <p className="mr-track-in__hint">
            Enable one port as the default for actions that rely on track default. All off uses the first available
            input. Channel and note are set per action in Map Note.
          </p>
          {inputs.length === 0 ? (
            <p className="mr-track-in__hint">No MIDI inputs — grant access or connect a device.</p>
          ) : (
            <div className="mr-track-in__devices">
              {inputs.map((d) => {
                const isDefault = track.defaultMidiInputDeviceId === d.id;
                return (
                  <div key={d.id} className="mr-track-in__dev">
                    <div className="mr-row mr-track-in__dev-head">
                      <span className="mr-row-lbl">{d.name}</span>
                      <button
                        type="button"
                        className="mr-switch"
                        data-on={isDefault ? 'true' : 'false'}
                        aria-pressed={isDefault}
                        aria-label={`Use ${d.name} as default MIDI input`}
                        onClick={() =>
                          stage.setDJTrackDefaultMidiInputDevice(
                            track.id,
                            isDefault ? '' : d.id,
                          )
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    );
  }

  return (
    <div data-mr-selection-region="true">
      <Panel icon={<MicIcon />} title="Track input">
        <p className="mr-track-in__target">
          {stage.channels.find((c) => c.id === sel.channelId)?.name ?? 'Channel'} · CH {sel.channelId}
        </p>
        {inputs.length === 0 ? (
          <p className="mr-track-in__hint">No MIDI inputs — grant access or connect a device.</p>
        ) : (
          <div className="mr-track-in__devices">
            {inputs.map((d) => (
              <div key={d.id} className="mr-track-in__dev">
                <div className="mr-row mr-track-in__dev-head">
                  <span className="mr-row-lbl">{d.name}</span>
                  <button
                    type="button"
                    className="mr-switch"
                    data-on={deviceEnabled(d.id) ? 'true' : 'false'}
                    aria-pressed={deviceEnabled(d.id)}
                    aria-label={`Listen to ${d.name}`}
                    onClick={() => toggleDevice(d.id)}
                  />
                </div>
                {deviceEnabled(d.id) && (
                  <div className="mr-track-in__chips">
                    <button
                      type="button"
                      className="mr-chip"
                      data-on={channelsAreAllSelected(rowFor(d.id)?.channels ?? []) ? 'true' : 'false'}
                      onClick={() => toggleAllChannels(d.id)}
                    >
                      All
                    </button>
                    {ALL_MIDI_CHANNELS.map((ch) => {
                      const on = rowFor(d.id)?.channels.includes(ch) ?? false;
                      return (
                        <button
                          key={ch}
                          type="button"
                          className="mr-chip"
                          data-on={on ? 'true' : 'false'}
                          onClick={() => toggleChannel(d.id, ch)}
                        >
                          CH {ch}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
