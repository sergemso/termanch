---
id: 0073-usage-tiers-on-device
title: Usage tiers and a thank-you badge are computed on the device and never leave it
status: active
date: 2026-10-12
track: product
accepted-by: Sergey Strebulaev <s@vivantel.dev>
tags: [client, mobile, privacy]
---

## Decision

- The client counts foreground time with an attached session per ISO week in its own storage, keeping the last 8 weeks.
- Tiers by weekly hours: copper at least 1 h, silver 5 h, gold 15 h, platinum 30 h. The badge shows the tier of the last completed week, and the current week as progress to the next tier.
- Tapping the badge opens stats (hours this week, last 8 weeks, tier) and a Say thanks button to the project's GitHub Sponsors page; the repository also carries `.github/FUNDING.yml`.
- No unsolicited prompts, no notifications, nothing interrupts the terminal.
- Nothing about usage is sent to us. A tier is per browser. If decision 0068 ships, usage may travel inside the owner's encrypted object, still unreadable by us.

## Why

Asking active users for support needs only a local measure, so there is no tracking, no notice change, no Worker budget and no accounts (fact 0022, decision 0066). A central ranking was considered and rejected as a new data category for little gain. See [[usage-stays-on-device]].
