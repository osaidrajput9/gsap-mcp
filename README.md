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

Runs straight from this fork — no npm publish involved. The `prepare` script
builds on install.

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
  elsewhere.
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

493 tests. The suite parses all 72 pattern × framework combinations,
round-trips the generated code back through `validate_gsap_code`, and drives
the built server over a real stdio subprocess. GreenSock's own `examples/` are
vendored as fixtures: if the validator reports an error on that code, the
validator is wrong.

This package is `private: true` and publishes nowhere.

## Credits

- **[Vinh Nguyen](https://github.com/glorynguyen)** — original
  [gsap-mcp](https://github.com/glorynguyen/gsap-mcp).
- **[GreenSock](https://gsap.com)** — GSAP itself and the official
  [agent skills][skills] this server is built on, vendored under their MIT
  license.

MIT. See [LICENSE](./LICENSE); the vendored skills carry GreenSock's own MIT
license at `src/data/skills/LICENSE`.
