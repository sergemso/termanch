---
id: 0078-install-for-the-current-user
title: A host install can run sessions as the user who ran the installer
status: active
date: 2026-10-13
track: product
accepted-by: Sergey Strebulaev <s@vivantel.dev>
tags: [deployment, security, client]
---

## Decision

- The installer takes a third host word, `host-me`: the systemd unit runs as the user who ran the command (the name arrives as `SUDO_USER`), so sessions open on their behalf, in their home, with their repositories, SSH keys and agent logins. No user is created.
- It is a system unit with `User=<that user>`, not a user-level unit: the updater, request handler, firewall rule and `KillMode=process` behave as in 0075/0076/0077, and the server never holds root.
- Plain root without `SUDO_USER`, an account named `root`, or an account without a home directory is refused; the installer never guesses a user.
- Consent (guardrail `host-mode-explicit-consent`) is its own choice in Add Server with its own warning, which says the sessions reach everything that user can reach, including keys and logins. `host-user` stays the recommended host choice.
- A re-run never changes who sessions run as; it says so and points to uninstall. Uninstall and revert never delete this user or their home (the journal has no `user_created` entry for it).

## Why

Agents work where the owner's repositories, credentials and tools already are. The dedicated `termenbox` user needs those copied or shared, which is the main adoption friction of host mode; running as the owner removes it at a cost the owner must see before agreeing.
