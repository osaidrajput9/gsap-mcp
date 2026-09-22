/**
 * Animation pattern catalog.
 *
 * Each entry supplies only the GSAP body and markup; scoping, registration,
 * teardown and `prefers-reduced-motion` come from the framework shell. Every
 * pattern records the official skills it is derived from so a reader can check
 * it, and `notes` quote the rule each choice follows.
 */

import {
  type Framework,
  isReact,
  isVue,
  kebab,
  renderSnippet,
  type SnippetRequest,
} from './framework.js';

export const PATTERNS = [
  'scroll-reveal',
  'parallax',
  'pinned-section',
  'horizontal-scroll',
  'text-reveal',
  'timeline-sequence',
  'hover-interaction',
  'draggable',
  'loading-sequence',
  'page-transition',
  'data-viz',
  'smooth-scroll-lenis',
] as const;

export type PatternId = (typeof PATTERNS)[number];

export interface Pattern {
  id: PatternId;
  title: string;
  summary: string;
  /** Official skills this pattern is derived from. */
  skills: string[];
  /** Rules the generated code follows, each traceable to a skill. */
  notes: string[];
  /** True when the pattern is not covered by the official skills. */
  unofficial?: boolean;
  build(framework: Framework): SnippetRequest;
}

/** JSX uses className; every other template language uses class. */
function classAttr(framework: Framework): string {
  return isReact(framework) ? 'className' : 'class';
}

/** Closes a void-ish div for the template language in play. */
function markup(framework: Framework, body: string): string {
  return body.replace(/\bclass=/g, `${classAttr(framework)}=`);
}

const scrollReveal: Pattern = {
  id: 'scroll-reveal',
  title: 'Reveal elements as they scroll into view',
  summary:
    'Batched entrance animation for a list of cards or sections, using ScrollTrigger.batch.',
  skills: ['gsap-scrolltrigger', 'gsap-core', 'gsap-performance'],
  notes: [
    'ScrollTrigger.batch coordinates every element that entered in the same interval into one staggered tween (gsap-scrolltrigger).',
    'Batched callbacks receive (targets, scrollTriggers) — not the instance a normal callback gets (gsap-scrolltrigger).',
    'autoAlpha is used instead of opacity so hidden cards stop receiving pointer events (gsap-core).',
    'No clearProps: the reveal is re-run on scroll back, and clearing the transform would fight it (gsap-core).',
  ],
  build: (framework) => ({
    framework,
    componentName: 'ScrollReveal',
    plugins: ['ScrollTrigger'],
    body: `// ScrollTrigger.batch does not take an "animation" or "toggleActions";
// it drives the callbacks below. Do not pass "trigger" either — each
// target is its own trigger.
ScrollTrigger.batch(".reveal-item", {
  start: "top 85%",
  onEnter: (elements) => {
    gsap.from(elements, {
      autoAlpha: 0,
      y: 40,
      duration: reduceMotion ? 0 : 0.8,
      ease: "power3.out",
      stagger: reduceMotion ? 0 : 0.12,
      overwrite: true,
    });
  },
  onLeaveBack: (elements) => {
    gsap.set(elements, { autoAlpha: 0, y: 40, overwrite: true });
  },
});`,
    markup: markup(
      framework,
      `<div class="scroll-reveal">
  <article class="reveal-item">
    <h2>First card</h2>
    <p>Visible by default, so the resting state is correct if no animation runs.</p>
  </article>
  <article class="reveal-item">
    <h2>Second card</h2>
    <p>Each card that enters in the same frame is batched into one stagger.</p>
  </article>
  <article class="reveal-item">
    <h2>Third card</h2>
    <p>No CSS hides these — reduced motion degrades to plain content.</p>
  </article>
</div>`,
    ),
  }),
};

