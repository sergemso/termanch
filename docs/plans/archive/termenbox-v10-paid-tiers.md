> Archived 2026-10-14. Every open step was moved into `docs/plans/termenbox-roadmap.md` (see the `[>]` markers); this file is history.

# Termenbox Plan: paid tiers (design now, build after the free gate)

Step letters are P. Written 2026-10-14 for a cold session: read this file, then the decisions below. **Nothing in P.2-P.9 may start until P.1 is done** (decision 0093). Never build a feature into a paid tier that the classifier in `docs/skills/classify-a-feature-into-a-tier.md` puts in free. Guardrails: `free-features-are-never-capped-for-a-tier`, `paid-data-is-ciphertext-only`, `usage-stays-on-device`, `no-paid-services`, `security-secrets-handling`. Plans are tracked in GitHub issues (0049); writes to the tracker follow `tracker-writes-follow-the-answer`, so ask the owner before creating issues. One squashed PR per step from its own branch off master, green CI, merge only on the owner's "merge".

Status legend: `done`, `pending`, `blocked (reason)`.

## Goal

Fund the project without weakening the free product. Free users get the full session and agent experience within third-party free tiers; paying users and organisations get only what costs us to run or needs central coordination.

## The tiers (decisions 0089-0093, fact 0035)

| Tier | Contents | Source |
|---|---|---|
| Free | Sessions, agents, tabs, notifications, Web Push, settings and server-list sync (0068), read-only and read-write session sharing, several users per server, isolated per-user environments (need host mode, 0065). No artificial caps | 0089 |
| Pro | Managed relay, cloud session history, reliable push with inbox, fleet view and usage reports. All client-encrypted, recovery key | 0090 |
| Team | Organisation, seats and invoices, shared directory and groups, shared inbox and history, provisioning of isolated environments across servers | 0091 |
| Enterprise | SSO/SAML, central audit retention and export, support. RBAC and DLP enforced on the host, metadata-only reporting. Not scheduled until a customer exists | 0091 |

Billing: GitHub Sponsors webhook sets an entitlement on the GitHub id; a merchant of record arrives with Team (0092).

## Steps

### P.0 Record the design — done
Decisions 0089-0093, fact 0035, guardrails `free-features-are-never-capped-for-a-tier` and `paid-data-is-ciphertext-only`, the exception in `usage-stays-on-device`, the procedure `classify-a-feature-into-a-tier`, and this plan.
**Done when:** the files exist and their `INDEX.md` rows are present.

### P.1 The free gate — pending
Why: free users come first (0093). Check, do not build: (a) decision 0068 is `active` in `docs/decisions/` and its write path ships (see `termenbox-v7-output-connectors.md` and fact 0025); (b) the free Web Push and inbox path from `docs/plans/termenbox-v7-output-connectors.md` works end to end; (c) the iPhone checks listed under "Still open" in `docs/plans/termenbox-session-tabs.md` and skill `mobile-ui-device-check` pass on a real iPhone; (d) v9 G.8 and G.10 are done or consciously dropped.
**Done when:** the owner writes "gate passed" and each item above is verified against the repository, not memory.

### P.2 Entitlement record and Sponsors webhook — blocked (P.1)
Why: every paid feature checks one record. Design a small entitlement record keyed by GitHub id (tier, source, expiry) in the existing directory store (`packages/server/src/directory.rs` client side, Pages Functions + D1 side; see facts 0022 and 0064 for budgets and abuse controls). A Pages Function receives the GitHub Sponsors webhook, verifies its signature and writes the record. The function must stay within the Workers budget in fact 0022 and log no secrets.
**Done when:** a test sponsorship event sets and expires an entitlement, the request budget is recalculated in fact 0022, and the directory returns the entitlement with the device certificate (0062).

### P.3 Pro: managed relay spike — blocked (P.2)
Why: the biggest cost and the most demanded paid feature for NAT'd servers. Read fact 0025 (relay options), measure bandwidth per active session, cost at 10^3 and 10^4 Pro users, and the failure behaviour (`connections-warn-never-drop`). The relay must forward packets of the existing end-to-end DTLS session (client pins the server fingerprint, 0057) and never terminate it. Result: a fact with real numbers and a recommendation; no production relay yet.
**Done when:** a new fact states cost per user and the decision to build, defer or drop, accepted by the owner.

### P.4 Pro: encrypted history format and recovery key — blocked (P.2)
Why: history, inbox and reports share one scheme. Define the object layout, per-user key derivation as in 0068, key rotation, and the recovery key shown once. Reuse the change journal (0067). Search and reports run on the device.
**Done when:** a decision records the format, a test encrypts and restores history using only the recovery key, and a check shows the server stores no readable content (`paid-data-is-ciphertext-only`).

### P.5 Pro: reliable push and inbox retention — blocked (P.4)
Why: server-independent delivery of "an agent needs you" (0061). Extend the free Web Push path with retention in the encrypted store; a visible notification is required by Chrome and Safari (0068).
**Done when:** a notification arrives with the server stopped, and the inbox shows it on a second device.

### P.6 Pro: fleet view and usage reports — blocked (P.4)
Why: cross-server cost and cache reports (0073, 0083), computed on the device. Requires opt-in and the privacy notice from P.7.
**Done when:** a report over two servers is built on the device from encrypted objects, with nothing readable on the server.

### P.7 Privacy notice and settings — blocked (P.2)
Why: `usage-stays-on-device` and decision 0066 require the notice to change before any Pro data leaves a device. Update the privacy notice and add per-feature opt-ins in Settings (none on by default).
Also qualify the README privacy line "Your terminal traffic never touches our servers" (`README.md`, Privacy section) to say that holds unless the owner enables the managed relay, which only forwards encrypted packets.
**Done when:** the notice and the README line name the relay exception, the notice lists the new encrypted data categories and each Pro feature is off until enabled.

### P.8 Team: organisation, seats and merchant of record — blocked (P.1, P.2)
Why: seats and invoices exceed what Sponsors handles (0092). Choose Paddle or Lemon Squeezy by fees and tax handling (research, state sources), keep the same entitlement record, add organisation, seat assignment, a shared directory and groups, and cross-server provisioning of isolated environments (depends on host mode, 0065, and `unprivileged-server-never-holds-root`).
**Done when:** an organisation with two seats shares a server directory, and a webhook from the chosen vendor changes seats.

### P.9 Enterprise design note — blocked (customer)
Why: keep today's architecture enterprise-ready without building. Write only a design note: which RBAC and DLP rules the server can enforce on the host, the metadata-only report format, SSO options, audit retention. Do not start without a real customer (0093).
**Done when:** a fact or decision describes the enforcement points and the report format, and the owner accepts it.

## Open questions for the owner (recommended default first)

1. Pro price points and Sponsors tier names: recommended to decide after P.3 gives the relay cost.
2. Recovery key: show once and offer a printable sheet (recommended), or let the user store it in their own password manager only.
3. Should free users get a small relay quota (for example, a few GB per month) to remove first-run friction? Recommended: no until P.3 shows the cost; it would not be an artificial cap, but it is a new cost.
