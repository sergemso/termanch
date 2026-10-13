// Full-colour marks for coding agents and common programs (plan H.5). They are our own simple badges in each
// product's usual colour, drawn locally: nothing is fetched, and no logo is copied. Unknown names get a neutral badge.
export interface IconSpec { color: string; glyph: string; label: string; emoji?: boolean }

const AGENT: Record<string, IconSpec> = {
  claude: { color: '#D97757', glyph: '✳', label: 'Claude Code' },
  codex: { color: '#10A37F', glyph: '◎', label: 'Codex' },
  copilot: { color: '#8957E5', glyph: 'Co', label: 'Copilot' },
  opencode: { color: '#2F81F7', glyph: '</>', label: 'OpenCode' },
  kilo: { color: '#E8B923', glyph: 'K', label: 'Kilo' },
  gemini: { color: '#4285F4', glyph: '✦', label: 'Gemini' },
  aider: { color: '#2EA043', glyph: 'Ai', label: 'Aider' },
  'cursor-agent': { color: '#6E7681', glyph: '▲', label: 'Cursor' },
  amp: { color: '#F25A3C', glyph: '⚡', label: 'Amp' },
  goose: { color: '#3E9AD6', glyph: 'G', label: 'Goose' },
  qwen: { color: '#7C3AED', glyph: 'Q', label: 'Qwen' },
};
const PROGRAM: Record<string, IconSpec> = {
  bash: { color: '#4EAA25', glyph: '>_', label: 'bash' },
  zsh: { color: '#F15A24', glyph: '>_', label: 'zsh' },
  fish: { color: '#3B9ED0', glyph: '>_', label: 'fish' },
  sh: { color: '#6E7681', glyph: '>_', label: 'sh' },
  mc: { color: '#1F6FEB', glyph: '▤', label: 'Midnight Commander' },
  lazygit: { color: '#F05133', glyph: '⎇', label: 'lazygit' },
  git: { color: '#F05133', glyph: '⎇', label: 'git' },
  vim: { color: '#019733', glyph: 'V', label: 'vim' },
  nvim: { color: '#57A143', glyph: 'N', label: 'neovim' },
  nano: { color: '#4A90D9', glyph: 'n', label: 'nano' },
  htop: { color: '#D29922', glyph: '▥', label: 'htop' },
  top: { color: '#D29922', glyph: '▥', label: 'top' },
  ssh: { color: '#8B949E', glyph: '⌁', label: 'ssh' },
  node: { color: '#5FA04E', glyph: '⬢', label: 'node' },
  python: { color: '#3776AB', glyph: 'Py', label: 'python' },
  python3: { color: '#3776AB', glyph: 'Py', label: 'python' },
  docker: { color: '#2496ED', glyph: '🐳', label: 'docker', emoji: true },
  tmux: { color: '#1BB91F', glyph: '▦', label: 'tmux' },
  herdr: { color: '#B07A4B', glyph: '▦', label: 'herdr' },
  less: { color: '#8B949E', glyph: '≡', label: 'less' },
  cargo: { color: '#CE412B', glyph: '▣', label: 'cargo' },
  npm: { color: '#CB3837', glyph: 'n', label: 'npm' },
  pnpm: { color: '#F69220', glyph: 'p', label: 'pnpm' },
};
const FALLBACK: IconSpec = { color: '#6E7681', glyph: '·', label: 'program' };

/** The icon for a foreground command or a known agent name. */
export function iconFor(name: string | undefined, agent?: string): IconSpec {
  if (agent && AGENT[agent]) return AGENT[agent];
  const n = (name ?? '').toLowerCase().replace(/^-/, '');
  return AGENT[n] ?? PROGRAM[n] ?? { ...FALLBACK, label: name || FALLBACK.label };
}
export const isAgentIcon = (name: string | undefined, agent?: string) => !!(agent && AGENT[agent]) || !!(name && AGENT[name.toLowerCase()]);
