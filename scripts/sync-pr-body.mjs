#!/usr/bin/env node
/**
 * Prints the pull request body for the weekly skills sync.
 *
 * This lives in a script rather than inline in the workflow on purpose. A
 * multi-line string written inside a YAML `run: |` block has to stay indented
 * to the block's level; continuation lines at column 0 terminate the block
 * scalar and make the whole workflow file unparseable, which GitHub reports as
 * a startup failure with no job logs.
 *
 * Usage: node scripts/sync-pr-body.mjs <short-sha> [diffstat-file]
 */

import { readFileSync } from 'node:fs';

const [sha, diffstatFile] = process.argv.slice(2);

if (!sha) {
  console.error('sync-pr-body: pass the upstream short sha');
  process.exit(2);
}

let diffstat = '';
if (diffstatFile) {
  try {
    diffstat = readFileSync(diffstatFile, 'utf8').trim();
  } catch {
    diffstat = '(diff summary unavailable)';
  }
}

process.stdout.write(
  [
    'Automated weekly refresh of the vendored official GreenSock skills.',
    '',
    `Upstream: https://github.com/greensock/gsap-skills/commit/${sha}`,
    '',
    ...(diffstat ? ['```', diffstat, '```', ''] : []),
    '`npm test` passed against the refreshed skills.',
    '',
    'Worth reading the diff anyway: the routing tests and the',
    '`validate_gsap_code` rules quote these files, so a rewrite upstream can',
    'change which skill a topic resolves to.',
    '',
    'This workflow does not publish anything.',
    '',
  ].join('\n'),
);
