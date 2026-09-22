import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (name: string) => JSON.parse(readFileSync(root + name, 'utf8'));

const pkg = read('package.json');
const lock = read('package-lock.json');
const rootEntry = lock.packages[''];

/**
 * npm mirrors part of package.json into the lockfile's root entry, and rewrites
 * the lockfile on `npm install` whenever the two disagree. That leaves a dirty
 * working tree after a plain install, which `npm version` refuses to run on —
 * so a field added to package.json without regenerating the lockfile blocks
 * every release until someone works out why.
 *
 * It has happened once: `engines` was added in the npm-preparation commit and
 * the lockfile was not regenerated, so `npm version patch` failed with "Git
 * working directory not clean" on a checkout that had only ever been installed.
 *
 * Fix a failure here by running `npm install` and committing the lockfile —
 * never by hand-editing it.
 */
describe('package-lock.json agrees with package.json', () => {
  it('describes this package, not a stale copy of it', () => {
    expect(lock.name).toBe(pkg.name);
    expect(lock.version).toBe(pkg.version);
    expect(lock.lockfileVersion).toBeGreaterThanOrEqual(3);
  });

  // The fields npm copies verbatim into the lockfile's root entry.
  for (const field of ['name', 'version', 'license', 'engines', 'bin', 'dependencies', 'devDependencies']) {
    it(`has the same \`${field}\``, () => {
      expect(rootEntry[field]).toEqual(pkg[field]);
    });
  }

  it('declares `bin` the way npm stores it, so publishing warns about nothing', () => {
    // npm strips a leading "./" when it normalises a bin path, and warns on
    // publish that it "auto-corrected" the manifest. The tarball is fine
    // either way, but the warning is indistinguishable from a real one, so the
    // source is kept in the normalised form and the lockfile comparison above
    // catches any drift back.
    for (const target of Object.values(pkg.bin as Record<string, string>)) {
      expect(target.startsWith('./')).toBe(false);
    }
  });

  it('declares a repository URL npm does not rewrite', () => {
    expect(pkg.repository.url).toMatch(/^git\+https:\/\/.+\.git$/);
  });

  it('agrees about whether the package is private', () => {
    expect('private' in rootEntry).toBe(Boolean(pkg.private));
  });

  it('is publishable: not private, and public access for the scope', () => {
    // A scoped package defaults to restricted, which needs a paid account.
    expect(pkg.private).toBeUndefined();
    expect(pkg.publishConfig?.access).toBe('public');
    expect(pkg.name.startsWith('@')).toBe(true);
  });
});
