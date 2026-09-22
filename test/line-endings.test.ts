/**
 * Windows checkouts get CRLF line endings, and a stray \r silently broke every
 * parser here.
 *
 * JavaScript's `.` does not match \r — it is a line terminator — so
 * `/^(#{2,4})\s+(.*)$/` fails on "## Stagger\r". sections() returned nothing,
 * and with it doNotRules(), bestPracticeRules() and findSections(). That made
 * get_gsap_api_expert, debug_animation_issue and optimize_for_performance
 * report "nothing matches" for every input, on every Windows install.
 *
 * Reported by a user running `npm test` on Windows: 10 failures, one cause.
 */

import { describe, expect, it } from 'vitest';

import { SKILLS, parseFrontmatter, parseLlmsIndex } from '../src/data/skills.js';
import {
  bestPracticeRules,
  doNotRules,
  findSections,
  sections,
} from '../src/lib/skill-search.js';
import { validateGsapCode } from '../src/tools/validate.js';

describe('the vendored skills are normalised to LF', () => {
  it('no skill carries a carriage return after loading', () => {
    for (const skill of SKILLS) {
      expect(skill.content, `${skill.name} content`).not.toContain('\r');
      expect(skill.body, `${skill.name} body`).not.toContain('\r');
      expect(skill.description, `${skill.name} description`).not.toContain('\r');
      for (const trigger of skill.triggers) {
        expect(trigger, `${skill.name} trigger`).not.toContain('\r');
      }
    }
  });

  it('every skill still yields sections, rules and headings', () => {
    // These are the numbers that collapsed to zero on Windows.
    expect(doNotRules().length).toBeGreaterThan(30);
    expect(bestPracticeRules().length).toBeGreaterThan(20);
    for (const skill of SKILLS) {
      expect(sections(skill).length, `${skill.name}`).toBeGreaterThan(0);
    }
    expect(findSections('autoAlpha')[0]?.heading).toBe(
      'Transforms and CSS properties',
    );
  });
});

describe('parsers tolerate CRLF input directly', () => {
  it('parseFrontmatter splits CRLF frontmatter', () => {
    const { attributes, body } = parseFrontmatter(
      '---\r\nname: gsap-x\r\ndescription: Does a thing\r\n---\r\n# Heading\r\n',
    );
    expect(attributes.name).toBe('gsap-x');
    expect(attributes.description).toBe('Does a thing');
    expect(body.startsWith('# Heading')).toBe(true);
  });

  it('parseLlmsIndex reads a CRLF index', () => {
    const index = parseLlmsIndex(
      '## Skills\r\n\r\ngsap-thing\r\n  Does a thing.\r\n  Triggers: alpha, beta\r\n',
    );
    expect(index.get('gsap-thing')?.triggers).toEqual(['alpha', 'beta']);
  });

  it('sections() finds headings in CRLF markdown', () => {
    // The exact shape that failed: `.` will not cross the \r, so `$` never
    // matched and the heading was invisible.
    const skill = {
      name: 'x',
      description: '',
      triggers: [],
      content: '',
      body: '## Stagger\r\ntext\r\n\r\n## Do Not\r\n- never do this\r\n'.replace(
        /\r\n/g,
        '\n',
      ),
    };
    expect(sections(skill).map((s) => s.heading)).toEqual([
      'Stagger',
      'Do Not',
    ]);
  });
});

describe('validate_gsap_code accepts CRLF source', () => {
  const crlf = [
    'import { gsap } from "gsap";',
    '',
    'gsap.to(".box", { top: 100, duration: 1 });',
  ].join('\r\n');

  it('reports the same findings as the LF equivalent', () => {
    const fromCrlf = validateGsapCode({ code: crlf, filename: 'a.js' });
    const fromLf = validateGsapCode({
      code: crlf.replace(/\r\n/g, '\n'),
      filename: 'a.js',
    });
    expect(fromCrlf.structured.findings).toEqual(fromLf.structured.findings);
  });

  it('still reports the correct line number', () => {
    const [finding] = validateGsapCode({ code: crlf, filename: 'a.js' })
      .structured.findings;
    expect(finding.id).toBe('layout-property');
    expect(finding.line).toBe(3);
    expect(finding.excerpt).not.toContain('\r');
  });
});
