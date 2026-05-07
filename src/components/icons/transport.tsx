import type { SVGProps } from 'react';

type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'>;

export function PlayIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 14 14" fill="currentColor" width={14} height={14} {...props}>
      <path d="M3 2v10l9-5z" />
    </svg>
  );
}

export function PauseIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 14 14" fill="currentColor" width={14} height={14} {...props}>
      <rect x="3" y="2" width="3" height="10" />
      <rect x="8" y="2" width="3" height="10" />
    </svg>
  );
}

export function StopIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 14 14" fill="currentColor" width={14} height={14} {...props}>
      <rect x="3" y="3" width="8" height="8" />
    </svg>
  );
}

export function RecIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 14 14" fill="currentColor" width={14} height={14} {...props}>
      <circle cx="7" cy="7" r="4" />
    </svg>
  );
}

export function RewIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 14 14" fill="currentColor" width={14} height={14} {...props}>
      <path d="M2 2v10h2V2zm10 0L5 7l7 5z" />
    </svg>
  );
}

export function FfwIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 14 14" fill="currentColor" width={14} height={14} {...props}>
      <path d="M12 2v10h-2V2zM2 2l7 5-7 5z" />
    </svg>
  );
}

export function CueIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" width={14} height={14} {...props}>
      <path d="M7 2v10M3 7h8" />
    </svg>
  );
}

export function LoopIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" width={14} height={14} {...props}>
      <path d="M3 5a3 3 0 013-3h5l-2-2m2 2l-2 2M11 9a3 3 0 01-3 3H3l2 2m-2-2l2-2" />
    </svg>
  );
}

export function MetroIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" width={14} height={14} {...props}>
      <path d="M5 1h4l2 11H3z" />
      <path d="M5 11l4-7" />
    </svg>
  );
}

export function QuantizeIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" width={14} height={14} {...props}>
      <path d="M7 2v4" />
      <path d="M3.5 4.5a4 4 0 107 0" />
    </svg>
  );
}

export function ChevDownIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" width={8} height={8} {...props}>
      <path d="M2 4l3 3 3-3" />
    </svg>
  );
}
