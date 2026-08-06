---
name: grill
description: Pin down a vague request before acting on it, through a short Socratic exchange — one question at a time, each shipped with your own recommended answer, and nothing asked that could have been answered by looking. Use whenever a request is under-specified, stated as an outcome with no behavior attached, or hiding several decisions inside one line — "let's build X", "add a way to do Y", "make this better", "handle the edge cases", a feature idea with no notion of done. Reach for it before designing or implementing against a fuzzy ask, since the cost of guessing wrong compounds through everything built on top. Not for a request that is already precise, and not a substitute for reading the code.
---

# Grill — sharpen a vague request before building on it

A fuzzy ask does not stay fuzzy. It gets resolved — by you, silently, with assumptions the person
never saw and would not have chosen. Then the work is built on those assumptions, and the correction
arrives after it is expensive.

This skill front-loads that resolution into a short exchange. It does one thing: **turn an
under-specified request into a statement of observable behavior that both sides recognize.** It does
not design the solution, choose an implementation, or start building.

## The mechanic

Four rules. They are what make this fast instead of an interrogation, and the reasoning behind each
matters more than the rule itself.

### 1. One question at a time

Never send a questionnaire. Each answer reshapes what is worth asking next, so a batch spends the
person's attention on questions the first answer already settled — and worse, it hands them the job
of sorting out which ones still apply. Walk down the decision tree, resolving what an answer unlocks
before the things that depend on it.

### 2. Resolve by exploration before asking

If the codebase, the existing docs, the config, or the commit history can answer it, go look. A
question the repo already answers is not diligence; it is offloading your work onto the person who
asked for help. Spend their turns only on what the artifacts genuinely cannot tell you — intent,
priorities, trade-offs, and what "done" means to them.

### 3. Every question carries your recommended answer

Do the thinking first. State the question, then propose the answer you believe is right **and why**,
so the reply is a confirmation or a correction rather than an essay from a blank page. This is the
highest-leverage rule here — it turns an open-ended interview into a review, which is far cheaper
for the person and far more likely to surface a real disagreement, because it is easier to object to
a specific proposal than to fill in a void.

A good question reads like:

> When the input is empty, I'd reject it with a clear message rather than saving silently — a silent
> save hides the mistake until much later. Agree, or would you rather it saved a blank?

Not like:

> How should empty input be handled?

### 4. Stop when it is sharp enough to act on

The target is a request you could hand to someone else without them having to guess. Not maximal
coverage — that is a different failure, and asking past the point of sharpness burns goodwill you
will want later in the same task. When the behavior is concrete and the boundaries are agreed, say
what you now understand and move.

## What to aim the questions at

Ask about the decisions that would change what gets built, or change how you would know it worked:

- **What "done" looks like** — the observable conditions that decide whether this succeeded. If you
  cannot describe how to check it, the request is still fuzzy.
- **The edges** — empty, missing, duplicate, concurrent, too large, already exists, permission
  denied. Most under-specification lives here, and most rework comes from it.
- **Who this is for** — the same feature is built differently for an internal operator and a public
  user.
- **What is explicitly out** — the boundary is as load-bearing as the goal. It is what stops scope
  creep, and it is the thing people most often leave unsaid, because it feels obvious from inside
  their own head.

Skip anything the request already makes clear, and skip implementation detail. How to build it is a
separate question, and pulling it in here makes the exchange longer while leaving the intent no
sharper.

## Sharpen the language, do not just record it

When the request introduces a concept that is new or central, transcription is not enough:

- **Challenge overloaded terms.** When a word is doing double duty, or clashes with a term the
  project already uses for something else, surface it on the spot — "you said *account*; do you mean
  the customer or the login? Those behave differently."
- **Stress-test with concrete scenarios.** Invent specific what-ifs and walk them through until the
  rule is unambiguous. Happy-path framing hides exactly the cases that break later.
- **Cross-check against the code.** If what the code does today contradicts what was just said,
  raise it — "the code cancels whole orders, but you described partial cancellation; which is
  right?" A contradiction found now is a conversation; found later it is a rewrite.
- **Fix the word once.** When a concept gets named, use that name consistently from then on, and say
  that you are doing so. Two words for one thing is how a shared understanding quietly stops being
  shared.

## Depth — scale to the request, not to a template

Same mechanic at two intensities. Read the request for two things: how clear it already is, and how
novel the core concept is.

**Light.** The ask is mostly well-formed, or it is an ordinary change of a kind this project has
done before. Confirm in as few questions as possible, often zero — state the understanding you
derived and ask for a yes in one shot. Manufacturing questions to look thorough is its own failure
mode, and an experienced person spots it immediately.

**Deep.** The request introduces a concept that is new to this product and central to what it does.
Now the exchange earns more rounds, because the load-bearing unknowns are real and a wrong
assumption here is expensive to undo. Establish what the core things *are* and how they relate, in
the person's own language, before touching behavior. Get explicit agreement on what "done" means
rather than leaving a criterion vague on the grounds that it can be settled later — for the core,
later is too late.

## Boundaries

- **No solution design.** Capture desired behavior, not data structures, modules, APIs or libraries.
  If you catch yourself writing *how*, stop and write *what*.
- **No building.** This skill ends when the request is sharp. What happens next is a separate
  decision, and taking it unilaterally throws away the confirmation you just spent turns earning.
- **The correction always wins.** You recommend, they decide. When your recommended answer is
  overruled, record theirs and move on without relitigating — the point of recommending was to make
  disagreement cheap to express, and arguing with it defeats the whole mechanism.
