// The shape of a decision document. `DECISION.mdx` is the one artifact in this flow written for a
// person rather than for a model, and the only one whose failure mode is being *pleasant to read*:
// a document that explains the design well, all the way through, and asks nothing. The reader
// spends their attention, answers "looks fine to me", and the human step becomes theatre.
//
// So what is checked here is not coverage. It is whether the document asks anything, whether each
// question can be answered from what surrounds it, and whether the material in front of those
// questions stayed small enough that the reader reaches them.
//
// **Why anchors and not headings.** This document is written in the reader's language. A check
// cannot grep `## What you need to decide` in a document that might be in Japanese. So the checked
// structure rides on `genai:*` anchors placed above the free-text headings — the check reads the
// anchor, the reader reads the heading, and neither constrains the other. MDX rejects HTML
// comments, so they are written `{/* genai:arch.decisions */}`; nothing here depends on the comment
// syntax, only on the slug.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { genaiDir, openChanges } from "./changes.mjs";

export const DOC = "DECISION.mdx";

/**
 * How much may stand between the reader and the first thing they have to rule on.
 *
 * Completeness and readability genuinely conflict here, and asking for "brevity" settles nothing.
 * A ceiling does: whatever does not fit goes to the appendix, which is behind the decisions rather
 * than in front of them.
 */
export const BACKGROUND_MAX_LINES = 40;

const SECTION = { decisions: "arch.decisions", background: "arch.background", appendix: "arch.appendix" };
const ITEM = "decision";
const COST = "cost";

/**
 * Artifact paths the reader has never seen. Naming one is the single most common way this document
 * stops standing alone, and it is worth matching on the **path** rather than on phrasing: the
 * document is written in a language this check does not know, but a filename is a filename in all
 * of them.
 */
