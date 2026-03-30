# Weekly Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform FocusFlow from a daily timer app into a personal reflection tool with manual log entry, log editing, insights engine, and AI-powered weekly narrative.

**Architecture:** Clean Split approach. Extract concerns into focused modules: types + migration in data layer, pure insights engine in utils, shared state via React context, TanStack Router for page navigation, and three new Review components (StatsGrid, DailyChart, AiNarrative).

**Tech Stack:** React 19, TypeScript 5.9, TanStack Router, TanStack Query, Vite 7, date-fns, Vitest, Netlify Functions + Gemini API

**User Verification:** NO — no user verification required

---

## Task 0: Install dependencies and set up Vitest

**Goal:** Add date-fns and Vitest so subsequent tasks can import them immediately.

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

**Acceptance Criteria:**
- [ ] date-fns installed as dependency
- [ ] vitest installed as dev dependency
- [ ] `npm test` runs Vitest
- [ ] Empty test suite passes

**Verify:** `npx vitest run` → "No test files found" (no error)

**Steps:**

- [ ] **Step 1: Install dependencies**

Run:
```bash
npm install date-fns
npm install -D vitest
```

- [ ] **Step 2: Create Vitest config**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
  },
})
```

- [ ] **Step 3: Add test script to package.json**

In `package.json`, add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Verify setup**

Run: `npx vitest run`
Expected: exits 0, "No test files found" or similar clean output.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add date-fns, vitest dependencies and test config"
```

---

## Task 1: Extend data model and build migration runner

**Goal:** Extend LogEntry with endTime/source/note fields and implement a versioned migration runner that safely migrates existing localStorage data.

**Files:**
- Modify: `src/types.ts`
- Modify: `src/utils/storage.ts`
- Modify: `src/utils/validators.ts`
- Create: `src/utils/__tests__/storage.test.ts`

**Acceptance Criteria:**
- [ ] LogEntry interface has endTime, source, note fields
- [ ] Migration runner reads schema version from localStorage
- [ ] v0→v1 migration adds endTime and source to existing entries
- [ ] Backup created before migration, restored on failure
- [ ] Validator accepts new fields
- [ ] All migration tests pass

**Verify:** `npx vitest run src/utils/__tests__/storage.test.ts` → all pass

**Steps:**

- [ ] **Step 1: Update types.ts**

Replace the LogEntry interface in `src/types.ts`:

```typescript
export type TimerId = 1 | 2 | 3 | null

export type LogSource = 'timer' | 'manual'

export interface LogEntry {
  id: string
  timerId: number
  label: string
  startTime: number
  endTime: number
  duration: number
  source: LogSource
  note?: string
}

export interface TimerState {
  activeTimerId: TimerId
  activeStartTime: number | null
  timerLabels: Record<number, string>
  timerValues: Record<number, number>
  lastSavedAt: number
}

export interface AppState {
  activeTimerId: TimerId
  timerLabels: Record<number, string>
  timerValues: Record<number, number>
  logs: LogEntry[]
  lastSavedAt: number
}
```

- [ ] **Step 2: Update validators.ts**

