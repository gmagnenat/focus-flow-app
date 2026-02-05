# FocusFlow App - Refactoring Plan

## Overview
Refactor the monolithic App.tsx (385 lines) into a maintainable, testable architecture by:
- Splitting state into separate domains
- Replacing refs with state-based tracking
- Extracting utilities, services, and custom hooks
- Adding memoization for performance

**Goal**: Reduce App.tsx to ~100-150 lines of composition/layout code

---

## Phase 1: Extract Pure Utilities ✅ TODO

**Goal**: Move pure functions to separate files for easy unit testing

### Step 1.1: Create format utilities
**File**: `src/utils/format.ts`

```typescript
export const formatSeconds = (seconds: number): string => {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}
```

**Extract from**: App.tsx lines ~195-202

---

### Step 1.2: Create log helper utilities
**File**: `src/utils/logHelpers.ts`

```typescript
import type { LogEntry } from '../types'

export const getLatestLogIndex = (logs: LogEntry[], timerId: number): number => {
  for (let i = logs.length - 1; i >= 0; i--) {
    if (logs[i].timerId === timerId) {
      return i
    }
  }
  return -1
}

export const buildLogLabel = (label: string, timerId: number): string => {
  return label.trim() || `Timer ${timerId}`
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
    duration: 0,
  }
}
```

**Extract from**: App.tsx lines ~127-144

---

### Step 1.3: Create validation utilities
**File**: `src/utils/validators.ts`

```typescript
import type { LogEntry } from '../types'

export const isValidTimerValues = (
  obj: unknown
): obj is Record<number, number> => {
  if (!obj || typeof obj !== 'object') return false
  const values = Object.values(obj)
  return values.every((v) => typeof v === 'number' && v >= 0)
}

export const isValidLogs = (arr: unknown): arr is LogEntry[] => {
  if (!Array.isArray(arr)) return false
  return arr.every(
    (item) =>
      item &&
      typeof item === 'object' &&
      typeof item.id === 'string' &&
      typeof item.timerId === 'number' &&
      typeof item.label === 'string' &&
      typeof item.startTime === 'number' &&
      typeof item.duration === 'number'
  )
}

export const isValidTimerLabels = (
  obj: unknown
): obj is Record<number, string> => {
  if (!obj || typeof obj !== 'object') return false
  const values = Object.values(obj)
  return values.every((v) => typeof v === 'string')
}
```

**Extract from**: App.tsx lines ~27-54

---

### Step 1.4: Create storage utilities
**File**: `src/utils/storage.ts`

```typescript
import { isValidTimerValues, isValidLogs, isValidTimerLabels } from './validators'

const STORAGE_KEY = 'focus-flow-state'

export interface StoredState {
  activeTimerId: 1 | 2 | 3 | null
  timerLabels: Record<number, string>
  timerValues: Record<number, number>
  logs: LogEntry[]
  lastSavedAt: number
}

export const loadState = (): StoredState | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null

    const parsed = JSON.parse(stored)
    
    // Validate structure
    if (
      parsed &&
      typeof parsed === 'object' &&
      (parsed.activeTimerId === null ||
        parsed.activeTimerId === 1 ||
        parsed.activeTimerId === 2 ||
        parsed.activeTimerId === 3) &&
      isValidTimerLabels(parsed.timerLabels) &&
      isValidTimerValues(parsed.timerValues) &&
      isValidLogs(parsed.logs) &&
      typeof parsed.lastSavedAt === 'number'
    ) {
      return parsed as StoredState
    }
    return null
  } catch {
    return null
  }
}

export const saveState = (state: StoredState): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (e) {
    console.error('Failed to save state:', e)
  }
}
```

**Extract from**: App.tsx lines ~56-93

---

### Step 1.5: Update App.tsx imports
**File**: `src/App.tsx`

```typescript
import { formatSeconds } from './utils/format'
import { getLatestLogIndex, buildLogLabel, buildLogEntry } from './utils/logHelpers'
import { isValidTimerValues, isValidLogs, isValidTimerLabels } from './utils/validators'
import { loadState, saveState, type StoredState } from './utils/storage'
```

