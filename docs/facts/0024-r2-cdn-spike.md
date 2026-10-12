---
id: 0024
title: R2 and CDN spike results
status: active
tags: [directory, scale, cloudflare, r2, spike]
date: 2026-10-12
---

# R2 and CDN spike results

Plan step C.1, run on 2026-10-12 against this project's Cloudflare account (free zone `vivantel.dev`) with a throwaway bucket, a custom domain and the account API token. Everything created was deleted afterwards (objects, custom domain, bucket, DNS record).

## Verified

- **R2 is enabled on the account and a bucket was created through the API with no prompt.** Whether the account has a payment method on file could not be read (the token gets "Authentication error" on billing endpoints), so the "R2 needs a card" question stays open and belongs to the account owner to check in the dashboard.
- **A public custom domain works** (`termanch-spike.vivantel.dev` on the zone's free certificate; a single-label name under the zone). Objects were served with `server: cloudflare` and no Worker in the path.
- **`Cache-Control: no-cache` objects are never cached at the edge**: three reads gave `cf-cache-status: DYNAMIC`, so every read reaches R2 (one Class B operation each). Latency from a German VPS: 120–190 ms.
- **Cache-Control alone does not make `.json` cacheable.** With `max-age=3600` and no Cache Rule, a `.json` object stayed `DYNAMIC`. The token cannot edit zone Cache Rules ("Authentication error" on the rulesets API), so a rule was not tested.
- **Default extension caching works with no rule:** objects named `.js` or `.csv` (content type `application/json`, `max-age=3600`) were `MISS` then `HIT` with `age`, about 70 ms. So cacheable public records can use such an extension, or a Cache Rule can be added once the token has that permission. Use `X-Content-Type-Options: nosniff` and a non-script extension such as `.csv` to avoid script confusion.
- **Conditional writes work on R2**, tested through the S3 API with the account token as credentials (key id = token id, secret = SHA-256 of the token): `If-None-Match: *` created the object and a second create returned `412 PreconditionFailed`; `If-Match: <etag>` succeeded with the current etag and returned `412` with a stale one. This is the compare-and-set that decision 0068 relies on.

## Not verified

- The Workers path (a Worker with an R2 binding): the token cannot reach the Workers preview API, so Worker-side `onlyIf` and CPU time were not measured. The S3 semantics above are the same primitive.
- Whether cached reads avoid Class B charges in the billing counters (the observed `HIT` means no origin read).
- The free-tier numbers themselves beyond what Cloudflare's docs state (fact 0022).

## Consequences

- Public, edge-cacheable records need an extension Cloudflare caches by default (or a Cache Rule with an extended token). User data stays `no-cache` and costs one Class B read per app open, as modelled in fact 0022.
- Conditional put makes the per-user object safe against two devices writing at once.
