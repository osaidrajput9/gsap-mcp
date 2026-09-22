/**
 * validate_gsap_code — deterministic checks derived from the official skills.
 *
 * Every rule here quotes the skill it comes from. Nothing is a matter of taste:
 * if a check cannot be traced to a "Do Not" or "best practices" bullet in the
 * vendored GreenSock skills, it does not belong in this file.
 *
 * Analysis is lexical, not a full parse, so checks are written to prefer a
 * missed finding over a wrong one. Where a pattern is legitimately ambiguous —
 * registration usually lives in an app entry point, not the file being checked
 * — the finding is a warning that says so.
 */

import { z } from 'zod';

import { PLUGIN_MODULES, type Framework } from '../generators/framework.js';
import {
  blankComments,
  findCalls,
  findProperties,
  hasIdentifier,
  LineIndex,
  matchParen,
} from '../lib/source-scan.js';
import { SKILL_URI_PREFIX } from '../resources/skills.js';

export const SEVERITIES = ['error', 'warning', 'info'] as const;
export type Severity = (typeof SEVERITIES)[number];

export interface Finding {
  /** Stable check id, e.g. "layout-property". */
  id: string;
  severity: Severity;
  line: number;
  column: number;
  /** The offending source line, trimmed. */
  excerpt: string;
  message: string;
  suggestion: string;
  /** Skill the rule comes from. */
  skill: string;
  /** The skill's own words. */
  rule: string;
}

export const VALIDATION_FINDING_SHAPE = {
  findings: z.array(
    z.object({
      id: z.string(),
      severity: z.enum(SEVERITIES),
      line: z.number().int(),
      column: z.number().int(),
      excerpt: z.string(),
      message: z.string(),
      suggestion: z.string(),
      skill: z.string(),
      rule: z.string(),
    }),
  ),
  counts: z.object({
    error: z.number().int(),
    warning: z.number().int(),
    info: z.number().int(),
  }),
  framework: z.string().nullable(),
};

export interface ValidateToolInput {
  code: string;
  filename?: string;
  framework?: Framework;
}

export interface ValidationResult {
  summary: string;
  structured: {
    findings: Finding[];
    counts: Record<Severity, number>;
    framework: string | null;
  };
}

