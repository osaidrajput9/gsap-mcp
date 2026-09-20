/**
 * Loader for the vendored official GreenSock agent skills.
 *
 * The files under ./skills are copied verbatim from
 * https://github.com/greensock/gsap-skills (MIT, (c) 2026 GreenSock) and are
 * the single source of truth for every piece of GSAP guidance this server
 * emits. Nothing in this repository should restate GSAP behaviour that is not
 * backed by one of these files.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Directory holding the vendored skills, resolved relative to this module. */
export const SKILLS_DIR = fileURLToPath(new URL('./skills/', import.meta.url));

export interface SkillSource {
  repository: string;
  commit: string;
  commitDate: string;
  syncedAt: string;
  license: string;
  copyright: string;
  /** GSAP release the vendored skills were written against. */
  gsapVersion: string;
}

export interface Skill {
  /** Directory name, which the upstream repo requires to match the frontmatter name. */
  name: string;
  /** `description` from the SKILL.md frontmatter. */
  description: string;
  /** `license` from the frontmatter, if present. */
  license?: string;
  /** One-line summary from llms.txt, when the skill is listed there. */
  summary?: string;
  /** Trigger terms from llms.txt, lowercased. */
  triggers: string[];
  /** Full SKILL.md text, frontmatter included. */
  content: string;
  /** SKILL.md text with the frontmatter block stripped. */
  body: string;
}

/** Splits `---\n...\n---\n` frontmatter off the head of a Markdown document. */
export function parseFrontmatter(text: string): {
  attributes: Record<string, string>;
  body: string;
} {
  const attributes: Record<string, string> = {};
  const normalized = text.replace(/^﻿/, '');

  if (!normalized.startsWith('---')) {
    return { attributes, body: normalized };
  }

  const end = normalized.indexOf('\n---', 3);
  if (end === -1) {
    return { attributes, body: normalized };
  }

  const block = normalized.slice(normalized.indexOf('\n') + 1, end);
  const rest = normalized.slice(end + 4).replace(/^\r?\n/, '');

  for (const line of block.split('\n')) {
    // Frontmatter values routinely contain colons, so only split on the first.
    const separator = line.indexOf(':');
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    if (!key || key.startsWith('#')) continue;
    attributes[key] = line
      .slice(separator + 1)
      .trim()
      .replace(/^["'](.*)["']$/, '$1');
  }

  return { attributes, body: rest };
}

interface LlmsEntry {
  summary: string;
  triggers: string[];
}

/**
 * Parses the `## Skills` section of llms.txt. Each entry is a flush-left skill
 * name followed by indented lines, one of which starts with `Triggers:`.
 */
export function parseLlmsIndex(text: string): Map<string, LlmsEntry> {
  const entries = new Map<string, LlmsEntry>();
  const lines = text.split('\n');

  let inSkills = false;
  let current: string | null = null;
  let summary: string[] = [];
  let triggers: string[] = [];

  const flush = () => {
    if (!current) return;
    entries.set(current, {
      summary: summary.join(' ').trim(),
      triggers,
    });
    current = null;
    summary = [];
    triggers = [];
  };

  for (const raw of lines) {
    const line = raw.replace(/\r$/, '');

    if (/^##\s/.test(line)) {
      flush();
      inSkills = /^##\s+Skills\s*$/i.test(line);
      continue;
    }
    if (!inSkills || !line.trim()) continue;

    if (!/^\s/.test(line)) {
      flush();
      current = line.trim();
      continue;
    }
    if (!current) continue;

    const indented = line.trim();
    const triggerMatch = /^Triggers:\s*(.*)$/i.exec(indented);
    if (triggerMatch) {
      triggers = triggerMatch[1]
        .split(',')
        .map((t) => t.trim().toLowerCase().replace(/\.$/, ''))
        .filter(Boolean);
    } else {
      summary.push(indented);
    }
  }
  flush();

  return entries;
}

function readSkills(): { skills: Skill[]; llmsText: string; source: SkillSource } {
  const llmsText = readFileSync(join(SKILLS_DIR, 'llms.txt'), 'utf8');
  const source = JSON.parse(
    readFileSync(join(SKILLS_DIR, 'SOURCE.json'), 'utf8'),
  ) as SkillSource;
  const index = parseLlmsIndex(llmsText);

  const skills = readdirSync(SKILLS_DIR)
    .filter((entry) => statSync(join(SKILLS_DIR, entry)).isDirectory())
    .sort()
    .flatMap<Skill>((dir) => {
      const file = join(SKILLS_DIR, dir, 'SKILL.md');
      let content: string;
      try {
        content = readFileSync(file, 'utf8');
      } catch {
        // A directory without a SKILL.md is not a skill, per the upstream spec.
        return [];
      }

      const { attributes, body } = parseFrontmatter(content);
      const listed = index.get(dir);

      return [
        {
          name: attributes.name || dir,
          description: attributes.description ?? '',
          license: attributes.license,
          summary: listed?.summary,
          triggers: listed?.triggers ?? [],
          content,
          body,
        },
      ];
    });

  return { skills, llmsText, source };
}

const loaded = readSkills();

/** Every vendored skill, sorted by name. */
export const SKILLS: readonly Skill[] = Object.freeze(loaded.skills);

/** Raw contents of skills/llms.txt. */
export const LLMS_TXT: string = loaded.llmsText;

/** Provenance of the vendored copy. */
export const SKILLS_SOURCE: SkillSource = Object.freeze(loaded.source);

/** GSAP release the vendored skills were written against. */
export const GSAP_VERSION: string = loaded.source.gsapVersion;

const byName = new Map(SKILLS.map((skill) => [skill.name, skill]));

export function getSkill(name: string): Skill | undefined {
  return byName.get(name.trim().toLowerCase());
}

export function skillNames(): string[] {
  return SKILLS.map((skill) => skill.name);
}
