---
name: accessibility
description: Audit and improve web accessibility following WCAG 2.2 guidelines. Use when asked to "improve accessibility", "a11y audit", "WCAG compliance", "screen reader support", "keyboard navigation", or "make accessible".
license: MIT
metadata:
  author: web-quality-skills
  version: "1.0"
---

# Accessibility (a11y)

Comprehensive accessibility guidelines based on WCAG 2.2 and Lighthouse accessibility audits. Goal: make content usable by everyone, including people with disabilities.

## WCAG Principles: POUR

| Principle | Description |
|-----------|-------------|
| **P**erceivable | Content can be perceived through different senses |
| **O**perable | Interface can be operated by all users |
| **U**nderstandable | Content and interface are understandable |
| **R**obust | Content works with assistive technologies |

## Conformance levels

| Level | Requirement | Target |
|-------|-------------|--------|
| **A** | Minimum accessibility | Must pass |
| **AA** | Standard compliance | Should pass (legal requirement in many jurisdictions) |
| **AAA** | Enhanced accessibility | Nice to have |

---

## Perceivable

### Text alternatives (1.1)

**Images require alt text:**
```html
<!-- ❌ Missing alt -->
<img src="chart.png">

<!-- ✅ Descriptive alt -->
<img src="chart.png" alt="Bar chart showing 40% increase in Q3 sales">

<!-- ✅ Decorative image (empty alt) -->
<img src="decorative-border.png" alt="" role="presentation">

<!-- ✅ Complex image with longer description -->
<figure>
  <img src="infographic.png" alt="2024 market trends infographic" 
       aria-describedby="infographic-desc">
  <figcaption id="infographic-desc">
    <!-- Detailed description -->
  </figcaption>
</figure>
```

**Icon buttons need accessible names:**
```html
<!-- ❌ No accessible name -->
<button><svg><!-- menu icon --></svg></button>

<!-- ✅ Using aria-label -->
<button aria-label="Open menu">
  <svg aria-hidden="true"><!-- menu icon --></svg>
</button>

<!-- ✅ Using visually hidden text -->
<button>
  <svg aria-hidden="true"><!-- menu icon --></svg>
  <span class="visually-hidden">Open menu</span>
</button>
```

**Visually hidden class:**
```css
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

### Color contrast (1.4.3, 1.4.6)

| Text Size | AA minimum | AAA enhanced |
|-----------|------------|--------------|
| Normal text (< 18px / < 14px bold) | 4.5:1 | 7:1 |
| Large text (≥ 18px / ≥ 14px bold) | 3:1 | 4.5:1 |
| UI components & graphics | 3:1 | 3:1 |

```css
/* ❌ Low contrast (2.5:1) */
.low-contrast {
  color: #999;
  background: #fff;
}

/* ✅ Sufficient contrast (7:1) */
.high-contrast {
  color: #333;
  background: #fff;
}

/* ✅ Focus states need contrast too */
:focus-visible {
  outline: 2px solid #005fcc;
  outline-offset: 2px;
}
```

**Don't rely on color alone:**
```html
<!-- ❌ Only color indicates error -->
<input class="error-border">
<style>.error-border { border-color: red; }</style>

<!-- ✅ Color + icon + text -->
<div class="field-error">
  <input aria-invalid="true" aria-describedby="email-error">
  <span id="email-error" class="error-message">
    <svg aria-hidden="true"><!-- error icon --></svg>
    Please enter a valid email address
  </span>
</div>
```

### Media alternatives (1.2)

```html
<!-- Video with captions -->
<video controls>
  <source src="video.mp4" type="video/mp4">
  <track kind="captions" src="captions.vtt" srclang="en" label="English" default>
  <track kind="descriptions" src="descriptions.vtt" srclang="en" label="Descriptions">
</video>

<!-- Audio with transcript -->
<audio controls>
  <source src="podcast.mp3" type="audio/mp3">
</audio>
<details>
  <summary>Transcript</summary>
  <p>Full transcript text...</p>
