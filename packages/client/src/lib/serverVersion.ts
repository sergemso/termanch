/** True when a server's reported version (`0.1.12`, `0.1.6+dev`) is at least `min`. An empty or odd version is old. */
export function serverAtLeast(version: string, min: [number, number, number]): boolean {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
  if (!m) return false;
  const have = [Number(m[1]), Number(m[2]), Number(m[3])];
  for (let i = 0; i < 3; i++) if (have[i] !== min[i]) return have[i] > min[i];
  return true;
}

/** The first server version that understands `new_window`; older ones drop the message without a word. */
export const NEW_WINDOW_VERSION: [number, number, number] = [0, 1, 12];
