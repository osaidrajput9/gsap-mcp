/**
 * Acceptance test: "build me an interactive hero section."
 *
 * Every other suite calls the generator functions directly. This one goes
 * through the MCP protocol over stdio, exactly as Claude Code does, takes
 * whatever the server hands back verbatim, and then proves that output ships:
 * it validates clean against the server's own checker, and it runs in a real
 * React app in a browser.
 *
 * The scenario is a real one — an agency building a hero with an animated
 * headline and an interactive call to action. That needs two patterns composed
 * into one page, which no other test covers.
 */

import { createServer, type Server } from 'node:http';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SERVER_ENTRY = join(ROOT, 'dist', 'index.js');

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

const canRunBrowser =
  playwright !== null &&
  esbuild !== null &&
  existsSync(join(ROOT, 'node_modules', '@gsap', 'react')) &&
  chromiumExecutable() !== undefined &&
  process.env.GSAP_MCP_SKIP_BROWSER_TESTS !== '1';

/** Pulls the first fenced block of a given language out of a tool response. */
function codeBlock(markdown: string, language: string): string {
  const match = new RegExp('```' + language + '\\n([\\s\\S]*?)```').exec(
    markdown,
  );
  if (!match) throw new Error(`no ${language} code block in tool output`);
  return match[1];
}

function textOf(result: { content: unknown }): string {
  return (result.content as Array<{ text: string }>)[0].text;
}

describe.skipIf(!existsSync(SERVER_ENTRY))(
  'acceptance: an agency asks for an interactive hero section',
  () => {
    let client: Client;

    /** Code the server produced, captured once and reused by later tests. */
    const generated: { hero?: string; interaction?: string } = {};

    beforeAll(async () => {
      client = new Client({ name: 'acceptance', version: '1.0.0' });
      await client.connect(
        new StdioClientTransport({
          command: process.execPath,
          args: [SERVER_ENTRY],
          stderr: 'pipe',
        }),
      );
    }, 60_000);

    afterAll(async () => {
      await client?.close();
    });

    it('surfaces a hero-appropriate pattern when asked in plain language', async () => {
      // The realistic first message. The request names no pattern, so the
      // server must not guess — it must show what it can build, clearly
      // enough that a coding agent can choose.
      const response = textOf(
        await client.callTool({
          name: 'understand_and_create_animation',
          arguments: {
            request:
              'interactive hero section with an animated headline and a hover CTA',
            framework: 'react',
          },
        }),
      );

      expect(response).toContain('# Pick a pattern');
      // A hero entrance and a hover interaction are both discoverable by name
      // and description, which is what lets an agent route without guessing.
      expect(response).toMatch(/`timeline-sequence` — Hero entrance timeline/);
      expect(response).toMatch(
        /`hover-interaction` — Hover and focus micro-interaction/,
      );
    }, 30_000);

    it('still answers the legacy hero-section name', async () => {
      // Existing users and older prompts ask for this by name.
      const response = textOf(
        await client.callTool({
          name: 'create_production_pattern',
          arguments: { pattern_type: 'hero-section', framework: 'react' },
        }),
      );
      expect(response).toContain('# Production pattern: hero-section');
      generated.hero = codeBlock(response, 'jsx');
      expect(generated.hero).toContain('export default function HeroSequence');
    }, 30_000);

    it('generates the interactive half', async () => {
      const response = textOf(
        await client.callTool({
          name: 'understand_and_create_animation',
          arguments: {
            request: 'the hero call to action should respond to hover',
            pattern: 'hover-interaction',
            framework: 'react',
          },
        }),
      );
      generated.interaction = codeBlock(response, 'jsx');
      expect(generated.interaction).toContain('contextSafe');
    }, 30_000);

    it('the code it produced passes its own validator', async () => {
      // The server grading its own output. An agency ships this, so a finding
      // here is a finding in the deliverable.
      for (const [name, code] of Object.entries(generated)) {
        const result = await client.callTool({
          name: 'validate_gsap_code',
          arguments: { code: code!, filename: `${name}.jsx` },
        });

        const structured = result.structuredContent as {
          findings: Array<{ id: string; severity: string; message: string }>;
          counts: { error: number; warning: number; info: number };
        };

        expect(
          structured.findings.filter((f) => f.severity === 'error'),
          `${name} produced errors`,
        ).toEqual([]);
        expect(structured.counts.error).toBe(0);
      }
    }, 30_000);

    it('the hero meets the accessibility bar an agency has to clear', async () => {
      const hero = generated.hero!;

      // Reduced motion is handled, and handled for BOTH populations.
      expect(hero).toContain('(prefers-reduced-motion: reduce)');
      expect(hero).toContain('(prefers-reduced-motion: no-preference)');

      // Nothing is hidden by CSS, so the resting state is readable even if no
      // animation ever runs.
      expect(hero).not.toMatch(/opacity:\s*0[^.]/);
      expect(hero).not.toContain('visibility: hidden');

      // The CTA is a real button, not a div.
      expect(hero).toContain('<button className="hero-cta" type="button">');
    }, 30_000);

    it('the interaction is reachable by keyboard, not just by pointer', async () => {
      // An agency deliverable that only responds to the mouse is a defect.
      const interaction = generated.interaction!;
      expect(interaction).toContain('pointerenter');
      expect(interaction).toContain('focus');
      expect(interaction).toContain('blur');
      // Listeners are removed again, so a route change does not leak them.
      expect(interaction).toContain('removeEventListener');
    }, 30_000);
  },
);

