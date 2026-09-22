/**
 * MCP server assembly.
 *
 * Kept separate from the entry point so tests can build a server and drive it
 * over an in-memory or stdio transport without spawning a process.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { GSAP_VERSION, SKILLS_SOURCE } from './data/skills.js';
import { FRAMEWORKS } from './generators/framework.js';
import { PATTERNS } from './generators/patterns.js';
import { SETUP_PLUGINS } from './generators/setup.js';
import { SKILL_RESOURCES } from './resources/skills.js';
import {
  API_EXPERT_LEVELS,
  gsapApiExpert,
} from './tools/api-expert.js';
import { understandAndCreateAnimation } from './tools/animation.js';
import { debugAnimationIssue } from './tools/debug.js';
import { getGsapGuidance } from './tools/guidance.js';
import { optimizeForPerformance, OPTIMIZE_TARGETS } from './tools/optimize.js';
import { createProductionPattern, PATTERN_TYPES } from './tools/pattern.js';
import { generateCompleteSetup } from './tools/setup.js';
import {
  validateGsapCode,
  VALIDATION_FINDING_SHAPE,
} from './tools/validate.js';

export const SERVER_NAME = 'gsap-mcp';
export const SERVER_VERSION = '2.0.0';

/**
 * Every tool here reads vendored data and returns text. None writes to disk,
 * spawns a process, or makes a network request, so all of them carry
 * readOnlyHint.
 */
const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const frameworkSchema = z.enum(FRAMEWORKS);

/** z.enum needs a non-empty tuple; these lists are derived at runtime. */
function nonEmpty(values: readonly string[]): [string, ...string[]] {
  if (values.length === 0) {
    throw new Error('expected at least one value for an enum');
  }
  return values as unknown as [string, ...string[]];
}

function text(value: string) {
  return { content: [{ type: 'text' as const, text: value }] };
}

