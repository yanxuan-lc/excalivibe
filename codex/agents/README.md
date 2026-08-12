# genai-dev-flow agents

Codex plugins cannot bundle agents, so these land here at the repository level instead of
inside the plugin. Copy the ones you need into `~/.codex/agents/`:

```bash
cp codex/agents/genai-*.toml ~/.codex/agents/
```

Claude users need none of this — the same agents ship inside the Claude plugin.

Eight roles, and the split between them is not organisational. **Each one has to run in a
context that did not produce what it is judging.** A spec author who accepts their own
requirements is checking work they already convinced themselves about; a developer who reviews
their own code is doing the same. That independence is the only thing these separations buy,
and it is the reason they cannot be collapsed.

The last two are one triangle: the suite is written by someone who never reads the implementation,
and it is executed by a third party who may edit neither side. Any two of those three roles held by
one agent and a green result stops being evidence.

| Agent | Reads | Produces |
|---|---|---|
| `genai-spec-writer` | a batch of requirements | specs and change proposals |
| `genai-spec-reviewer` | those specs, before any code | a verdict with evidence |
| `genai-developer` | approved specs | code and commits |
| `genai-code-reviewer` | specs and the diff | a verdict with evidence |
| `genai-e2e-author` | the spec's numbered scenarios, never the code | e2e tests and their manifest |
| `genai-e2e-runner` | that manifest, the running app, the database | the acceptance facts |
| `genai-doc-writer` | the code as it was actually written | the project's documentation, folded forward |
| `genai-requirement-checker` | the original requirements | whether anything was left behind |