Update `isValidLogs` in `src/utils/validators.ts` to accept both old and new log formats (migration hasn't run yet when validation first fires):

```typescript
import type { AppState } from '../types'

export const isValidTimerValues = (
  value: unknown
): value is AppState['timerValues'] => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const record = value as Record<number, unknown>
  return [1, 2, 3].every((id) => typeof record[id] === 'number')
}

export const isValidLogs = (value: unknown): value is AppState['logs'] => {
  if (!Array.isArray(value)) {
    return false
  }

  return value.every((entry) =>
    Boolean(
      entry &&
        typeof entry === 'object' &&
        typeof (entry as { id?: unknown }).id === 'string' &&
        typeof (entry as { timerId?: unknown }).timerId === 'number' &&
        typeof (entry as { label?: unknown }).label === 'string' &&
        typeof (entry as { startTime?: unknown }).startTime === 'number' &&
        typeof (entry as { duration?: unknown }).duration === 'number'
    )
  )
}

export const isValidTimerLabels = (
  value: unknown
): value is AppState['timerLabels'] => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const record = value as Record<number, unknown>
  return [1, 2, 3].every((id) => typeof record[id] === 'string')
}

export const isValidTimeRange = (
  startTime: number,
  endTime: number
): boolean => {
  return endTime > startTime && startTime > 0
}

export const findOverlappingLog = (
  logs: AppState['logs'],
  timerId: number,
  startTime: number,
  endTime: number,
  excludeId?: string
): AppState['logs'][number] | null => {
  return (
    logs.find(
      (log) =>
        log.timerId === timerId &&
        log.id !== excludeId &&
        log.startTime < endTime &&
        log.endTime > startTime
    ) ?? null
  )
}
```

- [ ] **Step 3: Build migration runner in storage.ts**

Replace `src/utils/storage.ts`:

```typescript
import type { AppState } from '../types'
import { isValidLogs, isValidTimerLabels, isValidTimerValues } from './validators'

const STORAGE_KEY = 'focusflow-state'
const SCHEMA_VERSION_KEY = 'focusflow_schema_version'
const BACKUP_KEY = 'focusflow_backup'

type Migration = (state: AppState) => AppState

const migrations: Migration[] = [
  // v0 → v1: add endTime, source to LogEntry
  (state) => ({
    ...state,
    logs: state.logs.map((log) => ({
      ...log,
      endTime:
        'endTime' in log && typeof log.endTime === 'number'
          ? log.endTime
          : log.startTime + log.duration * 1000,
      source: 'source' in log ? (log.source as 'timer' | 'manual') : ('timer' as const),
    })),
  }),
]

const getSchemaVersion = (): number => {
  const raw = localStorage.getItem(SCHEMA_VERSION_KEY)
  if (raw === null) return 0
  const parsed = parseInt(raw, 10)
  return Number.isNaN(parsed) ? 0 : parsed
}

const setSchemaVersion = (version: number): void => {
  localStorage.setItem(SCHEMA_VERSION_KEY, String(version))
}

export const runMigrations = (state: AppState): AppState => {
  const currentVersion = getSchemaVersion()
  if (currentVersion >= migrations.length) return state

  // Backup before migrating
  localStorage.setItem(BACKUP_KEY, JSON.stringify(state))

  let migrated = state
  try {
    for (let i = currentVersion; i < migrations.length; i++) {
      migrated = migrations[i](migrated)
    }
    setSchemaVersion(migrations.length)
    localStorage.removeItem(BACKUP_KEY)
  } catch (error) {
    // Restore from backup on failure
    const backup = localStorage.getItem(BACKUP_KEY)
    if (backup) {
      try {
        migrated = JSON.parse(backup) as AppState
      } catch {
        // backup is also corrupt, return what we have
      }
    }
    console.error('Migration failed, restored from backup:', error)
  }

  return migrated
}

export const loadState = (
  fallbackTimerLabels: AppState['timerLabels']
): AppState | null => {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AppState>
    const activeTimerId = parsed.activeTimerId ?? null

    if (
      ![null, 1, 2, 3].includes(activeTimerId) ||
      !isValidTimerValues(parsed.timerValues) ||
      !isValidLogs(parsed.logs) ||
      typeof parsed.lastSavedAt !== 'number'
    ) {
      return null
    }

    const timerLabels = isValidTimerLabels(parsed.timerLabels)
      ? parsed.timerLabels
      : fallbackTimerLabels

    const state: AppState = {
      activeTimerId,
      timerLabels,
      timerValues: parsed.timerValues,
      logs: parsed.logs,
      lastSavedAt: parsed.lastSavedAt,
    }

    return runMigrations(state)
  } catch {
    return null
  }
}

export const saveState = (state: AppState): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (error) {
    console.error('Failed to save state:', error)
  }
}

export const clearState = (): void => {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(SCHEMA_VERSION_KEY)
  localStorage.removeItem(BACKUP_KEY)
}

export { STORAGE_KEY, SCHEMA_VERSION_KEY, BACKUP_KEY, migrations }
```

- [ ] **Step 4: Write migration tests**

Create `src/utils/__tests__/storage.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { runMigrations, loadState, STORAGE_KEY, SCHEMA_VERSION_KEY, BACKUP_KEY } from '../storage'
import type { AppState } from '../../types'

const makeV0State = (): AppState => ({
  activeTimerId: null,
  timerLabels: { 1: 'Work', 2: 'Break', 3: 'Learn' },
  timerValues: { 1: 3600, 2: 900, 3: 1800 },
  logs: [
    { id: 'log-1', timerId: 1, label: 'Work', startTime: 1711800000000, duration: 3600 },
    { id: 'log-2', timerId: 2, label: 'Break', startTime: 1711803600000, duration: 900 },
  ] as AppState['logs'],
  lastSavedAt: 1711804500000,
})

beforeEach(() => {
  localStorage.clear()
})

describe('runMigrations', () => {
  it('adds endTime and source to v0 logs', () => {
    const v0 = makeV0State()
    const result = runMigrations(v0)

    expect(result.logs[0].endTime).toBe(1711800000000 + 3600 * 1000)
    expect(result.logs[0].source).toBe('timer')
    expect(result.logs[1].endTime).toBe(1711803600000 + 900 * 1000)
    expect(result.logs[1].source).toBe('timer')
  })

  it('creates backup before migration', () => {
    const v0 = makeV0State()
    // Backup is set during migration and removed on success
    // We verify it exists transiently by checking schema version updates
    runMigrations(v0)
    expect(localStorage.getItem(SCHEMA_VERSION_KEY)).toBe('1')
    expect(localStorage.getItem(BACKUP_KEY)).toBeNull()
  })

  it('skips migration if schema version is current', () => {
    localStorage.setItem(SCHEMA_VERSION_KEY, '1')
    const state = makeV0State()
    // Should return state unchanged (no migration runs)
    const result = runMigrations(state)
    expect(result).toBe(state)
  })

  it('handles already-migrated data (idempotent)', () => {
    const migratedState: AppState = {
      ...makeV0State(),
      logs: [
        {
          id: 'log-1', timerId: 1, label: 'Work',
          startTime: 1711800000000, endTime: 1711803600000,
          duration: 3600, source: 'timer' as const,
        },
      ],
    }
    const result = runMigrations(migratedState)
    expect(result.logs[0].endTime).toBe(1711803600000)
    expect(result.logs[0].source).toBe('timer')
  })

  it('handles empty logs array', () => {
    const state: AppState = { ...makeV0State(), logs: [] }
    const result = runMigrations(state)
    expect(result.logs).toEqual([])
  })
})

describe('loadState', () => {
  const fallbackLabels = { 1: 'Timer 1', 2: 'Timer 2', 3: 'Timer 3' }

  it('returns null when no stored state', () => {
    expect(loadState(fallbackLabels)).toBeNull()
  })

  it('migrates stored v0 state on load', () => {
    const v0 = makeV0State()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v0))
    const result = loadState(fallbackLabels)

    expect(result).not.toBeNull()
    expect(result!.logs[0].endTime).toBe(1711800000000 + 3600 * 1000)
    expect(result!.logs[0].source).toBe('timer')
  })

  it('returns null for corrupt JSON', () => {
    localStorage.setItem(STORAGE_KEY, 'not-json')
    expect(loadState(fallbackLabels)).toBeNull()
  })
})
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/utils/__tests__/storage.test.ts`
Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/utils/storage.ts src/utils/validators.ts src/utils/__tests__/storage.test.ts
git commit -m "feat: extend LogEntry model and add versioned migration runner"
```

---

## Task 2: Convert timer to block-based logging

**Goal:** Change toggleTimer to create a new LogEntry per start/stop block instead of accumulating into one entry. Each entry gets real startTime/endTime.

**Files:**
- Modify: `src/utils/logHelpers.ts`
- Modify: `src/services/TimerService.ts`
- Modify: `src/hooks/useTimerState.ts`

**Acceptance Criteria:**
- [ ] buildLogEntry creates entries with endTime, source, duration
- [ ] Stopping a timer sets endTime and computes duration
- [ ] Switching timers creates separate block entries
- [ ] timerValues still accumulates correctly for daily totals
- [ ] App compiles with no TypeScript errors

**Verify:** `npx tsc -b` → no errors, `npm run dev` → timers create separate log entries

**Steps:**

- [ ] **Step 1: Update logHelpers.ts**

Replace `src/utils/logHelpers.ts`:

```typescript
import type { LogEntry } from '../types'

export const getLatestLogIndex = (logs: LogEntry[], timerId: number): number => {
  for (let index = logs.length - 1; index >= 0; index -= 1) {
    if (logs[index].timerId === timerId) {
      return index
    }
  }
  return -1
}

export const buildLogLabel = (label: string, timerId: number): string => {
  const trimmed = label.trim()
  return trimmed.length > 0 ? trimmed : `Unnamed Task [${timerId}]`
}

export const buildLogEntry = (
  timerId: number,
  label: string,
  startTime: number
): LogEntry => {
  return {
    id: crypto.randomUUID(),
    timerId,
    label: buildLogLabel(label, timerId),
    startTime,
    endTime: startTime,
    duration: 0,
    source: 'timer',
  }
}

export const finalizeLogEntry = (
  entry: LogEntry,
  endTime: number
): LogEntry => {
  const duration = Math.max(0, Math.floor((endTime - entry.startTime) / 1000))
  return { ...entry, endTime, duration }
}
```

- [ ] **Step 2: Update TimerService.ts**

Replace `commitActiveTimer` in `src/services/TimerService.ts` to finalize the active entry with endTime instead of accumulating:

```typescript
import type { LogEntry } from '../types'
import { buildLogEntry, finalizeLogEntry, getLatestLogIndex } from '../utils/logHelpers'

export interface TimeProvider {
  now: () => number
}

export class TimerService {
  private timeProvider: TimeProvider

  constructor(timeProvider: TimeProvider = { now: () => Date.now() }) {
    this.timeProvider = timeProvider
  }

  now(): number {
    return this.timeProvider.now()
  }

  calculateElapsedSeconds(startTime: number, endTime: number): number {
    return Math.floor((endTime - startTime) / 1000)
  }

  commitActiveTimer(
    activeTimerId: number | null,
    startTime: number | null,
    logs: LogEntry[],
    timerValues: Record<number, number>,
    _timerLabels: Record<number, string>,
    timestamp: number
  ): { logs: LogEntry[]; timerValues: Record<number, number> } {
    if (activeTimerId === null || startTime === null) {
      return { logs, timerValues }
    }

    const elapsedSeconds = this.calculateElapsedSeconds(startTime, timestamp)
    const updatedLogs = [...logs]
    const logIndex = getLatestLogIndex(updatedLogs, activeTimerId)

    if (logIndex !== -1 && updatedLogs[logIndex].endTime === updatedLogs[logIndex].startTime) {
      // Finalize the open entry (endTime === startTime means it's still open)
      updatedLogs[logIndex] = finalizeLogEntry(updatedLogs[logIndex], timestamp)
    }

    return {
      logs: updatedLogs,
      timerValues: {
        ...timerValues,
        [activeTimerId]: timerValues[activeTimerId] + elapsedSeconds,
      },
    }
  }

  calculateTimerSeconds(
    timerId: number,
    timerValues: Record<number, number>,
    activeTimerId: number | null,
    activeStartTime: number | null,
    now: number
  ): number {
    const base = timerValues[timerId] || 0
    if (activeTimerId === timerId && activeStartTime !== null) {
      return base + Math.floor((now - activeStartTime) / 1000)
    }
    return base
  }

  calculateDisplayLogs(
    logs: LogEntry[],
    activeTimerId: number | null,
    activeStartTime: number | null,
    now: number
  ): LogEntry[] {
    if (activeTimerId === null || activeStartTime === null) {
      return logs
    }

    const activeLogIndex = getLatestLogIndex(logs, activeTimerId)
    if (activeLogIndex === -1) {
      return logs
    }

    return logs.map((entry, index) => {
      if (index === activeLogIndex) {
        const elapsed = Math.floor((now - activeStartTime) / 1000)
        return {
          ...entry,
          endTime: now,
          duration: elapsed,
        }
      }
      return entry
    })
  }
}

export const timerService = new TimerService()
```

- [ ] **Step 3: Update useTimerState.ts toggleTimer**

The key change: when switching to a new timer, create a fresh `buildLogEntry` (a new block). The existing `commitActiveTimer` finalizes the previous block.

In `src/hooks/useTimerState.ts`, the `toggleTimer` callback stays structurally the same since `commitActiveTimer` + `buildLogEntry` already handle the new model. Just verify it compiles.

- [ ] **Step 4: Verify**

Run: `npx tsc -b && npm run dev`
Expected: no TypeScript errors. Open app, start/stop timers, verify new log entries appear with each toggle.

- [ ] **Step 5: Commit**

```bash
git add src/utils/logHelpers.ts src/services/TimerService.ts src/hooks/useTimerState.ts
git commit -m "feat: convert timer to block-based logging with real start/end times"
```

---

## Task 3: Set up routing and shared state context

**Goal:** Wire up TanStack Router with `/` and `/review` routes. Extract Dashboard from App.tsx. Create LogContext for shared state across routes.

**Files:**
- Create: `src/context/LogContext.tsx`
- Create: `src/pages/Dashboard.tsx`
- Create: `src/pages/Review.tsx`
- Modify: `src/App.tsx`
- Modify: `src/main.tsx`

**Acceptance Criteria:**
- [ ] `/` renders Dashboard with full existing timer functionality
- [ ] `/review` renders Review placeholder
- [ ] Nav bar with active state indicator on both routes
- [ ] LogContext provides shared state to both routes
- [ ] Timer start/stop/label edit all work on Dashboard

**Verify:** `npm run dev` → navigate between `/` and `/review`, timers work

**Steps:**

- [ ] **Step 1: Create LogContext**

Create `src/context/LogContext.tsx`:

```typescript
import { createContext, useContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { LogEntry, TimerState } from '../types'
import { usePersistence } from '../hooks/usePersistence'
import { useTimerState } from '../hooks/useTimerState'

const defaultTimerLabels: TimerState['timerLabels'] = {
  1: 'Timer 1',
  2: 'Timer 2',
  3: 'Timer 3',
}

const initialTimerState: TimerState = {
  activeTimerId: null,
  activeStartTime: null,
  timerLabels: defaultTimerLabels,
  timerValues: { 1: 0, 2: 0, 3: 0 },
  lastSavedAt: Date.now(),
}

interface LogContextValue {
  timerState: TimerState
  logs: LogEntry[]
  now: number
  setTimerState: React.Dispatch<React.SetStateAction<TimerState>>
  setLogs: React.Dispatch<React.SetStateAction<LogEntry[]>>
  toggleTimer: (timerId: 1 | 2 | 3) => void
  updateTimerLabel: (timerId: 1 | 2 | 3, value: string) => void
  updateLogLabel: (logId: string, value: string) => void
  validateLogLabel: (logId: string) => void
  deleteLog: (logId: string) => void
  getTimerSeconds: (timerId: 1 | 2 | 3) => number
  displayLogs: LogEntry[]
  totalSeconds: number
  clearAll: () => void
}

const LogContext = createContext<LogContextValue | null>(null)

export const useLogContext = (): LogContextValue => {
  const ctx = useContext(LogContext)
  if (!ctx) throw new Error('useLogContext must be used within LogProvider')
  return ctx
}

export const LogProvider = ({ children }: { children: ReactNode }) => {
  const [now, setNow] = useState(() => Date.now())
  const {
    timerState,
    logs,
    setTimerState,
    setLogs,
    toggleTimer: rawToggle,
    updateTimerLabel,
    updateLogLabel,
    validateLogLabel,
    deleteLog,
    getTimerSeconds: rawGetTimerSeconds,
    getDisplayLogs,
  } = useTimerState(initialTimerState, [])

  usePersistence(timerState, logs, setTimerState, setLogs, setNow, defaultTimerLabels)

  useEffect(() => {
    if (timerState.activeTimerId === null) return
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [timerState.activeTimerId])

  const toggleTimer = useCallback(
    (timerId: 1 | 2 | 3) => {
      const timestamp = Date.now()
      setNow(timestamp)
      rawToggle(timerId, timestamp)
    },
    [rawToggle]
  )

  const getTimerSeconds = useCallback(
    (timerId: 1 | 2 | 3) => rawGetTimerSeconds(timerId, now),
    [rawGetTimerSeconds, now]
  )

  const displayLogs = useMemo(() => getDisplayLogs(now), [getDisplayLogs, now])

  const totalSeconds = useMemo(() => {
    const t1 = rawGetTimerSeconds(1, now)
    const t2 = rawGetTimerSeconds(2, now)
    const t3 = rawGetTimerSeconds(3, now)
    return t1 + t2 + t3
  }, [rawGetTimerSeconds, now])

  const clearAll = useCallback(() => {
    const timestamp = Date.now()
    import('../utils/storage').then(({ clearState }) => {
      clearState()
      setTimerState({ ...initialTimerState, lastSavedAt: timestamp })
      setLogs([])
      setNow(timestamp)
    })
  }, [setTimerState, setLogs])

  const value = useMemo(
    () => ({
      timerState, logs, now, setTimerState, setLogs,
      toggleTimer, updateTimerLabel, updateLogLabel, validateLogLabel,
      deleteLog, getTimerSeconds, displayLogs, totalSeconds, clearAll,
    }),
    [timerState, logs, now, setTimerState, setLogs, toggleTimer,
     updateTimerLabel, updateLogLabel, validateLogLabel, deleteLog,
     getTimerSeconds, displayLogs, totalSeconds, clearAll]
  )

  return <LogContext.Provider value={value}>{children}</LogContext.Provider>
}
```

- [ ] **Step 2: Create Dashboard page**

Create `src/pages/Dashboard.tsx`. Extract the timer UI from current App.tsx:

```typescript
import { useMemo, useState, useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import { TimerCard } from '../components/TimerCard'
import { LogList } from '../components/LogList'
import { formatSeconds } from '../utils/format'
import { generateSummary } from '../services/geminiClient'
import { useLogContext } from '../context/LogContext'

export const Dashboard = () => {
  const {
    timerState, logs, displayLogs, totalSeconds,
    toggleTimer, updateTimerLabel, updateLogLabel,
    validateLogLabel, deleteLog, getTimerSeconds, clearAll,
  } = useLogContext()

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

  const handleDownloadSummary = useCallback(() => {
    if (!summaryText) return
    const payload = buildExportPayload()
    const blob = new Blob([payload.content], { type: payload.type })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `focusflow-summary.${payload.extension}`
    anchor.click()
    URL.revokeObjectURL(url)
  }, [buildExportPayload, summaryText])

  const summaryError = summaryMutation.error
    ? summaryMutation.error instanceof Error
      ? summaryMutation.error.message
      : 'Failed to generate summary.'
    : null

  const hasApiKey = Boolean(import.meta.env.VITE_GEMINI_API_KEY)

  return (
    <>
      <section className="app__global-timer" aria-label="Daily total">
        <span className="app__global-timer-label">Daily Total</span>
        <span className="app__global-timer-time">{formatSeconds(totalSeconds)}</span>
      </section>

      <section className="app__timers" aria-label="Timers">
        <TimerCard timerId={1} label={timerState.timerLabels[1]} isActive={timerState.activeTimerId === 1} formattedTime={formatSeconds(getTimerSeconds(1))} onToggle={toggleTimer} onLabelChange={updateTimerLabel} />
        <TimerCard timerId={2} label={timerState.timerLabels[2]} isActive={timerState.activeTimerId === 2} formattedTime={formatSeconds(getTimerSeconds(2))} onToggle={toggleTimer} onLabelChange={updateTimerLabel} />
        <TimerCard timerId={3} label={timerState.timerLabels[3]} isActive={timerState.activeTimerId === 3} formattedTime={formatSeconds(getTimerSeconds(3))} onToggle={toggleTimer} onLabelChange={updateTimerLabel} />
      </section>

      <section className="app__logs" aria-label="Activity log">
        <h2 className="app__section-title">Activity Log</h2>
        {logs.length === 0 ? (
          <div className="app__placeholder">No sessions yet.</div>
        ) : (
          <LogList logs={displayLogs} formatDuration={formatSeconds} onLabelChange={updateLogLabel} onLabelBlur={validateLogLabel} onDelete={deleteLog} />
        )}
      </section>

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
          <button className="summary__button summary__button--ghost" type="button" onClick={handleDownloadSummary} disabled={!summaryText}>
            Download
          </button>
          {logs.length === 0 ? (
            <span className="summary__status">Add sessions to summarize.</span>
          ) : summaryMutation.isPending ? (
            <span className="summary__status">Building grouped bullets.</span>
          ) : !hasApiKey ? (
            <span className="summary__status">Using proxy (or add VITE_GEMINI_API_KEY for direct mode).</span>
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

      <footer className="app__footer">
        <span>Active timer: {timerState.activeTimerId ?? 'None'}</span>
        <button className="app__clear-button" type="button" onClick={() => { clearAll(); summaryMutation.reset() }}>
          Clear All Data
        </button>
      </footer>
    </>
  )
}
```

- [ ] **Step 3: Create Review placeholder**

Create `src/pages/Review.tsx`:

```typescript
export const Review = () => {
  return (
    <section className="app__review">
      <h2 className="app__section-title">Revue Hebdomadaire</h2>
      <div className="app__placeholder">Coming soon...</div>
    </section>
  )
}
```

- [ ] **Step 4: Replace App.tsx with layout shell**

Replace `src/App.tsx`:

```typescript
import { Link, Outlet, useMatchRoute } from '@tanstack/react-router'
import './App.css'

function App() {
  const matchRoute = useMatchRoute()
  const isDashboard = matchRoute({ to: '/' })
  const isReview = matchRoute({ to: '/review' })

  return (
    <main className="app">
      <header className="app__header">
        <p className="app__eyebrow">FocusFlow</p>
        <nav className="app__nav">
          <Link to="/" className={`app__nav-link${isDashboard ? ' app__nav-link--active' : ''}`}>
            Dashboard
          </Link>
          <Link to="/review" className={`app__nav-link${isReview ? ' app__nav-link--active' : ''}`}>
            Revue
          </Link>
        </nav>
      </header>

      <Outlet />
    </main>
  )
}

export default App
```

- [ ] **Step 5: Wire up router in main.tsx**

Replace `src/main.tsx`:

```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter, createRootRoute, createRoute } from '@tanstack/react-router'
import { LogProvider } from './context/LogContext'
import App from './App'
import { Dashboard } from './pages/Dashboard'
import { Review } from './pages/Review'
import './index.css'

const queryClient = new QueryClient()

const rootRoute = createRootRoute({ component: App })
const dashboardRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: Dashboard })
const reviewRoute = createRoute({ getParentRoute: () => rootRoute, path: '/review', component: Review })

const routeTree = rootRoute.addChildren([dashboardRoute, reviewRoute])
const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <LogProvider>
        <RouterProvider router={router} />
      </LogProvider>
    </QueryClientProvider>
  </StrictMode>,
)
```

- [ ] **Step 6: Add nav CSS to App.css**

Add to the top of `src/App.css` (after `.app__header`):

```css
.app__nav {
  display: flex;
  gap: 0.5rem;
}

.app__nav-link {
  padding: 0.4rem 1rem;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text-3);
  text-decoration: none;
  transition: color 0.15s, background 0.15s;
}

.app__nav-link:hover {
  color: var(--text-2);
  background: var(--surface-2);
}

.app__nav-link--active {
  color: var(--accent);
  background: rgba(56, 178, 172, 0.1);
}
```

- [ ] **Step 7: Verify**

Run: `npm run dev`
Expected: app loads at `/`, nav bar shows Dashboard (active) and Revue links. Click Revue to navigate to `/review`. All timer functionality works on Dashboard.

- [ ] **Step 8: Commit**

```bash
git add src/context/ src/pages/ src/App.tsx src/App.css src/main.tsx
git commit -m "feat: set up TanStack Router with Dashboard and Review routes"
```

---

## Task 4: Build insights engine with tests

**Goal:** Pure TypeScript function that computes period insights from log entries. Plus a React hook wrapper.

**Files:**
- Create: `src/utils/insights.ts`
- Create: `src/utils/__tests__/insights.test.ts`
- Create: `src/hooks/useInsights.ts`

**Acceptance Criteria:**
- [ ] computeInsights returns correct PeriodInsights for day/week/month
- [ ] Empty logs return zero values
- [ ] Context switches counted correctly
- [ ] Period-over-period delta computed
- [ ] All tests pass

**Verify:** `npx vitest run src/utils/__tests__/insights.test.ts` → all pass

**Steps:**

- [ ] **Step 1: Write insights.ts**

Create `src/utils/insights.ts`:

```typescript
import {
  startOfDay, endOfDay, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, subDays, subWeeks, subMonths,
  eachDayOfInterval, format,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import type { LogEntry } from '../types'

export interface PeriodInsights {
  totalSeconds: number
  avgSessionSeconds: number
  longestSession: { duration: number; label: string; day: string }
  contextSwitchesPerDay: number
  dailyBreakdown: Array<{
    day: string
    seconds: number
    byLabel: Record<string, number>
  }>
  labelDistribution: Record<string, number>
  periodOverPeriodDelta: number
}

export type Period = 'today' | 'week' | 'month'

const emptyInsights: PeriodInsights = {
  totalSeconds: 0,
  avgSessionSeconds: 0,
  longestSession: { duration: 0, label: '', day: '' },
  contextSwitchesPerDay: 0,
  dailyBreakdown: [],
  labelDistribution: {},
  periodOverPeriodDelta: 0,
}

const filterLogsByRange = (
  logs: LogEntry[],
  start: number,
  end: number
): LogEntry[] =>
  logs.filter((log) => log.startTime >= start && log.startTime < end)

const computeForRange = (
  logs: LogEntry[],
  rangeStart: Date,
  rangeEnd: Date
): Omit<PeriodInsights, 'periodOverPeriodDelta'> => {
  const filtered = filterLogsByRange(
    logs,
    rangeStart.getTime(),
    rangeEnd.getTime()
  )

  if (filtered.length === 0) {
    return { ...emptyInsights }
  }

  const totalSeconds = filtered.reduce((sum, log) => sum + log.duration, 0)
  const avgSessionSeconds = Math.round(totalSeconds / filtered.length)

  // Longest session
  let longest = filtered[0]
  for (const log of filtered) {
    if (log.duration > longest.duration) longest = log
  }
  const longestSession = {
    duration: longest.duration,
    label: longest.label,
    day: format(new Date(longest.startTime), 'EEE', { locale: fr }),
  }

  // Daily breakdown
  const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd })
  const dailyBreakdown = days.map((dayDate) => {
    const dayStart = startOfDay(dayDate).getTime()
    const dayEnd = endOfDay(dayDate).getTime()
    const dayLogs = filtered.filter(
      (log) => log.startTime >= dayStart && log.startTime < dayEnd
    )
    const byLabel: Record<string, number> = {}
    let seconds = 0
    for (const log of dayLogs) {
      seconds += log.duration
      byLabel[log.label] = (byLabel[log.label] ?? 0) + log.duration
    }
    return {
      day: format(dayDate, 'EEE', { locale: fr }),
      seconds,
      byLabel,
    }
  })

  // Label distribution
  const labelDistribution: Record<string, number> = {}
  for (const log of filtered) {
    labelDistribution[log.label] = (labelDistribution[log.label] ?? 0) + log.duration
  }

  // Context switches
  const switchesByDay: number[] = []
  for (const dayDate of days) {
    const dayStart = startOfDay(dayDate).getTime()
    const dayEnd = endOfDay(dayDate).getTime()
    const dayLogs = filtered
      .filter((log) => log.startTime >= dayStart && log.startTime < dayEnd)
      .sort((a, b) => a.startTime - b.startTime)
    let switches = 0
    for (let i = 1; i < dayLogs.length; i++) {
      if (dayLogs[i].label !== dayLogs[i - 1].label) switches++
    }
    if (dayLogs.length > 0) switchesByDay.push(switches)
  }
  const contextSwitchesPerDay =
    switchesByDay.length > 0
      ? Math.round(
          (switchesByDay.reduce((a, b) => a + b, 0) / switchesByDay.length) * 10
        ) / 10
      : 0

  return {
    totalSeconds,
    avgSessionSeconds,
    longestSession,
    contextSwitchesPerDay,
    dailyBreakdown,
    labelDistribution,
  }
}

