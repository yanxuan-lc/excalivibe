# Pin down what this change is for

Compose **`dev-toolkit:grill`**: one question at a time, each carrying your own recommended
answer, and nothing asked that reading the code would have answered.

This step runs as the main agent rather than a subagent for a structural reason — it is a
conversation with the user, and a subagent cannot talk to one.

Record what the change is for, what done looks like, and what is explicitly out of scope. If the
request is already precise, say so and skip the questioning: asking about what is already settled
spends attention and returns nothing.

When the conversation settles on a name for a concept this project has not had before, append the
term and a one-line meaning to the bounded context's `CONTEXT.md`, creating the file if it is
absent. That file is where every later step and check looks up the agreed word, and this is the only
moment the concept is being named — afterwards it is already spreading through spec, tests and code
under whatever spelling arrived first.
