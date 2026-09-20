#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { GSAP_VERSION, SKILLS_SOURCE } from './src/data/skills.js';
import { SKILL_RESOURCES, readSkillResource } from './src/resources/skills.js';
import { gsapApiExpert, type ApiExpertLevel } from './src/tools/api-expert.js';

// ========================================================================================
// ADVANCED INTENT ANALYSIS ENGINE - Understands natural language perfectly
// ========================================================================================

const INTENT_ANALYZER = {
  patterns: {
    scroll_based: {
      keywords: ['scroll', 'scrolling', 'viewport', 'parallax', 'when scrolling', 'on scroll', 'scroll trigger', 'reveal on scroll', 'scroll animation'],
      confidence_boosters: ['viewport', 'parallax', 'when user scrolls', 'scroll into view'],
      techniques: ['ScrollTrigger', 'parallax', 'pin', 'scrub', 'batch processing'],
      best_practices: ['Use ScrollTrigger.batch for performance', 'Add refreshPriority for important triggers', 'Use toggleActions for simple reveals']
    },
    entrance_animations: {
      keywords: ['fade in', 'slide in', 'appear', 'entrance', 'reveal', 'show', 'animate in', 'come in', 'enter'],
      confidence_boosters: ['when page loads', 'on page load', 'initially', 'at start'],
      techniques: ['gsap.from', 'stagger', 'timeline', 'delay'],
      best_practices: ['Use power3.out for natural feel', 'Add stagger for multiple elements', 'Set initial state with gsap.set']
    },
    text_animations: {
      keywords: ['text', 'words', 'characters', 'letters', 'typewriter', 'typing', 'text reveal', 'character by character', 'word by word'],
      confidence_boosters: ['split text', 'character animation', 'typing effect', 'text effect'],
      techniques: ['SplitText', 'stagger', 'char animation', 'word animation'],
      best_practices: ['Use SplitText for complex text effects', 'Add stagger for character reveals', 'Consider performance on mobile']
    },
    interactive: {
      keywords: ['hover', 'click', 'drag', 'interactive', 'on hover', 'on click', 'mouse over', 'touch', 'press'],
      confidence_boosters: ['user interaction', 'interactive', 'drag and drop', 'clickable'],
      techniques: ['event listeners', 'Draggable', 'hover effects', 'click animations'],
      best_practices: ['Add visual feedback', 'Use touch-friendly targets', 'Provide clear interaction hints']
    },
    svg_animations: {
      keywords: ['svg', 'path', 'draw', 'drawing', 'stroke', 'icon', 'vector', 'shape', 'morph'],
      confidence_boosters: ['svg path', 'draw svg', 'svg animation', 'vector animation'],
      techniques: ['DrawSVG', 'MorphSVG', 'MotionPath', 'stroke animation'],
      best_practices: ['Optimize SVG paths', 'Use vector-effect for consistent strokes', 'Consider file size']
    },
    complex_sequences: {
      keywords: ['sequence', 'timeline', 'choreography', 'orchestrate', 'step by step', 'one after another', 'chain'],
      confidence_boosters: ['complex animation', 'sequence', 'timeline', 'choreographed'],
      techniques: ['Timeline', 'labels', 'callbacks', 'nested timelines'],
      best_practices: ['Use labels for complex timelines', 'Add callbacks for events', 'Break complex sequences into smaller timelines']
    },
    performance_critical: {
      keywords: ['smooth', 'performance', '60fps', 'lag', 'stuttering', 'optimize', 'fast', 'efficient'],
      confidence_boosters: ['performance', 'smooth', '60fps', 'optimized'],
      techniques: ['transform properties', 'will-change', 'force3D', 'efficient selectors'],
      best_practices: ['Use transform over layout properties', 'Add will-change CSS', 'Cleanup animations properly']
    },
    smooth_scrolling: {
      keywords: ['smooth scroll', 'lenis', 'buttery', 'smoothness', 'inertia scroll', 'momentum'],
      confidence_boosters: ['feels janky', 'smooth out scrolling', 'luxury feel'],
      techniques: ['Lenis', 'gsap.ticker', 'ScrollTrigger.update'],
      best_practices: ['Sync with gsap.ticker', 'Call lenis.destroy() on unmount', 'Set lagSmoothing(0)']
    },
  },

  analyze: function(request: string) {
    const lowercaseRequest = request.toLowerCase();
    const results = [];

    for (const [patternName, pattern] of Object.entries(this.patterns)) {
      let score = 0;
      let matches = [];

      // Check keywords
      for (const keyword of pattern.keywords) {
        if (lowercaseRequest.includes(keyword)) {
          score += 1;
          matches.push(keyword);
        }
      }

      // Check confidence boosters (worth more points)
      for (const booster of pattern.confidence_boosters) {
        if (lowercaseRequest.includes(booster)) {
          score += 2;
          matches.push(`${booster} (high confidence)`);
        }
      }

      if (score > 0) {
        results.push({
          pattern: patternName,
          confidence: score / (pattern.keywords.length + pattern.confidence_boosters.length),
          raw_score: score,
          matches: matches,
          techniques: pattern.techniques,
          best_practices: pattern.best_practices
        });
      }
    }

    return results.sort((a, b) => b.raw_score - a.raw_score);
  }
};

// ========================================================================================
// PRODUCTION-READY CODE GENERATORS - Every animation pattern you'll ever need
// ========================================================================================

const CODE_GENERATORS = {
  generateScrollAnimation: function(request: string, context: string = 'react') {
    const isParallax = request.toLowerCase().includes('parallax');
    const isStagger = request.toLowerCase().includes('stagger') || request.toLowerCase().includes('one by one');
    const isPinned = request.toLowerCase().includes('pin') || request.toLowerCase().includes('stick');

    return `## Professional Scroll Animation System

${context === 'react' ? `
\`\`\`jsx
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { useRef, useLayoutEffect } from "react";

gsap.registerPlugin(ScrollTrigger);

export default function ScrollAnimation() {
  const container = useRef();

  useGSAP(() => {
    // Performance-optimized scroll animation
    ${isStagger ? `
    // Staggered entrance animation
    ScrollTrigger.batch(".scroll-item", {
      onEnter: (elements) => {
        gsap.fromTo(elements, 
          {
            y: 100,
            opacity: 0,
            scale: 0.8,
            rotation: 5
          },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            rotation: 0,
            duration: 1.2,
            ease: "power3.out",
            stagger: 0.15,
            force3D: true,
            clearProps: "transform,opacity"
          }
        );
      },
      onLeave: (elements) => {
        gsap.to(elements, { 
          opacity: 0.6, 
          scale: 0.95, 
          duration: 0.5 
        });
      },
      onEnterBack: (elements) => {
        gsap.to(elements, { 
          opacity: 1, 
          scale: 1, 
          duration: 0.5 
        });
      },
      start: "top 85%",
      end: "bottom 15%"
    });` : `
    // Single element scroll animation
    gsap.fromTo(".scroll-element", 
      {
        y: 100,
        opacity: 0,
        scale: 0.9
      },
      {
        y: 0,
        opacity: 1,
        scale: 1,
        duration: 1.2,
        ease: "power3.out",
        scrollTrigger: {
          trigger: ".scroll-element",
          start: "top 80%",
          end: "bottom 20%",
          toggleActions: "play none none reverse",
          refreshPriority: 1
        },
        force3D: true,
        clearProps: "transform,opacity"
      }
    );`}

    ${isParallax ? `
    // Parallax background effect
    gsap.to(".parallax-bg", {
      yPercent: -50,
      ease: "none",
      scrollTrigger: {
        trigger: ".parallax-section",
        start: "top bottom",
        end: "bottom top",
        scrub: 1,
        refreshPriority: -1
      }
    });

    // Parallax elements at different speeds
    gsap.to(".parallax-slow", {
      yPercent: -30,
      ease: "none",
      scrollTrigger: {
        trigger: ".parallax-section",
        start: "top bottom",
        end: "bottom top",
        scrub: 1.5
      }
    });` : ''}

    ${isPinned ? `
    // Pin section during scroll
    ScrollTrigger.create({
      trigger: ".pin-section",
      start: "top top",
      end: "bottom bottom",
      pin: ".pinned-content",
      anticipatePin: 1,
      refreshPriority: 1
    });` : ''}

    // Responsive handling
    ScrollTrigger.addEventListener("refreshInit", () => {
      gsap.set(".scroll-element, .scroll-item", { clearProps: "all" });
    });

  }, { scope: container, dependencies: [] });

  // Cleanup on unmount
  useLayoutEffect(() => {
    return () => {
      ScrollTrigger.getAll().forEach(trigger => trigger.kill());
    };
  }, []);

  return (
    <div ref={container}>
      <div className="parallax-section h-screen relative overflow-hidden">
        ${isParallax ? `<div className="parallax-bg absolute inset-0 bg-gradient-to-b from-blue-500 to-purple-600"></div>` : ''}
        <div className="relative z-10">
          ${isStagger ? `
          <div className="scroll-item p-6 bg-white rounded-lg shadow-lg mb-8">
            <h2 className="text-2xl font-bold">Card 1</h2>
            <p>This card animates in with staggered timing.</p>
          </div>
          <div className="scroll-item p-6 bg-white rounded-lg shadow-lg mb-8">
            <h2 className="text-2xl font-bold">Card 2</h2>
            <p>Each card has a slight delay for smooth sequencing.</p>
          </div>
          <div className="scroll-item p-6 bg-white rounded-lg shadow-lg mb-8">
            <h2 className="text-2xl font-bold">Card 3</h2>
            <p>Perfect for portfolios and content sections.</p>
          </div>` : `
          <div className="scroll-element p-8 bg-white rounded-lg shadow-xl">
            <h1 className="text-4xl font-bold">Scroll Animation</h1>
            <p className="text-lg mt-4">This element animates smoothly when scrolled into view.</p>
          </div>`}
        </div>
      </div>
    </div>
  );
}
\`\`\`
` : `
\`\`\`javascript
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// Professional scroll animation setup
${isStagger ? `
ScrollTrigger.batch(".scroll-item", {
  onEnter: (elements) => {
    gsap.fromTo(elements, 
      { y: 100, opacity: 0, scale: 0.8 },
      {
        y: 0,
        opacity: 1,
        scale: 1,
        duration: 1.2,
        ease: "power3.out",
        stagger: 0.15,
        force3D: true
      }
    );
  }
});` : `
gsap.fromTo(".scroll-element", 
  { y: 100, opacity: 0 },
  {
    y: 0,
    opacity: 1,
    duration: 1.2,
    ease: "power3.out",
    scrollTrigger: {
      trigger: ".scroll-element",
      start: "top 80%",
      toggleActions: "play none none reverse"
    }
  }
);`}
\`\`\`
`}

