import { describe, expect, it } from 'vitest';

import {
  ERRATA,
  errataForSkill,
  matchErrata,
  unknownErrataSkills,
  withErrata,
} from '../src/data/errata.js';
import { SKILLS, getSkill } from '../src/data/skills.js';
import { SKILL_RESOURCES, readSkillResource } from '../src/resources/skills.js';
import { gsapApiExpert } from '../src/tools/api-expert.js';
import { getGsapGuidance } from '../src/tools/guidance.js';

describe('errata are tied to the text they describe', () => {
  it('name skills that exist', () => {
    expect(unknownErrataSkills()).toEqual([]);
  });

  it('are uniquely identified', () => {
    const ids = ERRATA.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  /**
   * The point of this file. An erratum describes a specific sentence upstream.
   * When GreenSock fixes that sentence, the quote stops matching and this
   * fails — which is the signal to delete the entry. Without it, a correction
   * outlives the error and becomes a second source of wrong answers.
   */
  for (const erratum of ERRATA.filter((e) => e.kind === 'correction')) {
    it(`${erratum.id}: the text it corrects is still in ${erratum.skill}`, () => {
      const skill = getSkill(erratum.skill);
      expect(skill, `skill ${erratum.skill} is missing`).toBeDefined();
      expect(erratum.quotes.length).toBeGreaterThan(0);
      for (const quote of erratum.quotes) {
        expect(
          skill!.content.includes(quote),
          `upstream no longer says "${quote}" — if this was fixed, delete the ${erratum.id} erratum`,
        ).toBe(true);
      }
    });
  }

  /** The mirror image: a gap closes when upstream documents the behaviour. */
  for (const erratum of ERRATA.filter((e) => e.kind === 'gap')) {
    it(`${erratum.id}: the gap in ${erratum.skill} is still open`, () => {
      expect(erratum.absent, 'a gap needs an `absent` pattern').toBeTruthy();
      const pattern = new RegExp(erratum.absent!);
      const covered = SKILLS.filter((skill) => pattern.test(skill.content));
      expect(
        covered.map((s) => s.name),
        `upstream now documents this — delete the ${erratum.id} erratum`,
      ).toEqual([]);
    });
  }
});

describe('errata reach the caller', () => {
  it('correct the refreshPriority direction when the API is looked up', () => {
    const answer = gsapApiExpert({ api_element: 'refreshPriority' });
    expect(answer).toContain('Corrections to the official skills');
    expect(answer).toContain('Higher refreshPriority refreshes first');
  });

  it('attach when the wrong line itself is quoted back', () => {
    // Matched on the returned text, not only on the query, so a section that
    // happens to carry the sentence can never be served bare.
    const entries = matchErrata('| refreshPriority | Lower = refreshed first |');
    expect(entries.map((e) => e.id)).toContain('refresh-priority-direction');
  });

  it('flag the stagger gap when guidance covers staggering', () => {
    const answer = getGsapGuidance({ topic: 'stagger a list of cards' });
    expect(answer).toContain('stagger');
    expect(answer).toContain('(index, target, targets)');
  });

  it('add nothing when no erratum applies', () => {
    const plain = withErrata(['# Something unrelated', '', 'Body text.'], 'draggable inertia');
    expect(plain).not.toContain('Corrections to the official skills');
  });
});

describe('errata are discoverable without changing the skills', () => {
  it('publish a resource listing every entry', () => {
    const resource = readSkillResource('gsap://skills/errata');
    expect(resource).toBeDefined();
    for (const erratum of ERRATA) {
      expect(resource!.text).toContain(erratum.id);
    }
  });

  it('point at it from the description of every affected skill', () => {
    for (const skill of SKILLS) {
      const resource = readSkillResource(`gsap://skills/${skill.name}`)!;
      const known = errataForSkill(skill.name);
      if (known.length === 0) {
        expect(resource.description).not.toContain('known error');
      } else {
        expect(resource.description).toContain('gsap://skills/errata');
        for (const erratum of known) {
          expect(resource.description).toContain(erratum.id);
        }
      }
    }
  });

  /**
   * The provenance guarantee. A skill resource is worth serving because it is
   * demonstrably GreenSock's file and not ours; annotating the body would end
   * that, so corrections live in the description and in tool output instead.
   */
  it('leave every SKILL.md byte-for-byte, errors included', () => {
    for (const skill of SKILLS) {
      const resource = readSkillResource(`gsap://skills/${skill.name}`)!;
      expect(resource.text).toBe(skill.content);
    }
    const scrollTrigger = readSkillResource('gsap://skills/gsap-scrolltrigger')!;
    expect(scrollTrigger.text).toContain('Lower = refreshed first');
    expect(scrollTrigger.text).not.toContain('Corrections to the official skills');
  });

  it('do not leak into the resource count of unaffected skills', () => {
    expect(SKILL_RESOURCES.filter((r) => r.uri.endsWith('/errata'))).toHaveLength(1);
  });
});
