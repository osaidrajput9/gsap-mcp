/**
 * Mounts the generated React components in a real React app, in a browser.
 *
 * test/browser.test.ts covers the vanilla output. The React shell is a
 * different thing: useGSAP from @gsap/react, a useRef container, contextSafe,
 * and teardown on unmount. None of that is exercised by the vanilla suite, and
 * the shell rests on an inference the official skills do not actually state —
 * that mm.add()'s scope argument unwraps a React ref's `.current`, the way
 * gsap.utils.selector() is documented to.
 *
 * The decisive check is the decoy: markup with the same classes rendered
 * OUTSIDE the component. If scoping works, GSAP never touches it. If the ref
 * is not unwrapped, the scope is meaningless and the decoy animates too.
 */

import { createServer, type Server } from 'node:http';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { getPattern, renderPattern } from '../src/generators/patterns.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

async function optional(specifier: string) {
  try {
    return await import(specifier);
  } catch {
    return null;
  }
}

const playwright = await optional('playwright');
const esbuild = await optional('esbuild');

function chromiumExecutable(): string | undefined {
  const explicit = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    '/opt/pw-browsers/chromium',
  ].find((path): path is string => Boolean(path) && existsSync(path!));
  if (explicit) return explicit;
  try {
    const fromPlaywright = playwright?.chromium.executablePath();
    if (fromPlaywright && existsSync(fromPlaywright)) return fromPlaywright;
  } catch {
    /* no browser installed */
  }
  return undefined;
}

const canRun =
  playwright !== null &&
  esbuild !== null &&
  existsSync(join(ROOT, 'node_modules', '@gsap', 'react')) &&
  existsSync(join(ROOT, 'node_modules', 'react-dom')) &&
  chromiumExecutable() !== undefined &&
  process.env.GSAP_MCP_SKIP_BROWSER_TESTS !== '1';

/** Turns the pattern's JSX markup back into plain HTML for the decoy. */
function decoyHtml(markup: string): string {
  return markup.replace(/className=/g, 'class=');
}

