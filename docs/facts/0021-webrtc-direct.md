---
id: 0021
title: WebRTC Direct Prototype Results
status: active
tags: [transport, webrtc, networking, prototype]
date: 2026-10-11
---

# WebRTC Direct Prototype Results

Plan step 8.7. Prototype: Rust `str0m` 0.24.1 server, one UDP port, no signaling, no STUN/TURN; a plain HTML page as client. Run on a Hetzner Cloud VPS whose public IP is on `eth0` (no NAT). Closed by issue #30 with the open items listed at the end.

## What works (tested)

- **Library**: `str0m` has everything needed: `set_ice_lite(true)`, fixed local ICE credentials, a persisted DTLS certificate, `set_fingerprint_verification(false)`, and a `direct_api()` with no SDP. It is sans-IO, so one thread drives a single `UdpSocket` for all peers.
- **Handshake without signaling** (libp2p "webrtc-direct" style):
  - The client creates `RTCPeerConnection`, a negotiated data channel (`{negotiated:true, id:0}`), an offer, and rewrites its own `a=ice-ufrag` and `a=ice-pwd` to the same random string of at least 22 characters (Chrome rejects shorter passwords).
  - It then sets a remote *answer* it built locally: `a=ice-lite`, the server's fixed ufrag/pwd, `a=fingerprint` (pinned), `a=setup:passive`, `a=sctp-port:5000`, and one `typ host` candidate with the server's IP and port.
  - The server creates a peer when an unknown source address sends a STUN binding request whose USERNAME is `<server ufrag>:<client ufrag>`. It sets remote ICE credentials to the client ufrag for both fields, starts DTLS as the passive side and SCTP as the server, and opens the negotiated channel 0.
  - str0m still wants a remote fingerprint value even with verification off; a dummy 32-byte value works. Client identity comes from the in-band GitHub login.
- **Chromium 151 (headless, Linux)**: ICE connected, data channel open in 133 ms from page load on loopback to the public IP (server side: connected after 53 ms). RTT median 1 ms. This path is loopback to the host's own public address, so it proves the protocol, not the network.
- **Message sizes**: 1 KB, 16 KB and 64 KB messages echo; a 200 KB message did not (timed out). Keep frames at or below 16 KB.
- **Concurrency/memory** (debug build, 4 vCPU host): 40 simultaneous browser connections left server RSS unchanged at 17 MB (11.6 MB idle). Established connections cost well under 100 KB each.
- **Half-open peers**: about 25 KB each (222 peers added about 5.5 MB). They were not removed after 25 s idle.

## Real clients (tested from a home or office network behind NAT; both reports came from the same public IP)

- **iOS Safari 18.3 (iPhone)**: connected with the rewritten ufrag/pwd; channel open 304 ms from page load, RTT median 30 ms; 1 KB, 16 KB (156 ms) and 64 KB (218 ms) messages echo; 200 KB times out.
- **Chrome 155 on Windows**: channel open 280 ms, RTT median 27 ms, same size results.
- **Chrome 154 on Android 10, Wi-Fi**: channel open 669 ms, RTT median 29 ms, 64 KB in 208 ms.
- **Chrome 154 on Android 10, LTE (different public IP, carrier network)**: connected with no hole-punching; channel open 747 ms, RTT median 65 ms (max 1,106 ms), 1 KB in 92 ms, 16 KB in 694 ms, 64 KB in 2.5 s, 200 KB fails. Cellular jitter is large and bulk transfer is slow, so large output bursts need pacing and the client needs a connection-quality indicator.
- So a client behind an ordinary NAT reaches the server's single UDP port with no hole-punching, STUN or TURN.
- Larger messages take longer than the RTT suggests (16 KB in about 140-160 ms): the SCTP window is small. Terminal frames should stay small and bursts may need pacing.

## Abuse findings

- STUN integrity uses the static server password, which is public by design, so anyone can create peers by sending binding requests. Required mitigations for the real server: a cap on half-open peers (about 256), expiry of peers that do not finish DTLS within about 10 s, a per-source-IP rate limit, and handling timeouts per peer instead of scanning all peers on every packet (the prototype loop is O(peers) per datagram).

## Still to do (pending, issue #30)

- iOS on cellular, Firefox, and older iOS (16, 17). Android Chrome on LTE passed. Firefox and WebKit could not run in this sandbox (missing system libraries) and were not installed.
- Hetzner Cloud Firewall default (the host firewall was opened for UDP 40000 only for the test). Other providers' defaults: not researched.
- NAT-mapped public IPs on AWS/GCP/Oracle: not tested; this host has a direct public address.
- Networks that block UDP: not tested.
