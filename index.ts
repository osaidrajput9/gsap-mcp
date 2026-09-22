#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { GSAP_VERSION, SKILLS_SOURCE } from './src/data/skills.js';
import { SKILL_RESOURCES, readSkillResource } from './src/resources/skills.js';
import { FRAMEWORKS, type Framework } from './src/generators/framework.js';
import { PATTERNS } from './src/generators/patterns.js';
import { SETUP_PLUGINS } from './src/generators/setup.js';
import { PATTERN_TYPES } from './src/tools/pattern.js';
import { gsapApiExpert, type ApiExpertLevel } from './src/tools/api-expert.js';
import { getGsapGuidance } from './src/tools/guidance.js';
import { understandAndCreateAnimation } from './src/tools/animation.js';
import { generateCompleteSetup } from './src/tools/setup.js';
import { debugAnimationIssue } from './src/tools/debug.js';
import { optimizeForPerformance } from './src/tools/optimize.js';
import { createProductionPattern } from './src/tools/pattern.js';

// ========================================================================================
// MCP SERVER SETUP - Bulletproof and production ready
// ========================================================================================

const server = new Server(
  {
    name: 'gsap-mcp',
    version: '2.0.0',
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
);

// ========================================================================================
// RESOURCES - The official GreenSock skills, served verbatim
// ========================================================================================

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: SKILL_RESOURCES.map(({ uri, name, title, description, mimeType }) => ({
    uri,
    name,
    title,
    description,
    mimeType,
  })),
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const resource = readSkillResource(request.params.uri);
  if (!resource) {
    throw new Error(
      `Unknown resource: ${request.params.uri}. Available: ${SKILL_RESOURCES.map((r) => r.uri).join(', ')}`,
    );
  }
  return {
    contents: [
      { uri: resource.uri, mimeType: resource.mimeType, text: resource.text },
    ],
  };
});

// Define all tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'understand_and_create_animation',
        description: 'The main AI engine - understands any animation request and generates perfect GSAP code with surgical precision',
        inputSchema: {
          type: 'object',
          properties: {
            request: {
              type: 'string',
              description: 'Natural language description of the animation you want (e.g., "fade in cards one by one when scrolling", "create a hero entrance with staggered text")'
            },
            context: {
              type: 'string',
              description: 'Development context and requirements',
              enum: ['react', 'vanilla', 'nextjs', 'vue', 'performance-critical', 'mobile-optimized'],
              default: 'react'
            },
            pattern: {
              type: 'string',
              description: 'Which pattern to generate. Omit to receive the matching skills plus the catalog instead of a guess.',
              enum: [...PATTERNS]
            },
            framework: {
              type: 'string',
              description: 'Target framework (preferred over the legacy "context" argument)',
              enum: [...FRAMEWORKS]
            },
            complexity: {
              type: 'string',
              description: 'Accepted for backward compatibility; does not change the generated GSAP',
              enum: ['simple', 'intermediate', 'advanced', 'expert'],
              default: 'intermediate'
            }
          },
          required: ['request']
        }
      },
      {
        name: 'get_gsap_guidance',
        description: 'Return the official GreenSock skill that covers a topic, routed through the trigger terms in skills/llms.txt',
        inputSchema: {
          type: 'object',
          properties: {
            topic: {
              type: 'string',
              description: 'What you need to know, e.g. "pin a section on scroll", "useGSAP cleanup", "stagger from center"'
            },
            max_skills: {
              type: 'number',
              description: 'How many matching skills to return in full (default 1)',
              minimum: 1,
              maximum: 8,
              default: 1
            },
            index_only: {
              type: 'boolean',
              description: 'Return only the ranking, without skill bodies',
              default: false
            }
          },
          required: ['topic']
        }
      },
      {
        name: 'get_gsap_api_expert',
        description: 'Deep dive into any GSAP method, plugin, or property with expert-level knowledge',
        inputSchema: {
          type: 'object',
          properties: {
            api_element: {
              type: 'string',
              description: 'GSAP API element (e.g., "gsap.to", "ScrollTrigger", "SplitText", "drawSVG", "morphSVG")'
            },
            level: {
              type: 'string',
              description: 'Detail level needed',
              enum: ['basic', 'intermediate', 'advanced', 'expert'],
              default: 'advanced'
            }
          },
          required: ['api_element']
        }
      },
      {
        name: 'generate_complete_setup',
        description: 'Generate complete GSAP environment setup with all plugins and optimizations',
        inputSchema: {
          type: 'object',
          properties: {
            framework: {
              type: 'string',
              description: 'Target framework',
              enum: ['react', 'nextjs', 'vue', 'nuxt', 'svelte', 'vanilla'],
              default: 'react'
            },
            plugins: {
              type: 'array',
              description: 'Specific plugins needed',
              items: {
                type: 'string',
                enum: [...SETUP_PLUGINS, 'Lenis']
              }
            },
            performance_level: {
              type: 'string',
              description: 'Accepted for backward compatibility; the skills give one correct answer',
              enum: ['basic', 'optimized', '60fps-guaranteed', 'mobile-first'],
              default: 'optimized'
            }
          },
          required: ['framework']
        }
      },
      {
        name: 'debug_animation_issue',
        description: 'Expert debugging for GSAP animation problems with solutions',
        inputSchema: {
          type: 'object',
          properties: {
            issue: {
              type: 'string',
              description: 'Description of the animation problem or unexpected behavior'
            },
            code: {
              type: 'string',
              description: 'Problematic animation code (optional but helpful)'
            },
            expected_behavior: {
              type: 'string',
              description: 'What should happen vs what is happening'
            }
          },
          required: ['issue']
        }
      },
      {
        name: 'optimize_for_performance',
        description: 'Transform any animation into 60fps smoothness with expert optimizations',
        inputSchema: {
          type: 'object',
          properties: {
            animation_code: {
              type: 'string',
              description: 'Existing GSAP animation code to optimize'
            },
            target: {
              type: 'string',
              description: 'Optimization target',
              enum: ['60fps-desktop', 'mobile-smooth', 'battery-efficient', 'memory-optimized'],
              default: '60fps-desktop'
            }
          },
          required: ['animation_code']
        }
      },
      {
        name: 'create_production_pattern',
        description: 'Generate battle-tested, production-ready animation patterns',
        inputSchema: {
          type: 'object',
          properties: {
            pattern_type: {
              type: 'string',
              description: 'Type of production pattern needed',
              enum: [...PATTERN_TYPES]
            },
            framework: {
              type: 'string',
              description: 'Target framework',
              enum: [...FRAMEWORKS],
              default: 'react'
            },
            industry: {
              type: 'string',
              description: 'Accepted for backward compatibility; does not change the generated GSAP',
              enum: ['portfolio', 'ecommerce', 'saas', 'agency', 'blog', 'app', 'game'],
              default: 'portfolio'
            }
          },
          required: ['pattern_type']
        }
      }
    ]
  };
});