describe.skipIf(!canRun)('generated React components in a real app', () => {
  let server: Server;
  let origin: string;
  let browser: Awaited<ReturnType<typeof import('playwright').chromium.launch>>;
  let workDir: string;
  const bundles = new Map<string, string>();
  const documents = new Map<string, string>();

  beforeAll(async () => {
    workDir = mkdtempSync(join(tmpdir(), 'gsap-react-'));

    server = createServer((request, response) => {
      const path = new URL(request.url ?? '/', 'http://x').pathname;

      const bundle = bundles.get(path);
      if (bundle) {
        response.writeHead(200, { 'content-type': 'text/javascript' });
        response.end(bundle);
        return;
      }

      const document = documents.get(path);
      if (document) {
        response.writeHead(200, { 'content-type': 'text/html' });
        response.end(document);
        return;
      }

      response.writeHead(404).end('not found');
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    browser = await playwright!.chromium.launch({
      executablePath: chromiumExecutable(),
    });
  }, 180_000);

  afterAll(async () => {
    await browser?.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  /**
   * Bundles a generated component into a real React app with a mount toggle
   * and a decoy, and returns the page URL.
   */
  async function build(patternId: string): Promise<string> {
    const pattern = getPattern(patternId)!;
    const spec = pattern.build('react');
    const component = renderPattern(pattern, 'react');

    const componentFile = join(workDir, `${patternId}.jsx`);
    const entryFile = join(workDir, `${patternId}.entry.jsx`);

    writeFileSync(componentFile, component);
    writeFileSync(
      join(workDir, 'route-transition.js'),
      `let exit = null;
export const setRouteExit = (fn) => { exit = fn; };
export const playRouteExit = () => (exit ? exit() : Promise.resolve());
`,
    );
    writeFileSync(
      entryFile,
      `import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Component from "./${patternId}.jsx";

gsap.registerPlugin(ScrollTrigger);
window.__gsap = gsap;
window.__ScrollTrigger = ScrollTrigger;

function App() {
  const [mounted, setMounted] = useState(true);
  window.__unmount = () => setMounted(false);
  return mounted ? <Component /> : null;
}

// Deliberately NOT StrictMode: double-invoked effects are a separate concern
// from what this suite checks, and would mask a real teardown bug.
createRoot(document.getElementById("root")).render(<App />);
window.__mounted = true;
`,
    );

    const result = await esbuild!.build({
      entryPoints: [entryFile],
      bundle: true,
      format: 'esm',
      jsx: 'automatic',
      write: false,
      absWorkingDir: ROOT,
      // The scratch entry files live outside the project, so normal upward
      // node_modules resolution cannot reach this repo's dependencies.
      nodePaths: [join(ROOT, 'node_modules')],
      define: { 'process.env.NODE_ENV': '"development"' },
      logLevel: 'silent',
    });

    const bundlePath = `/${patternId}.js`;
    bundles.set(bundlePath, result.outputFiles[0].text);

    const documentPath = `/${patternId}.html`;
    documents.set(
      documentPath,
      `<!doctype html>
<html><head><meta charset="utf-8"><style>
  body { margin: 0; font-family: sans-serif; }
  .spacer { height: 150vh; background: #eee; }
  .parallax-section, .pin-section { height: 100vh; position: relative; overflow: hidden; }
  .parallax-layer { position: absolute; inset: -30% 0; background: linear-gradient(#89f, #f8a); }
  .chart { display: flex; align-items: flex-end; height: 200px; }
  .chart-bar { width: 40px; background: #39f; }
</style></head>
<body>
  <!-- DECOY: same classes, outside the component. A scoped selector must
       never reach these. -->
  <div id="decoy">
${decoyHtml(spec.markup ?? '<div></div>')}
  </div>
  <div id="root"></div>
  <div class="spacer"></div>
  <script>
    window.__errors = [];
    addEventListener('error', (e) => window.__errors.push(String(e.message || e.error)));
    addEventListener('unhandledrejection', (e) => window.__errors.push('rejection: ' + e.reason));
  </script>
  <script type="module" src="${bundlePath}"></script>
</body></html>`,
    );

    return `${origin}${documentPath}`;
  }

  async function open(
    patternId: string,
    options: { reducedMotion?: 'reduce' | 'no-preference' } = {},
  ) {
    const url = await build(patternId);
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
      reducedMotion: options.reducedMotion ?? 'no-preference',
    });
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__mounted === true, null, {
      timeout: 15_000,
    });
    return page;
  }

  it('mounts and renders the component alongside the decoy', async () => {
    const page = await open('timeline-sequence');
    try {
      const counts = await page.evaluate(() => ({
        inComponent: document.querySelectorAll('#root .hero-title').length,
        inDecoy: document.querySelectorAll('#decoy .hero-title').length,
        container: document.querySelectorAll('#root .hero-sequence-root').length,
      }));
      expect(counts.inComponent).toBe(1);
      expect(counts.inDecoy).toBe(1);
      expect(counts.container).toBe(1);
      expect(await page.evaluate(() => window.__errors)).toEqual([]);
    } finally {
      await page.close();
    }
  }, 60_000);

  it('useGSAP scope confines selectors to the component', async () => {
    // The decisive test. mm.add(conditions, handler, container) is passed the
    // React ref object, not container.current. If GSAP does not unwrap it, the
    // scope is inert and the decoy animates too.
    const page = await open('timeline-sequence');
    try {
      await page.waitForTimeout(120);

      const midFlight = await page.evaluate(() => ({
        component: getComputedStyle(
          document.querySelector('#root .hero-title')!,
        ).opacity,
        decoy: getComputedStyle(document.querySelector('#decoy .hero-title')!)
          .opacity,
      }));

      // The component's own element is mid-animation.
      expect(Number(midFlight.component)).toBeLessThan(1);
      // The decoy is untouched. This is what proves the ref was unwrapped.
      expect(Number(midFlight.decoy)).toBe(1);

      await page.waitForTimeout(2500);
      const settled = await page.evaluate(
        () =>
          getComputedStyle(document.querySelector('#root .hero-title')!).opacity,
      );
      expect(Number(settled)).toBe(1);
      expect(await page.evaluate(() => window.__errors)).toEqual([]);
    } finally {
      await page.close();
    }
  }, 60_000);

  it('never writes inline styles onto the decoy', async () => {
    const page = await open('timeline-sequence');
    try {
      await page.waitForTimeout(150);
      const decoyStyles = await page.evaluate(() =>
        [...document.querySelectorAll('#decoy *')].map(
          (node) => node.getAttribute('style') ?? '',
        ),
      );
      // GSAP animates by writing inline styles; none should exist here.
      expect(decoyStyles.every((style) => style === '')).toBe(true);
    } finally {
      await page.close();
    }
  }, 60_000);

  it('scopes ScrollTrigger and creates real triggers', async () => {
    const page = await open('scroll-reveal');
    try {
      await page.waitForTimeout(200);

      const state = await page.evaluate(() => {
        const all = window.__ScrollTrigger!.getAll();
        return {
          total: all.length,
          unresolved: all.filter((instance) => !instance.trigger).length,
          // Every trigger must live inside the component, never in the decoy.
          outsideComponent: all.filter(
            (instance) =>
              instance.trigger && !document.querySelector('#root')!.contains(instance.trigger),
          ).length,
        };
      });

      expect(state.total).toBeGreaterThan(0);
      expect(state.unresolved).toBe(0);
      expect(state.outsideComponent).toBe(0);
      expect(await page.evaluate(() => window.__errors)).toEqual([]);
    } finally {
      await page.close();
    }
  }, 60_000);

  it('tears everything down on unmount', async () => {
    const page = await open('scroll-reveal');
    try {
      await page.waitForTimeout(200);
      const before = await page.evaluate(
        () => window.__ScrollTrigger!.getAll().length,
      );
      expect(before).toBeGreaterThan(0);

      await page.evaluate(() => window.__unmount!());
      await page.waitForTimeout(300);

      const after = await page.evaluate(() => ({
        triggers: window.__ScrollTrigger!.getAll().length,
        stillRendered: document.querySelectorAll('#root .reveal-item').length,
      }));

      // useGSAP's cleanup plus mm.revert() must kill the ScrollTriggers this
      // component created. A leak here means animations running on detached
      // nodes.
      expect(after.triggers).toBe(0);
      expect(after.stillRendered).toBe(0);
      expect(await page.evaluate(() => window.__errors)).toEqual([]);
    } finally {
      await page.close();
    }
  }, 60_000);

  it('contextSafe handlers animate only the component', async () => {
    const page = await open('hover-interaction');
    try {
      await page.waitForTimeout(150);

      await page.evaluate(() => {
        document
          .querySelector('#root .hover-card')!
          .dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
      });
      await page.waitForTimeout(250);

      const transforms = await page.evaluate(() => ({
        component: getComputedStyle(
          document.querySelector('#root .hover-card')!,
        ).transform,
        decoy: getComputedStyle(document.querySelector('#decoy .hover-card')!)
          .transform,
      }));

      // The hovered card scaled; the decoy did not.
      expect(transforms.component).not.toBe('none');
      expect(transforms.decoy).toBe('none');
      expect(await page.evaluate(() => window.__errors)).toEqual([]);
    } finally {
      await page.close();
    }
  }, 60_000);

  it('honours prefers-reduced-motion in both directions', async () => {
    const moving = await open('timeline-sequence', {
      reducedMotion: 'no-preference',
    });
    try {
      await moving.waitForTimeout(120);
      const opacity = await moving.evaluate(
        () =>
          getComputedStyle(document.querySelector('#root .hero-title')!).opacity,
      );
      expect(Number(opacity)).toBeLessThan(1);
    } finally {
      await moving.close();
    }

    const reduced = await open('timeline-sequence', { reducedMotion: 'reduce' });
    try {
      await reduced.waitForTimeout(200);
      const style = await reduced.evaluate(() => {
        const computed = getComputedStyle(
          document.querySelector('#root .hero-title')!,
        );
        return { opacity: computed.opacity, visibility: computed.visibility };
      });
      expect(Number(style.opacity)).toBe(1);
      expect(style.visibility).toBe('visible');
      expect(await reduced.evaluate(() => window.__errors)).toEqual([]);
    } finally {
      await reduced.close();
    }
  }, 90_000);

  it('compiles and mounts every React pattern without errors', async () => {
    const patterns = [
      'parallax',
      'pinned-section',
      'text-reveal',
      'draggable',
      'loading-sequence',
      'page-transition',
      'data-viz',
    ];

    for (const id of patterns) {
      const page = await open(id);
      try {
        await page.waitForTimeout(250);
        const errors = await page.evaluate(() => window.__errors);
        expect(errors, `${id} reported page errors`).toEqual([]);
      } finally {
        await page.close();
      }
    }
  }, 180_000);
});

declare global {
  interface Window {
    __mounted?: boolean;
    __unmount?: () => void;
    __errors: string[];
    __gsap?: unknown;
    __ScrollTrigger?: {
      getAll(): Array<{ trigger?: Element | null }>;
    };
  }
}