describe.skipIf(!canRunBrowser || !existsSync(SERVER_ENTRY))(
  'acceptance: the hero the server produced actually runs',
  () => {
    let client: Client;
    let server: Server;
    let origin: string;
    let browser: Awaited<ReturnType<typeof import('playwright').chromium.launch>>;
    let pageUrl: string;

    beforeAll(async () => {
      client = new Client({ name: 'acceptance-browser', version: '1.0.0' });
      await client.connect(
        new StdioClientTransport({
          command: process.execPath,
          args: [SERVER_ENTRY],
          stderr: 'pipe',
        }),
      );

      const hero = codeBlock(
        textOf(
          await client.callTool({
            name: 'create_production_pattern',
            arguments: { pattern_type: 'hero-section', framework: 'react' },
          }),
        ),
        'jsx',
      );

      const interaction = codeBlock(
        textOf(
          await client.callTool({
            name: 'understand_and_create_animation',
            arguments: {
              request: 'hover CTA',
              pattern: 'hover-interaction',
              framework: 'react',
            },
          }),
        ),
        'jsx',
      );

      const workDir = mkdtempSync(join(tmpdir(), 'gsap-hero-'));
      writeFileSync(join(workDir, 'Hero.jsx'), hero);
      writeFileSync(join(workDir, 'Interaction.jsx'), interaction);

      // Two generated components composed into one page, which is what
      // building a real hero actually requires. Each brings its own useGSAP
      // and its own gsap.matchMedia().
      writeFileSync(
        join(workDir, 'entry.jsx'),
        `import { useState } from "react";
import { createRoot } from "react-dom/client";
import { gsap } from "gsap";
import Hero from "./Hero.jsx";
import Interaction from "./Interaction.jsx";

window.__gsap = gsap;

function App() {
  const [mounted, setMounted] = useState(true);
  window.__unmount = () => setMounted(false);
  if (!mounted) return null;
  return (
    <>
      <Hero />
      <Interaction />
    </>
  );
}

createRoot(document.getElementById("root")).render(<App />);
window.__mounted = true;
`,
      );

      const built = await esbuild!.build({
        entryPoints: [join(workDir, 'entry.jsx')],
        bundle: true,
        format: 'esm',
        jsx: 'automatic',
        write: false,
        absWorkingDir: ROOT,
        nodePaths: [join(ROOT, 'node_modules')],
        define: { 'process.env.NODE_ENV': '"development"' },
        logLevel: 'silent',
      });

      const bundle = built.outputFiles[0].text;
      const document = `<!doctype html>
<html><head><meta charset="utf-8"><style>body{margin:0;font-family:sans-serif}</style></head>
<body>
  <!-- A second hero elsewhere on the page. Neither component may animate the
       other: an agency site has many sections. -->
  <div id="decoy">
    <h1 class="hero-title">Another section's headline</h1>
    <button class="hover-card" type="button">Another card</button>
  </div>
  <div id="root"></div>
  <script>
    window.__errors = [];
    addEventListener('error', (e) => window.__errors.push(String(e.message || e.error)));
    addEventListener('unhandledrejection', (e) => window.__errors.push('rejection: ' + e.reason));
  </script>
  <script type="module" src="/bundle.js"></script>
</body></html>`;

      server = createServer((request, response) => {
        const path = new URL(request.url ?? '/', 'http://x').pathname;
        if (path === '/bundle.js') {
          response.writeHead(200, { 'content-type': 'text/javascript' });
          response.end(bundle);
          return;
        }
        response.writeHead(200, { 'content-type': 'text/html' });
        response.end(document);
      });

      await new Promise<void>((resolve) =>
        server.listen(0, '127.0.0.1', resolve),
      );
      origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      pageUrl = `${origin}/hero.html`;

      browser = await playwright!.chromium.launch({
        executablePath: chromiumExecutable(),
      });
    }, 180_000);

    afterAll(async () => {
      await browser?.close();
      await client?.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    async function open(reducedMotion: 'reduce' | 'no-preference') {
      const page = await browser.newPage({
        viewport: { width: 1280, height: 800 },
        reducedMotion,
      });
      await page.goto(pageUrl, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__mounted === true, null, {
        timeout: 15_000,
      });
      return page;
    }

    it('both components mount together without errors', async () => {
      const page = await open('no-preference');
      try {
        await page.waitForTimeout(300);
        expect(await page.evaluate(() => window.__errors)).toEqual([]);
        const rendered = await page.evaluate(() => ({
          title: document.querySelectorAll('#root .hero-title').length,
          cards: document.querySelectorAll('#root .hover-card').length,
        }));
        expect(rendered.title).toBe(1);
        expect(rendered.cards).toBe(3);
      } finally {
        await page.close();
      }
    }, 60_000);

    it('the headline animates in and ends readable', async () => {
      const page = await open('no-preference');
      try {
        await page.waitForTimeout(120);
        const during = await page.evaluate(
          () =>
            getComputedStyle(document.querySelector('#root .hero-title')!)
              .opacity,
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
      } finally {
        await page.close();
      }
    }, 60_000);

    it('neither component animates the other section on the page', async () => {
      // Two independently scoped components on one page. This is the case an
      // agency hits immediately and the one selector scoping exists for.
      const page = await open('no-preference');
      try {
        await page.waitForTimeout(150);
        const decoy = await page.evaluate(() => ({
          title: getComputedStyle(document.querySelector('#decoy .hero-title')!)
            .opacity,
          card: getComputedStyle(document.querySelector('#decoy .hover-card')!)
            .transform,
          inlineStyles: [...document.querySelectorAll('#decoy *')].map(
            (node) => node.getAttribute('style') ?? '',
          ),
        }));

        expect(Number(decoy.title)).toBe(1);
        expect(decoy.card).toBe('none');
        expect(decoy.inlineStyles.every((style) => style === '')).toBe(true);

        // Guard against a vacuous pass: the component's own elements must
        // actually have been animated, or "the decoy is untouched" proves
        // nothing.
        const ownInlineStyles = await page.evaluate(
          () =>
            document
              .querySelector('#root .hero-title')!
              .getAttribute('style') ?? '',
        );
        expect(ownInlineStyles).not.toBe('');
      } finally {
        await page.close();
      }
    }, 60_000);

    it('the CTA responds to a keyboard focus, not only a pointer', async () => {
      const page = await open('no-preference');
      try {
        await page.waitForTimeout(2600);

        await page.evaluate(() => {
          document
            .querySelector('#root .hover-card')!
            .dispatchEvent(new FocusEvent('focus', { bubbles: false }));
        });
        await page.waitForTimeout(400);

        const focused = await page.evaluate(
          () =>
            getComputedStyle(document.querySelector('#root .hover-card')!)
              .transform,
        );
        expect(focused).not.toBe('none');
        expect(await page.evaluate(() => window.__errors)).toEqual([]);
      } finally {
        await page.close();
      }
    }, 60_000);

    it('reduced motion leaves the hero readable and still', async () => {
      const page = await open('reduce');
      try {
        await page.waitForTimeout(250);

        const hero = await page.evaluate(() => {
          const style = getComputedStyle(
            document.querySelector('#root .hero-title')!,
          );
          return { opacity: style.opacity, visibility: style.visibility };
        });
        // Content is immediately readable; duration was 0, not "hidden".
        expect(Number(hero.opacity)).toBe(1);
        expect(hero.visibility).toBe('visible');

        // Hovering must not scale anything when motion is reduced.
        await page.evaluate(() => {
          document
            .querySelector('#root .hover-card')!
            .dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
        });
        await page.waitForTimeout(300);

        const card = await page.evaluate(
          () =>
            getComputedStyle(document.querySelector('#root .hover-card')!)
              .transform,
        );
        expect(['none', 'matrix(1, 0, 0, 1, 0, 0)']).toContain(card);
        expect(await page.evaluate(() => window.__errors)).toEqual([]);
      } finally {
        await page.close();
      }
    }, 60_000);

    it('unmounting the hero leaves nothing behind', async () => {
      // Agency sites route client-side; a leak here runs animations on
      // detached nodes for the rest of the session.
      const page = await open('no-preference');
      try {
        await page.waitForTimeout(300);

        // Guard against a vacuous pass: there must be something to leak.
        const before = await page.evaluate(
          () =>
            (window.__gsap as { globalTimeline: { getChildren(): unknown[] } })
              .globalTimeline.getChildren().length,
        );
        expect(before).toBeGreaterThan(0);

        await page.evaluate(() => window.__unmount!());
        await page.waitForTimeout(400);

        const after = await page.evaluate(() => ({
          stillRendered: document.querySelectorAll('#root .hero-title').length,
          liveTweens: (
            window.__gsap as { globalTimeline: { getChildren(): unknown[] } }
          ).globalTimeline.getChildren().length,
        }));

        expect(after.stillRendered).toBe(0);
        expect(after.liveTweens).toBe(0);
        expect(await page.evaluate(() => window.__errors)).toEqual([]);
      } finally {
        await page.close();
      }
    }, 60_000);
  },
);

declare global {
  interface Window {
    __mounted?: boolean;
    __unmount?: () => void;
    __errors: string[];
    __gsap?: unknown;
  }
}
