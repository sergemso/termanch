---
id: 0096-terminal-and-status-use-two-data-channels
title: Terminal data and agent status travel on two data channels of one connection
status: draft
date: 2026-10-15
track: product
tags: [transport, protocol, agents, roadmap]
---

## Decision (draft: needs the owner's acceptance)

- One WebRTC peer connection and one authentication per server (0057), with two data channels:
  - `term`: binary frames, no base64. Attach, detach, input, resize, output, snapshot requests.
  - `status`: small JSON. Activity, `task`, Attention, `ack`, `agent_sync`, detail events, and window and session lists.
- Status never queues behind terminal output: each channel has its own queue and its own backpressure. Under pressure the server coalesces `term` output; it never drops or delays `status` for it.
- The WebSocket fallback carries the same two lanes on one socket with a one-byte lane tag per frame. The server states the lanes it offers as `channels` in `AuthOk`; a client or server without them keeps the single JSON pipe of today, so an older server or a hosted client of a different version still works.
- Message names and the `seq` and `agent_sync` recovery rules of the event layer carry over; the new messages (`activity`, `attention`, `ack`) are additive and unknown ones are ignored.
- Push (0095) is the third, out-of-band lane for Attention edges when no connection is open.

## Why

Status and terminal bytes shared one ordered channel (fact 0037), so a burst of output delayed "needs you", and base64 inside JSON cost a third more bytes on a phone link. Two channels on one peer connection fix both without the second handshake, second auth and doubled sockets of two connections, which would fight the soft limit of connected servers (0070, superseded by 0082 but the cost stands). Builds on [[0057-webrtc-direct-transport]] and [[0095-agent-status-is-activity-plus-attention]].
