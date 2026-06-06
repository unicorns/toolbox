# Slurm Dashboard UX Redesign — Design Spec

**Date:** 2026-06-05
**Status:** Approved by Ben (sections reviewed incrementally)
**Scope:** `slurm-dashboard/` React app only. Stays a static single-page app deployable to GitHub Pages.

## Goal

Turn the dashboard from a "data viewer" into an "answer machine" for Slurm users and
sysadmins. The headline question: **"How much capacity is left in each partition right
now?"** Secondary questions: who holds what, which nodes are unhealthy, what's pending
and why, what failed recently.

## Constraints

- Paste-based input stays the only data source. No URL fetching, no backend.
- **All data is ephemeral.** No localStorage/sessionStorage persistence. Refresh = blank slate.
- Keep it simple and elegant: no router, no state library, no new runtime dependencies.
- Same stack: React + TypeScript + Vite + Tailwind. Dark mode support stays.
- Fail fast and loudly: parse errors toast and clear the dashboard; no fallback rendering.

## Reference cluster (for realistic design/testing)

54 nodes × 8 B200 GPUs (256 CPUs, 1.4 TB RAM each) across 3 partitions
(`b200` 31 nodes, `b200_inf_ib` 17, `b200_mig` 6). ~45 queued jobs, ~500 sacct
rows/day. Node names like `1xtech-8b200-05-f3`. Test via
`ssh ben@dc-login.tail47b12.ts.net` (read-only commands).

## Layout & Flow

**Before paste:** centered input panel — intro line, recommended command with copy
button, textarea, Analyze / Load Example buttons. Tighter than today (no giant header).

**After paste:** input collapses to a compact top bar; dashboard renders.

- **Top bar:** app title (small), snapshot timestamp + relative age chip, timezone
  select (auto/UTC/local), theme toggle (Light/System/Dark), and a "New data" control
  that re-opens the input panel above the dashboard; the existing dashboard stays
  visible below until a new Analyze replaces it.
- **Tabs: Overview | Queue (n) | History (n)** — three tabs, Overview default.
  - The old Partitions tab folds into the capacity cards (expand for config details).
  - The old Nodes card-wall is replaced by the heatmap + click-to-detail.
  - The old Cluster Resource Summary table is superseded by the capacity cards.
- Tab labels show item counts where meaningful (queue size, history size).
- A tab with no corresponding data in the paste shows an explanatory empty state;
  Overview works from `scontrol show partition/node` output alone.

## Overview Tab

### Capacity cards (one per partition)

