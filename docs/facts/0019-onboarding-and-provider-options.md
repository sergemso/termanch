---
id: 0019
title: Server Onboarding Options and VPS Provider Capabilities
status: active
tags: [onboarding, deployment, providers, ux]
date: 2026-10-11
---

# Server Onboarding Options and VPS Provider Capabilities

Researched 2026-10-11. "Unverified" means not confirmed from provider documentation.

## Onboarding paths compared (decision 0056 adopts A and B)

| Path | Actions | Phone only | Desktop SSH + phone |
|---|---|---|---|
| A. Copy the install command, paste on the VPS | Add Server, copy, switch to SSH app, paste | Yes (app switching) | Awkward |
| B. Generic command, VPS shows a QR, app scans it | Run command, scan | Via screenshot and gallery pick, about 5 actions | Best (live camera) |
| C. Short pairing code typed into the app | Run command, read, type | Yes | Yes; most typing |
| D. Provider cloud-init / create-server flow | No SSH | Yes | Yes |

- A QR can be read from a screenshot: `<input type="file" accept="image/*">` needs no camera permission.
- Terminal QRs are usually light on dark; the installer draws a white quiet zone and the decoder also tries inverted images.
- iOS Safari native `BarcodeDetector`: unverified; plan on a small JS decoder.
- A QR screenshot lands in the phone gallery or cloud photos, so the claim secret must expire and work once.
- Something must carry the secret to the VPS; A and B reduce it to one paste or one scan.

## VPS providers (not adopted; kept for a later decision)

- **DigitalOcean**: API `user_data` at droplet creation; OAuth scope `droplet:create` plus read scopes for regions, sizes, actions, images, snapshots, VPCs ([scopes](https://docs.digitalocean.com/reference/api/scopes/droplet/create/), [user data](https://docs.digitalocean.com/products/droplets/how-to/provide-user-data/)). No URL that prefills the create page with user data was found. OAuth app registration and review: unverified.
- **Hetzner Cloud**: static per-project API tokens only, no OAuth for third-party apps ([docs](https://docs.hetzner.com/cloud/api/getting-started/generating-api-token)). Browser CORS on its API: unverified. No prefilled console link found.
- **Linode/Akamai**: public StackScripts with user-defined fields; no documented share link found ([docs](https://techdocs.akamai.com/cloud-computing/docs/deploy-a-compute-instance-using-a-stackscript)).
- **Vultr**: not researched.
- The tunnel only dials out, so a created VPS can run with all inbound ports closed, including SSH.

## Third-level domains for users (rejected)

- Cloudflare free plan: 200 DNS records per zone for zones created since 2024-09-01, 1,000 for older ones ([docs](https://developers.cloudflare.com/dns/manage-dns-records/index.md)).
- Let's Encrypt: 50 new certificates per registered domain per week; Public Suffix List listing lifts it but takes months and is discouraged ([thread](https://community.letsencrypt.org/t/arbitrary-sub-n-domains-rate-limits-wildcards-and-the-public-suffix-list/12867)); official page not read.
- User-supplied content on our domain risks reputation and Safe Browsing flags; user hostnames would need a separate registrable domain.

## Cloudflare

- Self-managed OAuth clients exist since 2026-06; whether scopes cover tunnels and DNS: unverified ([docs](https://developers.cloudflare.com/fundamentals/oauth/)).
- The Deploy to Cloudflare button deploys a Workers repo into the user's account ([changelog](https://developers.cloudflare.com/changelog/2025-04-08-deploy-to-cloudflare-button/)).
- Free-plan tunnel limits and terms for non-HTML traffic: unverified (plan 8.1).
