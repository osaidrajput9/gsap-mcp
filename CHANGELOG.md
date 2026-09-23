### Features

* **patterns:** `scroll-text-fill` — a paragraph split into words that start
  dim and fill in one after another, scrubbed to scroll position, so it empties
  again on the way back up. Requested after a build needed the effect and found
  the catalog's only text pattern, `text-reveal`, plays once on enter and
  cannot express it. Built from gsap-plugins and gsap-scrolltrigger: SplitText
  with `autoSplit`, the tween created and returned inside `onSplit()` so a
  re-split rebuilds it and its ScrollTrigger together, `scrub` with
  `ease: "none"`, and the stagger spread across the scroll distance. The dim
  state is set by `fromTo()` rather than CSS, so reduced motion and a failed
  script both leave the text whole and full-strength.

### Tests

* **browser:** the fill is asserted by behaviour, not by construction. Scroll
  is driven to the ScrollTrigger's own computed start, midpoint and end:
  every word dim before, the fill part-way and in reading order at the
  midpoint, every word full after, and dim again on the way back. Verified
  against the gap it closes — swapping `scrub` for a play-once
  `toggleActions`, the same shape as `text-reveal`, fails it.
* **browser:** under reduced motion the text is never split, never dimmed, and
  no ScrollTrigger is created.
* 753 -> 800 tests. The pattern joins all six frameworks automatically, so
  it is parsed, round-tripped through the validator, and mounted like the
  rest.

### Bug Fixes (reported from real use)

* **skills:** the ScrollTrigger skill states `refreshPriority` is "Lower =
  refreshed first". It is the opposite — `ScrollTrigger.sort` multiplies the
  value by `-1e6`, so a higher number refreshes first — and its practical
  advice ("first on page = lower number") is backwards with it. Reported by a
  user after it caused two bugs they later traced back to this server.
  Confirmed in Chromium with GSAP 3.15.0: three ScrollTriggers with priorities
  0, -10 and 10 fired `onRefresh` in the order 10, 0, -10.
* **validate:** `usegsap-without-scope` fired at warning level on components
  that animate only element refs. `scope` confines selector strings to a root,
  so with no selectors there is nothing to confine — the finding was
  contradicting the rule it cited, and firing on every ref-only component.
  It now reports only when selector strings are present.

### Features

* **errata:** corrections to the official skills now live in
  `src/data/errata.ts` rather than in the vendored files, which are replaced
  wholesale by the weekly sync and are worth serving precisely because they
  are provably upstream. Every tool that quotes a skill appends the entries
  that apply to what it returned, affected resources say so in their
  description, and `gsap://skills/errata` lists them all. SKILL.md resources
  stay byte-for-byte, errors included.
* **errata:** a documented gap for function-based `stagger`. The skills cover
  the number and object forms only; `(index, target, targets) => seconds` also
  works, verified by running it.

### Tests

* **errata:** `test/errata.test.ts` ties each entry to the text it describes —
  a correction's quotes must still appear upstream, a gap's pattern must still
  match nothing. When upstream fixes something the test fails and names the
  entry to delete, so a correction cannot rot into a second source of wrong
  answers. Verified by rewriting a quote: the guard fails with that message.
* 740 -> 753 tests.

### Published

* **npm:** released as `@osaidrajput9/gsap-mcp@2.0.0`. `private: true` is
  removed and `publishConfig.access` is set to `public`, since scoped packages
  default to restricted. Install lines throughout the README now name the
  package rather than `github:osaidrajput9/gsap-mcp`; the git route still
  works and is documented as the way to track `main`.
* **startup:** 5.6s cold and 0.92s warm from the registry, against 12.9s and
  2.1s from git, where `prepare` compiles TypeScript on the client's machine.
* **release process:** stays manual. `.github/workflows/` holds no publish
  step and no registry credential, and `test/workflows.test.ts` fails if
  either appears. `prepublishOnly` runs the full suite before any upload.
* **verified against the published tarball:** the package was published from a
  Windows checkout, so `dist/data/skills/**` ships with CRLF line endings.
  Driving the installed server over stdio confirms the loader normalisation
  holds — `get_gsap_api_expert`, `debug_animation_issue` and
  `optimize_for_performance` all return real skill content, and
  `gsap://skills/gsap-core` reads back with no carriage returns. Without the
  CRLF fix this release would have been broken on every platform, because the
  carriage returns are baked into the tarball rather than produced at checkout.

### Bug Fixes (Windows)

* **skills:** every parser broke on a Windows checkout. Git converts these
  files to CRLF by default, and JavaScript's `.` does not match `\r` — it is a
  line terminator — so `/^(#{2,4})\s+(.*)$/` never matched `"## Stagger\r"`.
  `sections()` returned an empty array, and with it `doNotRules()`,
  `bestPracticeRules()` and `findSections()`. The visible effect was
  `get_gsap_api_expert`, `debug_animation_issue` and `optimize_for_performance`
  reporting "nothing matches" for every input, on every Windows install.
  Reported by a user running `npm test` on Windows: 10 failures, one cause.
  - The loader now normalises `\r\n?` to `\n` when reading vendored files,
    which fixes it at the only place they are read.
  - `.gitattributes` pins `src/data/skills/**` and `test/fixtures/**` to LF so
    the conversion does not happen in the first place.
  - `validate_gsap_code` normalises CRLF in caller-supplied code too. Stripping
    `\r` does not change the newline count, so reported line numbers are
    unaffected.

