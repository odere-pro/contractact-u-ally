#!/usr/bin/env bash
# Preflight validator for contractact-u-ally.
#
# Exits 0 only if every check passes. Prints [OK]/[FAIL] per check so a
# single failure points at the section to fix.
#
# Flags (env vars):
#   PREFLIGHT_SKIP_E2E=1        skip Playwright (default: skipped, no specs yet)
#   PREFLIGHT_WITH_GEMINI=1     require gemini-image MCP connected

set -euo pipefail

GREEN=$'\033[0;32m'
RED=$'\033[0;31m'
YELLOW=$'\033[0;33m'
RESET=$'\033[0m'

ok()   { printf "%b[OK]%b   %s\n"   "$GREEN" "$RESET" "$1"; }
fail() { printf "%b[FAIL]%b %s\n"   "$RED"   "$RESET" "$1" >&2; exit 1; }
warn() { printf "%b[WARN]%b %s\n"   "$YELLOW" "$RESET" "$1"; }
section() { printf "\n=== %s ===\n" "$1"; }

# ----- §1. Claude Code baseline -----
section "1. Claude Code baseline"

command -v claude >/dev/null 2>&1 \
  || fail "claude CLI not found on PATH — install Claude Code before running preflight."
ok "claude CLI present ($(claude --version 2>/dev/null | head -1))"

# ----- §2. Claude plugins + ECC -----
section "2. Claude plugins + ECC"

plugins="$(claude plugin list 2>/dev/null || true)"
if printf '%s\n' "$plugins" | grep -q "vercel@claude-plugins-official"; then
  ok "vercel@claude-plugins-official installed"
else
  warn "vercel@claude-plugins-official missing — install with: claude plugin install vercel@claude-plugins-official"
fi

# ECC = global ~/.claude/rules + agents (not a CLI). Verify presence best-effort.
if [ -d "$HOME/.claude/rules" ]; then
  ok "~/.claude/rules/ present (ECC rules)"
else
  warn "~/.claude/rules/ missing — install ECC global rules"
fi

if [ -d "$HOME/.claude/agents" ]; then
  for agent in code-reviewer security-reviewer typescript-reviewer; do
    if ls "$HOME/.claude/agents/" 2>/dev/null | grep -q "$agent"; then
      ok "agent present: $agent"
    else
      warn "agent missing: $agent"
    fi
  done
else
  warn "~/.claude/agents/ missing — ECC agents not installed"
fi

# ----- §3. MCP servers -----
section "3. MCP servers"

mcp_output="$(claude mcp list 2>&1 || true)"

check_mcp() {
  local name="$1"
  if printf '%s\n' "$mcp_output" | grep -E "^${name}:" | grep -q "Connected"; then
    ok "MCP connected: $name"
  else
    fail "MCP not connected: $name — see .mcp.json"
  fi
}

check_mcp shadcn
check_mcp nextjs
check_mcp playwright
check_mcp structurizr

if [ "${PREFLIGHT_WITH_GEMINI:-0}" = "1" ]; then
  check_mcp gemini-image
else
  if printf '%s\n' "$mcp_output" | grep -E "^gemini-image:" | grep -q "Connected"; then
    ok "MCP connected: gemini-image (optional — detected)"
  else
    warn "MCP not connected: gemini-image (optional; set PREFLIGHT_WITH_GEMINI=1 to require)"
  fi
fi

# ----- §4. CLI tools -----
section "4. CLI tools"

require_cli() {
  local name="$1"
  command -v "$name" >/dev/null 2>&1 \
    || fail "$name not on PATH"
  ok "$name present"
}

require_cli node
require_cli npm
require_cli git
require_cli gh

# ----- §5. Local env -----
section "5. Local env (.env.local)"

[ -f .env.local ] || fail ".env.local missing — cp .env.example .env.local and fill ANTHROPIC_API_KEY"
ok ".env.local exists"

if grep -Eq '^ANTHROPIC_API_KEY=.+' .env.local; then
  ok "ANTHROPIC_API_KEY set in .env.local"
else
  warn "ANTHROPIC_API_KEY missing or empty in .env.local (required once domain logic returns)"
fi

if [ "${PREFLIGHT_WITH_GEMINI:-0}" = "1" ]; then
  grep -Eq '^GEMINI_API_KEY=.+' .env.local \
    || fail "GEMINI_API_KEY missing or empty in .env.local (required when PREFLIGHT_WITH_GEMINI=1)"
  ok "GEMINI_API_KEY set in .env.local"
fi

# ----- §6. GitHub auth -----
section "6. GitHub auth"

gh auth status >/dev/null 2>&1 || warn "gh not authenticated — run: gh auth login"
gh auth status >/dev/null 2>&1 && ok "gh authenticated"

# ----- §7. App health -----
section "7. App health (npm run check)"

npm run --silent check \
  || fail "npm run check failed — typecheck / lint / format issue. Run: npm run fix"
ok "npm run check passed"

# ----- §8. Build -----
section "8. Production build (npm run build)"

npm run --silent build \
  || fail "npm run build failed — see output above"
ok "npm run build passed"

# ----- §9. E2E -----
section "9. E2E (npm run test:e2e)"

if [ "${PREFLIGHT_SKIP_E2E:-1}" = "1" ]; then
  warn "PREFLIGHT_SKIP_E2E=1 (default) — skipping Playwright (no specs checked in yet)"
else
  npm run --silent test:e2e \
    || fail "npm run test:e2e failed"
  ok "npm run test:e2e passed"
fi

# ----- All clear -----
printf "\n%b[ALL CLEAR]%b preflight is green.\n" "$GREEN" "$RESET"
