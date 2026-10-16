---
id: 0068-user-data-in-r2-and-live-sync
title: The owner's server list and settings are encrypted objects read from the CDN, with live sync through servers
status: active
date: 2026-10-12
track: product
accepted-by: Sergey Strebulaev <s@vivantel.dev>
tags: [directory, scale, sync, roadmap]
---

## Decision

- Each user's server list and settings are one object, client-side encrypted, at an unguessable public path. The function derives a per-user secret by HKDF from a master secret and the GitHub id and hands it out with the device certificate (0062); the secret gives both the object name and the encryption key. Bucket listing stays disabled.
- Reads go straight to the public domain with no Worker or D1 and with `no-cache`, so every app open is fresh. Reads survive a Workers or D1 outage and an exhausted Workers quota.
- Writes go through a Worker with a conditional put on the object's etag, so concurrent edits from two devices cannot overwrite each other. When a write fails the client queues it locally and retries.
- Open apps learn about changes live: the change goes over the data channel to a connected server, which relays "revision N changed" to the owner's other connected devices. Installed PWAs may opt in to a visible Web Push, off by default (Chrome and Safari require a visible notification, so push is not a silent channel).
- D1 is not used for user data; it keeps only short-lived claims. No polling of the object, to protect the R2 read budget.
- The model and the numbers behind it are in fact 0022.

## Why

It removes list reads from Workers, the D1 single point of failure for user data and the staleness of a cached list, within the free tiers. Amends 0060. Open: R2 may need a payment method (see 0022 and 0024). The spikes are done: fact 0024 verifies the R2 and CDN behaviour and conditional writes; fact 0025 compares an open relay network, an own VM, sharding and R2 with Workers, and recommends relays with R2 as the fallback. The choice is the owner's, so this stays a draft.