**Delete**: All the extracted function definitions from App.tsx

**Checkpoint**: Run `pnpm dev` and verify app still works

---

## Phase 2: Create TimerService ✅ TODO

**Goal**: Extract business logic into testable service class

### Step 2.1: Create TimerService
**File**: `src/services/TimerService.ts`

```typescript
import type { LogEntry } from '../types'
import { getLatestLogIndex, buildLogEntry } from '../utils/logHelpers'

export interface TimeProvider {
  now: () => number
}

export class TimerService {
  constructor(private timeProvider: TimeProvider = { now: () => Date.now() }) {}

  calculateElapsedSeconds(startTime: number, endTime: number): number {
    return Math.floor((endTime - startTime) / 1000)
  }

  commitActiveTimer(
    activeTimerId: number | null,
    startTime: number | null,
    logs: LogEntry[],
    timerValues: Record<number, number>,
    timerLabels: Record<number, string>,
    timestamp: number
  ): { logs: LogEntry[]; timerValues: Record<number, number> } {
    if (activeTimerId === null || startTime === null) {
      return { logs, timerValues }
    }

    const elapsedSeconds = this.calculateElapsedSeconds(startTime, timestamp)
    const updatedLogs = [...logs]
    const logIndex = getLatestLogIndex(updatedLogs, activeTimerId)

    if (logIndex === -1) {
      const entry = buildLogEntry(
        activeTimerId,
        timerLabels[activeTimerId],
        startTime
      )
      entry.duration += elapsedSeconds
      updatedLogs.push(entry)
    } else {
      updatedLogs[logIndex] = {
        ...updatedLogs[logIndex],
        duration: updatedLogs[logIndex].duration + elapsedSeconds,
      }
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
        return {
          ...entry,
          duration: entry.duration + (now - activeStartTime) / 1000,
        }
      }
      return entry
    })
  }
}

// Default instance
export const timerService = new TimerService()
```

**Checkpoint**: Service created, not yet integrated

---

## Phase 3: Split State Domains ✅ TODO

**Goal**: Replace single AppState with separate timer and log states

### Step 3.1: Update types.ts
**File**: `src/types.ts`

```typescript
export interface LogEntry {
  id: string
  timerId: number
  label: string
  startTime: number
  duration: number
}

// New: Separate timer state interface
export interface TimerState {
  activeTimerId: 1 | 2 | 3 | null
  activeStartTime: number | null // NEW: replaces activeStartRef
  timerLabels: Record<number, string>
  timerValues: Record<number, number>
  lastSavedAt: number
}

// Keep for backwards compatibility with storage
export interface AppState {
  activeTimerId: 1 | 2 | 3 | null
  timerLabels: Record<number, string>
  timerValues: Record<number, number>
  logs: LogEntry[]
  lastSavedAt: number
}
```

---

### Step 3.2: Refactor state in App.tsx
**File**: `src/App.tsx`

Replace:
```typescript
const [state, setState] = useState<AppState>({...})
const activeStartRef = useRef<number | null>(null)
```

With:
```typescript
const [timerState, setTimerState] = useState<TimerState>({
  activeTimerId: null,
  activeStartTime: null, // No more ref!
  timerLabels: { 1: '', 2: '', 3: '' },
  timerValues: { 1: 0, 2: 0, 3: 0 },
  lastSavedAt: Date.now(),
})

const [logs, setLogs] = useState<LogEntry[]>([])
const [now, setNow] = useState(Date.now())
```

**Note**: Remove `activeStartRef` entirely - use state instead!

---

### Step 3.3: Update handlers to use split state

