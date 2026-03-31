# Daily Timesheet & Day Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Dashboard into a daily timesheet (today-only logs and timers that reset each day), add a `/history` page for full log browsing, and extract a shared `SummaryExport` component used by both Dashboard (daily) and Review (weekly).

**Architecture:** Day boundary detection in `usePersistence` closes overnight timers at midnight and resets timer values. Dashboard filters logs to today via `useMemo`. A new `/history` route shows all logs grouped by date. Summary export logic is extracted into a shared component.

**Tech Stack:** React 18, TypeScript, TanStack Router, TanStack Query, date-fns, Vitest

**User Verification:** NO — no user verification required

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/hooks/usePersistence.ts` | Modify | Add day boundary detection on hydration |
| `src/pages/Dashboard.tsx` | Modify | Filter logs to today, use SummaryExport |
| `src/components/SummaryExport.tsx` | Create | Shared summary generation + export component |
| `src/pages/History.tsx` | Create | Full log history grouped by date |
| `src/pages/Review.tsx` | Modify | Add SummaryExport on week tab |
| `src/App.tsx` | Modify | Add History nav link + route matching |
| `src/main.tsx` | Modify | Register `/history` route |
| `src/App.css` | Modify | History page styles |
| `src/hooks/__tests__/usePersistence.test.ts` | Create | Test day boundary logic |

---

### Task 1: Day boundary logic in usePersistence

**Goal:** When the app hydrates and `lastSavedAt` is before today, close the active timer's log at midnight, reset timer values, and stop the timer.

**Files:**
- Modify: `src/hooks/usePersistence.ts:21-85`
- Create: `src/hooks/__tests__/usePersistence.test.ts`

**Acceptance Criteria:**
- [ ] If `lastSavedAt` is before `startOfDay(now)` and a timer was active, the log entry gets time added up to midnight
- [ ] The log entry's `endTime` is set to midnight (`endOfDay(lastSavedAt)`)
- [ ] `timerValues` reset to `{ 1: 0, 2: 0, 3: 0 }`
- [ ] `activeTimerId` and `activeStartTime` are set to `null`
- [ ] If `lastSavedAt` is today, existing behavior is unchanged

**Verify:** `npx vitest run src/hooks/__tests__/usePersistence.test.ts` → all tests pass

**Steps:**

- [ ] **Step 1: Write the day boundary detection tests**

Create `src/hooks/__tests__/usePersistence.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { startOfDay, endOfDay } from 'date-fns'

// We test the pure logic extracted as a helper, not the hook itself
import { handleDayBoundary } from '../usePersistence'
import type { AppState } from '../../types'

const makeState = (overrides: Partial<AppState>): AppState => ({
  activeTimerId: null,
  timerLabels: { 1: 'Timer 1', 2: 'Timer 2', 3: 'Timer 3' },
  timerValues: { 1: 0, 2: 0, 3: 0 },
  logs: [],
  lastSavedAt: Date.now(),
  ...overrides,
})

