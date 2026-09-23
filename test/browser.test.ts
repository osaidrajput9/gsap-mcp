/**
 * Runs the generated snippets against real GSAP in a real browser.
 *
 * Every other suite checks the snippets as *text* — they parse, they contain
 * the right APIs, they satisfy the validator. None of that proves GSAP accepts
 * them. This one loads each vanilla snippet into Chromium with GSAP 3.15.0 from
 * node_modules and asserts the animations actually happen.
 *
 * Skips itself when Playwright or a Chromium build is unavailable, so the
 * normal suite still runs anywhere.
 */

import { createServer, type Server } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  containerClass,
  PLUGIN_MODULES,
} from '../src/generators/framework.js';
import {
  getPattern,
  PATTERNS,
  renderPattern,
} from '../src/generators/patterns.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const GSAP_DIR = join(ROOT, 'node_modules', 'gsap');

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    return null;
  }
}

const playwright = await loadPlaywright();

/**
 * Locates a Chromium this Playwright build can drive.
 *
 * A preinstalled browser often does not match the revision the installed
 * Playwright expects, so an explicit path is tried before Playwright's own.
 * Returning undefined skips the suite rather than failing it, so the rest of
 * the tests still run on a machine with no browser.
 */
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
    // Playwright throws when no browser is installed at all.
  }
  return undefined;
}

const canRun =
  playwright !== null &&
  existsSync(GSAP_DIR) &&
  chromiumExecutable() !== undefined &&
  process.env.GSAP_MCP_SKIP_BROWSER_TESTS !== '1';

/** The three-line module the page-transition pattern documents. */
const ROUTE_TRANSITION_STUB = `let exit = null;
export const setRouteExit = (fn) => { exit = fn; };
export const playRouteExit = () => (exit ? exit() : Promise.resolve());
`;

const IMPORT_MAP = JSON.stringify({
  imports: {
    gsap: '/gsap/index.js',
    'gsap/': '/gsap/',
    ...Object.fromEntries(
      Object.entries(PLUGIN_MODULES).map(([name, spec]) => [
        spec,
        `/gsap/${name}.js`,
      ]),
    ),
  },
});

