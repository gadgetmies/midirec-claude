import type { MouseEvent } from 'react';
import './MSChip.css';

interface MSChipProps {
  muted: boolean;
  soloed: boolean;
  onMute?: () => void;
  onSolo?: () => void;
  size?: 'xs' | 'sm' | 'md';
}

function stop(callback?: () => void) {
  return (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    callback?.();
  };
}

export function MSChip({ muted, soloed, onMute, onSolo, size = 'sm' }: MSChipProps) {
  return (
    <div className="mr-ms" data-size={size}>
      <button
        type="button"
        className="mr-ms__btn"
        data-kind="m"
        data-on={muted ? 'true' : undefined}
        aria-pressed={muted}
        title={muted ? 'Unmute' : 'Mute'}
        onClick={stop(onMute)}
      >
        M
      </button>
      <button
        type="button"
        className="mr-ms__btn"
        data-kind="s"
        data-on={soloed ? 'true' : undefined}
        aria-pressed={soloed}
        title={soloed ? 'Unsolo' : 'Solo'}
        onClick={stop(onSolo)}
      >
        S
      </button>
    </div>
  );
}
