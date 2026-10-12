---
id: 0058-run-modes
title: A server runs sessions in an isolated container or on the host, chosen at install
status: active
date: 2026-10-12
track: product
accepted-by: Sergey Strebulaev <s@vivantel.dev>
tags: [deployment, security, sessions, roadmap]
---

## Decision

- Add Server offers **Isolated container** (default) and **This host**. The choice travels in the install command and QR as a trailing word.
- Host mode starts the container with `--pid=host --privileged` and runs session commands through `nsenter` into PID 1's namespaces.
- In host mode the owner picks at install between **root** and a **dedicated unprivileged `termanch` user** created by the installer.
- The installer pre-selects the dedicated user; root sessions need a passkey step-up every 12 h (0065).
- Host mode is never the default, shows its warning in the UI, and the mode is visible on the server card and in the session header.

## Why

A container shell cannot reach the host's repos, agent CLIs or files, which defeats managing real coding agents. Root on the host is already what claiming a server implies (0053), so host mode adds convenience, not a new trust boundary; the unprivileged user gives owners who want less blast radius a choice. See [[host-mode-explicit-consent]].

**Update 2026-10-12:** the privileged-container implementation of host mode (`--pid=host --privileged`, `nsenter`) is retired by [[0075-native-host-mode]]; the consent, user-choice and audit rules above stay in force for the native mode.
