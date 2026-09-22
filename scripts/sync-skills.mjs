#!/usr/bin/env node
/**
 * Refreshes the vendored copy of the official GreenSock skills.
 *
 * Replaces src/data/skills wholesale from a checkout of
 * github.com/greensock/gsap-skills and rewrites SOURCE.json with that
 * checkout's commit, so provenance always matches the files.
 *
 * This script only touches the working tree. It never publishes anything, and
 * it needs no registry credentials.
 *
 * Usage:
 *   node scripts/sync-skills.mjs --from <path-to-gsap-skills-checkout>
 *   node scripts/sync-skills.mjs --from <path> --check   # report only
 */

import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(projectRoot, 'src', 'data', 'skills');

function arg(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const source = resolve(arg('--from') ?? '');
const checkOnly = process.argv.includes('--check');

if (!source || !existsSync(join(source, 'skills'))) {
  console.error(
    'sync-skills: pass --from <path> pointing at a gsap-skills checkout',
  );
  process.exit(2);
}

function git(...args) {
  return execFileSync('git', ['-C', source, ...args], {
    encoding: 'utf8',
  }).trim();
}

const commit = git('rev-parse', 'HEAD');
const commitDate = git('log', '-1', '--format=%cI');

/**
 * The GSAP release the skills target, read from the CDN pin in their own
 * examples. Falls back to whatever is already recorded rather than guessing.
 */
function detectGsapVersion() {
  const current = existsSync(join(target, 'SOURCE.json'))
    ? JSON.parse(readFileSync(join(target, 'SOURCE.json'), 'utf8')).gsapVersion
    : undefined;

  const candidates = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(path);
      } else if (/\.(js|ts|json|html|vue|md|txt)$/.test(entry.name)) {
        for (const [, version] of readFileSync(path, 'utf8').matchAll(
          /gsap@(\d+\.\d+\.\d+)/g,
        )) {
          candidates.push(version);
        }
      }
    }
  };
  walk(source);

  if (candidates.length === 0) return current ?? 'unknown';

  // Highest pinned version wins, so one stale example cannot drag it back.
  return candidates.sort((a, b) => {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    return pb[0] - pa[0] || pb[1] - pa[1] || pb[2] - pa[2];
  })[0];
}

const gsapVersion = detectGsapVersion();

const previous = existsSync(join(target, 'SOURCE.json'))
  ? JSON.parse(readFileSync(join(target, 'SOURCE.json'), 'utf8'))
  : undefined;

// `syncedAt` records when the vendored copy last *changed*, not when it was
// last checked. Bumping it on every run would make the weekly workflow open a
// pull request every week with nothing in it.
const syncedAt =
  previous && previous.commit === commit
    ? previous.syncedAt
    : new Date().toISOString().slice(0, 10);

const sourceJson = {
  note: 'Vendored verbatim from the official GreenSock skills repository. Do not hand-edit these files; they are replaced wholesale by .github/workflows/sync-skills.yml.',
  repository: 'https://github.com/greensock/gsap-skills',
  commit,
  commitDate,
  syncedAt,
  license: 'MIT',
  copyright: 'Copyright (c) 2026 GreenSock',
  gsapVersion,
};

if (checkOnly) {
  console.log(JSON.stringify({ commit, commitDate, gsapVersion }, null, 2));
  process.exit(0);
}

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });

cpSync(join(source, 'skills'), target, { recursive: true });
cpSync(join(source, 'LICENSE'), join(target, 'LICENSE'));
writeFileSync(join(target, 'SOURCE.json'), `${JSON.stringify(sourceJson, null, 2)}\n`);

const skills = readdirSync(target, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

if (skills.length === 0) {
  console.error('sync-skills: no skill directories were copied');
  process.exit(1);
}

console.log(
  `sync-skills: ${skills.length} skills at ${commit.slice(0, 7)} (GSAP ${gsapVersion})`,
);
