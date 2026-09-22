import { parseSync } from 'oxc-parser';
import { describe, expect, it } from 'vitest';

import { containerClass } from '../src/generators/framework.js';
import {
  FRAMEWORKS,
  type Framework,
  allPatterns,
  getPattern,
  PATTERNS,
  renderPattern,
  renderPatternDocument,
} from '../src/generators/index.js';
import { renderSetup } from '../src/generators/setup.js';

/** Extracts the JS from a Vue SFC or Svelte component so it can be parsed. */
function scriptOf(code: string, framework: Framework): string {
  if (framework === 'vue' || framework === 'nuxt' || framework === 'svelte') {
    return /<script[^>]*>([\s\S]*?)<\/script>/.exec(code)?.[1] ?? code;
  }
  return code;
}

const combinations = PATTERNS.flatMap((pattern) =>
  FRAMEWORKS.map((framework) => [pattern, framework] as const),
);

describe('generated snippets', () => {
  it.each(combinations)('%s / %s parses', (pattern, framework) => {
    const code = renderPattern(getPattern(pattern)!, framework);
    const extension =
      framework === 'react' || framework === 'nextjs' ? 'jsx' : 'js';
    const { errors } = parseSync(
      `${pattern}.${extension}`,
      scriptOf(code, framework),
      { sourceType: 'module' },
    );
    expect(errors.map((e) => e.message)).toEqual([]);
  });

  it.each(combinations)('%s / %s respects prefers-reduced-motion', (pattern, framework) => {
    const code = renderPattern(getPattern(pattern)!, framework);
    expect(code).toContain('gsap.matchMedia()');
    expect(code).toContain('(prefers-reduced-motion: reduce)');
    // Both queries must be present: a matchMedia handler only runs when a
    // condition matches, so "reduce" alone would disable animation for
    // everyone who has not asked for it.
    expect(code).toContain('(prefers-reduced-motion: no-preference)');
    expect(code).toContain('reduceMotion');
  });

  it.each(combinations)('%s / %s scopes selectors and tears down', (pattern, framework) => {
    const code = renderPattern(getPattern(pattern)!, framework);
    if (framework === 'react' || framework === 'nextjs') {
      expect(code).toContain('{ scope: container }');
      expect(code).toContain('mm.revert()');
    } else if (framework === 'vue' || framework === 'nuxt') {
      expect(code).toContain('onUnmounted');
      expect(code).toContain('mm?.revert()');
    } else if (framework === 'svelte') {
      expect(code).toContain('mm.revert()');
    } else {
      expect(code).toContain('mm.revert()');
    }
  });

  it.each(combinations)('%s / %s contains no discredited API', (pattern, framework) => {
    const code = renderPattern(getPattern(pattern)!, framework);
    expect(code).not.toContain('ScrollTrigger.matchMedia');
    // throwProps may appear in a comment explaining why it is not used;
    // what must never appear is throwProps as an actual tween property.
    expect(code).not.toMatch(/\bthrowProps\s*:/);
    expect(code).not.toContain('new SplitText(');
    expect(code).not.toContain('clearProps');
    expect(code).not.toContain('force3D');
    expect(code).not.toContain('lazy: false');
    expect(code).not.toContain('markers: true');
    expect(code).not.toMatch(/\bTweenMax\b|\bTimelineMax\b/);
    // Killing every trigger on the page destroys other components' triggers.
    expect(code).not.toContain('ScrollTrigger.getAll()');
    expect(code).not.toMatch(/addEventListener\(\s*["']resize["']/);
  });

  // The container must be a strict ANCESTOR of everything a pattern selects.
  // A scoped selector never matches the scope element itself, so a container
  // sitting *on* the markup root silently resolves a trigger pointing at that
  // root to null, and ScrollTrigger falls back to the tween's own target.
  // Verified in the browser suite; asserted statically here so it is still
  // guarded where no browser is available.
  it.each(PATTERNS)('%s: the container class is not used by its markup', (pattern) => {
    const spec = getPattern(pattern)!.build('react');
    expect(spec.markup ?? '').not.toContain(containerClass(spec.componentName));
  });

  it.each(combinations)('%s / %s wraps its markup in the container', (pattern, framework) => {
    const spec = getPattern(pattern)!.build(framework);
    const code = renderPattern(getPattern(pattern)!, framework);
    const wrapper = containerClass(spec.componentName);

    if (framework === 'vanilla') {
      // Vanilla emits no markup; it documents the container it expects.
      expect(code).toContain(`document.querySelector(".${wrapper}")`);
      return;
    }

    const binding =
      framework === 'react' || framework === 'nextjs'
        ? 'ref={container}'
        : framework === 'svelte'
          ? 'bind:this={container}'
          : 'ref="container"';
    const attribute =
      framework === 'react' || framework === 'nextjs' ? 'className' : 'class';

    const wrapperAttr = `${attribute}="${wrapper}"`;
    expect(code).toContain(binding);
    expect(code).toContain(wrapperAttr);

    // The wrapper opens before the pattern's own markup, rather than the
    // binding being merged into the markup's root element.
    const rootClass = /class(?:Name)?="([^"]+)"/
      .exec(spec.markup ?? '')?.[1]
      .split(/\s+/)[0];
    if (rootClass) {
      // Quoted so "scroll-reveal" does not match "scroll-reveal-root".
      const rootAttr = `${attribute}="${rootClass}"`;
      expect(code).toContain(rootAttr);
      expect(code.indexOf(wrapperAttr)).toBeLessThan(code.indexOf(rootAttr));
    }
  });

  it('registers useGSAP for React and not elsewhere', () => {
    for (const pattern of PATTERNS) {
      expect(renderPattern(getPattern(pattern)!, 'react')).toContain(
        'gsap.registerPlugin(useGSAP',
      );
      expect(renderPattern(getPattern(pattern)!, 'vue')).not.toContain(
        'useGSAP',
      );
    }
  });

  it('registers every plugin a pattern imports', () => {
    for (const pattern of PATTERNS) {
      const spec = getPattern(pattern)!.build('vanilla');
      const code = renderPattern(getPattern(pattern)!, 'vanilla');
      for (const plugin of spec.plugins ?? []) {
        expect(code).toContain(`from "gsap/${plugin}"`);
        expect(code).toMatch(
          new RegExp(`gsap\\.registerPlugin\\([^)]*\\b${plugin}\\b`),
        );
      }
    }
  });

  it('uses ease: "none" wherever an animation is scrubbed', () => {
    for (const pattern of ['parallax', 'pinned-section', 'horizontal-scroll'] as const) {
      const code = renderPattern(getPattern(pattern)!, 'vanilla');
      expect(code).toMatch(/scrub/);
      expect(code).toContain('ease: "none"');
    }
  });

  it('never combines scrub with toggleActions', () => {
    for (const pattern of PATTERNS) {
      for (const framework of FRAMEWORKS) {
        const code = renderPattern(getPattern(pattern)!, framework);
        for (const config of code.matchAll(/scrollTrigger:\s*\{([^}]*)\}/g)) {
          const body = config[1];
          expect(/\bscrub\b/.test(body) && /\btoggleActions\b/.test(body)).toBe(
            false,
          );
        }
      }
    }
  });

  it('marks the Lenis pattern as outside the official skills', () => {
    const lenis = getPattern('smooth-scroll-lenis')!;
    expect(lenis.unofficial).toBe(true);
    const doc = renderPatternDocument(lenis, 'react');
    expect(doc).toContain('Not covered by the official GSAP skills');
    // The one requirement the skills do impose on a third-party scroller.
    expect(doc).toContain('ScrollTrigger.update');
  });

  it('cites at least one official skill per pattern', () => {
    for (const pattern of allPatterns()) {
      expect(pattern.skills.length).toBeGreaterThan(0);
      expect(pattern.notes.length).toBeGreaterThan(0);
      const doc = renderPatternDocument(pattern, 'react');
      for (const skill of pattern.skills) {
        expect(doc).toContain(`gsap://skills/${skill}`);
      }
    }
  });
});

