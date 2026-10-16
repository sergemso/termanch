// Throwaway prototype data for the U.1 design spike. Not wired to any server.
window.TB = (function () {
  const servers = [
    { id: 'hetz', name: 'hetzner-box', host: 'Falkenstein', up: '41d', cpu: 38, mem: 71 },
    { id: 'lab', name: 'home-lab', host: 'basement NUC', up: '12d', cpu: 12, mem: 44 },
    { id: 'work', name: 'work-vps', host: 'Frankfurt', up: '3d', cpu: 64, mem: 82 },
  ];
  // state: needs_input | failed | finished_unseen | working | idle
  const sessions = [
    { id: 's1', server: 'hetz', agent: 'claude', state: 'needs_input', wait: '4 min', title: 'Migrate the auth middleware to the new session store and update every integration test that touches login', tier: 'T1' },
    { id: 's2', server: 'work', agent: 'codex', state: 'needs_input', wait: '11 min', title: 'Add rate limiting to the public API', tier: 'T3' },
    { id: 's3', server: 'lab', agent: 'aider', state: 'failed', wait: '26 min', title: 'Refactor billing module: tests failed (14 of 212)', tier: 'T3' },
    { id: 's4', server: 'hetz', agent: 'claude', state: 'finished_unseen', wait: '38 min', title: 'Write the changelog for 0.1.23', tier: 'T1' },
    { id: 's5', server: 'work', agent: 'gemini', state: 'finished_unseen', wait: '1 h', title: 'Summarise open pull requests by risk', tier: 'T3' },
    { id: 's6', server: 'hetz', agent: 'claude', state: 'working', wait: '7 min', title: 'Fix flaky websocket reconnect test', tier: 'T1' },
    { id: 's7', server: 'hetz', agent: 'codex', state: 'working', wait: '19 min', title: 'Port the settings page to Svelte 5 runes', tier: 'T3' },
    { id: 's8', server: 'lab', agent: 'opencode', state: 'working', wait: '2 min', title: 'Investigate memory growth in the PTY reader', tier: 'T3' },
    { id: 's9', server: 'work', agent: 'claude', state: 'working', wait: '33 min', title: 'Upgrade dependencies and fix the type errors', tier: 'T1' },
    { id: 's10', server: 'lab', agent: 'claude', state: 'idle', wait: '2 h', title: 'Scratch: shell scripts', tier: 'T1' },
    { id: 's11', server: 'work', agent: 'aider', state: 'idle', wait: '5 h', title: 'Docs typo pass', tier: 'T3' },
    { id: 's12', server: 'hetz', agent: 'codex', state: 'idle', wait: '1 d', title: 'Scratch', tier: 'T3' },
  ];
  const STATE = {
    needs_input: { label: 'Needs you', glyph: '◆', rank: 0 },
    failed: { label: 'Failed', glyph: '▲', rank: 1 },
    finished_unseen: { label: 'Finished', glyph: '✓', rank: 2 },
    working: { label: 'Working', glyph: '◐', rank: 3 },
    idle: { label: 'Idle', glyph: '○', rank: 4 },
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
    context:
      'Claude wants to change 9 files to move login onto the new session store. The 3 integration tests that log in will be rewritten. Nothing has been changed yet.',
    question: 'How should it handle users who are already signed in?',
    options: [
      { key: '1', label: 'Keep them signed in', hint: 'Copy existing sessions to the new store. Safer, takes longer.' },
      { key: '2', label: 'Sign everyone out once', hint: 'Fastest. Users log in again after the deploy.' },
      { key: '3', label: 'Ask me again later', hint: 'Skip this step for now.' },
    ],
  };
  const transcript = [
    { who: 'you', text: 'Migrate the auth middleware to the new session store and update the login tests.' },
    { who: 'agent', text: 'I will start by reading the middleware and the session store interface.' },
    { who: 'tool', text: 'Read  src/auth/middleware.ts  (212 lines)' },
    { who: 'tool', text: 'Read  src/session/store.ts  (148 lines)' },
    { who: 'agent', text: 'The old store keeps sessions in memory, the new one persists them. Existing logins would be lost on deploy unless they are copied across.' },
    { who: 'tool', text: 'Edit  src/auth/middleware.ts  (+31 −44)' },
    { who: 'agent', text: 'I need one decision before touching the tests.' },
  ];
  const tail = [
    '  Running 212 tests',
    '  ✔ auth › login with password (41ms)',
    '  ✔ auth › logout clears cookie (12ms)',
    '  ✖ billing › invoice rounds half up',
    '      expected 1.005 to equal 1.01',
    '  ✖ billing › refund keeps tax line',
    '',
    '  198 passed, 14 failed',
    '',
    '  Apply these 3 changes? [y/n]',
  ];
  // Deterministic 24 h timeline segments per session: [startHour, endHour, state]
  const timeline = {
    s1: [[0, 6, 'idle'], [6, 7.5, 'working'], [7.5, 8, 'needs_input'], [8, 19, 'idle'], [19, 22.5, 'working'], [22.5, 24, 'needs_input']],
    s2: [[2, 4, 'working'], [4, 9, 'idle'], [9, 12, 'working'], [12, 13.2, 'needs_input'], [13.2, 24, 'idle']],
    s3: [[5, 8, 'working'], [8, 8.4, 'failed'], [8.4, 24, 'idle']],
    s6: [[10, 11, 'working'], [11, 11.6, 'needs_input'], [11.6, 16, 'working'], [16, 24, 'idle']],
    s7: [[1, 5, 'working'], [5, 14, 'idle'], [14, 23, 'working']],
    s9: [[8, 13, 'working'], [13, 13.5, 'needs_input'], [13.5, 20, 'working'], [20, 24, 'idle']],
  };
  const usage = { tokens: '4.8 M', cost: '$18.40', budget: 60 };
  return { servers, sessions, STATE, AGENT, decision, transcript, tail, timeline, usage };
})();