describe('handleDayBoundary', () => {
  it('returns null when lastSavedAt is today (no boundary crossed)', () => {
    const now = Date.now()
    const state = makeState({ lastSavedAt: now - 5000 })
    const result = handleDayBoundary(state, now)
    expect(result).toBeNull()
  })

  it('returns null when no timer was active', () => {
    const yesterday = new Date('2026-03-30T22:00:00').getTime()
    const now = new Date('2026-03-31T08:00:00').getTime()
    const state = makeState({ lastSavedAt: yesterday, activeTimerId: null })
    const result = handleDayBoundary(state, now)
    expect(result).toBeNull()
  })

  it('closes active timer at midnight and resets timer values', () => {
    const yesterday = new Date('2026-03-30T22:00:00').getTime()
    const now = new Date('2026-03-31T08:00:00').getTime()
    const midnight = endOfDay(new Date('2026-03-30')).getTime()
    const gapToMidnight = Math.floor((midnight - yesterday) / 1000)

    const state = makeState({
      activeTimerId: 1,
      lastSavedAt: yesterday,
      timerValues: { 1: 3600, 2: 0, 3: 0 },
      logs: [{
        id: 'log-1',
        timerId: 1,
        label: 'Work',
        startTime: yesterday,
        endTime: yesterday,
        duration: 0,
        source: 'timer',
      }],
    })

    const result = handleDayBoundary(state, now)!
    expect(result).not.toBeNull()
    expect(result.activeTimerId).toBeNull()
    expect(result.timerValues).toEqual({ 1: 0, 2: 0, 3: 0 })

    const updatedLog = result.logs[0]
    expect(updatedLog.endTime).toBe(midnight)
    expect(updatedLog.duration).toBe(gapToMidnight)
  })

  it('preserves existing log duration when adding midnight gap', () => {
    const yesterday = new Date('2026-03-30T22:00:00').getTime()
    const now = new Date('2026-03-31T08:00:00').getTime()
    const midnight = endOfDay(new Date('2026-03-30')).getTime()
    const existingDuration = 1800
    const gapToMidnight = Math.floor((midnight - yesterday) / 1000)

    const state = makeState({
      activeTimerId: 2,
      lastSavedAt: yesterday,
      timerValues: { 1: 0, 2: 1800, 3: 0 },
      logs: [{
        id: 'log-2',
        timerId: 2,
        label: 'Deep work',
        startTime: new Date('2026-03-30T21:30:00').getTime(),
        endTime: yesterday,
        duration: existingDuration,
        source: 'timer',
      }],
    })

    const result = handleDayBoundary(state, now)!
    const updatedLog = result.logs[0]
    expect(updatedLog.duration).toBe(existingDuration + gapToMidnight)
    expect(updatedLog.endTime).toBe(midnight)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/hooks/__tests__/usePersistence.test.ts`
Expected: FAIL — `handleDayBoundary` is not exported

- [ ] **Step 3: Extract and implement `handleDayBoundary`**

In `src/hooks/usePersistence.ts`, add this import at the top:

```ts
import { startOfDay, endOfDay } from 'date-fns'
```

Add the exported function before the `usePersistence` hook:

```ts
/**
 * Detects if a day boundary was crossed since last save.
 * If a timer was active, closes its log at midnight and resets timer values.
 * Returns the patched state, or null if no boundary was crossed.
 */
export const handleDayBoundary = (
  stored: AppState,
  now: number
): AppState | null => {
  const todayStart = startOfDay(new Date(now)).getTime()

  // No boundary crossed — lastSavedAt is today
  if (stored.lastSavedAt >= todayStart) {
    return null
  }

  // Boundary crossed but no timer was active — just reset values
  if (stored.activeTimerId === null) {
    return null
  }

  const midnight = endOfDay(new Date(stored.lastSavedAt)).getTime()
  const gapToMidnight = Math.max(
    0,
    timerService.calculateElapsedSeconds(stored.lastSavedAt, midnight)
  )

  const updatedLogs = [...stored.logs]
  const logIndex = getLatestLogIndex(updatedLogs, stored.activeTimerId)

  if (logIndex !== -1) {
    updatedLogs[logIndex] = {
      ...updatedLogs[logIndex],
      duration: updatedLogs[logIndex].duration + gapToMidnight,
      endTime: midnight,
    }
  }

  return {
    ...stored,
    activeTimerId: null,
    timerValues: { 1: 0, 2: 0, 3: 0 },
    logs: updatedLogs,
    lastSavedAt: now,
  }
}
```

- [ ] **Step 4: Integrate into usePersistence hydration**

In the `usePersistence` hook, inside the `useEffect` where `stored` is loaded (after `if (stored)`), add the day boundary check before the existing gap logic:

```ts
if (stored) {
  // Check for day boundary first
  const dayBoundaryResult = handleDayBoundary(stored, timestamp)
  if (dayBoundaryResult) {
    setTimerState({
      activeTimerId: null,
      activeStartTime: null,
      timerLabels: dayBoundaryResult.timerValues
        ? stored.timerLabels
        : stored.timerLabels,
      timerValues: dayBoundaryResult.timerValues,
      lastSavedAt: timestamp,
    })
    setLogs(dayBoundaryResult.logs)
    setNow(timestamp)
    hasHydrated.current = true
    return
  }

  // Existing logic for same-day hydration follows...
  if (stored.activeTimerId !== null) {
    // ... existing gap calculation code unchanged
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/hooks/__tests__/usePersistence.test.ts`
Expected: PASS — all 4 tests pass

- [ ] **Step 6: Run full test suite**

Run: `npx vitest run`
Expected: all existing tests still pass

- [ ] **Step 7: Commit**

```bash
git add src/hooks/usePersistence.ts src/hooks/__tests__/usePersistence.test.ts
git commit -m "feat: add day boundary detection to reset timers at midnight"
```

---

### Task 2: Dashboard today-only logs

**Goal:** Filter the Dashboard to show only today's logs and pass them to LogList and the summary export.

**Files:**
- Modify: `src/pages/Dashboard.tsx`

**Acceptance Criteria:**
- [ ] Dashboard `LogList` only shows logs from today
- [ ] "No sessions yet" message appears when there are no today logs (even if historical logs exist)
- [ ] Summary generation only uses today's logs
- [ ] Daily Total still works correctly (timer values already reset by Task 1)

**Verify:** `npx tsc --noEmit` → no errors, manual visual check

**Steps:**

- [ ] **Step 1: Add date-fns import and todayLogs filter**

In `src/pages/Dashboard.tsx`, add import:

```ts
import { startOfDay } from 'date-fns'
```

After the destructured context values, add:

```ts
const todayLogs = useMemo(() => {
  const dayStart = startOfDay(new Date()).getTime()
  return logs.filter((log) => log.startTime >= dayStart)
}, [logs])

const todayDisplayLogs = useMemo(() => {
  const dayStart = startOfDay(new Date()).getTime()
  return displayLogs.filter((log) => log.startTime >= dayStart)
}, [displayLogs])
```

- [ ] **Step 2: Replace `logs` and `displayLogs` references**

In the summary mutation, replace `logs` with `todayLogs`:

```ts
const summaryMutation = useMutation({
  mutationFn: () => generateSummary(todayLogs),
})
```

In the LogList section, replace `logs.length` checks with `todayLogs.length` and pass `todayDisplayLogs`:

```ts
<section className="app__logs" aria-label="Activity log">
  <h2 className="app__section-title">Activity Log</h2>
  {todayLogs.length === 0 ? (
    <div className="app__placeholder">No sessions yet.</div>
  ) : (
    <LogList logs={todayDisplayLogs} formatDuration={formatSeconds} onLabelChange={updateLogLabel} onLabelBlur={validateLogLabel} onDelete={deleteLog} />
  )}
</section>
```

In the summary actions, replace `logs.length === 0` with `todayLogs.length === 0`:

```ts
<button className="summary__button" type="button" onClick={() => summaryMutation.mutate()} disabled={todayLogs.length === 0 || summaryMutation.isPending}>
```

And the status text:

```ts
{todayLogs.length === 0 ? (
  <span className="summary__status">Add sessions to summarize.</span>
```

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/pages/Dashboard.tsx
git commit -m "feat: filter dashboard logs to today only"
```

---

### Task 3: Extract SummaryExport component

**Goal:** Extract the summary generation, parsing, format selection, and download logic from Dashboard into a shared `SummaryExport` component.

**Files:**
- Create: `src/components/SummaryExport.tsx`
- Modify: `src/pages/Dashboard.tsx`

**Acceptance Criteria:**
- [ ] `SummaryExport` accepts `logs` and `filenamePrefix` props
- [ ] Dashboard uses `SummaryExport` with today's logs and prefix `"focusflow-daily"`
- [ ] All export formats (TXT/CSV/JSON) still work
- [ ] Generate button, format selector, download button, status messages all preserved

**Verify:** `npx tsc --noEmit` → no errors

**Steps:**

- [ ] **Step 1: Create SummaryExport component**

Create `src/components/SummaryExport.tsx`:

```tsx
import { useState, useMemo, useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import { generateSummary } from '../services/geminiClient'
import type { LogEntry } from '../types'

interface SummaryExportProps {
  logs: LogEntry[]
  filenamePrefix: string
}

export const SummaryExport = ({ logs, filenamePrefix }: SummaryExportProps) => {
  const [exportFormat, setExportFormat] = useState<'txt' | 'csv' | 'json'>('txt')

  const summaryMutation = useMutation({
    mutationFn: () => generateSummary(logs),
  })

  const summaryText = useMemo(() => {
    if (!summaryMutation.data) return ''
    return summaryMutation.data.replace(/\*\*/g, '').trim()
  }, [summaryMutation.data])

  const parsedSummary = useMemo(() => {
    if (!summaryText) return []
    const lines = summaryText.split(/\n+/).map((line) => line.trim())
    const entries: Array<{ name: string; totalTime: string; details: string[] }> = []
    let current: { name: string; totalTime: string; details: string[] } | null = null
    lines.forEach((line) => {
      const headerMatch = line.match(/^(.*)\s+-\s+(\d{2}:\d{2}(?::\d{2})?)$/)
      if (headerMatch) {
        current = { name: headerMatch[1].trim(), totalTime: headerMatch[2], details: [] }
        entries.push(current)
        return
      }
      if (line.startsWith('-')) {
        const detail = line.replace(/^-\s*/, '').trim()
        if (detail && current) current.details.push(detail)
      }
    })
    return entries
  }, [summaryText])

  const buildExportPayload = useCallback(() => {
    if (!summaryText) return { content: '', extension: 'txt', type: 'text/plain;charset=utf-8' }
    if (exportFormat === 'json') {
      const payload = { generatedAt: new Date().toISOString(), rawText: summaryText, projects: parsedSummary }
      return { content: JSON.stringify(payload, null, 2), extension: 'json', type: 'application/json;charset=utf-8' }
    }
    if (exportFormat === 'csv') {
      const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`
      const rows = ['project,total_time,detail']
      parsedSummary.forEach((project) => {
        if (project.details.length === 0) {
          rows.push([project.name, project.totalTime, ''].map(escapeCsv).join(','))
          return
        }
        project.details.forEach((detail) => {
          rows.push([project.name, project.totalTime, detail].map(escapeCsv).join(','))
        })
      })
      return { content: rows.join('\n'), extension: 'csv', type: 'text/csv;charset=utf-8' }
    }
    return { content: summaryText, extension: 'txt', type: 'text/plain;charset=utf-8' }
  }, [exportFormat, parsedSummary, summaryText])

  const handleDownload = useCallback(() => {
    if (!summaryText) return
    const payload = buildExportPayload()
    const blob = new Blob([payload.content], { type: payload.type })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${filenamePrefix}.${payload.extension}`
    anchor.click()
    URL.revokeObjectURL(url)
  }, [buildExportPayload, filenamePrefix, summaryText])

  const summaryError = summaryMutation.error
    ? summaryMutation.error instanceof Error
      ? summaryMutation.error.message
      : 'Failed to generate summary.'
    : null

  return (
    <section className="app__summary" aria-label="LLM Summary">
      <h2 className="app__section-title">Summary Export</h2>
      <div className="summary__actions">
        <button className="summary__button" type="button" onClick={() => summaryMutation.mutate()} disabled={logs.length === 0 || summaryMutation.isPending}>
          {summaryMutation.isPending ? 'Generating...' : 'Generate Summary'}
        </button>
        <div className="summary__formats" role="group" aria-label="Export format">
          {(['txt', 'csv', 'json'] as const).map((format) => (
            <button key={format} className={`summary__format${exportFormat === format ? ' summary__format--active' : ''}`} type="button" onClick={() => setExportFormat(format)}>
              {format.toUpperCase()}
            </button>
          ))}
        </div>
        <button className="summary__button summary__button--ghost" type="button" onClick={handleDownload} disabled={!summaryText}>
          Download
        </button>
        {logs.length === 0 ? (
          <span className="summary__status">Add sessions to summarize.</span>
        ) : summaryMutation.isPending ? (
          <span className="summary__status">Building grouped bullets.</span>
        ) : (
          <span className="summary__status">Ready to summarize.</span>
        )}
      </div>
      {summaryError ? (
        <div className="summary__error">{summaryError}</div>
      ) : summaryText ? (
        <div className="summary__text">{summaryText}</div>
      ) : (
        <div className="app__placeholder">Summary output will appear here.</div>
      )}
    </section>
  )
}
```

- [ ] **Step 2: Replace Dashboard summary section with SummaryExport**

In `src/pages/Dashboard.tsx`:

Remove these imports (no longer needed locally):
- `useMutation` from `@tanstack/react-query`
- `generateSummary` from `../services/geminiClient`

Add import:
```ts
import { SummaryExport } from '../components/SummaryExport'
```

Remove the state and logic from lines 17-89 (`exportFormat`, `summaryMutation`, `summaryText`, `parsedSummary`, `buildExportPayload`, `handleDownloadSummary`, `summaryError`, `hasApiKey`).

Replace the `<section className="app__summary">` block (lines 115-148) with:

```tsx
<SummaryExport logs={todayLogs} filenamePrefix="focusflow-daily" />
```

Update the footer's clearAll to remove `summaryMutation.reset()`:

```tsx
<button className="app__clear-button" type="button" onClick={clearAll}>
  Clear All Data
</button>
```

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/components/SummaryExport.tsx src/pages/Dashboard.tsx
git commit -m "refactor: extract SummaryExport shared component from Dashboard"
```

---

### Task 4: History page

**Goal:** Create a `/history` route showing all logs grouped by date, most recent first.

**Files:**
- Create: `src/pages/History.tsx`
- Modify: `src/main.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.css`

**Acceptance Criteria:**
- [ ] `/history` route exists and is navigable from the nav bar
- [ ] All logs are displayed, grouped by day (most recent day first)
- [ ] Each day group has a header with the formatted date and total time
- [ ] Edit/delete on log items works (reuses LogList)
- [ ] Empty state when no logs exist

**Verify:** `npx tsc --noEmit` → no errors

**Steps:**

- [ ] **Step 1: Create History page**

Create `src/pages/History.tsx`:

```tsx
import { useMemo } from 'react'
import { startOfDay, format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useLogContext } from '../context/LogContext'
import { LogList } from '../components/LogList'
import { formatSeconds } from '../utils/format'
import type { LogEntry } from '../types'

interface DayGroup {
  date: string
  totalSeconds: number
  logs: LogEntry[]
}

export const History = () => {
  const { logs, displayLogs, updateLogLabel, validateLogLabel, deleteLog } = useLogContext()

  const dayGroups = useMemo(() => {
    const groups = new Map<number, DayGroup>()

    displayLogs.forEach((log) => {
      const dayKey = startOfDay(new Date(log.startTime)).getTime()
      const existing = groups.get(dayKey)
      if (existing) {
        existing.totalSeconds += log.duration
        existing.logs.push(log)
      } else {
        groups.set(dayKey, {
          date: format(new Date(dayKey), 'EEEE d MMMM yyyy', { locale: fr }),
          totalSeconds: log.duration,
          logs: [log],
        })
      }
    })

    return Array.from(groups.entries())
      .sort(([a], [b]) => b - a)
      .map(([, group]) => group)
  }, [displayLogs])

  return (
    <>
      <h2 className="history__title">Historique</h2>
      {logs.length === 0 ? (
        <div className="app__placeholder">Aucune session enregistree.</div>
      ) : (
        dayGroups.map((group) => (
          <section key={group.date} className="history__day">
            <div className="history__day-header">
              <span className="history__day-date">{group.date}</span>
              <span className="history__day-total">{formatSeconds(group.totalSeconds)}</span>
            </div>
            <LogList
              logs={group.logs}
              formatDuration={formatSeconds}
              onLabelChange={updateLogLabel}
              onLabelBlur={validateLogLabel}
              onDelete={deleteLog}
            />
          </section>
        ))
      )}
    </>
  )
}
```

- [ ] **Step 2: Register the route in main.tsx**

In `src/main.tsx`, add the import:

```ts
import { History } from './pages/History'
```

Add the route after `reviewRoute`:

```ts
const historyRoute = createRoute({ getParentRoute: () => rootRoute, path: '/history', component: History })
```

Add it to the route tree:

```ts
const routeTree = rootRoute.addChildren([dashboardRoute, reviewRoute, historyRoute])
```

- [ ] **Step 3: Add nav link in App.tsx**

In `src/App.tsx`, add route matching:

```ts
const isHistory = matchRoute({ to: '/history' })
```

Add the nav link after the Revue link:

```tsx
<Link to="/history" className={`app__nav-link${isHistory ? ' app__nav-link--active' : ''}`}>
  Historique
</Link>
```

- [ ] **Step 4: Add History page styles to App.css**

Add before the `/* Review Footer */` comment in `src/App.css`:

```css
/* History Page */
.history__title {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-1);
  margin: 0 0 1rem;
}

.history__day {
  margin-bottom: 1.5rem;
}

.history__day-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  padding-bottom: 0.35rem;
  border-bottom: 1px solid var(--border);
}

.history__day-date {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text-2);
  text-transform: capitalize;
}

.history__day-total {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 5: Type check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/pages/History.tsx src/main.tsx src/App.tsx src/App.css
git commit -m "feat: add /history page with logs grouped by date"
```

---

### Task 5: Weekly summary export on Review page

**Goal:** Add the `SummaryExport` component to the Review page, visible only on the week tab.

**Files:**
- Modify: `src/pages/Review.tsx`
- Modify: `src/utils/insights.ts` (export `filterLogsByRange`)

**Acceptance Criteria:**
- [ ] `SummaryExport` appears below the AI narrative when week tab is selected
- [ ] Summary uses only the current week's logs
- [ ] Not visible on today or month tabs
- [ ] Export filename uses `"focusflow-weekly"` prefix

**Verify:** `npx tsc --noEmit` → no errors

**Steps:**

- [ ] **Step 1: Export `filterLogsByRange` from insights.ts**

In `src/utils/insights.ts`, change line 35 from:

```ts
const filterLogsByRange = (
```

to:

```ts
export const filterLogsByRange = (
```

- [ ] **Step 2: Add SummaryExport to Review page**

In `src/pages/Review.tsx`, add imports:

```ts
import { useMemo } from 'react'
import { SummaryExport } from '../components/SummaryExport'
import { getPeriodDates, filterLogsByRange } from '../utils/insights'
```

Note: `useState` and `useCallback` are already imported. Add `useMemo` to the existing import.

After the `insights` computation, add:

```ts
const weekLogs = useMemo(() => {
  if (period !== 'week') return []
  const { start, end } = getPeriodDates('week')
  return filterLogsByRange(logs, start.getTime(), end.getTime())
}, [logs, period])
```

After the `<AiNarrative>` component, add:

```tsx
{period === 'week' && (
  <SummaryExport logs={weekLogs} filenamePrefix="focusflow-weekly" />
)}
```

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: all tests pass (insights tests should still pass since we only added `export`)

- [ ] **Step 4: Type check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/pages/Review.tsx src/utils/insights.ts
git commit -m "feat: add weekly summary export to Review page"
```
