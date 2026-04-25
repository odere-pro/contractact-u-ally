#!/usr/bin/env bash
# Stop hook: append a timestamped line to the session log.
set -euo pipefail

project_dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"
log_dir="$project_dir/.claude"
log_file="$log_dir/session.log"

mkdir -p "$log_dir"
printf '[claude] session stopped at %s\n' "$(date -u +%FT%TZ)" >> "$log_file"
