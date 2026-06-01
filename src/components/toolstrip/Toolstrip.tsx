import { StorageControls } from './StorageControls';
import { ZoomControls } from './ZoomControls';
import './Toolstrip.css';

export function Toolstrip() {
  return (
    <>
      <ZoomControls />
      <StorageControls />
    </>
  );
}
