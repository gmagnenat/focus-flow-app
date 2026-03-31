# Daily Timesheet & Day Boundary Design

**Date:** 2026-03-31
**Status:** Approved
**Branch:** feature/weekly-review

## Problem

The Dashboard currently shows cumulative timer values and all logs across all time. Timers never reset, so after weeks of use they show hundreds of hours. Logs are unfiltered — the dashboard mixes today's work with historical entries. The app needs a clear "daily timesheet" model where the first screen reflects today's work only.

## Decisions

- **Approach B** selected: day boundary logic in persistence + view-layer filtering for today's logs
- Timer left running overnight: time up to midnight is added to yesterday's log, then timer stops and resets
- Full log history lives on a new `/history` route
- Weekly summary export added to Review page (week tab only)

## Design

### 1. Day boundary logic in `usePersistence`

On hydration, if `lastSavedAt` is before `startOfDay(now)`:

1. Calculate the gap from `lastSavedAt` to `endOfDay(lastSavedAt)` (midnight)
2. Add that gap to the active timer's log entry — yesterday's work is preserved
3. Set the log entry's `endTime` to midnight
4. Reset `timerValues` to `{ 1: 0, 2: 0, 3: 0 }`
5. Set `activeTimerId` to `null`, `activeStartTime` to `null`
6. Timer is stopped — user manually restarts for the new day

If `lastSavedAt` is today: existing behavior (add gap from `lastSavedAt` to `now` to active timer).

**File:** `src/hooks/usePersistence.ts` — inside the existing `if (stored.activeTimerId !== null)` block, as a conditional branch before the current gap calculation.

### 2. Dashboard — today-only logs and summary

Dashboard becomes a daily timesheet view:

- Derive `todayLogs` from the full `logs` array using `startOfDay(now)` filter via `useMemo`
- Pass `todayLogs` to `LogList` (instead of all logs)
- Pass `todayLogs` to the summary export (instead of all logs)
- `totalSeconds` from context reflects timer values which reset daily (via Section 1)
- No changes to timer cards, manual entry form, or export format logic

```ts
const todayLogs = useMemo(() => {
  const dayStart = startOfDay(new Date()).getTime()
  return logs.filter(log => log.startTime >= dayStart)
}, [logs])
```

**File:** `src/pages/Dashboard.tsx`

### 3. History page (`/history`)

New route showing all logs grouped by date.

- New page `src/pages/History.tsx`
- Reuses existing `LogList` component (with edit/delete capabilities)
- Logs grouped by day using `startOfDay(log.startTime)`, most recent day first
- Each day group has a header showing the date and total time for that day
- Gets full `logs` from `useLogContext()` — no filtering
- No pagination for now

**Navigation:** Add "Historique" link in nav bar (`App.tsx`) alongside Dashboard and Revue.

**Files:** `src/pages/History.tsx` (new), `src/App.tsx`, `src/main.tsx`, `src/App.css`

### 4. Shared `SummaryExport` component

Extract the summary export logic from `Dashboard.tsx` into a reusable component.

**Props:**
- `logs: LogEntry[]` — already filtered by the caller
- `filenamePrefix: string` — e.g. `"focusflow-daily"` or `"focusflow-weekly"`

**Contains:** The generate summary mutation, parsed summary state, format selector (TXT/CSV/JSON), download button. Currently lives in `Dashboard.tsx` lines 19-87.

**File:** `src/components/SummaryExport.tsx` (new)

### 5. Weekly summary export on Review page

- Add `SummaryExport` component to Review page
- Only visible when the `week` period tab is selected
- Passes week-filtered logs (using existing `getPeriodDates('week')` + `filterLogsByRange`)
- Filename prefix: `"focusflow-weekly"`

**File:** `src/pages/Review.tsx`

## Files to create

| File | Purpose |
|------|---------|
| `src/pages/History.tsx` | Full log history page grouped by date |
| `src/components/SummaryExport.tsx` | Shared summary export (generate + format + download) |

## Files to modify

| File | Change |
|------|--------|
| `src/hooks/usePersistence.ts` | Day boundary detection and timer reset on hydration |
| `src/pages/Dashboard.tsx` | Filter logs to today, use `SummaryExport` component |
| `src/pages/Review.tsx` | Add `SummaryExport` on week tab |
| `src/App.tsx` | Add History nav link |
| `src/main.tsx` | Add `/history` route |
| `src/App.css` | Styles for History page |

## Files unchanged

Storage model, types, insights, LogList, LogItem, TimerCard, AiNarrative — no changes needed.
