/**
 * One visual language for every build and verify script.
 *
 * The output is read by a human scanning for two things: did it pass, and if not, what do I do
 * about it. That only works if those two are *shaped* differently from the evidence between them.
 * They used to render identically — `make clean` printed its verdict and its follow-up advice as
 * three consecutive lines at the same weight, so the whole thing read as one undifferentiated
 * block and the eye had nowhere to land.
 *
 * So: three roles, three shapes, and nothing may mix them.
 *
 *   detail   indent 2, dim, glyph-prefixed    the per-file evidence — skimmable, truncatable
 *   result   column 0, coloured ✓ / ✗         the verdict, exactly one line, blank line above it
 *   next     column 0, dim →                  what the reader should do about it
 *
 * `✓` and `✗` belong to the verdict roles and nowhere else. An evidence line that also opened with
 * `✗` sat at the same indent, in the same colour, under the same glyph as the verdict summarising
 * it — so the one line worth reading first was the one hardest to pick out. Evidence gets a glyph
 * that says what *kind* of thing it is instead: `+` new · `~` changed · `−` gone · `?` unexplained.
 *
 * `step()` is the result form for a check running inside `make check`'s list, where the verdict is
 * one of several and the banner above it supplies the context a standalone run would need.
 *
 * Colour degrades on its own: piping to a file or a CI log strips it, and NO_COLOR is honoured
 * (https://no-color.org). Never emit an escape code outside this module.
 */

import { pathToFileURL } from 'node:url';

const useColor = process.env['NO_COLOR'] === undefined && process.env['TERM'] !== 'dumb' && process.stdout.isTTY === true;

const wrap = (code: string) => (s: string): string => (useColor ? `\u001b[${code}m${s}\u001b[0m` : s);

export const green = wrap('32');
export const red = wrap('31');
export const yellow = wrap('33');
export const dim = wrap('2');
export const bold = wrap('1');

/** A banner for a run made of several checks, so the indented steps below it have a subject. */
export function heading(text: string): void {
  console.log(`\n${bold(text)}`);
}

/** Evidence. Indented and dim so the eye skims it and stops on the verdict instead. */
export function detail(text: string, glyph = ' '): void {
  console.log(dim(`  ${glyph} ${text}`));
}

/**
 * A list of evidence lines, truncated at `limit` — long lists bury the verdict that follows, and
 * past a couple of dozen entries nobody is reading filenames anyway. The overflow line states the
 * total rather than the remainder, because "how big is this" is the question a truncated list
 * actually raises.
 */
export function list(items: readonly string[], glyph = ' ', limit = 20): void {
  for (const x of items.slice(0, limit)) detail(x, glyph);
  if (items.length > limit) detail(`… ${items.length - limit} more (${items.length} in total)`);
}

/** An explanatory paragraph attached to a failure — why this matters, not what to type next. */
export function note(text: string): void {
  console.log(dim(text.replace(/^/gm, '  ')));
}

/** The verdict of a standalone run. */
export function result(ok: boolean, text: string): void {
  console.log(`\n${ok ? green('✓') : red('✗')} ${text}`);
}

/** The verdict of one check inside a multi-check run — same vocabulary, subordinate position. */
export function step(ok: boolean, text: string): void {
  console.log(`  ${ok ? green('✓') : red('✗')} ${text}`);
}

/** What to do about it. Always last, always actionable — no explanation lives here. */
export function next(...lines: readonly string[]): void {
  console.log('');
  for (const l of lines) console.log(dim(`→ ${l}`));
}

/**
 * The same vocabulary as a CLI, so the Makefile can speak it too:
 *
 *   node scripts/ui.ts result "all checks passed"
 *
 * The Makefile has recipes that print — a banner, a verdict, install hints — and hand-rolling the
 * escape codes there would fork the palette *and* the TTY rule, since `printf` cannot tell whether
 * its output is a terminal or a redirected log. Routing through this module keeps one
 * implementation of both. `make` spawns a process per line, which is a few milliseconds against a
 * build that reads several hundred files.
 */
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [verb, ...rest] = process.argv.slice(2);
  const say: Record<string, (a: string[]) => void> = {
    heading: (a) => heading(a.join(' ')),
    detail: (a) => detail(a.join(' ')),
    step: (a) => step(true, a.join(' ')),
    result: (a) => result(true, a.join(' ')),
    fail: (a) => result(false, a.join(' ')),
    next: (a) => next(...a),
  };
  const fn = verb === undefined ? undefined : say[verb];
  if (!fn) {
    console.error(`ui.ts: unknown verb ${verb ?? '(none)'} — expected one of ${Object.keys(say).join(' | ')}`);
    process.exit(2);
  }
  fn(rest);
}
