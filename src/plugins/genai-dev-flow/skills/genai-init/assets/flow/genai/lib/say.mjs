// Every checker speaks the same way: one JSON object on stdout, `result` naming the label, the
// rest being the facts behind it. The label is read by the gate through `label_from: result`, and
// the whole object lands in the event log — so a rejection stays reconstructible after the working
// tree has moved on.
//
// Checkers always exit 0. A non-zero exit means the checker itself broke, which the engine reports
// separately as `failed`; keeping the two apart is the difference between "the artifact is wrong"
// and "the gate is wrong", and they have nothing in common to fix.

export function say(result, facts = {}) {
  process.stdout.write(JSON.stringify({ result, ...facts }));
  process.exit(0);
}

/** Bare value for a custom signature — those are read as a string, not as a verdict. */
export function emit(value) {
  process.stdout.write(String(value));
  process.exit(0);
}

/** `--flag value` pairs. Checkers take no positional options beyond the atom name itself. */
export function flags(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    out[token.slice(2)] = argv[i + 1];
  }
  return out;
}
