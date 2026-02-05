# Summary Generation Plan (Gemini)

## Goal
Add summary generation using the Gemini Generative Language API with short bullets and total time per grouped project.

## Model + Env
- Model: `gemini-2-flash` (default)
- API key: `VITE_GEMINI_API_KEY`
- Optional override: `VITE_GEMINI_MODEL`

## Step 1: Gemini client helper
- Create `src/services/geminiClient.ts`
- Export `generateSummary(logs)`
- Build a prompt that requests:
  - short bullet list
  - grouping by similar project/label
  - total time per group
- Send request to:
  - `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
- Handle empty logs and API errors gracefully.

## Step 2: Query wiring
- Add `QueryClientProvider` in `src/main.tsx`.
- Use `useMutation` in `src/App.tsx` for summary generation.

## Step 3: Summary UI
- Replace placeholder with:
  - “Generate Summary” button
  - loading + error states
  - bullet list output
- Show a warning if the API key is missing (non-blocking).

## Step 4: Prompt data formatting
- Map logs into a small payload:
  - `label`, `durationSeconds`, `startTime`
- Truncate to recent N logs if needed (e.g., 200).

## Step 5: Styling
- Add minimal styles in `src/App.css` for the button and summary list to match the dashboard theme.
