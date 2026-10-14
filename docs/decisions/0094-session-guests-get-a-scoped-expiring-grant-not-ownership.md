---
id: 0094-session-guests-get-a-scoped-expiring-grant-not-ownership
title: A session guest gets a scoped, expiring grant tied to a GitHub id, never ownership
status: active
accepted-by: Sergey Strebulaev <s@vivantel.dev>
date: 2026-10-14
track: product
tags: [security, auth, sharing, roadmap]
---

## Decision

Refines 0053 (it stays true: one owner per server) and implements the free sharing promised by 0089.

1. **Grant, not ownership.** The owner, connected normally, invites a GitHub login to one session. The server stores a grant in `shares.json` (guest GitHub id and login, session id, mode `read` or `write`, created, expires). `authorize` still returns `Denied` for a non-owner unless a live grant exists; then the connection gets the role `Guest`, bound to that grant.
2. **One session only.** A guest sees and can attach to the granted tmux session and nothing else: no session list, no new sessions, no Detach/Close, no settings, uninstall, device revocation, usage or problem reports. The server enforces this by dropping every message type not allowed for the role; the client hiding buttons is not the control.
3. **Modes.** `read`: live output only, no input and no resize. `write`: input and resize. A guest sees output from the moment of attaching, not the earlier scrollback (it can hold secrets the owner never meant to share).
4. **No root.** A session running with root privileges in host mode (0065) cannot be shared, in either mode. Any other session runs as the session user, so `write` is that user's shell; the invite dialog says so and asks for confirmation (as for kill, `kill-session-needs-confirmation`).
5. **Expiry and revocation.** Default 1 hour, maximum 24 hours, no permanent grants. Revoking, expiry, closing the session or removing the owner ends the guest's connection within seconds, not at the next reconnect. A restart keeps grants until they expire.
6. **The invite is not a bearer secret.** The link carries only the public server id and the grant id; the grant is bound to the guest's GitHub id, so a leaked link lets no one else in. The guest still signs in with GitHub and a device certificate (0062).
7. **Limits.** At most 5 live grants per server and 2 guest connections per grant; guest input is rate-limited (default 20 KB/s); the owner sees who is attached and can remove anyone with one tap.
8. **Audit, no content.** Entries `share_created`, `share_used`, `share_revoked`, `share_expired`, `guest_attached`, `guest_detached` carry GitHub ids, session id, mode and times, never output or keystrokes (`audit-logging-no-secrets`).

## Threat table

| Threat | Control |
|---|---|
| A guest escalates to the owner's other sessions or the host | Role enforced server-side per message (2); root sessions not shareable (4) |
| A leaked invite link gives a stranger a shell | Grant bound to a GitHub id; link holds no secret (6) |
| A guest keeps access after the owner forgot | Hard expiry up to 24 h, live disconnect on revoke (5) |
| A read-only guest types anyway | Server drops input for `read` (3) |
| A guest reads earlier secrets in scrollback | Output only from attach (3) |
| A `write` guest steers an agent (prompt injection: their text is read by an agent holding the owner's credentials) | Same trust as handing over the shell, stated in the confirmation (4); `read` is the safe default in the dialog; the owner sees the attached guest and can remove them (7) |
| Many grants or a flood of input exhaust 512 MB / 1 vCPU | Grant, connection and input caps (7) |
| The audit log becomes a copy of the session | No content in audit entries (8) |
| The guest's GitHub account is compromised | Short expiry limits the window; the grant dies with the session |

## Why

Sharing hands a stranger a shell, so scope, expiry and server-side enforcement come before the feature (R38). A grant tied to a GitHub id keeps 0053's model (identity from GitHub, no bearer tokens) and needs no new account system.

Accepted 2026-10-14 with the defaults above (1 h default and 24 h maximum, 5 grants, 20 KB/s, no scrollback, no root sessions). R38 can be built from this alone.
