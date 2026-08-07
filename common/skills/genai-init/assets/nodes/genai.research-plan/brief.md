# Break the question into sub-questions, before any of them is answered

Each sub-question gets a line saying **what would answer it** — a source to read, a thing to run, a
number to measure. A sub-question whose answer nobody can describe in advance is a topic that
survived the previous step, and it should go back.

**Give each one a short slug** — `pricing`, `latency`, `data-retention`. Lowercase letters, digits,
`.`, `_`, `-`; no `..` and no leading `-`. Each sub-question becomes one probe running in parallel
with the others, and the slug is both that probe's name and the file it writes. A slug that does not
say which sub-question it is leaves the probe unable to tell what it was asked, and leaves the
reader with a directory of filenames that mean nothing.

The list is written down before the probing so that it can be reviewed. Questions chosen silently
while investigating cannot be — and they are the ones most shaped by what turned out to be easy to
find out.

Say which sub-questions you expect to be answerable from what is available, and which are a stretch.
That is what makes a `partial` result later readable as expected rather than as a failure.
