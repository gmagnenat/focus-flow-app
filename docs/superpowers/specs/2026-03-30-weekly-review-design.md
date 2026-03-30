# FocusFlow Weekly Review — Design Spec

## Overview

Transform FocusFlow from a daily timer app into a personal reflection tool by adding:
1. **Manual log entry** — backfill forgotten timer sessions
2. **Weekly Review screen** — stats, charts, and AI-powered narrative
3. **Insights engine** — pure TypeScript analytics over time tracking data

Prior design: `~/.gstack/projects/gmagnenat-focus-flow-app/gwenael-develop-design-20260330-112315.md` (office-hours, APPROVED)

## Constraints

- Client-side only. localStorage persistence. No backend DB.
- No auth, no team features. Personal-scale.
- All UI text in French. AI prompts and responses in French.
- Must not add friction to existing 3-timer daily workflow.
- Netlify deployment. Gemini proxy via Netlify Functions.

## Architecture: Clean Split

Approach B from brainstorming. Extract concerns into focused modules, each testable independently.

### Data Model

**Current LogEntry:**
```typescript
{ id: string, timerId: number, label: string, startTime: number, duration: number }
```

**New LogEntry:**
```typescript
interface LogEntry {
  id: string
  timerId: number
  label: string
  startTime: number
  endTime: number            // real end timestamp
  duration: number           // (endTime - startTime) / 1000, in seconds
  source: 'timer' | 'manual' // how it was created
  note?: string              // optional, for manual entries
}
```

**Behavioral change:** Timer toggle now creates a new LogEntry per start/stop block (not accumulating into one entry). Switching Timer 1 → Timer 2 → Timer 1 creates 3 entries with real start/end times. This enables accurate timeline views and AI pattern detection.

**`timerValues` stays unchanged** for daily total display. It accumulates across blocks within the session.

### Migration Runner

Versioned migration system in `utils/storage.ts`:

```typescript
const SCHEMA_VERSION_KEY = 'focusflow_schema_version'
const BACKUP_KEY = 'focusflow_backup'

const migrations = [
  // v0 → v1: add endTime, source to existing LogEntry
  (state: AppState): AppState => ({
    ...state,
    logs: state.logs.map(log => ({
      ...log,
      endTime: log.startTime + (log.duration * 1000),
      source: 'timer' as const,
    })),
  }),
]
```

Safety: snapshot current state to `focusflow_backup` before each migration. On failure (try/catch), restore from backup and surface error.

### File Structure

```
src/
├── main.tsx                    # MODIFY: RouterProvider, route tree
├── App.tsx                     # MODIFY: layout shell (nav bar + Outlet)
├── types.ts                    # MODIFY: extend LogEntry
├── routes.ts                   # NEW: TanStack Router route definitions
├── context/
│   └── LogContext.tsx           # NEW: shared log/timer state
├── pages/
│   ├── Dashboard.tsx            # NEW: extracted from current App.tsx
│   └── Review.tsx               # NEW: Weekly Review screen
├── components/
│   ├── TimerCard.tsx            # KEEP
│   ├── LogItem.tsx              # KEEP
│   ├── LogList.tsx              # KEEP
│   ├── ManualEntryForm.tsx      # NEW
│   ├── LogItemEdit.tsx          # NEW: inline edit form for today's entries
│   ├── StatsGrid.tsx            # NEW
│   ├── DailyChart.tsx           # NEW
│   └── AiNarrative.tsx          # NEW
├── hooks/
│   ├── useTimerState.ts         # MODIFY: block-based logging
│   ├── usePersistence.ts        # MODIFY: use migration runner
│   └── useInsights.ts           # NEW
├── utils/
│   ├── format.ts                # KEEP
│   ├── logHelpers.ts            # MODIFY
│   ├── storage.ts               # MODIFY: add migration runner
│   ├── validators.ts            # MODIFY
│   └── insights.ts              # NEW
├── services/
│   ├── TimerService.ts          # MODIFY
│   └── geminiClient.ts          # MODIFY
└── utils/__tests__/
    ├── insights.test.ts         # NEW
    ├── storage.test.ts          # NEW
    └── validators.test.ts       # NEW
```

### Routing

TanStack Router (`@tanstack/react-router` already installed, not yet configured):

- `main.tsx`: wrap app in `RouterProvider`
- `routes.ts`: define `/` (Dashboard) and `/review` (Review)
- `App.tsx`: root layout with nav bar + `<Outlet />`
- `LogContext`: provides `logs`, `setLogs`, `timerState`, `setTimerState` to both routes

### Manual Entry Form

Collapsible form on Dashboard, below timers:

- **Fields:** Timer selector dropdown, date (today/yesterday), start time (HH:MM), end time (HH:MM), optional note
- **Validation:** end > start, no same-timer overlaps (different timers may overlap). On overlap: inline error showing conflicting entry's time range.
- **Creates:** LogEntry with `source: 'manual'`, computed `duration`, `endTime` from inputs
- **UX:** Form resets after successful submission. Duration preview shown before submit.

### Log Entry Editing

Inline editing for today's log entries:

