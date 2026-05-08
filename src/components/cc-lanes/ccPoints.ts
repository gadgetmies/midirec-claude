export interface CCPoint {
  t: number;
  v: number;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export function ccModWheel(totalT: number): CCPoint[] {
  const arr: CCPoint[] = [];
  let v = 0.5;
  for (let i = 0; i <= totalT; i += 0.5) {
    v = Math.max(0.1, Math.min(1, v + Math.sin(i * 1.3) * 0.18));
    arr.push({ t: i, v });
  }
  return arr;
}

export function ccPitchBend(totalT: number): CCPoint[] {
  const arr: CCPoint[] = [];
  for (let i = 0; i <= totalT; i += 1) {
    arr.push({ t: i, v: 0.3 + 0.5 * Math.abs(Math.sin(i * 0.6)) });
  }
  return arr;
}

export function ccVelocity(totalT: number): CCPoint[] {
  const arr: CCPoint[] = [{ t: 0, v: 0.5 }];
  for (let i = 0.4; i <= totalT; i += 0.4) {
    arr.push({ t: i, v: clamp01(0.5 + 0.4 * Math.sin(i * 2.1)) });
  }
  return arr;
}