</details>
```

---

## Operable

### Keyboard accessible (2.1)

**All functionality must be keyboard accessible:**
```javascript
// ❌ Only handles click
element.addEventListener('click', handleAction);

// ✅ Handles both click and keyboard
element.addEventListener('click', handleAction);
element.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    handleAction();
  }
});
```

**No keyboard traps:** trap focus inside modals and release on Escape. See [modal focus trap pattern](references/A11Y-PATTERNS.md#modal-focus-trap-212).

### Focus visible (2.4.7)

```css
/* ❌ Never remove focus outlines */
*:focus { outline: none; }

/* ✅ Use :focus-visible for keyboard-only focus */
:focus {
  outline: none;
}

:focus-visible {
  outline: 2px solid #005fcc;
  outline-offset: 2px;
}

/* ✅ Or custom focus styles */
button:focus-visible {
  box-shadow: 0 0 0 3px rgba(0, 95, 204, 0.5);
}
```

### Skip links (2.4.1)

Add a visually hidden link before the header that jumps to `#main-content` and becomes visible on focus. See [skip link pattern](references/A11Y-PATTERNS.md#skip-link-241).

### Timing (2.2)

```javascript
// Allow users to extend time limits
function showSessionWarning() {
  const modal = createModal({
    title: 'Session Expiring',
    content: 'Your session will expire in 2 minutes.',
    actions: [
      { label: 'Extend session', action: extendSession },
      { label: 'Log out', action: logout }
    ],
    timeout: 120000 // 2 minutes to respond
  });
}
```

### Motion (2.3)

```css
/* Respect reduced motion preference */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### Focus not obscured (2.4.11 — new in WCAG 2.2)

Focused elements must not be entirely hidden behind sticky headers, footers, or overlays.

```css
/* ❌ Sticky footer can hide focused elements */
.sticky-footer {
  position: fixed;
  bottom: 0;
  width: 100%;
}

/* ✅ Add scroll-padding so focused content clears sticky areas */
html {
  scroll-padding-bottom: 80px; /* height of sticky footer */
  scroll-padding-top: 64px;   /* height of sticky header */
}
```

### Dragging movements (2.5.7 — new in WCAG 2.2)

Any drag-based interaction must have a single-pointer alternative (click/tap). For sortable lists, add move-up/move-down buttons alongside drag-and-drop. See [dragging movements pattern](references/A11Y-PATTERNS.md#dragging-movements-257).

### Target size (2.5.8 — new in WCAG 2.2)

Pointer targets must be at least **24×24 CSS pixels**, or have enough spacing so a 24px circle around each target doesn't overlap another.

```css
/* ✅ Minimum touch target sizing */
button,
a,
input[type="checkbox"],
input[type="radio"] {
  min-width: 24px;
  min-height: 24px;
}

