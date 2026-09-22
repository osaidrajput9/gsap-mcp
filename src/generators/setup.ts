/**
 * generate_complete_setup — project boilerplate for a framework.
 *
 * Content follows gsap-react (useGSAP, registration, SSR), gsap-frameworks
 * (Vue/Nuxt/Svelte lifecycles, the Nuxt composable) and gsap-plugins
 * (registration, and the fact that every plugin is free).
 */

import { GSAP_VERSION } from '../data/skills.js';
import { SKILL_URI_PREFIX } from '../resources/skills.js';
import {
  fenceLanguage,
  type Framework,
  isReact,
  isVue,
  PLUGIN_MODULES,
  renderSnippet,
} from './framework.js';

export const SETUP_PLUGINS = Object.keys(PLUGIN_MODULES);

function installBlock(framework: Framework, needsLenis: boolean): string {
  const packages = ['gsap'];
  if (isReact(framework)) packages.push('@gsap/react');
  if (needsLenis) packages.push('lenis');

  return [
    '```bash',
    `npm install ${packages.join(' ')}`,
    '```',
    '',
    'Every GSAP plugin — SplitText, MorphSVG, DrawSVG and the rest — ships in',
    'that one public package and is free for commercial use. Do **not** add an',
    '`.npmrc` with a GreenSock auth token or point at `npm.greensock.com`;',
    'gsap-plugins calls those instructions outdated.',
  ].join('\n');
}

function registrationBlock(
  framework: Framework,
  plugins: string[],
): string {
  const imports = [
    'import { gsap } from "gsap";',
    ...plugins
      .filter((plugin) => PLUGIN_MODULES[plugin])
      .map((plugin) => `import { ${plugin} } from "${PLUGIN_MODULES[plugin]}";`),
    ...(isReact(framework) ? ['import { useGSAP } from "@gsap/react";'] : []),
  ];

  const registered = [
    ...(isReact(framework) ? ['useGSAP'] : []),
    ...plugins.filter((plugin) => PLUGIN_MODULES[plugin]),
  ];

  const where = isReact(framework)
    ? 'app entry point (e.g. `app/layout.jsx`, `main.jsx`)'
    : isVue(framework)
      ? 'app entry point (e.g. `main.js`, or a Nuxt plugin)'
      : framework === 'svelte'
        ? 'app entry point (e.g. `+layout.svelte`)'
        : 'entry module';

  return [
    `Register once in your ${where} — gsap-frameworks: "register once at app`,
    'level", not in a component body that runs every render.',
    '',
    '```javascript',
    ...imports,
    '',
    registered.length
      ? `gsap.registerPlugin(${registered.join(', ')});`
      : '// No plugins requested; the core engine needs no registration.',
    '```',
  ].join('\n');
}

/** The reusable composable from gsap-frameworks, trimmed to the requested plugins. */
function nuxtComposable(plugins: string[]): string {
  const lazy = plugins.filter((plugin) => PLUGIN_MODULES[plugin]);

  return [
    'Nuxt: put registration in a composable so plugins are registered once and',
    'rarely-used ones can be lazy-loaded (gsap-frameworks).',
    '',
    '```typescript',
    '// app/composables/useGSAP.ts',
    'import { gsap } from "gsap";',
    'import { ScrollTrigger } from "gsap/ScrollTrigger";',
    '',
    'const pluginMap = {',
    ...lazy.map(
      (plugin) => `  ${plugin}: () => import("${PLUGIN_MODULES[plugin]}"),`,
    ),
    '} as const;',
    '',
    'type Plugins = keyof typeof pluginMap;',
    '',
    'export default function () {',
    '  gsap.registerPlugin(ScrollTrigger);',
    '',
    '  async function lazyLoadPlugin(plugin: Plugins) {',
    '    const module = await pluginMap[plugin]();',
    '    const loaded = (module as never)[plugin];',
    '    gsap.registerPlugin(loaded);',
    '    return loaded;',
    '  }',
    '',
    '  return { gsap, ScrollTrigger, lazyLoadPlugin };',
    '}',
    '```',
  ].join('\n');
}

export interface SetupInput {
  framework: Framework;
  plugins?: string[];
}