Update `handleToggleTimer`:
```typescript
const handleToggleTimer = useCallback(
  (timerId: 1 | 2 | 3) => {
    const timestamp = Date.now()
    setNow(timestamp)

    const previousActiveStart = timerState.activeStartTime

    if (timerState.activeTimerId === timerId) {
      // Stopping the timer
      const result = timerService.commitActiveTimer(
        timerState.activeTimerId,
        previousActiveStart,
        logs,
        timerState.timerValues,
        timerState.timerLabels,
        timestamp
      )
      
      setLogs(result.logs)
      setTimerState({
        ...timerState,
        activeTimerId: null,
        activeStartTime: null,
        timerValues: result.timerValues,
        lastSavedAt: timestamp,
      })
    } else {
      // Starting a new timer
      const result = timerService.commitActiveTimer(
        timerState.activeTimerId,
        previousActiveStart,
        logs,
        timerState.timerValues,
        timerState.timerLabels,
        timestamp
      )
      
      const newLog = buildLogEntry(timerId, timerState.timerLabels[timerId], timestamp)
      
      setLogs([...result.logs, newLog])
      setTimerState({
        ...timerState,
        activeTimerId: timerId,
        activeStartTime: timestamp,
        timerValues: result.timerValues,
        lastSavedAt: timestamp,
      })
    }
  },
  [timerState, logs]
)
```

---

### Step 3.4: Update persistence to combine states

Update save effect:
```typescript
useEffect(() => {
  if (!hasHydrated.current) return

  const combinedState: AppState = {
    activeTimerId: timerState.activeTimerId,
    timerLabels: timerState.timerLabels,
    timerValues: timerState.timerValues,
    logs,
    lastSavedAt: timerState.lastSavedAt,
  }

  saveState(combinedState)
}, [timerState, logs])
```

Update hydration effect:
```typescript
useEffect(() => {
  const stored = loadState()
  
  if (stored) {
    const timestamp = Date.now()
    
    // Split the loaded state
    setTimerState({
      activeTimerId: stored.activeTimerId,
      activeStartTime: stored.activeTimerId ? timestamp : null, // Will calculate gap
      timerLabels: stored.timerLabels,
      timerValues: stored.timerValues,
      lastSavedAt: timestamp,
    })
    
    setLogs(stored.logs)
    
    // Handle gap calculation if timer was active...
    // (Complex logic stays for now, will move to hook later)
  }
  
  hasHydrated.current = true
}, [])
```

**Checkpoint**: Run app, verify timers and logs work independently

---

## Phase 4: Add Memoization ✅ TODO

**Goal**: Optimize computed values

### Step 4.1: Memoize timer seconds calculation

Replace inline calculations with:
```typescript
const timer1Seconds = useMemo(
  () => timerService.calculateTimerSeconds(
    1,
    timerState.timerValues,
    timerState.activeTimerId,
    timerState.activeStartTime,
    now
  ),
  [timerState.timerValues, timerState.activeTimerId, timerState.activeStartTime, now]
)

// Same for timer2Seconds and timer3Seconds
```

---

### Step 4.2: Memoize display logs

Replace inline map with:
```typescript
const displayLogs = useMemo(
  () => timerService.calculateDisplayLogs(
    logs,
    timerState.activeTimerId,
    timerState.activeStartTime,
    now
  ),
  [logs, timerState.activeTimerId, timerState.activeStartTime, now]
)
```

**Checkpoint**: Verify performance improvement (fewer recalculations)

---

## Phase 5: Extract Custom Hooks ✅ TODO

**Goal**: Move complex logic out of App.tsx

### Step 5.1: Create usePersistence hook
**File**: `src/hooks/usePersistence.ts`

```typescript
import { useEffect, useRef } from 'react'
import { loadState, saveState, type StoredState } from '../utils/storage'
import type { TimerState } from '../types'
import type { LogEntry } from '../types'

interface UsePersistenceReturn {
  isHydrated: boolean
}

export const usePersistence = (
  timerState: TimerState,
  logs: LogEntry[],
  setTimerState: (state: TimerState) => void,
  setLogs: (logs: LogEntry[]) => void,
  setNow: (now: number) => void
): UsePersistenceReturn => {
  const hasHydrated = useRef(false)

  // Hydration on mount
  useEffect(() => {
    const stored = loadState()
    
    if (stored) {
      const timestamp = Date.now()
      
      // Complex gap calculation logic here...
      // (Move the 44-line hydration logic from App.tsx)
      
      // Split and set state
      setTimerState({
        activeTimerId: stored.activeTimerId,
        activeStartTime: stored.activeTimerId ? timestamp : null,
        timerLabels: stored.timerLabels,
        timerValues: stored.timerValues,
        lastSavedAt: timestamp,
      })
      
      setLogs(stored.logs)
      setNow(timestamp)
    } else {
      setNow(Date.now())
    }

    hasHydrated.current = true
  }, [])

  // Auto-save on state changes
  useEffect(() => {
    if (!hasHydrated.current) return

    const combinedState: StoredState = {
      activeTimerId: timerState.activeTimerId,
      timerLabels: timerState.timerLabels,
      timerValues: timerState.timerValues,
      logs,
      lastSavedAt: timerState.lastSavedAt,
    }

    saveState(combinedState)
  }, [timerState, logs])

  return { isHydrated: hasHydrated.current }
}
```

