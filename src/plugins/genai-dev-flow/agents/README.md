# genai-dev-flow agents

Codex plugins cannot bundle agents, so these land here at the repository level instead of
inside the plugin. Copy the ones you need into `~/.codex/agents/`:

```bash
cp codex/agents/genai-*.toml ~/.codex/agents/
```

Claude users need none of this — the same agents ship inside the Claude plugin.

Four roles, and the split between them is not organisational. **Each one has to run in a
context that did not produce what it is judging.** A spec author who accepts their own
requirements is checking work they already convinced themselves about; a developer who reviews
their own code is doing the same. That independence is the only thing these separations buy,
and it is the reason they cannot be collapsed.

| Agent | Reads | Produces |
|---|---|---|
| `genai-spec-writer` | a batch of requirements | specs and change proposals |
| `genai-developer` | approved specs | code and commits |
| `genai-code-reviewer` | specs and the diff | a verdict with evidence |
| `genai-requirement-checker` | the original requirements | whether anything was left behind |
