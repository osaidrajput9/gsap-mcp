/**
 * optimize_for_performance — reports what to change, and does not rewrite code.
 *
 * The previous implementation ran
 * `code.replace(/duration:\s*[\d.]+/g, '$&, force3D: true')` over whatever the
 * caller supplied, which corrupted any file containing the word `duration`
 * inside a string or comment, and contradicted gsap-performance: "Do not set
 * will-change or force3D on every element 'just in case'".
 */

import { getSkill } from '../data/skills.js';
import { bestPracticeRules, sections } from '../lib/skill-search.js';
import { SKILL_URI_PREFIX } from '../resources/skills.js';

export const OPTIMIZE_TARGETS = [
  '60fps-desktop',
  'mobile-smooth',
  'battery-efficient',
  'memory-optimized',
] as const;

export interface OptimizeToolInput {
  animation_code: string;
  target?: string;
}

export function optimizeForPerformance({
  animation_code,
  target = '60fps-desktop',
}: OptimizeToolInput): string {
  if (!animation_code?.trim()) {
    throw new Error('animation_code is required');
  }

  const performance = getSkill('gsap-performance');
  const lines = [
    '# GSAP performance review',
    '',
    `Target: \`${target}\`.`,
    '',
    'This tool does not rewrite the supplied code. Use `validate_gsap_code` for',
    'line-level findings; the guidance below is the official performance skill,',
    'quoted rather than paraphrased.',
    '',
  ];

  if (performance) {
    const wanted = new Set([
      'Prefer Transform and Opacity',
      'Many Elements (Stagger, Lists)',
      'Frequently updated properties (e.g. mouse followers)',
      'ScrollTrigger and Performance',
      'Reduce Simultaneous Work',
    ]);

    for (const section of sections(performance)) {
      if (!wanted.has(section.heading)) continue;
      lines.push(
        `## ${section.heading}`,
        '',
        section.text.split('\n').slice(1).join('\n').trim(),
        '',
      );
    }
  }

  const practices = bestPracticeRules().filter(
    (rule) =>
      rule.skill === 'gsap-performance' || rule.skill === 'gsap-scrolltrigger',
  );

  if (practices.length) {
    lines.push(
      '## Checklist',
      '',
      ...practices.map((rule) => `- ${rule.text} _(${rule.skill})_`),
      '',
    );
  }

  lines.push(
    '## Deliberately not recommended',
    '',
    '- Blanket `force3D: true`, or `will-change` on everything. gsap-performance:',
    '  "Do not set will-change or force3D on every element \'just in case\'; use',
    '  for elements that are actually animating."',
    '- `gsap.defaults({ lazy: false })`. Not in the skills, and it disables an',
    '  optimisation GSAP applies on purpose.',
    '- `clearProps` after every tween. It removes the inline styles a',
    '  `toggleActions` reverse needs, so the animation cannot play backwards.',
    '',
    '## Sources',
    '',
    `- \`${SKILL_URI_PREFIX}gsap-performance\``,
    `- \`${SKILL_URI_PREFIX}gsap-scrolltrigger\``,
  );

  return lines.join('\n');
}
