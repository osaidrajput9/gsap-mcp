#!/usr/bin/env node
/**
 * Copies non-TypeScript assets into the build output.
 *
 * `tsc` only emits .js/.d.ts, so the vendored SKILL.md files, llms.txt, the
 * GreenSock LICENSE and SOURCE.json would be missing from dist/ and the server
 * would start with an empty skill set. Destination paths are derived from the
 * tsconfig so this keeps working if rootDir/outDir change.
 */

import { cpSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Minimal JSONC reader — tsconfig.json permits comments and trailing commas. */
function readTsconfig() {
  const text = readFileSync(join(projectRoot, 'tsconfig.json'), 'utf8');
  const withoutComments = text
    .replace(/\\"|"(?:\\"|[^"])*"|(\/\/.*|\/\*[\s\S]*?\*\/)/g, (match, comment) =>
      comment ? '' : match,
    )
    .replace(/,(\s*[}\]])/g, '$1');
  return JSON.parse(withoutComments);
}

const { compilerOptions = {} } = readTsconfig();
const rootDir = resolve(projectRoot, compilerOptions.rootDir ?? '.');
const outDir = resolve(projectRoot, compilerOptions.outDir ?? 'dist');

/** Directories copied verbatim, relative to the project root. */
const ASSET_DIRS = ['src/data/skills'];

let copied = 0;
for (const assetDir of ASSET_DIRS) {
  const from = resolve(projectRoot, assetDir);
  if (!existsSync(from)) {
    console.error(`copy-assets: missing ${assetDir}`);
    process.exit(1);
  }

  const to = join(outDir, relative(rootDir, from));
  cpSync(from, to, { recursive: true });
  copied += 1;
  console.error(`copy-assets: ${assetDir} -> ${relative(projectRoot, to)}`);
}

if (copied === 0) {
  console.error('copy-assets: nothing to copy');
  process.exit(1);
}