- **Scope:** Today's entries only. Historical entries are read-only.
- **UX:** Each LogItem gets an edit icon button. Clicking it expands the entry into an inline form with: label input, start time (HH:MM), end time (HH:MM), note input, save/cancel buttons.
- **Validation:** Same rules as manual entry — end > start, no same-timer overlaps on the same timer.
- **On save:** Updates the LogEntry in place (same `id`, same `source`). Recalculates `duration` from new times.
- **Component:** `LogItemEdit.tsx` — inline edit form rendered inside the log list when editing.

### Insights Engine

Pure TypeScript in `utils/insights.ts`:

```typescript
interface PeriodInsights {
  totalSeconds: number
  avgSessionSeconds: number
  longestSession: { duration: number; label: string; day: string }
  contextSwitchesPerDay: number
  dailyBreakdown: Array<{ day: string; seconds: number; byLabel: Record<string, number> }>
  labelDistribution: Record<string, number>
  periodOverPeriodDelta: number
}

function computeInsights(
  logs: LogEntry[],
  start: Date, end: Date,
  priorStart: Date, priorEnd: Date
): PeriodInsights
```

Same function for all tabs, different date ranges:
- **Aujourd'hui:** today vs yesterday
- **Cette semaine:** current week (Mon-Sun) vs prior week
- **Ce mois:** current month vs prior month

**Context switch:** any consecutive entries on the same day with different labels.

**Dependencies:** date-fns with `fr` locale for Monday-start weeks and month boundaries.

**React hook:** `useInsights(logs, period)` calls `computeInsights` with memoization.

### Weekly Review UI

`pages/Review.tsx` composes:

1. **Period tabs:** Aujourd'hui / Cette semaine / Ce mois (local state, not routes)
2. **StatsGrid:** 4 cards (total suivi, session moyenne, plus longue session, changements/jour) with period-over-period delta. Responsive: 4-col desktop, 2x2 mobile.
3. **DailyChart:** CSS flex horizontal stacked bars per day, colored by timer label. Legend below. Min-width 2px for short sessions. Tooltip on hover for exact duration.
4. **AiNarrative:** Gemini-powered French narrative card with gradient background.
   - Loading: "Generation de la revue en cours..."
   - Error: "Revue IA indisponible — voici vos statistiques." Show stats without narrative.
   - Empty: "Aucune session suivie cette semaine."
5. **JSON backup:** Download button exports full `LogEntry[]` as JSON file.

### Gemini Prompt (Weekly Review)

New `generateReviewNarrative` function in `geminiClient.ts`:

```
Tu es un coach de productivite personnel qui analyse les donnees de suivi du temps.

STATISTIQUES DE LA SEMAINE :
- Total : {totalSeconds formatted}
- Session moyenne : {avgSessionSeconds formatted}
- Plus longue session : {longestSession.duration} sur {longestSession.label} ({longestSession.day})
- Changements de contexte/jour : {contextSwitchesPerDay}
- Evolution vs semaine precedente : {periodOverPeriodDelta formatted}

REPARTITION JOURNALIERE :
{dailyBreakdown formatted}

REPARTITION PAR PROJET :
{labelDistribution formatted}

SESSIONS RECENTES :
{last 20 raw log entries}

Ecris une revue hebdomadaire en 3-4 phrases. Sois specifique — nomme les jours,
les projets, les tendances. Souligne un point fort et une suggestion. Sois direct,
pas generique. Reponds en francais.
```

Existing `generateSummary` function stays unchanged.

### Testing

**Setup:** Vitest (Vite-native, zero config).

**Test files:**
- `utils/__tests__/insights.test.ts`: empty logs, single day, multi-day, context switches, delta computation, midnight crossings
- `utils/__tests__/storage.test.ts`: v0→v1 migration, backup creation, corrupt data, idempotency
- `utils/__tests__/validators.test.ts`: end>start, same-timer overlap, cross-timer allowed

**Not tested (for now):** component rendering, Gemini API calls.

### New Dependencies

- `date-fns` — tree-shakeable date utilities for week/month calculations
- `vitest` (dev) — test runner

## Implementation Order

Tasks with dependency graph:

1. **Data model & migration** (no deps)
2. **Routing & app structure** (blocked by #1)
3. **Insights engine** (blocked by #1, parallel with #2)
4. **Manual entry form + log editing** (blocked by #2)
5. **Weekly Review UI** (blocked by #2, #3)
6. **Gemini prompt upgrade** (blocked by #3)
7. **Vitest setup & tests** (blocked by #1, #3)

Tasks #2 and #3 can run in parallel. Tasks #4, #5, #6, #7 can partially overlap.

## Success Criteria

- [ ] Manual entry: add missed session with label, start/end, note
- [ ] Log editing: edit any of today's entries (label, times, note) inline
- [ ] Weekly Review: stats, daily chart, AI narrative for day/week/month
- [ ] AI narrative references specific days, labels, patterns (not generic)
- [ ] Existing timer workflow untouched — no added friction
- [ ] Migration preserves existing data
- [ ] JSON backup export works
- [ ] All Vitest tests pass
- [ ] App feels polished: consistent typography, color, spacing
