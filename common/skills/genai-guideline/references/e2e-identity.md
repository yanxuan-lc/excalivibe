# Writing `tools/genai/e2e.json`

How the app-identity declaration is shaped, and which markers hold up. The skill body carries why
the file exists, who owns it and when it is due; this is what to write in it.

## Two shapes, and exactly one of them per project

`url` for anything that listens — plus `status` when the endpoint does not answer 200. `command` for
everything that never will: a CLI, a library, a batch job. The argument is the same with the nouns
changed — a binary on PATH proves nothing about *which* build answered — so a `command` is judged on
whether the marker appears in its output, not on its exit code (`--version` exits 0, `--help` often
exits 2), and both streams are read because plenty of tools print their banner to stderr. Declaring
both is refused: two ways to identify one app is two things that can disagree.

**The second shape is not a convenience.** `genai.merge` premises on `genai.e2e`, which refuses to
**start** without an identified app — so before `command` existed, a project with no HTTP surface
could complete every other step of a round and never merge. A shape this check cannot express is a
shape that cannot ship.

## Several faces

**A project with more than one face declares `targets`** — a list of exactly the shape above, each
entry carrying its own `name`, and never alongside a top-level `url`/`command`. A browser client and
the API behind it, a CLI and the server it talks to: one target cannot say that, and picking
whichever face the round happened to touch checks the wrong thing on the next round. The list is a
**conjunction** — every target has to be identified — so it is strictly stronger than a single one
and there is nothing in it to loosen. At most four, because each gets its own five-second window and
a longer probe outlasts the rule's own timeout, which comes back as "the step definitions are
buggy".

One refusal describes every face at once (`web` up, `api` answering as the wrong build, `cli` not
started), because nothing short-circuits. When faces disagree, `wrong_service` is reported over
`unreachable`: not being up is the ordinary state and is fixed by starting something, while
something else on the port is the one that wastes a second attempt if it stays hidden behind the
first.

## Choosing the marker

A marker earns its place by being **specific to this service**: the service name from a health
payload, the title a known route renders, a route only this build serves. `ok`, `healthy` and `200`
are not markers; every other process on the machine says those too.

**Not the version string** — the wrong answer that looks most like a right one. `genai.release`
moves it after the round's last acceptance run, so from the next round on the marker names a version
the build no longer reports and `genai.e2e` refuses with `wrong_service` — which that round cannot
repair, since this file is the owner's. Pick something a release does not move.