export function buildServer(): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      capabilities: { resources: {}, tools: {} },
      instructions: [
        'GSAP animation guidance backed by the official GreenSock agent skills',
        `(${SKILLS_SOURCE.repository} @ ${SKILLS_SOURCE.commit.slice(0, 7)}, GSAP ${GSAP_VERSION}).`,
        '',
        'Start with get_gsap_guidance for any "how do I" question — it returns the',
        'official skill rather than a paraphrase. Read a skill directly at',
        'gsap://skills/<name>, or gsap://skills/index for the full list.',
        'Run validate_gsap_code over existing GSAP before changing it.',
      ].join('\n'),
    },
  );

  for (const resource of SKILL_RESOURCES) {
    server.registerResource(
      resource.name,
      resource.uri,
      {
        title: resource.title,
        description: resource.description,
        mimeType: resource.mimeType,
      },
      async (uri) => ({
        contents: [
          {
            uri: uri.href,
            mimeType: resource.mimeType,
            text: resource.text,
          },
        ],
      }),
    );
  }

  server.registerTool(
    'get_gsap_guidance',
    {
      title: 'Get official GSAP guidance',
      description:
        'Return the official GreenSock skill covering a topic, routed through the trigger terms published in skills/llms.txt. Use this before writing GSAP.',
      inputSchema: {
        topic: z
          .string()
          .min(1)
          .describe(
            'What you need to know, e.g. "pin a section on scroll", "useGSAP cleanup", "stagger from center"',
          ),
        max_skills: z
          .number()
          .int()
          .min(1)
          .max(8)
          .optional()
          .describe('How many matching skills to return in full (default 1)'),
        index_only: z
          .boolean()
          .optional()
          .describe('Return only the ranking, without skill bodies'),
      },
      annotations: READ_ONLY,
    },
    async (args) => text(getGsapGuidance(args)),
  );

  server.registerTool(
    'validate_gsap_code',
    {
      title: 'Validate GSAP code against the official skills',
      description:
        'Check GSAP code for violations of the official GreenSock skills: layout-property animation, missing registerPlugin, useGSAP without scope, useGSAP unregistered, missing cleanup in React/Vue/Svelte, chained delays instead of timelines, missing ScrollTrigger.refresh after layout changes, opacity where autoAlpha fits, and deprecated APIs. Returns findings with line numbers, suggested fixes and the skill rule each comes from.',
      inputSchema: {
        code: z.string().min(1).describe('The GSAP source to check'),
        filename: z
          .string()
          .optional()
          .describe(
            'File name or path, used to infer the framework (.jsx/.tsx, .vue, .svelte)',
          ),
        framework: frameworkSchema
          .optional()
          .describe('Override the framework inferred from the filename'),
      },
      outputSchema: VALIDATION_FINDING_SHAPE,
      annotations: READ_ONLY,
    },
    async (args) => {
      const result = validateGsapCode(args);
      return { ...text(result.summary), structuredContent: result.structured };
    },
  );

  server.registerTool(
    'understand_and_create_animation',
    {
      title: 'Generate a GSAP animation',
      description:
        'Generate a GSAP snippet for a named pattern. Omit `pattern` to get the matching official skills and the pattern catalog instead of a guess.',
      inputSchema: {
        request: z
          .string()
          .min(1)
          .describe('Plain-language description of the animation'),
        pattern: z
          .enum(PATTERNS)
          .optional()
          .describe('Which pattern to generate. Omit to receive the catalog.'),
        framework: frameworkSchema.optional().describe('Target framework'),
        context: z
          .string()
          .optional()
          .describe('Legacy alias for `framework`'),
        complexity: z
          .string()
          .optional()
          .describe(
            'Accepted for backward compatibility; does not change the generated GSAP',
          ),
      },
      annotations: READ_ONLY,
    },
    async (args) => text(understandAndCreateAnimation(args)),
  );

  server.registerTool(
    'get_gsap_api_expert',
    {
      title: 'Look up a GSAP API',
      description:
        'Quote the sections of the official GreenSock skills that document a GSAP method, property or plugin.',
      inputSchema: {
        api_element: z
          .string()
          .min(1)
          .describe('e.g. "gsap.to", "ScrollTrigger.batch", "autoAlpha", "SplitText"'),
        level: z
          .enum(API_EXPERT_LEVELS)
          .optional()
          .describe('How many sections to return (default "advanced")'),
      },
      annotations: READ_ONLY,
    },
    async (args) => text(gsapApiExpert(args)),
  );

  server.registerTool(
    'generate_complete_setup',
    {
      title: 'Generate GSAP project setup',
      description:
        'Install commands, plugin registration and a starter component for a framework, following the official skills.',
      inputSchema: {
        framework: frameworkSchema.describe('Target framework'),
        plugins: z
          .array(z.enum(nonEmpty([...SETUP_PLUGINS, 'Lenis'])))
          .optional()
          .describe('Plugins to register'),
        performance_level: z
          .string()
          .optional()
          .describe(
            'Accepted for backward compatibility; the skills give one correct answer',
          ),
      },
      annotations: READ_ONLY,
    },
    async (args) => text(generateCompleteSetup(args)),
  );

  server.registerTool(
    'debug_animation_issue',
    {
      title: 'Diagnose a GSAP problem',
      description:
        'Point a reported animation problem at the official skills that cover it, with a checklist drawn from their "Do Not" sections.',
      inputSchema: {
        issue: z.string().min(1).describe('What is going wrong'),
        code: z
          .string()
          .optional()
          .describe('The GSAP involved (run validate_gsap_code for line-level findings)'),
        expected_behavior: z
          .string()
          .optional()
          .describe('What should happen instead'),
      },
      annotations: READ_ONLY,
    },
    async (args) => text(debugAnimationIssue(args)),
  );

  server.registerTool(
    'optimize_for_performance',
    {
      title: 'Review GSAP performance',
      description:
        'Return the official GSAP performance guidance for some code. Reports what to change; does not rewrite the code.',
      inputSchema: {
        animation_code: z.string().min(1).describe('The GSAP to review'),
        target: z
          .enum(OPTIMIZE_TARGETS)
          .optional()
          .describe('Optimisation target'),
      },
      annotations: READ_ONLY,
    },
    async (args) => text(optimizeForPerformance(args)),
  );

  server.registerTool(
    'create_production_pattern',
    {
      title: 'Generate a production animation pattern',
      description:
        'Render a ready-made animation pattern for a framework, with the official skills each decision follows.',
      inputSchema: {
        pattern_type: z
          .enum(nonEmpty(PATTERN_TYPES))
          .describe('Which pattern to generate'),
        framework: frameworkSchema.optional().describe('Target framework'),
        industry: z
          .string()
          .optional()
          .describe(
            'Accepted for backward compatibility; does not change the generated GSAP',
          ),
      },
      annotations: READ_ONLY,
    },
    async (args) => text(createProductionPattern(args)),
  );

  return server;
}
