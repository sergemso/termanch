---
id: a-phone-check-names-its-platform
title: A phone check names the platform it ran on, and an emulator is never reported as a phone
status: active
governed-by: 0107
grounded-in: [0107, 0039]
derivation-note: Android is supported but unverified on a device (fact 0039); honest labels keep that visible without blocking work on hardware.
tags: [client, mobile, ios, android]
---

# Guardrail: A phone check names its platform

## Rule
**MUST** record, for each screen, whether it was checked on a real iPhone, a real Android phone, or emulated only, in the PR and in the step's Done-when. **MUST NOT** describe an emulated or desktop-browser run as a phone check. **MUST NOT** close the free gate (R40) until iPhone and Android real-device passes both exist.
