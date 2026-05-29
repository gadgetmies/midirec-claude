import { useEffect, useState } from 'react';
import { useMidiClock } from '../../midi/MidiClockProvider';

const PULSE_FLASH_MS = 80;

export function BeatLed() {
  const { present, beat } = useMidiClock();
  const [isPulse, setIsPulse] = useState(false);

  useEffect(() => {
    if (!present) {
      setIsPulse(false);
      return;
    }
    setIsPulse(true);
    const handle = setTimeout(() => setIsPulse(false), PULSE_FLASH_MS);
    return () => clearTimeout(handle);
  }, [beat, present]);

  const className = present && isPulse ? 'mr-led is-pulse' : 'mr-led';
  return (
    <span
      className={className}
      {...(present ? { 'data-state': 'beat' } : {})}
      aria-label="External clock beat indicator"
    />
  );
}
