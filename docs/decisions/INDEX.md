# Decisions Index

| ID | Title | Track | Status | Accepted By | Expires |
|---|---|---|---|---|---|
| 0001 | WebTransport with WebSocket Fallback | product | deferred | architect | 2027-10-09 |
| 0002 | Svelte 5 for Client Framework | product | active | architect | - |
| 0003 | Full Frame Deltas with Rope/Sequence CRDT for SSP | product | deferred | architect | - |
| 0004 | Binary Protobuf-like Wire Protocol with Varint Encoding | process | active | architect | - |
| 0005 | iOS Safari Mitigation via Background Fetch, Push, and Service Worker | product | deferred | architect | 2027-10-09 |
| 0006 | SSH Agent Forwarding for Authentication | product | deferred | architect | - |
| 0007 | PTY Wrapper with Shell Hooks for Agent Integration | product | deferred | architect | - |
| 0008 | xterm.js with WebGL Addon for Terminal Rendering | product | active | architect | - |
| 0009 | ChaCha20-Poly1305 for Packet Encryption | process | deferred | architect | - |
| 0010 | Monorepo with Cargo Workspace and pnpm Workspace | process | active | architect | - |
| 0011 | MIT License for All Components | product | active | architect | - |
| 0012 | vte Crate for Terminal Emulation in WASM | process | deferred | architect | - |
| 0013 | User Self-Hosted Server with Hosted Client | product | active | architect | - |

