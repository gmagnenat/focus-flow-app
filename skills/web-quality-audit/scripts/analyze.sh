#!/bin/bash
set -e

cleanup() {
  rm -f "$TEMP_FILE"
}
trap cleanup EXIT

TEMP_FILE=$(mktemp)

usage() {
  echo "Usage: $0 <project_directory>" >&2
  echo "Analyzes a web project for quality issues across HTML, JSX/TSX, CSS, dependencies, and security." >&2
  exit 1
}

if [ -z "$1" ]; then
  usage
fi

TARGET="$1"
ISSUES=()
WARNINGS=()

add_issue() {
  ISSUES+=("$1")
}

add_warning() {
  WARNINGS+=("$1")
}

# --- HTML analysis ---

analyze_html() {
  local file="$1"
  echo "  [html] $file" >&2

  # Check for HTML5 doctype
  if ! grep -qi '<!doctype html>' "$file"; then
    add_issue "$file: Missing HTML5 doctype"
  fi

  # Check for UTF-8 charset declaration
  if ! grep -qi 'charset.*utf-8' "$file"; then
    add_warning "$file: Missing or non-UTF-8 charset declaration"
  fi

  # Check for responsive viewport meta tag
  if ! grep -qi 'name="viewport"' "$file"; then
    add_issue "$file: Missing viewport meta tag"
  fi

  # Check for lang attribute on <html> (accessibility + SEO)
  if ! grep -qi '<html.*lang=' "$file"; then
    add_issue "$file: Missing lang attribute on <html>"
  fi

  # Check for <title> tag
  if ! grep -qi '<title>' "$file"; then
    add_issue "$file: Missing <title> tag"
  fi

  # Check for meta description (SEO)
  if ! grep -qi 'name="description"' "$file"; then
    add_issue "$file: Missing meta description"
  fi

  # Check for Open Graph tags (social sharing previews)
  if ! grep -qi 'property="og:' "$file"; then
    add_warning "$file: Missing Open Graph meta tags (og:title, og:description, og:image)"
  fi

  # Check for Twitter Card tags (Twitter/X link previews)
  if ! grep -qi 'name="twitter:' "$file" && ! grep -qi 'property="twitter:' "$file"; then
    add_warning "$file: Missing Twitter Card meta tags"
  fi

  # Check for images missing alt attributes
  if grep -qP '<img(?![^>]*\balt=)[^>]*>' "$file" 2>/dev/null; then
    add_warning "$file: Possible images without alt text"
  fi

  # Check for insecure HTTP URLs
  if grep -qE 'http://' "$file"; then
    add_warning "$file: Contains non-HTTPS URLs"
  fi
}

# --- JSX/TSX accessibility analysis ---

analyze_jsx() {
  local file="$1"
  echo "  [jsx] $file" >&2

  # Check for <input> elements without accessible labels
  if grep -qE '<input' "$file"; then
    if ! grep -qE '(aria-label|aria-labelledby|id=.*<label)' "$file"; then
      local count
      count=$(grep -cE '<input' "$file" 2>/dev/null || true)
      if [ "$count" -gt 0 ]; then
        local has_label
        has_label=$(grep -cE '(aria-label|aria-labelledby)' "$file" 2>/dev/null || true)
        if [ "$has_label" -eq 0 ]; then
          add_issue "$file: <input> element(s) without aria-label or aria-labelledby ($count found)"
        fi
      fi
    fi
  fi

  # Check for buttons with dynamic content that may lack accessible names
  if grep -qE '<(button|Button)' "$file"; then
    local buttons_without_a11y
    buttons_without_a11y=$(grep -cE '<(button|Button)[^>]*>\s*\{' "$file" 2>/dev/null || true)
    if [ "$buttons_without_a11y" -gt 0 ]; then
      if ! grep -qE 'aria-label' "$file"; then
        add_warning "$file: Button(s) with dynamic content may lack accessible names"
      fi
    fi
  fi

  # Check for toggle button groups missing aria-pressed state
  if grep -qE 'aria-pressed' "$file"; then
    :
  elif grep -qE 'role="group"' "$file"; then
    add_warning "$file: role=\"group\" found but toggle buttons may be missing aria-pressed"
  fi

  # Check for <img> in JSX without alt attribute
  if grep -qP '<img(?![^>]*\balt[=\s])[^>]*/?>' "$file" 2>/dev/null; then
    add_issue "$file: <img> in JSX without alt attribute"
  fi
}

# --- CSS analysis ---

analyze_css() {
  local file="$1"
  echo "  [css] $file" >&2

  # Check for render-blocking @import of external resources (fonts, CDNs)
  if grep -qE '@import\s+url\(' "$file"; then
    local imports
    imports=$(grep -E '@import\s+url\(' "$file" 2>/dev/null || true)
    if echo "$imports" | grep -qE 'fonts\.googleapis|cdn\.|http'; then
      add_issue "$file: Render-blocking @import for external resource — move to <link> in HTML <head> with preconnect"
    fi
  fi

  # Check that interactive elements have :focus-visible styles for keyboard navigation
  local interactive_selectors
  interactive_selectors=$(grep -cE '\bbutton\b|btn|\.app__card-button|\.app__clear-button|\.summary__button|\.summary__format' "$file" 2>/dev/null || true)
  if [ "$interactive_selectors" -gt 0 ]; then
    local focus_visible_count
    focus_visible_count=$(grep -cE ':focus-visible' "$file" 2>/dev/null || true)
    if [ "$focus_visible_count" -eq 0 ]; then
      add_issue "$file: No :focus-visible styles found — keyboard users cannot see focused buttons"
    elif [ "$focus_visible_count" -lt 3 ]; then
      add_warning "$file: Only $focus_visible_count :focus-visible rule(s) — some interactive elements may lack visible focus"
    fi
  fi

  # Check that elements hidden with opacity:0 become visible on :focus-visible
  if grep -qE 'opacity:\s*0' "$file"; then
    if ! grep -qE ':focus-visible.*opacity:\s*1|opacity:\s*1.*:focus-visible' "$file"; then
      local hidden_elements
      hidden_elements=$(grep -B1 'opacity:\s*0' "$file" 2>/dev/null | grep -oE '\.[a-zA-Z_-]+' | head -3 || true)
      if [ -n "$hidden_elements" ]; then
        add_warning "$file: Elements hidden with opacity:0 ($hidden_elements) — ensure they become visible on :focus-visible"
      fi
    fi
  fi
}

