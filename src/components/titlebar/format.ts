export function formatBig(timecodeMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(timecodeMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${pad2(minutes)}:${pad2(seconds)}`;
}

export function formatMs(timecodeMs: number): string {
  const ms = Math.max(0, Math.floor(timecodeMs)) % 1000;
  return ms.toString().padStart(3, '0');
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}
