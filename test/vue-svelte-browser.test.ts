/**
 * Mounts the generated Vue and Svelte components in real apps, in a browser.
 *
 * These were the last two frameworks verified only by construction and static
 * assertion — the exact reasoning that was wrong three times already (the
 * container selector, the null ScrollTrigger trigger, and the JSX style
 * attribute all passed static checks).
 *
 * Unlike React, neither of these has useGSAP to fall back on. The scope
 * argument to mm.add() is the ONLY thing confining selectors here, so the
 * decoy check is load-bearing rather than belt-and-braces.
 */

import { createServer, type Server } from 'node:http';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { getPattern, PATTERNS, renderPattern } from '../src/generators/patterns.js';

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
const vueCompiler = await optional('@vue/compiler-sfc');
const svelteCompiler = await optional('svelte/compiler');

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
  vueCompiler !== null &&
  svelteCompiler !== null &&
  chromiumExecutable() !== undefined &&
  process.env.GSAP_MCP_SKIP_BROWSER_TESTS !== '1';

/** Strips Vue/Svelte binding attributes so the decoy is inert markup. */
function decoyHtml(markup: string): string {
  return markup.replace(/\s(?:ref|bind:this)="[^"]*"/g, '');
}

/** esbuild plugin compiling .vue single-file components. */
function vuePlugin() {
  return {
    name: 'vue',
    setup(build: {
      onLoad(
        options: { filter: RegExp },
        callback: (args: { path: string }) => { contents: string; loader: string },
      ): void;
    }) {
      build.onLoad({ filter: /\.vue$/ }, ({ path }) => {
        const source = readFileSync(path, 'utf8');
        const { descriptor, errors } = vueCompiler!.parse(source, {
          filename: path,
        });
        if (errors.length) throw new Error(errors[0].message);

        // inlineTemplate precompiles the template into the setup function, so
        // the runtime-only Vue build is enough.
        const compiled = vueCompiler!.compileScript(descriptor, {
          id: basename(path),
          inlineTemplate: true,
        });
        return { contents: compiled.content, loader: 'ts' };
      });
    },
  };
}

/** esbuild plugin compiling .svelte components. */
function sveltePlugin() {
  return {
    name: 'svelte',
    setup(build: {
      onLoad(
        options: { filter: RegExp },
        callback: (args: { path: string }) => { contents: string; loader: string },
      ): void;
    }) {
      build.onLoad({ filter: /\.svelte$/ }, ({ path }) => {
        const source = readFileSync(path, 'utf8');
        const { js } = svelteCompiler!.compile(source, {
          filename: path,
          generate: 'client',
        });
        return { contents: js.code, loader: 'js' };
      });
    },
  };
}

/** Patterns that can run headlessly; lenis is not a dependency here. */
const RUNNABLE = PATTERNS.filter((id) => id !== 'smooth-scroll-lenis');

