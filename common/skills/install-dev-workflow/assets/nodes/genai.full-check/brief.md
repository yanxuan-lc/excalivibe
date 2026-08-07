# Run the project's own checks on the integrated tree

The per-change stage ran the suite against each change alone. This runs it against all of them
together, which is the only place a conflict between two of them can show up.

Run what the project defines as its full check — the whole test suite and the static checks over the
whole tree, not a scoped subset. A scoped run answers the question the per-change stage already
answered.

Record the commit you ran against. The gate compares it: a result from before the last commit
describes a tree that will not ship, and it is rejected even though the report is present and says
it passed.

Report `blocked` when the checks could not run at all — that is an environment problem and a
different person fixes it than fixes a `failed`.
