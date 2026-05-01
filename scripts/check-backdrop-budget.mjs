#!/usr/bin/env node
// Build-time guardrail: enforce per-theme + total backdrop asset budget
// from spec §2 (10MB single, 60MB total). Walks public/themes/<id>/
// looking for {day,night}.{webm,mp4} files. No assets => silent pass so
// the build keeps working before themes ship their videos.

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'public/themes';
const PER_FILE_LIMIT = 10 * 1024 * 1024;
const TOTAL_LIMIT = 60 * 1024 * 1024;
const VIDEO_EXTS = ['.webm', '.mp4'];

function fmtMB(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
}

let themes = [];
try {
  themes = readdirSync(ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
} catch (err) {
  if (err && err.code === 'ENOENT') {
    console.log(`[backdrop-budget] no ${ROOT}/ directory; nothing to check.`);
    process.exit(0);
  }
  throw err;
}

const errors = [];
let total = 0;
let counted = 0;

for (const id of themes) {
  let entries = [];
  try {
    entries = readdirSync(join(ROOT, id));
  } catch {
    continue;
  }
  for (const name of entries) {
    if (!VIDEO_EXTS.some((ext) => name.toLowerCase().endsWith(ext))) continue;
    const path = join(ROOT, id, name);
    const size = statSync(path).size;
    counted += 1;
    total += size;
    if (size > PER_FILE_LIMIT) {
      errors.push(`${path}: ${fmtMB(size)} exceeds ${fmtMB(PER_FILE_LIMIT)} per-file limit`);
    }
  }
}

if (total > TOTAL_LIMIT) {
  errors.push(`total ${fmtMB(total)} exceeds ${fmtMB(TOTAL_LIMIT)} budget`);
}

if (errors.length > 0) {
  console.error('[backdrop-budget] violations:');
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}

console.log(
  `[backdrop-budget] OK — ${counted} file(s) across ${themes.length} theme(s), ${fmtMB(total)} total.`,
);
