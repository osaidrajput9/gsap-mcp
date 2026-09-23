/**
 * The official GreenSock skills, exposed as MCP resources.
 *
 * `gsap://skills/index`    — the upstream llms.txt discovery index
 * `gsap://skills/license`  — GreenSock's MIT license for the vendored files
 * `gsap://skills/errata`   — where the skills are wrong, and what GSAP does
 * `gsap://skills/<name>`   — one SKILL.md, verbatim
 *
 * The SKILL.md resources stay byte-for-byte upstream even where an erratum
 * says a line in them is wrong: their value is that they are provably
 * GreenSock's text rather than ours. The correction is carried in the
 * resource description instead, and attached to every tool answer that
 * touches the subject.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ERRATA, errataForSkill, renderErrata } from '../data/errata.js';
import {
  LLMS_TXT,
  SKILLS,
  SKILLS_DIR,
  SKILLS_SOURCE,
} from '../data/skills.js';

export const SKILL_URI_PREFIX = 'gsap://skills/';

export interface SkillResource {
  uri: string;
  /** Stable machine name for the resource. */
  name: string;
  title: string;
  description: string;
  mimeType: string;
  text: string;
}

function provenanceHeader(): string {
  return [
    `Source: ${SKILLS_SOURCE.repository}`,
    `Commit: ${SKILLS_SOURCE.commit} (${SKILLS_SOURCE.commitDate})`,
    `Synced: ${SKILLS_SOURCE.syncedAt}`,
    `License: ${SKILLS_SOURCE.license} — ${SKILLS_SOURCE.copyright}`,
    `Written against GSAP ${SKILLS_SOURCE.gsapVersion}`,
  ].join('\n');
}

function buildResources(): SkillResource[] {
  const index: SkillResource = {
    uri: `${SKILL_URI_PREFIX}index`,
    name: 'gsap-skills-index',
    title: 'GSAP skills index (llms.txt)',
    description:
      'Official GreenSock discovery index listing every GSAP skill and the trigger terms that select it.',
    mimeType: 'text/plain',
    text: `${provenanceHeader()}\n\n${LLMS_TXT}`,
  };

  const license: SkillResource = {
    uri: `${SKILL_URI_PREFIX}license`,
    name: 'gsap-skills-license',
    title: 'GSAP skills license (MIT, GreenSock)',
    description:
      'MIT license covering the vendored copy of the official GreenSock agent skills.',
    mimeType: 'text/plain',
    text: readFileSync(join(SKILLS_DIR, 'LICENSE'), 'utf8').replace(
      /\r\n?/g,
      '\n',
    ),
  };

  const errata: SkillResource = {
    uri: `${SKILL_URI_PREFIX}errata`,
    name: 'gsap-skills-errata',
    title: 'Corrections to the official GSAP skills',
    description:
      ERRATA.length === 0
        ? 'No known errors in the vendored skills.'
        : `${ERRATA.length} known error(s) and gap(s) in the vendored skills, each verified by running GSAP ${SKILLS_SOURCE.gsapVersion}.`,
    mimeType: 'text/markdown',
    text: [
      '# Corrections to the official GSAP skills',
      '',
      provenanceHeader(),
      '',
      'The vendored SKILL.md files are served byte-for-byte, errors included,',
      'because their worth is that they are provably upstream. Everything below',
      'was established by running GSAP rather than by reading it, and overrides',
      'the skill text it names.',
      '',
      ...renderErrata(ERRATA),
    ].join('\n'),
  };

  const skillResources = SKILLS.map<SkillResource>((skill) => {
    const known = errataForSkill(skill.name);
    return {
      uri: `${SKILL_URI_PREFIX}${skill.name}`,
      name: skill.name,
      title: `Official GSAP skill: ${skill.name}`,
      // Served verbatim, so a reader of the raw file needs telling here that
      // part of it is known to be wrong.
      description: known.length
        ? `${skill.description}\n\nNOTE: ${known.length} known error(s) in this file — see ${SKILL_URI_PREFIX}errata (${known.map((e) => e.id).join(', ')}).`
        : skill.description,
      mimeType: 'text/markdown',
      text: skill.content,
    };
  });

  return [index, license, errata, ...skillResources];
}

export const SKILL_RESOURCES: readonly SkillResource[] =
  Object.freeze(buildResources());

const byUri = new Map(SKILL_RESOURCES.map((resource) => [resource.uri, resource]));

export function readSkillResource(uri: string): SkillResource | undefined {
  return byUri.get(uri);
}
