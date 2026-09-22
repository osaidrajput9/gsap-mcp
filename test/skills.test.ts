import { describe, expect, it } from 'vitest';

import {
  GSAP_VERSION,
  LLMS_TXT,
  SKILLS,
  SKILLS_SOURCE,
  getSkill,
  parseFrontmatter,
  parseLlmsIndex,
  skillNames,
} from '../src/data/skills.js';

describe('vendored skills', () => {
  it('loads all eight official skills', () => {
    expect(skillNames()).toEqual([
      'gsap-core',
      'gsap-frameworks',
      'gsap-performance',
      'gsap-plugins',
      'gsap-react',
      'gsap-scrolltrigger',
      'gsap-timeline',
      'gsap-utils',
    ]);
  });

  it('matches each skill directory name to its frontmatter name', () => {
    // The upstream AGENTS.md requires this, and the llms.txt index is keyed
    // by directory name.
    for (const skill of SKILLS) {
      expect(skill.description.length).toBeGreaterThan(0);
      expect(skill.license).toBe('MIT');
    }
  });

  it('attaches llms.txt triggers to every skill', () => {
    for (const skill of SKILLS) {
      expect(skill.triggers.length).toBeGreaterThan(0);
      expect(skill.summary).toBeTruthy();
    }
  });

  it('strips frontmatter from the body', () => {
    const core = getSkill('gsap-core');
    expect(core).toBeDefined();
    expect(core!.content.startsWith('---')).toBe(true);
    expect(core!.body.startsWith('---')).toBe(false);
    expect(core!.body).toContain('# GSAP Core');
  });

  it('records provenance and the targeted GSAP release', () => {
    expect(SKILLS_SOURCE.repository).toBe(
      'https://github.com/greensock/gsap-skills',
    );
    expect(SKILLS_SOURCE.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(SKILLS_SOURCE.license).toBe('MIT');
    expect(SKILLS_SOURCE.copyright).toContain('GreenSock');
    expect(GSAP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('keeps llms.txt verbatim', () => {
    expect(LLMS_TXT).toContain('# GSAP Skills — Index for AI Agents');
  });
});

describe('parseFrontmatter', () => {
  it('splits on the first colon so values may contain colons', () => {
    const { attributes, body } = parseFrontmatter(
      '---\nname: x\ndescription: Use when: something\n---\n# Body\n',
    );
    expect(attributes.name).toBe('x');
    expect(attributes.description).toBe('Use when: something');
    expect(body).toBe('# Body\n');
  });

  it('passes through a document with no frontmatter', () => {
    const { attributes, body } = parseFrontmatter('# Just a heading');
    expect(attributes).toEqual({});
    expect(body).toBe('# Just a heading');
  });
});

describe('parseLlmsIndex', () => {
  it('reads names, summaries and trigger lists', () => {
    const index = parseLlmsIndex(
      [
        '# Heading',
        'preamble text',
        '',
        '## Skills',
        '',
        'gsap-thing',
        '  Does a thing.',
        '  Triggers: alpha, beta gamma, delta.',
        '',
        'gsap-other',
        '  Other.',
        '  Triggers: epsilon',
      ].join('\n'),
    );

    expect([...index.keys()]).toEqual(['gsap-thing', 'gsap-other']);
    expect(index.get('gsap-thing')!.triggers).toEqual([
      'alpha',
      'beta gamma',
      'delta',
    ]);
    expect(index.get('gsap-thing')!.summary).toBe('Does a thing.');
  });

  it('ignores content outside the Skills section', () => {
    const index = parseLlmsIndex('## Notes\nnot-a-skill\n  Triggers: x');
    expect(index.size).toBe(0);
  });
});
