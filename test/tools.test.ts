import { describe, expect, it } from 'vitest';

import { PATTERNS } from '../src/generators/index.js';
import { gsapApiExpert } from '../src/tools/api-expert.js';
import { understandAndCreateAnimation } from '../src/tools/animation.js';
import { debugAnimationIssue } from '../src/tools/debug.js';
import { getGsapGuidance, isConfident } from '../src/tools/guidance.js';
import { matchSkills } from '../src/lib/skill-search.js';
import { optimizeForPerformance } from '../src/tools/optimize.js';
import {
  createProductionPattern,
  LEGACY_PATTERN_TYPES,
} from '../src/tools/pattern.js';
import { generateCompleteSetup } from '../src/tools/setup.js';

describe('get_gsap_guidance', () => {
  it('returns the matching skill in full', () => {
    const output = getGsapGuidance({ topic: 'pin a section on scroll' });
    expect(output).toContain('## Official skill: gsap-scrolltrigger');
    expect(output).toContain('gsap://skills/gsap-scrolltrigger');
    expect(output).toContain('## Pinning');
  });

  it('says so when it has no confident match, instead of guessing', () => {
    const output = getGsapGuidance({ topic: 'center' });
    expect(output).toContain('No confident match');
    expect(output).not.toContain('## Official skill:');
  });

  it('grounds confidence in published trigger terms', () => {
    expect(isConfident(matchSkills('pin a section')[0])).toBe(true);
    expect(isConfident(matchSkills('center')[0])).toBe(false);
    expect(isConfident(undefined)).toBe(false);
  });

  it('honours index_only and max_skills', () => {
    expect(
      getGsapGuidance({ topic: 'ScrollTrigger pin', index_only: true }),
    ).not.toContain('## Official skill:');

    const two = getGsapGuidance({ topic: 'ScrollTrigger pin', max_skills: 2 });
    expect(two.match(/## Official skill:/g)?.length).toBe(2);
  });

  it('rejects empty input', () => {
    expect(() => getGsapGuidance({ topic: '  ' })).toThrow();
  });
});

describe('get_gsap_api_expert', () => {
  it('quotes the section that documents an API', () => {
    const output = gsapApiExpert({ api_element: 'autoAlpha' });
    expect(output).toContain('Transforms and CSS properties');
    expect(output).toContain('gsap://skills/gsap-core');
  });

  it('returns more sections at a higher level', () => {
    const basic = gsapApiExpert({ api_element: 'ScrollTrigger', level: 'basic' });
    const expert = gsapApiExpert({ api_element: 'ScrollTrigger', level: 'expert' });
    expect((expert.match(/^## /gm) ?? []).length).toBeGreaterThan(
      (basic.match(/^## /gm) ?? []).length,
    );
  });

  it('admits when the skills do not cover a term', () => {
    const output = gsapApiExpert({ api_element: 'zzzznotathing' });
    expect(output).toContain('No section of the official GSAP skills mentions');
    expect(output).toContain('All available skills');
  });

  it('redirects a removed API to the one that replaced it', () => {
    // GSAP_COMPLETE_API documented ScrollTrigger.matchMedia as current. The
    // skills only describe gsap.matchMedia(), so that is what comes back.
    const output = gsapApiExpert({ api_element: 'ScrollTrigger.matchMedia' });
    expect(output).toContain('gsap.matchMedia()');
    expect(output).toContain('gsap://skills/gsap-core');
  });
});

describe('understand_and_create_animation', () => {
  it('generates the named pattern', () => {
    const output = understandAndCreateAnimation({
      request: 'fade cards in on scroll',
      pattern: 'scroll-reveal',
      framework: 'react',
    });
    expect(output).toContain('ScrollTrigger.batch');
    expect(output).toContain('**Pattern:** `scroll-reveal`');
  });

  it('offers the catalog rather than guessing when no pattern is named', () => {
    const output = understandAndCreateAnimation({ request: 'something centered' });
    expect(output).toContain('# Pick a pattern');
    expect(output).toContain('No `pattern` was given');
    for (const pattern of PATTERNS) expect(output).toContain(`\`${pattern}\``);
  });

  it('never injects a pattern that was not asked for', () => {
    const output = understandAndCreateAnimation({
      request: 'parallax pinned typewriter drag',
      pattern: 'timeline-sequence',
      framework: 'vanilla',
    });
    expect(output).not.toContain('ScrollTrigger');
    expect(output).not.toContain('Draggable');
    expect(output).not.toContain('SplitText');
  });

  it('maps the legacy context values onto frameworks', () => {
    expect(
      understandAndCreateAnimation({
        request: 'x',
        pattern: 'parallax',
        context: 'vanilla',
      }),
    ).toContain('**Framework:** vanilla');

    // "performance-critical" and "mobile-optimized" were never frameworks.
    expect(
      understandAndCreateAnimation({
        request: 'x',
        pattern: 'parallax',
        context: 'performance-critical',
      }),
    ).toContain('**Framework:** react');
  });

  it('lists the catalog for an unknown pattern', () => {
    expect(
      understandAndCreateAnimation({ request: 'x', pattern: 'nope' }),
    ).toContain('Unknown pattern');
  });

  it('rejects empty input', () => {
    expect(() => understandAndCreateAnimation({ request: '' })).toThrow();
  });
});

describe('create_production_pattern', () => {
  it.each(Object.entries(LEGACY_PATTERN_TYPES))(
    'still answers the legacy name %s',
    (legacy, target) => {
      const output = createProductionPattern({ pattern_type: legacy });
      expect(output).toContain(`# Production pattern: ${legacy}`);
      expect(output).toContain('### Why this code');
      if (legacy !== target) {
        expect(output).toContain(`Rendered from the \`${target}\` pattern.`);
      }
    },
  );

  it('accepts a catalog id directly', () => {
    expect(
      createProductionPattern({ pattern_type: 'draggable', framework: 'vue' }),
    ).toContain('InertiaPlugin');
  });

  it('ignores the cosmetic industry argument', () => {
    const a = createProductionPattern({ pattern_type: 'hero-section', industry: 'saas' });
    const b = createProductionPattern({ pattern_type: 'hero-section', industry: 'game' });
    expect(a).toBe(b);
  });

  it('rejects an unknown framework', () => {
    expect(() =>
      createProductionPattern({
        pattern_type: 'hero-section',
        framework: 'angular' as never,
      }),
    ).toThrow(/Unknown framework/);
  });
});

describe('generate_complete_setup', () => {
  it('produces framework-appropriate lifecycle code', () => {
    expect(generateCompleteSetup({ framework: 'react' })).toContain('useGSAP');
    expect(generateCompleteSetup({ framework: 'vue' })).toContain('onUnmounted');
    expect(generateCompleteSetup({ framework: 'svelte' })).toContain('onMount');
  });

  it('rejects an unknown framework', () => {
    expect(() =>
      generateCompleteSetup({ framework: 'angular' as never }),
    ).toThrow(/Unknown framework/);
  });
});

describe('debug_animation_issue', () => {
  it('routes to the skill and quotes its Do Not rules', () => {
    const output = debugAnimationIssue({
      issue: 'ScrollTrigger positions are wrong after images load',
    });
    expect(output).toContain('gsap://skills/gsap-scrolltrigger');
    expect(output).toContain('ScrollTrigger.refresh()');
  });

  it('no longer suggests the page-wide reset it used to', () => {
    const output = debugAnimationIssue({ issue: 'everything is broken' });
    expect(output).not.toContain('globalTimeline.clear');
    expect(output).not.toContain('clearProps: "all"');
  });

  it('points at the validator when code is supplied', () => {
    expect(
      debugAnimationIssue({ issue: 'jumpy', code: 'gsap.to(".a", { top: 1 });' }),
    ).toContain('validate_gsap_code');
  });

  it('rejects empty input', () => {
    expect(() => debugAnimationIssue({ issue: '' })).toThrow();
  });
});

describe('optimize_for_performance', () => {
  const code = 'gsap.to(".a", { left: 100, duration: 1 });';

  it('returns the code untouched — it reviews, it does not rewrite', () => {
    const output = optimizeForPerformance({ animation_code: code });
    expect(output).toContain('does not rewrite');
    expect(output).not.toContain(code);

    // force3D and lazy:false appear only in the section saying not to use
    // them, never as advice. The old tool appended force3D to the caller's
    // code with a regex.
    const advice = output.slice(0, output.indexOf('## Deliberately not recommended'));
    expect(advice).not.toContain('force3D');
    expect(advice).not.toContain('lazy: false');
  });

  it('quotes the official performance skill', () => {
    const output = optimizeForPerformance({ animation_code: code });
    expect(output).toContain('Prefer Transform and Opacity');
    expect(output).toContain('gsap://skills/gsap-performance');
  });

  it('names what it will not recommend', () => {
    expect(optimizeForPerformance({ animation_code: code })).toContain(
      'Deliberately not recommended',
    );
  });

  it('rejects empty input', () => {
    expect(() => optimizeForPerformance({ animation_code: '' })).toThrow();
  });
});