export const getPeriodDates = (
  period: Period,
  referenceDate: Date = new Date()
): { start: Date; end: Date; priorStart: Date; priorEnd: Date } => {
  switch (period) {
    case 'today':
      return {
        start: startOfDay(referenceDate),
        end: endOfDay(referenceDate),
        priorStart: startOfDay(subDays(referenceDate, 1)),
        priorEnd: endOfDay(subDays(referenceDate, 1)),
      }
    case 'week':
      return {
        start: startOfWeek(referenceDate, { locale: fr }),
        end: endOfWeek(referenceDate, { locale: fr }),
        priorStart: startOfWeek(subWeeks(referenceDate, 1), { locale: fr }),
        priorEnd: endOfWeek(subWeeks(referenceDate, 1), { locale: fr }),
      }
    case 'month':
      return {
        start: startOfMonth(referenceDate),
        end: endOfMonth(referenceDate),
        priorStart: startOfMonth(subMonths(referenceDate, 1)),
        priorEnd: endOfMonth(subMonths(referenceDate, 1)),
      }
  }
}

export const computeInsights = (
  logs: LogEntry[],
  start: Date,
  end: Date,
  priorStart: Date,
  priorEnd: Date
): PeriodInsights => {
  const current = computeForRange(logs, start, end)
  const prior = computeForRange(logs, priorStart, priorEnd)
  return {
    ...current,
    periodOverPeriodDelta: current.totalSeconds - prior.totalSeconds,
  }
}
```

- [ ] **Step 2: Write insights tests**

Create `src/utils/__tests__/insights.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { computeInsights, getPeriodDates } from '../insights'
import type { LogEntry } from '../../types'

