# Produce the document a person signs

Compose **`dev-workflow:review-doc`** — the decision-first structure, the three sections, the
anchors, and the three hard requirements.

One point is worth repeating here because it decides whether this step should run at all: **if
there is genuinely nothing for a person to rule on, produce nothing and say so.** A manufactured
choice spends someone's attention and makes the review look effective, which is worse than having
no review.

Regenerate this after every revision of the design. The gate compares signatures, so a design that
moved without this being regenerated is caught rather than quietly approved.

## Upstream artifacts

{{inputs}}
{{rejection}}