<!-- bootstrap-generated: true -->
0014-instruction-file-cap,"The always-loaded instruction file is capped at 150 lines","practice-packs, harness, cost",active
0015-procedure-delivery,"Detailed procedures live in skills loaded on demand","practice-packs, harness, cost",active
0016-noisy-work-placement,"Noisy work is delegated only when the cost model says the handoff is cheaper","practice-packs, harness, cost",active
0017-cache-hygiene,"No mid-task model, effort or instruction-file change; switches are confirmed","practice-packs, harness, cost",active
0018-compaction-timing,"Context is compacted at task boundaries","practice-packs, harness, cost",active
0019-watcher-noise,"Watchers are quiet","practice-packs, harness, cost",active
0020-routing-classes,"Routing distinguishes explore, plan, implement, review and debug","practice-packs, model-routing, cost",active
0021-routing-start-tiers,"Classes start at balanced tiers and the lowest effort they allow","practice-packs, model-routing, cost",active
0022-routing-max-escalations,"A failed step escalates at most 2 times, then a human decides","practice-packs, model-routing, cost",active
0023-routing-spend-cap,"Headless runs are capped at 5 USD where the host has a cap","practice-packs, model-routing, cost",active
0024-routing-cache-ttl,"The prompt cache lives one hour in the main session and five minutes in subagents","practice-packs, model-routing, cost",active
0025-agent-roster,"Work is delegated to planner, explorer, implementer, reviewer and tester agents","practice-packs, agent-roles, harness",active
0026-reviewer-access,"The reviewer reports findings and changes nothing","practice-packs, agent-roles, harness",active
0027-parallel-isolation,"Each parallel task runs in its own git worktree","practice-packs, agent-roles, harness",active
0028-worktree-location,"Task worktrees live next to the repository","practice-packs, agent-roles, harness",active
0029-max-concurrent-agents,"At most 3 agents run at once","practice-packs, agent-roles, harness",active
0030-human-escalation,"Agents hand over to a human when blocked, before irreversible or outward-facing actions, and on a guardrail denial","practice-packs, agent-roles, harness",active
0031-handoff-contract,"Handoffs are a brief in, then a result and evidence out","practice-packs, agent-roles, harness",active
0032-verification-checks,"Implement and debug steps pass the project's detected check commands","practice-packs, verification, harness",active
0033-verification-test-command,"The verification test command is ""cargo test""","practice-packs, verification, harness",active
0034-verification-lint-command,"The verification lint command is ""cargo clippy""","practice-packs, verification, harness",active
0035-verification-typecheck-command,"The verification typecheck command is ""cargo check""","practice-packs, verification, harness",active
0036-verification-format-command,"The verification format command is ""cargo fmt --check""","practice-packs, verification, harness",active
0037-verification-static-analysis-command,"The verification static-analysis command is """"","practice-packs, verification, harness",active
0038-verification-build-command,"The verification build command is ""cargo build""","practice-packs, verification, harness",active
0039-verification-unit-command,"The verification unit command is """"","practice-packs, verification, harness",active
0040-verification-integration-command,"The verification integration command is """"","practice-packs, verification, harness",active
0041-verification-e2e-command,"The verification e2e command is """"","practice-packs, verification, harness",active
0042-verification-machine-profile,"Cheap checks run locally, slow checks only in CI (thin machine profile)","practice-packs, verification, harness, ci",active
0043-verification-review-bar,"Review steps pass a reviewer-agent verdict","practice-packs, verification, harness",active
0044-verification-gate,"""Done"" is blocked while the verification checks fail","practice-packs, verification, harness",active
0045-branch-names,"Branches are named ^(feat|fix|docs|chore|ci|test|refactor|perf|build|style|revert)/[a-z0-9][a-z0-9._-]*$","practice-packs, git-hooks, guardrail",active
0046-change-unit,"One change is one branch and one pull request","practice-packs, git-hooks, guardrail",active
0047-default-branch,"The default branch takes no direct work","practice-packs, git-hooks, guardrail",active
0048-refs-trailers,"Refs trailers are encouraged","practice-packs, git-hooks, guardrail",active
0049-plans-in-github,"Plan steps live in GitHub Issues","practice-packs, roadmap",active
0050-tracker-writes,"go-getter may write to the tracker without asking","practice-packs, roadmap",active
0051-mvp-evolve-baseline,"The hybrid MVP is the baseline; v1-only designs are deferred","architecture, roadmap",active
0052-both-hosting-modes,"Hosted client and self-hosted client are both supported","deployment, roadmap",active
0053-single-owner-servers,"A server belongs to one GitHub user","security, auth, roadmap",active
0054-session-backends,"The server owns sessions through a pluggable backend","architecture, sessions, agents",active
0056-automatic-connectivity,"Servers reach the client automatically through a signed directory and quick tunnels","deployment, networking, security, roadmap",active
0057-webrtc-direct-transport,"The browser reaches the server over a direct WebRTC data channel","transport, networking, security, roadmap",active
0058-run-modes,"A server runs sessions in an isolated container or on the host, chosen at install","deployment, security, sessions, roadmap",active
0059-environment-profile-and-bundled-tools,"The environment profile lives on the server and bundled tools update themselves","deployment, sessions, agents, roadmap",active
0060-directory-scale-r2-cdn,"The directory serves at least 10^5 servers on free tiers, with public records on R2 behind the CDN","directory, scale, networking, roadmap",active
0061-agent-state-and-push,"Agent state comes from process scans and tool adapters; notifications are installed-PWA Web Push","agents, notifications, pwa, roadmap",active
0062-device-key-credentials,"Browsers authenticate to servers with a device key and a signed certificate, never the GitHub token","security, auth, roadmap",active
0063-signed-releases-and-opt-in-updates,"Releases are signed, the installer pins digests, and host-mode updates are opt-in","security, supply-chain, deployment, roadmap",active
0064-directory-abuse-controls,"The directory resists abuse and clients keep working when it is exhausted","directory, security, scale, roadmap",active
0065-host-mode-step-up,"Root host sessions need a passkey step-up and devices can be revoked","security, auth, deployment, roadmap",active
0066-web-baseline-and-privacy,"The hosted client ships a strict CSP, a disclosure policy, a privacy notice and data deletion","security, privacy, web, roadmap",active
0067-change-journal-and-revert,"Every host change is journaled, previewed and revertible","safety, deployment, roadmap",active
0068-user-data-in-r2-and-live-sync,"The owner's server list and settings are encrypted objects read from the CDN, with live sync through servers","directory, scale, sync, roadmap",draft
