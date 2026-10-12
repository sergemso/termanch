---
id: 0023
title: Threat model
status: active
tags: [security, threat-model]
date: 2026-10-12
---

# Threat model

**Assets**: the owner's shell on a VPS (root in host mode), the GitHub identity, the signed directory records, the signing keys and release pipeline, the free-tier budget (fact 0022).

**Actors**: a rogue or compromised server, a network attacker, someone with a stolen GitHub login or unlocked phone, a mass registrar, a supply-chain attacker (CI, image, upstream tool), a malicious web page (XSS).

**Findings and the decision that answers each**: token replay across servers (0062); supply chain through installer, image and updater (0063); directory exhaustion (0064); host mode as root behind one factor (0065); XSS and personal data (0066); losses on user machines (0067).

**Already in place (reviewed 2026-10-12)**: announces are signature-checked and need a public IP; per-source new-id limit; UDP peer limits and a token bucket (`rtc.rs`); no OAuth secret on servers; scope `read:user`. Not yet checked: current response headers of the hosted client.
