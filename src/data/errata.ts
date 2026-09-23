/**
 * Known errors and gaps in the vendored official skills.
 *
 * The skills under `src/data/skills/` are GreenSock's, verbatim, and are
 * replaced wholesale by the weekly sync — editing them would be reverted on
 * the next run and would destroy the one thing that makes them worth serving,
 * which is that they are provably upstream's text and not ours.
 *
 * So corrections live here instead. Every tool that quotes a skill attaches
 * the entries that apply to what it returned, and `gsap://skills/errata`
 * lists them all. The skill resources stay byte-for-byte.
 *
 * `test/errata.test.ts` holds each entry to the text it describes: a
 * correction's quotes must still appear in the named skill, and a gap's
 * `absent` pattern must still match nothing. When upstream fixes something,
 * that test fails and the entry is deleted. An erratum cannot rot quietly
 * into a second source of wrong answers.
 *
 * Everything here was established by running GSAP, not by reading it. The
 * `evidence` field says how.
 */

import { containsTerm } from '../lib/skill-search.js';
import { SKILLS } from './skills.js';

export type ErratumKind = 'correction' | 'gap';

export interface Erratum {
  id: string;
  kind: ErratumKind;
  /** The vendored skill this concerns. */
  skill: string;
  /** Terms that should surface this entry even when the quote is not returned. */
  terms: string[];
  /** Exact strings that must still be present upstream for a correction to apply. */
  quotes: string[];
  /**
   * For a gap: a pattern that must match nothing across the skills. If upstream
   * documents the missing behaviour, this starts matching and the guard fails.
   */
  absent?: string;
  /** What the skills currently say, or fail to say. */
  says: string;
  /** What GSAP actually does. */
  actually: string;
  /** How that was established. */
  evidence: string;
}

export const ERRATA: readonly Erratum[] = Object.freeze([
  {
    id: 'refresh-priority-direction',
    kind: 'correction',
    skill: 'gsap-scrolltrigger',
    terms: ['refreshPriority', 'refresh', 'sort'],
    quotes: [
      'Lower = refreshed first',
      'first on page = lower number',
      // The same advice is repeated in the best-practice list further down, so
      // a fix to the property table alone still leaves it wrong.
      'first section on page = lower number',
    ],
    says:
      'The ScrollTrigger property table states "Lower = refreshed first" and advises giving the first trigger on the page the lower number, and the best-practice list repeats that advice.',
    actually:
      'Higher refreshPriority refreshes first. ScrollTrigger.sort multiplies refreshPriority by -1e6 before comparing, so a larger value sorts earlier. To refresh in page order, give the first trigger on the page the HIGHEST number — the opposite of what the skill advises. (ScrollSmoother\'s -9999 is not a counter-example: that exact value is a sentinel that makes it the `_primary` instance, updated through a separate path rather than by sort order.)',
    evidence:
      'Observed in Chromium with GSAP 3.15.0: three ScrollTriggers created out of order with refreshPriority 0, -10 and 10 fired onRefresh in the order 10, 0, -10.',
  },
  {
    id: 'stagger-function-form',
    kind: 'gap',
    skill: 'gsap-core',
    terms: ['stagger'],
    quotes: [],
    absent: 'stagger\\s*:\\s*(\\(|function)',
    says:
      'The skills document `stagger` as a number and as an object (`{ each, amount, from }`), and mention `gsap.utils.distribute` for advanced cases. They never show `stagger` itself as a function.',
    actually:
      '`stagger` also accepts a function, `(index, target, targets) => seconds`, returning the delay for each target. It is the form to reach for when the offset depends on the element rather than only on its position — data values, measured geometry, or a per-item attribute.',
    evidence:
      'Run against GSAP 3.15.0: `gsap.to(targets, { v: 1, duration: 1, stagger: (index) => index * 0.5 })` started each target 0.5s after the previous one.',
  },
] satisfies Erratum[]);

/** Every erratum touching a named skill. */
export function errataForSkill(skillName: string): Erratum[] {
  return ERRATA.filter((erratum) => erratum.skill === skillName);
}

/**
 * The entries that apply to a piece of tool output.
 *
 * Matched two ways, because either alone leaves a hole: a quote appearing in
 * the returned text means the wrong line is on screen and must not stand
 * uncorrected, and a term matching the query means the reader is asking about
 * the subject even if the section quoted happens not to contain the sentence.
 */
export function matchErrata(output: string, query = ''): Erratum[] {
  return ERRATA.filter((erratum) => {
    if (erratum.quotes.some((quote) => output.includes(quote))) return true;
    return erratum.terms.some(
      (term) => containsTerm(query, term) || containsTerm(output, term),
    );
  });
}

/** Markdown for a set of errata, or an empty array when there are none. */
export function renderErrata(entries: readonly Erratum[]): string[] {
  if (entries.length === 0) return [];

  const lines = [
    '## Corrections to the official skills',
    '',
    'Verified against GSAP by running it. Where this contradicts a quoted',
    'section above, this is right and the section is wrong.',
    '',
  ];

  for (const erratum of entries) {
    lines.push(
      `### ${erratum.id} — \`${erratum.skill}\``,
      '',
      `**${erratum.kind === 'correction' ? 'The skill is wrong' : 'The skills do not cover this'}.** ${erratum.says}`,
      '',
      `**What GSAP does:** ${erratum.actually}`,
      '',
      `_Established by: ${erratum.evidence}_`,
      '',
    );
  }

  return lines;
}

/**
 * Append the errata that apply to assembled tool output.
 *
 * Every tool that quotes a skill ends through here, so a known-wrong line
 * cannot leave the server without the correction attached to it.
 */
export function withErrata(lines: string[], query = ''): string {
  const body = lines.join('\n');
  const entries = matchErrata(body, query);
  if (entries.length === 0) return body;
  return [body.trimEnd(), '', ...renderErrata(entries)].join('\n');
}

/** Sanity: every erratum names a skill that exists. */
export function unknownErrataSkills(): string[] {
  const names = new Set(SKILLS.map((skill) => skill.name));
  return ERRATA.map((e) => e.skill).filter((name) => !names.has(name));
}
