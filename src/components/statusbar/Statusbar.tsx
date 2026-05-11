import { formatChannel, useStatusbar } from '../../hooks/useStatusbar';
import './Statusbar.css';

export function Statusbar() {
  const { lastInput, active } = useStatusbar();

  return (
    <div className="mr-statusbar__cluster">
      <button
        type="button"
        className="mr-statusbar__btn"
        data-pickable="false"
        tabIndex={-1}
      >
        <span className="mr-led" {...(active ? { 'data-state': 'midi' } : {})} />
        {lastInput ? (
          <>
            <span className="mr-statusbar__name" data-active="true">
              {lastInput.name}
            </span>
            <span className="mr-statusbar__ch">{formatChannel(lastInput.channel)}</span>
          </>
        ) : (
          <span className="mr-statusbar__name" data-active="false">
            Awaiting MIDI
          </span>
        )}
      </button>
    </div>
  );
}