/** Tween methods whose vars are animated over time (gsap.set is excluded). */
const TWEEN_CALL = /(?<![A-Za-z0-9_$.])((?:gsap|[A-Za-z_$][A-Za-z0-9_$]*)\s*\.\s*(?:to|from|fromTo))\s*\(/g;
const ANY_GSAP_CALL = /(?<![A-Za-z0-9_$.])((?:gsap|[A-Za-z_$][A-Za-z0-9_$]*)\s*\.\s*(?:to|from|fromTo|set|timeline))\s*\(/g;

/** Vars keys that require a plugin, per gsap-plugins. */
const PLUGIN_BY_VARS_KEY: Record<string, string> = {
  scrollTrigger: 'ScrollTrigger',
  scrollTo: 'ScrollToPlugin',
  drawSVG: 'DrawSVGPlugin',
  morphSVG: 'MorphSVGPlugin',
  motionPath: 'MotionPathPlugin',
  scrambleText: 'ScrambleTextPlugin',
  physics2D: 'Physics2DPlugin',
  physicsProps: 'PhysicsPropsPlugin',
  inertia: 'InertiaPlugin',
  pixi: 'PixiPlugin',
};

/** Layout properties gsap-performance says to avoid animating. */
const LAYOUT_PROPERTIES = new Set([
  'top',
  'left',
  'right',
  'bottom',
  'width',
  'height',
  'margin',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'padding',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
]);

const TRANSFORM_FOR: Record<string, string> = {
  top: 'y',
  bottom: 'y',
  left: 'x',
  right: 'x',
  width: 'scaleX',
  height: 'scaleY',
};

function detectFramework(
  input: ValidateToolInput,
  code: string,
): string | null {
  if (input.framework) return input.framework;

  const name = (input.filename ?? '').toLowerCase();
  if (name.endsWith('.vue')) return 'vue';
  if (name.endsWith('.svelte')) return 'svelte';
  if (name.endsWith('.jsx') || name.endsWith('.tsx')) return 'react';

  if (/\buseGSAP\s*\(|\buseEffect\s*\(|\buseLayoutEffect\s*\(/.test(code)) {
    return 'react';
  }
  if (/\bonMounted\s*\(/.test(code)) return 'vue';
  if (/\bonMount\s*\(/.test(code)) return 'svelte';
  return null;
}

export function validateGsapCode(input: ValidateToolInput): ValidationResult {
  const original = input.code;
  if (!original?.trim()) {
    throw new Error('code is required');
  }

  const code = blankComments(original);
  const index = new LineIndex(original);
  const framework = detectFramework(input, code);
  const findings: Finding[] = [];

  const add = (
    offset: number,
    finding: Omit<Finding, 'line' | 'column' | 'excerpt'>,
  ) => {
    const { line, column } = index.positionAt(offset);
    findings.push({
      ...finding,
      line,
      column,
      excerpt: index.lineAt(offset),
    });
  };

  const tweens = findCalls(code, TWEEN_CALL);
  const allCalls = findCalls(code, ANY_GSAP_CALL);
  const registered = registeredPlugins(code);

  checkLayoutProperties(code, tweens, add);
  checkOpacity(code, tweens, add);
  checkPluginRegistration(code, allCalls, registered, add);
  checkUseGsap(code, framework, registered, add);
  checkCleanup(code, framework, add);
  checkChainedDelays(code, tweens, add);
  checkScrollTriggerRefresh(code, add);
  checkDeprecated(code, add);
  checkScrollTriggerPlacement(code, add);
  checkScrubAndToggleActions(code, add);
  checkContainerAnimation(code, add);
  checkMarkers(code, add);
  checkContextInMatchMedia(code, add);

  findings.sort((a, b) => a.line - b.line || a.column - b.column);

  const counts: Record<Severity, number> = { error: 0, warning: 0, info: 0 };
  for (const finding of findings) counts[finding.severity] += 1;

  return {
    summary: renderSummary(findings, counts, framework),
    structured: { findings, counts, framework },
  };
}

type Add = (
  offset: number,
  finding: Omit<Finding, 'line' | 'column' | 'excerpt'>,
) => void;

/** Plugin identifiers passed to any gsap.registerPlugin() call. */
function registeredPlugins(code: string): Set<string> {
  const names = new Set<string>();
  for (const call of findCalls(code, /(?<![A-Za-z0-9_$.])(gsap\s*\.\s*registerPlugin)\s*\(/g)) {
    const args = code.slice(call.argsStart, call.argsEnd);
    for (const match of args.matchAll(/[A-Za-z_$][A-Za-z0-9_$]*/g)) {
      names.add(match[0]);
    }
  }
  return names;
}

function checkLayoutProperties(
  code: string,
  tweens: ReturnType<typeof findCalls>,
  add: Add,
): void {
  for (const call of tweens) {
    // scrollTrigger has its own `start`/`end` vocabulary; skip into it.
    for (const property of findProperties(code, call.argsStart, call.argsEnd, {
      skipKeys: ['scrollTrigger'],
    })) {
      if (!LAYOUT_PROPERTIES.has(property.key)) continue;

      const alternative = TRANSFORM_FOR[property.key];
      add(property.offset, {
        id: 'layout-property',
        severity: 'warning',
        skill: 'gsap-performance',
        rule: 'Avoid when possible: width, height, top, left, margin, padding (they trigger layout and can cause jank).',
        message: `\`${call.callee}\` animates the layout property \`${property.key}\`, which forces layout on every frame.`,
        suggestion: alternative
          ? `Use the transform alias \`${alternative}\` instead (or \`${alternative === 'x' ? 'xPercent' : alternative === 'y' ? 'yPercent' : alternative}\` for percentage-based movement). Transforms stay on the compositor.`
          : 'Use a transform alias (x, y, scale, rotation) if it can produce the same effect.',
      });
    }
  }
}

function checkOpacity(
  code: string,
  tweens: ReturnType<typeof findCalls>,
  add: Add,
): void {
  for (const call of tweens) {
    for (const property of findProperties(code, call.argsStart, call.argsEnd, {
      skipKeys: ['scrollTrigger'],
    })) {
      if (property.key !== 'opacity') continue;
      if (!/^0(\.0+)?$/.test(property.value.trim())) continue;

      add(property.offset, {
        id: 'opacity-vs-autoalpha',
        severity: 'info',
        skill: 'gsap-core',
        rule: 'autoAlpha — Prefer over opacity for fade in/out. When the value is 0, GSAP also sets visibility: hidden (better rendering and no pointer events).',
        message:
          'Animating `opacity` to 0 leaves the element in the layout, still catching clicks and reachable by the keyboard.',
        suggestion:
          'Use `autoAlpha: 0`. GSAP also sets `visibility: hidden` at 0 and restores it above 0.',
      });
    }
  }
}

function checkPluginRegistration(
  code: string,
  calls: ReturnType<typeof findCalls>,
  registered: Set<string>,
  add: Add,
): void {
  const required = new Map<string, number>();

  // Names bound locally rather than imported: we cannot see where (or
  // whether) they were registered, so a warning would be a guess. The official
  // Nuxt example does exactly this via its lazyLoadPlugin() composable.
  const locallyBound = new Set<string>();
  for (const match of code.matchAll(
    /(?:const|let|var)\s+(?:\{([^}]*)\}|([A-Za-z_$][A-Za-z0-9_$]*))\s*=/g,
  )) {
    for (const name of (match[1] ?? match[2] ?? '').split(',')) {
      const clean = name.split(':').pop()?.trim();
      if (clean) locallyBound.add(clean);
    }
  }

  // Plugins named directly, e.g. ScrollTrigger.create(...) or Flip.getState().
  for (const plugin of Object.keys(PLUGIN_MODULES)) {
    if (plugin === 'EasePack') continue;
    if (locallyBound.has(plugin)) continue;
    const usage = new RegExp(
      `(?<![A-Za-z0-9_$.])${plugin}\\s*\\.\\s*[A-Za-z_$]`,
    ).exec(code);
    if (usage && !required.has(plugin)) required.set(plugin, usage.index);
  }

  // Plugins implied by a vars key, e.g. { scrollTrigger: {...} }.
  for (const call of calls) {
    for (const property of findProperties(code, call.argsStart, call.argsEnd)) {
      const plugin = PLUGIN_BY_VARS_KEY[property.key];
      if (plugin && !required.has(plugin)) required.set(plugin, property.offset);
    }
  }

  for (const [plugin, offset] of required) {
    if (registered.has(plugin)) continue;
    add(offset, {
      id: 'missing-register-plugin',
      severity: 'warning',
      skill: 'gsap-plugins',
      rule: 'Use a plugin in a tween or API without registering it first (gsap.registerPlugin()).',
      message: `\`${plugin}\` is used but no \`gsap.registerPlugin(${plugin})\` appears in this file.`,
      suggestion: `Add \`gsap.registerPlugin(${plugin})\` before first use. If registration already happens in your app entry point, this is fine — gsap-frameworks recommends registering once at app level.`,
    });
  }
}

function checkUseGsap(
  code: string,
  framework: string | null,
  registered: Set<string>,
  add: Add,
): void {
  // These rules are about the useGSAP hook from @gsap/react. The official
  // Nuxt example defines its own auto-imported composable called useGSAP
  // (returning { gsap, ScrollTrigger, lazyLoadPlugin }), which is a different
  // thing entirely and must not be flagged.
  const fromGsapReact = /from\s*["'`]@gsap\/react["'`]/.test(code);
  if (!fromGsapReact && framework !== 'react') return;

  const calls = findCalls(code, /(?<![A-Za-z0-9_$.])(useGSAP)\s*\(/g);
  if (calls.length === 0) return;

  if (!registered.has('useGSAP')) {
    add(calls[0].start, {
      id: 'usegsap-not-registered',
      severity: 'warning',
      skill: 'gsap-react',
      rule: 'gsap.registerPlugin(useGSAP); // register before running useGSAP or any GSAP code',
      message:
        '`useGSAP` is used but never passed to `gsap.registerPlugin()` in this file.',
      suggestion:
        'Add `gsap.registerPlugin(useGSAP)` at module level, or once in your app entry point.',
    });
  }

  for (const call of calls) {
    const args = code.slice(call.argsStart, call.argsEnd);
    if (/\bscope\s*:/.test(args)) continue;

    // A selector string inside the callback makes the missing scope a real
    // bug, not just a missed recommendation.
    const usesSelectors = /["'`]\s*[.#][A-Za-z_-]/.test(args);

    add(call.start, {
      id: 'usegsap-without-scope',
      severity: usesSelectors ? 'error' : 'warning',
      skill: 'gsap-react',
      rule: 'Target by selector without a scope; always pass scope (ref or element) in useGSAP or gsap.context() so selectors like .box are limited to that root and do not match elements outside the component.',
      message: usesSelectors
        ? '`useGSAP()` has no `scope`, and its callback uses selector strings — these will match elements anywhere in the document, including other instances of this component.'
        : '`useGSAP()` has no `scope`.',
      suggestion:
        'Pass the container ref: `useGSAP(() => { ... }, { scope: container })`.',
    });
  }
}

function checkCleanup(code: string, framework: string | null, add: Add): void {
  const contexts = findCalls(code, /(?<![A-Za-z0-9_$.])(gsap\s*\.\s*context)\s*\(/g);
  for (const call of contexts) {
    if (/\.\s*revert\s*\(/.test(code)) continue;
    add(call.start, {
      id: 'context-without-revert',
      severity: 'error',
      skill: 'gsap-react',
      rule: 'When doing so, always call ctx.revert() in the effect\'s cleanup function so animations and ScrollTriggers are killed and inline styles are reverted. Otherwise this causes leaks and updates on detached nodes.',
      message:
        '`gsap.context()` is created but `revert()` is never called, so its tweens and ScrollTriggers outlive the component.',
      suggestion:
        'Return a cleanup that reverts it: `return () => ctx.revert();`.',
    });
  }

  // A global kill destroys other components' ScrollTriggers, not just this
  // component's. gsap-scrolltrigger scopes cleanup to the context or an id.
  const globalKill =
    /ScrollTrigger\s*\.\s*getAll\s*\(\s*\)\s*\.\s*forEach\s*\([\s\S]{0,120}?\.\s*kill\s*\(/.exec(
      code,
    ) ?? /ScrollTrigger\s*\.\s*killAll\s*\(/.exec(code);
  if (globalKill) {
    add(globalKill.index, {
      id: 'global-scrolltrigger-kill',
      severity: 'error',
      skill: 'gsap-react',
      rule: 'In React, use the useGSAP() hook to ensure that all ScrollTriggers and GSAP animations are reverted and cleaned up when necessary, or use a gsap.context() to do it manually.',
      message:
        'Killing every ScrollTrigger on the page destroys triggers belonging to other components, not only this one.',
      suggestion:
        'Let `useGSAP()` or `gsap.context().revert()` clean up only what this component created, or kill a specific instance with `ScrollTrigger.getById(id)?.kill()`.',
    });
  }

  const hasGsap = /(?<![A-Za-z0-9_$.])gsap\s*\./.test(code);
  if (!hasGsap) return;

  if (framework === 'vue') {
    const mounted = findCalls(code, /(?<![A-Za-z0-9_$.])(onMounted)\s*\(/g);
    const hasTeardown = /(?<![A-Za-z0-9_$.])(onUnmounted|onBeforeUnmount)\s*\(/.test(code);
    if (mounted.length && !hasTeardown) {
      add(mounted[0].start, {
        id: 'vue-missing-cleanup',
        severity: 'error',
        skill: 'gsap-frameworks',
        rule: 'Skip cleanup; always call ctx.revert() in onUnmounted / onMount\'s return so animations and ScrollTriggers are killed when the component is destroyed.',
        message:
          'GSAP is created in `onMounted` but the component has no `onUnmounted`/`onBeforeUnmount` teardown.',
        suggestion:
          'Add `onUnmounted(() => ctx?.revert())` (or `mm?.revert()` when using gsap.matchMedia).',
      });
    }
  }

  if (framework === 'svelte') {
    const mounts = findCalls(code, /(?<![A-Za-z0-9_$.])(onMount)\s*\(/g);
    const hasTeardown = /\.\s*(revert|kill)\s*\(/.test(code);
    if (mounts.length && !hasTeardown) {
      add(mounts[0].start, {
        id: 'svelte-missing-cleanup',
        severity: 'error',
        skill: 'gsap-frameworks',
        rule: 'return () => ctx.revert() — Svelte\'s onMount can return a cleanup function; call ctx.revert() there so cleanup runs when the component is destroyed.',
        message:
          'GSAP is created in `onMount` but nothing is reverted or killed when the component is destroyed.',
        suggestion:
          'Return a cleanup from `onMount`: `return () => ctx.revert();`.',
      });
    }
  }

  if (framework === 'react') {
    for (const call of findCalls(
      code,
      /(?<![A-Za-z0-9_$.])(useEffect|useLayoutEffect)\s*\(/g,
    )) {
      const body = code.slice(call.argsStart, call.argsEnd);
      if (!/(?<![A-Za-z0-9_$.])gsap\s*\./.test(body)) continue;
      if (/return\s*(\(|\w|\()/.test(body)) continue;

      add(call.start, {
        id: 'react-effect-missing-cleanup',
        severity: 'error',
        skill: 'gsap-react',
        rule: 'Skip cleanup; always revert context or kill tweens/ScrollTriggers in the effect return to avoid leaks and updates on unmounted nodes.',
        message: `\`${call.callee}\` creates GSAP but returns no cleanup.`,
        suggestion:
          'Prefer `useGSAP()` from @gsap/react, which cleans up automatically; otherwise wrap in `gsap.context()` and `return () => ctx.revert()`.',
      });
    }
  }

}

function checkChainedDelays(
  code: string,
  tweens: ReturnType<typeof findCalls>,
  add: Add,
): void {
  const delays: Array<{ offset: number; value: number }> = [];

  for (const call of tweens) {
    for (const property of findProperties(code, call.argsStart, call.argsEnd, {
      skipKeys: ['scrollTrigger'],
    })) {
      if (property.key !== 'delay') continue;
      const value = Number.parseFloat(property.value);
      if (Number.isFinite(value) && value > 0) {
        delays.push({ offset: property.offset, value });
      }
    }
  }

  const distinct = new Set(delays.map((entry) => entry.value));
  if (delays.length < 2 || distinct.size < 2) return;

  add(delays[0].offset, {
    id: 'chained-delays',
    severity: 'warning',
    skill: 'gsap-timeline',
    rule: 'Chain animations with delay when a timeline can sequence them; prefer gsap.timeline() and the position parameter for multi-step animation.',
    message: `${delays.length} tweens are sequenced with increasing \`delay\` values (${[...distinct].sort((a, b) => a - b).join(', ')}s). Changing one duration means recalculating every later delay by hand.`,
    suggestion:
      'Use `gsap.timeline({ defaults: { ... } })` and the position parameter ("<", "-=0.3", labels) so the sequence stays correct when a duration changes.',
  });
}

function checkScrollTriggerRefresh(code: string, add: Add): void {
  if (!hasIdentifier(code, 'ScrollTrigger')) return;
  if (/ScrollTrigger\s*\.\s*refresh\s*\(/.test(code)) return;

  // Only strong signals that layout changes after the triggers are created.
  const signals: Array<[RegExp, string]> = [
    [/document\s*\.\s*fonts\s*\.\s*ready/, 'fonts finish loading'],
    [/\.\s*innerHTML\s*=/, 'markup is replaced'],
    [/\.\s*appendChild\s*\(/, 'nodes are appended'],
    [/addEventListener\s*\(\s*["'`]load["'`]/, 'an asset load event fires'],
    [/(?<![A-Za-z0-9_$.])fetch\s*\(/, 'data is fetched'],
  ];

  for (const [pattern, why] of signals) {
    const match = pattern.exec(code);
    if (!match) continue;

    add(match.index, {
      id: 'missing-scrolltrigger-refresh',
      severity: 'warning',
      skill: 'gsap-scrolltrigger',
      rule: 'Forget to call ScrollTrigger.refresh() after DOM/layout changes (new content, images, fonts) that affect trigger positions; viewport resize is auto-handled, but dynamic content is not.',
      message: `This file uses ScrollTrigger and changes layout after setup (${why}), but never calls \`ScrollTrigger.refresh()\`.`,
      suggestion:
        'Call `ScrollTrigger.refresh()` once the new content is in the DOM. Resize is handled automatically; dynamic content is not.',
    });
    return;
  }
}

function checkDeprecated(code: string, add: Add): void {
  const rules: Array<{
    pattern: RegExp;
    id: string;
    message: string;
    suggestion: string;
    skill: string;
    rule: string;
    severity?: Severity;
  }> = [
    {
      pattern: /ScrollTrigger\s*\.\s*matchMedia\s*\(/,
      id: 'deprecated-scrolltrigger-matchmedia',
      message: '`ScrollTrigger.matchMedia()` is not part of GSAP 3.11+.',
      suggestion:
        'Use `gsap.matchMedia()`. It reverts everything created inside a query when that query stops matching, and takes a `(prefers-reduced-motion: reduce)` condition.',
      skill: 'gsap-core',
      rule: 'gsap.matchMedia() (GSAP 3.11+) runs setup code only when a media query matches; when it stops matching, all animations and ScrollTriggers created in that run are reverted automatically.',
    },
    {
      pattern: /(?<![A-Za-z0-9_$.])throwProps\s*:/,
      id: 'deprecated-throwprops',
      message: '`throwProps` is the GSAP 2 name and does nothing in GSAP 3.',
      suggestion:
        'Use `inertia: true` and register `InertiaPlugin`.',
      skill: 'gsap-plugins',
      rule: 'Draggable.create(".box", { type: "x,y", bounds: "#container", inertia: true });',
    },
    {
      pattern: /(?<![A-Za-z0-9_$.])new\s+SplitText\s*\(/,
      id: 'legacy-splittext-constructor',
      message: '`new SplitText()` is the old form.',
      suggestion:
        'Use `SplitText.create(target, vars)`, and for line splits add `autoSplit: true` with the animation built inside `onSplit()` so it survives font loading and resizes.',
      skill: 'gsap-plugins',
      rule: 'API: SplitText.create(target, vars) (target = selector, element, or array).',
      severity: 'warning',
    },
    {
      pattern: /(?<![A-Za-z0-9_$.])(TweenMax|TweenLite|TimelineMax|TimelineLite)(?![A-Za-z0-9_$])/,
      id: 'gsap2-api',
      message:
        'TweenMax/TweenLite/TimelineMax/TimelineLite are GSAP 2 names.',
      suggestion:
        'Use `gsap.to()`, `gsap.from()`, `gsap.fromTo()` and `gsap.timeline()`.',
      skill: 'gsap-core',
      rule: 'Core Tween Methods — gsap.to(targets, vars), gsap.from(targets, vars), gsap.fromTo(targets, fromVars, toVars), gsap.set(targets, vars).',
    },
    {
      pattern: /ease\s*:\s*(Power[0-4]|Linear|Sine|Expo|Circ|Back|Elastic|Bounce)\s*\.\s*ease/,
      id: 'gsap2-ease-syntax',
      message: 'Eases like `Power2.easeOut` are the GSAP 2 syntax.',
      suggestion:
        'Use the string form: `ease: "power2.out"`, `ease: "none"`, `ease: "back.out(1.7)"`.',
      skill: 'gsap-core',
      rule: 'Use string eases unless a custom curve is needed. Use documented built-in eases.',
    },
    {
      pattern: /npm\.greensock\.com|@gsap:registry|GREENSOCK_TOKEN|gsap-bonus\.tgz/,
      id: 'outdated-gsap-install',
      message:
        'This points at the private GreenSock registry or a Club GSAP token, which is no longer how GSAP is installed.',
      suggestion:
        'Install everything from the public package: `npm install gsap`. Every plugin, including SplitText and MorphSVG, is free and included.',
      skill: 'gsap-plugins',
      rule: 'Do not generate an .npmrc with a GreenSock auth token, suggest the private npm.greensock.com registry, or tell users to sign up for Club GSAP to access a plugin. Those instructions are outdated.',
    },
  ];

  for (const entry of rules) {
    const match = entry.pattern.exec(code);
    if (!match) continue;
    add(match.index, {
      id: entry.id,
      severity: entry.severity ?? 'error',
      skill: entry.skill,
      rule: entry.rule,
      message: entry.message,
      suggestion: entry.suggestion,
    });
  }
}

function checkScrollTriggerPlacement(code: string, add: Add): void {
  // Variables holding a timeline, plus the inline gsap.timeline().to(...) form.
  const timelineVars = new Set<string>();
  for (const match of code.matchAll(
    /(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*gsap\s*\.\s*timeline\s*\(/g,
  )) {
    timelineVars.add(match[1]);
  }

  const childCalls = findCalls(
    code,
    /(?<![A-Za-z0-9_$.])((?:[A-Za-z_$][A-Za-z0-9_$]*|\))\s*\.\s*(?:to|from|fromTo|add))\s*\(/g,
  );

  for (const call of childCalls) {
    const receiver = call.callee.split('.')[0].trim();
    const chained = /gsap\s*\.\s*timeline\s*\([^)]*\)\s*\.\s*(to|from|fromTo)\s*\($/.test(
      code.slice(Math.max(0, call.start - 80), call.argsStart),
    );
    if (!timelineVars.has(receiver) && !chained) continue;

    const args = code.slice(call.argsStart, call.argsEnd);
    const match = /\bscrollTrigger\s*:/.exec(args);
    if (!match) continue;

    add(call.argsStart + match.index, {
      id: 'scrolltrigger-on-child-tween',
      severity: 'error',
      skill: 'gsap-scrolltrigger',
      rule: 'Put ScrollTrigger on a child tween when it\'s part of a timeline; put it on the timeline or a top-level tween only. Wrong: gsap.timeline().to(".a", { scrollTrigger: {...} }). Correct: gsap.timeline({ scrollTrigger: {...} }).to(".a", { x: 100 }).',
      message:
        'A `scrollTrigger` is configured on a tween inside a timeline. ScrollTriggers belong on top-level animations only.',
      suggestion:
        'Move the config to the timeline constructor: `gsap.timeline({ scrollTrigger: { ... } })`.',
    });
  }
}

function checkScrubAndToggleActions(code: string, add: Add): void {
  for (const match of code.matchAll(/\bscrollTrigger\s*:\s*\{/g)) {
    const open = code.indexOf('{', (match.index ?? 0) + match[0].length - 1);
    const close = matchParen(code, open);
    if (close === -1) continue;

    const config = code.slice(open, close);
    if (!/\bscrub\s*:/.test(config) || !/\btoggleActions\s*:/.test(config)) {
      continue;
    }

    add(open, {
      id: 'scrub-with-toggleactions',
      severity: 'warning',
      skill: 'gsap-scrolltrigger',
      rule: 'Use scrub and toggleActions together on the same ScrollTrigger; choose one behavior. If both exist, scrub wins.',
      message:
        'This ScrollTrigger sets both `scrub` and `toggleActions`. `toggleActions` will be ignored.',
      suggestion:
        'Keep `scrub` for scroll-linked progress, or `toggleActions` for discrete play/reverse — not both.',
    });
  }
}

function checkContainerAnimation(code: string, add: Add): void {
  const match = /\bcontainerAnimation\s*:/.exec(code);
  if (!match) return;
  if (/\bease\s*:\s*["'`]none["'`]/.test(code)) return;

  add(match.index, {
    id: 'containeranimation-without-linear-ease',
    severity: 'error',
    skill: 'gsap-scrolltrigger',
    rule: 'Use an ease other than "none" on the horizontal animation when using containerAnimation for fake horizontal scroll; it breaks the 1:1 scroll-to-position mapping.',
    message:
      '`containerAnimation` is used but no tween in this file sets `ease: "none"`.',
    suggestion:
      'The animation passed as `containerAnimation` must use `ease: "none"`, or scroll position and horizontal position will not line up.',
  });
}

function checkMarkers(code: string, add: Add): void {
  const match = /\bmarkers\s*:\s*true/.exec(code);
  if (!match) return;

  add(match.index, {
    id: 'markers-in-production',
    severity: 'info',
    skill: 'gsap-scrolltrigger',
    rule: 'Leave markers: true in production.',
    message: '`markers: true` draws ScrollTrigger\'s debug markers.',
    suggestion: 'Remove it, or gate it behind a development-only flag.',
  });
}

function checkContextInMatchMedia(code: string, add: Add): void {
  for (const call of findCalls(
    code,
    /(?<![A-Za-z0-9_$.])([A-Za-z_$][A-Za-z0-9_$]*\s*\.\s*add|gsap\s*\.\s*matchMedia)\s*\(/g,
  )) {
    if (!/matchMedia/.test(code.slice(Math.max(0, call.start - 200), call.argsStart))) {
      continue;
    }
    const args = code.slice(call.argsStart, call.argsEnd);
    const match = /gsap\s*\.\s*context\s*\(/.exec(args);
    if (!match) continue;

    add(call.argsStart + match.index, {
      id: 'context-inside-matchmedia',
      severity: 'warning',
      skill: 'gsap-core',
      rule: 'Do not nest gsap.context() inside matchMedia — matchMedia creates a context internally; use mm.revert() only.',
      message:
        '`gsap.context()` is nested inside a `matchMedia` handler. matchMedia already creates a context.',
      suggestion:
        'Drop the inner `gsap.context()` and rely on `mm.revert()`. Pass the scope as matchMedia\'s third argument if you need selector scoping.',
    });
  }
}

const SEVERITY_LABEL: Record<Severity, string> = {
  error: 'error',
  warning: 'warning',
  info: 'info',
};

function renderSummary(
  findings: Finding[],
  counts: Record<Severity, number>,
  framework: string | null,
): string {
  const lines = ['# validate_gsap_code', ''];

  if (framework) lines.push(`Framework: \`${framework}\`.`, '');

  if (findings.length === 0) {
    return [
      ...lines,
      'No findings. Nothing in this code contradicts the official GreenSock',
      'skills as far as these checks can tell.',
      '',
      'These are lexical checks, not a full parse, and they are deliberately',
      'conservative — a clean result is not a proof of correctness.',
    ].join('\n');
  }

  lines.push(
    `${findings.length} finding(s): ${counts.error} error, ${counts.warning} warning, ${counts.info} info.`,
    '',
  );

  const skills = new Set<string>();

  for (const finding of findings) {
    skills.add(finding.skill);
    lines.push(
      `## ${SEVERITY_LABEL[finding.severity]}: ${finding.message}`,
      '',
      `**Line ${finding.line}:${finding.column}** — \`${finding.excerpt}\``,
      '',
      `**Fix:** ${finding.suggestion}`,
      '',
      `**Rule** (\`${finding.skill}\`): "${finding.rule}"`,
      '',
      `_id: \`${finding.id}\`_`,
      '',
    );
  }

  lines.push(
    '## Sources',
    '',
    ...[...skills]
      .sort()
      .map((skill) => `- \`${SKILL_URI_PREFIX}${skill}\``),
  );

  return lines.join('\n');
}
