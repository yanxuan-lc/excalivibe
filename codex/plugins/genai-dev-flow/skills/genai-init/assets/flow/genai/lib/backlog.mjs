// The requirements directory, and the one place that knows where it is.
//
// It is a SIBLING of the repository, named `<repository-directory-name>_genai`. Gate commands
// receive no graph variables, so the location has to be derived from the working directory — and
// deriving it in four separate inline shell snippets is how a convention quietly becomes four
// conventions. This module is the single definition.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";

export function backlogRoot() {
  const project = process.cwd();
  return resolve(project, "..", `${basename(project)}_genai`);
}

/** Item directories under backlogs/, or null when the requirements directory is not there. */
export function items() {
  const dir = join(backlogRoot(), "backlogs");
  if (!existsSync(dir)) return null;
  const out = [];
  for (const id of readdirSync(dir)) {
    const brief = join(dir, id, "brief.md");
    if (!existsSync(brief)) continue;
    out.push({ id, brief, status: statusOf(readFileSync(brief, "utf8")) });
  }
  return out;
}

/** Names under archive/, sorted. Null when the requirements directory is not there. */
export function archived() {
  const dir = join(backlogRoot(), "archive");
  if (!existsSync(dir)) return null;
  return readdirSync(dir)
    .filter((name) => statSync(join(dir, name)).isDirectory())
    .sort();
}

// The state lives in the item's own frontmatter rather than in a shared list, so two sessions
// claiming different items never write the same file.
function statusOf(text) {
  const match = /^status:\s*(\S+)\s*$/m.exec(text);
  return match === null ? null : match[1];
}