**Schedulability rule:** a node contributes *free* capacity only if its `State`
contains none of: `DOWN`, `DRAIN`, `FAIL`, `MAINT`, `INVAL` (covers INVALID),
`POWER` (covers POWERED_DOWN/POWERING_*), `RESERVED`, `PLANNED`, `NOT_RESPONDING`.
Allocated resources on unschedulable nodes still count toward *allocated/total*
(a draining node's running jobs are real), but its unallocated remainder is not free.

Each card shows:

- **Free GPUs** — the headline number, large: Σ(cfg − alloc) over schedulable nodes.
  For CPU-only partitions the headline becomes free CPUs.
- **Largest single-node block** — "up to 8 GPUs on one node": max(cfg − alloc) over
  schedulable nodes. Answers "can I run an 8-GPU single-node job?"
- **Idle nodes** — count of schedulable nodes in IDLE state.
- **Free CPUs / free memory** — number + compact allocated-vs-total bar.
- **Unavailable nodes** — "⚠ 2 drained, 1 down" (red), expandable to node names with
  `Reason=` text when present. Hidden when zero.
- **Pending pressure** — "⏳ 6 jobs waiting (48 GPUs requested)": aggregated from
  pending queue jobs' ReqTRES per partition. Hidden when zero.
- **Expand** (click) → partition config: State, Default badge, MaxTime, OverSubscribe,
  AllowAccounts/AllowGroups (when not ALL), TotalCPUs/TotalNodes, full node list.

A small **cluster-total strip** above the cards sums free GPUs / idle nodes / down
nodes across partitions (deduplicating nodes that appear in multiple partitions).

### Node heatmap

- Grouped by partition (one labeled row-group per partition, matching card order).
- One compact cell per node: **trimmed node name** (longest common prefix and suffix
  across all node names are stripped once globally — `1xtech-8b200-05-f3` → `05`) +
  **GPU dots**, one per configured GPU (filled = allocated, from AllocTRES vs CfgTRES
  gres/gpu; dots wrap to a second row for nodes with >8 GPUs). Nodes without GPUs
  show a mini CPU allocation bar instead of dots.
- Cell background tint by state: green = IDLE, blue = MIXED, orange = ALLOCATED,
  red = DOWN/DRAIN/FAIL, gray = anything else (COMPLETING, etc.).
- Hover tooltip: full node name, state string, CPU alloc/total, mem alloc/total,
  GPU alloc/total.
- Click → **detail panel** rendered below that partition's group: today's NodeCard
  content (CPU/mem/GRES bars, partitions, running jobs on the node from queue data).
  One node selected at a time; clicking the selected node deselects.

### Usage by user

Aggregated from running jobs that have scontrol job details (AllocTRES, NodeList):

- Columns: User · Jobs · Nodes · GPUs · CPUs · Memory · Oldest job (relative age).
- Sorted by GPUs desc, then CPUs desc.
- Node counts are unique nodes (a 4-node job = 4; two jobs sharing a node = 1).
- Oldest-job age cell gets a warning tint when the job is > 7 days old (catches
  long-running interactive holds).
- Row expands to that user's running jobs (ID, name, partition, resources, runtime).

## Queue Tab

- **State filter chips** with counts: All · Running · Pending · Other (completing,
  suspended…). Plus a text filter matching JobID/user/name/partition.
- Columns: Job ID · User · Name · Partition · **Resources** (e.g. "4n · 32 GPU" or
  "32 CPU · 170G", from AllocTRES for running / ReqTRES for pending; jobs lacking
  scontrol details show the squeue node count only) · **Runtime**
  (elapsed, with a thin progress bar vs TimeLimit; red >90%; pending jobs show "—") ·
  **State** (badge; pending jobs show the squeue Reason, e.g. `Resources`, as a
  secondary badge) · Start (relative).
- Default sort: pending jobs first in queue order, then running by start desc.
  Column headers clickable to sort; clicking again reverses.
- Row click → expanded details as today (Allocated/Requested TRES, plus Command and
  WorkDir when present in scontrol details).

## History Tab

- **State summary chips** with counts (Completed / Failed / OOM / Cancelled /
  Timeout / other states present), clickable as filters; combined with text filter.
- Failed/OOM/Timeout rows get a subtle red row tint.
- Columns: Job ID · Name · User · Partition · State · Elapsed · Start · End
  (start/end with relative time, as today).
- Expandable steps + requested-resources details stay as today.
- `CANCELLED by <uid>` states group under Cancelled for the chips.

## Architecture

```
slurm-dashboard/src/
├── App.tsx              # state + tab switching + layout shell only
├── parsing.ts           # unchanged parsing layer (input format is stable)
├── insights.ts          # NEW: all pure compute for the redesign
├── types.ts             # extended with insight result types
├── useTheme.ts          # unchanged
└── components/
    ├── ui.tsx           # shared bits: ProgressBar, Tooltip, badges, style consts
    ├── TopBar.tsx       # title, snapshot age, TZ select, theme toggle, New data
    ├── InputPanel.tsx   # command block + textarea + analyze/example
    ├── CapacityCards.tsx
    ├── NodeHeatmap.tsx  # heatmap + selected-node detail panel
    ├── NodeDetail.tsx   # node card content (reused by heatmap selection)
    ├── UserUsage.tsx
    ├── QueueTab.tsx
    └── HistoryTab.tsx
```

`insights.ts` exports pure functions (all taking parsed `SlurmData` pieces, no
component state):

- `isNodeSchedulable(state: string): boolean`
- `computePartitionCapacity(partitions, nodes, queue): PartitionCapacity[]` — free
  GPU/CPU/mem, largest block, idle/down/drained counts with reasons, pending pressure
- `computeClusterTotals(capacities | partitions, nodes): ...` — deduplicated totals
- `computeUserUsage(queue): UserUsage[]`
- `trimNodeNames(names: string[]): Map<string, string>` — common prefix/suffix strip
  (degenerate cases: single node, or trim would empty the label → keep full name)
- `computeQueueStats(queue)` / `computeHistoryStats(history)` — chip counts
- `getNodeGpuUsage(details): { total: number; allocated: number } | null`

`computeClusterSummary` (existing) is retired along with the summary table; its
aggregation logic is absorbed into `computePartitionCapacity`. Existing tests are
adapted to the new functions, preserving the regression scenarios.

## Error Handling

- Parse failure → red toast with the error message, dashboard cleared (as today).
- No partial-data fallbacks beyond section-level empty states (a missing sacct
  section is normal usage, not an error).
- Insights functions throw on structurally impossible input rather than coping.

## Testing

- **TDD with vitest** (existing setup): unit tests for every `insights.ts` function —
  drained/PLANNED/RESERVED exclusion, largest-block math, name trimming edge cases,
  user aggregation incl. multi-node jobs and unique-node counting, pending pressure,
  chip counts including `CANCELLED by N` grouping.
- Component tests with `ANONYMIZED_EXAMPLE_DATA` (existing pattern): overview renders
  capacity cards + heatmap + user table; queue/history filters work; node click shows
  detail.
- **Manual verification with real data:** build, `npm run preview`, fetch real
  cluster output over SSH, drive the browser (lightpanda/playwright), screenshot
  light + dark modes, sanity-check numbers against `sinfo`.

## Out of Scope (explicitly)

- Any data acquisition beyond paste (URL fetch, polling, SSH).
- Persistence of any kind.
- The legacy `slurm/` static HTML dashboard (already removed from repo).
- Job efficiency analytics (CPULoad vs allocation), reservations view, multi-cluster.