# --- Dependency analysis ---

analyze_dependencies() {
  local pkg_file="$1/package.json"
  if [ ! -f "$pkg_file" ]; then
    return
  fi

  echo "  [deps] $pkg_file" >&2

  local src_dir="$1/src"
  if [ ! -d "$src_dir" ]; then
    src_dir="$1"
  fi

  # Extract production dependencies from the "dependencies" block in package.json
  local prod_deps
  prod_deps=$(awk '/"dependencies"/{found=1; next} found && /\}/{found=0} found{print}' "$pkg_file" \
    | grep -oE '"@?[a-zA-Z0-9_./-]+"' | tr -d '"' || true)

  # Check each production dependency is actually imported somewhere in source
  for dep in $prod_deps; do
    local import_name="$dep"
    if ! grep -rqE "from ['\"]${import_name}['\"/]|require\(['\"]${import_name}['\"/]" "$src_dir" 2>/dev/null; then
      add_warning "package.json: Production dependency \"$dep\" is not imported in source code"
    fi
  done
}

# --- Security analysis ---

analyze_security() {
  local dir="$1"
  echo "  [security] Checking for leaked env vars" >&2

  local src_dir="$dir/src"
  if [ ! -d "$src_dir" ]; then
    src_dir="$dir"
  fi

  # Check for VITE_-prefixed secret env vars in client code (Vite embeds these in the bundle)
  local leaks
  leaks=$(grep -rE 'VITE_.*KEY|VITE_.*SECRET|VITE_.*TOKEN|VITE_.*PASSWORD' "$src_dir" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null || true)
  if [ -n "$leaks" ]; then
    local files
    files=$(echo "$leaks" | cut -d: -f1 | sort -u | tr '\n' ', ' | sed 's/,$//')
    add_issue "Client-side code references VITE_*KEY/SECRET/TOKEN env vars — these are embedded in the production bundle ($files)"
  fi

  # Check for .env files containing secrets that might be committed
  if [ -f "$dir/.env" ]; then
    if grep -qE '(KEY|SECRET|TOKEN|PASSWORD)=.+' "$dir/.env"; then
      add_issue ".env: Contains secrets — ensure this file is in .gitignore"
    fi
  fi

  # Check for source maps in production build output
  local source_maps
  source_maps=$(find "$dir/dist" -name "*.map" 2>/dev/null | head -1 || true)
  if [ -n "$source_maps" ]; then
    add_warning "dist/: Source maps found in build output — consider disabling for production"
  fi
}

# --- Main execution ---

echo "Web Quality Audit" >&2
echo "=================" >&2
echo "Target: $TARGET" >&2
echo "" >&2

if [ ! -d "$TARGET" ] && [ ! -f "$TARGET" ]; then
  echo "Error: $TARGET is not a valid file or directory" >&2
  exit 1
fi

PROJECT_DIR="$TARGET"
if [ -f "$TARGET" ]; then
  PROJECT_DIR=$(dirname "$TARGET")
fi

echo "Phase 1: HTML analysis" >&2
while IFS= read -r -d '' file; do
  analyze_html "$file"
done < <(find "$PROJECT_DIR" -maxdepth 3 \( -name "*.html" -o -name "*.htm" \) -not -path "*/node_modules/*" -not -path "*/dist/*" -print0)

echo "Phase 2: JSX/TSX accessibility" >&2
while IFS= read -r -d '' file; do
  analyze_jsx "$file"
done < <(find "$PROJECT_DIR/src" -maxdepth 5 \( -name "*.tsx" -o -name "*.jsx" \) -not -path "*/node_modules/*" -print0 2>/dev/null || true)

echo "Phase 3: CSS analysis" >&2
while IFS= read -r -d '' file; do
  analyze_css "$file"
done < <(find "$PROJECT_DIR/src" -maxdepth 5 -name "*.css" -not -path "*/node_modules/*" -print0 2>/dev/null || true)

echo "Phase 4: Dependency analysis" >&2
analyze_dependencies "$PROJECT_DIR"

echo "Phase 5: Security analysis" >&2
analyze_security "$PROJECT_DIR"

echo "" >&2
echo "Scan complete: ${#ISSUES[@]} issues, ${#WARNINGS[@]} warnings" >&2

# --- JSON output ---

json_escape() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  printf '%s' "$s"
}

echo '{'
echo '  "issues": ['
for i in "${!ISSUES[@]}"; do
  [ "$i" -gt 0 ] && echo ','
  printf '    "%s"' "$(json_escape "${ISSUES[$i]}")"
done
echo ''
echo '  ],'
echo '  "warnings": ['
for i in "${!WARNINGS[@]}"; do
  [ "$i" -gt 0 ] && echo ','
  printf '    "%s"' "$(json_escape "${WARNINGS[$i]}")"
done
echo ''
echo '  ],'
echo "  \"issueCount\": ${#ISSUES[@]},"
echo "  \"warningCount\": ${#WARNINGS[@]}"
echo '}'
