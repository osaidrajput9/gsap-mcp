/**
 * Framework shells for generated snippets.
 *
 * Every snippet this server emits is assembled here rather than written out
 * by hand per pattern, so plugin registration, selector scoping, teardown and
 * `prefers-reduced-motion` are structural instead of something a template can
 * forget. Each rule below is backed by a named official skill.
 */

export const FRAMEWORKS = [
  'react',
  'nextjs',
  'vue',
  'nuxt',
  'svelte',
  'vanilla',
] as const;

export type Framework = (typeof FRAMEWORKS)[number];

/**
 * Plugin module paths, taken from the pluginMap in the official
 * gsap-frameworks skill. Every plugin ships in the public `gsap` package —
 * gsap-plugins: "Do not generate an .npmrc with a GreenSock auth token".
 */
export const PLUGIN_MODULES: Record<string, string> = {
  CSSRulePlugin: 'gsap/CSSRulePlugin',
  CustomBounce: 'gsap/CustomBounce',
  CustomEase: 'gsap/CustomEase',
  CustomWiggle: 'gsap/CustomWiggle',
  Draggable: 'gsap/Draggable',
  DrawSVGPlugin: 'gsap/DrawSVGPlugin',
  EasePack: 'gsap/EasePack',
  EaselPlugin: 'gsap/EaselPlugin',
  Flip: 'gsap/Flip',
  GSDevTools: 'gsap/GSDevTools',
  InertiaPlugin: 'gsap/InertiaPlugin',
  MorphSVGPlugin: 'gsap/MorphSVGPlugin',
  MotionPathHelper: 'gsap/MotionPathHelper',
  MotionPathPlugin: 'gsap/MotionPathPlugin',
  Observer: 'gsap/Observer',
  Physics2DPlugin: 'gsap/Physics2DPlugin',
  PhysicsPropsPlugin: 'gsap/PhysicsPropsPlugin',
  PixiPlugin: 'gsap/PixiPlugin',
  ScrambleTextPlugin: 'gsap/ScrambleTextPlugin',
  ScrollSmoother: 'gsap/ScrollSmoother',
  ScrollToPlugin: 'gsap/ScrollToPlugin',
  ScrollTrigger: 'gsap/ScrollTrigger',
  SplitText: 'gsap/SplitText',
  TextPlugin: 'gsap/TextPlugin',
};

export function isReact(framework: Framework): boolean {
  return framework === 'react' || framework === 'nextjs';
}

export function isVue(framework: Framework): boolean {
  return framework === 'vue' || framework === 'nuxt';
}

export interface SnippetRequest {
  framework: Framework;
  /** PascalCase component name. */
  componentName: string;
  /** Plugins to import and register, excluding useGSAP (added for React). */
  plugins?: string[];
  /**
   * GSAP statements placed inside the matchMedia handler. `reduceMotion` is in
   * scope as a boolean; multiply every duration by it or branch on it.
   */
  body: string;
  /** Markup placed inside the scoped container. */
  markup?: string;
  /** Extra matchMedia conditions, e.g. `{ isDesktop: '(min-width: 800px)' }`. */
  conditions?: Record<string, string>;
  /** Statements that must run before the matchMedia block (e.g. helper consts). */
  preamble?: string;
  /** Additional top-of-file import lines, for non-GSAP dependencies. */
  extraImports?: string[];
  /**
   * React only: expose `contextSafe` from useGSAP, required for any GSAP
   * created inside an event handler (gsap-react).
   */
  usesContextSafe?: boolean;
  /**
   * Emit `const q = gsap.utils.selector(scope)` so the body can query real
   * DOM nodes (for measurements) without hard-coding a framework's ref shape.
   */
  needsSelector?: boolean;
}

function indent(text: string, spaces: number): string {
  const pad = ' '.repeat(spaces);
  return text
    .trimEnd()
    .split('\n')
    .map((line) => (line.trim() ? pad + line : ''))
    .join('\n');
}

function conditionNames(extra: Record<string, string> = {}): string {
  return ['reduceMotion', ...Object.keys(extra)].join(', ');
}

