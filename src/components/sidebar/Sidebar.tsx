import { InputMappingPanel } from './InputMappingPanel';
import { TrackInputMappingPanel } from './TrackInputMappingPanel';
import { MidiPermissionBanner } from '../midi-runtime/MidiPermissionBanner';
import './Sidebar.css';

export function Sidebar() {
  return (
    <>
      <MidiPermissionBanner />
      <TrackInputMappingPanel />
      <InputMappingPanel />
    </>
  );
}
