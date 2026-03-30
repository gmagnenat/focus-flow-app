# CLAUDE.md

This file provides guidance to Claude when working in this repository. It mirrors `AGENTS.md` and user-specific working rules so behavior stays consistent across agents.

## Project overview

Web Quality Skills is a collection of Agent Skills for optimizing web projects based on Google Lighthouse guidelines. Skills follow the [Agent Skills specification](https://agentskills.io/specification).

## Directory structure

```text
focus-flow-app/
├── README.md                    # Project documentation
├── AGENTS.md                    # Cursor/Codex guidance
├── CLAUDE.md                    # Claude guidance (this file)
├── LICENSE                      # MIT License
└── skills/
    ├── web-quality-audit/       # Comprehensive audit skill
    │   ├── SKILL.md
    │   ├── scripts/
    │   └── references/
    ├── performance/             # Performance optimization
    │   ├── SKILL.md
    │   ├── scripts/
    │   └── references/
    ├── accessibility/           # Accessibility guidelines
    │   ├── SKILL.md
    │   ├── scripts/
    │   └── references/
    ├── seo/                     # SEO best practices
    │   ├── SKILL.md
    │   ├── scripts/
    │   └── references/
    ├── best-practices/          # General best practices
    │   ├── SKILL.md
    │   ├── scripts/
    │   └── references/
    └── core-web-vitals/         # CWV-specific optimization
        ├── SKILL.md
        ├── scripts/
        └── references/
```

## Mandatory task management workflow (td)

You must use `td` when starting work.

1. Run `td usage --new-session` at conversation start (or after `/clear`).
2. Create a new task when starting any new work item.
3. Run `td start <id>` before making changes.
4. Log progress with `td log`.
5. Run `td handoff <id>` before stopping.
6. Keep "in review" issues open for manual review. Do not auto-approve or auto-close review items.
7. Use `td usage -q` for subsequent quick reminders.

## Skill format

### SKILL.md structure

```markdown
---
name: skill-name
description: One sentence describing when to use this skill. Include trigger phrases.
license: MIT
metadata:
  author: web-quality-skills
  version: "1.0"
---

# Skill title

Brief description of what the skill does.

## How it works

Numbered steps explaining the process.

## Guidelines

Categorized rules with clear formatting.

## Examples

Practical code examples with before/after.

## References

Links to additional documentation files.
```

### Naming conventions

- **Skill directory:** kebab-case (for example, `core-web-vitals`, `best-practices`)
- **SKILL.md:** always uppercase, exact filename
- **Scripts:** kebab-case.sh (for example, `analyze-performance.sh`)
- **References:** UPPERCASE.md (for example, `LCP.md`, `WCAG.md`)

### Content guidelines

1. **Keep `SKILL.md` under 500 lines** and use `references/` for detailed material.
2. **Write specific descriptions** and include trigger phrases for skill activation.
3. **Use progressive disclosure** with core guidance in `SKILL.md` and details in references.
4. **Prefer scripts for automation** so script output does not consume context.
5. **Include practical examples** with real code patterns, not just theory.

## Writing guidelines

### For guidelines

Each guideline should follow this pattern:

```markdown
* **Guideline title.** Concise explanation of what to do. Include specific values or thresholds when applicable.
```

Example:

```markdown
* **Images have dimensions.** Set explicit `width` and `height` attributes on `<img>` to prevent layout shifts. Use CSS `aspect-ratio` as a fallback.
```

### For code examples

Always show the problem and solution:

```markdown
**Bad:**
```html
<img src="hero.jpg">
```

**Good:**
```html
<img src="hero.jpg" width="1200" height="600" alt="Hero image" loading="lazy">
```
```

### For thresholds

Use tables for clarity:

```markdown
| Metric | Good | Needs improvement | Poor |
|--------|------|-------------------|------|
| LCP | <= 2.5s | 2.5s - 4.0s | > 4.0s |
```

## Script requirements

Scripts in `scripts/` should:

1. Use `#!/bin/bash` shebang.
2. Use `set -e` for fail-fast behavior.
3. Write status messages to stderr: `echo "Message" >&2`.
4. Write machine-readable output (JSON) to stdout.
5. Include cleanup traps for temp files.
6. Be self-contained or clearly document dependencies.

Example:

```bash
#!/bin/bash
set -e

cleanup() {
  rm -f "$TEMP_FILE"
}
trap cleanup EXIT

TEMP_FILE=$(mktemp)

echo "Analyzing..." >&2
# ... analysis logic ...

echo '{"score": 85, "issues": []}'
```

## Reference material

Reference files in `references/` should:

1. Focus on a single topic.
2. Be loadable independently.
3. Include practical examples.
4. Link back to authoritative sources.

Keep individual reference files under 200 lines when possible.

## Testing skills

Before submitting a skill:

1. Verify YAML frontmatter is valid.
2. Check that description includes activation triggers.
3. Test that examples actually work.
4. Ensure all referenced files exist.
5. Validate against the [Agent Skills specification](https://agentskills.io/specification).

## Priority rules

When reviewing code, prioritize by impact:

1. **Critical** - Security vulnerabilities, complete failures.
2. **High** - Core Web Vitals failures, major accessibility barriers.
3. **Medium** - Performance opportunities, SEO improvements.
4. **Low** - Code style, minor optimizations.

## Framework agnosticism

Skills must work across frameworks. When providing examples:

- Show vanilla HTML/CSS/JS first.
- Add framework-specific notes in separate sections.
- Never require a specific framework.
- Use standard web APIs when possible.

## Updating skills

When updating existing skills:

1. Maintain backward compatibility in descriptions.
2. Update version in frontmatter metadata.
3. Document breaking changes in commit message.
4. Keep existing trigger phrases working.

## User coding and engineering rules

### Workflow expectations

- Always act as a fullstack software engineer.
- Before implementing, provide a detailed step-by-step plan.
- After the plan, ask a follow-up question when clarification is needed.

### General code style

- Use TypeScript for all new files and components.
- Prefer functional components over class components.
- Use ES modules (`import`/`export`), never CommonJS (`require`).
- Follow Prettier defaults: 2 spaces, semicolons, single quotes.
- Keep imports sorted: external first, internal second, styles/assets last.
- Use named exports unless a single default export is clearly better.

### React and Next.js

- Use React Hooks, not legacy lifecycle methods.
- For Next.js, use the `app/` directory when possible (Next 13+).
- Use `next/link` for navigation and `next/image` for optimized images.
- Write server components by default; use `'use client'` only when needed.
- In `app/`, use `fetch` in server components for data loading.
- Keep components small and focused (about 150 lines max before splitting).

### Nuxt.js

- Use `<script setup lang="ts">` in Vue components.
- Use Nuxt composables (`useFetch`, `useAsyncData`) for data loading.
- Use Pinia for global state, not Vuex.
- Keep Nuxt conventions: `/components` and `/pages`.
- For Tailwind in Vue templates, follow React-class ordering conventions.

### Testing and QA

- Always create or update corresponding unit tests for logic changes.
- Prefer Vitest for Vue/Nuxt and Jest for React/Next.
- Write accessible markup using semantic HTML and correct ARIA.
- Run ESLint with zero warnings before considering work complete.

### Performance and best practices

- Lazy-load non-critical components with dynamic imports.
- Prevent unnecessary re-renders by memoizing callbacks/values.
- Remove unused imports or variables.
- With Tailwind, prefer theme tokens over excessive arbitrary values.

### Comments and docs

- Use JSDoc-style comments for complex functions.
- Keep comments updated and remove outdated comments.
- Document component props and return types explicitly.