const parallax: Pattern = {
  id: 'parallax',
  title: 'Scroll-linked parallax background',
  summary: 'A background layer scrubbed against scroll position.',
  skills: ['gsap-scrolltrigger', 'gsap-performance'],
  notes: [
    'ease: "none" keeps the layer locked to scroll position; any other ease desynchronises it (gsap-scrolltrigger).',
    'scrub and toggleActions are never combined — "If both exist, scrub wins" (gsap-scrolltrigger).',
    'yPercent is a transform, so the layer never triggers layout (gsap-performance).',
    'Reduced motion pins the layer at rest rather than scrubbing it.',
  ],
  build: (framework) => ({
    framework,
    componentName: 'ParallaxSection',
    plugins: ['ScrollTrigger'],
    body: `if (reduceMotion) {
  // Nothing to scrub — leave the layer where the CSS puts it.
  return;
}

gsap.to(".parallax-layer", {
  yPercent: -30,
  ease: "none", // required: scrubbed animations must be linear
  scrollTrigger: {
    trigger: ".parallax-section",
    start: "top bottom",
    end: "bottom top",
    scrub: true,
  },
});`,
    markup: markup(
      framework,
      `<section class="parallax-section">
  <div class="parallax-layer"></div>
  <div class="parallax-content">
    <h2>Parallax</h2>
  </div>
</section>`,
    ),
  }),
};

const pinnedSection: Pattern = {
  id: 'pinned-section',
  title: 'Pinned section with a scrubbed timeline',
  summary: 'Pins a full-height section and scrubs a timeline through it.',
  skills: ['gsap-scrolltrigger', 'gsap-timeline'],
  notes: [
    'The ScrollTrigger lives on the timeline, never on a child tween — "ScrollTriggers should only exist on top-level animations" (gsap-scrolltrigger).',
    'The pinned element is the trigger; its children are what animate — "Don\'t animate the pinned element itself" (gsap-scrolltrigger).',
    'pinSpacing is left at its default so the surrounding layout does not collapse (gsap-scrolltrigger).',
  ],
  build: (framework) => ({
    framework,
    componentName: 'PinnedSection',
    plugins: ['ScrollTrigger'],
    body: `if (reduceMotion) {
  return;
}

// ScrollTrigger belongs on the timeline, not on the tweens inside it.
const tl = gsap.timeline({
  defaults: { ease: "none" },
  scrollTrigger: {
    trigger: ".pin-section",
    start: "top top",
    end: "+=1200",
    pin: true,
    scrub: 1,
  },
});

tl.to(".pin-panel-a", { xPercent: -100 })
  .to(".pin-panel-b", { xPercent: -100 }, "<0.2")
  .to(".pin-caption", { autoAlpha: 0 }, "<");`,
    markup: markup(
      framework,
      `<section class="pin-section">
  <div class="pin-panel-a"></div>
  <div class="pin-panel-b"></div>
  <p class="pin-caption">Scroll</p>
</section>`,
    ),
  }),
};

const horizontalScroll: Pattern = {
  id: 'horizontal-scroll',
  title: 'Horizontal scroll driven by vertical scrolling',
  summary:
    'Pins a wrapper and moves inner content sideways, with containerAnimation for nested triggers.',
  skills: ['gsap-scrolltrigger'],
  notes: [
    'The horizontal tween must use ease: "none" — gsap-scrolltrigger calls this out as "a very common mistake".',
    'The pin is applied to the parent wrapper so the animated element is not itself pinned (gsap-scrolltrigger).',
    'Nested triggers pass containerAnimation and use horizontal start syntax ("left center").',
    'Pinning and snapping are unavailable on containerAnimation triggers (gsap-scrolltrigger).',
  ],
  build: (framework) => ({
    framework,
    componentName: 'HorizontalScroll',
    plugins: ['ScrollTrigger'],
    needsSelector: true,
    body: `if (reduceMotion) {
  return;
}

const [track] = q(".h-track");

const scrollTween = gsap.to(track, {
  x: () => -(track.scrollWidth - track.offsetWidth),
  ease: "none", // required for containerAnimation to map 1:1 to scroll
  scrollTrigger: {
    trigger: track,
    pin: track.parentNode, // pin the wrapper, not the element being moved
    start: "top top",
    end: () => "+=" + (track.scrollWidth - track.offsetWidth),
    scrub: true,
    invalidateOnRefresh: true,
  },
});

// Triggers for elements inside the horizontal track must reference the
// container animation and use horizontal start/end syntax.
gsap.from(".h-panel h2", {
  autoAlpha: 0,
  y: 30,
  duration: 0.6,
  stagger: 0.1,
  scrollTrigger: {
    containerAnimation: scrollTween,
    trigger: ".h-panel",
    start: "left center",
    toggleActions: "play none none reverse",
  },
});`,
    markup: markup(
      framework,
      `<section class="h-wrapper">
  <div class="h-track">
    <div class="h-panel"><h2>One</h2></div>
    <div class="h-panel"><h2>Two</h2></div>
    <div class="h-panel"><h2>Three</h2></div>
  </div>
</section>`,
    ),
  }),
};