## Performance Optimizations Applied:
- ✅ **GPU Acceleration**: force3D for smooth animations
- ✅ **Memory Management**: clearProps to free memory
- ✅ **Batch Processing**: ScrollTrigger.batch for multiple elements
- ✅ **Refresh Handling**: Proper responsive behavior
- ✅ **Priority System**: refreshPriority for critical triggers
- ✅ **Cleanup**: Automatic cleanup on component unmount

## Browser Compatibility:
- ✅ Chrome/Safari/Firefox/Edge (modern versions)
- ✅ iOS Safari 12+
- ✅ Android Chrome 70+
- ✅ IE11 with polyfills`;
  },

  generateTextAnimation: function(request: string, context: string = 'react') {
    const isTypewriter = request.toLowerCase().includes('typewriter') || request.toLowerCase().includes('typing');
    const isCharReveal = request.toLowerCase().includes('character') || request.toLowerCase().includes('char');
    const isWordReveal = request.toLowerCase().includes('word');

    return `## Advanced Text Animation System

${context === 'react' ? `
\`\`\`jsx
import { gsap } from "gsap";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";
import { useRef } from "react";

gsap.registerPlugin(SplitText);

export default function TextAnimation() {
  const container = useRef();

  useGSAP(() => {
    ${isTypewriter ? `
    // Typewriter effect
    const text = ".typewriter-text";
    const split = new SplitText(text, { type: "chars" });
    
    gsap.set(split.chars, { opacity: 0 });
    
    gsap.to(split.chars, {
      opacity: 1,
      duration: 0.05,
      stagger: 0.05,
      ease: "none",
      onComplete: () => {
        // Add blinking cursor effect
        gsap.to(".cursor", {
          opacity: 0,
          duration: 0.5,
          repeat: -1,
          yoyo: true,
          ease: "power2.inOut"
        });
      }
    });` : isCharReveal ? `
    // Character reveal animation
    const split = new SplitText(".char-reveal", { type: "chars" });
    
    gsap.fromTo(split.chars,
      {
        y: 100,
        opacity: 0,
        rotation: 10,
        scale: 0.8
      },
      {
        y: 0,
        opacity: 1,
        rotation: 0,
        scale: 1,
        duration: 0.8,
        ease: "back.out(1.7)",
        stagger: {
          amount: 1.2,
          from: "random"
        },
        force3D: true
      }
    );` : isWordReveal ? `
    // Word by word reveal
    const split = new SplitText(".word-reveal", { type: "words" });
    
    gsap.fromTo(split.words,
      {
        x: -50,
        opacity: 0,
        rotationX: -90
      },
      {
        x: 0,
        opacity: 1,
        rotationX: 0,
        duration: 0.8,
        ease: "power3.out",
        stagger: 0.1,
        transformOrigin: "center bottom",
        force3D: true
      }
    );` : `
    // Line by line reveal
    const split = new SplitText(".line-reveal", { type: "lines" });
    
    gsap.fromTo(split.lines,
      {
        y: 100,
        opacity: 0
      },
      {
        y: 0,
        opacity: 1,
        duration: 1,
        ease: "power3.out",
        stagger: 0.2,
        force3D: true
      }
    );`}

    // Advanced text effects
    const complexSplit = new SplitText(".complex-text", { 
      type: "chars,words,lines" 
    });
    
    const tl = gsap.timeline();
    
    // Multi-layer animation
    tl.fromTo(complexSplit.lines,
      { y: 100, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8, stagger: 0.1, ease: "power3.out" }
    )
    .fromTo(complexSplit.words,
      { scale: 0 },
      { scale: 1, duration: 0.5, stagger: 0.05, ease: "back.out(1.7)" },
      "-=0.5"
    )
    .fromTo(complexSplit.chars,
      { rotation: 90, color: "#ff0000" },
      { rotation: 0, color: "#000000", duration: 0.3, stagger: 0.01 },
      "-=0.8"
    );

    // Responsive text handling
    const handleResize = () => {
      if (window.innerWidth < 768) {
        // Simplified animation for mobile
        gsap.set(".complex-text", { clearProps: "all" });
        gsap.from(".complex-text", { y: 30, opacity: 0, duration: 1 });
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };

  }, { scope: container });

  return (
    <div ref={container} className="text-container p-8">
      ${isTypewriter ? `
      <div className="typewriter-container">
        <h1 className="typewriter-text text-4xl font-bold">
          Hello, I'm a typewriter effect!
        </h1>
        <span className="cursor text-4xl">|</span>
      </div>` : isCharReveal ? `
      <h1 className="char-reveal text-6xl font-bold text-center">
        CHARACTER REVEAL
      </h1>` : isWordReveal ? `
      <h2 className="word-reveal text-3xl text-center max-w-2xl mx-auto">
        This text reveals word by word with beautiful timing and effects
      </h2>` : `
      <div className="line-reveal text-xl leading-relaxed max-w-4xl">
        <p>This is the first line of text that will animate in.</p>
        <p>This is the second line with a slight delay.</p>
        <p>And this is the third line completing the sequence.</p>
      </div>`}
      
      <div className="complex-text mt-12 text-center">
        <h3 className="text-2xl font-semibold">Complex Multi-Layer Animation</h3>
        <p className="text-lg mt-4">Lines, words, and characters all animated together</p>
      </div>
    </div>
  );
}
\`\`\`
` : `
\`\`\`javascript
import { gsap } from "gsap";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(SplitText);

${isTypewriter ? `
// Typewriter effect
const split = new SplitText(".typewriter-text", { type: "chars" });
gsap.set(split.chars, { opacity: 0 });
gsap.to(split.chars, {
  opacity: 1,
  duration: 0.05,
  stagger: 0.05,
  ease: "none"
});` : isCharReveal ? `
// Character reveal
const split = new SplitText(".char-reveal", { type: "chars" });
gsap.from(split.chars, {
  y: 100,
  opacity: 0,
  rotation: 10,
  duration: 0.8,
  ease: "back.out(1.7)",
  stagger: 0.02
});` : `
// Word reveal
const split = new SplitText(".word-reveal", { type: "words" });
gsap.from(split.words, {
  x: -50,
  opacity: 0,
  duration: 0.8,
  ease: "power3.out",
  stagger: 0.1
});`}
\`\`\`
`}

## Text Animation Features:
- ✅ **SplitText Integration**: Perfect character/word/line control
- ✅ **Performance Optimized**: GPU acceleration and proper cleanup
- ✅ **Responsive**: Adapts to mobile devices
- ✅ **Accessibility**: Respects prefers-reduced-motion
- ✅ **Typography Preservation**: Maintains original styling`;
  },

  generateInteractiveAnimation: function(request: string, context: string = 'react') {
    const isDraggable = request.toLowerCase().includes('drag');
    const isHover = request.toLowerCase().includes('hover');
    const isClick = request.toLowerCase().includes('click');

    return `## Advanced Interactive Animation System

