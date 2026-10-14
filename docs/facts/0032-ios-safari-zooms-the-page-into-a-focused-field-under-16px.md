---
id: 0032
title: iOS Safari zooms the page into a focused field under 16px
status: active
tags: [ios, client, mobile]
date: 2026-10-14
kind: environmental
governed-by: 0087
last-verified: 2026-10-14
---

# iOS Safari zooms the page into a focused field under 16px

xterm's hidden input had no font size and took focus on every attach and when a menu closed. The page zoomed and panned, and only pinching back restored it (issue 99). Not reproducible in Chromium or on the Linux dev box; the report's `scale` reading shows it.
