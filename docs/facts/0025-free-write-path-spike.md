---
id: 0025
title: Free write path spike results (open relays and alternatives)
status: active
tags: [directory, scale, nostr, spike]
date: 2026-10-12
---

# Free write path spike results

Plan step C.6: can announces, claim discovery and the owner's data leave Cloudflare Workers and R2 Class A? Candidates: **A** an open relay network (Nostr), **B** our own directory on an always-free VM behind the CDN, **C** sharding across free serverless vendors, **D** R2 and Workers (decision 0068 as drafted).

## What was measured (candidate A)

A throwaway Node script (`@noble/curves` Schnorr signatures, Node's WebSocket) published signed, replaceable events (kind 30078, one `d` tag per record) to 8 public relays from this VPS (Germany), read them back over a second connection, replaced them, subscribed for live pushes, probed size limits, and repeated 6 rounds over 20 minutes with one key. Nothing was encrypted (random bytes stood in for ciphertext). The test events were left to expire on the relays.

| Relay | Rounds ok | Connect | Publish | Notes |
|---|---|---|---|---|
| nos.lol | 6/6 | 33 ms | 10 ms | 16 KB ok; 64 KB refused ("event too large") |
| relay.primal.net | 6/6 | 88 ms | 42 ms | 64 KB ok |
| relay.snort.social | 6/6 | 101 ms | 30 ms | 64 KB ok |
| nostr-pub.wellorder.net | 6/6 | 519 ms | 183 ms | 64 KB ok |
| offchain.pub | 5/6 | 361 ms | 132 ms | one write refused: "pubkey is not in our web of trust"; 16 KB refused |
| relay.damus.io | 1/6 | 581 ms | 171 ms | my 12-event burst was rate-limited after 3 events, then the key was **banned** for the rest of the run; first round and retention fine |
| nostr.wine | 0/6 | 338 ms | n/a | writes need a paid sign-up |
| relay.nostr.band | 0/6 | n/a | n/a | connection failed in every round |

- **Read-back** from a fresh connection succeeded on every relay that accepted the write, and **retention** held in 25 of 25 later checks across the 20-minute window (one week was not tested).
- **Replacement** worked: only the newest event of a `d` tag came back.
- **Live push:** a second connection subscribed to the author and tag received a replacement in 30–340 ms. This is the instant cross-device notification, with no polling.
- **Size:** 1 KB and 16 KB were accepted by most relays; 64 KB by four of eight. The owner's list and settings (1–8 KB) fit.
- **Enumeration:** on every relay a stranger can list other apps' events of this kind (17–20 foreign events returned). Public records would expose every server's IP and port, so address fields must be encrypted to the owner.
- **Rate limits are real:** a server that republishes quickly gets refused or banned. Writes must be spaced and rare (they are: on change plus a keepalive).

## Not measured

Reliability or retention over a week; behaviour from other networks; NIP-44 or any encryption; relay policy changes; a Rust implementation (Schnorr signing with the `secp256k1` crate and WebSocket publishing are standard); the cost of running our own relay.

## Candidates compared (model of fact 0022, 10^5 users)

| | A relays | B own VM | C sharded serverless | D R2 + Workers |
|---|---|---|---|---|
| Workers requests/day | about 15k (certificate and key derivation only) | about 15k | about 15k per vendor | 46k |
| R2 Class A / B per month | 0 / 0 | 0 / 0 | 0 / 0 | 0.62M / 2.2M |
| Our write path | none: servers and browsers write to relays | our VM | vendor functions | Worker to R2 |
| Single point of failure | none (many relays; use at least 4) | the VM (add a second) | per vendor | Cloudflare |
| Live cross-device push | yes, native (subscriptions) | needs a WebSocket server | no | via servers only |
| Main risk | relay policy, bans, retention, third-party reliance | Oracle reclaims idle free VMs; ops and abuse on us | terms and complexity | R2 card question; Class A ceiling at about 1.6x10^5 users |
| Effort | medium: secp256k1 in server and browser, encryption, relay set | medium-high: run and secure a service | high | low-medium |

## Verdict

A is the best fit for the stated goal (nothing written through Cloudflare, no single provider, live push) and most relays behaved well, but it rests on third-party relays whose policies I could only observe for 20 minutes. Recommended: build A behind a small transport interface with a relay set of at least four (nos.lol, primal, snort, wellorder from this run), keep D documented as the fallback that needs no new code beyond fact 0024's findings, and run a longer soak before relying on A: a daily scheduled run for a week from GitHub Actions. Encrypt address fields to the owner; keep the Worker for identity (certificate and per-user key). Not decided: that is the owner's call (decision 0068 stays a draft).
