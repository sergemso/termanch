---
id: bootstrap-simplicity
title: 1-2 Click Bootstrap for Users
status: active
governed-by: 0013
grounded-in: 0001,0011
tags: [product, ux, deployment]
---

# Guardrail: 1-2 Click Bootstrap

## Rule
User onboarding from zero to working terminal **MUST** complete in ≤ 2 user-initiated actions after VPS is provisioned.

## Required Flow
1. **User provisions VPS** (outside our control — DigitalOcean, Hetzner, etc.)
2. **User runs single command** on VPS:
   ```bash
   curl -fsSL https://get.termanch.dev | bash
   # or: docker compose -f <url> up -d
   ```
3. **User opens `https://app.termanch.dev`** → Login with GitHub (1 click)
4. **User clicks "Add Server"** → Scans QR code with phone (1 click)
5. **Terminal works** — types `ls`, sees output

## Total User Actions: 2 clicks (Login + Scan QR)

## Prohibited
- Manual config file editing
- Copy-pasting tokens/URLs between terminal and browser
- Port forwarding / firewall rules
- DNS configuration
- Kubernetes / systemd service files
- Any "read the docs" step before it works

## Enforcement
- E2E test: Fresh VPS → working terminal in < 5 min, ≤ 2 clicks
- CI: `grep -r "nano\|vim\|edit\|config\|yaml\|systemd" docker/` → fail
- Docs: Single `README.md` with copy-paste deploy command

## Cost Corollary
- **User pays**: VPS only ($5–10/mo). No Termanch subscription.
- **Termanch pays**: Cloudflare Pages free tier. GitHub OAuth free. No per-user cost.