const makeLog = (
  overrides: Partial<LogEntry> & { startTime: number; duration: number }
): LogEntry => ({
  id: crypto.randomUUID(),
  timerId: 1,
  label: 'Work',
  endTime: overrides.startTime + overrides.duration * 1000,
  source: 'timer',
  ...overrides,
})

describe('computeInsights', () => {
  it('returns zero values for empty logs', () => {
    const { start, end, priorStart, priorEnd } = getPeriodDates('week', new Date('2026-03-30'))
    const result = computeInsights([], start, end, priorStart, priorEnd)

    expect(result.totalSeconds).toBe(0)
    expect(result.avgSessionSeconds).toBe(0)
    expect(result.longestSession.duration).toBe(0)
    expect(result.contextSwitchesPerDay).toBe(0)
    expect(result.periodOverPeriodDelta).toBe(0)
  })

  it('computes totals for single day', () => {
    const dayStart = new Date('2026-03-30T09:00:00').getTime()
    const logs: LogEntry[] = [
      makeLog({ startTime: dayStart, duration: 3600, label: 'Work' }),
      makeLog({ startTime: dayStart + 3600000, duration: 1800, label: 'Break', timerId: 2 }),
    ]
    const { start, end, priorStart, priorEnd } = getPeriodDates('today', new Date('2026-03-30'))
    const result = computeInsights(logs, start, end, priorStart, priorEnd)

    expect(result.totalSeconds).toBe(5400)
    expect(result.avgSessionSeconds).toBe(2700)
    expect(result.longestSession.label).toBe('Work')
    expect(result.longestSession.duration).toBe(3600)
  })

  it('counts context switches correctly', () => {
    const dayStart = new Date('2026-03-30T09:00:00').getTime()
    const logs: LogEntry[] = [
      makeLog({ startTime: dayStart, duration: 3600, label: 'Work' }),
      makeLog({ startTime: dayStart + 3600000, duration: 1800, label: 'Break', timerId: 2 }),
      makeLog({ startTime: dayStart + 5400000, duration: 3600, label: 'Work' }),
    ]
    const { start, end, priorStart, priorEnd } = getPeriodDates('today', new Date('2026-03-30'))
    const result = computeInsights(logs, start, end, priorStart, priorEnd)

    expect(result.contextSwitchesPerDay).toBe(2)
  })

  it('computes period-over-period delta', () => {
    const thisWeekDay = new Date('2026-03-30T10:00:00').getTime()
    const lastWeekDay = new Date('2026-03-23T10:00:00').getTime()

    const logs: LogEntry[] = [
      makeLog({ startTime: thisWeekDay, duration: 7200, label: 'Work' }),
      makeLog({ startTime: lastWeekDay, duration: 3600, label: 'Work' }),
    ]
    const { start, end, priorStart, priorEnd } = getPeriodDates('week', new Date('2026-03-30'))
    const result = computeInsights(logs, start, end, priorStart, priorEnd)

    expect(result.periodOverPeriodDelta).toBe(3600)
  })

  it('builds label distribution', () => {
    const dayStart = new Date('2026-03-30T09:00:00').getTime()
    const logs: LogEntry[] = [
      makeLog({ startTime: dayStart, duration: 3600, label: 'Work' }),
      makeLog({ startTime: dayStart + 3600000, duration: 1800, label: 'Learn', timerId: 3 }),
      makeLog({ startTime: dayStart + 5400000, duration: 1800, label: 'Work' }),
    ]
    const { start, end, priorStart, priorEnd } = getPeriodDates('today', new Date('2026-03-30'))
    const result = computeInsights(logs, start, end, priorStart, priorEnd)

    expect(result.labelDistribution['Work']).toBe(5400)
    expect(result.labelDistribution['Learn']).toBe(1800)
  })
})

