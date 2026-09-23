import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { FRAMEWORKS, PATTERNS } from '../src/generators/index.js';
import { getPattern, renderPattern } from '../src/generators/patterns.js';
import { validateGsapCode } from '../src/tools/validate.js';

const FIXTURES = fileURLToPath(
  new URL('./fixtures/gsap-skills-examples/', import.meta.url),
);

function ids(code: string, filename?: string): string[] {
  return validateGsapCode({ code, filename }).structured.findings.map(
    (f) => f.id,
  );
}

describe('validate_gsap_code checks', () => {
  it('flags layout properties in a tween', () => {
    const found = ids('gsap.to(".a", { top: 10, width: 200, duration: 1 });');
    expect(found.filter((id) => id === 'layout-property')).toHaveLength(2);
  });

  it('does not flag layout properties in gsap.set (duration 0)', () => {
    expect(ids('gsap.set(".a", { top: 10 });')).not.toContain('layout-property');
  });

  it('does not flag a start/end string that contains "top"', () => {
    expect(
      ids('gsap.to(".a", { x: 1, scrollTrigger: { start: "top center" } });'),
    ).not.toContain('layout-property');
  });

  it('ignores anything inside a comment', () => {
    const code = [
      '// gsap.to(".a", { top: 10 });',
      '/* left: 5, width: 9 */',
      'gsap.to(".a", { x: 10 });',
    ].join('\n');
    expect(ids(code)).toEqual([]);
  });

  it('flags a plugin used without registration', () => {
    expect(ids('ScrollTrigger.create({ trigger: ".a" });')).toContain(
      'missing-register-plugin',
    );
    expect(
      ids(
        'gsap.registerPlugin(ScrollTrigger);\nScrollTrigger.create({ trigger: ".a" });',
      ),
    ).not.toContain('missing-register-plugin');
  });

  it('infers the plugin from a vars key', () => {
    expect(ids('gsap.to(".a", { x: 1, scrollTrigger: ".a" });')).toContain(
      'missing-register-plugin',
    );
  });

  it('flags useGSAP without scope, harder when selectors are used', () => {
    const withSelectors = validateGsapCode({
      code: 'import { useGSAP } from "@gsap/react";\nuseGSAP(() => { gsap.to(".box", { x: 1 }); });',
      filename: 'A.jsx',
    });
    const scoped = withSelectors.structured.findings.find(
      (f) => f.id === 'usegsap-without-scope',
    );
    expect(scoped?.severity).toBe('error');

    expect(
      ids(
        'import { useGSAP } from "@gsap/react";\ngsap.registerPlugin(useGSAP);\nuseGSAP(() => { gsap.to(ref.current, { x: 1 }); }, { scope: container });',
        'A.jsx',
      ),
    ).toEqual([]);
  });

  it('stays quiet on a useGSAP that animates only refs', () => {
    // Reported as a false positive. `scope` confines selector STRINGS to a
    // root; a callback holding no selectors has nothing to confine, so the
    // finding was firing on every ref-only component — noise that teaches
    // people to stop reading the validator.
    const refsOnly = [
      'import { useGSAP } from "@gsap/react";',
      'gsap.registerPlugin(useGSAP);',
      'useGSAP(() => {',
      '  gsap.to(titleRef.current, { autoAlpha: 1 });',
      '  gsap.from(imageRef.current, { y: 40 });',
      '});',
    ].join('\n');
    expect(ids(refsOnly, 'Hero.jsx')).not.toContain('usegsap-without-scope');

    // The real case must still fire, at error severity.
    const withSelector = refsOnly.replace('titleRef.current', '".title"');
    expect(ids(withSelector, 'Hero.jsx')).toContain('usegsap-without-scope');
  });

  it('flags useGSAP that was never registered', () => {
    expect(
      ids(
        'import { useGSAP } from "@gsap/react";\nuseGSAP(() => {}, { scope: c });',
        'A.jsx',
      ),
    ).toContain('usegsap-not-registered');
  });

  it('does not apply React useGSAP rules to a Vue composable of the same name', () => {
    const code = '<script setup>\nconst { gsap } = useGSAP();\n</script>';
    const found = ids(code, 'page.vue');
    expect(found).not.toContain('usegsap-without-scope');
    expect(found).not.toContain('usegsap-not-registered');
  });

  it('flags gsap.context without revert', () => {
    expect(ids('const ctx = gsap.context(() => {}, el);')).toContain(
      'context-without-revert',
    );
    expect(
      ids('const ctx = gsap.context(() => {}, el);\nctx.revert();'),
    ).not.toContain('context-without-revert');
  });

  it('flags a React effect with no cleanup', () => {
    expect(
      ids('useEffect(() => { gsap.to(".a", { x: 1 }); }, []);', 'A.jsx'),
    ).toContain('react-effect-missing-cleanup');
  });

  it('flags a Vue component with no unmount hook', () => {
    expect(
      ids('onMounted(() => { gsap.to(".a", { x: 1 }); });', 'A.vue'),
    ).toContain('vue-missing-cleanup');
  });

  it('flags a Svelte component with no teardown', () => {
    expect(
      ids('onMount(() => { gsap.to(".a", { x: 1 }); });', 'A.svelte'),
    ).toContain('svelte-missing-cleanup');
  });

  it('flags killing every ScrollTrigger on the page', () => {
    expect(
      ids('ScrollTrigger.getAll().forEach((t) => t.kill());'),
    ).toContain('global-scrolltrigger-kill');
  });

  it('flags tweens chained by increasing delay', () => {
    expect(
      ids(
        'gsap.to(".a", { x: 1, delay: 0.5 });\ngsap.to(".b", { x: 1, delay: 1 });',
      ),
    ).toContain('chained-delays');
  });

  it('does not flag a single delay', () => {
    expect(ids('gsap.to(".a", { x: 1, delay: 0.5 });')).not.toContain(
      'chained-delays',
    );
  });

  it('flags a missing ScrollTrigger.refresh after layout changes', () => {
    expect(
      ids(
        'gsap.registerPlugin(ScrollTrigger);\nScrollTrigger.create({ trigger: ".a" });\ndocument.fonts.ready.then(() => {});',
      ),
    ).toContain('missing-scrolltrigger-refresh');

    expect(
      ids(
        'gsap.registerPlugin(ScrollTrigger);\nScrollTrigger.create({ trigger: ".a" });\ndocument.fonts.ready.then(() => ScrollTrigger.refresh());',
      ),
    ).not.toContain('missing-scrolltrigger-refresh');
  });

  it('suggests autoAlpha for opacity: 0 only', () => {
    expect(ids('gsap.to(".a", { opacity: 0 });')).toContain(
      'opacity-vs-autoalpha',
    );
    expect(ids('gsap.to(".a", { opacity: 1 });')).not.toContain(
      'opacity-vs-autoalpha',
    );
  });

  it.each([
    ['ScrollTrigger.matchMedia({});', 'deprecated-scrolltrigger-matchmedia'],
    ['Draggable.create(".a", { throwProps: true });', 'deprecated-throwprops'],
    ['const s = new SplitText(".a");', 'legacy-splittext-constructor'],
    ['TweenMax.to(".a", 1, { x: 1 });', 'gsap2-api'],
    ['gsap.to(".a", { x: 1, ease: Power2.easeOut });', 'gsap2-ease-syntax'],
    ['// registry=https://npm.greensock.com\nregistry=https://npm.greensock.com', 'outdated-gsap-install'],
  ])('flags deprecated API in %s', (code, id) => {
    expect(ids(code)).toContain(id);
  });

  it('flags a ScrollTrigger on a tween inside a timeline', () => {
    expect(
      ids(
        'const tl = gsap.timeline();\ntl.to(".a", { x: 1, scrollTrigger: { trigger: ".a" } });',
      ),
    ).toContain('scrolltrigger-on-child-tween');

    expect(
      ids(
        'const tl = gsap.timeline({ scrollTrigger: { trigger: ".a" } });\ntl.to(".a", { x: 1 });',
      ),
    ).not.toContain('scrolltrigger-on-child-tween');
  });

  it('flags scrub together with toggleActions', () => {
    expect(
      ids(
        'gsap.to(".a", { x: 1, scrollTrigger: { trigger: ".a", scrub: true, toggleActions: "play none none reverse" } });',
      ),
    ).toContain('scrub-with-toggleactions');
  });

  it('flags containerAnimation without a linear ease', () => {
    expect(
      ids('gsap.to(".a", { y: 1, scrollTrigger: { containerAnimation: t } });'),
    ).toContain('containeranimation-without-linear-ease');

    expect(
      ids(
        'const t = gsap.to(".x", { x: 1, ease: "none" });\ngsap.to(".a", { y: 1, scrollTrigger: { containerAnimation: t } });',
      ),
    ).not.toContain('containeranimation-without-linear-ease');
  });

  it('flags markers left on', () => {
    expect(
      ids('gsap.to(".a", { x: 1, scrollTrigger: { markers: true } });'),
    ).toContain('markers-in-production');
  });

  it('flags gsap.context nested inside matchMedia', () => {
    expect(
      ids('const mm = gsap.matchMedia();\nmm.add("(min-width: 1px)", () => { const ctx = gsap.context(() => {}); ctx.revert(); });'),
    ).toContain('context-inside-matchmedia');
  });

  it('reports line numbers that point at the real line', () => {
    const result = validateGsapCode({
      code: ['const a = 1;', '', 'gsap.to(".a", { top: 10 });'].join('\n'),
    });
    expect(result.structured.findings[0].line).toBe(3);
    expect(result.structured.findings[0].excerpt).toBe(
      'gsap.to(".a", { top: 10 });',
    );
  });

  it('rejects empty input', () => {
    expect(() => validateGsapCode({ code: '   ' })).toThrow();
  });
});

