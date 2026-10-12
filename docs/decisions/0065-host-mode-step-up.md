---
id: 0065-host-mode-step-up
title: Root host sessions need a passkey step-up and devices can be revoked
status: active
date: 2026-10-12
track: product
accepted-by: Sergey Strebulaev <s@vivantel.dev>
tags: [security, auth, deployment, roadmap]
---

## Decision

- The device certificate (0062) is the factor for host mode with the dedicated user and for container mode.
- Root host sessions also require a WebAuthn passkey assertion, registered at install and re-asked every 12 h. The server verifies it; the private key never leaves the authenticator.
- The installer pre-selects the dedicated user; root is an explicit choice (0058).
- Opening a host session writes an audit entry; the owner sees active sessions and can revoke a device or end a session from the app.

## Why

A stolen GitHub login no longer reaches the host (0062), but an unlocked stolen phone would, and root is the highest-impact capability. Passkeys work on iOS 16+ and Android. Supports [[host-mode-explicit-consent]].