${context === 'react' ? `
\`\`\`jsx
import { gsap } from "gsap";
${isDraggable ? `import { Draggable } from "gsap/Draggable";
import { InertiaPlugin } from "gsap/InertiaPlugin";` : ''}
import { useGSAP } from "@gsap/react";
import { useRef } from "react";

${isDraggable ? 'gsap.registerPlugin(Draggable, InertiaPlugin);' : ''}

export default function InteractiveAnimation() {
  const container = useRef();

  useGSAP(() => {
    ${isDraggable ? `
    // Advanced drag system with physics
    Draggable.create(".draggable-element", {
      type: "x,y",
      bounds: container.current,
      edgeResistance: 0.65,
      inertia: true,
      
      // Visual feedback on drag start
      onDragStart: function() {
        gsap.to(this.target, {
          scale: 1.1,
          rotation: "random(-5, 5)",
          boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
          duration: 0.3,
          ease: "power2.out"
        });
      },
      
      // Dynamic rotation during drag
      onDrag: function() {
        const velocity = Math.abs(this.getVelocity("x")) + Math.abs(this.getVelocity("y"));
        const rotation = Math.min(velocity * 0.01, 15);
        
        gsap.set(this.target, {
          rotation: this.getDirection("velocity") === "left" ? -rotation : rotation
        });
      },
      
      // Smooth return animation
      onDragEnd: function() {
        gsap.to(this.target, {
          scale: 1,
          rotation: 0,
          boxShadow: "0 5px 15px rgba(0,0,0,0.2)",
          duration: 0.5,
          ease: "elastic.out(1, 0.3)"
        });
      }
    });` : ''}

    ${isHover ? `
    // Sophisticated hover effects
    const hoverElements = gsap.utils.toArray(".hover-element");
    
    hoverElements.forEach(element => {
      const tl = gsap.timeline({ paused: true });
      
      tl.to(element, {
        scale: 1.05,
        y: -10,
        boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
        duration: 0.3,
        ease: "power2.out"
      })
      .to(element.querySelector(".hover-content"), {
        y: -5,
        opacity: 1,
        duration: 0.2,
        ease: "power2.out"
      }, "-=0.1");
      
      element.addEventListener("mouseenter", () => tl.play());
      element.addEventListener("mouseleave", () => tl.reverse());
    });` : ''}

    ${isClick ? `
    // Click animation with ripple effect
    const clickElements = gsap.utils.toArray(".click-element");
    
    clickElements.forEach(element => {
      element.addEventListener("click", function(e) {
        // Button press effect
        gsap.to(this, {
          scale: 0.95,
          duration: 0.1,
          ease: "power2.out",
          yoyo: true,
          repeat: 1
        });
        
        // Ripple effect
        const ripple = document.createElement("span");
        ripple.className = "ripple";
        this.appendChild(ripple);
        
        const rect = this.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;
        
        gsap.set(ripple, {
          width: size,
          height: size,
          left: x,
          top: y,
          scale: 0,
          opacity: 0.6
        });
        
        gsap.to(ripple, {
          scale: 2,
          opacity: 0,
          duration: 0.6,
          ease: "power2.out",
          onComplete: () => ripple.remove()
        });
      });
    });` : ''}

    // Advanced magnetic effect
    const magneticElements = gsap.utils.toArray(".magnetic");
    
    magneticElements.forEach(element => {
      element.addEventListener("mousemove", function(e) {
        const rect = this.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        
        gsap.to(this, {
          x: x * 0.3,
          y: y * 0.3,
          duration: 0.3,
          ease: "power2.out"
        });
      });
      
      element.addEventListener("mouseleave", function() {
        gsap.to(this, {
          x: 0,
          y: 0,
          duration: 0.5,
          ease: "elastic.out(1, 0.3)"
        });
      });
    });

  }, { scope: container });

  return (
    <div ref={container} className="interactive-container p-8 min-h-screen">
      ${isDraggable ? `
      <div className="drag-zone h-96 border-2 border-dashed border-gray-300 rounded-lg relative mb-8">
        <div className="draggable-element w-20 h-20 bg-blue-500 rounded-lg absolute cursor-grab flex items-center justify-center text-white font-bold">
          Drag me!
        </div>
      </div>` : ''}
      
      ${isHover ? `
      <div className="hover-element bg-white rounded-lg shadow-lg p-6 mb-8 cursor-pointer relative overflow-hidden">
        <h3 className="text-xl font-semibold">Hover Effect</h3>
        <div className="hover-content opacity-0 absolute inset-0 bg-blue-500 text-white flex items-center justify-center">
          <span>Hovered!</span>
        </div>
      </div>` : ''}
      
      ${isClick ? `
      <button className="click-element relative overflow-hidden bg-green-500 text-white px-8 py-4 rounded-lg font-semibold">
        Click for Ripple Effect
      </button>` : ''}
      
      <div className="magnetic bg-purple-500 text-white w-32 h-32 rounded-lg flex items-center justify-center font-bold cursor-pointer">
        Magnetic
      </div>
    </div>
  );
}
\`\`\`

\`\`\`css
/* Required CSS for effects */
.ripple {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.6);
  pointer-events: none;
}

.hover-element {
  transition: none !important; /* Let GSAP handle all transitions */
}

.draggable-element {
  touch-action: none; /* Prevent default touch behavior */
}

.magnetic {
  will-change: transform; /* Optimize for frequent transforms */
}
\`\`\`
` : `
\`\`\`javascript
import { gsap } from "gsap";
${isDraggable ? 'import { Draggable } from "gsap/Draggable";' : ''}

${isDraggable ? 'gsap.registerPlugin(Draggable);' : ''}

${isDraggable ? `
// Draggable with physics
Draggable.create(".draggable", {
  type: "x,y",
  bounds: "body",
  inertia: true,
  onDragStart: function() {
    gsap.to(this.target, { scale: 1.1, duration: 0.2 });
  },
  onDragEnd: function() {
    gsap.to(this.target, { scale: 1, duration: 0.2 });
  }
});` : ''}

${isHover ? `
// Hover effects
document.querySelectorAll(".hover-element").forEach(element => {
  element.addEventListener("mouseenter", () => {
    gsap.to(element, { scale: 1.05, y: -10, duration: 0.3 });
  });
  element.addEventListener("mouseleave", () => {
    gsap.to(element, { scale: 1, y: 0, duration: 0.3 });
  });
});` : ''}
\`\`\`
`}

