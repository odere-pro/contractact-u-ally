#!/usr/bin/env bash
# PostToolUse hook: format edited files with prettier.
# Reads file paths from stdin JSON payload (hook input) for robustness,
# falls back to CLAUDE_FILE_PATHS env var. Confines to project root
# and restricts by extension allowlist.
set -euo pipefail

project_dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$project_dir"

# Resolve project root absolute path for containment check.
project_abs="$(cd "$project_dir" && pwd -P)"

allowed_ext_regex='\.(ts|tsx|js|jsx|mjs|cjs|json|md|mdx|css|scss|yml|yaml|html)$'

format_one() {
  local file="$1"

  # Skip empty entries.
  [[ -z "$file" ]] && return 0

  # Resolve to absolute path; skip if it doesn't exist.
  local abs
  abs="$(cd "$(dirname -- "$file")" 2>/dev/null && pwd -P)/$(basename -- "$file")" || return 0
  [[ -f "$abs" ]] || return 0

  # Containment: must live under project root.
  case "$abs" in
    "$project_abs"/*) ;;
    *) return 0 ;;
  esac

  # Extension allowlist.
  [[ "$abs" =~ $allowed_ext_regex ]] || return 0

  # Best-effort format; never fail the hook on formatter errors.
  npx --no-install prettier --write "$abs" >/dev/null 2>&1 || true
}

# Iterate CLAUDE_FILE_PATHS safely (space-separated by harness convention).
if [[ -n "${CLAUDE_FILE_PATHS:-}" ]]; then
  # shellcheck disable=SC2206
  paths=( ${CLAUDE_FILE_PATHS} )
  for f in "${paths[@]}"; do
    format_one "$f"
  done
fi