/**
 * Emits the whole `mm.add(conditions, handler, scope)` call at `depth` spaces.
 *
 * Built as one unit rather than as separate fragments: assembling the call from
 * pieces is how an earlier version of this file managed to drop the comma
 * between the conditions object and the handler, emitting code that did not
 * parse.
 *
 * The reduced-motion contract, from gsap-core: "Respecting
 * prefers-reduced-motion is important for users with vestibular disorders. Use
 * duration: 0 or skip the animation when reduceMotion is true."
 *
 * Both media queries are always emitted. A matchMedia handler only runs when at
 * least one of its conditions matches, so a lone `(prefers-reduced-motion:
 * reduce)` condition would leave visitors *without* the preference with no
 * animation at all. Pairing it with `no-preference` covers both populations,
 * and a browser supporting neither simply leaves the resting markup in place —
 * which is why generated markup never hides the animated elements.
 */
function matchMediaCall(options: {
  depth: number;
  conditions?: Record<string, string>;
  body: string;
  scopeExpression: string;
  needsSelector?: boolean;
}): string {
  const { depth, conditions = {}, body, scopeExpression, needsSelector } =
    options;
  const entries = Object.entries({
    ...conditions,
    reduceMotion: '(prefers-reduced-motion: reduce)',
    fullMotion: '(prefers-reduced-motion: no-preference)',
  });

  const lines = [
    'mm.add(',
    '  {',
    ...entries.map(([key, query]) => `    ${key}: "${query}",`),
    '  },',
    '  (context) => {',
    `    const { ${conditionNames(conditions)} } = context.conditions;`,
    // gsap-utils: selector(scope) "finds elements only within the given
    // element (or ref)" and handles a React ref's .current itself, which is
    // what lets one pattern body work across every framework.
    ...(needsSelector
      ? [`    const q = gsap.utils.selector(${scopeExpression});`]
      : []),
    '',
    indent(body, 4),
    '  },',
    '  // Scope selector text to this component, per gsap-core.',
    `  ${scopeExpression},`,
    ');',
  ];

  return indent(lines.join('\n'), depth);
}

/** Drops omitted entries while keeping deliberate blank lines. */
function assemble(lines: Array<string | null>): string {
  return lines.filter((line): line is string => line !== null).join('\n');
}

function importLines(
  framework: Framework,
  plugins: string[],
  extra: string[] = [],
): string[] {
  const lines = ['import { gsap } from "gsap";'];
  for (const plugin of plugins) {
    const modulePath = PLUGIN_MODULES[plugin];
    if (modulePath) lines.push(`import { ${plugin} } from "${modulePath}";`);
  }
  if (isReact(framework)) {
    lines.push('import { useGSAP } from "@gsap/react";');
  }
  lines.push(...extra);
  return lines;
}

function registerLine(framework: Framework, plugins: string[]): string {
  // gsap-react: "gsap.registerPlugin(useGSAP); // register before running
  // useGSAP or any GSAP code". gsap-frameworks: register once at app level,
  // not inside a component body that runs every render.
  const registered = [...(isReact(framework) ? ['useGSAP'] : []), ...plugins];
  return registered.length
    ? `gsap.registerPlugin(${registered.join(', ')});`
    : '';
}

function renderReact(request: SnippetRequest): string {
  const plugins = request.plugins ?? [];

  return assemble([
    // gsap-react: "Run GSAP only on the client; do not call gsap or
    // ScrollTrigger during SSR."
    request.framework === 'nextjs' ? '"use client";' : null,
    request.framework === 'nextjs' ? '' : null,
    'import { useRef } from "react";',
    ...importLines(request.framework, plugins, request.extraImports),
    '',
    registerLine(request.framework, plugins),
    '',
    `export default function ${request.componentName}() {`,
    '  const container = useRef(null);',
    '',
    '  useGSAP(',
    request.usesContextSafe
      ? '    (gsapContext, contextSafe) => {'
      : '    () => {',
    request.preamble ? indent(request.preamble, 6) : null,
    request.preamble ? '' : null,
    '      const mm = gsap.matchMedia();',
    '',
    matchMediaCall({
      depth: 6,
      conditions: request.conditions,
      body: request.body,
      scopeExpression: 'container',
      needsSelector: request.needsSelector,
    }),
    '',
    '      // useGSAP reverts its own context on unmount; reverting the',
    '      // matchMedia explicitly makes the teardown unambiguous.',
    '      return () => mm.revert();',
    '    },',
    '    { scope: container },',
    '  );',
    '',
    '  return (',
    `    <div ref={container} className="${containerClass(request.componentName)}">`,
    indent(request.markup ?? '<div />', 6),
    '    </div>',
    '  );',
    '}',
  ]);
}

