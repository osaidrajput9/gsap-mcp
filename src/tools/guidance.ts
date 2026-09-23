/**
 * get_gsap_guidance — routes a topic to the official skill that covers it.
 *
 * This replaces INTENT_ANALYZER, which scored eight hand-written keyword lists
 * with `String.prototype.includes()`. That meant "center" matched the "enter"
 * keyword and selected the entrance pattern, "pin" matched "typing", and
 * "show" matched "showcase". Its reported confidence was
 * `score / (keywords.length + boosters.length)`, so a category with fewer
 * keywords always looked more confident than a category with more.
 *
 * Routing is now done against the trigger terms GreenSock publishes in
 * skills/llms.txt, matched on whole words.
 */

import { LLMS_TXT, SKILLS } from '../data/skills.js';
import { matchSkills, type SkillMatch } from '../lib/skill-search.js';
import { SKILL_URI_PREFIX } from '../resources/skills.js';
import { withErrata } from '../data/errata.js';

export interface GuidanceToolInput {
  topic: string;
  /** How many skills to return in full. Default 1. */
  max_skills?: number;
  /** Return only the ranking, without skill bodies. */
  index_only?: boolean;
}

/**
 * A match is reported as confident when it hit at least one published trigger
 * term, or scored well enough on prose alone to be unambiguous. Without this,
 * a topic the skills do not cover still returns a top-ranked skill, which is
 * how the previous analyzer produced confident nonsense.
 */
export function isConfident(match: SkillMatch | undefined): boolean {
  if (!match) return false;
  return match.triggerHits.length > 0 || match.score >= 10;
}

export function getGsapGuidance({
  topic,
  max_skills = 1,
  index_only = false,
}: GuidanceToolInput): string {
  const query = topic?.trim();
  if (!query) {
    throw new Error('topic is required');
  }

  const matches = matchSkills(query);
  const top = matches[0];
  const confident = isConfident(top);

  const lines = [`# GSAP guidance: ${query}`, ''];

  if (!matches.length) {
    return [
      ...lines,
      'No official GSAP skill matches that topic.',
      '',
      'The skills index below lists every topic and the terms that select it.',
      '',
      '```',
      LLMS_TXT.trim(),
      '```',
    ].join('\n');
  }

  if (!confident) {
    lines.push(
      'No confident match. The closest skills are listed below, but none of',
      'them was selected by a published trigger term, so treat this as a',
      'guess rather than an answer. Naming the API or framework involved',
      '(for example "ScrollTrigger pin", "useGSAP cleanup", "SplitText lines")',
      'will route reliably.',
      '',
    );
  }

  lines.push('## Ranked skills', '');
  for (const match of matches.slice(0, 5)) {
    const why = match.triggerHits.length
      ? `trigger terms: ${match.triggerHits.slice(0, 5).join(', ')}`
      : (match.reasons[0] ?? 'weak prose match');
    lines.push(
      `- \`${match.skill.name}\` (score ${match.score.toFixed(1)}) — ${why}`,
    );
  }
  lines.push('');

  if (index_only || !confident) {
    lines.push(
      `Read any of them directly: \`${SKILL_URI_PREFIX}<skill-name>\`.`,
      '',
      'Full index:',
      '',
      '```',
      LLMS_TXT.trim(),
      '```',
    );
    return withErrata(lines, query);
  }

  const count = Math.max(1, Math.min(max_skills, SKILLS.length));
  for (const match of matches.slice(0, count)) {
    lines.push(
      '---',
      '',
      `## Official skill: ${match.skill.name}`,
      '',
      `_Served verbatim from \`${SKILL_URI_PREFIX}${match.skill.name}\`._`,
      '',
      match.skill.body.trim(),
      '',
    );
  }

  return withErrata(lines, query);
}