### Tests (Windows)

* **line-endings:** new `test/line-endings.test.ts` asserts no loaded skill
  carries a carriage return, that sections and rules are still extracted, that
  `parseFrontmatter`/`parseLlmsIndex`/`sections` accept CRLF directly, and that
  the validator returns identical findings and line numbers for CRLF and LF
  input. Verified against the bug: with the fix reverted and the skills
  converted to CRLF, 12 tests fail.
* 720 → 727 tests.

### Tests (Vue and Svelte verification)

* **vue/svelte:** new `test/vue-svelte-browser.test.ts` compiles each generated
  Vue single-file component with `@vue/compiler-sfc` and each Svelte component
  with the Svelte 5 compiler, then mounts them in Chromium. Asserts selector
  scoping against a decoy outside the component, ScrollTrigger creation and
  resolution, teardown on unmount, reduced motion, and that all eleven runnable
  patterns mount without errors.
* Confirms `mm.add()`'s scope argument is load-bearing for Vue and Svelte,
  which have no `useGSAP`: removing it makes the decoy animate to ~0.66 opacity
  and the test fails. In React the same argument is redundant because
  `useGSAP({ scope })` already covers it.
* No bugs found in the Vue or Svelte output.
* 708 → 720 tests. All six frameworks are now verified by execution.

### Tests (acceptance)

* **acceptance:** new `test/acceptance-hero.test.ts` exercises the whole
  product for one real scenario — an agency asking for an interactive hero
  section. It talks to the built server over stdio through the MCP protocol,
  takes the generated code verbatim, validates it with the server's own
  checker, then composes the two components a real hero needs into one React
  page and mounts it in Chromium.
* Covers what no other suite did: two generated components on one page, each
  with its own `useGSAP` and `gsap.matchMedia()`, neither allowed to animate
  the other's elements.
* Also asserts the agency-facing bar — the CTA is a real `<button>`, the
  interaction answers keyboard focus and not only the pointer, reduced motion
  leaves the hero readable and still, and unmounting leaves no live tweens.
* 696 → 708 tests.

### Bug Fixes (React verification)

