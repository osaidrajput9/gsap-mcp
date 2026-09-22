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
import { understandAndCreateAnimation } from './src/tools/animation.js';
import { generateCompleteSetup } from './src/tools/setup.js';
import { debugAnimationIssue } from './src/tools/debug.js';
import { optimizeForPerformance } from './src/tools/optimize.js';
import { createProductionPattern } from './src/tools/pattern.js';

// ========================================================================================
// ADVANCED INTENT ANALYSIS ENGINE - Understands natural language perfectly
// ========================================================================================

const INTENT_ANALYZER = {
  patterns: {
    scroll_based: {
      keywords: ['scroll', 'scrolling', 'viewport', 'parallax', 'when scrolling', 'on scroll', 'scroll trigger', 'reveal on scroll', 'scroll animation'],
      confidence_boosters: ['viewport', 'parallax', 'when user scrolls', 'scroll into view'],
      techniques: ['ScrollTrigger', 'parallax', 'pin', 'scrub', 'batch processing'],
      best_practices: ['Use ScrollTrigger.batch for performance', 'Add refreshPriority for important triggers', 'Use toggleActions for simple reveals']
    },
    entrance_animations: {
      keywords: ['fade in', 'slide in', 'appear', 'entrance', 'reveal', 'show', 'animate in', 'come in', 'enter'],
      confidence_boosters: ['when page loads', 'on page load', 'initially', 'at start'],
      techniques: ['gsap.from', 'stagger', 'timeline', 'delay'],
      best_practices: ['Use power3.out for natural feel', 'Add stagger for multiple elements', 'Set initial state with gsap.set']
    },
    text_animations: {
      keywords: ['text', 'words', 'characters', 'letters', 'typewriter', 'typing', 'text reveal', 'character by character', 'word by word'],
      confidence_boosters: ['split text', 'character animation', 'typing effect', 'text effect'],
      techniques: ['SplitText', 'stagger', 'char animation', 'word animation'],
      best_practices: ['Use SplitText for complex text effects', 'Add stagger for character reveals', 'Consider performance on mobile']
    },
    interactive: {
      keywords: ['hover', 'click', 'drag', 'interactive', 'on hover', 'on click', 'mouse over', 'touch', 'press'],
      confidence_boosters: ['user interaction', 'interactive', 'drag and drop', 'clickable'],
      techniques: ['event listeners', 'Draggable', 'hover effects', 'click animations'],
      best_practices: ['Add visual feedback', 'Use touch-friendly targets', 'Provide clear interaction hints']
    },
    svg_animations: {
      keywords: ['svg', 'path', 'draw', 'drawing', 'stroke', 'icon', 'vector', 'shape', 'morph'],
      confidence_boosters: ['svg path', 'draw svg', 'svg animation', 'vector animation'],
      techniques: ['DrawSVG', 'MorphSVG', 'MotionPath', 'stroke animation'],
      best_practices: ['Optimize SVG paths', 'Use vector-effect for consistent strokes', 'Consider file size']
    },
    complex_sequences: {
      keywords: ['sequence', 'timeline', 'choreography', 'orchestrate', 'step by step', 'one after another', 'chain'],
      confidence_boosters: ['complex animation', 'sequence', 'timeline', 'choreographed'],
      techniques: ['Timeline', 'labels', 'callbacks', 'nested timelines'],
      best_practices: ['Use labels for complex timelines', 'Add callbacks for events', 'Break complex sequences into smaller timelines']
    },
    performance_critical: {
      keywords: ['smooth', 'performance', '60fps', 'lag', 'stuttering', 'optimize', 'fast', 'efficient'],
      confidence_boosters: ['performance', 'smooth', '60fps', 'optimized'],
      techniques: ['transform properties', 'will-change', 'force3D', 'efficient selectors'],
      best_practices: ['Use transform over layout properties', 'Add will-change CSS', 'Cleanup animations properly']
    },
    smooth_scrolling: {
      keywords: ['smooth scroll', 'lenis', 'buttery', 'smoothness', 'inertia scroll', 'momentum'],
      confidence_boosters: ['feels janky', 'smooth out scrolling', 'luxury feel'],
      techniques: ['Lenis', 'gsap.ticker', 'ScrollTrigger.update'],
      best_practices: ['Sync with gsap.ticker', 'Call lenis.destroy() on unmount', 'Set lagSmoothing(0)']
    },
  },

  analyze: function(request: string) {
    const lowercaseRequest = request.toLowerCase();
    const results = [];

    for (const [patternName, pattern] of Object.entries(this.patterns)) {
      let score = 0;
      let matches = [];

      // Check keywords
      for (const keyword of pattern.keywords) {
        if (lowercaseRequest.includes(keyword)) {
          score += 1;
          matches.push(keyword);
        }
      }

      // Check confidence boosters (worth more points)
      for (const booster of pattern.confidence_boosters) {
        if (lowercaseRequest.includes(booster)) {
          score += 2;
          matches.push(`${booster} (high confidence)`);
        }
      }

      if (score > 0) {
        results.push({
          pattern: patternName,
          confidence: score / (pattern.keywords.length + pattern.confidence_boosters.length),
          raw_score: score,
          matches: matches,
          techniques: pattern.techniques,
          best_practices: pattern.best_practices
        });
      }
    }

    return results.sort((a, b) => b.raw_score - a.raw_score);
  }
};

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