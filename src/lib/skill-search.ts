/**
 * Retrieval over the vendored official skills.
 *
 * Matching is deliberately whole-word. The previous implementation scored
 * intents with bare `String.includes()`, so "center" matched "enter", "pin"
 * matched "typing", and "show" matched "showcase". Every comparison here is
 * anchored with boundary lookarounds so a term only matches a term.
 */

import { SKILLS, type Skill } from '../data/skills.js';

/** Words too common to carry signal in a topic string. */
const STOPWORDS = new Set([
  'a', 'about', 'an', 'and', 'any', 'are', 'as', 'at', 'be', 'but', 'by',
  'can', 'do', 'does', 'for', 'from', 'get', 'has', 'have', 'how', 'i', 'in',
  'into', 'is', 'it', 'its', 'me', 'my', 'need', 'of', 'on', 'or', 'should',
  'so', 'some', 'that', 'the', 'their', 'them', 'then', 'there', 'these',
  'they', 'this', 'to', 'use', 'using', 'want', 'was', 'what', 'when',
  'where', 'which', 'why', 'will', 'with', 'you', 'your',
]);

export function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function tokenize(text: string): string[] {
  return normalize(text)
    .split(/[^a-z0-9.+#-]+/)
    .map((token) => token.replace(/^[.+#-]+|[.+#-]+$/g, ''))
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * True when `term` occurs in `haystack` as a whole term. Alphanumerics on
 * either side disqualify the match, so "enter" never satisfies "center".
 */
export function containsTerm(haystack: string, term: string): boolean {
  const needle = normalize(term);
  if (!needle) return false;
  return new RegExp(`(?<![a-z0-9])${escapeRegExp(needle)}(?![a-z0-9])`).test(
    normalize(haystack),
  );
}

/** Counts whole-term occurrences of `term` in `haystack`. */
export function countTerm(haystack: string, term: string): number {
  const needle = normalize(term);
  if (!needle) return 0;
  const pattern = new RegExp(
    `(?<![a-z0-9])${escapeRegExp(needle)}(?![a-z0-9])`,
    'g',
  );
  return normalize(haystack).match(pattern)?.length ?? 0;
}

/**
 * Inflections tolerated when comparing two single words, so "janky" still
 * reaches the "jank" trigger and "animations" reaches "animation".
 *
 * These are suffixes only. "center" can never reach "enter" this way, because
 * that is a difference at the front of the word.
 */
const SUFFIXES = ['s', 'es', 'ed', 'd', 'ing', 'y', 'ies'];

/** True when two words are the same up to a common English suffix. */
export function sameStem(a: string, b: string): boolean {
  if (a === b) return true;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  // Require a real stem so three-letter words cannot absorb each other.
  if (shorter.length < 4 || !longer.startsWith(shorter)) return false;
  return SUFFIXES.includes(longer.slice(shorter.length));
}

/**
 * True when `term` appears in `tokens` as a whole term, allowing a suffix
 * difference on single words. Multi-word phrases must match exactly.
 */
function matchesTrigger(
  haystack: string,
  tokens: readonly string[],
  term: string,
): boolean {
  if (containsTerm(haystack, term)) return true;
  if (term.includes(' ')) return false;
  return tokens.some((token) => sameStem(token, term));
}

export interface SkillMatch {
  skill: Skill;
  score: number;
  /** Why this skill matched, for display. */
  reasons: string[];
}

/**
 * Ranks skills against a free-text topic using the trigger terms published in
 * skills/llms.txt, then the frontmatter description, then section headings.
 */
export function matchSkills(topic: string): SkillMatch[] {
  const query = normalize(topic);
  const tokens = tokenize(topic);
  if (!query) return [];

  const matches: SkillMatch[] = [];

  for (const skill of SKILLS) {
    let score = 0;
    const reasons: string[] = [];

    // An explicit skill name always wins, in either "gsap-core" or
    // "gsap core" spelling.
    if (
      containsTerm(query, skill.name) ||
      containsTerm(query, skill.name.replace(/-/g, ' '))
    ) {
      score += 40;
      reasons.push(`names the ${skill.name} skill`);
    }

    // Trigger terms are the index GreenSock publishes for exactly this job.
    // Longer phrases are more specific, so they are worth more.
    const hitTriggers: string[] = [];
    for (const trigger of skill.triggers) {
      if (!matchesTrigger(query, tokens, trigger)) continue;
      hitTriggers.push(trigger);
      score += 5 + trigger.split(' ').length * 3;
    }
    if (hitTriggers.length) {
      reasons.push(`trigger terms: ${hitTriggers.slice(0, 6).join(', ')}`);
    }

    // Fall back to the prose so an unlisted term can still find a home.
    let descriptionHits = 0;
    for (const token of tokens) {
      if (containsTerm(skill.description, token)) descriptionHits += 1;
    }
    if (descriptionHits) {
      score += Math.min(descriptionHits * 2, 10);
      reasons.push(`${descriptionHits} term(s) in the skill description`);
    }

    let headingHits = 0;
    for (const heading of sectionHeadings(skill)) {
      if (tokens.some((token) => containsTerm(heading, token))) headingHits += 1;
    }
    if (headingHits) {
      score += Math.min(headingHits, 6);
      reasons.push(`${headingHits} matching section heading(s)`);
    }

    // Last resort: the skill body. Scored on *distinct* tokens so a long skill
    // cannot outrank a precise one on sheer volume, and capped below what the
    // published triggers are worth.
    const bodyHits = tokens.filter((token) =>
      containsTerm(skill.body, token),
    ).length;
    if (bodyHits) {
      score += Math.min(bodyHits, 5) * 1.5;
      reasons.push(`${bodyHits} term(s) in the skill body`);
    }

    if (score > 0) matches.push({ skill, score, reasons });
  }

  // Ties break on name so results are stable across runs.
  return matches.sort(
    (a, b) => b.score - a.score || a.skill.name.localeCompare(b.skill.name),
  );
}

export interface SkillSection {
  /** Heading text without the leading hashes. */
  heading: string;
  /** Heading depth (2 for `##`, 3 for `###`). */
  level: number;
  /** Heading line plus everything up to the next heading of the same or higher level. */
  text: string;
}

/** Splits a skill body into its `##`/`###` sections, in document order. */
export function sections(skill: Skill): SkillSection[] {
  const lines = skill.body.split('\n');
  const found: SkillSection[] = [];
  let current: { heading: string; level: number; lines: string[] } | null = null;
  let inFence = false;

  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;

    const headingMatch = !inFence ? /^(#{2,4})\s+(.*)$/.exec(line) : null;
    if (headingMatch) {
      if (current) {
        found.push({
          heading: current.heading,
          level: current.level,
          text: current.lines.join('\n').trimEnd(),
        });
      }
      current = {
        heading: headingMatch[2].trim(),
        level: headingMatch[1].length,
        lines: [line],
      };
      continue;
    }
    if (current) current.lines.push(line);
  }

  if (current) {
    found.push({
      heading: current.heading,
      level: current.level,
      text: current.lines.join('\n').trimEnd(),
    });
  }

  return found;
}

function sectionHeadings(skill: Skill): string[] {
  return sections(skill).map((section) => section.heading);
}

/**
 * True when the section introduces `term` as a definition — a bold bullet or
 * a bold leading table cell, which is how the skills mark up API entries.
 */
function definesTerm(text: string, term: string): boolean {
  const escaped = escapeRegExp(normalize(term));
  return new RegExp(
    `^\\s*(?:[-*]|\\|)\\s*\\*\\*${escaped}(?:\\(\\))?\\*\\*`,
    'im',
  ).test(text);
}

export interface SkillRule {
  skill: string;
  /** Bullet text with the leading marker and emoji stripped. */
  text: string;
}

/** Pulls top-level bullets out of a section, ignoring fenced code. */
function bulletsOf(text: string): string[] {
  const bullets: string[] = [];
  let inFence = false;
  let current: string | null = null;

  for (const line of text.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const bullet = /^[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      if (current) bullets.push(current);
      current = bullet[1].trim();
    } else if (current && /^\s+\S/.test(line)) {
      current += ' ' + line.trim();
    } else if (current && !line.trim()) {
      bullets.push(current);
      current = null;
    }
  }
  if (current) bullets.push(current);

  return bullets
    .map((bullet) => bullet.replace(/^(?:❌|✅)\s*/, '').trim())
    .filter(Boolean);
}

function rulesFromSections(match: RegExp): SkillRule[] {
  const rules: SkillRule[] = [];
  for (const skill of SKILLS) {
    for (const section of sections(skill)) {
      if (!match.test(section.heading)) continue;
      for (const text of bulletsOf(section.text)) {
        rules.push({ skill: skill.name, text });
      }
    }
  }
  return rules;
}

/** Every bullet under a "Do Not" heading, across all skills. */
export function doNotRules(): SkillRule[] {
  return rulesFromSections(/^do not$/i);
}

/** Every bullet under a "best practices" heading, across all skills. */
export function bestPracticeRules(): SkillRule[] {
  return rulesFromSections(/best practices/i);
}

let vocabularyCache: string[] | null = null;

/**
 * Every API term the skills name explicitly — bold definitions (`**autoAlpha**`)
 * and inline code (`` `gsap.matchMedia()` ``). Used to suggest alternatives when
 * a lookup finds nothing.
 */
export function apiVocabulary(): readonly string[] {
  if (vocabularyCache) return vocabularyCache;

  const terms = new Set<string>();
  const patterns = [/\*\*([^*\n]{2,40})\*\*/g, /`([^`\n]{2,40})`/g];

  for (const skill of SKILLS) {
    for (const pattern of patterns) {
      for (const [, raw] of skill.body.matchAll(pattern)) {
        const term = raw.trim().replace(/\(\)$/, '');
        // Keep identifier-shaped terms only; prose in bold is not an API.
        if (!/^[A-Za-z][A-Za-z0-9]*(?:[.:][A-Za-z][A-Za-z0-9]*)*$/.test(term)) {
          continue;
        }
        if (term.length < 3) continue;
        terms.add(term);
      }
    }
  }

  vocabularyCache = [...terms].sort((a, b) => a.localeCompare(b));
  return vocabularyCache;
}

/** Vocabulary entries that plausibly match `term`, best first. */
export function suggestApiTerms(term: string, limit = 8): string[] {
  const query = normalize(term).replace(/\(\)$/, '');
  if (!query) return [];
  const queryTail = query.split('.').pop() ?? query;

  const scored: Array<{ term: string; score: number }> = [];
  for (const candidate of apiVocabulary()) {
    const lower = candidate.toLowerCase();
    const tail = lower.split('.').pop() ?? lower;

    let score = 0;
    if (lower === query) score = 100;
    else if (tail === queryTail) score = 60;
    else if (lower.startsWith(query) || query.startsWith(lower)) score = 40;
    else if (sameStem(tail, queryTail)) score = 30;
    else if (lower.includes(query) && query.length >= 4) score = 20;

    if (score > 0) scored.push({ term: candidate, score });
  }

  return scored
    .sort((a, b) => b.score - a.score || a.term.localeCompare(b.term))
    .slice(0, limit)
    .map((entry) => entry.term);
}

export interface SectionMatch extends SkillSection {
  skill: Skill;
  score: number;
}

/**
 * Finds the sections across all skills that discuss `term` — used to answer
 * questions about a specific API (e.g. "ScrollTrigger.batch", "autoAlpha").
 */
export function findSections(term: string, limit = 6): SectionMatch[] {
  const query = normalize(term);
  if (!query) return [];

  // "gsap.to" should also match prose that writes it as "to()" or "gsap.to()".
  const variants = new Set<string>([query]);
  const dotted = /^([a-z0-9]+)\.([a-z0-9_]+)$/.exec(query);
  if (dotted) variants.add(dotted[2]);
  variants.add(query.replace(/\(\)$/, ''));

  const found: SectionMatch[] = [];

  for (const skill of SKILLS) {
    for (const section of sections(skill)) {
      let score = 0;
      for (const variant of variants) {
        if (containsTerm(section.heading, variant)) score += 10;
        score += Math.min(countTerm(section.text, variant), 4) * 3;
      }
      // A section that only matched the shortened variant is weaker evidence.
      if (score > 0 && containsTerm(section.text, query)) score += 2;
      // The skills define terms in bold, either as a bullet ("- **autoAlpha**
      // — ...") or a table row ("| **shape** | ..."). Prefer the section that
      // defines the term over sections that merely mention it.
      if (score > 0 && definesTerm(section.text, query)) score += 8;
      if (score > 0) found.push({ ...section, skill, score });
    }
  }

  return found
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.skill.name.localeCompare(b.skill.name) ||
        a.heading.localeCompare(b.heading),
    )
    .slice(0, limit);
}
