---
id: prioritise-the-roadmap-by-wsjf
title: Order the roadmap by WSJF and dependencies
status: active
date: 2026-10-14
tags: [roadmap, procedural]
---

# Order the roadmap by WSJF and dependencies

Applies to `docs/plans/termenbox-roadmap.md` (index) and its step files in `docs/plans/roadmap/`. Run it when a step is added, finished or re-scored.

1. Score each pending step: value, time criticality and risk or opportunity, each 1-10, and size as 1, 2, 3, 5, 8 or 13. WSJF = (value + time + risk) / size. Record the numbers in the step's Status line.
2. A step takes the best score of any chain it unlocks (the chain's summed scores over its summed sizes), because a low-scoring prerequisite of a high-value step should not wait.
3. Order by that score, never placing a step before its predecessors (`Preds:`).
4. Apply the standing overrides: paid-lane steps follow the free steps (decision 0093); anything the owner pinned stays where they put it, with the date and reason in the step.
5. Edit the step file's `Score:` and `Status:` lines and run `python3 docs/plans/roadmap/rank.py`, which rewrites the Order table and applies steps 2-4. Mark finished steps `done` with the pull request number; do not delete them until the next consolidation.
6. When most steps are done, move the plan to `docs/plans/archive/` and start a new one.
