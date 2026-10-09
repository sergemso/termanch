---
id: paranoid-mode
title: Paranoid Mode (Outbound Block)
status: active
governed-by: 0001
grounded-in: 0001
derivation-note: Self-hosted VPS deployment + no paid services = user may want strict egress control
tags: [security, network, paranoid]
---

# Guardrail: Paranoid Mode (Outbound Block)

## Rule
**SHOULD** provide a "paranoid mode" configuration that blocks all outbound connections except:
- SSH (TCP 22) to configured hosts (for git push, agent updates)
- WebTransport/QUIC (UDP 443) to server's own public IP
- DNS (UDP 53) to resolver
- NTP (UDP 123) for time sync

## Configuration
`/etc/termanch/paranoid.toml`:
```toml
[paranoid]
enabled = true
allow_ssh_hosts = ["github.com", "gitlab.com", "user's git host"]
allow_quic_server = "auto"  # detect from listen address
allow_dns = ["1.1.1.1", "8.8.8.8"]
allow_ntp = ["time.cloudflare.com"]
```

## Implementation
- **nftables** rules applied by `termanch-server` on start (requires `CAP_NET_ADMIN`)
- Or: systemd `IPAddressDeny=any` + `IPAddressAllow=` in unit file
- Or: User-managed (documented) — default for MVP

## Rationale
- **Data exfiltration prevention**: Compromised agent/hook cannot phone home
- **Supply chain defense**: Malicious dependency update cannot reach C2
- **Compliance**: Meets air-gap-adjacent requirements for sensitive environments

## Tradeoffs
- Breaks: Auto-updates, telemetry (opt-in), plugin marketplace (future)
- Requires user to manage allowlists for their git hosts
- `CAP_NET_ADMIN` needed for auto-nftables (optional; document manual setup)

## Enforcement
- CI: Integration test with `paranoid.enabled=true` — verify outbound blocked
- Documentation: `docs/paranoid-mode.md` with setup instructions
- Default: `enabled = false` (opt-in)