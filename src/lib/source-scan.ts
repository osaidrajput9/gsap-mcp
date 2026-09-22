/**
 * Lexical helpers for scanning GSAP source without a full parser.
 *
 * The important property here is that comments are blanked before any pattern
 * runs, so a rule about `top:` cannot fire on the words in a code comment.
 * String *contents* are deliberately kept, because several checks depend on
 * them (`ease: "none"`, `toggleActions: "play none none reverse"`).
 */

export interface Position {
  /** 1-based. */
  line: number;
  /** 1-based. */
  column: number;
}

/**
 * Replaces the body of every comment with spaces, preserving length and line
 * breaks so offsets still map to the original source. Strings are tracked only
 * so that `//` inside one is not mistaken for a comment.
 */
export function blankComments(source: string): string {
  const out = source.split('');
  let i = 0;

  const blank = (from: number, to: number) => {
    for (let j = from; j < to && j < out.length; j += 1) {
      if (out[j] !== '\n' && out[j] !== '\r') out[j] = ' ';
    }
  };

  while (i < source.length) {
    const char = source[i];
    const next = source[i + 1];

    // `//` preceded by a colon is a URL scheme (https://), not a comment.
    // Blanking there would hide whatever followed on the same line.
    if (char === '/' && next === '/' && source[i - 1] !== ':') {
      const end = source.indexOf('\n', i);
      blank(i, end === -1 ? source.length : end);
      i = end === -1 ? source.length : end;
      continue;
    }

    if (char === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end === -1 ? source.length : end + 2;
      blank(i, stop);
      i = stop;
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      const quote = char;
      i += 1;
      while (i < source.length) {
        if (source[i] === '\\') {
          i += 2;
          continue;
        }
        if (source[i] === quote) {
          i += 1;
          break;
        }
        // A template literal's ${} may contain anything, including comments;
        // stopping at the closing backtick is close enough for these checks.
        i += 1;
      }
      continue;
    }

    i += 1;
  }

  return out.join('');
}

/** Maps byte offsets to line/column, built once per document. */
export class LineIndex {
  private readonly starts: number[] = [0];

  constructor(private readonly source: string) {
    for (let i = 0; i < source.length; i += 1) {
      if (source[i] === '\n') this.starts.push(i + 1);
    }
  }

  positionAt(offset: number): Position {
    let low = 0;
    let high = this.starts.length - 1;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (this.starts[mid] <= offset) low = mid;
      else high = mid - 1;
    }
    return { line: low + 1, column: offset - this.starts[low] + 1 };
  }

  /** The full text of the line containing `offset`, trimmed. */
  lineAt(offset: number): string {
    const { line } = this.positionAt(offset);
    const start = this.starts[line - 1];
    const end = this.starts[line] ?? this.source.length + 1;
    return this.source.slice(start, end - 1).replace(/\r$/, '').trim();
  }
}

export interface CallRange {
  /** Callee text as written, e.g. "gsap.to" or "tl.from". */
  callee: string;
  /** Offset of the first character of the callee. */
  start: number;
  /** Offset just after the opening paren. */
  argsStart: number;
  /** Offset of the matching closing paren. */
  argsEnd: number;
}

/**
 * Finds calls whose callee matches `pattern`, and the span of their arguments,
 * by matching parentheses. `pattern` must be sticky-safe and capture the
 * callee in group 1.
 */
export function findCalls(sanitized: string, pattern: RegExp): CallRange[] {
  const calls: CallRange[] = [];
  const regex = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);

  for (const match of sanitized.matchAll(regex)) {
    const start = match.index ?? 0;
    const open = sanitized.indexOf('(', start + match[0].length - 1);
    if (open === -1) continue;

    const close = matchParen(sanitized, open);
    if (close === -1) continue;

    calls.push({
      callee: (match[1] ?? match[0]).trim(),
      start,
      argsStart: open + 1,
      argsEnd: close,
    });
  }

  return calls;
}

/** Index of the paren/brace matching the opener at `open`, or -1. */
export function matchParen(source: string, open: number): number {
  const opener = source[open];
  const closer = opener === '(' ? ')' : opener === '{' ? '}' : opener === '[' ? ']' : '';
  if (!closer) return -1;

  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    const char = source[i];
    if (char === '(' || char === '{' || char === '[') depth += 1;
    else if (char === ')' || char === '}' || char === ']') {
      depth -= 1;
      if (depth === 0) return source[i] === closer ? i : -1;
    }
  }
  return -1;
}

export interface PropertyHit {
  key: string;
  /** Offset of the key. */
  offset: number;
  /** Raw text of the value, up to the next comma at the same depth. */
  value: string;
}

/**
 * Finds `key: value` pairs between `from` and `to`. Keys nested inside a
 * skipped object (see `skipKeys`) are not returned, which is how a check can
 * look at a tween's own vars without picking up its `scrollTrigger: { ... }`.
 */
export function findProperties(
  sanitized: string,
  from: number,
  to: number,
  options: { skipKeys?: string[] } = {},
): PropertyHit[] {
  const hits: PropertyHit[] = [];
  const skip = new Set(options.skipKeys ?? []);
  const region = sanitized.slice(from, to);
  const keyPattern = /(?<![A-Za-z0-9_$."'])([A-Za-z_$][A-Za-z0-9_$]*)\s*:/g;

  const skipped: Array<[number, number]> = [];

  for (const match of region.matchAll(keyPattern)) {
    const localOffset = match.index ?? 0;
    const absolute = from + localOffset;

    if (skipped.some(([a, b]) => absolute > a && absolute < b)) continue;

    const key = match[1];
    const valueStart = from + localOffset + match[0].length;
    const value = readValue(sanitized, valueStart, to);

    if (skip.has(key)) {
      const objectStart = sanitized.indexOf('{', valueStart);
      if (objectStart !== -1 && objectStart < valueStart + 8) {
        const objectEnd = matchParen(sanitized, objectStart);
        if (objectEnd !== -1) skipped.push([objectStart, objectEnd]);
      }
      continue;
    }

    hits.push({ key, offset: absolute, value: value.trim() });
  }

  return hits;
}

/** Reads a property value up to the next comma or closer at the same depth. */
function readValue(source: string, start: number, limit: number): string {
  let depth = 0;
  for (let i = start; i < limit && i < source.length; i += 1) {
    const char = source[i];
    if (char === '(' || char === '{' || char === '[') depth += 1;
    else if (char === ')' || char === '}' || char === ']') {
      if (depth === 0) return source.slice(start, i);
      depth -= 1;
    } else if (char === ',' && depth === 0) {
      return source.slice(start, i);
    }
  }
  return source.slice(start, Math.min(limit, source.length));
}

/** True when `term` appears in `text` as a whole identifier. */
export function hasIdentifier(text: string, term: string): boolean {
  return new RegExp(
    `(?<![A-Za-z0-9_$])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9_$])`,
  ).test(text);
}