describe('renderSetup', () => {
  it.each(FRAMEWORKS)('%s setup parses and installs from the public package', (framework) => {
    const output = renderSetup({ framework, plugins: ['ScrollTrigger'] });
    expect(output).toContain('npm install gsap');
    expect(output).toContain('gsap.registerPlugin');
    // The private registry and auth token are named only to tell the reader
    // not to use them, which gsap-plugins calls outdated advice.
    expect(output).toContain('Do **not** add an');
    // The install command itself must be the public package, nothing else.
    const install = /```bash\n([\s\S]*?)```/.exec(output)?.[1] ?? '';
    expect(install.trim()).toMatch(/^npm install gsap(\s|$)/);
    expect(install).not.toContain('npm.greensock.com');
    expect(install).not.toContain('.npmrc');

    const fence = /```(?:jsx|javascript|vue|svelte)\n([\s\S]*?)```/.exec(
      output.slice(output.indexOf('## 3.')),
    );
    expect(fence).toBeTruthy();
    const { errors } = parseSync(
      `setup-${framework}.${framework === 'react' || framework === 'nextjs' ? 'jsx' : 'js'}`,
      scriptOf(fence![1], framework),
      { sourceType: 'module' },
    );
    expect(errors.map((e) => e.message)).toEqual([]);
  });

  it('adds "use client" for Next.js', () => {
    expect(renderSetup({ framework: 'nextjs' })).toContain('"use client"');
  });

  it('emits the Nuxt composable only for Nuxt', () => {
    expect(renderSetup({ framework: 'nuxt' })).toContain('composables/useGSAP.ts');
    expect(renderSetup({ framework: 'vue' })).not.toContain('composables/useGSAP.ts');
  });

  it('reports plugins it does not recognise instead of importing them', () => {
    const output = renderSetup({
      framework: 'react',
      plugins: ['ScrollTrigger', 'NotARealPlugin'],
    });
    expect(output).toContain('Unrecognised plugins');
    expect(output).toContain('NotARealPlugin');
    expect(output).not.toContain('from "gsap/NotARealPlugin"');
  });
});