---

### Step 5.2: Create useTimerState hook
**File**: `src/hooks/useTimerState.ts`

```typescript
import { useState, useCallback, useMemo } from 'react'
import type { TimerState, LogEntry } from '../types'
import { timerService } from '../services/TimerService'
import { buildLogEntry } from '../utils/logHelpers'

interface UseTimerStateReturn {
  timerState: TimerState
  logs: LogEntry[]
  toggleTimer: (timerId: 1 | 2 | 3) => void
  updateTimerLabel: (timerId: 1 | 2 | 3, value: string) => void
  updateLogLabel: (logId: string, value: string) => void
  validateLogLabel: (logId: string) => void
  getTimerSeconds: (timerId: 1 | 2 | 3, now: number) => number
  getDisplayLogs: (now: number) => LogEntry[]
}

export const useTimerState = (
  initialTimerState: TimerState,
  initialLogs: LogEntry[]
): UseTimerStateReturn => {
  const [timerState, setTimerState] = useState(initialTimerState)
  const [logs, setLogs] = useState(initialLogs)

  const toggleTimer = useCallback(
    (timerId: 1 | 2 | 3) => {
      const timestamp = Date.now()
      const previousActiveStart = timerState.activeStartTime

      if (timerState.activeTimerId === timerId) {
        // Stopping
        const result = timerService.commitActiveTimer(
          timerState.activeTimerId,
          previousActiveStart,
          logs,
          timerState.timerValues,
          timerState.timerLabels,
          timestamp
        )
        
        setLogs(result.logs)
        setTimerState({
          ...timerState,
          activeTimerId: null,
          activeStartTime: null,
          timerValues: result.timerValues,
          lastSavedAt: timestamp,
        })
      } else {
        // Starting
        const result = timerService.commitActiveTimer(
          timerState.activeTimerId,
          previousActiveStart,
          logs,
          timerState.timerValues,
          timerState.timerLabels,
          timestamp
        )
        
        const newLog = buildLogEntry(timerId, timerState.timerLabels[timerId], timestamp)
        
        setLogs([...result.logs, newLog])
        setTimerState({
          ...timerState,
          activeTimerId: timerId,
          activeStartTime: timestamp,
          timerValues: result.timerValues,
          lastSavedAt: timestamp,
        })
      }
    },
    [timerState, logs]
  )

  const updateTimerLabel = useCallback(
    (timerId: 1 | 2 | 3, value: string) => {
      setTimerState({
        ...timerState,
        timerLabels: {
          ...timerState.timerLabels,
          [timerId]: value,
        },
      })
    },
    [timerState]
  )

  const updateLogLabel = useCallback(
    (logId: string, value: string) => {
      setLogs(logs.map(log => 
        log.id === logId ? { ...log, label: value } : log
      ))
    },
    [logs]
  )

  const validateLogLabel = useCallback(
    (logId: string) => {
      setLogs(logs.map(log => {
        if (log.id === logId && !log.label.trim()) {
          return { ...log, label: `Timer ${log.timerId}` }
        }
        return log
      }))
    },
    [logs]
  )

  const getTimerSeconds = useCallback(
    (timerId: 1 | 2 | 3, now: number) => {
      return timerService.calculateTimerSeconds(
        timerId,
        timerState.timerValues,
        timerState.activeTimerId,
        timerState.activeStartTime,
        now
      )
    },
    [timerState]
  )

  const getDisplayLogs = useCallback(
    (now: number) => {
      return timerService.calculateDisplayLogs(
        logs,
        timerState.activeTimerId,
        timerState.activeStartTime,
        now
      )
    },
    [logs, timerState.activeTimerId, timerState.activeStartTime]
  )

  return {
    timerState,
    logs,
    toggleTimer,
    updateTimerLabel,
    updateLogLabel,
    validateLogLabel,
    getTimerSeconds,
    getDisplayLogs,
  }
}
```