describe("GreenSock's own examples", () => {
  const clean = ['react-App.jsx', 'vanilla-main.js'];

  it.each(clean)('%s produces no findings', (file) => {
    const result = validateGsapCode({
      code: readFileSync(join(FIXTURES, file), 'utf8'),
      filename: file,
    });
    expect(result.structured.findings).toEqual([]);
  });

  it('vue-app.vue only warns that registration lives elsewhere', () => {
    const result = validateGsapCode({
      code: readFileSync(join(FIXTURES, 'vue-app.vue'), 'utf8'),
      filename: 'vue-app.vue',
    });
    expect(result.structured.counts.error).toBe(0);
    expect(result.structured.findings.map((f) => f.id)).toEqual([
      'missing-register-plugin',
    ]);
  });

  it('finds the real cleanup bug in the official Nuxt example', () => {
    // examples/nuxt/app/pages/index.vue calls ctx.revert() from a second
    // onMounted() instead of onUnmounted(), so cleanup runs on mount.
    // onUnmounted is imported but never called.
    const code = readFileSync(join(FIXTURES, 'nuxt-index.vue'), 'utf8');
    expect(code).toContain('import { onMounted, onUnmounted }');
    expect(code).not.toMatch(/onUnmounted\s*\(\s*\(\s*\)/);

    const result = validateGsapCode({ code, filename: 'nuxt-index.vue' });
    expect(result.structured.findings.map((f) => f.id)).toEqual([
      'vue-missing-cleanup',
    ]);
  });
});

describe('this server\'s own generated code', () => {
  const combinations = PATTERNS.flatMap((pattern) =>
    FRAMEWORKS.map((framework) => [pattern, framework] as const),
  );

  it.each(combinations)('%s / %s passes its own validator', (pattern, framework) => {
    const extension =
      framework === 'react' || framework === 'nextjs'
        ? 'jsx'
        : framework === 'vue' || framework === 'nuxt'
          ? 'vue'
          : framework === 'svelte'
            ? 'svelte'
            : 'js';

    const result = validateGsapCode({
      code: renderPattern(getPattern(pattern)!, framework),
      filename: `${pattern}.${extension}`,
    });

    expect(
      result.structured.findings.filter((f) => f.severity === 'error'),
    ).toEqual([]);
  });
});
