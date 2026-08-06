# computer-use

How to operate a computer. The capabilities in here let an agent reach past its own text output and
act on a real machine — and, just as importantly, work out what it is actually allowed to reach
before it starts.

| skill | what it settles |
|---|---|
| `graceful-browser` | which browser automation stack this session can really drive, and how to degrade out loud when the preferred one is missing |
| `mdx-artifact` | how to turn content into a document a person wants to read, and how to put it in front of them |

## Why these two belong together

Neither is about *what* to do — they are about the machinery between an intention and an effect on a
real screen. A browser you cannot drive and a report nobody opens fail the same way: the work
happened and nothing landed.

## Bundled MCP

A `chrome-devtools` MCP server ships with this plugin, so `graceful-browser` always has a level 2 to
degrade to rather than depending on what the user happened to install. Its entry point reuses a
debuggable Chrome if one is running and launches one if not.

## Room left deliberately empty

"Using a computer" is wider than a browser and a document — the filesystem, the terminal, the
clipboard, screen capture all belong to the same question. Nothing has been invented to fill those
slots, because a skill written before there is a real task to check it against is a liability, not
coverage.

This file is generated from `src/plugins/computer-use/README.md`. Do not edit it here.
