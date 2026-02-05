# FocusFlow Phase 1 Plan

## Brick 1: Project skeleton + types
- Validate Vite + React + TS + Tailwind setup.
- Add `types.ts` with `TimerId`, `LogEntry`, `AppState` from PRD.
- Stub `App.tsx` with initial state + layout placeholders.

## Brick 2: LocalStorage persistence
- Implement load on mount: hydrate `AppState` from LocalStorage or default state.
- Implement save effect on state changes (`lastSavedAt` included).
- Add minimal error guards for corrupted/empty storage.

## Brick 3: Timer core logic (mutual exclusivity)
- Create `TimerCard` component (display, start/stop button).
- App-level action to set `activeTimerId` and pause others.
- Tick logic: derive active timer value from timestamps.

## Brick 4: Time Gap recovery
- On init, compute `gap = now - lastSavedAt` if active timer exists.
- Add `gap` to active timer value + log entry duration.
- Update `lastSavedAt`.

## Brick 5: Logs + ghost prevention
- On “Start”, create new `LogEntry` with label fallback to `Unnamed Task [ID]`.
- Add `LogList` + `LogItem` for inline editing.
- Two-way binding updates state and LocalStorage.

## Brick 6: 17:30 Watchman
- `useEffect` interval (60s) checks time and `activeTimerId`.
- Trigger `alert` or toast (simple alert first).

## Brick 7: LLM Summary Export
- `SummaryOutput` component with `useMemo` aggregation.
- Format per PRD for copy-paste.
