/**
 * debug_animation_issue — points a reported problem at the official skills.
 *
 * The previous implementation carried hand-written advice that the skills
 * contradict, including an "emergency reset" of
 * `gsap.globalTimeline.clear(); gsap.set("*", { clearProps: "all" })`, which
 * destroys every animation and inline style on the page. Nothing here is
 * invented: the checklist is the "Do Not" bullets parsed out of the skills.
 */

import { doNotRules, findSections, matchSkills } from '../lib/skill-search.js';
import { SKILL_URI_PREFIX } from '../resources/skills.js';

export interface DebugToolInput {
  issue: string;
  code?: string;
  expected_behavior?: string;
}

export function debugAnimationIssue({
  issue,
  code,
  expected_behavior,
}: DebugToolInput): string {
  if (!issue?.trim()) {
    throw new Error('issue is required');
  }

  const lines = [`# GSAP issue: ${issue.trim()}`, ''];

  if (expected_behavior?.trim()) {
    lines.push(`**Expected:** ${expected_behavior.trim()}`, '');
  }

  const skillMatches = matchSkills(
    [issue, expected_behavior].filter(Boolean).join(' '),
  ).slice(0, 3);

  if (skillMatches.length) {
    lines.push(
      '## Skills that cover this',
      '',
      ...skillMatches.map(
        (match) =>
          `- \`${SKILL_URI_PREFIX}${match.skill.name}\` — ${match.reasons[0] ?? 'related'}`,
      ),
      '',
    );
  }

  const sectionMatches = findSections(issue, 3);
  if (sectionMatches.length) {
    lines.push('## Relevant guidance', '');
    for (const section of sectionMatches) {
      lines.push(
        `### ${section.heading}`,
        '',
        `_\`${SKILL_URI_PREFIX}${section.skill.name}\`_`,
        '',
        section.text.split('\n').slice(1).join('\n').trim(),
        '',
      );
    }
  }

  // The checklist is generated from the skills' own "Do Not" sections, so it
  // cannot drift from them.
  const relevant = rankRules(issue, code);
  if (relevant.length) {
    lines.push(
      '## Check these first',
      '',
      ...relevant.map((rule) => `- ${rule.text} _(${rule.skill})_`),
      '',
    );
  }

  if (code?.trim()) {
    lines.push(
      '## About the supplied code',
      '',
      'Run `validate_gsap_code` on it for line-level findings. This tool only',
      'reports which skills apply; it does not rewrite code.',
      '',
    );
  }

  if (skillMatches.length === 0 && sectionMatches.length === 0) {
    lines.push(
      'Nothing in the official skills matches that description closely enough',
      'to be useful. Try naming the API involved (for example "ScrollTrigger',
      'pin", "SplitText lines", "useGSAP cleanup"), or read',
      `\`${SKILL_URI_PREFIX}index\` for the full list of topics.`,
      '',
    );
  }

  return lines.join('\n').trimEnd();
}

/** Scores "Do Not" rules against the issue text and any supplied code. */
function rankRules(issue: string, code?: string) {
  const haystack = `${issue} ${code ?? ''}`.toLowerCase();
  const terms = haystack.split(/[^a-z0-9.]+/).filter((t) => t.length > 3);
  const unique = new Set(terms);

  return doNotRules()
    .map((rule) => {
      const plain = rule.text.toLowerCase().replace(/[*`]/g, '');
      let score = 0;
      for (const term of unique) {
        if (
          new RegExp(`(?<![a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z0-9])`).test(
            plain,
          )
        ) {
          score += 1;
        }
      }
      return { ...rule, score };
    })
    .filter((rule) => rule.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}
