# PRD: FocusFlow MVP (Phase 1)

## 1. Executive Summary
FocusFlow is a high-performance, minimalist productivity web application. It uses a declarative React UI to manage three mutually exclusive timers. The app prioritizes data integrity via TypeScript and resilience via "Time Gap" recovery logic, ensuring time is never lost due to browser refreshes, system sleep, or crashes.

## 2. Technical Stack
- Bundler: Vite
- Library: React 18+ (Functional Components with Hooks)
- Language: TypeScript (Strict Mode)
- Storage: Browser LocalStorage API
- Styling: Tailwind CSS

## 3. Functional Requirements

### 3.1 Declarative Timer Management
- Mutual Exclusivity: A central state ensures that if Timer A starts, Timer B and C are automatically paused.

- Dynamic Labels: Each of the 3 timer slots has an editable label that serves as the default name for generated logs.

### 3.2 Resilience & Time Gap Recovery
- System Clock Reliance: The app calculates duration by comparing timestamps rather than simple counters:

$$Duration = CurrentTime - StartTime$$

- Initialization Sync: Upon app mount, the system compares the lastSavedAt timestamp in LocalStorage with the current Date.now(). If a timer was active during the last session, the "Gap" is automatically calculated and added to the total.

### 3.3 Activity Logging & Inline Editing
- Persistent Logs: Every "Start" event creates a new LogEntry. Logs are stored in a reactive array and mirrored to LocalStorage.

- Two-Way Bound Editing: Users can edit log descriptions directly in the history list. Changes update both the application state and LocalStorage immediately.

- Ghost Log Prevention: Empty labels default to "Unnamed Task [ID]" to ensure data continuity for the LLM.

### 3.4 The 17:30 "Night Watchman"
- Monitoring Side-Effect: A useEffect hook runs a check every 60 seconds.- Trigger: If the system time is $\ge$ 17:30 and activeTimerId is not null, a browser alert or non-intrusive toast notification is triggered.

### 3.5 LLM Summary Export
- Semantic Aggregator: A useMemo hook compiles the logs into a structured text prompt.

- Format: Optimized for copy-pasting into LLMs (ChatGPT/Gemini) for instant project categorization and daily reporting.

## 4. Technical Architecture
### 4.1 Data Schema (TypeScript)
```ts
export type TimerId = 1 | 2 | 3 | null;

export interface LogEntry {
  id: string;
  timerId: number;
  label: string;
  startTime: number; // Unix timestamp
  duration: number;  // Cumulative seconds
}

export interface AppState {
  activeTimerId: TimerId;
  timerValues: Record<number, number>; // { 1: sec, 2: sec, 3: sec }
  logs: LogEntry[];
  lastSavedAt: number; // Used for gap calculation
}
```

### 4.2 Component Hierarchy
- App.tsx: Main entry point; manages global state, useEffect for persistence, and the 17:30 check.

- TimerCard.tsx: Displays time for a specific slot, handles Start/Stop logic.

- LogList.tsx: Renders the history of sessions.

- LogItem.tsx: Individual editable log entry using a controlled input.

- SummaryOutput.tsx: Generates the final text for the LLM.

## 5. Phase 1 Success Metrics
- Persistence: A page refresh does not reset the clock or lose current progress.

- Frictionless UX: Switching between tasks requires exactly one click.

- Clean Data: No "Ghost Logs" (empty descriptions) reach the final summary export.