// Handle tool requests with expert-level responses
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'understand_and_create_animation': {
        return {
          content: [{
            type: 'text',
            text: understandAndCreateAnimation({
              request: args?.request as string,
              pattern: args?.pattern as string | undefined,
              context: args?.context as string | undefined,
              framework: args?.framework as Framework | undefined,
              complexity: args?.complexity as string | undefined,
            }),
          }]
        };
      }

      case 'get_gsap_guidance': {
        return {
          content: [{
            type: 'text',
            text: getGsapGuidance({
              topic: args?.topic as string,
              max_skills: args?.max_skills as number | undefined,
              index_only: args?.index_only as boolean | undefined,
            }),
          }]
        };
      }

      case 'get_gsap_api_expert': {
        const apiElement = args?.api_element as string;
        const level = (args?.level as ApiExpertLevel) || 'advanced';

        if (!apiElement) {
          throw new Error('API element is required');
        }

        return {
          content: [{ type: 'text', text: gsapApiExpert({ api_element: apiElement, level }) }]
        };
      }

      case 'generate_complete_setup': {
        return {
          content: [{
            type: 'text',
            text: generateCompleteSetup({
              framework: (args?.framework as Framework) ?? 'react',
              plugins: args?.plugins as string[] | undefined,
              performance_level: args?.performance_level as string | undefined,
            }),
          }]
        };
      }

      case 'debug_animation_issue': {
        return {
          content: [{
            type: 'text',
            text: debugAnimationIssue({
              issue: args?.issue as string,
              code: args?.code as string | undefined,
              expected_behavior: args?.expected_behavior as string | undefined,
            }),
          }]
        };
      }

      case 'optimize_for_performance': {
        return {
          content: [{
            type: 'text',
            text: optimizeForPerformance({
              animation_code: args?.animation_code as string,
              target: args?.target as string | undefined,
            }),
          }]
        };
      }

      case 'create_production_pattern': {
        return {
          content: [{
            type: 'text',
            text: createProductionPattern({
              pattern_type: args?.pattern_type as string,
              framework: args?.framework as Framework | undefined,
              industry: args?.industry as string | undefined,
            }),
          }]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{ 
        type: 'text', 
        text: `❌ **Error**: ${error instanceof Error ? error.message : 'Unknown error occurred'}\n\nPlease check your request and try again. If the issue persists, the animation description might need to be more specific.` 
      }],
      isError: true
    };
  }
});

// Start the server with bulletproof error handling
async function main() {
  try {
    console.error('INFO: Starting GSAP MCP server...');
    console.error(
      `INFO: Loaded ${SKILL_RESOURCES.length} resources from the official GreenSock skills ` +
        `(${SKILLS_SOURCE.commit.slice(0, 7)}, GSAP ${GSAP_VERSION})`,
    );
    
    const transport = new StdioServerTransport();
    console.error('🔌 INFO: Transport initialized: stdio');
    
    await server.connect(transport);
    console.error('✅ INFO: Ultimate GSAP MCP Server started successfully');
    console.error('🎯 INFO: Ready to create pixel-perfect animations with surgical precision!');
  } catch (error) {
    console.error('💥 FATAL ERROR:', error);
    process.exit(1);
  }
}

// Handle process signals gracefully
process.on('SIGINT', () => {
  console.error('👋 INFO: Gracefully shutting down GSAP MCP Server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('👋 INFO: Gracefully shutting down GSAP MCP Server...');
  process.exit(0);
});

main().catch((error) => {
  console.error('💥 FATAL ERROR in main():', error);
  process.exit(1);
});