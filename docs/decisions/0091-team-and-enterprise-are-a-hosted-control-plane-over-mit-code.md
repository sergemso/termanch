---
id: 0091-team-and-enterprise-are-a-hosted-control-plane-over-mit-code
title: Team and Enterprise sell a hosted control plane; the code stays MIT
status: active
date: 2026-10-14
track: product
accepted-by: Sergey Strebulaev <s@vivantel.dev>
tags: [tiers, license, security, roadmap]
---

## Decision

- Every feature's code stays in this repository under MIT (0011), including RBAC and policy enforcement. There is no closed enterprise module.
- **Team** sells central administration only: an organisation with seats and invoices, a shared server directory and groups, a shared inbox and history, and provisioning of isolated environments across servers. Sharing, shared servers and isolated environments themselves are free (0089).
- **Enterprise** sells the hosted parts around enforcement: SSO/SAML, central audit retention and export, support. RBAC and data-loss-prevention rules are enforced by the server on the user's host and report only metadata (rule, session, time), never content, to the control plane (0090).
- Enterprise is shaped but not scheduled: no build starts without a real customer (0093).

## Why

A company can self-run the code but not our hosted control plane, which keeps the self-hosted promise and the MIT licence while leaving something to pay for. Enforcement on the host fits the zero-knowledge rule, since DLP needs content and we never hold it. Open core was rejected because it breaks 0011 and costs community trust.
