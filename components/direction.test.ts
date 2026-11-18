// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The UI is also in a language that reads right to left. A class that names a
 * physical side (left, right) then puts a margin, a padding, a border, or a
 * position on the wrong side. Use the logical class: `ms-`, `me-`, `ps-`,
 * `pe-`, `start-`, `end-`, `text-start`, `text-end`, `border-s`, `border-e`,
 * `rounded-s`, `rounded-e`, `rounded-ss`, `rounded-se`, `rounded-es`, `rounded-ee`.
 */
const ROOT = fileURLToPath(new URL('..', import.meta.url));

// Optional variants (md:, print:, hover:, rtl: ...), an optional "!" and "-", then the utility.
const PHYSICAL =
  /^(?:[a-z0-9-]+:)*!?-?(?:(?:scroll-)?[mp][lr]-|left-|right-|text-(?:left|right)$|border-[lr](?:$|-)|rounded-(?:[lr]|[tb][lr])(?:$|-)|float-(?:left|right)$|clear-(?:left|right)$)/;

/**
 * Physical classes that stay. Each entry needs a reason: the position is a
 * coordinate, not a side of the layout, or it is the same in both directions.
 */
const ALLOWED: readonly { file: string; className: string; reason: string }[] = [
  // `left-1/2 -translate-x-1/2` centers an element. The result is the same in both directions.
  { file: '*', className: 'left-1/2', reason: 'centering' },
];

function sourceFiles(): string[] {
  const components = readdirSync(join(ROOT, 'components'))
    .filter((name) => name.endsWith('.tsx') && !name.endsWith('.test.tsx') && name !== 'test-utils.tsx')
    .map((name) => join('components', name));
  return ['App.tsx', ...components];
}

/** Each class name that names a physical side, with its file. */
function physicalClasses(file: string, source: string): string[] {
  const found: string[] = [];
  // Class names are in strings and template literals. Split on the characters that cannot be in a class name.
  for (const token of source.split(/[\s"'`{}()<>,;=]+/)) {
    if (!PHYSICAL.test(token)) continue;
    const allowed = ALLOWED.some((entry) => (entry.file === '*' || entry.file === file) && token.replace(/^(?:[a-z0-9-]+:)*!?-?/, '') === entry.className);
    if (!allowed) found.push(token);
  }
  return found;
}

describe('layout direction', () => {
  it('finds a physical class, also with a variant or a minus sign', () => {
    const source = 'className="ml-4 md:pr-2 -left-3 print:text-right border-l rounded-tl-xl !mr-1 hover:rounded-r-lg"';
    expect(physicalClasses('x.tsx', source)).toEqual(['ml-4', 'md:pr-2', '-left-3', 'print:text-right', 'border-l', 'rounded-tl-xl', '!mr-1', 'hover:rounded-r-lg']);
  });

  it('accepts the logical classes and words that are not classes', () => {
    const source =
      'className="ms-4 me-2 ps-5 pe-1 start-3 end-0 text-start text-end border-s border-e rounded-s-xl rounded-ee px-4 mx-auto left-1/2 border-slate-200 rounded-lg" style={{ left: bounds.left }} // left right';
    expect(physicalClasses('x.tsx', source)).toEqual([]);
  });

  it('uses no class that names a physical side in the app and the components', () => {
    const problems = sourceFiles().flatMap((file) =>
      physicalClasses(file, readFileSync(join(ROOT, file), 'utf8')).map((className) => `${file}: ${className}`),
    );
    expect(problems).toEqual([]);
  });
});