const textReveal: Pattern = {
  id: 'text-reveal',
  title: 'Masked line-by-line text reveal (SplitText)',
  summary:
    'Splits a heading into lines and reveals them from behind a mask, re-splitting when fonts load or the box resizes.',
  skills: ['gsap-plugins', 'gsap-core'],
  notes: [
    'SplitText.create() is the documented API; `new SplitText()` is the old form (gsap-plugins).',
    'autoSplit re-splits when fonts finish loading or the width changes, which is why the animation must be created inside onSplit() (gsap-plugins).',
    'Returning the tween from onSplit() lets SplitText revert and time-sync it on re-split (gsap-plugins).',
    'mask: "lines" wraps each line in an overflow-clipped element for the reveal (gsap-plugins).',
    'Only lines are split — "Only split what is needed ... for performance" (gsap-plugins).',
    'aria defaults to "auto", which labels the element and hides the split fragments from screen readers (gsap-plugins).',
  ],
  build: (framework) => ({
    framework,
    componentName: 'TextReveal',
    plugins: ['SplitText'],
    body: `const split = SplitText.create(".reveal-text", {
  type: "lines",
  mask: "lines",     // wraps each line so it can slide out from behind a clip
  autoSplit: true,   // re-split on font load and width change
  onSplit(self) {
    // Built inside onSplit so it always targets the current line elements,
    // and returned so SplitText can revert and re-sync it on a re-split.
    return gsap.from(self.lines, {
      yPercent: 100,
      autoAlpha: 0,
      duration: reduceMotion ? 0 : 0.7,
      stagger: reduceMotion ? 0 : 0.1,
      ease: "power3.out",
    });
  },
});

// Reverting restores the original markup; the shell's teardown covers the
// tween, this covers the DOM SplitText created.
return () => split.revert();`,
    markup: markup(
      framework,
      `<div class="text-reveal">
  <h1 class="reveal-text">
    Text that is readable before, during and after the animation.
  </h1>
</div>`,
    ),
  }),
};

const timelineSequence: Pattern = {
  id: 'timeline-sequence',
  title: 'Hero entrance timeline',
  summary:
    'A sequenced entrance using a timeline with defaults, labels and the position parameter.',
  skills: ['gsap-timeline', 'gsap-core'],
  notes: [
    'A timeline replaces chained delays — "Prefer timelines instead of chaining animations using delay" (gsap-core).',
    'Shared duration and ease go in `defaults` so child tweens inherit them (gsap-timeline).',
    'The position parameter ("<", "-=0.3") overlaps steps instead of hand-computing delays (gsap-timeline).',
    'A label marks the point later code can seek or chain to (gsap-timeline).',
  ],
  build: (framework) => ({
    framework,
    componentName: 'HeroSequence',
    plugins: [],
    body: `const tl = gsap.timeline({
  defaults: {
    duration: reduceMotion ? 0 : 0.8,
    ease: "power3.out",
  },
});

tl.from(".hero-title", { autoAlpha: 0, y: 40 })
  .from(".hero-subtitle", { autoAlpha: 0, y: 24 }, "-=0.45")
  .addLabel("cta")
  .from(".hero-cta", { autoAlpha: 0, scale: 0.92 }, "cta")
  .from(".hero-meta", { autoAlpha: 0 }, "<0.1");`,
    markup: markup(
      framework,
      `<section class="hero-sequence">
  <h1 class="hero-title">Headline</h1>
  <p class="hero-subtitle">Supporting line of copy.</p>
  <button class="hero-cta" type="button">Get started</button>
  <p class="hero-meta">No card required</p>
</section>`,
    ),
  }),
};

