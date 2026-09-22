/**
 * create_production_pattern — renders a catalog pattern.
 *
 * The original tool's `pattern_type` values are kept working by mapping them
 * onto catalog entries, so existing callers keep the behaviour they had.
 */

import { FRAMEWORKS, type Framework } from '../generators/framework.js';
import {
  allPatterns,
  getPattern,
  PATTERNS,
  renderPatternCatalog,
  renderPatternDocument,
} from '../generators/index.js';

/** Legacy `pattern_type` values, mapped to catalog ids. */
export const LEGACY_PATTERN_TYPES: Record<string, string> = {
  'hero-section': 'timeline-sequence',
  'scroll-system': 'scroll-reveal',
  'text-effects': 'text-reveal',
  'interactive-ui': 'hover-interaction',
  'loading-sequence': 'loading-sequence',
  'page-transitions': 'page-transition',
  'micro-interactions': 'hover-interaction',
  'data-visualization': 'data-viz',
};

export const PATTERN_TYPES = [
  ...new Set([...Object.keys(LEGACY_PATTERN_TYPES), ...PATTERNS]),
];

export interface PatternToolInput {
  pattern_type: string;
  framework?: Framework;
  /** Accepted for backward compatibility; it does not change the GSAP. */
  industry?: string;
}

export function createProductionPattern({
  pattern_type,
  framework = 'react',
}: PatternToolInput): string {
  if (!FRAMEWORKS.includes(framework)) {
    throw new Error(
      `Unknown framework "${framework}". Expected one of: ${FRAMEWORKS.join(', ')}`,
    );
  }

  const id = LEGACY_PATTERN_TYPES[pattern_type] ?? pattern_type;
  const pattern = getPattern(id);

  if (!pattern) {
    return [
      `# Unknown pattern: ${pattern_type}`,
      '',
      'Available patterns:',
      '',
      renderPatternCatalog(allPatterns()),
      '',
      'These legacy names still work and map onto the list above:',
      '',
      ...Object.entries(LEGACY_PATTERN_TYPES).map(
        ([legacy, target]) => `- \`${legacy}\` → \`${target}\``,
      ),
    ].join('\n');
  }

  const aliased = id !== pattern_type;

  return [
    `# Production pattern: ${pattern_type}`,
    '',
    aliased ? `Rendered from the \`${id}\` pattern.\n` : '',
    renderPatternDocument(pattern, framework),
  ]
    .filter((line, index, all) => !(line === '' && all[index - 1] === ''))
    .join('\n');
}
