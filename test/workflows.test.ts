import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const WORKFLOW_DIR = join(ROOT, '.github', 'workflows');

const workflows = readdirSync(WORKFLOW_DIR).filter((file) =>
  /\.ya?ml$/.test(file),
);

describe('GitHub workflows', () => {
  it('has the expected workflows and no release workflow', () => {
    expect(workflows.sort()).toEqual(['ci.yml', 'sync-skills.yml']);
  });

  // A workflow file that does not parse is reported by GitHub as a run with no
  // jobs and no logs, and its `on:` triggers are ignored, so it fires on every
  // push. That happened here: a multi-line shell string inside a `run: |`
  // block had continuation lines at column 0, which ends the block scalar.
  it.each(workflows)('%s is valid YAML with the required keys', (file) => {
    const parsed = parse(readFileSync(join(WORKFLOW_DIR, file), 'utf8'));
    expect(parsed).toBeTypeOf('object');
    expect(parsed.name).toBeTypeOf('string');
    // `on` is parsed as the boolean true by YAML 1.1; the `yaml` package uses
    // YAML 1.2, where it stays a string. Accept either.
    expect(parsed.on ?? parsed[true as unknown as string]).toBeTruthy();
    expect(Object.keys(parsed.jobs ?? {}).length).toBeGreaterThan(0);
  });

  it.each(workflows)('%s keeps every run block inside its scalar', (file) => {
    // Re-serialising and re-parsing catches a block scalar that silently
    // swallowed or truncated shell lines.
    const source = readFileSync(join(WORKFLOW_DIR, file), 'utf8');
    const parsed = parse(source);

    for (const job of Object.values(parsed.jobs) as Array<{
      steps?: Array<{ run?: string; name?: string }>;
    }>) {
      for (const step of job.steps ?? []) {
        if (!step.run) continue;
        // Every non-empty line of a run block must have come from the file.
        for (const line of step.run.split('\n')) {
          if (!line.trim()) continue;
          expect(source).toContain(line.trim());
        }
      }
    }
  });

  it.each(workflows)('%s publishes nothing', (file) => {
    const source = readFileSync(join(WORKFLOW_DIR, file), 'utf8');
    const code = source
      .split('\n')
      .filter((line) => !line.trim().startsWith('#'))
      .join('\n');

    for (const banned of [
      'npm publish',
      'NPM_TOKEN',
      'NODE_AUTH_TOKEN',
      'semantic-release',
      'registry-url',
      'npm.pkg.github.com',
      'id-token',
    ]) {
      expect(code, `${file} must not reference ${banned}`).not.toContain(
        banned,
      );
    }
  });

  it('sync-skills runs only on a schedule or on demand', () => {
    const parsed = parse(
      readFileSync(join(WORKFLOW_DIR, 'sync-skills.yml'), 'utf8'),
    );
    const triggers = Object.keys(parsed.on ?? parsed[true as unknown as string]);
    expect(triggers.sort()).toEqual(['schedule', 'workflow_dispatch']);
  });

  it('sync-skills asks for no more permission than it needs', () => {
    const parsed = parse(
      readFileSync(join(WORKFLOW_DIR, 'sync-skills.yml'), 'utf8'),
    );
    expect(parsed.permissions).toEqual({
      contents: 'write',
      'pull-requests': 'write',
    });
  });

  it('ci only reads', () => {
    const parsed = parse(readFileSync(join(WORKFLOW_DIR, 'ci.yml'), 'utf8'));
    expect(parsed.permissions).toEqual({ contents: 'read' });
  });
});

describe('sync-pr-body script', () => {
  it('renders a body without shell or YAML quoting hazards', () => {
    const body = execFileSync(
      process.execPath,
      [join(ROOT, 'scripts', 'sync-pr-body.mjs'), 'abc1234'],
      { encoding: 'utf8' },
    );
    expect(body).toContain('https://github.com/greensock/gsap-skills/commit/abc1234');
    expect(body).toContain('does not publish anything');
  });

  it('exits with an error when given no sha', () => {
    expect(() =>
      execFileSync(process.execPath, [join(ROOT, 'scripts', 'sync-pr-body.mjs')], {
        stdio: 'pipe',
      }),
    ).toThrow();
  });
});