const hoverInteraction: Pattern = {
  id: 'hover-interaction',
  title: 'Hover and focus micro-interaction',
  summary:
    'A pointer interaction whose tweens are tracked by the GSAP context and torn down with it.',
  skills: ['gsap-react', 'gsap-core', 'gsap-performance'],
  notes: [
    'React wraps the handler in contextSafe — GSAP created in a handler that runs after the hook "is not added to the context so it won\'t get cleaned up" (gsap-react).',
    'Listeners are removed in the cleanup the handler returns, so nothing survives unmount (gsap-react).',
    'The same tween is reused for enter and leave via overwrite, rather than stacking tweens.',
    'focus/blur mirror the pointer events so keyboard users get the same affordance.',
  ],
  build: (framework) => {
    const react = isReact(framework);
    const wrap = (fn: string) => (react ? `contextSafe(${fn})` : fn);

    return {
      framework,
      componentName: 'HoverCard',
      plugins: [],
      usesContextSafe: react,
      body: `const cards = gsap.utils.toArray(".hover-card");

const activate = ${wrap(`(event) => {
  gsap.to(event.currentTarget, {
    scale: reduceMotion ? 1 : 1.04,
    y: reduceMotion ? 0 : -6,
    duration: reduceMotion ? 0 : 0.3,
    ease: "power2.out",
    overwrite: "auto",
  });
}`)};

const reset = ${wrap(`(event) => {
  gsap.to(event.currentTarget, {
    scale: 1,
    y: 0,
    duration: reduceMotion ? 0 : 0.3,
    ease: "power2.out",
    overwrite: "auto",
  });
}`)};

for (const card of cards) {
  card.addEventListener("pointerenter", activate);
  card.addEventListener("pointerleave", reset);
  card.addEventListener("focus", activate);
  card.addEventListener("blur", reset);
}

return () => {
  for (const card of cards) {
    card.removeEventListener("pointerenter", activate);
    card.removeEventListener("pointerleave", reset);
    card.removeEventListener("focus", activate);
    card.removeEventListener("blur", reset);
  }
};`,
      markup: markup(
        framework,
        `<div class="hover-grid">
  <button class="hover-card" type="button">One</button>
  <button class="hover-card" type="button">Two</button>
  <button class="hover-card" type="button">Three</button>
</div>`,
      ),
    };
  },
};

const draggable: Pattern = {
  id: 'draggable',
  title: 'Draggable with inertia',
  summary: 'Drag with momentum after release, bounded to a container.',
  skills: ['gsap-plugins'],
  notes: [
    'Momentum is `inertia: true` with InertiaPlugin registered. `throwProps` was the GSAP 2 name and is not a valid GSAP 3 property (gsap-plugins).',
    'Draggable and InertiaPlugin are both registered before use (gsap-plugins).',
    'Every plugin ships in the public `gsap` package — no auth token or private registry (gsap-plugins).',
    'Draggable instances are killed in the cleanup so nothing keeps listening after teardown.',
  ],
  build: (framework) => ({
    framework,
    componentName: 'DraggableBox',
    plugins: ['Draggable', 'InertiaPlugin'],
    body: `const instances = Draggable.create(".drag-item", {
  type: "x,y",
  bounds: ".drag-bounds",
  inertia: !reduceMotion, // InertiaPlugin; the GSAP 2 name was throwProps
  edgeResistance: 0.65,
});

return () => instances.forEach((instance) => instance.kill());`,
    markup: markup(
      framework,
      `<div class="drag-bounds">
  <div class="drag-item">Drag me</div>
</div>`,
    ),
  }),
};

