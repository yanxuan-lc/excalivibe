---
name: grill
description: Use this when a request to build or change something is vague, under-specified, or stated as an outcome without the behavior — "let's build X", "add a way to do Y", "I want a thing that …", a feature idea with no acceptance criteria, a one-liner that hides several decisions. Trigger it whenever you are about to design or implement against a fuzzy ask and need to pin down what "done" actually means first. Also use to turn a rough product idea into a sharp behavioral brief before any spec or code.
---

# Grill — turn a vague request into a sharp behavioral brief

Grill is the interactive intent-input step. It takes a fuzzy ask and, through a short
Socratic conversation, produces a **`BRIEF.md`**: a precise, behavioral statement of what
to build — *current behavior / desired behavior / acceptance criteria / out-of-scope* —
that downstream design and implementation work can trust.

It does one thing: **sharpen intent into an observable contract.** It does not design the
solution, write a spec, or pick an implementation. It captures *what behavior the user
wants and how we will know it is met* — in the user's terms, not the system's internals.

## The core mechanic — Socratic, one question at a time, with a recommended answer

This is the rule that makes grill fast instead of an interrogation:

1. **Ask exactly one question at a time.** Never dump a questionnaire. Each answer
   reshapes the next question, so a batch would waste the user's attention on questions
   that the previous answer already settled. Walk down the branches of the decision tree,
   resolving dependencies between decisions one at a time — settle the question an answer
   unlocks before the questions that depend on it.
2. **Resolve by exploration before asking.** If a question can be answered by reading the
   codebase, the existing docs, or the glossary, do that *instead* of spending a user
   turn on it. Only ask the user what the code cannot tell you — intent, priorities,
   trade-offs, what "done" means. A question the repo already answers is a wasted
   question.
3. **Ship every question with your own recommended answer.** Do the thinking first:
   state the question, then *propose the answer you believe is right and why*, so the user
   **confirms or corrects** rather than authoring from a blank page. A good question reads
   like: "How should it behave when the input is empty — I'd recommend rejecting with a
   clear message rather than silently saving, because silent saves hide mistakes. Agree,
   or different?"
4. **Target the load-bearing unknowns only.** Ask about the decisions that change the
   acceptance criteria or the scope boundary — edge cases, who the user is, what "success"
   looks like, what is explicitly *not* in this change. Skip anything the request already
   makes clear, and skip implementation details (that is design's job, not intent's).
5. **Stop when the brief is sharp enough to act on.** The goal is a `BRIEF.md` whose
   acceptance criteria are unambiguous and testable — not maximal coverage. The moment the
   four sections are concrete and the user has confirmed the recommendations, emit and
   stop. Asking past that point is its own failure.

## Output — BRIEF.md (behavioral, not implementation)

Write a `BRIEF.md` to the location the caller gives, or `./BRIEF.md` by default. Four
fixed sections, all phrased as **observable behavior** — what a user or a test would see,
never how the code is structured:

- **Current behavior** — what happens today (for a new capability: "no such capability
  exists" / the closest current path the user takes).
- **Desired behavior** — what should happen instead, in concrete user-visible terms.
- **Acceptance criteria** — a checklist of conditions that must hold for this to be
  "done"; each one must be *testable* (a person or a test can decide pass/fail). Cover the
  edge cases the conversation surfaced, not just the happy path.
- **Out-of-scope** — what this change deliberately does *not* do. This is as important as
  the desired behavior; it is what stops scope creep and what tells design where the line
  is.

The full skeleton and a worked vague→sharp exchange are in
[references/brief-template.md](references/brief-template.md). Read it before your first
brief.

## Two depths — scale to how clear and how novel the request is

Grill is the same step at two intensities. Pick by reading **two things about the request
itself**: how clear it already is, and how new/central the core concept is. (A caller may
also pass an explicit depth hint — `light` or `deep` — in which case honor it.)

### Light — a clear, conventional request

The ask is mostly well-formed, or it is an ordinary kind of change the team has done
before (a generic CRUD screen, a small addition to an existing flow). Then:

- Confirm your understanding in **as few questions as possible — often zero.** If the
  request is already sharp, state the `BRIEF.md` you derived and ask the user to confirm
  it in one shot.
- Fill the four sections and emit. Do not manufacture questions to look thorough.

### Deep + binding — a new, central domain concept

The request introduces a concept that is **new to this product and core to what it does**
— a genuinely novel piece of the domain, not a variation on something that exists. Here
the brief carries more weight, so grill does more:

- **Run the full Socratic conversation** — more rounds, because the load-bearing unknowns
  are real and the wrong assumption here is expensive to undo later.
- **Frame the domain shape.** Establish the core nouns and their relationships in the
  user's language — what the key concepts *are*, what states they move through, what rules
  always hold. Capture this as a short domain-framing section in the `BRIEF.md` (above
  the four behavioral sections). This is intent, not design: *what the domain is*, not how
  it will be modeled in code.
- **Actively sharpen the language — don't just record it.** Framing the domain is an
  *active* interrogation, not passive transcription:
  - **Challenge conflicting or overloaded terms.** When the user's words clash with a term
    already in the project glossary (`CONTEXT.md`), or a word is doing double duty, surface it on the spot:
    "You said 'account' — do you mean the Customer or the User? Those are different things."
  - **Invent edge-case scenarios to stress-test the boundaries.** Probe each relationship
    with concrete what-ifs until the rules are unambiguous, rather than accepting the
    happy-path framing.
  - **Cross-check stated intent against the existing code.** If the code already does
    something that contradicts what the user just said, raise the contradiction: "The code
    cancels whole Orders, but you said partial cancellation is possible — which is right?"
- **Seed the glossary.** When you name a new core concept, record the term and its
  one-line meaning so that every later artifact uses the *same word for the same thing*.
  Add these terms to the project glossary file (`CONTEXT.md` at the project root, created
  if absent). Naming consistency from here on is machine-checked by the
  `glossary-conformance` skill — grill is where the canonical terms are first coined.
- **Treat the acceptance criteria as a committed contract.** "Binding" means the user is
  agreeing to these criteria as the definition of done for a load-bearing piece of the
  product — so be exact, get explicit confirmation, and do not leave a criterion fuzzy
  because "we'll figure it out later." For the core, later is too late.

## Boundaries — what grill does not do

- **No solution design.** Grill captures desired *behavior* and (for deep) the *domain
  shape* in user terms. It does not choose data structures, modules, APIs, or libraries —
  that is the design step downstream. If you catch yourself writing how, stop and write
  what.
- **No spec, no tests, no code.** The output is `BRIEF.md` (and, for deep, glossary seeds
  in `CONTEXT.md`). Nothing else.
- **One question at a time, always.** Even in deep mode, never front-load a wall of
  questions. The recommended-answer format is what keeps the user engaged round to round.
- **Honor the user's words.** The brief is the user's intent, sharpened — not your
  preferred product. When you recommend an answer and the user corrects it, the correction
  wins; record it.
