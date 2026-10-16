#!/usr/bin/env node
// Shrink an acp-probe wire.jsonl into a committable fixture.
//   node scripts/acp-condense.mjs <wire.jsonl> <out.jsonl>
// Keeps every request, response and non-chunk update. Keeps the first 3 chunk updates of
// each kind and replaces the rest with one {"elided": {kind: n}} line. Arrays longer than 8
// are cut to 3 items plus a marker; strings longer than 1200 characters are cut.
import { readFileSync, writeFileSync } from 'node:fs';

const [, , src, dst] = process.argv;
const CHUNKS = new Set(['agent_message_chunk', 'agent_thought_chunk', 'compaction_summary_chunk', 'user_message_chunk']);
const shrink = (v) => {
  if (Array.isArray(v)) {
    const a = v.length > 8 ? [...v.slice(0, 3), `<${v.length - 3} more>`] : v;
    return a.map(shrink);
  }
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shrink(x)]));
  if (typeof v === 'string' && v.length > 1200) return v.slice(0, 1200) + '<cut>';
  return v;
};

const seen = {}, elided = {};
const out = [];
for (const line of readFileSync(src, 'utf8').split('\n').filter(Boolean)) {
  const e = JSON.parse(line);
  if (e.dir === 'stderr') continue;
  const u = e.msg?.method === 'session/update' ? e.msg.params.update : null;
  if (u && CHUNKS.has(u.sessionUpdate)) {
    const k = u.sessionUpdate;
    seen[k] = (seen[k] || 0) + 1;
    if (seen[k] > 3) { elided[k] = (elided[k] || 0) + 1; continue; }
  }
  out.push(JSON.stringify(shrink(e)));
}
if (Object.keys(elided).length) out.push(JSON.stringify({ elided }));
writeFileSync(dst, out.join('\n') + '\n');