function renderVue(request: SnippetRequest): string {
  const plugins = request.plugins ?? [];

  return assemble([
    '<script setup>',
    'import { onMounted, onUnmounted, ref } from "vue";',
    ...importLines(request.framework, plugins, request.extraImports),
    '',
    registerLine(request.framework, plugins),
    '',
    'const container = ref(null);',
    'let mm;',
    '',
    'onMounted(() => {',
    '  if (!container.value) return;',
    '',
    request.preamble ? indent(request.preamble, 2) : null,
    request.preamble ? '' : null,
    '  mm = gsap.matchMedia();',
    '',
    matchMediaCall({
      depth: 2,
      conditions: request.conditions,
      body: request.body,
      scopeExpression: 'container.value',
      needsSelector: request.needsSelector,
    }),
    '});',
    '',
    '// gsap-frameworks: always tear down on unmount. matchMedia creates its',
    '// own context, so mm.revert() is the whole cleanup — do not also wrap',
    '// this in gsap.context().',
    'onUnmounted(() => {',
    '  mm?.revert();',
    '});',
    '</script>',
    '',
    '<template>',
    `  <div ref="container" class="${containerClass(request.componentName)}">`,
    indent(request.markup ?? '<div></div>', 4),
    '  </div>',
    '</template>',
  ]);
}

function renderSvelte(request: SnippetRequest): string {
  const plugins = request.plugins ?? [];

  return assemble([
    '<script>',
    '  import { onMount } from "svelte";',
    ...importLines(request.framework, plugins, request.extraImports).map(
      (line) => `  ${line}`,
    ),
    '',
    `  ${registerLine(request.framework, plugins)}`,
    '',
    '  let container;',
    '',
    '  onMount(() => {',
    '    if (!container) return;',
    '',
    request.preamble ? indent(request.preamble, 4) : null,
    request.preamble ? '' : null,
    '    const mm = gsap.matchMedia();',
    '',
    matchMediaCall({
      depth: 4,
      conditions: request.conditions,
      body: request.body,
      scopeExpression: 'container',
      needsSelector: request.needsSelector,
    }),
    '',
    '    // gsap-frameworks: onMount may return a cleanup; revert there.',
    '    return () => mm.revert();',
    '  });',
    '</script>',
    '',
    `<div bind:this={container} class="${containerClass(request.componentName)}">`,
    indent(request.markup ?? '<div></div>', 2),
    '</div>',
  ]);
}

function renderVanilla(request: SnippetRequest): string {
  const plugins = request.plugins ?? [];

  return assemble([
    ...importLines(request.framework, plugins, request.extraImports),
    '',
    registerLine(request.framework, plugins),
    '',
    `// Wrap this pattern's markup in a container so selectors can be scoped to it:`,
    `//   <div class="${containerClass(request.componentName)}"> ...markup... </div>`,
    `const container = document.querySelector(".${containerClass(request.componentName)}");`,
    '',
    request.preamble ? request.preamble.trimEnd() : null,
    request.preamble ? '' : null,
    'const mm = gsap.matchMedia();',
    '',
    matchMediaCall({
      depth: 0,
      conditions: request.conditions,
      body: request.body,
      scopeExpression: 'container',
      needsSelector: request.needsSelector,
    }),
    '',
    '// On teardown (route change, component removal):',
    '// mm.revert();',
  ]);
}

/**
 * Class for the scoped container element.
 *
 * The container must be a strict *ancestor* of everything a pattern selects.
 * A scoped selector never matches the scope element itself, so putting the
 * scope on the markup root silently breaks any `trigger` that points at that
 * root: ScrollTrigger resolves it to null and quietly falls back to the
 * tween's own target. The `-root` suffix guarantees the wrapper class can
 * never collide with a class the pattern uses.
 */
export function containerClass(componentName: string): string {
  return `${kebab(componentName)}-root`;
}

export function kebab(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .toLowerCase()
    .replace(/^-|-$/g, '');
}

/** Language tag for the fenced code block a framework's snippet belongs in. */
export function fenceLanguage(framework: Framework): string {
  if (isReact(framework)) return 'jsx';
  if (isVue(framework)) return 'vue';
  if (framework === 'svelte') return 'svelte';
  return 'javascript';
}

export function renderSnippet(request: SnippetRequest): string {
  if (isReact(request.framework)) return renderReact(request);
  if (isVue(request.framework)) return renderVue(request);
  if (request.framework === 'svelte') return renderSvelte(request);
  return renderVanilla(request);
}
