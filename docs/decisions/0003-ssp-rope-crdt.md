---
id: 0003
title: Full Frame Deltas with Rope/Sequence CRDT for SSP
status: active
track: product
tags: [ssp, protocol, crdt, rope, terminal]
date: 2026-10-09
accepted-by: architect
---

# Decision: Full Frame Deltas with Rope/Sequence CRDT for Screen Synchronization

## Context
Termanch's core value proposition is Mosh-level session persistence. The screen synchronization protocol (SSP) must:
- Keep client and server terminal state in sync over unreliable mobile networks
- Handle reconnect without visible flicker or data loss
- Efficiently encode terminal output (including large scrollback)
- Support concurrent edits (user typing while output arrives)

## Decision
Implement SSP using **full frame deltas with a Rope/sequence CRDT** as the authoritative buffer model.

## Algorithm
**Server (authoritative state)**:
- Terminal buffer = Rope (B-tree of string fragments) — O(log n) insert/delete/splice
- Each mutation (PTY output, user keystroke echo) produces an operation: `Op = Retain(n) | Delete(n) | Insert(string)`
- Operations form a sequence CRDT: each op has `(version, lamport_timestamp, client_id)` for ordering
- Server computes minimal diff between versions using Myers diff algorithm on line boundaries

**Client**:
- Maintains local Rope mirror
- On reconnect: sends `SyncRequest { last_version }`
- Server responds with `SyncResponse { base_version, ops[] }` or `FullState` if gap > 1000 ops
- Client applies ops in order; renders viewport from Rope

**Large output**: Server ring buffer capped at 10,000 lines. Truncation emits synthetic `Delete` ops with marker.

## Rationale
- **Rope** handles terminal's mutation pattern (append-heavy, occasional insert/delete in scrollback) better than flat string or gap buffer
- **Sequence CRDT** provides mathematical convergence guarantee — no conflict resolution logic needed
- **Line-granularity diffs** match terminal semantics (lines are natural units) and compress well
- **Version vectors** enable efficient incremental sync

## Tradeoffs
| Approach | Pros | Cons |
|---|---|---|
| Rope + CRDT (chosen) | Convergence guarantee, efficient edits, incremental sync | Implementation complexity |
| Character OT | Fine-grained | Overkill for terminal; complex |
| VT100 replay | Simple concept | Large state; replay latency |
| Full frame snapshots | Trivial impl | Bandwidth waste; no incremental |

## Consequences
- WASM core includes `ropey` crate (Rope impl) + custom CRDT logic
- Wire protocol carries `DeltaFrame { base_version, ops[] }` messages
- Server stores last 1000 ops in memory for incremental sync
- Reconnect latency target: < 200ms for delta, < 500ms for full state