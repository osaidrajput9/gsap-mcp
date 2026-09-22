/**
 * The official GreenSock skills, exposed as MCP resources.
 *
 * `gsap://skills/index`    — the upstream llms.txt discovery index
 * `gsap://skills/license`  — GreenSock's MIT license for the vendored files
 * `gsap://skills/<name>`   — one SKILL.md, verbatim
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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

  const skillResources = SKILLS.map<SkillResource>((skill) => ({
    uri: `${SKILL_URI_PREFIX}${skill.name}`,
    name: skill.name,
    title: `Official GSAP skill: ${skill.name}`,
    description: skill.description,
    mimeType: 'text/markdown',
    text: skill.content,
  }));

  return [index, license, ...skillResources];
}

export const SKILL_RESOURCES: readonly SkillResource[] =
  Object.freeze(buildResources());

const byUri = new Map(SKILL_RESOURCES.map((resource) => [resource.uri, resource]));

export function readSkillResource(uri: string): SkillResource | undefined {
  return byUri.get(uri);
}
