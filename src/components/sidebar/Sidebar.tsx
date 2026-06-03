import { InputMappingPanel } from './InputMappingPanel';
import { TrackInputMappingPanel } from './TrackInputMappingPanel';
import { MidiPermissionBanner } from '../midi-runtime/MidiPermissionBanner';
import { useOptionalMidiControl } from '../../midi/MidiControlProvider';
import { ControlInputPicker } from '../midi-map/ControlInputPicker';
import { MappingsPanel } from '../midi-map/MappingsPanel';
import { MappingConfig } from '../midi-map/MappingConfig';
import './Sidebar.css';

export function Sidebar() {
  const control = useOptionalMidiControl();
  // In map mode the left dock hosts the control-mapping UI (inputs are
  // configured on the left, outputs on the right); it restores on exit. The
  // advanced config lives here too since it configures the incoming control.
  if (control?.mapMode) {
    return (
      <>
        <ControlInputPicker />
        <MappingsPanel />
        <MappingConfig />
      </>
    );
  }
  return (
    <>
      <MidiPermissionBanner />
      <TrackInputMappingPanel />
      <InputMappingPanel />
    </>
  );
}
