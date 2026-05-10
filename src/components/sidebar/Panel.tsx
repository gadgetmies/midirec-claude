import { useState, type ReactNode } from 'react';
import { ChevDownIcon } from '../icons/transport';

type PanelProps = {
  icon: ReactNode;
  title: string;
  count?: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

export function Panel({ icon, title, count, defaultOpen = true, children }: PanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mr-panel" data-open={open ? 'true' : 'false'}>
      <button
        type="button"
        className="mr-panel__head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="mr-panel__head-l">
          <span className="mr-chev">
            <ChevDownIcon />
          </span>
          {icon}
          <span>{title}</span>
        </span>
        {count != null && <span className="mr-panel__count">{count}</span>}
      </button>
      {open && <div className="mr-panel__body">{children}</div>}
    </div>
  );
}
