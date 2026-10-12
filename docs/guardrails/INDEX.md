# Guardrails Index

| ID | Title | Governed By | Grounded In | Status |
|---|---|---|---|---|
| no-native-apps | No Native Applications | 0011 | 0002,0003,0010 | active |
| no-paid-services | No Paid Services in Required Stack | 0011 | 0001,0013 | active |
| minimum-browser-support | Minimum Browser Support Policy | 0001,0005 | 0003,0004 | active |
| resource-constraints | Resource Constraints (512MB RAM, 1 vCPU) | 0001 | 0001 | active |
| security-secrets-handling | Secrets Handling (Memory Only, No Logs) | 0006,0009 | 0008,0011 | active |
| internal-network-binding | Internal Network Binding (127.0.0.1 Only) | 0001 | 0001 | active |
| audit-logging-no-secrets | Audit Logging Without Secrets | 0006,0009 | 0008,0011 | active |
| paranoid-mode | Paranoid Mode (Outbound Block) | 0001 | 0001 | active |
| bootstrap-simplicity | 1-2 Click Bootstrap for Users | 0013 | 0001,0011 | active |
| ci-only-builds | All Builds Run in CI Only | 0010,0011 | 0010,0011 | active |

<!-- bootstrap-generated: true -->
instruction-file-within-cap,"The instruction file must stay within 150 lines","practice-packs, harness, guardrail",active
procedure-delivery-rule,"Detailed procedures live in skills loaded on demand","practice-packs, harness, guardrail",active
noisy-work-rule,"Noisy work is delegated only when the cost model says the handoff is cheaper","practice-packs, harness, guardrail",active
cache-hygiene-rule,"No mid-task model, effort or instruction-file change; switches are confirmed","practice-packs, harness, guardrail",active
compaction-timing-rule,"Context is compacted at task boundaries","practice-packs, harness, guardrail",active
watches-use-the-wrapper,"Watches start through go-getter watch, --until done for CI runs and long commands","practice-packs, harness, guardrail",active
delegations-are-routed,"Delegations to a role are routed by expected total step cost","practice-packs, model-routing, guardrail",active
reviewer-read-only,"The reviewer must not modify files","practice-packs, agent-roles, guardrail",active
parallel-tasks-use-worktrees,"Parallel tasks must each use their own worktree","practice-packs, agent-roles, guardrail",active
max-concurrent-agents-rule,"No more than 3 agents run at once","practice-packs, agent-roles, guardrail",active
human-escalation-rule,"Agents must hand over to a human when blocked, before irreversible actions and on a guardrail denial","practice-packs, agent-roles, guardrail",active
handoff-has-brief-result-evidence,"Handoffs must carry a brief, a result and evidence","practice-packs, agent-roles, guardrail",active
verification-gate-blocks-done,"A step is not done while its verification checks fail","practice-packs, verification, guardrail",active
branch-names-follow-the-pattern,"Branch names must match the project pattern","practice-packs, git-hooks, guardrail",active
commit-subjects-are-conventional,"Commit subjects must follow Conventional Commits","practice-packs, git-hooks, guardrail",active
changes-land-as-one-squashed-pull-request,"A change lands as one squashed pull request with green CI","practice-packs, git-hooks, guardrail",active
no-commits-on-the-default-branch,"Work must not happen on the default branch","practice-packs, git-hooks, guardrail",active
tracker-writes-follow-the-answer,"Writes to the plan tracker follow the project's answer","practice-packs, hooks, guardrail",active
host-mode-explicit-consent,"Host mode needs explicit consent and is audited","security, deployment",active
directory-request-budget,"The directory stays within the free request budget at 10^5 servers","directory, scale, cost",active
github-token-stays-in-browser,"The GitHub token never goes to a server","security, auth",active
releases-are-signed,"Releases, bundled tools and the installer are signed and verified","security, supply-chain",active
host-changes-are-journaled,"Host changes are journaled and revertible","safety, deployment",active
soft-keyboard-never-hides-input,"The soft keyboard never hides the key row or terminal input","client, mobile, ios",active
kill-session-needs-confirmation,"Killing a session needs confirmation","client, protocol",active
connections-warn-never-drop,"Connections are limited by warning, never by dropping","client, mobile, performance",active
remote-uninstall-is-deliberate-and-scoped,"Remote uninstall is owner-only, confirmed, fresh and scoped","security, deployment, client",active
usage-stays-on-device,"Usage and tier data stay on the device","client, privacy",active
diagnostics-never-include-secrets,"Problem reports never include secrets, session content or addresses","security, privacy, client",active
