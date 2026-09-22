/**
 * understand_and_create_animation — renders a requested pattern.
 *
 * The tool used to guess which template to emit by running `includes()` over
 * the request string, which is why "center" selected the entrance template (it
 * matched "enter") and why asking for one animation produced three: a parallax
 * block and a pin block were appended whenever the words "parallax" or "pin"
 * appeared anywhere, including inside another word.
 *
 * A caller now names the pattern. When none is given, the request is matched
 * against the official skills and the catalog is offered, rather than one being
 * picked on the caller's behalf.
 */

import { FRAMEWORKS, type Framework } from '../generators/framework.js';
import {
  allPatterns,
  getPattern,
  PATTERNS,
  renderPatternCatalog,
  renderPatternDocument,
} from '../generators/index.js';
import { matchSkills } from '../lib/skill-search.js';
import { SKILL_URI_PREFIX } from '../resources/skills.js';

export { PATTERNS };

export interface AnimationToolInput {
  request: string;
  /** Catalog pattern to render. Omit to get guidance plus the catalog. */
  pattern?: string;
  /** Legacy name for the framework. */
  context?: string;
  framework?: Framework;
  /** Accepted for backward compatibility; it does not change the GSAP. */
  complexity?: string;
}

/** Legacy `context` values mapped onto frameworks. */
const CONTEXT_ALIASES: Record<string, Framework> = {
  react: 'react',
  nextjs: 'nextjs',
  vue: 'vue',
  nuxt: 'nuxt',
  svelte: 'svelte',
  vanilla: 'vanilla',
  // The old enum also accepted these two; neither named a framework, and both
  // defaulted to the React template in practice.
  'performance-critical': 'react',
  'mobile-optimized': 'react',
};

export function resolveFramework(input: AnimationToolInput): Framework {
  if (input.framework && FRAMEWORKS.includes(input.framework)) {
    return input.framework;
  }
  const context = (input.context ?? '').toLowerCase();
  return CONTEXT_ALIASES[context] ?? 'react';
}

export function understandAndCreateAnimation(
  input: AnimationToolInput,
): string {
  const request = input.request?.trim();
  if (!request) {
    throw new Error('request is required');
  }

  const framework = resolveFramework(input);

  if (input.pattern) {
    const pattern = getPattern(input.pattern);
    if (!pattern) {
      return [
        `# Unknown pattern: \`${input.pattern}\``,
        '',
        'Pick one of:',
        '',
        renderPatternCatalog(allPatterns()),
      ].join('\n');
    }

    return [
      '# Generated animation',
      '',
      `**Request:** ${request}`,
      `**Pattern:** \`${pattern.id}\``,
      `**Framework:** ${framework}`,
      '',
      renderPatternDocument(pattern, framework),
    ].join('\n');
  }

  // No pattern named. Say what the skills have to say about the request and
  // show what can be generated, instead of guessing.
  const matches = matchSkills(request).slice(0, 3);

  const lines = [
    '# Pick a pattern',
    '',
    `**Request:** ${request}`,
    `**Framework:** ${framework}`,
    '',
    'No `pattern` was given, so nothing was generated. Call this tool again',
    'with one of the ids below, or read the skills first.',
    '',
  ];

  if (matches.length) {
    lines.push(
      '## Skills covering this request',
      '',
      ...matches.map(
        (match) =>
          `- \`${SKILL_URI_PREFIX}${match.skill.name}\` — ${match.skill.summary ?? match.skill.description.slice(0, 120)}`,
      ),
      '',
      'Or call `get_gsap_guidance` with the same text for the full skill.',
      '',
    );
  } else {
    lines.push(
      'Nothing in the official skills matched that text closely. See',
      `\`${SKILL_URI_PREFIX}index\` for the list of topics.`,
      '',
    );
  }

  lines.push('## Available patterns', '', renderPatternCatalog(allPatterns()));

  return lines.join('\n');
}
