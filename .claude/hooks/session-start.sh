#!/usr/bin/env bash
# SessionStart hook: warn on missing local env and required API keys.
# Runs once per Claude Code session. Non-fatal: only prints warnings.
set -euo pipefail

project_dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$project_dir"

if [[ ! -f ".env.local" ]]; then
  echo "[warn] .env.local missing — copy .env.example and fill keys"
fi

if [[ -z "${ANTHROPIC_API_KEY:-}" ]]; then
  echo "[warn] ANTHROPIC_API_KEY not set"
fi