* **generators:** inline `style="..."` attributes in a pattern's markup are now
  converted to JSX's object form for React and Next.js. React rejects a style
  string outright ("The `style` prop expects a mapping from style properties to
  values, not a string"), so the `data-viz` component threw on render. Found by
  mounting the generated components in a real React app.

### Tests (React verification)

* **react:** new `test/react-browser.test.ts` bundles each generated component
  into a real React 19 app with `@gsap/react` and mounts it in Chromium.
  Asserts selector scoping against a decoy rendered outside the component,
  ScrollTrigger scoping and resolution, full teardown on unmount, contextSafe
  pointer handlers, and both prefers-reduced-motion branches.
* **generators:** static assertion that JSX output never contains `class="`,
  `style="` or `for="`, and that non-JSX output never contains `className=`.
* 616 → 696 tests.

Two inferences the official skills do not state were settled by measurement
rather than assumption:

* `useGSAP({ scope })` **does** confine selector text inside a
  `gsap.matchMedia()` handler. Verified by removing all scoping, at which point
  the decoy animates and the test fails.
* `mm.add()`'s third scope argument is therefore **redundant in React**,
  though it is documented by gsap-core and remains load-bearing for Vue,
  Svelte and vanilla, which have no `useGSAP`. It is kept for consistency.

### Bug Fixes (post-2.0.0 merge)

* **generators:** the scoped container is now a wrapper *around* a pattern's
  markup instead of being placed on the markup root. Two bugs came from that,
  both found by running the generated code in a real browser:
  - `horizontal-scroll` crashed in the vanilla output. The shell queried
    `.horizontal-scroll` while the markup root was `.h-wrapper`, so the
    container was `null` and `track.scrollWidth` threw. Seven of twelve
    patterns had this mismatch; the other six silently lost scoping instead of
    failing.
  - A scoped selector never matches the scope element itself, so any pattern
    whose ScrollTrigger `trigger` pointed at the container root resolved to
    `null` and ScrollTrigger quietly fell back to the tween's own target.
    `parallax` and `pinned-section` were both affected, in every framework.

### Tests (post-2.0.0 merge)

* **browser:** new `test/browser.test.ts` runs every vanilla snippet against
  real GSAP 3.15.0 in Chromium — animations run and settle, ScrollTrigger.batch
  fires on scroll, parallax scrubs, SplitText splits and masks, both
  prefers-reduced-motion branches execute, and every ScrollTrigger resolves a
  real trigger. Skips itself with no browser available.
* **generators:** static assertions that the container wraps the markup, so the
  invariant is guarded even where no browser can run.
* **ci:** installs Chromium so the browser suite actually runs.
* 532 → 616 tests.

# 2.0.0 (unreleased)

Rebuilt on the official [GreenSock GSAP skills](https://github.com/greensock/gsap-skills),
vendored at commit `aed9cfd` under their MIT license. Targets GSAP 3.15.0.

### BREAKING CHANGES

* **npm:** the package is now `private: true` and publishes nowhere. The
  semantic-release workflow that published `@vinhnguyen/gsap-mcp` on every push
  to `main` has been removed, along with its `NPM_TOKEN` / `NODE_AUTH_TOKEN`
  usage. Install from the repository instead:
  `npx -y github:osaidrajput9/gsap-mcp`.
* **animation:** `understand_and_create_animation` no longer guesses which
  template to emit. Pass `pattern`; without it the tool returns the matching
  official skills and the pattern catalog. The old keyword analyzer selected
  templates with substring matching, so "center" matched "enter" and picked the
  entrance template.
* **api:** the hand-written `GSAP_COMPLETE_API` object is gone.
  `get_gsap_api_expert` now quotes the official skills and says plainly when
  they do not cover a term. It documented `ScrollTrigger.matchMedia`,
  `throwProps` and `new SplitText()` as current; none of them are.
* **optimize:** `optimize_for_performance` no longer rewrites the supplied
  code. It used a regex to append `force3D: true` after every `duration`, which
  corrupted any file containing that word in a string or comment.

### Features

* **skills:** the eight official skills are served as MCP resources at
  `gsap://skills/<name>`, plus `gsap://skills/index` and
  `gsap://skills/license`.
* **guidance:** new `get_gsap_guidance(topic)` routes through the trigger terms
  in `llms.txt` using whole-word matching, and reports low confidence instead of
  guessing when nothing matches.
* **validate:** new `validate_gsap_code` with fourteen deterministic checks
  derived from the skills, returning line numbers, suggested fixes, the rule
  each finding comes from, and structured output.
* **server:** migrated to `McpServer` + `registerTool()` with Zod input
  schemas. Every tool carries `readOnlyHint`.
* **frameworks:** patterns render for react, nextjs, vue, nuxt, svelte and
  vanilla; previously only React and vanilla.
* **ci:** a weekly workflow syncs the official skills and opens a pull request
  when they change. It publishes nothing.

### Bug Fixes

* **templates:** `ScrollTrigger.matchMedia` replaced with `gsap.matchMedia()`,
  and manual resize listeners removed in favour of it.
* **templates:** `throwProps` replaced with `inertia: true` and InertiaPlugin.
* **templates:** removed the `useLayoutEffect` that ran
  `ScrollTrigger.getAll().forEach(kill)` on unmount, destroying triggers owned
  by other components.
* **templates:** removed `clearProps` wherever it conflicted with a
  `toggleActions` reverse, which needs the inline styles it cleared.
* **templates:** patterns no longer inject animations that were not requested.
  Parallax and pin blocks were appended whenever those words appeared anywhere
  in the request string.
* **templates:** `SplitText.create()` with `autoSplit`, `onSplit` and `mask`,
  replacing `new SplitText()`.
* **templates:** every generated snippet respects `prefers-reduced-motion`,
  with both media queries listed so visitors without the preference still get
  animation.
* **templates:** dropped blanket `force3D`, `gsap.defaults({ lazy: false })`,
  arbitrary `refreshPriority`, and the page-wide "emergency reset" advice.
* **docs:** removed the unverifiable IE11 support claims.
* **license:** added the missing LICENSE file, crediting Vinh Nguyen as the
  original author and GreenSock for the vendored skills.

### Tests

* 493 Vitest tests covering every tool, resource and generator. All 72
  pattern × framework combinations are parsed and run back through the
  validator; GreenSock's own `examples/` are used as fixtures.

## [1.1.2](https://github.com/glorynguyen/gsap-mcp/compare/v1.1.1...v1.1.2) (2026-02-08)


### Bug Fixes

* **readme:** add Lenis and Continue.dev documentation ([eaa97b0](https://github.com/glorynguyen/gsap-mcp/commit/eaa97b0a97bf52ebd422cd93056da50f528279ab))

## [1.1.1](https://github.com/glorynguyen/gsap-mcp/compare/v1.1.0...v1.1.1) (2026-02-08)


### Bug Fixes

* **npm:** add repository URL to package.json ([2d3c1f9](https://github.com/glorynguyen/gsap-mcp/commit/2d3c1f933eb5ebc4f72b2cfae2d001c19e657146))

# [1.1.0](https://github.com/glorynguyen/gsap-mcp/compare/v1.0.0...v1.1.0) (2026-02-08)


### Features

* **setup:** add Lenis smooth scrolling support ([6a2f602](https://github.com/glorynguyen/gsap-mcp/commit/6a2f6028304a07b212295dff56f2b9c159b57297))

# 1.0.0 (2026-02-08)


### Features

* add initial GSAP MCP server implementation ([9aa1f4f](https://github.com/glorynguyen/gsap-mcp/commit/9aa1f4f15bfd6c94bb34790a52d48a598f895699))