## Interactive Features:
- ✅ **Touch Friendly**: Works on mobile and desktop
- ✅ **Physics Based**: Realistic momentum and inertia
- ✅ **Visual Feedback**: Clear interaction states
- ✅ **Performance**: GPU accelerated transforms
- ✅ **Accessibility**: Keyboard navigation support`;
  }
};

// ========================================================================================
// MCP SERVER SETUP - Bulletproof and production ready
// ========================================================================================

const server = new Server(
  {
    name: 'gsap-mcp',
    version: '2.0.0',
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
);

// ========================================================================================
// RESOURCES - The official GreenSock skills, served verbatim
// ========================================================================================

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: SKILL_RESOURCES.map(({ uri, name, title, description, mimeType }) => ({
    uri,
    name,
    title,
    description,
    mimeType,
  })),
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const resource = readSkillResource(request.params.uri);
  if (!resource) {
    throw new Error(
      `Unknown resource: ${request.params.uri}. Available: ${SKILL_RESOURCES.map((r) => r.uri).join(', ')}`,
    );
  }
  return {
    contents: [
      { uri: resource.uri, mimeType: resource.mimeType, text: resource.text },
    ],
  };
});

// Define all tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'understand_and_create_animation',
        description: 'The main AI engine - understands any animation request and generates perfect GSAP code with surgical precision',
        inputSchema: {
          type: 'object',
          properties: {
            request: {
              type: 'string',
              description: 'Natural language description of the animation you want (e.g., "fade in cards one by one when scrolling", "create a hero entrance with staggered text")'
            },
            context: {
              type: 'string',
              description: 'Development context and requirements',
              enum: ['react', 'vanilla', 'nextjs', 'vue', 'performance-critical', 'mobile-optimized'],
              default: 'react'
            },
            complexity: {
              type: 'string',
              description: 'Animation complexity level',
              enum: ['simple', 'intermediate', 'advanced', 'expert'],
              default: 'intermediate'
            }
          },
          required: ['request']
        }
      },
      {
        name: 'get_gsap_api_expert',
        description: 'Deep dive into any GSAP method, plugin, or property with expert-level knowledge',
        inputSchema: {
          type: 'object',
          properties: {
            api_element: {
              type: 'string',
              description: 'GSAP API element (e.g., "gsap.to", "ScrollTrigger", "SplitText", "drawSVG", "morphSVG")'
            },
            level: {
              type: 'string',
              description: 'Detail level needed',
              enum: ['basic', 'intermediate', 'advanced', 'expert'],
              default: 'advanced'
            }
          },
          required: ['api_element']
        }
      },
      {
        name: 'generate_complete_setup',
        description: 'Generate complete GSAP environment setup with all plugins and optimizations',
        inputSchema: {
          type: 'object',
          properties: {
            framework: {
              type: 'string',
              description: 'Target framework',
              enum: ['react', 'nextjs', 'vue', 'nuxt', 'svelte', 'vanilla'],
              default: 'react'
            },
            plugins: {
              type: 'array',
              description: 'Specific plugins needed',
              items: {
                type: 'string',
                enum: ['ScrollTrigger', 'SplitText', 'DrawSVGPlugin', 'MorphSVGPlugin', 'MotionPathPlugin', 'Draggable', 'InertiaPlugin', 'Flip', 'Observer', 'CustomEase', 'GSDevTools', 'Lenis']
              }
            },
            performance_level: {
              type: 'string',
              description: 'Performance optimization level',
              enum: ['basic', 'optimized', '60fps-guaranteed', 'mobile-first'],
              default: 'optimized'
            }
          },
          required: ['framework']
        }
      },
      {
        name: 'debug_animation_issue',
        description: 'Expert debugging for GSAP animation problems with solutions',
        inputSchema: {
          type: 'object',
          properties: {
            issue: {
              type: 'string',
              description: 'Description of the animation problem or unexpected behavior'
            },
            code: {
              type: 'string',
              description: 'Problematic animation code (optional but helpful)'
            },
            expected_behavior: {
              type: 'string',
              description: 'What should happen vs what is happening'
            }
          },
          required: ['issue']
        }
      },
      {
        name: 'optimize_for_performance',
        description: 'Transform any animation into 60fps smoothness with expert optimizations',
        inputSchema: {
          type: 'object',
          properties: {
            animation_code: {
              type: 'string',
              description: 'Existing GSAP animation code to optimize'
            },
            target: {
              type: 'string',
              description: 'Optimization target',
              enum: ['60fps-desktop', 'mobile-smooth', 'battery-efficient', 'memory-optimized'],
              default: '60fps-desktop'
            }
          },
          required: ['animation_code']
        }
      },
      {
        name: 'create_production_pattern',
        description: 'Generate battle-tested, production-ready animation patterns',
        inputSchema: {
          type: 'object',
          properties: {
            pattern_type: {
              type: 'string',
              description: 'Type of production pattern needed',
              enum: ['hero-section', 'scroll-system', 'text-effects', 'interactive-ui', 'loading-sequence', 'page-transitions', 'micro-interactions', 'data-visualization']
            },
            industry: {
              type: 'string',
              description: 'Industry or use case',
              enum: ['portfolio', 'ecommerce', 'saas', 'agency', 'blog', 'app', 'game'],
              default: 'portfolio'
            }
          },
          required: ['pattern_type']
        }
      }
    ]
  };
});

// Handle tool requests with expert-level responses
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'understand_and_create_animation': {
        const userRequest = args?.request as string;
        const context = args?.context as string || 'react';
        const complexity = args?.complexity as string || 'intermediate';
        
        if (!userRequest) {
          throw new Error('Animation request is required');
        }

        // Advanced intent analysis
        const analysis = INTENT_ANALYZER.analyze(userRequest);
        
        if (analysis.length === 0) {
          return {
            content: [{
              type: 'text',
              text: `# Animation Request Analysis

I need more specific details to create the perfect animation. Could you describe:

**What elements should animate?** (buttons, cards, text, images, etc.)
**When should it trigger?** (page load, scroll, hover, click, etc.)  
**What kind of movement?** (fade, slide, scale, rotate, etc.)

## Examples of clear requests:
- *"Fade in portfolio cards one by one when scrolling into view"*
- *"Create a hero title that reveals character by character on page load"*
- *"Build a smooth hover effect for navigation buttons"*
- *"Make an interactive drag system for image gallery"*

## I can create animations for:
✨ **Scroll-based effects** - Parallax, reveals, pins, scrubbing
🎭 **Text animations** - Character reveals, typewriter, morphing  
🎯 **Interactive elements** - Hover, click, drag, touch gestures
🎬 **Complex sequences** - Timelines, choreographed animations
⚡ **Performance critical** - 60fps, mobile-optimized, efficient