export function renderSetup({
  framework,
  plugins = ['ScrollTrigger'],
}: SetupInput): string {
  const needsLenis = plugins.some((plugin) => /^lenis$/i.test(plugin));
  const gsapPlugins = plugins.filter((plugin) => PLUGIN_MODULES[plugin]);
  const unknown = plugins.filter(
    (plugin) => !PLUGIN_MODULES[plugin] && !/^lenis$/i.test(plugin),
  );

  const starter = renderSnippet({
    framework,
    componentName: 'GsapStarter',
    plugins: gsapPlugins.includes('ScrollTrigger') ? ['ScrollTrigger'] : [],
    body: gsapPlugins.includes('ScrollTrigger')
      ? `gsap.from(".starter-item", {
  autoAlpha: 0,
  y: 24,
  duration: reduceMotion ? 0 : 0.6,
  stagger: reduceMotion ? 0 : 0.1,
  ease: "power2.out",
  scrollTrigger: {
    trigger: ".starter",
    start: "top 80%",
    toggleActions: "play none none reverse",
  },
});`
      : `gsap.from(".starter-item", {
  autoAlpha: 0,
  y: 24,
  duration: reduceMotion ? 0 : 0.6,
  stagger: reduceMotion ? 0 : 0.1,
  ease: "power2.out",
});`,
    markup: (isReact(framework)
      ? `<div className="starter">
  <p className="starter-item">One</p>
  <p className="starter-item">Two</p>
</div>`
      : `<div class="starter">
  <p class="starter-item">One</p>
  <p class="starter-item">Two</p>
</div>`
    ),
  });

  const lines = [
    `# GSAP setup for ${framework}`,
    '',
    `Targets GSAP ${GSAP_VERSION}, the release the vendored official skills are`,
    'written against.',
    '',
    '## 1. Install',
    '',
    installBlock(framework, needsLenis),
    '',
    '## 2. Register plugins',
    '',
    registrationBlock(framework, gsapPlugins),
  ];

  if (framework === 'nuxt') {
    lines.push('', nuxtComposable(gsapPlugins));
  }

  lines.push(
    '',
    '## 3. A component that follows the skills',
    '',
    `\`\`\`${fenceLanguage(framework)}`,
    starter,
    '```',
    '',
    '## What this boilerplate guarantees',
    '',
  );

  const guarantees = isReact(framework)
    ? [
        '`useGSAP()` instead of `useEffect`, so cleanup is automatic (gsap-react).',
        '`scope` is passed, so selector text cannot reach outside the component (gsap-react).',
        '`useGSAP` is itself registered as a plugin before use (gsap-react).',
        framework === 'nextjs'
          ? '`"use client"` keeps GSAP off the server — "do not call gsap or ScrollTrigger during SSR" (gsap-react).'
          : 'All GSAP runs inside the hook, never during SSR (gsap-react).',
      ]
    : isVue(framework)
      ? [
          'Animations are created in `onMounted`, after the DOM exists (gsap-frameworks).',
          'A scope is passed so selector text stays inside the component (gsap-frameworks).',
          '`onUnmounted` reverts, so nothing runs on detached nodes (gsap-frameworks).',
        ]
      : framework === 'svelte'
        ? [
            'Animations are created in `onMount` (gsap-frameworks).',
            "onMount's returned cleanup reverts on destroy (gsap-frameworks).",
            'A scope is passed so selector text stays inside the component (gsap-frameworks).',
          ]
        : [
            'A scope is passed so selector text stays inside the container (gsap-core).',
            'Teardown is shown explicitly for SPA route changes.',
          ];

  lines.push(
    ...guarantees.map((entry) => `- ${entry}`),
    '- `gsap.matchMedia()` handles `prefers-reduced-motion`, with both queries listed so visitors without the preference still get animation (gsap-core).',
    '- `autoAlpha` rather than `opacity`, so hidden elements stop capturing clicks (gsap-core).',
    '- Transforms only — no `top`/`left`/`width`/`height` (gsap-performance).',
    '',
  );

  if (unknown.length) {
    lines.push(
      '## Unrecognised plugins',
      '',
      `Not part of GSAP as documented by the official skills: ${unknown
        .map((plugin) => `\`${plugin}\``)
        .join(', ')}. They were skipped.`,
      '',
    );
  }

  lines.push(
    '## Sources',
    '',
    `- \`${SKILL_URI_PREFIX}${isReact(framework) ? 'gsap-react' : 'gsap-frameworks'}\``,
    `- \`${SKILL_URI_PREFIX}gsap-core\``,
    `- \`${SKILL_URI_PREFIX}gsap-plugins\``,
  );

  return lines.join('\n');
}
