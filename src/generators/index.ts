/**
 * Markdown rendering for generated snippets.
 */

import { GSAP_VERSION } from '../data/skills.js';
import { SKILL_URI_PREFIX } from '../resources/skills.js';
import { fenceLanguage, type Framework } from './framework.js';
import { type Pattern, renderPattern } from './patterns.js';

export * from './framework.js';
export * from './patterns.js';

/** Full write-up for one pattern: the code, why it looks like that, and sources. */
export function renderPatternDocument(
  pattern: Pattern,
  framework: Framework,
): string {
  const lines = [
    `## ${pattern.title}`,
    '',
    pattern.summary,
    '',
  ];

  if (pattern.unofficial) {
    lines.push(
      '> **Not covered by the official GSAP skills.** The notes below say which',
      '> parts are still constrained by them and what the GSAP-native',
      '> alternative is.',
      '',
    );
  }

  lines.push(
    `\`\`\`${fenceLanguage(framework)}`,
    renderPattern(pattern, framework),
    '```',
    '',
    '### Why this code',
    '',
    ...pattern.notes.map((note) => `- ${note}`),
    '',
    '### Sources',
    '',
    ...pattern.skills.map((skill) => `- \`${SKILL_URI_PREFIX}${skill}\``),
    '',
    `Targets GSAP ${GSAP_VERSION}.`,
  );

  return lines.join('\n');
}

/** A short catalog listing, used when a caller has not picked a pattern. */
export function renderPatternCatalog(patterns: Pattern[]): string {
  return patterns
    .map(
      (pattern) =>
        `- \`${pattern.id}\` — ${pattern.title}${
          pattern.unofficial ? ' _(not an official skill)_' : ''
        }\n  ${pattern.summary}`,
    )
    .join('\n');
}
