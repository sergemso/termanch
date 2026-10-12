---
id: releases-are-signed
title: Releases, bundled tools and the installer are signed and verified
status: active
governed-by: 0063
grounded-in: 0063
derivation-note: A compromised release channel reaches every host-mode server.
tags: [security, supply-chain]
---

# Guardrail: Releases, bundled tools and the installer are signed and verified

## Rule
**MUST** sign every published image and verify signatures or upstream checksums before installing or updating. **MUST NOT** update host-mode servers automatically unless the owner opted in. **MUST** honour the signed `freeze` file in the installer and every updater.