const loadingSequence: Pattern = {
  id: 'loading-sequence',
  title: 'Loading overlay hand-off',
  summary:
    'A paused timeline that plays out once assets are ready, then refreshes ScrollTrigger.',
  skills: ['gsap-timeline', 'gsap-scrolltrigger'],
  notes: [
    'The timeline is built paused and played when loading finishes — playback state is controlled through the stored instance (gsap-core).',
    'ScrollTrigger.refresh() runs after the overlay leaves the layout: "Forget to call ScrollTrigger.refresh() after DOM/layout changes ... viewport resize is auto-handled, but dynamic content is not" (gsap-scrolltrigger).',
    'onComplete removes the overlay from the accessibility tree as well as from view.',
  ],
  build: (framework) => ({
    framework,
    componentName: 'LoadingSequence',
    plugins: ['ScrollTrigger'],
    body: `const tl = gsap.timeline({
  paused: true,
  defaults: { duration: reduceMotion ? 0 : 0.6, ease: "power2.inOut" },
  onComplete: () => {
    // The overlay no longer occupies space, so trigger positions moved.
    ScrollTrigger.refresh();
  },
});

tl.to(".loader-bar", { scaleX: 1, transformOrigin: "left center" })
  .to(".loader", { autoAlpha: 0 })
  .set(".loader", { display: "none" });

// Play once the work that was being waited on is done.
Promise.all([document.fonts.ready]).then(() => tl.play());

return () => tl.kill();`,
    markup: markup(
      framework,
      `<div class="loader" role="status" aria-live="polite">
  <div class="loader-bar"></div>
  <span>Loading</span>
</div>`,
    ),
  }),
};

const pageTransition: Pattern = {
  id: 'page-transition',
  title: 'Route transition',
  summary:
    'Plays an exit timeline, swaps the route, then plays an entrance and refreshes ScrollTrigger.',
  skills: ['gsap-timeline', 'gsap-scrolltrigger', 'gsap-react'],
  notes: [
    'The route swap happens between two timelines rather than racing them.',
    'ScrollTrigger.refresh() runs after the new route renders, because the page height changed (gsap-scrolltrigger).',
    'Triggers belonging to the old route are killed by the context teardown; nothing calls ScrollTrigger.getAll() and kills globally, which would also destroy other components\' triggers.',
    'route-transition.js is three lines and is valid in every framework, including Vue\'s <script setup> where module-level `export` is not: `let exit = null; export const setRouteExit = (fn) => { exit = fn; }; export const playRouteExit = () => (exit ? exit() : Promise.resolve());`',
  ],
  build: (framework) => ({
    framework,
    componentName: 'PageTransition',
    plugins: ['ScrollTrigger'],
    extraImports: ['import { setRouteExit } from "./route-transition.js";'],
    body: `const enter = gsap.timeline({
  defaults: { duration: reduceMotion ? 0 : 0.5, ease: "power2.out" },
  onComplete: () => ScrollTrigger.refresh(),
});

enter.from(".route-content", { autoAlpha: 0, y: 16 });

// Registered so the router can await the exit before swapping routes.
setRouteExit(() =>
  gsap
    .timeline({
      defaults: { duration: reduceMotion ? 0 : 0.35, ease: "power2.in" },
    })
    .to(".route-content", { autoAlpha: 0, y: -16 })
    .then(),
);

return () => {
  enter.kill();
  setRouteExit(null);
};`,
    markup: markup(
      framework,
      `<main class="route-content">
  <h1>Route content</h1>
</main>`,
    ),
  }),
};

const dataViz: Pattern = {
  id: 'data-viz',
  title: 'Chart bars growing on scroll',
  summary: 'Staggered bar growth driven by a scroll trigger.',
  skills: ['gsap-performance', 'gsap-scrolltrigger', 'gsap-utils'],
  notes: [
    'Bars grow with scaleY and transformOrigin, not height — "Avoid when possible: width, height, top, left" (gsap-performance).',
    'A single staggered tween replaces one tween per bar — "Use stagger instead of many separate tweens" (gsap-performance).',
    'toggleActions replays the reveal on scroll back; scrub is not also set (gsap-scrolltrigger).',
    'gsap.utils.toArray turns the selector into a real array before reading data attributes (gsap-utils).',
  ],
  build: (framework) => ({
    framework,
    componentName: 'ChartBars',
    plugins: ['ScrollTrigger'],
    body: `const bars = gsap.utils.toArray(".chart-bar");

gsap.from(bars, {
  scaleY: 0,
  transformOrigin: "center bottom", // scale, not height: no layout cost
  duration: reduceMotion ? 0 : 0.8,
  ease: "power2.out",
  stagger: reduceMotion ? 0 : 0.08,
  scrollTrigger: {
    trigger: ".chart",
    start: "top 80%",
    toggleActions: "play none none reverse",
  },
});`,
    markup: markup(
      framework,
      `<figure class="chart">
  <div class="chart-bar" style="height: 40%"></div>
  <div class="chart-bar" style="height: 70%"></div>
  <div class="chart-bar" style="height: 55%"></div>
  <figcaption>Quarterly total</figcaption>
</figure>`,
    ),
  }),
};

