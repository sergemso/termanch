---
id: no-native-apps
title: No Native Applications
status: active
governed-by: 0011
grounded-in: 0002,0003,0010
derivation-note: MIT license + web-only product goal + Svelte PWA approach = no native app distribution
tags: [product, distribution, platform]
---

# Guardrail: No Native Applications

## Rule
**MUST NOT** create, maintain, or distribute native applications (iOS .ipa, Android .apk/.aab, macOS .app, Windows .exe/.msi, Linux AppImage/Flatpak/Snap).

## Scope
- All user-facing clients must be web-based (PWA)
- No Capacitor, Tauri, Electron, React Native, Flutter, or similar wrappers
- No platform-specific code in client (no `if (isIOS)` branches for native APIs)
- Server components remain native Rust binaries (not user-facing apps)

## Rationale
- **Product goal**: "No native apps. No subscriptions. Self-hosted." (DECISION-0011)
- **Distribution**: Web avoids App Store review, fees, rejection risk, update lag
- **Maintenance**: Single codebase (Svelte + WASM) vs 3+ platform codebases
- **User friction**: Zero-install, works from any browser, shareable via URL

## Exceptions
- `termanch-hook` CLI installer (run once on server) is a native binary — acceptable as dev tool
- Server binaries (`termanch-server`, `termanch-agent`) are native — not user-facing apps

## Enforcement
- CI check: `grep -r "capacitor\|tauri\|electron\|react-native\|flutter" packages/client/` → fail
- PR review: Reject any native app code in client package