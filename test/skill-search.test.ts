import { describe, expect, it } from 'vitest';

import { SKILLS, getSkill } from '../src/data/skills.js';
import {
  bestPracticeRules,
  containsTerm,
  doNotRules,
  findSections,
  matchSkills,
  sameStem,
  sections,
  suggestApiTerms,
  tokenize,
} from '../src/lib/skill-search.js';

describe('whole-word matching', () => {
  it('does not let a substring match a term (the bug this replaced)', () => {
    // The old analyzer used String.includes(), so these all matched.
    expect(containsTerm('enter', 'center')).toBe(false);
    expect(containsTerm('center', 'enter')).toBe(false);
    expect(containsTerm('typing', 'pin')).toBe(false);
    expect(containsTerm('showcase', 'show')).toBe(false);
    expect(containsTerm('scrollbar', 'scroll')).toBe(false);
  });

  it('matches a term standing on its own', () => {
    expect(containsTerm('pin the section', 'pin')).toBe(true);
    expect(containsTerm('use gsap.matchMedia() here', 'gsap.matchmedia')).toBe(
      true,
    );
    expect(containsTerm('call ScrollTrigger.refresh()', 'scrolltrigger')).toBe(
      true,
    );
  });

  it('drops stopwords when tokenizing', () => {
    expect(tokenize('how do I pin the section')).toEqual(['pin', 'section']);
  });
});

describe('sameStem', () => {
  it('tolerates a suffix', () => {
    expect(sameStem('jank', 'janky')).toBe(true);
    expect(sameStem('animation', 'animations')).toBe(true);
    expect(sameStem('scroll', 'scrolls')).toBe(true);
  });

  it('never tolerates a prefix difference', () => {
    expect(sameStem('enter', 'center')).toBe(false);
    expect(sameStem('pin', 'spin')).toBe(false);
  });

  it('requires a stem of at least four characters', () => {
    expect(sameStem('pin', 'pins')).toBe(false);
  });
});

describe('matchSkills', () => {
  const cases: Array<[string, string]> = [
    ['how do I pin a section on scroll', 'gsap-scrolltrigger'],
    ['useGSAP cleanup on unmount in React', 'gsap-react'],
    ['vue onMounted animation', 'gsap-frameworks'],
    ['svelte onMount cleanup', 'gsap-frameworks'],
    ['my animation is janky', 'gsap-performance'],
    ['clamp and mapRange', 'gsap-utils'],
    ['stagger from center', 'gsap-core'],
    ['SplitText character reveal', 'gsap-plugins'],
    ['Next.js animation', 'gsap-react'],
  ];

  for (const [topic, expected] of cases) {
    it(`routes ${JSON.stringify(topic)} to ${expected}`, () => {
      expect(matchSkills(topic)[0]?.skill.name).toBe(expected);
    });
  }

  it('reports trigger hits so confidence can be grounded', () => {
    const [top] = matchSkills('pin a section');
    expect(top.triggerHits).toContain('pin');
  });

  it('does not claim a trigger hit for an unrelated topic', () => {
    for (const match of matchSkills('center')) {
      expect(match.triggerHits).toEqual([]);
    }
  });

  it('returns nothing for empty input', () => {
    expect(matchSkills('   ')).toEqual([]);
  });
});

describe('sections', () => {
  it('splits a skill into its headings', () => {
    const headings = sections(getSkill('gsap-core')!).map((s) => s.heading);
    expect(headings).toContain('Stagger');
    expect(headings).toContain('Do Not');
  });

  it('ignores headings inside fenced code', () => {
    for (const skill of SKILLS) {
      for (const section of sections(skill)) {
        expect(section.heading.startsWith('#')).toBe(false);
      }
    }
  });
});

describe('findSections', () => {
  it('prefers the section that defines a term', () => {
    expect(findSections('autoAlpha')[0].heading).toBe(
      'Transforms and CSS properties',
    );
  });

  it('finds a dotted API by its own heading', () => {
    const [top] = findSections('ScrollTrigger.batch');
    expect(top.skill.name).toBe('gsap-scrolltrigger');
    expect(top.heading).toContain('batch');
  });

  it('returns nothing for a term the skills never mention', () => {
    expect(findSections('zzzznotathing')).toEqual([]);
  });
});

describe('rule extraction', () => {
  it('pulls Do Not bullets from every skill', () => {
    const rules = doNotRules();
    expect(rules.length).toBeGreaterThan(30);
    expect(new Set(rules.map((r) => r.skill)).size).toBe(SKILLS.length);
    for (const rule of rules) {
      expect(rule.text.startsWith('❌')).toBe(false);
      expect(rule.text.length).toBeGreaterThan(10);
    }
  });

  it('pulls best-practice bullets', () => {
    const rules = bestPracticeRules();
    expect(rules.length).toBeGreaterThan(20);
    expect(rules.some((r) => r.skill === 'gsap-performance')).toBe(true);
  });
});

describe('suggestApiTerms', () => {
  it('suggests a close API name', () => {
    expect(suggestApiTerms('autoalpha')).toContain('autoAlpha');
  });
});