/**
 * Lenis is not covered by the official skills. It is kept because this fork
 * added it in v1.1.0, and rewritten to satisfy the one hard requirement the
 * skills do state for third-party scrollers: ScrollTrigger must be told when
 * the scroller moves.
 */
const smoothScrollLenis: Pattern = {
  id: 'smooth-scroll-lenis',
  title: 'Lenis smooth scrolling wired to ScrollTrigger',
  summary:
    'Third-party smooth scroll driven by the GSAP ticker and kept in sync with ScrollTrigger.',
  skills: ['gsap-scrolltrigger', 'gsap-plugins'],
  unofficial: true,
  notes: [
    'NOT an official GSAP skill. GSAP\'s own smooth-scroll plugin is ScrollSmoother, which needs none of this (gsap-plugins).',
    'ScrollTrigger.update is registered as a scroll listener — "Without this, ScrollTrigger\'s calculations will be out of date" (gsap-scrolltrigger).',
    'Lenis drives off the GSAP ticker so both run on one rAF loop rather than two.',
    'lagSmoothing(0) stops GSAP compensating for frame drops, which would desynchronise the two.',
    'Lenis moves native scroll, so ScrollTrigger.scrollerProxy() is not needed. A scroller that transforms content instead does need scrollerProxy (gsap-scrolltrigger).',
    'Teardown removes the ticker callback and destroys the instance; leaving either attached leaks a rAF loop.',
  ],
  build: (framework) => ({
    framework,
    componentName: 'SmoothScroll',
    plugins: ['ScrollTrigger'],
    extraImports: ['// npm install lenis', 'import Lenis from "lenis";'],
    body: `if (reduceMotion) {
  // Smooth scrolling is itself motion; leave native scrolling alone.
  return;
}

const lenis = new Lenis();

// Required: tell ScrollTrigger every time the scroller moves.
lenis.on("scroll", ScrollTrigger.update);

const raf = (time) => lenis.raf(time * 1000);
gsap.ticker.add(raf);
gsap.ticker.lagSmoothing(0);

return () => {
  gsap.ticker.remove(raf);
  lenis.destroy();
  gsap.ticker.lagSmoothing(500, 33); // restore the GSAP default
};`,
    markup: markup(
      framework,
      `<div class="smooth-scroll">
  <p>Page content scrolls through Lenis.</p>
</div>`,
    ),
  }),
};

const CATALOG: Record<PatternId, Pattern> = {
  'scroll-reveal': scrollReveal,
  parallax,
  'pinned-section': pinnedSection,
  'horizontal-scroll': horizontalScroll,
  'text-reveal': textReveal,
  'timeline-sequence': timelineSequence,
  'hover-interaction': hoverInteraction,
  draggable,
  'loading-sequence': loadingSequence,
  'page-transition': pageTransition,
  'data-viz': dataViz,
  'smooth-scroll-lenis': smoothScrollLenis,
};

export function getPattern(id: string): Pattern | undefined {
  return CATALOG[id as PatternId];
}

export function allPatterns(): Pattern[] {
  return PATTERNS.map((id) => CATALOG[id]);
}

/** Renders one pattern for one framework, shell included. */
export function renderPattern(
  pattern: Pattern,
  framework: Framework,
): string {
  return renderSnippet(pattern.build(framework));
}

export { kebab };
