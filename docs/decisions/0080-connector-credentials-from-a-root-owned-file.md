---
id: 0080-connector-credentials-from-a-root-owned-file
title: Connector credentials come from a root-owned file read at start and are held in memory
status: draft
date: 2026-10-13
track: product
tags: [security, secrets, notifications, roadmap]
---

## Decision (draft: needs the owner's acceptance; an exception to guardrail `security-secrets-handling`)

- Third-party credentials the user supplies for output connectors (bot tokens, webhook URLs, model API keys) and the Web Push VAPID private key are read at start from one file, `connectors.env`, mode 0600, owned by the account that owns the server's state. The server holds them in memory only, never logs them, and never sends them to the client; the app shows only that a credential is set.
- The app does not accept credentials over the connection. The user places them in the file (the app shows the exact line to add). A bot token typed into a phone is one more place for it to leak, and a stored-and-encrypted copy would sit beside its own key.
- The exception is narrow: it covers these user-supplied credentials and the VAPID key. Termenbox's own keys (session, device, directory) keep the strict rule. The file is outside the repository, excluded from reports (guardrail `diagnostics-never-include-secrets`), and its values are scrubbed from audit entries; a webhook URL counts as a secret.
- The VPS is the only place these credentials exist, so losing the machine means rotating them; the app says so next to the setup line.

## Why

The guardrail forbids secrets on disk and in environment variables, yet a connector cannot survive a restart without its credential. A root-owned file read once is the smallest departure; encrypting with a key on the same disk adds no protection, and accepting credentials from the browser widens exposure for no gain.
