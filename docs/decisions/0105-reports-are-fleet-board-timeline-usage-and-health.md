---
id: 0105-reports-are-fleet-board-timeline-usage-and-health
title: Reporting is a live fleet board, an activity timeline with a daily digest, usage and cost, and server health; on-server views are free
status: active
date: 2026-10-16
track: product
accepted-by: Sergey Strebulaev <s@vivantel.dev>
amends: [0090]
tags: [client, tiers, agents, roadmap]
---

## Decision

- Four views, under Home and Activity (0101): **Live fleet board** (every agent across servers: state, task, time running, time waiting on the user); **Activity timeline and daily digest** (tasks finished, failures, how long agents sat blocked on the user, per day and week); **Usage and cost** (tokens, spend, cache-expiry and rate-limit windows from hooks and the status-line forwarder of 0083, only where an agent exposes them, Claude first); **Server health** (CPU, RAM, disk, connection quality).
- History and usage are stored **on each server**, bounded in size and age, metadata only: session, agent, task title length-capped and scrubbed, times, counts. No terminal text and no prompts in the store. Collection stays inside 512 MB / 1 vCPU.
- Everything computed on the owner's own server and shown for that owner is **free** (`free-features-are-never-capped-for-a-tier`). What 0090 keeps in Pro is the infrastructure we pay for: cloud-archived history, cross-server aggregation retained off the servers, and reports built from that archive.
- Charts follow the design system chosen in the spike (0107) and are accessible without colour alone.

## Why

Observation is half the product goal. The data already passes through the server (0095), so on-server reports cost nothing to run for us, which is what 0089 uses to separate free from paid. Amends [[0090-pro-is-managed-relay-history-push-and-fleet-view]]: its "fleet view and usage reports" means the cross-server, cloud-retained version; the on-server board is free. Usage on the device (0073) is unchanged.