function buildPage(
  code: string,
  markup: string,
  tall: boolean,
  container: string,
): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<script type="importmap">${IMPORT_MAP}</script>
<style>
  body { margin: 0; font-family: sans-serif; }
  .spacer { height: 150vh; background: #eee; }
  .parallax-section, .pin-section, .h-wrapper { height: 100vh; position: relative; overflow: hidden; }
  .parallax-layer { position: absolute; inset: -30% 0; background: linear-gradient(#89f, #f8a); }
  .h-track { display: flex; width: 300vw; }
  .h-panel { width: 100vw; }
  .chart { display: flex; align-items: flex-end; height: 200px; }
  .chart-bar { width: 40px; background: #39f; }
  .drag-bounds { width: 300px; height: 300px; border: 1px solid #333; }
  .drag-item { width: 60px; height: 60px; background: #3a7; }
  .loader-bar { height: 4px; background: #39f; transform: scaleX(0); }
  /* Deliberately nothing here hides an animated element. The reduced-motion
     contract depends on the resting state already being correct. */
</style>
</head>
<body>
${tall ? '<div class="spacer" id="pad-top"></div>' : ''}
<div class="${container}">
${markup}
</div>
<div class="spacer" id="pad-bottom"></div>
<script>
  window.__errors = [];
  addEventListener('error', (e) => window.__errors.push(String(e.message || e.error)));
  addEventListener('unhandledrejection', (e) => window.__errors.push('rejection: ' + e.reason));
</script>
<script type="module">
${code}
try {
  const { ScrollTrigger } = await import('gsap/ScrollTrigger');
  window.__ScrollTrigger = ScrollTrigger;
} catch {}
window.__ready = true;
</script>
</body>
</html>`;
}

const MIME: Record<string, string> = {
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.html': 'text/html',
  '.json': 'application/json',
};

describe.skipIf(!canRun)('generated snippets in a real browser', () => {
  let server: Server;
  let origin: string;
  let browser: Awaited<ReturnType<typeof import('playwright').chromium.launch>>;
  const pages = new Map<string, string>();

  beforeAll(async () => {
    server = createServer((request, response) => {
      const url = new URL(request.url ?? '/', 'http://localhost');
      const path = decodeURIComponent(url.pathname);

      if (path === '/route-transition.js') {
        response.writeHead(200, { 'content-type': 'text/javascript' });
        response.end(ROUTE_TRANSITION_STUB);
        return;
      }

      if (path.startsWith('/gsap/')) {
        // Serve GSAP's own ESM build straight out of node_modules.
        const file = join(GSAP_DIR, path.slice('/gsap/'.length));
        if (!file.startsWith(GSAP_DIR) || !existsSync(file)) {
          response.writeHead(404).end('not found');
          return;
        }
        response.writeHead(200, {
          'content-type': MIME[extname(file)] ?? 'application/octet-stream',
        });
        response.end(readFileSync(file));
        return;
      }

      const page = pages.get(path);
      if (page) {
        response.writeHead(200, { 'content-type': 'text/html' });
        response.end(page);
        return;
      }

      response.writeHead(404).end('not found');
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    browser = await playwright!.chromium.launch({
      executablePath: chromiumExecutable(),
    });
  }, 120_000);

  afterAll(async () => {
    await browser?.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  /** Registers a page and returns its URL. */
  function register(
    id: string,
    code: string,
    markup: string,
    tall: boolean,
    container: string,
  ) {
    const path = `/${id}.html`;
    pages.set(path, buildPage(code, markup, tall, container));
    return `${origin}${path}`;
  }

  async function open(
    id: string,
    options: { reducedMotion?: 'reduce' | 'no-preference'; tall?: boolean } = {},
  ) {
    const pattern = getPattern(id)!;
    const spec = pattern.build('vanilla');
    const code = renderPattern(pattern, 'vanilla');
    const url = register(
      `${id}-${options.reducedMotion ?? 'default'}-${options.tall ? 'tall' : 'short'}`,
      code,
      spec.markup ?? '<div></div>',
      options.tall ?? false,
      containerClass(spec.componentName),
    );

    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
      reducedMotion: options.reducedMotion ?? 'no-preference',
    });
    await page.goto(url, { waitUntil: 'load' });
    return page;
  }

  // `smooth-scroll-lenis` imports the third-party `lenis` package, which is not
  // a dependency of this repository. It is the one pattern outside the
  // official skills and is excluded here for that reason.
  const RUNNABLE = PATTERNS.filter((id) => id !== 'smooth-scroll-lenis');

  /**
   * Patterns that actually *create* a ScrollTrigger. Registering the plugin is
   * not the same thing: loading-sequence and page-transition register it only
   * so they can call the static ScrollTrigger.refresh().
   */
  const SCROLL_TRIGGER_PATTERNS = new Set(
    RUNNABLE.filter((id) => {
      const body = getPattern(id)!.build('vanilla').body;
      return (
        /\bscrollTrigger\s*:/.test(body) ||
        /ScrollTrigger\s*\.\s*(create|batch)\s*\(/.test(body)
      );
    }),
  );

  it.each(RUNNABLE)(
    '%s executes against GSAP 3.15.0 without errors',
    async (id) => {
      const page = await open(id, { tall: true });
      try {
        await page.waitForFunction(() => window.__ready === true, null, {
          timeout: 10_000,
        });
        await page.waitForTimeout(400);
        const errors = await page.evaluate(() => window.__errors);
        expect(errors).toEqual([]);
      } finally {
        await page.close();
      }
    },
    30_000,
  );

  it.each(RUNNABLE)(
    '%s resolves the trigger of every ScrollTrigger it creates',
    async (id) => {
      // A scoped selector never matches the scope element itself, so a trigger
      // pointing at the container silently resolves to null and ScrollTrigger
      // quietly falls back to the tween's own target. This catches that.
      const page = await open(id, { tall: true });
      try {
        await page.waitForFunction(() => window.__ready === true, null, {
          timeout: 10_000,
        });
        await page.waitForTimeout(300);

        const { total, unresolved } = await page.evaluate(() => {
          const ScrollTrigger = window.__ScrollTrigger;
          if (!ScrollTrigger) return { total: 0, unresolved: [] as string[] };
          const all = ScrollTrigger.getAll();
          return {
            total: all.length,
            unresolved: all
              .filter((instance) => !instance.trigger)
              .map((instance) => instance.vars?.id ?? '(unnamed)'),
          };
        });

        expect(unresolved).toEqual([]);
        // Guard against a vacuous pass: patterns that use ScrollTrigger must
        // actually have created one by now.
        if (SCROLL_TRIGGER_PATTERNS.has(id)) {
          expect(total).toBeGreaterThan(0);
        }
      } finally {
        await page.close();
      }
    },
    30_000,
  );

  it('timeline-sequence actually animates, then settles at the resting state', async () => {
    const page = await open('timeline-sequence');
    try {
      await page.waitForFunction(() => window.__ready === true);

      // Sampled early: gsap.from has applied its start state and the tween is
      // mid-flight, so the title is not yet fully opaque.
      const midFlight = await page.evaluate(
        () => getComputedStyle(document.querySelector('.hero-title')!).opacity,
      );
      expect(Number(midFlight)).toBeLessThan(1);

      await page.waitForTimeout(2500);

      const settled = await page.evaluate(() => {
        const style = getComputedStyle(document.querySelector('.hero-title')!);
        return { opacity: style.opacity, visibility: style.visibility };
      });
      expect(Number(settled.opacity)).toBe(1);
      expect(settled.visibility).toBe('visible');
      expect(await page.evaluate(() => window.__errors)).toEqual([]);
    } finally {
      await page.close();
    }
  }, 30_000);

  it('runs the handler under BOTH reduced-motion states', async () => {
    // This is the failure the two-query condition block exists to prevent. A
    // lone "(prefers-reduced-motion: reduce)" condition means the matchMedia
    // handler never runs for anyone who has not set the preference.
    const moving = await open('timeline-sequence', {
      reducedMotion: 'no-preference',
    });
    try {
      await moving.waitForFunction(() => window.__ready === true);
      const opacity = await moving.evaluate(
        () => getComputedStyle(document.querySelector('.hero-title')!).opacity,
      );
      // Mid-animation: proves the handler ran for a visitor with no preference.
      expect(Number(opacity)).toBeLessThan(1);
    } finally {
      await moving.close();
    }

    const reduced = await open('timeline-sequence', {
      reducedMotion: 'reduce',
    });
    try {
      await reduced.waitForFunction(() => window.__ready === true);
      await reduced.waitForTimeout(150);

      // duration: 0 — content is already at its resting state, not hidden.
      const style = await reduced.evaluate(() => {
        const computed = getComputedStyle(document.querySelector('.hero-title')!);
        return { opacity: computed.opacity, visibility: computed.visibility };
      });
      expect(Number(style.opacity)).toBe(1);
      expect(style.visibility).toBe('visible');
      expect(await reduced.evaluate(() => window.__errors)).toEqual([]);
    } finally {
      await reduced.close();
    }
  }, 45_000);

  it('scroll-reveal fires ScrollTrigger.batch on scroll', async () => {
    const page = await open('scroll-reveal', { tall: true });
    try {
      await page.waitForFunction(() => window.__ready === true);

      // Below the fold: onEnter has not fired, so the card is untouched.
      const before = await page.evaluate(
        () =>
          getComputedStyle(document.querySelectorAll('.reveal-item')[0]!)
            .opacity,
      );
      expect(Number(before)).toBe(1);

      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(80);

      // onEnter ran gsap.from, so the card is mid-reveal.
      const during = await page.evaluate(
        () =>
          getComputedStyle(document.querySelectorAll('.reveal-item')[0]!)
            .opacity,
      );
      expect(Number(during)).toBeLessThan(1);

      await page.waitForTimeout(1800);
      const after = await page.evaluate(
        () =>
          getComputedStyle(document.querySelectorAll('.reveal-item')[0]!)
            .opacity,
      );
      expect(Number(after)).toBe(1);
    } finally {
      await page.close();
    }
  }, 45_000);

  it('parallax scrubs the layer linearly against scroll', async () => {
    const page = await open('parallax', { tall: true });
    try {
      await page.waitForFunction(() => window.__ready === true);

      const read = () =>
        page.evaluate(
          () =>
            getComputedStyle(document.querySelector('.parallax-layer')!)
              .transform,
        );

      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(200);
      const atTop = await read();

      await page.evaluate(() => window.scrollTo(0, 900));
      await page.waitForTimeout(300);
      const scrolled = await read();

      expect(scrolled).not.toBe(atTop);
      // A transform, not a layout property.
      expect(scrolled).toMatch(/^matrix/);
      expect(await page.evaluate(() => window.__errors)).toEqual([]);
    } finally {
      await page.close();
    }
  }, 45_000);

  it('scroll-text-fill fills words one after another, locked to scroll', async () => {
    const page = await open('scroll-text-fill', { tall: true });
    try {
      await page.waitForFunction(() => window.__ready === true);
      await page.waitForTimeout(300);

      // Drive scroll to the ScrollTrigger's OWN start, midpoint and end rather
      // than to guessed pixel offsets, so markup height cannot break this.
      const range = await page.evaluate(() => {
        const [st] = (window.__ScrollTrigger!.getAll() as unknown as Array<{
          start: number;
          end: number;
        }>);
        return { start: st.start, end: st.end };
      });
      expect(range.end).toBeGreaterThan(range.start);

      const wordOpacities = () =>
        page.evaluate(() =>
          [...document.querySelectorAll('.fill-text div')].map((node) =>
            Number(getComputedStyle(node).opacity),
          ),
        );
      const scrollTo = async (y: number) => {
        await page.evaluate((top) => window.scrollTo(0, top), y);
        await page.waitForTimeout(250);
      };

      // Before the start: split into words, every one dim — but never hidden.
      await scrollTo(Math.max(0, range.start - 200));
      const before = await wordOpacities();
      expect(before.length).toBeGreaterThan(5);
      for (const opacity of before) {
        expect(opacity).toBeCloseTo(0.2, 1);
      }

      // Midway: the fill has reached some words and not others, and it runs
      // in reading order — the first word is at least as full as the last.
      await scrollTo((range.start + range.end) / 2);
      const middle = await wordOpacities();
      expect(Math.max(...middle)).toBeGreaterThan(0.9);
      expect(Math.min(...middle)).toBeLessThan(0.3);
      expect(middle[0]).toBeGreaterThanOrEqual(middle[middle.length - 1]);

      // Past the end: every word full.
      await scrollTo(range.end + 200);
      for (const opacity of await wordOpacities()) {
        expect(opacity).toBeCloseTo(1, 1);
      }

      // Back up: it empties again. This is what distinguishes a scrubbed fill
      // from a reveal that plays once on enter — the gap in the catalog.
      await scrollTo(Math.max(0, range.start - 200));
      for (const opacity of await wordOpacities()) {
        expect(opacity).toBeCloseTo(0.2, 1);
      }

      // Screen readers get the whole sentence, not the fragments.
      expect(
        await page.evaluate(() =>
          document.querySelector('.fill-text')!.getAttribute('aria-label'),
        ),
      ).toBeTruthy();
      expect(await page.evaluate(() => window.__errors)).toEqual([]);
    } finally {
      await page.close();
    }
  }, 60_000);

  it('scroll-text-fill leaves text whole and full-strength under reduced motion', async () => {
    const page = await open('scroll-text-fill', {
      tall: true,
      reducedMotion: 'reduce',
    });
    try {
      await page.waitForFunction(() => window.__ready === true);
      await page.waitForTimeout(300);

      const state = await page.evaluate(() => {
        const text = document.querySelector('.fill-text')!;
        return {
          fragments: text.querySelectorAll('div').length,
          opacity: Number(getComputedStyle(text).opacity),
          triggers: window.__ScrollTrigger!.getAll().length,
        };
      });

      // Never split, never dimmed, nothing listening to scroll.
      expect(state.fragments).toBe(0);
      expect(state.opacity).toBe(1);
      expect(state.triggers).toBe(0);
      expect(await page.evaluate(() => window.__errors)).toEqual([]);
    } finally {
      await page.close();
    }
  }, 45_000);

  it('text-reveal splits the heading and masks the lines', async () => {
    const page = await open('text-reveal');
    try {
      await page.waitForFunction(() => window.__ready === true);
      await page.waitForTimeout(300);

      const split = await page.evaluate(() => {
        const heading = document.querySelector('.reveal-text')!;
        return {
          childElements: heading.querySelectorAll('div').length,
          // mask: "lines" wraps each line in an overflow-clipped element.
          clipped: [...heading.querySelectorAll('div')].some((node) => {
            const overflow = getComputedStyle(node).overflow;
            return overflow === 'clip' || overflow === 'hidden';
          }),
          // aria: "auto" labels the element and hides the fragments.
          ariaLabel: heading.getAttribute('aria-label'),
        };
      });

      expect(split.childElements).toBeGreaterThan(0);
      expect(split.clipped).toBe(true);
      expect(split.ariaLabel).toBeTruthy();
      expect(await page.evaluate(() => window.__errors)).toEqual([]);
    } finally {
      await page.close();
    }
  }, 45_000);
});

declare global {
  interface Window {
    __ready?: boolean;
    __errors: string[];
    __ScrollTrigger?: {
      getAll(): Array<{ trigger?: Element | null; vars?: { id?: string } }>;
    };
  }
}

