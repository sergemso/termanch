> Archived 2026-10-14. Every open step was moved into `docs/plans/termenbox-roadmap.md` (see the `[>]` markers); this file is history.

# Termenbox Plan: output connectors (DRAFT roadmap, needs owner review)

Decisions: 0061 (Web Push is the first connector), 0080 (connector credentials from a root-owned file; draft). Guardrails: `security-secrets-handling` (0080 is a narrow exception), `no-paid-services`, `internal-network-binding`, `audit-logging-no-secrets`, `diagnostics-never-include-secrets`, `resource-constraints`. Needs the event stream of `termenbox-v6-agent-events.md` (steps P.*). Step letters are O (free in v1-v5; the draft's C and U collided with v2 and v3). Nothing here is decided until the owner accepts it. A fresh session needs only this file, those artifacts and the repo.

Cold start: as in v6 (Rust server `packages/server`, wire types in `packages/core/src/protocol.rs` mirrored in `packages/client/src/lib/protocol.ts`, Svelte 5 client in `packages/client/src`; `npx --yes pnpm@9`; one squashed PR per step, merge only on the owner's "merge"; never touch the owner's own container). Outbound traffic comes from the VPS, so everything below assumes the VPS is on the free tier with 512 MB RAM and 1 vCPU.

## Goal

One rule list on the server: `when <event filter> → send <summary> to <connector>`, with limits and redaction, configured from the app.

## Connectors

| Connector | Notes |
|---|---|
| Web Push (PWA) | decided in 0061; payload carries no terminal text; the VAPID private key follows 0080 |
| In-app inbox / badge | the always-available fallback |
| Telegram bot, Slack/Discord webhook, ntfy | the user's own token or URL (0080); free; outbound from the VPS |
| Generic webhook | POST of the event JSON for the user's own automation |
| Another session | writes text into a named session. High risk (prompt injection between agents, loops): off by default, per-rule explicit target, rate-limited, audit-logged |
| Custom model | the user's own API key (0080), never ours; off by default; deferred (see questions) |

## Rules every connector obeys

- **Metadata only by default** (session name, state, tool name). Terminal text and file contents leave the machine only if the rule says so, and the rules screen says so plainly. Event text is already sanitised and scrubbed in v6; connectors scrub again on the way out.
- **Credentials** per 0080: read from `connectors.env` at start, held in memory, never logged, never sent to the client, never in reports. A webhook URL is a secret.
- **No server-side request forgery.** Every outbound URL is resolved first and refused if any address is loopback, link-local (including the cloud metadata address 169.254.169.254), private, or unique-local; redirects are not followed; the resolved address is the one connected to (no second lookup); a 5 s timeout and a response size cap. Only `https` is allowed except for a user-set `ntfy` host on a private network, which needs its own typed confirmation.
- **Delivery is bounded.** Per-rule and global rate limits; retries with exponential backoff (3 tries, then drop and record "failed" in the inbox); a bounded queue per connector (100 items, oldest dropped) so an outage cannot grow memory; deduplication of identical events within 60 s; a loop breaker that disables a rule that fires more than 30 times in 5 minutes and tells the owner.
- **Risky connectors need a typed confirmation** to enable, like host mode, and each rule naming a session or model target is confirmed on its own.

## Steps

### O.1 Spike: payload and abuse review — [>] moved to docs/plans/termenbox-roadmap.md as R10
Class: research · Needs: v6 P.1 · Check: `test -s docs/facts/0030-connector-threat-table.md`
Do: write the threat table: per connector, what leaks, what an injected agent could trigger, what a hostile webhook URL could reach, and what the loop and cost bounds are. Confirm 0080 with the owner (and the SSRF rules above).
Done-when: fact 0030 exists and 0080 is accepted or changed.

### O.2 Rule engine, connector trait and outbound guard — [>] moved to docs/plans/termenbox-roadmap.md as R11
Class: implement · Needs: v6 P.2, O.1 · Check: `cargo test -p termenbox-server connectors`
Do: 1. `Connector` trait, rule storage (rules hold a credential name, never the credential), filter matching. 2. The outbound guard from "No server-side request forgery" as the only way connectors make requests. 3. Queue, backoff, dedupe, rate limits and the loop breaker. 4. `connectors.env` loader (mode check: refuse a file readable by others). 5. Dry-run "test this rule" with a sample event that does not send. 6. A scrub pass on every outbound payload.
Done-when: tests prove blocked addresses (127.0.0.1, 10.0.0.1, 169.254.169.254, `::1`, a name that resolves to them, a redirect to them), the queue bound, the retry cap, the loop breaker, a world-readable credentials file refused, and that no credential appears in logs, audit entries or messages to a client.

### O.3 Web Push and inbox — [>] moved to docs/plans/termenbox-roadmap.md as R12
Class: implement · Needs: O.2, v6 P.6 · Check: `cargo test -p termenbox-server push && cd packages/client && npx --yes pnpm@9 test`
Context: Decision 0061; Web Push on iOS needs the installed PWA (16.4+).
Do: 1. VAPID key loaded per 0080 (the app shows the one line to add, and the public key). 2. Subscriptions stored per device; expired ones removed on a 404 or 410 response. 3. Payload "session X needs you" only. 4. Inbox with unread badge, bounded to 200 items.
Done-when: a fake push endpoint receives a payload with no terminal text; an expired subscription is removed; the inbox renders after a restart of the app.

### O.4 Telegram and generic webhook — [>] moved to docs/plans/termenbox-roadmap.md as R14
Class: implement · Needs: O.2 · Check: `cargo test -p termenbox-server connectors::webhook connectors::telegram`
Do: both through the outbound guard; message text is metadata only unless the rule opts in; Telegram's token is referenced by name from `connectors.env`.
Done-when: tests with a local fake server (allowed only via a test-only guard override) check payload shape, backoff and that a token never appears in a log line.

### O.5 Session and model connectors — [>] moved to docs/plans/termenbox-roadmap.md as R15
Class: implement · Needs: O.1 sign-off, O.2 · Check: `cargo test -p termenbox-server connectors::session`
Do: session connector writes only to a named target, never to the source session, with a cap of one write per 10 s and a typed confirmation. The model connector is built only if the owner answers yes to question 3.
Done-when: tests show a source session cannot target itself, the rate cap holds, loops are cut by the breaker, and every write is audit-logged without its text.

### O.6 Rules screen in the app — [>] moved to docs/plans/termenbox-roadmap.md as R16
Class: implement · Needs: O.2, O.3 · Check: `cd packages/client && npx --yes pnpm@9 test`
Do: list, create (with the "what leaves the machine" line shown per rule), test, pause one, pause all; credentials appear as "set / not set", with the line to add; the loop-breaker disable is shown as a banner.
Done-when: tests cover create, test, pause all and the banner; the e2e shows a rule firing into the inbox on a fake event stream.

## Open questions for the owner (recommended default first)

1. Which messengers first? Recommended: ntfy and Telegram (both free and simple), Slack later.
2. Credentials from `connectors.env` with the narrow exception of 0080? Recommended: yes.
3. Model connector in this scope? Recommended: defer.
