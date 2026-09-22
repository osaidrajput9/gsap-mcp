# GSAP MCP Server

An MCP server that gives an AI coding agent the **official GreenSock GSAP
skills** — not a paraphrase of them.

The skills published at [greensock/gsap-skills][skills] are vendored into this
repository and served as MCP resources. Every answer, every generated snippet
and every validation rule traces back to one of them, and cites which. Where
the skills do not cover something, this server says so rather than filling the
gap with invention.

Targets **GSAP 3.15.0**, the release the vendored skills are written against.

[skills]: https://github.com/greensock/gsap-skills

## Install

Runs straight from this fork. The `prepare` script builds on install, so the
first launch takes a few seconds longer than a published package would
(~13s cold, ~2s warm).

### Claude Code, per project (works in cloud sessions)

Put a `.mcp.json` at the root of the project you want the server in, and commit
it:

```json
{
  "mcpServers": {
    "gsap": {
      "command": "npx",
      "args": ["-y", "github:osaidrajput9/gsap-mcp"]
    }
  }
}
```

This is the only route that works in a **remote or cloud Claude Code session**.
`claude mcp add` writes to a config file on the machine running the `claude`
binary, so it cannot register anything from an ephemeral container. Project
scope is read from the repository checkout instead, and is shared with anyone
who clones it. Claude Code asks to approve a project-scoped server the first
time it sees one.

### Claude Code, for yourself

```bash
claude mcp add gsap -- npx -y github:osaidrajput9/gsap-mcp
```

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or
`%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "gsap": {
      "command": "npx",
      "args": ["-y", "github:osaidrajput9/gsap-mcp"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add gsap -- npx -y github:osaidrajput9/gsap-mcp
```

### Continue.dev

`~/.continue/config.yaml`:

```yaml
mcpServers:
  - name: gsap
    command: npx
    args:
      - "-y"
      - "github:osaidrajput9/gsap-mcp"
```

### From a local clone

```bash
git clone https://github.com/osaidrajput9/gsap-mcp
cd gsap-mcp
npm install        # `prepare` builds automatically
npm start
```

Point your client at `node /absolute/path/to/gsap-mcp/dist/index.js`.

### Publishing it to npm (optional)

The package is `private: true` and publishes nowhere, which is why installs go
through git. Publishing under your own scope removes the build-on-install cost
(~0.8s warm instead of ~2s) and makes the install line a plain package name.

Two edits to `package.json`:

```diff
-  "private": true,
+  "publishConfig": { "access": "public" },
```

`access: public` is required: scoped packages default to restricted, which
needs a paid npm account. Then, from a machine logged in to npm:

```bash
npm publish
```

`prepublishOnly` runs the full test suite first, and `prepare` builds `dist/`,
so a broken build cannot be published. Installs then become
`npx -y @osaidrajput9/gsap-mcp`.

This changes nothing about CI: `.github/workflows/` stays publish-free, and a
test fails if any workflow gains a publish step or a registry credential.

## Tools

All eight are read-only (`readOnlyHint`): they read vendored files and return
text. None writes to disk, spawns a process, or makes a network request.

| Tool | What it does |
| :--- | :--- |
| `get_gsap_guidance` | Returns the official skill covering a topic, routed through the trigger terms GreenSock publishes in `llms.txt`. **Start here.** |
| `validate_gsap_code` | Fourteen deterministic checks against the skills, with line numbers, suggested fixes and the rule each finding comes from. |
| `get_gsap_api_expert` | Quotes the skill sections documenting a method, property or plugin. |
| `understand_and_create_animation` | Generates a snippet for a named pattern. Without a `pattern`, returns the matching skills and the catalog rather than guessing. |
| `create_production_pattern` | Renders a ready-made pattern for a framework. |
| `generate_complete_setup` | Install commands, plugin registration and a starter component. |
| `debug_animation_issue` | Routes a reported problem to the skills, with a checklist parsed from their own "Do Not" sections. |
| `optimize_for_performance` | Returns the official performance guidance. Reports what to change; never rewrites your code. |

### Patterns

`scroll-reveal`, `parallax`, `pinned-section`, `horizontal-scroll`,
`text-reveal`, `timeline-sequence`, `hover-interaction`, `draggable`,
`loading-sequence`, `page-transition`, `data-viz`, `smooth-scroll-lenis`.

Each renders for `react`, `nextjs`, `vue`, `nuxt`, `svelte` or `vanilla`.

Every generated snippet gets, by construction rather than by template
discipline:

- `gsap.matchMedia()` with **both** `prefers-reduced-motion` queries. A
  matchMedia handler only runs when a condition matches, so `reduce` alone
  would leave everyone *without* the preference with no animation at all.
- Scoped selectors — `scope` for `useGSAP`, the third argument to `mm.add()`
  elsewhere. The scope is a wrapper *around* the markup, never the markup root:
  a scoped selector never matches the scope element itself, so a container
  sitting on the root would silently resolve a `trigger` pointing at that root
  to `null`.
- Teardown that reverts only what the component created.
- Registered plugins, imported from the public `gsap` package.
- Transforms rather than layout properties, and `autoAlpha` rather than
  `opacity`.

