#!/usr/bin/env node
// Fail CI if any component file uses hardcoded colors or font-family
// instead of the design tokens defined in src/styles/tokens.css.
//
// Component files (src/components/atoms|molecules|organisms) and pages
// reference only `var(--token)` per the spec's Reuse rules. The shadcn
// primitive layer under src/components/ui/ is exempt — those are the
// upstream tokens themselves.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = [
  "src/components/atoms",
  "src/components/molecules",
  "src/components/organisms",
  "src/app",
];
const SKIP_DIRS = new Set(["src/components/ui"]);
const TARGET_EXT = /\.(tsx|ts)$/;

// Hex colors and rgb()/rgba() literals.
const HARDCODED_COLOR = /(#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\))/;
// font-family, font-size, color: in style strings.
const HARDCODED_FONT = /font-family\s*:|font-size\s*:\s*\d/;

const offenders = [];

function walk(dir) {
  const abs = join(ROOT, dir);
  try {
    statSync(abs);
  } catch {
    return;
  }
  for (const entry of readdirSync(abs)) {
    const rel = `${dir}/${entry}`;
    if (SKIP_DIRS.has(rel)) continue;
    const full = join(abs, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(rel);
      continue;
    }
    if (!TARGET_EXT.test(entry)) continue;
    if (entry.endsWith(".test.ts") || entry.endsWith(".test.tsx")) continue;
    const content = readFileSync(full, "utf8");
    // Strip Tailwind-ish utility classes from data we scan — we only flag
    // values inside `style={{ ... }}` literals or raw color hex.
    const hexMatch = content.match(HARDCODED_COLOR);
    if (hexMatch) offenders.push(`${relative(ROOT, full)}: hardcoded color "${hexMatch[0]}"`);
    const fontMatch = content.match(HARDCODED_FONT);
    if (fontMatch) offenders.push(`${relative(ROOT, full)}: hardcoded font "${fontMatch[0]}"`);
  }
}

for (const dir of SCAN_DIRS) walk(dir);

if (offenders.length > 0) {
  console.error("✗ Token discipline violations:");
  for (const o of offenders) console.error(`  - ${o}`);
  console.error("\nUse var(--color-*) / var(--font-*) tokens instead.");
  process.exit(1);
}
console.log("✓ Token discipline OK");
