// Starting a session (plan H.10): which agent, in which directory, under what name. The templates are the agents the
// server recognises; the server refuses any other name, so this list is only what the sheet offers.
import type { WindowMap } from './windows';

export const TEMPLATES: { id: string; label: string }[] = [
  { id: 'shell', label: 'Shell' },
  { id: 'claude', label: 'Claude Code' },
  { id: 'codex', label: 'Codex' },
  { id: 'copilot', label: 'Copilot' },
  { id: 'opencode', label: 'OpenCode' },
  { id: 'gemini', label: 'Gemini' },
  { id: 'kilo', label: 'Kilo' },
  { id: 'aider', label: 'Aider' },
  { id: 'goose', label: 'Goose' },
  { id: 'amp', label: 'Amp' },
  { id: 'qwen', label: 'Qwen' },
  { id: 'cursor-agent', label: 'Cursor' },
];

/** Directories already in use on the server, most used first: the pick list for "where". */
export function recentDirs(windows: WindowMap, serverPrefix: string, limit = 6): string[] {
  const count = new Map<string, number>();
  for (const [key, w] of Object.entries(windows)) {
    if (!key.startsWith(serverPrefix)) continue;
    for (const x of w.windows) if (x.path.startsWith('/')) count.set(x.path, (count.get(x.path) ?? 0) + 1);
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([p]) => p);
}

/** A name the server accepts (letters, digits, - and _; at most 64) that is not taken: `termenbox-claude`, `termenbox-claude-2`. */
export function suggestName(dir: string, template: string, taken: string[]): string {
  const tail = dir.split('/').filter(Boolean).pop() ?? '';
  const base = (tail || 'session').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'session';
  const head = (template && template !== 'shell' ? `${base}-${template}` : base).slice(0, 58);
  let name = head, n = 2;
  while (taken.includes(name)) name = `${head}-${n++}`;
  return name;
}

export const validDir = (dir: string) => dir === '' || (dir.startsWith('/') && dir.length <= 512 && !/[\u0000-\u001f\u007f]/.test(dir));
export const validName = (name: string) => /^[A-Za-z0-9_-]{1,64}$/.test(name);