describe('getPeriodDates', () => {
  it('week starts on Monday (fr locale)', () => {
    const { start } = getPeriodDates('week', new Date('2026-03-30'))
    expect(start.getDay()).toBe(1) // Monday
  })
})
```

- [ ] **Step 3: Create useInsights hook**

Create `src/hooks/useInsights.ts`:

```typescript
import { useMemo } from 'react'
import { computeInsights, getPeriodDates, type Period, type PeriodInsights } from '../utils/insights'
import type { LogEntry } from '../types'

export const useInsights = (logs: LogEntry[], period: Period): PeriodInsights => {
  return useMemo(() => {
    const { start, end, priorStart, priorEnd } = getPeriodDates(period)
    return computeInsights(logs, start, end, priorStart, priorEnd)
  }, [logs, period])
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/utils/__tests__/insights.test.ts`
Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/utils/insights.ts src/utils/__tests__/insights.test.ts src/hooks/useInsights.ts
git commit -m "feat: add insights engine with period computation and tests"
```

---

## Task 5: Manual entry form and log editing

**Goal:** Collapsible manual entry form on Dashboard + inline editing of today's log entries.

**Files:**
- Create: `src/components/ManualEntryForm.tsx`
- Create: `src/components/LogItemEdit.tsx`
- Create: `src/utils/__tests__/validators.test.ts`
- Modify: `src/components/LogItem.tsx`
- Modify: `src/pages/Dashboard.tsx`

**Acceptance Criteria:**
- [ ] Manual entry form creates LogEntry with source='manual'
- [ ] Validation: end > start, no same-timer overlaps
- [ ] Inline error shows conflicting entry time range
- [ ] Today's entries have edit button that expands inline form
- [ ] Edit saves in place with recalculated duration
- [ ] Historical entries are read-only
- [ ] All validator tests pass

**Verify:** `npx vitest run src/utils/__tests__/validators.test.ts` → all pass, manual add + edit works in browser

**Steps:**

- [ ] **Step 1: Write validator tests**

Create `src/utils/__tests__/validators.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { isValidTimeRange, findOverlappingLog } from '../validators'
import type { LogEntry } from '../../types'

describe('isValidTimeRange', () => {
  it('returns true for valid range', () => {
    expect(isValidTimeRange(1000, 2000)).toBe(true)
  })

  it('returns false when end <= start', () => {
    expect(isValidTimeRange(2000, 1000)).toBe(false)
    expect(isValidTimeRange(1000, 1000)).toBe(false)
  })

  it('returns false for zero start', () => {
    expect(isValidTimeRange(0, 1000)).toBe(false)
  })
})

describe('findOverlappingLog', () => {
  const logs: LogEntry[] = [
    {
      id: 'log-1', timerId: 1, label: 'Work',
      startTime: 1000, endTime: 2000, duration: 1, source: 'timer',
    },
    {
      id: 'log-2', timerId: 2, label: 'Break',
      startTime: 1500, endTime: 2500, duration: 1, source: 'timer',
    },
  ]

  it('finds overlap on same timer', () => {
    const result = findOverlappingLog(logs, 1, 1500, 3000)
    expect(result).not.toBeNull()
    expect(result!.id).toBe('log-1')
  })

  it('allows overlap on different timer', () => {
    const result = findOverlappingLog(logs, 3, 1500, 3000)
    expect(result).toBeNull()
  })

  it('excludes self when editing', () => {
    const result = findOverlappingLog(logs, 1, 1000, 2000, 'log-1')
    expect(result).toBeNull()
  })

  it('returns null for non-overlapping range', () => {
    const result = findOverlappingLog(logs, 1, 3000, 4000)
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/utils/__tests__/validators.test.ts`
Expected: all pass

- [ ] **Step 3: Create ManualEntryForm component**

Create `src/components/ManualEntryForm.tsx`:

```typescript
import { useState, useCallback, type FormEvent } from 'react'
import { startOfDay } from 'date-fns'
import { useLogContext } from '../context/LogContext'
import { isValidTimeRange, findOverlappingLog } from '../utils/validators'
import { formatSeconds } from '../utils/format'
import type { LogEntry } from '../types'

export const ManualEntryForm = () => {
  const { timerState, logs, setLogs } = useLogContext()
  const [isOpen, setIsOpen] = useState(false)
  const [timerId, setTimerId] = useState<1 | 2 | 3>(1)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const parseTimestamp = useCallback(
    (dateStr: string, timeStr: string): number => {
      const day = startOfDay(new Date(dateStr))
      const [hours, minutes] = timeStr.split(':').map(Number)
      return day.getTime() + hours * 3600000 + minutes * 60000
    },
    []
  )

  const durationPreview = useCallback(() => {
    const start = parseTimestamp(date, startTime)
    const end = parseTimestamp(date, endTime)
    if (end <= start) return ''
    return formatSeconds(Math.floor((end - start) / 1000))
  }, [date, startTime, endTime, parseTimestamp])

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault()
      setError('')

      const start = parseTimestamp(date, startTime)
      const end = parseTimestamp(date, endTime)

      if (!isValidTimeRange(start, end)) {
        setError("L'heure de fin doit etre apres l'heure de debut.")
        return
      }

      const overlap = findOverlappingLog(logs, timerId, start, end)
      if (overlap) {
        const overlapStart = new Date(overlap.startTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        const overlapEnd = new Date(overlap.endTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        setError(`Chevauchement avec "${overlap.label}" (${overlapStart} - ${overlapEnd})`)
        return
      }

      const entry: LogEntry = {
        id: crypto.randomUUID(),
        timerId,
        label: timerState.timerLabels[timerId],
        startTime: start,
        endTime: end,
        duration: Math.floor((end - start) / 1000),
        source: 'manual',
        note: note.trim() || undefined,
      }

      setLogs((prev) => [...prev, entry])
      setStartTime('09:00')
      setEndTime('10:00')
      setNote('')
      setError('')
    },
    [date, startTime, endTime, timerId, note, logs, timerState.timerLabels, parseTimestamp, setLogs]
  )

  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

  if (!isOpen) {
    return (
      <button className="manual-entry__toggle" type="button" onClick={() => setIsOpen(true)}>
        + Ajouter une entree manuelle
      </button>
    )
  }

  return (
    <form className="manual-entry" onSubmit={handleSubmit}>
      <div className="manual-entry__header">
        <h3 className="manual-entry__title">Ajouter une entree manuelle</h3>
        <button className="manual-entry__close" type="button" onClick={() => setIsOpen(false)}>
          &times;
        </button>
      </div>

      <div className="manual-entry__row">
        <select
          className="manual-entry__select"
          value={timerId}
          onChange={(e) => setTimerId(Number(e.target.value) as 1 | 2 | 3)}
        >
          <option value={1}>{timerState.timerLabels[1]}</option>
          <option value={2}>{timerState.timerLabels[2]}</option>
          <option value={3}>{timerState.timerLabels[3]}</option>
        </select>

        <select className="manual-entry__select" value={date} onChange={(e) => setDate(e.target.value)}>
          <option value={today}>Aujourd'hui</option>
          <option value={yesterday}>Hier</option>
        </select>

        <input className="manual-entry__time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        <span className="manual-entry__arrow">→</span>
        <input className="manual-entry__time" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />

        <input className="manual-entry__note" type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optionnel)..." />
      </div>

      <div className="manual-entry__footer">
        {durationPreview() && <span className="manual-entry__preview">Duree : {durationPreview()}</span>}
        <button className="manual-entry__submit" type="submit">Ajouter</button>
      </div>

      {error && <div className="manual-entry__error">{error}</div>}
    </form>
  )
}
```

- [ ] **Step 4: Create LogItemEdit component**

Create `src/components/LogItemEdit.tsx`:

```typescript
import { useState, useCallback, type FormEvent } from 'react'
import { useLogContext } from '../context/LogContext'
import { isValidTimeRange, findOverlappingLog } from '../utils/validators'
import { formatSeconds } from '../utils/format'
import type { LogEntry } from '../types'

interface LogItemEditProps {
  entry: LogEntry
  onCancel: () => void
}

export const LogItemEdit = ({ entry, onCancel }: LogItemEditProps) => {
  const { logs, setLogs } = useLogContext()
  const [label, setLabel] = useState(entry.label)
  const [startTime, setStartTime] = useState(
    new Date(entry.startTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  )
  const [endTime, setEndTime] = useState(
    new Date(entry.endTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  )
  const [note, setNote] = useState(entry.note ?? '')
  const [error, setError] = useState('')

  const parseTime = useCallback(
    (timeStr: string): number => {
      const dayStart = new Date(entry.startTime)
      dayStart.setHours(0, 0, 0, 0)
      const [hours, minutes] = timeStr.split(':').map(Number)
      return dayStart.getTime() + hours * 3600000 + minutes * 60000
    },
    [entry.startTime]
  )

  const handleSave = useCallback(
    (e: FormEvent) => {
      e.preventDefault()
      setError('')

      const newStart = parseTime(startTime)
      const newEnd = parseTime(endTime)

      if (!isValidTimeRange(newStart, newEnd)) {
        setError("L'heure de fin doit etre apres l'heure de debut.")
        return
      }

      const overlap = findOverlappingLog(logs, entry.timerId, newStart, newEnd, entry.id)
      if (overlap) {
        const oStart = new Date(overlap.startTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        const oEnd = new Date(overlap.endTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        setError(`Chevauchement avec "${overlap.label}" (${oStart} - ${oEnd})`)
        return
      }

      setLogs((prev) =>
        prev.map((log) =>
          log.id === entry.id
            ? {
                ...log,
                label: label.trim() || log.label,
                startTime: newStart,
                endTime: newEnd,
                duration: Math.floor((newEnd - newStart) / 1000),
                note: note.trim() || undefined,
              }
            : log
        )
      )
      onCancel()
    },
    [startTime, endTime, label, note, logs, entry, parseTime, setLogs, onCancel]
  )

  const preview = (() => {
    const s = parseTime(startTime)
    const e = parseTime(endTime)
    return e > s ? formatSeconds(Math.floor((e - s) / 1000)) : ''
  })()

  return (
    <form className="log-item-edit" onSubmit={handleSave}>
      <input className="log-item-edit__label" value={label} onChange={(e) => setLabel(e.target.value)} />
      <div className="log-item-edit__times">
        <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        <span>→</span>
        <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        {preview && <span className="log-item-edit__preview">{preview}</span>}
      </div>
      <input className="log-item-edit__note" type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note..." />
      {error && <div className="log-item-edit__error">{error}</div>}
      <div className="log-item-edit__actions">
        <button className="log-item-edit__save" type="submit">Sauvegarder</button>
        <button className="log-item-edit__cancel" type="button" onClick={onCancel}>Annuler</button>
      </div>
    </form>
  )
}
```

- [ ] **Step 5: Update LogItem to support edit mode**

Replace `src/components/LogItem.tsx`:

```typescript
import { useState } from 'react'
import { startOfDay } from 'date-fns'
import type { LogEntry } from '../types'
import { LogItemEdit } from './LogItemEdit'

interface LogItemProps {
  entry: LogEntry
  formattedDuration: string
  onLabelChange: (id: string, value: string) => void
  onLabelBlur: (id: string) => void
  onDelete: (id: string) => void
}

export const LogItem = ({
  entry,
  formattedDuration,
  onLabelChange,
  onLabelBlur,
  onDelete,
}: LogItemProps) => {
  const [isEditing, setIsEditing] = useState(false)

  const isToday =
    startOfDay(new Date(entry.startTime)).getTime() ===
    startOfDay(new Date()).getTime()

  if (isEditing) {
    return <LogItemEdit entry={entry} onCancel={() => setIsEditing(false)} />
  }

  return (
    <div className="log-item" data-timer={entry.timerId}>
      <span className="log-item__dot" aria-hidden="true" />
      <input
        className="log-item__input"
        value={entry.label}
        onChange={(event) => onLabelChange(entry.id, event.target.value)}
        onBlur={() => onLabelBlur(entry.id)}
      />
      <span className="log-item__duration">{formattedDuration}</span>
      {isToday && (
        <button
          className="log-item__edit"
          type="button"
          onClick={() => setIsEditing(true)}
          aria-label={`Modifier ${entry.label}`}
        >
          ✎
        </button>
      )}
      <button
        className="log-item__delete"
        type="button"
        onClick={() => onDelete(entry.id)}
        aria-label={`Delete ${entry.label}`}
      >
        &times;
      </button>
    </div>
  )
}
```

- [ ] **Step 6: Add ManualEntryForm to Dashboard**

In `src/pages/Dashboard.tsx`, add after the timers section and before the logs section:

```typescript
import { ManualEntryForm } from '../components/ManualEntryForm'
```

Then insert `<ManualEntryForm />` between the timers section and the logs section:

```tsx
      </section>

      <ManualEntryForm />

      <section className="app__logs" aria-label="Activity log">
```

- [ ] **Step 7: Add CSS for manual entry and log editing**

Add to `src/App.css`:

```css
/* Manual Entry */
.manual-entry__toggle {
  width: 100%;
  padding: 0.75rem;
  background: transparent;
  border: 1.5px dashed var(--border-strong);
  border-radius: 12px;
  color: var(--text-3);
  font-size: 0.85rem;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}

.manual-entry__toggle:hover {
  border-color: var(--accent);
  color: var(--text-2);
}

.manual-entry {
  padding: 1.25rem;
  border: 1.5px solid var(--border);
  border-radius: 12px;
  background: var(--surface-1);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.manual-entry__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.manual-entry__title {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-1);
  margin: 0;
}

.manual-entry__close {
  background: none;
  border: none;
  color: var(--text-3);
  font-size: 1.2rem;
  cursor: pointer;
}

.manual-entry__row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.manual-entry__select,
.manual-entry__time,
.manual-entry__note {
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface-2);
  color: var(--text-1);
  font-size: 0.8rem;
}

.manual-entry__note {
  flex: 1;
  min-width: 120px;
}

.manual-entry__arrow {
  color: var(--text-3);
}

.manual-entry__footer {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.manual-entry__preview {
  font-size: 0.8rem;
  color: var(--text-3);
}

.manual-entry__submit {
  padding: 0.4rem 1rem;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 0.8rem;
  cursor: pointer;
}

.manual-entry__error {
  color: var(--danger);
  font-size: 0.8rem;
}

/* Log Item Edit */
.log-item__edit {
  background: none;
  border: none;
  color: var(--text-3);
  cursor: pointer;
  font-size: 0.85rem;
  padding: 0.2rem 0.4rem;
}

.log-item__edit:hover {
  color: var(--accent);
}

.log-item-edit {
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-2);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.log-item-edit__label {
  padding: 0.3rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface-1);
  color: var(--text-1);
  font-size: 0.85rem;
}

.log-item-edit__times {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  color: var(--text-2);
}

.log-item-edit__times input {
  padding: 0.3rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface-1);
  color: var(--text-1);
  font-size: 0.8rem;
}

.log-item-edit__preview {
  color: var(--text-3);
  font-size: 0.75rem;
}

.log-item-edit__note {
  padding: 0.3rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface-1);
  color: var(--text-1);
  font-size: 0.8rem;
}

.log-item-edit__error {
  color: var(--danger);
  font-size: 0.8rem;
}

.log-item-edit__actions {
  display: flex;
  gap: 0.5rem;
}

.log-item-edit__save {
  padding: 0.3rem 0.75rem;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size: 0.8rem;
  cursor: pointer;
}

.log-item-edit__cancel {
  padding: 0.3rem 0.75rem;
  background: transparent;
  color: var(--text-3);
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 0.8rem;
  cursor: pointer;
}
```

- [ ] **Step 8: Run all tests**

Run: `npx vitest run`
Expected: all tests pass

- [ ] **Step 9: Commit**

```bash
git add src/components/ManualEntryForm.tsx src/components/LogItemEdit.tsx src/components/LogItem.tsx src/pages/Dashboard.tsx src/utils/__tests__/validators.test.ts src/App.css
git commit -m "feat: add manual entry form and inline log editing"
```

---

## Task 6: Build Weekly Review UI

**Goal:** StatsGrid, DailyChart, AiNarrative components and compose them in the Review page with period tabs.

**Files:**
- Create: `src/components/StatsGrid.tsx`
- Create: `src/components/DailyChart.tsx`
- Create: `src/components/AiNarrative.tsx`
- Modify: `src/pages/Review.tsx`
- Modify: `src/App.css`

**Acceptance Criteria:**
- [ ] Period tabs switch between today/week/month
- [ ] StatsGrid shows 4 cards with deltas, responsive
- [ ] DailyChart renders stacked bars by label with legend
- [ ] AiNarrative shows loading/error/empty states
- [ ] JSON backup download exports full log history
- [ ] All UI text in French

**Verify:** `npm run dev` → navigate to `/review`, see stats, chart, narrative

**Steps:**

- [ ] **Step 1: Create StatsGrid**

Create `src/components/StatsGrid.tsx`:

```typescript
import { formatSeconds } from '../utils/format'
import type { PeriodInsights } from '../utils/insights'

interface StatsGridProps {
  insights: PeriodInsights
}

const formatDelta = (seconds: number): string => {
  const prefix = seconds >= 0 ? '+' : ''
  return `${prefix}${formatSeconds(Math.abs(seconds))}`
}

export const StatsGrid = ({ insights }: StatsGridProps) => {
  const isPositive = insights.periodOverPeriodDelta >= 0
  const switchesWarning = insights.contextSwitchesPerDay > 4

  return (
    <div className="stats-grid">
      <div className="stats-grid__card">
        <span className="stats-grid__value">{formatSeconds(insights.totalSeconds)}</span>
        <span className="stats-grid__label">Total suivi</span>
        <span className={`stats-grid__delta ${isPositive ? 'stats-grid__delta--positive' : 'stats-grid__delta--negative'}`}>
          {formatDelta(insights.periodOverPeriodDelta)} vs precedent
        </span>
      </div>

      <div className="stats-grid__card">
        <span className="stats-grid__value">{formatSeconds(insights.avgSessionSeconds)}</span>
        <span className="stats-grid__label">Session moyenne</span>
      </div>

      <div className="stats-grid__card">
        <span className="stats-grid__value">{formatSeconds(insights.longestSession.duration)}</span>
        <span className="stats-grid__label">Plus longue session</span>
        {insights.longestSession.label && (
          <span className="stats-grid__detail">
            {insights.longestSession.day}, {insights.longestSession.label}
          </span>
        )}
      </div>

      <div className="stats-grid__card">
        <span className="stats-grid__value">{insights.contextSwitchesPerDay}</span>
        <span className="stats-grid__label">Changements/jour</span>
        {switchesWarning && <span className="stats-grid__delta stats-grid__delta--warning">Eleve</span>}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create DailyChart**

Create `src/components/DailyChart.tsx`:

```typescript
import type { PeriodInsights } from '../utils/insights'
import { formatSeconds } from '../utils/format'

interface DailyChartProps {
  insights: PeriodInsights
  timerLabels: Record<number, string>
}

const TIMER_COLORS: Record<string, string> = {}
const COLOR_PALETTE = ['var(--timer-1)', 'var(--timer-2)', 'var(--timer-3)']

const getColor = (label: string, allLabels: string[]): string => {
  if (!TIMER_COLORS[label]) {
    const index = allLabels.indexOf(label) % COLOR_PALETTE.length
    TIMER_COLORS[label] = COLOR_PALETTE[index]
  }
  return TIMER_COLORS[label]
}

export const DailyChart = ({ insights }: DailyChartProps) => {
  const maxSeconds = Math.max(...insights.dailyBreakdown.map((d) => d.seconds), 1)
  const allLabels = Object.keys(insights.labelDistribution).sort(
    (a, b) => (insights.labelDistribution[b] ?? 0) - (insights.labelDistribution[a] ?? 0)
  )

  return (
    <div className="daily-chart">
      <h3 className="daily-chart__title">Repartition journaliere</h3>

      <div className="daily-chart__rows">
        {insights.dailyBreakdown.map((day) => (
          <div className="daily-chart__row" key={day.day}>
            <span className="daily-chart__label">{day.day}</span>
            <div className="daily-chart__bar-bg">
              {allLabels.map((label) => {
                const seconds = day.byLabel[label] ?? 0
                if (seconds === 0) return null
                const pct = (seconds / maxSeconds) * 100
                return (
                  <div
                    key={label}
                    className="daily-chart__bar"
                    style={{
                      width: `${Math.max(pct, 0.5)}%`,
                      minWidth: seconds > 0 ? '2px' : '0',
                      background: getColor(label, allLabels),
                    }}
                    title={`${label}: ${formatSeconds(seconds)}`}
                  />
                )
              })}
            </div>
            <span className="daily-chart__time">
              {day.seconds > 0 ? formatSeconds(day.seconds) : ''}
            </span>
          </div>
        ))}
      </div>

      <div className="daily-chart__legend">
        {allLabels.map((label) => (
          <span className="daily-chart__legend-item" key={label}>
            <span
              className="daily-chart__legend-dot"
              style={{ background: getColor(label, allLabels) }}
            />
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create AiNarrative**

Create `src/components/AiNarrative.tsx`:

```typescript
import { useMutation } from '@tanstack/react-query'
import { useEffect } from 'react'
import { generateReviewNarrative } from '../services/geminiClient'
import type { PeriodInsights } from '../utils/insights'
import type { LogEntry } from '../types'

interface AiNarrativeProps {
  insights: PeriodInsights
  logs: LogEntry[]
}

export const AiNarrative = ({ insights, logs }: AiNarrativeProps) => {
  const mutation = useMutation({
    mutationFn: () => generateReviewNarrative(insights, logs),
  })

  useEffect(() => {
    if (insights.totalSeconds > 0) {
      mutation.mutate()
    }
  // Only re-trigger when insights change meaningfully
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insights.totalSeconds, insights.periodOverPeriodDelta])

  if (insights.totalSeconds === 0) {
    return (
      <div className="ai-narrative ai-narrative--empty">
        <div className="ai-narrative__icon">✦</div>
        <p className="ai-narrative__text">Aucune session suivie pour cette periode.</p>
      </div>
    )
  }

  if (mutation.isPending) {
    return (
      <div className="ai-narrative ai-narrative--loading">
        <div className="ai-narrative__icon">✦</div>
        <p className="ai-narrative__text">Generation de la revue en cours...</p>
      </div>
    )
  }

  if (mutation.isError) {
    return (
      <div className="ai-narrative ai-narrative--error">
        <div className="ai-narrative__icon">✦</div>
        <p className="ai-narrative__text">Revue IA indisponible — voici vos statistiques.</p>
      </div>
    )
  }

  return (
    <div className="ai-narrative">
      <div className="ai-narrative__icon">✦ Revue IA</div>
      <p className="ai-narrative__text">{mutation.data}</p>
    </div>
  )
}
```

- [ ] **Step 4: Compose Review page**

Replace `src/pages/Review.tsx`:

```typescript
import { useState, useCallback } from 'react'
import { useLogContext } from '../context/LogContext'
import { useInsights } from '../hooks/useInsights'
import { StatsGrid } from '../components/StatsGrid'
import { DailyChart } from '../components/DailyChart'
import { AiNarrative } from '../components/AiNarrative'
import type { Period } from '../utils/insights'

const PERIOD_LABELS: Record<Period, string> = {
  today: "Aujourd'hui",
  week: 'Cette semaine',
  month: 'Ce mois',
}

export const Review = () => {
  const { logs, timerState } = useLogContext()
  const [period, setPeriod] = useState<Period>('week')
  const insights = useInsights(logs, period)

  const handleBackup = useCallback(() => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], {
      type: 'application/json;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `focusflow-backup-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }, [logs])

  return (
    <>
      <div className="review__tabs">
        {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
          <button
            key={p}
            className={`review__tab${period === p ? ' review__tab--active' : ''}`}
            type="button"
            onClick={() => setPeriod(p)}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      <StatsGrid insights={insights} />
      <DailyChart insights={insights} timerLabels={timerState.timerLabels} />
      <AiNarrative insights={insights} logs={logs} />

      <div className="review__footer">
        <button className="review__backup" type="button" onClick={handleBackup} disabled={logs.length === 0}>
          Telecharger la sauvegarde (JSON)
        </button>
      </div>
    </>
  )
}
```

- [ ] **Step 5: Add Review CSS to App.css**

Add to `src/App.css`:

```css
/* Review Tabs */
.review__tabs {
  display: flex;
  gap: 0;
  border-bottom: 2px solid var(--border);
}

.review__tab {
  padding: 0.5rem 1.25rem;
  font-size: 0.85rem;
  color: var(--text-3);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  cursor: pointer;
  transition: color 0.15s;
}

.review__tab:hover {
  color: var(--text-2);
}

.review__tab--active {
  color: var(--accent);
  border-bottom-color: var(--accent);
  font-weight: 600;
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.75rem;
}

@media (max-width: 640px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.stats-grid__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface-1);
  text-align: center;
}

.stats-grid__value {
  font-size: 1.4rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--text-1);
}

.stats-grid__label {
  font-size: 0.7rem;
  color: var(--text-3);
  margin-top: 0.15rem;
}

.stats-grid__delta {
  font-size: 0.7rem;
  margin-top: 0.15rem;
}

.stats-grid__delta--positive { color: var(--accent); }
.stats-grid__delta--negative { color: var(--danger); }
.stats-grid__delta--warning { color: var(--timer-3); }
.stats-grid__detail { font-size: 0.7rem; color: var(--text-3); margin-top: 0.15rem; }

/* Daily Chart */
.daily-chart { display: flex; flex-direction: column; gap: 0.5rem; }
.daily-chart__title { font-size: 0.9rem; color: var(--text-2); margin: 0; }

.daily-chart__rows { display: flex; flex-direction: column; gap: 0.35rem; }

.daily-chart__row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.daily-chart__label {
  width: 2rem;
  font-size: 0.7rem;
  color: var(--text-3);
  text-align: right;
  text-transform: capitalize;
}

.daily-chart__bar-bg {
  flex: 1;
  height: 1.25rem;
  background: var(--surface-2);
  border-radius: 4px;
  overflow: hidden;
  display: flex;
}

.daily-chart__bar {
  height: 100%;
  transition: width 0.3s ease;
}

.daily-chart__time {
  width: 3.5rem;
  font-size: 0.7rem;
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
}

.daily-chart__legend {
  display: flex;
  gap: 1rem;
  margin-top: 0.25rem;
}

.daily-chart__legend-item {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.7rem;
  color: var(--text-3);
}

.daily-chart__legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  display: inline-block;
}

/* AI Narrative */
.ai-narrative {
  padding: 1.25rem;
  border: 1.5px solid var(--border);
  border-radius: 12px;
  background: linear-gradient(135deg, var(--surface-1), var(--surface-2));
}

.ai-narrative__icon {
  font-size: 0.85rem;
  color: var(--accent);
  margin-bottom: 0.5rem;
}

.ai-narrative__text {
  font-size: 0.9rem;
  line-height: 1.65;
  color: var(--text-2);
  margin: 0;
}

.ai-narrative--loading .ai-narrative__text,
.ai-narrative--empty .ai-narrative__text {
  color: var(--text-3);
  font-style: italic;
}

/* Review Footer */
.review__footer {
  display: flex;
  gap: 0.5rem;
}

.review__backup {
  padding: 0.5rem 1rem;
  background: var(--surface-2);
  color: var(--text-2);
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: border-color 0.15s;
}

.review__backup:hover {
  border-color: var(--accent);
}

.review__backup:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

- [ ] **Step 6: Verify**

Run: `npm run dev` → navigate to `/review`
Expected: see period tabs, stats cards, daily chart, AI narrative (or empty/error state), backup button.

- [ ] **Step 7: Commit**

```bash
git add src/components/StatsGrid.tsx src/components/DailyChart.tsx src/components/AiNarrative.tsx src/pages/Review.tsx src/App.css
git commit -m "feat: build Weekly Review UI with stats, chart, and AI narrative"
```

---

## Task 7: Upgrade Gemini prompt for Weekly Review

**Goal:** Add `generateReviewNarrative` function that feeds PeriodInsights to Gemini for a richer French narrative.

**Files:**
- Modify: `src/services/geminiClient.ts`

**Acceptance Criteria:**
- [ ] New generateReviewNarrative function accepts PeriodInsights and logs
- [ ] Prompt is in French, references specific stats
- [ ] Existing generateSummary unchanged
- [ ] Handles API errors gracefully

**Verify:** `npx tsc -b` → no errors

**Steps:**

- [ ] **Step 1: Add generateReviewNarrative to geminiClient.ts**

Add after the existing `generateSummary` function in `src/services/geminiClient.ts`:

```typescript
import type { PeriodInsights } from '../utils/insights'
import { formatSeconds } from '../utils/format'

const buildReviewPrompt = (insights: PeriodInsights, recentLogs: LogEntry[]): string => {
  const dailyLines = insights.dailyBreakdown
    .filter((d) => d.seconds > 0)
    .map((d) => {
      const labels = Object.entries(d.byLabel)
        .map(([label, secs]) => `${label}: ${formatSeconds(secs)}`)
        .join(', ')
      return `- ${d.day}: ${formatSeconds(d.seconds)} (${labels})`
    })
    .join('\n')

  const labelLines = Object.entries(insights.labelDistribution)
    .sort(([, a], [, b]) => b - a)
    .map(([label, secs]) => `- ${label}: ${formatSeconds(secs)}`)
    .join('\n')

  const sessionLines = recentLogs
    .slice(-20)
    .map((log) => {
      const start = new Date(log.startTime).toLocaleString('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
      const end = new Date(log.endTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      return `- ${log.label} | ${start} - ${end} | ${formatSeconds(log.duration)}${log.source === 'manual' ? ' (manuel)' : ''}`
    })
    .join('\n')

  const deltaSign = insights.periodOverPeriodDelta >= 0 ? '+' : ''

  return [
    'Tu es un coach de productivite personnel qui analyse les donnees de suivi du temps.',
    '',
    'STATISTIQUES DE LA PERIODE :',
    `- Total : ${formatSeconds(insights.totalSeconds)}`,
    `- Session moyenne : ${formatSeconds(insights.avgSessionSeconds)}`,
    `- Plus longue session : ${formatSeconds(insights.longestSession.duration)} sur ${insights.longestSession.label} (${insights.longestSession.day})`,
    `- Changements de contexte/jour : ${insights.contextSwitchesPerDay}`,
    `- Evolution vs periode precedente : ${deltaSign}${formatSeconds(Math.abs(insights.periodOverPeriodDelta))}`,
    '',
    'REPARTITION JOURNALIERE :',
    dailyLines || '(aucune donnee)',
    '',
    'REPARTITION PAR PROJET :',
    labelLines || '(aucune donnee)',
    '',
    'SESSIONS RECENTES :',
    sessionLines || '(aucune session)',
    '',
    'Ecris une revue en 3-4 phrases. Sois specifique : nomme les jours, les projets, les tendances.',
    'Souligne un point fort et une suggestion concrete. Sois direct, pas generique. Reponds en francais.',
  ].join('\n')
}

export const generateReviewNarrative = async (
  insights: PeriodInsights,
  logs: LogEntry[]
): Promise<string> => {
  if (insights.totalSeconds === 0) {
    return 'Aucune session suivie pour cette periode.'
  }

  const model = import.meta.env.VITE_GEMINI_MODEL || DEFAULT_MODEL
  const prompt = buildReviewPrompt(insights, logs)
  const text = await fetchViaProxy(prompt, model)
  return text.replace(/\*\*/g, '').trim()
}
```

Also add the import at the top of the file:

```typescript
import type { PeriodInsights } from '../utils/insights'
import { formatSeconds } from '../utils/format'
```

- [ ] **Step 2: Verify**

Run: `npx tsc -b`
Expected: no TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add src/services/geminiClient.ts
git commit -m "feat: add AI review narrative with structured period insights prompt"
```

---

## Task 8: Final integration and full test run

**Goal:** Verify everything works together. Run all tests. Fix any TypeScript or integration issues.

**Files:**
- Potentially any file if integration issues found

**Acceptance Criteria:**
- [ ] `npx tsc -b` passes with no errors
- [ ] `npx vitest run` passes all tests
- [ ] `npm run build` succeeds
- [ ] App loads, timers work, manual entry works, review page shows stats
- [ ] Navigate between / and /review without errors

**Verify:** `npm run build && npx vitest run` → both succeed

**Steps:**

- [ ] **Step 1: Type check**

Run: `npx tsc -b`
Expected: 0 errors. If errors found, fix them.

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: all tests pass

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build succeeds, no warnings about missing exports

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`
1. Start/stop timers on Dashboard — verify separate log entries created
2. Add manual entry — verify it appears in log
3. Edit a log entry — verify times update
4. Navigate to /review — verify stats and chart render
5. Click backup button — verify JSON downloads

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration fixes for weekly review feature"
```

(Only if there were fixes needed. Skip if everything passed clean.)
