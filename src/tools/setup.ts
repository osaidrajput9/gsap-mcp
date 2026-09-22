/**
 * generate_complete_setup — thin wrapper over the setup generator.
 */

import { FRAMEWORKS, type Framework } from '../generators/framework.js';
import { renderSetup } from '../generators/setup.js';

export interface SetupToolInput {
  framework: Framework;
  plugins?: string[];
  /** Accepted for backward compatibility; the skills give one correct answer. */
  performance_level?: string;
}

export function generateCompleteSetup({
  framework,
  plugins,
}: SetupToolInput): string {
  if (!FRAMEWORKS.includes(framework)) {
    throw new Error(
      `Unknown framework "${framework}". Expected one of: ${FRAMEWORKS.join(', ')}`,
    );
  }
  return renderSetup({ framework, plugins });
}
