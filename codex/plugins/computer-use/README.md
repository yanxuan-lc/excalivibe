# computer-use

How to operate a computer. The capabilities in here let an agent reach past its own text output and
act on a real machine — and, just as importantly, work out what it is actually allowed to reach
before it starts.

| skill | what it settles |
|---|---|
| `graceful-browser` | which browser automation stack this session can really drive, and how to degrade out loud when the preferred one is missing |
| `mdx-artifact` | how to turn content into a document a person wants to read, and how to put it in front of them |
| `notify-user` | whether a moment is worth interrupting a human for, and how to reach them once the terminal has stopped being where they are looking |
| `install-computer-use` | what this machine still needs before any of the above works on it, and which of those changes the user has agreed to |

## Why these belong together

None of them is about *what* to do — they are about the machinery between an intention and an effect
on a real screen, or on a real person. A browser you cannot drive, a report nobody opens and a
result nobody hears about all fail the same way: the work happened and nothing landed.

## Bundled with the plugin

A `chrome-devtools` MCP server ships here, so `graceful-browser` always has a level 2 to degrade to
rather than depending on what the user happened to install. Its entry point reuses a debuggable
Chrome if one is running and launches one if not.

## Room left deliberately empty

"Using a computer" is wider than a browser, a document and a notification — the filesystem, the
terminal, the clipboard, screen capture all belong to the same question. Nothing has been invented
to fill those slots, because a skill written before there is a real task to check it against is a
liability, not coverage.

The same rule holds one level down. `notify-user` dispatches over a list of channels and exactly one
channel exists, because a webhook or chat integration written against an imagined account is a
channel nobody has ever watched a message arrive on. The dispatch list is real; the second entry has
to be earned.

This file is generated from `src/plugins/computer-use/README.md`. Do not edit it here.
