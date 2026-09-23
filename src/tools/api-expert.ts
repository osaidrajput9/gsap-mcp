/**
 * get_gsap_api_expert — look up a GSAP API in the official skills.
 *
 * This replaces the hand-written GSAP_COMPLETE_API object the server used to
 * carry. That object had drifted from GSAP (it advertised
 * `ScrollTrigger.matchMedia`, `throwProps`, and `new SplitText()`), so answers
 * are now quoted out of the vendored GreenSock skills instead of restated.
 */

import { SKILLS } from '../data/skills.js';
import { findSections, matchSkills, suggestApiTerms } from '../lib/skill-search.js';
import { SKILL_URI_PREFIX } from '../resources/skills.js';
import { withErrata } from '../data/errata.js';

export const API_EXPERT_LEVELS = [
  'basic',
  'intermediate',
  'advanced',
  'expert',
] as const;

export type ApiExpertLevel = (typeof API_EXPERT_LEVELS)[number];

/** How many skill sections each detail level is worth. */
const SECTIONS_PER_LEVEL: Record<ApiExpertLevel, number> = {
  basic: 2,
  intermediate: 3,
  advanced: 5,
  expert: 8,
};

export interface ApiExpertInput {
  api_element: string;
  level?: ApiExpertLevel;
}

export function gsapApiExpert({
  api_element,
  level = 'advanced',
}: ApiExpertInput): string {
  const term = api_element.trim();
  if (!term) {
    throw new Error('api_element is required');
  }

  const limit = SECTIONS_PER_LEVEL[level] ?? SECTIONS_PER_LEVEL.advanced;
  const matches = findSections(term, limit);

  const lines: string[] = [`# GSAP API: ${term}`, ''];

  if (matches.length === 0) {
    return [...lines, ...notFound(term)].join('\n');
  }

  const owningSkills = [...new Set(matches.map((match) => match.skill.name))];
  lines.push(
    `Answered from the official GreenSock skills: ${owningSkills
      .map((name) => `\`${name}\``)
      .join(', ')}.`,
    '',
  );

  for (const match of matches) {
    lines.push(
      `## ${match.heading}`,
      '',
      `_Source: \`${match.skill.name}\` — \`${SKILL_URI_PREFIX}${match.skill.name}\`_`,
      '',
      // Drop the section's own heading line; it is reprinted above at a
      // consistent depth.
      match.text.split('\n').slice(1).join('\n').trim(),
      '',
    );
  }

  lines.push(
    '## Full skills',
    '',
    ...owningSkills.map(
      (name) => `- \`${SKILL_URI_PREFIX}${name}\` — read the whole skill`,
    ),
    '',
  );

  return withErrata(lines, term);
}

function notFound(term: string): string[] {
  const lines = [
    `No section of the official GSAP skills mentions \`${term}\`.`,
    '',
    'That may mean the API does not exist, is spelled differently, or is not',
    'covered by the skills. This server does not invent GSAP behaviour, so',
    'nothing is reported rather than guessing.',
    '',
  ];

  const suggestions = suggestApiTerms(term);
  if (suggestions.length) {
    lines.push(
      '## Did you mean',
      '',
      ...suggestions.map((suggestion) => `- \`${suggestion}\``),
      '',
    );
  }

  const related = matchSkills(term).slice(0, 3);
  if (related.length) {
    lines.push(
      '## Closest skills',
      '',
      ...related.map(
        (match) =>
          `- \`${match.skill.name}\` — \`${SKILL_URI_PREFIX}${match.skill.name}\``,
      ),
      '',
    );
  }

  lines.push(
    '## All available skills',
    '',
    ...SKILLS.map(
      (skill) => `- \`${skill.name}\` — \`${SKILL_URI_PREFIX}${skill.name}\``,
    ),
  );

  return lines;
}
