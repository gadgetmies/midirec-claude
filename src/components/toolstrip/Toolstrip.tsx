import { useStage } from '../../hooks/useStage';
import { DownloadIcon } from '../icons/transport';
import './Toolstrip.css';

export function Toolstrip() {
  const { openExportDialog } = useStage();
  return (
    <button
      type="button"
      className="mr-tool"
      title="Export"
      aria-label="Export"
      onClick={openExportDialog}
    >
      <DownloadIcon />
    </button>
  );
}