const INTERNAL = /(?:^|[^\w/.-])((?:proposal|design|tasks|spec-review|e2e-manifest|e2e-report)\.md|specs\/[\w./*-]*)/g;

const anchor = (slug) => new RegExp(`genai:${slug}(?![\\w.-])`);

/** The block a section anchor introduces, up to the next section anchor or the end. */
function section(body, slug) {
  const start = body.search(anchor(slug));
  if (start < 0) return null;
  const rest = body.slice(start);
  let end = rest.length;
  for (const other of Object.values(SECTION)) {
    // From index 1, so a section never terminates on its own opening anchor.
    const at = rest.slice(1).search(anchor(other));
    if (at >= 0 && at + 1 < end) end = at + 1;
  }
  return rest.slice(0, end);
}

/**
 * Read one document.
 *
 * @returns {{decisions: number, problems: {kind: string, at: string, detail: string}[]}}
 */
export function inspect(text) {
  const problems = [];
  const body = text.replace(/^---\n[\s\S]*?\n---\n/, "");

  const decisions = section(body, SECTION.decisions);
  // **An item is delimited by its own anchor, never by the `###` heading.** Splitting on the
  // heading drops each anchor into the preceding chunk, because an author puts it above the
  // heading where it stays out of the reader's way.
  const items = decisions === null ? [] : decisions.split(new RegExp(`genai:${ITEM}(?![\\w.-])`)).slice(1);

  if (decisions === null) {
    problems.push({
      kind: "no_decisions",
      at: SECTION.decisions,
      detail: "the decisions section is not there — mark it `genai:arch.decisions`",
    });
  } else if (items.length === 0) {
    problems.push({
      kind: "no_decisions",
      at: SECTION.decisions,
      detail: "the section is there and empty — mark each item `genai:decision recommend=A`",
    });
  }

  items.forEach((item, index) => {
    // The heading names the item where one exists — it already carries the author's own numbering,
    // and a second one beside it reads as two different items.
    const heading = /^###\s+(.+)$/m.exec(item)?.[1]?.trim();
    const at = heading === undefined ? `item ${index + 1}` : heading.slice(0, 60);
    const incomplete = (detail) => problems.push({ kind: "decision_incomplete", at, detail });

    if (heading === undefined) incomplete("no `###` heading, so the reader has no question to answer");

    // `A.` through `D.`. The separator class carries the full-width ideographic comma (U+3001) and
    // colon (U+FF1A) as escapes: a document written in Chinese or Japanese labels its options with
    // those, and a class holding only ASCII punctuation would report every one of its items as
    // having no options at all. Escapes rather than literals because this corpus stays English.
    const options = [...item.matchAll(/^\s*[-*]?\s*([A-Z])[.:\u3001\uFF1A]/gm)].map((m) => m[1]);
    if (options.length < 2) incomplete(`${options.length} option(s) — an item needs at least two, as \`A.\` / \`B.\` lines`);

    const recommended = /\brecommend=["']?([A-Za-z0-9_-]+)/.exec(item.split("\n")[0])?.[1];
    if (recommended === undefined) {
      // A bare multiple-choice hands the design work back to the reader, who has less context than
      // whoever wrote it. Recommending is not deciding for them; it is showing your work.
      incomplete("no recommendation — mark the item `genai:decision recommend=A`");
    } else if (options.length > 0 && !options.includes(recommended)) {
      incomplete(`recommends "${recommended}", which is not one of its options (${options.join(", ")})`);
    }

    if (!anchor(COST).test(item)) incomplete("no cost of the wrong choice — mark it `genai:cost`; without it there is nothing to weigh");
  });

  // The background section is optional and only its ceiling is checked. A change small enough to
  // need no preamble is a real case, and the failure this guards against is the opposite one:
  // material piled in front of the questions until the reader never reaches them.
  const background = section(body, SECTION.background);
  if (background !== null) {
    const lines = background.trim().split("\n").length;
    if (lines > BACKGROUND_MAX_LINES) {
      problems.push({
        kind: "background_over_ceiling",
        at: SECTION.background,
        detail: `${lines} lines against a ceiling of ${BACKGROUND_MAX_LINES} — move the detail behind the decisions, into the appendix`,
      });
    }
  }

  for (const match of body.matchAll(INTERNAL)) {
    problems.push({
      kind: "external_reference",
      at: match[1],
      detail: "the reader has not seen that file; say the thing here instead of pointing at it",
    });
  }

  return { decisions: items.length, problems };
}

/**
 * Every decision document in the round.
 *
 * A change with nothing to rule on legitimately has no document — manufacturing a "please confirm"
 * for it spends a person's attention and makes the step look effective, which is worse than
 * leaving it out. So an absent document is not a finding here; whether the round covered what it
 * should is the executor's own report, and `outputs_present` is what keeps the round from
 * producing none at all.
 */
export function judgeDocs() {
  const open = openChanges();
  if (open === null) return { label: "unreadable", facts: { reason: "openspec/changes/ is not there" } };

  const found = [];
  const problems = [];
  for (const change of open) {
    const path = join(genaiDir(change), DOC);
    if (!existsSync(path)) continue;
    found.push(change);
    let text;
    try {
      text = readFileSync(path, "utf8");
    } catch (cause) {
      return { label: "unreadable", facts: { path, reason: String(cause?.message ?? cause) } };
    }
    const { decisions, problems: own } = inspect(text);
    for (const problem of own) problems.push({ change, decisions, ...problem });
  }

  const facts = { documents: found, without: open.filter((c) => !found.includes(c)), problems };
  if (problems.length === 0) return { label: "complete", facts };

  // One label per run, and the worst-named one wins — but every problem travels in the facts, so a
  // rewrite fixes the document once instead of discovering the next objection on the next attempt.
  for (const kind of ["no_decisions", "decision_incomplete", "external_reference", "background_over_ceiling"]) {
    if (problems.some((problem) => problem.kind === kind)) return { label: kind, facts };
  }
  return { label: "complete", facts };
}
