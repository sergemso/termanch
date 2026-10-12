# Security policy

## Reporting a vulnerability

Please report security problems privately through GitHub security advisories:
https://github.com/sergemso/termanch/security/advisories/new

Do not open a public issue for a vulnerability. You will get an acknowledgement within 7 days. We aim to fix
confirmed issues within 90 days and publish an advisory when the fix ships; please keep the report private until then.

## Scope

In scope: `termanch-server`, the hosted client and its Pages Functions (`app.termanch.vivantel.dev`), the installer
(`install.sh`) and the published container images.

Out of scope: findings that need a rooted device or an already-compromised server owner account, denial of service by
sheer traffic volume, and issues in third-party services (GitHub, Cloudflare).

## What we protect

A server's owner can open a shell on their own VPS, so the main assets are the owner's GitHub identity, the signed
directory records, and the release pipeline. See `docs/facts/0023-threat-model.md` for the threat model and
`docs/decisions/0062` to `0067` for the planned hardening.