---

### Step 5.3: Refactor App.tsx to use hooks

```typescript
function App() {
  const [now, setNow] = useState(Date.now())

  const {
    timerState,
    logs,
    toggleTimer,
    updateTimerLabel,
    updateLogLabel,
    validateLogLabel,
    getTimerSeconds,
    getDisplayLogs,
  } = useTimerState(
    {
      activeTimerId: null,
      activeStartTime: null,
      timerLabels: { 1: '', 2: '', 3: '' },
      timerValues: { 1: 0, 2: 0, 3: 0 },
      lastSavedAt: Date.now(),
    },
    []
  )

  const { isHydrated } = usePersistence(
    timerState,
    logs,
    (state) => { /* Need to expose setState from hook */ },
    (logs) => { /* Need to expose setLogs from hook */ },
    setNow
  )

  // Timer tick
  useEffect(() => {
    if (timerState.activeTimerId === null) return

    const interval = setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => clearInterval(interval)
  }, [timerState.activeTimerId])

  const displayLogs = useMemo(
    () => getDisplayLogs(now),
    [getDisplayLogs, now]
  )

  return (
    <div className="container">
      <div className="timer-grid">
        <TimerCard
          timerId={1}
          label={timerState.timerLabels[1]}
          isActive={timerState.activeTimerId === 1}
          formattedTime={formatSeconds(getTimerSeconds(1, now))}
          onToggle={toggleTimer}
          onLabelChange={updateTimerLabel}
        />
        {/* Timer 2 and 3... */}
      </div>
      
      <LogList
        logs={displayLogs}
        formatDuration={formatSeconds}
        onLabelChange={updateLogLabel}
        onLabelBlur={validateLogLabel}
      />
    </div>
  )
}
```

**Note**: Need to refactor hooks to expose setState functions

**Checkpoint**: App.tsx should now be ~100-150 lines

---

## Phase 6: Final Polish ✅ TODO

### Step 6.1: Add TypeScript strict mode
Ensure all types are properly defined, no `any` types

### Step 6.2: Add JSDoc comments
Document all exported functions, especially in services and hooks

### Step 6.3: Clean up console.logs
Remove any debug logging

### Step 6.4: Update README
Document new architecture and folder structure

---

## Success Metrics

- [ ] App.tsx reduced from 385 to ~100-150 lines
- [ ] All utilities are pure functions (easily testable)
- [ ] No more ref synchronization issues (activeStartTime in state)
- [ ] State split prevents unnecessary re-renders
- [ ] Memoization prevents excessive recalculations
- [ ] Business logic isolated in TimerService (testable)
- [ ] Complex hydration logic isolated in usePersistence
- [ ] All handlers isolated in useTimerState
- [ ] Ready for unit tests

---

## Testing Strategy (Future)

After refactoring:

1. **Unit tests for utilities** (`utils/*.ts`)
   - Pure functions, easy to test
   - Test formatSeconds, validators, log helpers

2. **Unit tests for TimerService**
   - Mock TimeProvider
   - Test calculateElapsedSeconds
   - Test commitActiveTimer logic

3. **Integration tests for hooks**
   - Test useTimerState with React Testing Library
   - Test usePersistence with mock localStorage

4. **E2E tests for App**
   - Test full user flows
   - Start/stop timers
   - Label editing
   - Persistence across refreshes

---

## Notes

- Each phase should be tested before moving to next
- Commit after each phase completes successfully
- Keep dev server running to catch errors immediately
- Use TypeScript errors as guide for missing updates
