// Throwaway prototype data for the U.1 design spike. Not wired to any server.
window.TB = (function () {
  const servers = [
    { id: 'hetz', name: 'hetzner-box', host: 'Falkenstein', up: '41d', cpu: 38, mem: 71 },
    { id: 'lab', name: 'home-lab', host: 'basement NUC', up: '12d', cpu: 12, mem: 44 },
    { id: 'work', name: 'work-vps', host: 'Frankfurt', up: '3d', cpu: 64, mem: 82 },
  ];
  // state: needs_input | failed | finished_unseen | working | idle
  const S = (id, server, agent, state, wait, name, title, tier, extra = {}) => ({
    id, server, agent, state, wait, name, title, tier,
    branch: 'feat/' + name, runtime: agent, uptime: '1h 20m', last: wait + ' ago', ...extra,
  });
  const sessions = [
    S('s1', 'hetz', 'claude', 'needs_input', '4 min', 'auth-migration', 'Migrate the auth middleware to the new session store and update every integration test that touches login', 'T1', { branch: 'feat/session-store', runtime: 'claude-code', uptime: '2h 14m', last: '1m ago', progress: [2, 4] }),
    S('s2', 'work', 'codex', 'needs_input', '11 min', 'rate-limits', 'Add rate limiting to the public API', 'T3', { progress: [1, 3] }),
    S('s3', 'lab', 'aider', 'failed', '26 min', 'billing-refactor', 'Refactor billing module: tests failed (14 of 212)', 'T3', { progress: [3, 5] }),
    S('s4', 'hetz', 'claude', 'finished_unseen', '38 min', 'changelog', 'Write the changelog for 0.1.23', 'T1', { progress: [4, 4] }),
    S('s5', 'work', 'gemini', 'finished_unseen', '1 h', 'pr-triage', 'Summarise open pull requests by risk', 'T3', { progress: [3, 3] }),
    S('s6', 'hetz', 'claude', 'working', '7 min', 'ws-reconnect', 'Fix flaky websocket reconnect test', 'T1', { progress: [2, 5] }),
    S('s7', 'hetz', 'codex', 'working', '19 min', 'settings-runes', 'Port the settings page to Svelte 5 runes', 'T3', { progress: [4, 7] }),
    S('s8', 'lab', 'opencode', 'working', '2 min', 'pty-memory', 'Investigate memory growth in the PTY reader', 'T3', { progress: [1, 4] }),
    S('s9', 'work', 'claude', 'working', '33 min', 'dep-upgrade', 'Upgrade dependencies and fix the type errors', 'T1', { progress: [5, 8] }),
    S('s10', 'lab', 'claude', 'idle', '2 h', 'scratch-sh', 'Scratch: shell scripts', 'T1'),
    S('s11', 'work', 'aider', 'idle', '5 h', 'docs-typos', 'Docs typo pass', 'T3'),
    S('s12', 'hetz', 'codex', 'idle', '1 d', 'scratch', 'Scratch', 'T3'),
  ];
  const STATE = {
    needs_input: { label: 'Needs you', short: 'Needs input', rank: 0 },
    failed: { label: 'Failed', short: 'Failed', rank: 1 },
    finished_unseen: { label: 'Finished', short: 'Finished', rank: 2 },
    working: { label: 'Working', short: 'Working', rank: 3 },
    idle: { label: 'Idle', short: 'Idle', rank: 4 },
  };
  const AGENT = {
    claude: { name: 'Claude Code', mark: 'C' },
    codex: { name: 'Codex', mark: 'X' },
    aider: { name: 'Aider', mark: 'A' },
    gemini: { name: 'Gemini', mark: 'G' },
    opencode: { name: 'OpenCode', mark: 'O' },
  };
  const decision = {
    session: 's1',
    context: 'Claude wants to change 9 files to move login onto the new session store. The 3 integration tests that log in will be rewritten. Nothing has been changed yet.',
    question: 'How should it handle users who are already signed in?',
    options: [
      { key: '1', label: 'Keep them signed in', hint: 'Copy existing sessions to the new store. Safer, takes longer.' },
      { key: '2', label: 'Sign everyone out once', hint: 'Fastest. Users log in again after the deploy.' },
      { key: '3', label: 'Ask me again later', hint: 'Skip this step for now.' },
    ],
  };
  const steps = {
    s1: [
      { t: 'Read the middleware and session store interface', st: 'done' },
      { t: 'Rewrite session lookups to use the new store', st: 'done' },
      { t: 'Decide how signed-in users move across', st: 'wait', note: 'waiting for you' },
      { t: 'Update the 3 login integration tests', st: 'todo' },
    ],
  };
  const activity = [
    { time: '10:24', text: 'Edited src/auth/middleware.ts (+31 −44)', tone: 'ok' },
    { time: '10:22', text: 'Read src/session/store.ts (148 lines)', tone: 'ok' },
    { time: '10:20', text: 'Asked you: how to handle signed-in users', tone: 'warn' },
    { time: '10:17', text: 'Checked 9 call sites of the old store', tone: 'ok' },
    { time: '10:12', text: 'Started task: migrate the auth middleware', tone: 'info' },
  ];
  const transcript = [
    { who: 'you', text: 'Migrate the auth middleware to the new session store and update the login tests.' },
    { who: 'bot', text: 'I will start by reading the middleware and the session store interface.' },
    { who: 'tool', text: 'Read  src/auth/middleware.ts  (212 lines)' },
    { who: 'tool', text: 'Read  src/session/store.ts  (148 lines)' },
    { who: 'bot', text: 'The old store keeps sessions in memory, the new one persists them. Existing logins would be lost on deploy unless they are copied across.' },
    { who: 'tool', text: 'Edit  src/auth/middleware.ts  (+31 −44)' },
    { who: 'bot', text: 'I need one decision before touching the tests.' },
  ];
  const term = {
    s1: [
      '[10:21:03] > git status',
      '  On branch feat/session-store',
      "  Your branch is up to date with 'origin/feat/session-store'.",
      '',
      '[10:22:11] > rg "sessionStore" src --count',
      '  src/auth/middleware.ts:7',
      '  src/session/store.ts:12',
      '  tests/login.test.ts:3',
      '',
      '[10:24:40] > edit src/auth/middleware.ts',
      '✔ Applied (+31 −44)',
      '',
      '  I need one decision before touching the tests.',
      '',
      '  How should existing signed-in users be handled?',
      '  1. Keep them signed in',
      '  2. Sign everyone out once',
      '  3. Ask me again later',
      '',
      '  Choose an option [1/2/3]',
    ],
    s3: [
      '  Running 212 tests',
      '✔ auth › login with password (41ms)',
      '✔ auth › logout clears cookie (12ms)',
      '✖ billing › invoice rounds half up',
      '      expected 1.005 to equal 1.01',
      '✖ billing › refund keeps tax line',
      '',
      '  198 passed, 14 failed',
      '',
      '  Apply these 3 changes? [y/n]',
    ],
  };
  // Deterministic 24 h timeline segments per session: [startHour, endHour, state]
  const timeline = {
    s1: [[0, 6, 'idle'], [6, 7.5, 'working'], [7.5, 8, 'needs_input'], [8, 19, 'idle'], [19, 22.5, 'working'], [22.5, 24, 'needs_input']],
    s2: [[2, 4, 'working'], [4, 9, 'idle'], [9, 12, 'working'], [12, 13.2, 'needs_input'], [13.2, 24, 'idle']],
    s3: [[5, 8, 'working'], [8, 8.4, 'failed'], [8.4, 24, 'idle']],
    s6: [[10, 11, 'working'], [11, 11.6, 'needs_input'], [11.6, 16, 'working'], [16, 24, 'idle']],
    s7: [[1, 5, 'working'], [5, 14, 'idle'], [14, 23, 'working']],
    s9: [[8, 13, 'working'], [13, 13.5, 'needs_input'], [13.5, 20, 'working'], [20, 24, 'idle']],
  };
  const usage = { tokens: '4.8 M', cost: '$18.40' };
  return { servers, sessions, STATE, AGENT, decision, steps, activity, transcript, term, timeline, usage };
})();
