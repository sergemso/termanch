---
id: 0037
title: Terminal output and agent status share one ordered JSON channel, with output as base64
status: active
tags: [transport, protocol, agents]
date: 2026-10-15
kind: environmental
governed-by: 0057
last-verified: 2026-10-15
---

# Terminal output and agent status share one ordered JSON channel, with output as base64

Read from the code on 2026-10-15. The client opens one negotiated data channel (`packages/client/src/lib/rtc.ts`, `createDataChannel('t', { negotiated: true, id })`). The server's `Link` (`packages/server/src/link.rs`) is one stream of JSON text messages each way, and `sessions.rs` writes `Output { data }` (base64 of terminal bytes), `AgentEvents`, `AgentSnapshot` and `WindowList` to the same bounded queue (64 messages) from one `select!` loop. `Output` goes only for the attached session; agent events go for every session. Hence: status can wait behind output, and output costs about a third more bytes than raw. Not measured: how long status waits during an output burst on a real phone link.

**Measured on 2026-10-15 (plan A.4), loopback only:** with the second lane in place (a `term` channel or binary WebSocket frames, `auth_ok.channels`), an Attention message sent while about 200 KB of a 4 MB output flood had already flowed reached the client after 8 ms over WebSocket and 56 ms over WebRTC (`e2e::terminal_bytes_use_their_own_lane_...`, run with `--nocapture`). A phone link was not measured, and the same flood on the old single pipe was not timed, so the gain is not quantified; the test only guards a one-second bound. A client that does not ask keeps the single pipe, output as base64 JSON.