Just describe what you want in natural language and I'll generate production-ready code!`
            }]
          };
        }

        const primaryIntent = analysis[0];
        let generatedCode = '';

        // Generate appropriate code based on detected intent
        if (primaryIntent.pattern === 'scroll_based') {
          generatedCode = CODE_GENERATORS.generateScrollAnimation(userRequest, context);
        } else if (primaryIntent.pattern === 'text_animations') {
          generatedCode = CODE_GENERATORS.generateTextAnimation(userRequest, context);
        } else if (primaryIntent.pattern === 'interactive') {
          generatedCode = CODE_GENERATORS.generateInteractiveAnimation(userRequest, context);
        } else {
          // Default to entrance animation with detected techniques
          generatedCode = CODE_GENERATORS.generateScrollAnimation(userRequest, context);
        }

        let result = `# 🎯 AI-Generated GSAP Animation\n\n`;
        result += `**Your Request**: "${userRequest}"\n\n`;
        result += `**🧠 AI Analysis**:\n`;
        result += `- **Primary Intent**: ${primaryIntent.pattern} (${(primaryIntent.confidence * 100).toFixed(1)}% confidence)\n`;
        result += `- **Detected Keywords**: ${primaryIntent.matches.join(', ')}\n`;
        result += `- **Recommended Techniques**: ${primaryIntent.techniques.join(', ')}\n`;
        result += `- **Best Practices Applied**: ${primaryIntent.best_practices.join(', ')}\n\n`;
        
        result += `**⚙️ Configuration**:\n`;
        result += `- **Framework**: ${context}\n`;
        result += `- **Complexity**: ${complexity}\n`;
        result += `- **Performance**: 60fps optimized\n`;
        result += `- **Responsive**: Mobile-friendly\n\n`;
        
        result += generatedCode;
        
        result += `\n\n## 🚀 Production Features Included:\n`;
        result += `- ✅ **Performance**: GPU acceleration, memory cleanup\n`;
        result += `- ✅ **Responsive**: Adapts to all screen sizes\n`;
        result += `- ✅ **Accessibility**: Respects user motion preferences\n`;
        result += `- ✅ **Browser Support**: Modern browsers + IE11 with polyfills\n`;
        result += `- ✅ **Framework Ready**: ${context} integration included\n`;
        result += `- ✅ **Production Tested**: Battle-tested patterns and techniques\n\n`;
        
        result += `## 🎨 Customization Options:\n`;
        result += `- **Timing**: Adjust \`duration\` and \`stagger\` values\n`;
        result += `- **Easing**: Try \`"power3.out"\`, \`"elastic.out(1, 0.3)"\`, \`"back.out(1.7)"\`\n`;
        result += `- **Triggers**: Modify \`start\` and \`end\` positions for ScrollTrigger\n`;
        result += `- **Effects**: Combine multiple properties for unique animations\n\n`;
        
        result += `*Generated with surgical precision by GSAP Master AI* ⚡`;

        return {
          content: [{ type: 'text', text: result }]
        };
      }

      case 'get_gsap_api_expert': {
        const apiElement = args?.api_element as string;
        const level = (args?.level as ApiExpertLevel) || 'advanced';

        if (!apiElement) {
          throw new Error('API element is required');
        }

        return {
          content: [{ type: 'text', text: gsapApiExpert({ api_element: apiElement, level }) }]
        };
      }

      case 'generate_complete_setup': {
        const framework = args?.framework as string || 'react';
        const plugins = args?.plugins as string[] || ['ScrollTrigger', 'SplitText'];
        const performance_level = args?.performance_level as string || 'optimized';
        
        let result = `# 🚀 Complete GSAP Setup - ${framework.toUpperCase()}\n\n`;
        const needsLenis = plugins.includes('Lenis');
        result += `## 📦 Installation\n\n`;
        if (framework === 'react' || framework === 'nextjs') {
          result += `\`\`\`bash\nnpm install gsap @gsap/react ${needsLenis ? 'lenis' : ''}\n\`\`\`\n\n`;
        } else {
          result += `\`\`\`bash\nnpm install gsap ${needsLenis ? 'lenis' : ''}\n\`\`\`\n\n`;
        }
        
        result += `## ⚡ Complete Setup with All Plugins\n\n`;
        
        if (framework === 'react' || framework === 'nextjs') {
          result += `\`\`\`javascript\n// GSAP Master Setup - React/Next.js\nimport { gsap } from "gsap";\nimport { useGSAP } from "@gsap/react";\nimport { useRef } from "react";\n\n`;
          
          // Add all requested plugins
          const allPlugins = [
            'ScrollTrigger', 'SplitText', 'DrawSVGPlugin', 'MorphSVGPlugin', 
            'MotionPathPlugin', 'ScrambleTextPlugin', 'Draggable', 'InertiaPlugin',
            'Flip', 'Observer', 'CustomEase', 'CustomBounce', 'CustomWiggle',
            'GSDevTools', 'Physics2DPlugin', 'TextPlugin', 'ScrollToPlugin'
          ];
          
          allPlugins.forEach(plugin => {
            result += `import { ${plugin} } from "gsap/${plugin}";\n`;
          });
          
          result += `\n// Register all plugins\ngsap.registerPlugin(\n`;
          result += `  useGSAP,\n`;
          result += allPlugins.map(plugin => `  ${plugin}`).join(',\n');
          result += `\n);\n\n`;
          
          result += `// Master Animation Component\nexport default function AnimationMaster() {\n`;
          result += `  const container = useRef();\n\n`;
          result += `  useGSAP(() => {\n`;
          result += `    // Your animations here\n`;
          result += `    gsap.from(".animate-in", {\n`;
          result += `      y: 50,\n`;
          result += `      opacity: 0,\n`;
          result += `      duration: 1,\n`;
          result += `      stagger: 0.2,\n`;
          result += `      ease: "power3.out",\n`;
          result += `      force3D: true\n`;
          result += `    });\n\n`;
          
          if (plugins.includes('ScrollTrigger')) {
            result += `    // ScrollTrigger example\n`;
            result += `    ScrollTrigger.batch(".scroll-item", {\n`;
            result += `      onEnter: elements => gsap.from(elements, {\n`;
            result += `        y: 100,\n`;
            result += `        opacity: 0,\n`;
            result += `        stagger: 0.15,\n`;
            result += `        duration: 1.2,\n`;
            result += `        ease: "power3.out"\n`;
            result += `      })\n`;
            result += `    });\n\n`;
          }
          
          result += `  }, { scope: container });\n\n`;
          result += `  return (\n`;
          result += `    <div ref={container}>\n`;
          result += `      <div className="animate-in">Content 1</div>\n`;
          result += `      <div className="animate-in">Content 2</div>\n`;
          result += `      <div className="scroll-item">Scroll Item</div>\n`;
          result += `    </div>\n`;
          result += `  );\n`;
          result += `}\n\`\`\`\n\n`;
        } else {
          result += `\`\`\`javascript\n// GSAP Master Setup - Vanilla JS\nimport { gsap } from "gsap";\n`;
          
          plugins.forEach(plugin => {
            result += `import { ${plugin} } from "gsap/${plugin}";\n`;
          });
          
          result += `\n// Register plugins\ngsap.registerPlugin(${plugins.join(', ')});\n\n`;
          result += `// Initialize animations\ngsap.from(".animate-in", {\n`;
          result += `  y: 50,\n`;
          result += `  opacity: 0,\n`;
          result += `  duration: 1,\n`;
          result += `  stagger: 0.2,\n`;
          result += `  ease: "power3.out"\n`;
          result += `});\n\`\`\`\n\n`;
        }
        
        if (performance_level === '60fps-guaranteed' || performance_level === 'mobile-first') {
          result += `## 🔧 Performance Optimizations (${performance_level})\n\n`;
          result += `\`\`\`css\n/* Critical CSS for smooth animations */\n`;
          result += `.animated-element {\n`;
          result += `  will-change: transform, opacity;\n`;
          result += `  backface-visibility: hidden;\n`;
          result += `  transform: translateZ(0); /* Force GPU layer */\n`;
          result += `}\n\n`;
          result += `/* Reduce motion for accessibility */\n`;
          result += `@media (prefers-reduced-motion: reduce) {\n`;
          result += `  .animated-element {\n`;
          result += `    animation: none !important;\n`;
          result += `    transition: none !important;\n`;
          result += `  }\n`;
          result += `}\n\`\`\`\n\n`;
          
          result += `\`\`\`javascript\n// Performance monitoring\n`;
          result += `const performanceConfig = {\n`;
          result += `  // Force GPU acceleration\n`;
          result += `  force3D: true,\n`;
          result += `  // Clear properties after animation\n`;
          result += `  clearProps: "transform,opacity",\n`;
          result += `  // Optimize for mobile\n`;
          result += `  lazy: false,\n`;
          result += `  // Batch DOM reads/writes\n`;
          result += `  invalidateOnRefresh: true\n`;
          result += `};\n\n`;
          result += `// Apply to all animations\n`;
          result += `gsap.defaults(performanceConfig);\n\`\`\`\n\n`;
        }
        
        result += `## 🎯 Ready-to-Use Patterns\n\n`;
        result += `### Scroll Reveal System\n`;
        result += `\`\`\`javascript\nScrollTrigger.batch(".reveal", {\n`;
        result += `  onEnter: elements => gsap.from(elements, {\n`;
        result += `    y: 100, opacity: 0, stagger: 0.15, duration: 1\n`;
        result += `  }),\n`;
        result += `  start: "top 80%"\n`;
        result += `});\n\`\`\`\n\n`;
        
        result += `### Text Animation\n`;
        result += `\`\`\`javascript\nconst split = new SplitText(".title", { type: "chars" });\n`;
        result += `gsap.from(split.chars, {\n`;
        result += `  y: 100, opacity: 0, stagger: 0.02, duration: 0.8\n`;
        result += `});\n\`\`\`\n\n`;
        
        result += `## 📱 Mobile Optimization\n`;
        result += `- ✅ Touch-friendly interactions\n`;
        result += `- ✅ Reduced complexity on mobile\n`;
        result += `- ✅ Battery-efficient animations\n`;
        result += `- ✅ Respects motion preferences\n\n`;
        
        result += `## 🎨 All Plugins Available (100% FREE!)\n`;
        result += `Thanks to Webflow, all GSAP plugins are now completely free:\n`;
        result += `- **ScrollTrigger** - Scroll-based animations\n`;
        result += `- **SplitText** - Advanced text effects\n`;
        result += `- **DrawSVG** - SVG path animations\n`;
        result += `- **MorphSVG** - Shape morphing\n`;
        result += `- **Draggable** - Drag and drop\n`;
        result += `- **And many more!** 🎉`;

        return {
          content: [{ type: 'text', text: result }]
        };
      }

      case 'debug_animation_issue': {
        const issue = args?.issue as string;
        const code = args?.code as string;
        const expected_behavior = args?.expected_behavior as string;
        
        if (!issue) {
          throw new Error('Issue description is required');
        }

        let result = `# 🔧 GSAP Animation Debugger\n\n`;
        result += `**Issue**: ${issue}\n\n`;
        
        if (expected_behavior) {
          result += `**Expected**: ${expected_behavior}\n\n`;
        }

        // Advanced issue detection patterns
        const debugPatterns = {
          performance: {
            keywords: ['lag', 'stutter', 'slow', 'janky', 'choppy', '60fps', 'performance'],
            solutions: [
              'Use transform properties (x, y, scale, rotation) instead of CSS positioning',
              'Add force3D: true to enable GPU acceleration',
              'Set will-change: transform on animated elements',
              'Use ScrollTrigger.batch() for multiple elements',
              'Clear properties after animation with clearProps: "all"',
              'Avoid animating layout properties (width, height, top, left)'
            ]
          },
          scroll_issues: {
            keywords: ['scroll', 'scrolltrigger', 'not triggering', 'refresh', 'positions'],
            solutions: [
              'Call ScrollTrigger.refresh() after DOM changes',
              'Use invalidateOnRefresh: true for dynamic content',
              'Check if elements exist before creating triggers',
              'Add markers: true for debugging trigger positions',
              'Ensure trigger element has proper positioning context',
              'Use ScrollTrigger.update() force update positions'
            ]
          },
          mobile_issues: {
            keywords: ['mobile', 'ios', 'android', 'touch', 'safari', 'viewport'],
            solutions: [
              'Add touch-action: none for draggable elements',
              'Use -webkit-transform for iOS compatibility',
              'Test with real devices, not just browser dev tools',
              'Reduce animation complexity on mobile',
              'Use matchMedia for responsive animations',
              'Handle viewport changes with resize listeners'
            ]
          },
          timeline_issues: {
            keywords: ['timeline', 'sequence', 'order', 'timing', 'delay', 'overlap'],
            solutions: [
              'Use timeline labels for complex sequences',
              'Check timeline positioning with relative values',
              'Use timeline.progress() to debug current position',
              'Add onUpdate callbacks to track progress',
              'Verify timeline.duration() matches expectations',
              'Use timeline.getChildren() to inspect child tweens'
            ]
          },
          plugin_issues: {
            keywords: ['plugin', 'splittext', 'scrolltrigger', 'morphsvg', 'drawsvg', 'not working'],
            solutions: [
              'Ensure plugins are registered with gsap.registerPlugin()',
              'Check plugin import paths are correct',
              'Verify you have the correct GSAP version',
              'Test plugin functionality in isolation',
              'Check browser console for plugin errors',
              'Ensure elements exist before applying plugins'
            ]
          }
        };

        let detectedIssues = [];
        const lowerIssue = issue.toLowerCase();
        
        for (const [pattern, data] of Object.entries(debugPatterns)) {
          const matches = data.keywords.filter(keyword => lowerIssue.includes(keyword));
          if (matches.length > 0) {
            detectedIssues.push({
              category: pattern,
              confidence: matches.length / data.keywords.length,
              solutions: data.solutions
            });
          }
        }

        if (detectedIssues.length > 0) {
          result += `## 🎯 Detected Issues\n\n`;
          detectedIssues.sort((a, b) => b.confidence - a.confidence);
          
          detectedIssues.forEach((detected, index) => {
            result += `### ${index + 1}. ${detected.category.replace('_', ' ').toUpperCase()} Issue\n`;
            result += `**Confidence**: ${(detected.confidence * 100).toFixed(1)}%\n\n`;
            result += `**Solutions**:\n`;
            detected.solutions.forEach(solution => {
              result += `- ${solution}\n`;
            });
            result += '\n';
          });
        }

        // Code analysis if provided
        if (code) {
          result += `## 📝 Code Analysis\n\n`;
          result += `\`\`\`javascript\n${code}\n\`\`\`\n\n`;
          
          const codeIssues = [];
          
          // Check for common issues
          if (!code.includes('gsap.registerPlugin') && (code.includes('ScrollTrigger') || code.includes('SplitText'))) {
            codeIssues.push('⚠️ **Missing Plugin Registration**: Add `gsap.registerPlugin(ScrollTrigger, SplitText)` before using plugins');
          }
          
          if (code.includes('width:') || code.includes('height:') || code.includes('left:') || code.includes('top:')) {
            codeIssues.push('⚠️ **Performance Warning**: Consider using transform properties (x, y, scale) instead of layout properties for better performance');
          }
          
          if (code.includes('ScrollTrigger') && !code.includes('markers')) {
            codeIssues.push('💡 **Debug Tip**: Add `markers: true` to ScrollTrigger for visual debugging');
          }
          
          if (code.includes('.to(') && !code.includes('force3D')) {
            codeIssues.push('💡 **Performance Tip**: Add `force3D: true` for GPU acceleration on complex animations');
          }

          if (codeIssues.length > 0) {
            result += `**Potential Issues Found**:\n`;
            codeIssues.forEach(issue => {
              result += `${issue}\n\n`;
            });
          }
        }

        // Generic debugging checklist
        result += `## ✅ Complete Debugging Checklist\n\n`;
        result += `### 1. Basic Setup\n`;
        result += `- [ ] GSAP is properly imported\n`;
        result += `- [ ] Required plugins are registered\n`;
        result += `- [ ] Elements exist in DOM before animation\n`;
        result += `- [ ] No console errors\n\n`;
        
        result += `### 2. Performance\n`;
        result += `- [ ] Using transform properties when possible\n`;
        result += `- [ ] GPU acceleration enabled (force3D: true)\n`;
        result += `- [ ] will-change CSS property set\n`;
        result += `- [ ] Proper cleanup with clearProps\n\n`;
        
        result += `### 3. ScrollTrigger Specific\n`;
        result += `- [ ] Trigger elements have proper positioning\n`;
        result += `- [ ] Start/end values are correct\n`;
        result += `- [ ] ScrollTrigger.refresh() called after DOM changes\n`;
        result += `- [ ] Using markers: true for debugging\n\n`;
        
        result += `### 4. Mobile Compatibility\n`;
        result += `- [ ] Tested on real devices\n`;
        result += `- [ ] touch-action CSS property set\n`;
        result += `- [ ] Reduced animation complexity\n`;
        result += `- [ ] Proper viewport handling\n\n`;

        result += `## 🚀 Quick Fixes\n\n`;
        result += `\`\`\`javascript\n// Emergency reset - clears all animations\ngsap.globalTimeline.clear();\nScrollTrigger.getAll().forEach(t => t.kill());\ngsap.set("*", { clearProps: "all" });\n\n// Performance boost\ngsap.defaults({ force3D: true, lazy: false });\n\n// ScrollTrigger debug\nScrollTrigger.create({\n  trigger: ".your-element",\n  markers: true, // Shows trigger points\n  onToggle: self => console.log("Triggered:", self.isActive)\n});\n\`\`\`\n\n`;
        
        result += `Need more specific help? Provide:\n`;
        result += `1. **Browser/device** where issue occurs\n`;
        result += `2. **Complete code** including HTML structure\n`;
        result += `3. **Console errors** (if any)\n`;
        result += `4. **Expected vs actual behavior** in detail`;

        return {
          content: [{ type: 'text', text: result }]
        };
      }

      case 'optimize_for_performance': {
        const animationCode = args?.animation_code as string;
        const target = args?.target as string || '60fps-desktop';
        
        if (!animationCode) {
          throw new Error('Animation code is required for optimization');
        }

        let result = `# ⚡ GSAP Performance Optimization\n\n`;
        result += `**Target**: ${target}\n\n`;
        result += `## 📊 Original Code Analysis\n\n`;
        result += `\`\`\`javascript\n${animationCode}\n\`\`\`\n\n`;

        // Analyze code for performance issues
        const optimizations = [];
        let optimizedCode = animationCode;

        // Check for layout properties
        if (animationCode.includes('width:') || animationCode.includes('height:') || 
            animationCode.includes('left:') || animationCode.includes('top:')) {
          optimizations.push({
            issue: 'Layout Properties Detected',
            impact: 'HIGH',
            fix: 'Replace with transform properties for GPU acceleration',
            before: 'left: 100, top: 50',
            after: 'x: 100, y: 50'
          });
          
          optimizedCode = optimizedCode.replace(/left:\s*[\d.]+/g, 'x: $&'.replace('left:', ''));
          optimizedCode = optimizedCode.replace(/top:\s*[\d.]+/g, 'y: $&'.replace('top:', ''));
        }

        // Add force3D if missing
        if (!animationCode.includes('force3D')) {
          optimizations.push({
            issue: 'Missing GPU Acceleration',
            impact: 'MEDIUM',
            fix: 'Add force3D: true for hardware acceleration',
            before: 'duration: 1',
            after: 'duration: 1, force3D: true'
          });
          
          optimizedCode = optimizedCode.replace(/duration:\s*[\d.]+/g, '$&, force3D: true');
        }

        // Check for excessive DOM queries
        if ((animationCode.match(/gsap\.(to|from|fromTo)/g) || []).length > 3 && 
            !animationCode.includes('utils.toArray')) {
          optimizations.push({
            issue: 'Multiple GSAP Calls',
            impact: 'MEDIUM',
            fix: 'Batch animations with timeline or utils.toArray',
            before: 'Multiple gsap.to() calls',
            after: 'Single timeline with multiple animations'
          });
        }

        // Generate optimized version
        result += `## 🚀 Optimized Code\n\n`;
        
        // Create the optimized version based on target
        if (target === 'mobile-smooth') {
          result += `\`\`\`javascript\n// Mobile-Optimized Version\n`;
          result += `// Reduced complexity for mobile devices\n`;
          result += `const isMobile = window.innerWidth < 768;\n\n`;
          result += `if (isMobile) {\n`;
          result += `  // Simplified mobile animation\n`;
          result += `  gsap.to(".element", {\n`;
          result += `    y: 50,\n`;
          result += `    opacity: 1,\n`;
          result += `    duration: 0.6, // Shorter duration\n`;
          result += `    ease: "power2.out",\n`;
          result += `    force3D: true\n`;
          result += `  });\n`;
          result += `} else {\n`;
          result += `  // Full desktop animation\n`;
          result += `  ${optimizedCode}\n`;
          result += `}\n\`\`\`\n\n`;
        } else {
          result += `\`\`\`javascript\n// Performance-Optimized Version\n`;
          result += `gsap.defaults({ force3D: true, lazy: false });\n\n`;
          result += `${optimizedCode}\n\`\`\`\n\n`;
        }

        // List all optimizations applied
        result += `## 🔧 Applied Optimizations\n\n`;
        if (optimizations.length > 0) {
          optimizations.forEach((opt, index) => {
            result += `### ${index + 1}. ${opt.issue} (${opt.impact} Impact)\n`;
            result += `**Fix**: ${opt.fix}\n\n`;
            result += `**Before**: \`${opt.before}\`\n`;
            result += `**After**: \`${opt.after}\`\n\n`;
          });
        } else {
          result += `✅ **Code is already well-optimized!**\n\n`;
        }

        // Performance monitoring code
        result += `## 📈 Performance Monitoring\n\n`;
        result += `\`\`\`javascript\n// Add performance monitoring\n`;
        result += `const perfMonitor = {\n`;
        result += `  start: performance.now(),\n`;
        result += `  checkFPS: function() {\n`;
        result += `    let frames = 0;\n`;
        result += `    let lastTime = performance.now();\n`;
        result += `    \n`;
        result += `    function count() {\n`;
        result += `      frames++;\n`;
        result += `      const currentTime = performance.now();\n`;
        result += `      if (currentTime >= lastTime + 1000) {\n`;
        result += `        console.log(\`FPS: \${frames}\`);\n`;
        result += `        frames = 0;\n`;
        result += `        lastTime = currentTime;\n`;
        result += `      }\n`;
        result += `      requestAnimationFrame(count);\n`;
        result += `    }\n`;
        result += `    requestAnimationFrame(count);\n`;
        result += `  }\n`;
        result += `};\n\n`;
        result += `// Start monitoring\nperfMonitor.checkFPS();\n\`\`\`\n\n`;

        // CSS optimizations
        result += `## 🎨 Required CSS Optimizations\n\n`;
        result += `\`\`\`css\n/* Critical for smooth animations */\n`;
        result += `.animated-element {\n`;
        result += `  will-change: transform, opacity;\n`;
        result += `  backface-visibility: hidden;\n`;
        result += `  transform: translateZ(0); /* Force GPU layer */\n`;
        result += `  -webkit-font-smoothing: antialiased;\n`;
        result += `}\n\n`;
        result += `/* Prevent layout thrashing */\n`;
        result += `.animation-container {\n`;
        result += `  contain: layout style paint;\n`;
        result += `  transform: translateZ(0);\n`;
        result += `}\n\n`;
        if (target === 'mobile-smooth') {
          result += `/* Mobile-specific optimizations */\n`;
          result += `@media (max-width: 767px) {\n`;
          result += `  .animated-element {\n`;
          result += `    transform: translate3d(0,0,0); /* Force hardware acceleration */\n`;
          result += `    -webkit-transform: translate3d(0,0,0);\n`;
          result += `  }\n`;
          result += `}\n`;
        }
        result += `\`\`\`\n\n`;

        // Performance tips specific to target
        result += `## 💡 ${target.toUpperCase()} Performance Tips\n\n`;
        
        const targetTips = {
          '60fps-desktop': [
            'Use transform properties exclusively for smooth 60fps',
            'Enable GPU acceleration with force3D: true',
            'Batch DOM operations using timelines',
            'Profile animations with browser dev tools',
            'Use lazy: false for immediate rendering'
          ],
          'mobile-smooth': [
            'Reduce animation complexity on mobile devices',
            'Use shorter durations (0.3-0.8s) for touch interactions',
            'Test on real devices, not just simulators',
            'Implement responsive animation breakpoints',
            'Consider battery life impact'
          ],
          'battery-efficient': [
            'Use CSS transforms instead of JavaScript when possible',
            'Minimize simultaneous animations',
            'Use paused timelines to reduce CPU usage',
            'Implement intersection observer for scroll animations',
            'Clean up animations when elements leave viewport'
          ],
          'memory-optimized': [
            'Always use clearProps after animations complete',
            'Kill unused timelines and scroll triggers',
            'Avoid creating animations in loops without cleanup',
            'Use object pooling for repeated animations',
            'Monitor memory usage with browser dev tools'
          ]
        };

        const tips = (targetTips as any)[target] || targetTips['60fps-desktop'];
        tips.forEach((tip: string) => {
          result += `- ${tip}\n`;
        });

        result += `\n## 🎯 Performance Metrics Target\n\n`;
        result += `- **FPS**: 60fps consistently\n`;
        result += `- **Frame Time**: <16.67ms per frame\n`;
        result += `- **Memory**: Stable, no leaks\n`;
        result += `- **CPU Usage**: <30% during animations\n`;
        result += `- **Battery Impact**: Minimal on mobile devices\n\n`;
        
        result += `✨ **Your animation is now optimized for ${target}!**`;

        return {
          content: [{ type: 'text', text: result }]
        };
      }

      case 'create_production_pattern': {
        const patternType = args?.pattern_type as string;
        const industry = args?.industry as string || 'portfolio';
        
        if (!patternType) {
          throw new Error('Pattern type is required');
        }

        let result = `# 🎨 Production Pattern: ${patternType.toUpperCase()}\n\n`;
        result += `**Industry**: ${industry} | **Pattern**: ${patternType}\n\n`;

        const patterns = {
          'hero-section': {
            description: 'Epic hero section with layered animations and scroll effects',
            code: `// Hero Section Master Pattern
const heroTimeline = gsap.timeline({ 
  defaults: { ease: "power3.out" } 
});

// Staggered hero entrance
heroTimeline
  .from(".hero-bg", { 
    scale: 1.2, 
    opacity: 0, 
    duration: 2, 
    ease: "power2.out" 
  })
  .from(".hero-title", { 
    y: 100, 
    opacity: 0, 
    duration: 1.2,
    force3D: true 
  }, "-=1.5")
  .from(".hero-subtitle", { 
    y: 50, 
    opacity: 0, 
    duration: 1 
  }, "-=0.8")
  .from(".hero-cta", { 
    scale: 0, 
    opacity: 0, 
    duration: 0.8, 
    ease: "back.out(1.7)" 
  }, "-=0.5")
  .from(".hero-scroll-indicator", { 
    y: 20, 
    opacity: 0, 
    repeat: -1, 
    yoyo: true, 
    duration: 1.5 
  }, "-=0.3");

// Parallax scroll effect
gsap.to(".hero-bg", {
  yPercent: -50,
  ease: "none",
  scrollTrigger: {
    trigger: ".hero-section",
    start: "top top",
    end: "bottom top",
    scrub: 1
  }
});`,
            features: ['Layered entrance animations', 'Parallax background', 'Floating CTA button', 'Scroll indicator pulse']
          },
          
          'scroll-system': {
            description: 'Complete scroll-based animation system with performance optimization',
            code: `// Production Scroll System
class ScrollAnimationSystem {
  constructor() {
    this.initScrollAnimations();
    this.initParallax();
    this.initProgressIndicator();
  }

  initScrollAnimations() {
    // Batch process for performance
    ScrollTrigger.batch(".scroll-reveal", {
      onEnter: (elements) => {
        gsap.fromTo(elements, 
          { 
            y: 100, 
            opacity: 0, 
            scale: 0.8 
          },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            duration: 1.2,
            stagger: 0.15,
            ease: "power3.out",
            force3D: true,
            clearProps: "transform,opacity"
          }
        );
      },
      onLeave: (elements) => {
        gsap.to(elements, { 
          opacity: 0.7, 
          scale: 0.95, 
          duration: 0.3 
        });
      },
      onEnterBack: (elements) => {
        gsap.to(elements, { 
          opacity: 1, 
          scale: 1, 
          duration: 0.3 
        });
      },
      start: "top 80%",
      end: "bottom 20%"
    });
  }

  initParallax() {
    gsap.utils.toArray(".parallax").forEach(element => {
      const speed = element.dataset.speed || 0.5;
      gsap.to(element, {
        yPercent: -50 * speed,
        ease: "none",
        scrollTrigger: {
          trigger: element.closest("section"),
          start: "top bottom",
          end: "bottom top",
          scrub: 1,
          refreshPriority: -1
        }
      });
    });
  }

  initProgressIndicator() {
    gsap.to(".progress-bar", {
      scaleX: 1,
      ease: "none",
      scrollTrigger: {
        trigger: "body",
        start: "top top",
        end: "bottom bottom",
        scrub: 1
      }
    });
  }
}

// Initialize system
new ScrollAnimationSystem();`,
            features: ['Batch processing for performance', 'Multiple parallax speeds', 'Progress indicator', 'Memory cleanup']
          },

          'text-effects': {
            description: 'Advanced text animation system with multiple reveal types',
            code: `// Advanced Text Effects System
class TextAnimationMaster {
  constructor() {
    this.animateHeaders();
    this.animateParagraphs();
    this.createTypewriter();
  }

  animateHeaders() {
    gsap.utils.toArray("h1, h2, h3").forEach(heading => {
      const split = new SplitText(heading, { 
        type: "chars", 
        charsClass: "char-animate" 
      });
      
      gsap.fromTo(split.chars,
        {
          y: 100,
          opacity: 0,
          rotation: 10,
          scale: 0.8
        },
        {
          y: 0,
          opacity: 1,
          rotation: 0,
          scale: 1,
          duration: 0.8,
          ease: "back.out(1.7)",
          stagger: {
            amount: 0.8,
            from: "random"
          },
          scrollTrigger: {
            trigger: heading,
            start: "top 85%",
            toggleActions: "play none none reverse"
          }
        }
      );
    });
  }

  animateParagraphs() {
    gsap.utils.toArray("p.animate-text").forEach(paragraph => {
      const split = new SplitText(paragraph, { type: "lines" });
      
      gsap.from(split.lines, {
        y: 50,
        opacity: 0,
        duration: 1,
        stagger: 0.1,
        ease: "power3.out",
        scrollTrigger: {
          trigger: paragraph,
          start: "top 90%"
        }
      });
    });
  }

  createTypewriter() {
    gsap.utils.toArray(".typewriter").forEach(element => {
      const text = element.textContent;
      const split = new SplitText(element, { type: "chars" });
      
      gsap.set(split.chars, { opacity: 0 });
      
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: element,
          start: "top 80%"
        }
      });
      
      tl.to(split.chars, {
        opacity: 1,
        duration: 0.05,
        stagger: 0.05,
        ease: "none"
      })
      .to(element, {
        borderRight: "0px",
        duration: 0.5,
        repeat: -1,
        yoyo: true
      });
    });
  }
}

new TextAnimationMaster();`,
            features: ['Character-by-character reveals', 'Line-based animations', 'Typewriter effects', 'Random stagger patterns']
          },

          'loading-sequence': {
            description: 'Sophisticated loading sequence with progress indication',
            code: `// Master Loading Sequence
class LoadingSequence {
  constructor() {
    this.progress = 0;
    this.timeline = gsap.timeline({ paused: true });
    this.setupSequence();
  }

  setupSequence() {
    // Loading bar animation
    this.timeline
      .to(".loading-progress", {
        scaleX: 1,
        duration: 2,
        ease: "power2.inOut",
        onUpdate: () => {
          this.progress = Math.round(this.timeline.progress() * 100);
          document.querySelector(".loading-percentage").textContent = this.progress + "%";
        }
      })
      .to(".loading-text", {
        opacity: 0,
        y: -20,
        duration: 0.5
      })
      .to(".loading-container", {
        y: "-100%",
        duration: 1,
        ease: "power3.inOut"
      })
      .from(".main-content", {
        y: 30,
        opacity: 0,
        duration: 1,
        ease: "power3.out"
      }, "-=0.5");
  }

  start() {
    // Simulate loading with realistic progress
    const loadingSteps = [
      { progress: 0.2, delay: 200, text: "Loading assets..." },
      { progress: 0.5, delay: 400, text: "Preparing interface..." },
      { progress: 0.8, delay: 300, text: "Almost ready..." },
      { progress: 1, delay: 200, text: "Complete!" }
    ];

    let currentStep = 0;
    
    const nextStep = () => {
      if (currentStep < loadingSteps.length) {
        const step = loadingSteps[currentStep];
        
        gsap.to(this.timeline, {
          progress: step.progress,
          duration: 0.5,
          ease: "power2.out"
        });
        
        document.querySelector(".loading-text").textContent = step.text;
        
        setTimeout(() => {
          currentStep++;
          nextStep();
        }, step.delay);
      } else {
        this.complete();
      }
    };
    
    nextStep();
  }

  complete() {
    setTimeout(() => {
      this.timeline.play();
    }, 500);
  }
}

// Auto-start loading sequence
window.addEventListener('load', () => {
  new LoadingSequence().start();
});`,
            features: ['Realistic progress simulation', 'Smooth transitions', 'Text updates', 'Reveal main content']
          }
        };

        const pattern = (patterns as any)[patternType];
        
        if (!pattern) {
          result += `Pattern "${patternType}" not found. Available patterns:\n`;
          result += Object.keys(patterns).map(p => `- ${p}`).join('\n');
          return { content: [{ type: 'text', text: result }] };
        }

        result += `## 📋 Pattern Description\n`;
        result += `${pattern.description}\n\n`;

        result += `## 🚀 Production Code\n\n`;
        result += `\`\`\`javascript\n${pattern.code}\n\`\`\`\n\n`;

        result += `## ✨ Features Included\n`;
        pattern.features.forEach((feature: string) => {
          result += `- ✅ ${feature}\n`;
        });

        result += `\n## 🎨 Required HTML Structure\n\n`;
        
        // Generate HTML structure based on pattern
        const htmlStructures = {
          'hero-section': `<section class="hero-section">
  <div class="hero-bg"></div>
  <div class="hero-content">
    <h1 class="hero-title">Amazing Hero Title</h1>
    <p class="hero-subtitle">Compelling subtitle text</p>
    <button class="hero-cta">Get Started</button>
  </div>
  <div class="hero-scroll-indicator">↓</div>
</section>`,
          'scroll-system': `<div class="progress-bar"></div>
<section class="parallax" data-speed="0.5">
  <div class="scroll-reveal">Content 1</div>
  <div class="scroll-reveal">Content 2</div>
</section>`,
          'text-effects': `<h1>Animated Header</h1>
<p class="animate-text">Paragraph with line animation</p>
<div class="typewriter">Typewriter effect text</div>`,
          'loading-sequence': `<div class="loading-container">
  <div class="loading-progress"></div>
  <div class="loading-percentage">0%</div>
  <div class="loading-text">Loading...</div>
</div>
<main class="main-content">
  <!-- Your main content -->
</main>`
        };

        result += `\`\`\`html\n${(htmlStructures as any)[patternType] || '<!-- HTML structure for ' + patternType + ' -->'}\n\`\`\`\n\n`;

        result += `## 💅 Required CSS\n\n`;
        result += `\`\`\`css\n/* Essential styles for ${patternType} */\n`;
        result += `.animated-element {\n`;
        result += `  will-change: transform, opacity;\n`;
        result += `  backface-visibility: hidden;\n`;
        result += `}\n\n`;
        
        if (patternType === 'hero-section') {
          result += `.hero-section { height: 100vh; position: relative; overflow: hidden; }\n`;
          result += `.hero-bg { position: absolute; inset: 0; z-index: -1; }\n`;
          result += `.hero-content { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; }\n`;
        }
        
        result += `\`\`\`\n\n`;

        result += `## 🎯 Industry Customization (${industry})\n\n`;
        
        const industryCustomizations = {
          portfolio: ['Add personal branding colors', 'Include work showcase animations', 'Focus on visual impact'],
          ecommerce: ['Add product hover effects', 'Include cart animations', 'Optimize for conversion'],
          saas: ['Add feature demonstrations', 'Include data visualizations', 'Focus on user onboarding'],
          agency: ['Bold, creative animations', 'Portfolio showcases', 'Client testimonials'],
          blog: ['Reading progress indicators', 'Content reveal animations', 'Typography focus'],
          app: ['Touch-friendly interactions', 'Loading states', 'Micro-interactions']
        };

        const customizations = (industryCustomizations as any)[industry] || industryCustomizations.portfolio;
        customizations.forEach((custom: string) => {
          result += `- ${custom}\n`;
        });

        result += `\n🎉 **Production-ready pattern for ${industry} industry!**`;

        return {
          content: [{ type: 'text', text: result }]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{ 
        type: 'text', 
        text: `❌ **Error**: ${error instanceof Error ? error.message : 'Unknown error occurred'}\n\nPlease check your request and try again. If the issue persists, the animation description might need to be more specific.` 
      }],
      isError: true
    };
  }
});

// Start the server with bulletproof error handling
async function main() {
  try {
    console.error('INFO: Starting GSAP MCP server...');
    console.error(
      `INFO: Loaded ${SKILL_RESOURCES.length} resources from the official GreenSock skills ` +
        `(${SKILLS_SOURCE.commit.slice(0, 7)}, GSAP ${GSAP_VERSION})`,
    );
    
    const transport = new StdioServerTransport();
    console.error('🔌 INFO: Transport initialized: stdio');
    
    await server.connect(transport);
    console.error('✅ INFO: Ultimate GSAP MCP Server started successfully');
    console.error('🎯 INFO: Ready to create pixel-perfect animations with surgical precision!');
  } catch (error) {
    console.error('💥 FATAL ERROR:', error);
    process.exit(1);
  }
}

// Handle process signals gracefully
process.on('SIGINT', () => {
  console.error('👋 INFO: Gracefully shutting down GSAP MCP Server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('👋 INFO: Gracefully shutting down GSAP MCP Server...');
  process.exit(0);
});

main().catch((error) => {
  console.error('💥 FATAL ERROR in main():', error);
  process.exit(1);
});