`smooth-scroll-lenis` is the one pattern **not** covered by the official
skills; it is labelled as such wherever it appears. GSAP's own smooth-scroll
plugin is ScrollSmoother.

## Resources

| URI | Contents |
| :--- | :--- |
| `gsap://skills/index` | The upstream `llms.txt` discovery index, plus provenance |
| `gsap://skills/license` | GreenSock's MIT license for the vendored files |
| `gsap://skills/gsap-core` | Tweens, easing, stagger, transforms, `matchMedia` |
| `gsap://skills/gsap-timeline` | Timelines, position parameter, labels, nesting |
| `gsap://skills/gsap-scrolltrigger` | ScrollTrigger: pinning, scrub, batch, refresh |
| `gsap://skills/gsap-plugins` | Every plugin, registration, licensing |
| `gsap://skills/gsap-react` | `useGSAP`, refs, `contextSafe`, SSR |
| `gsap://skills/gsap-frameworks` | Vue, Nuxt, Svelte lifecycles |
| `gsap://skills/gsap-performance` | Transforms, `quickTo`, batching |
| `gsap://skills/gsap-utils` | `clamp`, `mapRange`, `snap`, `toArray`, `distribute` |

Each is the SKILL.md byte-for-byte, frontmatter included.

## Structure

```
src/
  index.ts              stdio entry point
  server.ts             McpServer assembly (registerTool + Zod schemas)
  data/
    skills/             vendored skills — MIT, (c) 2026 GreenSock
      SOURCE.json       upstream commit, sync date, targeted GSAP release
      LICENSE
    skills.ts           loader, frontmatter and llms.txt parsing
  lib/
    skill-search.ts     whole-word routing, section lookup, rule extraction
    source-scan.ts      lexical scanning for the validator
  resources/skills.ts   gsap://skills/* resources
  generators/
    framework.ts        per-framework shells
    patterns.ts         the pattern catalog
    setup.ts            project boilerplate
  tools/                one module per tool
scripts/
  copy-assets.mjs       copies skills into dist/ (tsc emits only JS)
  sync-skills.mjs       refreshes the vendored skills
test/                   Vitest suites and fixtures
```

Never hand-edit `src/data/skills/`. It is replaced wholesale by the sync.

## Staying current

`.github/workflows/sync-skills.yml` runs weekly, refreshes the vendored skills,
and opens a pull request only when upstream actually changed. It builds and
tests first, so a sync that breaks the server is never proposed. It publishes
nothing.

Run it by hand with:

```bash
git clone --depth 1 https://github.com/greensock/gsap-skills /tmp/gsap-skills
node scripts/sync-skills.mjs --from /tmp/gsap-skills
npm test
```

## Development

```bash
npm install
npm run build     # tsc, then copy the skill files into dist/
npm test          # builds first, then runs Vitest
npm run test:watch
```

720 tests. The suite parses all 72 pattern × framework combinations,
round-trips the generated code back through `validate_gsap_code`, and drives
the built server over a real stdio subprocess. GreenSock's own `examples/` are
vendored as fixtures: if the validator reports an error on that code, the
validator is wrong.

`test/browser.test.ts` loads every vanilla snippet into Chromium with real
GSAP 3.15.0 and asserts the animations happen: the timeline runs and settles,
`ScrollTrigger.batch` fires on scroll, the parallax layer scrubs, SplitText
splits and masks, both `prefers-reduced-motion` branches run, and every
ScrollTrigger resolves a real trigger element. It skips itself when no
Chromium is available, so the rest of the suite runs anywhere; force the skip
with `GSAP_MCP_SKIP_BROWSER_TESTS=1`.

`test/react-browser.test.ts` goes further for React: it bundles each generated
component into a real React 19 app and mounts it. The key check is a decoy —
markup carrying the same classes rendered *outside* the component. A scoped
selector must never reach it. That, plus unmount teardown and `contextSafe`
handlers, is what the static checks cannot establish.

`test/acceptance-hero.test.ts` is the end-to-end one: it drives the built
server over stdio exactly as a client does, asks for an interactive hero
section in plain language, takes the returned code verbatim, feeds it back to
`validate_gsap_code`, then composes the two generated components into one page
and mounts it. It covers what a real build actually looks like — two patterns
side by side, each with its own `useGSAP` and `gsap.matchMedia()` — and checks
keyboard reachability, reduced motion, cross-component scoping and teardown.

`test/vue-svelte-browser.test.ts` does the same for the remaining two
frameworks: it compiles each generated Vue SFC and Svelte component and mounts
them. Neither has `useGSAP` to fall back on, so the scope passed to `mm.add()`
is the only thing confining selectors there — verified by removing it, at which
point the decoy animates and the test fails.

All six frameworks are now verified by execution, not by construction.

This package is `private: true` and publishes nowhere.

## Credits

- **[Vinh Nguyen](https://github.com/glorynguyen)** — original
  [gsap-mcp](https://github.com/glorynguyen/gsap-mcp).
- **[GreenSock](https://gsap.com)** — GSAP itself and the official
  [agent skills][skills] this server is built on, vendored under their MIT
  license.

MIT. See [LICENSE](./LICENSE); the vendored skills carry GreenSock's own MIT
license at `src/data/skills/LICENSE`.
