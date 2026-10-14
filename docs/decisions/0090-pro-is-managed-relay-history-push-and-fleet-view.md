---
id: 0090-pro-is-managed-relay-history-push-and-fleet-view
title: Pro is managed relay, cloud history, reliable push with inbox, and fleet view, all client-encrypted
status: active
date: 2026-10-14
track: product
accepted-by: Sergey Strebulaev <s@vivantel.dev>
tags: [tiers, privacy, crypto, roadmap]
---

## Decision

- Pro contains four features, each needing infrastructure we pay for:
  - **Managed relay**: reach servers behind NAT or without an open UDP port. Free users keep direct WebRTC and WebSocket (0057). The relay is an opt-in exception to 0057's "no TURN": it forwards the DTLS-encrypted packets of the same pinned-fingerprint session, so it cannot read them.
  - **Cloud session history**: an off-server archive of transcripts, agent runs and the change journal (0067), searchable, surviving server loss.
  - **Reliable push and inbox**: delivery independent of the server being up, with a retained inbox across devices (builds on 0061). Basic Web Push stays free.
  - **Fleet view and usage reports**: cross-server dashboard and cost reports (builds on 0073, 0083).
- All Pro data is client-encrypted, as in 0068: we store ciphertext, derive nothing readable, and cannot search or index it. Search and reports are computed on the device after decryption. A recovery key is offered because a lost key means lost data.
- Pro is opt-in per feature. Nothing readable about usage or terminal content reaches us.

## Why

Zero-knowledge keeps the privacy promise and the threat model (fact 0023) while still funding the paid infrastructure. Terminal output can contain secrets, so we do not become its custodian. This decision supplies the new decision that [[usage-stays-on-device]] requires; it also needs the privacy-notice update tracked in the plan. See [[paid-data-is-ciphertext-only]].