describe.skipIf(!canRun)('generated Vue and Svelte components in real apps', () => {
  let server: Server;
  let origin: string;
  let browser: Awaited<ReturnType<typeof import('playwright').chromium.launch>>;
  let workDir: string;
  const assets = new Map<string, { body: string; type: string }>();

  beforeAll(async () => {
    workDir = mkdtempSync(join(tmpdir(), 'gsap-vs-'));

    // The shared module the page-transition pattern imports.
    writeFileSync(
      join(workDir, 'route-transition.js'),
      `let exit = null;
export const setRouteExit = (fn) => { exit = fn; };
export const playRouteExit = () => (exit ? exit() : Promise.resolve());
`,
    );

    server = createServer((request, response) => {
      const path = new URL(request.url ?? '/', 'http://x').pathname;
      const asset = assets.get(path);
      if (!asset) {
        response.writeHead(404).end('not found');
        return;
      }
      response.writeHead(200, { 'content-type': asset.type });
      response.end(asset.body);
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

  async function buildPage(
    framework: 'vue' | 'svelte',
    patternId: string,
  ): Promise<string> {
    const pattern = getPattern(patternId)!;
    const spec = pattern.build(framework);
    const extension = framework === 'vue' ? 'vue' : 'svelte';
    const componentFile = join(workDir, `${patternId}.${framework}.${extension}`);

    writeFileSync(componentFile, renderPattern(pattern, framework));

    const entryFile = join(workDir, `${patternId}.${framework}.entry.js`);
    writeFileSync(
      entryFile,
      framework === 'vue'
        ? `import { createApp } from "vue";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Component from "./${basename(componentFile)}";

gsap.registerPlugin(ScrollTrigger);
window.__gsap = gsap;
window.__ScrollTrigger = ScrollTrigger;

const app = createApp(Component);
app.mount("#root");
window.__unmount = () => app.unmount();
window.__mounted = true;
`
        : `import { mount, unmount } from "svelte";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Component from "./${basename(componentFile)}";

gsap.registerPlugin(ScrollTrigger);
window.__gsap = gsap;
window.__ScrollTrigger = ScrollTrigger;

const app = mount(Component, { target: document.getElementById("root") });
window.__unmount = () => unmount(app);
window.__mounted = true;
`,
    );

    const built = await esbuild!.build({
      entryPoints: [entryFile],
      bundle: true,
      format: 'esm',
      write: false,
      absWorkingDir: ROOT,
      nodePaths: [join(ROOT, 'node_modules')],
      conditions: framework === 'svelte' ? ['browser'] : undefined,
      plugins: [framework === 'vue' ? vuePlugin() : sveltePlugin()],
      define: {
        'process.env.NODE_ENV': '"development"',
        __VUE_OPTIONS_API__: 'true',
        __VUE_PROD_DEVTOOLS__: 'false',
        __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
      },
      logLevel: 'silent',
    });

    const key = `${framework}-${patternId}`;
    assets.set(`/${key}.js`, {
      body: built.outputFiles[0].text,
      type: 'text/javascript',
    });

    assets.set(`/${key}.html`, {
      type: 'text/html',
      body: `<!doctype html>
<html><head><meta charset="utf-8"><style>
  body { margin: 0; font-family: sans-serif; }
  .spacer { height: 150vh; background: #eee; }
  .parallax-section, .pin-section { height: 100vh; position: relative; overflow: hidden; }
  .parallax-layer { position: absolute; inset: -30% 0; background: linear-gradient(#89f, #f8a); }
  .chart { display: flex; align-items: flex-end; height: 200px; }
  .chart-bar { width: 40px; background: #39f; }
</style></head>
<body>
  <!-- DECOY: same classes, outside the component. With no useGSAP here, the
       scope passed to mm.add() is the only thing keeping GSAP away from it. -->
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
  <script type="module" src="/${key}.js"></script>
</body></html>`,
    });

    return `${origin}/${key}.html`;
  }

  async function open(
    framework: 'vue' | 'svelte',
    patternId: string,
    reducedMotion: 'reduce' | 'no-preference' = 'no-preference',
  ) {
    const url = await buildPage(framework, patternId);
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
      reducedMotion,
    });
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__mounted === true, null, {
      timeout: 15_000,
    });
    return page;
  }

  const frameworks = ['vue', 'svelte'] as const;

  it.each(frameworks)('%s: the component mounts and animates', async (framework) => {
    const page = await open(framework, 'timeline-sequence');
    try {
      await page.waitForTimeout(120);
      const during = await page.evaluate(
        () =>
          getComputedStyle(document.querySelector('#root .hero-title')!).opacity,
      );
      expect(Number(during)).toBeLessThan(1);

      await page.waitForTimeout(2600);
      const after = await page.evaluate(() => {
        const style = getComputedStyle(
          document.querySelector('#root .hero-title')!,
        );
        return { opacity: style.opacity, visibility: style.visibility };
      });
      expect(Number(after.opacity)).toBe(1);
      expect(after.visibility).toBe('visible');
      expect(await page.evaluate(() => window.__errors)).toEqual([]);
    } finally {
      await page.close();
    }
  }, 90_000);

  it.each(frameworks)(
    "%s: mm.add's scope keeps selectors out of the rest of the page",
    async (framework) => {
      // The decisive test. Neither framework has useGSAP, so if the scope
      // argument were ineffective nothing else would confine these selectors.
      const page = await open(framework, 'timeline-sequence');
      try {
        await page.waitForTimeout(150);

        const decoy = await page.evaluate(() => ({
          opacity: getComputedStyle(
            document.querySelector('#decoy .hero-title')!,
          ).opacity,
          inlineStyles: [...document.querySelectorAll('#decoy *')].map(
            (node) => node.getAttribute('style') ?? '',
          ),
        }));

        expect(Number(decoy.opacity)).toBe(1);
        expect(decoy.inlineStyles.every((style) => style === '')).toBe(true);

        // Vacuity guard: the component's own element must really have been
        // animated, or "the decoy is untouched" proves nothing.
        const own = await page.evaluate(
          () =>
            document.querySelector('#root .hero-title')!.getAttribute('style') ??
            '',
        );
        expect(own).not.toBe('');
      } finally {
        await page.close();
      }
    },
    90_000,
  );

  it.each(frameworks)(
    '%s: ScrollTriggers are created, resolved, and inside the component',
    async (framework) => {
      const page = await open(framework, 'scroll-reveal');
      try {
        await page.waitForTimeout(250);
        const state = await page.evaluate(() => {
          const all = window.__ScrollTrigger!.getAll();
          return {
            total: all.length,
            unresolved: all.filter((instance) => !instance.trigger).length,
            outside: all.filter(
              (instance) =>
                instance.trigger &&
                !document.querySelector('#root')!.contains(instance.trigger),
            ).length,
          };
        });

        expect(state.total).toBeGreaterThan(0);
        expect(state.unresolved).toBe(0);
        expect(state.outside).toBe(0);
        expect(await page.evaluate(() => window.__errors)).toEqual([]);
      } finally {
        await page.close();
      }
    },
    90_000,
  );

  it.each(frameworks)('%s: unmounting reverts everything', async (framework) => {
    const page = await open(framework, 'scroll-reveal');
    try {
      await page.waitForTimeout(250);
      const before = await page.evaluate(
        () => window.__ScrollTrigger!.getAll().length,
      );
      expect(before).toBeGreaterThan(0);

      await page.evaluate(() => window.__unmount!());
      await page.waitForTimeout(400);

      const after = await page.evaluate(() => ({
        triggers: window.__ScrollTrigger!.getAll().length,
        stillRendered: document.querySelectorAll('#root .reveal-item').length,
      }));

      // Vue's onUnmounted and Svelte's onMount cleanup must both revert the
      // matchMedia, or ScrollTriggers keep running on detached nodes.
      expect(after.triggers).toBe(0);
      expect(after.stillRendered).toBe(0);
      expect(await page.evaluate(() => window.__errors)).toEqual([]);
    } finally {
      await page.close();
    }
  }, 90_000);

  it.each(frameworks)(
    '%s: prefers-reduced-motion is honoured in both directions',
    async (framework) => {
      const reduced = await open(framework, 'timeline-sequence', 'reduce');
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
    },
    90_000,
  );

  it.each(frameworks)('%s: every pattern mounts without errors', async (framework) => {
    for (const id of RUNNABLE) {
      const page = await open(framework, id);
      try {
        await page.waitForTimeout(250);
        expect(
          await page.evaluate(() => window.__errors),
          `${framework}/${id} reported page errors`,
        ).toEqual([]);
      } finally {
        await page.close();
      }
    }
  }, 240_000);
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
