# File the batch away and consolidate what it settled

Move the batch's material out of the active tree and fold whatever it established into the
long-lived record. After this the batch is history and the active tree holds only what is still in
flight.

The idempotency key is the batch id — a resumed run has to be able to tell the batch was already
filed rather than filing it twice into different places.

Mark it `reversible: true`. Archived material can be brought back; that is why this is the last
step and not a gate anyone has to be nervous about.

A half-archived batch is worse than an unarchived one: part of it is where the next reader looks and
part of it is not. If it cannot be completed, report `failed` and leave the tree as it was.