/* ✅ Inline links are exempt, but add spacing for icon-only controls */
.icon-button {
  min-width: 44px;  /* 44px is the AAA / iOS recommended size */
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
```

---

## Understandable

### Page language (3.1.1)

```html
<!-- ❌ No language specified -->
<html>

<!-- ✅ Language specified -->
<html lang="en">

<!-- ✅ Language changes within page -->
<p>The French word for hello is <span lang="fr">bonjour</span>.</p>
```

### Consistent navigation (3.2.3)

```html
<!-- Navigation should be consistent across pages -->
<nav aria-label="Main">
  <ul>
    <li><a href="/" aria-current="page">Home</a></li>
    <li><a href="/products">Products</a></li>
    <li><a href="/about">About</a></li>
  </ul>
</nav>
```

### Form labels (3.3.2)

Every input needs an associated `<label>` (explicit via `for`/`id` or implicit by wrapping). Use `autocomplete` for common fields and `aria-describedby` for instructions. See [form labels pattern](references/A11Y-PATTERNS.md#form-labels-332).

### Error handling (3.3.1, 3.3.3)

Use `aria-invalid`, `aria-describedby`, and `role="alert"` to announce errors. Focus the first invalid field on submit and provide an error summary. See [error handling pattern](references/A11Y-PATTERNS.md#error-handling-331-333).

### Consistent help (3.2.6 — new in WCAG 2.2)

Help mechanisms (chat, contact info, FAQ links) must appear in the same relative order across pages.

```html
<!-- ✅ Help links in consistent footer across all pages -->
<footer>
  <nav aria-label="Help">
    <a href="/faq">FAQ</a>
    <a href="/contact">Contact us</a>
    <button id="chat-toggle" aria-label="Open chat support">Chat</button>
  </nav>
</footer>
```

### Redundant entry (3.3.7 — new in WCAG 2.2)

Don't ask users to re-enter information already provided in the same process. Auto-populate or offer a "same as" checkbox. See [redundant entry pattern](references/A11Y-PATTERNS.md#redundant-entry-337).

### Accessible authentication (3.3.8 — new in WCAG 2.2)

Login must not require solving puzzles or memorizing passwords without assistance. Allow paste, password managers, and alternative auth flows.

```html
<!-- ❌ Blocking paste on password field prevents password managers -->
<input type="password" onpaste="return false">

<!-- ✅ Allow paste and autocomplete for password managers -->
<label for="password">Password</label>
<input type="password" id="password" autocomplete="current-password">

<!-- ✅ Offer alternatives to memory-based login -->
<button type="button">Sign in with passkey</button>
<a href="/magic-link">Email me a sign-in link</a>
```

---

## Robust

### ARIA usage (4.1.2)

**Prefer native elements:**
```html
<!-- ❌ ARIA role on div -->
<div role="button" tabindex="0">Click me</div>

<!-- ✅ Native button -->
<button>Click me</button>

<!-- ❌ ARIA checkbox -->
<div role="checkbox" aria-checked="false">Option</div>

<!-- ✅ Native checkbox -->
<label><input type="checkbox"> Option</label>
```

**When ARIA is needed:** use proper roles, states, and properties (e.g., tabs with `role="tablist"`, `role="tab"`, `aria-selected`). See [ARIA tabs pattern](references/A11Y-PATTERNS.md#aria-tabs-412).

### Live regions (4.1.3)

Use `aria-live="polite"` for status updates and `role="alert"` / `aria-live="assertive"` for urgent messages. Clear the container before updating to ensure re-announcement. See [live regions pattern](references/A11Y-PATTERNS.md#live-regions--notifications-413).

---

## Testing checklist

### Automated testing
```bash
# Lighthouse accessibility audit
npx lighthouse https://example.com --only-categories=accessibility

# axe-core
npm install @axe-core/cli -g
axe https://example.com
```

### Manual testing

- [ ] **Keyboard navigation:** Tab through entire page, use Enter/Space to activate
- [ ] **Screen reader:** Test with VoiceOver (Mac), NVDA (Windows), or TalkBack (Android)
- [ ] **Zoom:** Content usable at 200% zoom
- [ ] **High contrast:** Test with Windows High Contrast Mode
- [ ] **Reduced motion:** Test with `prefers-reduced-motion: reduce`
- [ ] **Focus order:** Logical and follows visual order

### Screen reader commands

See [screen reader commands reference](references/A11Y-PATTERNS.md#screen-reader-commands) for VoiceOver and NVDA shortcuts.

---

## Common issues by impact

### Critical (fix immediately)
1. Missing form labels
2. Missing image alt text
3. Insufficient color contrast
4. Keyboard traps
5. No focus indicators

### Serious (fix before launch)
1. Missing page language
2. Missing heading structure
3. Non-descriptive link text
4. Auto-playing media
5. Missing skip links

### Moderate (fix soon)
1. Missing ARIA labels on icons
2. Inconsistent navigation
3. Missing error identification
4. Timing without controls
5. Missing landmark regions

## References

- [WCAG 2.2 Quick Reference](references/WCAG.md)
- [Accessibility Code Patterns](references/A11Y-PATTERNS.md)
- [WCAG 2.2 Quick Reference (W3C)](https://www.w3.org/WAI/WCAG22/quickref/)
- [What's New in WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/)
- [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [Deque axe Rules](https://dequeuniversity.com/rules/axe/)
- [Web Quality Audit](../web-quality-audit/SKILL.md)