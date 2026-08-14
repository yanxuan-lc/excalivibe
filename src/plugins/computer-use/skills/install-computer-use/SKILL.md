---
name: install-computer-use
description: Settle what this machine still needs before the computer-use capabilities actually work on it, and put those pieces in place with the user's agreement. Reach for it on "set up computer-use", "初始化一下", "装一下依赖", "enable the finish notification", "turn on the turn-end notification", "开启完成通知", "why is mdxv not found", "the browser stack is missing" — and whenever a capability here reports a prerequisite that lives outside the plugin, since the plugin directory is read-only to itself and everything it needs is somewhere else on the machine. It also carries the one consent this plugin will not assume, because notifications that fire on their own ship switched off and this is where they get switched on. Its subject is the machine — the binaries, the permissions, the one consent — while installing or updating the plugin itself is the host's own plugin command.
description-claude: Settle what this machine still needs before the computer-use capabilities actually work on it, and put those pieces in place with the user's agreement. Reach for it on "set up computer-use", "初始化一下", "装一下依赖", "enable the finish notification", "turn on the turn-end notification", "开启完成通知", "why is mdxv not found", "the browser stack is missing" — and whenever a capability here reports a prerequisite that lives outside the plugin, since the plugin directory is read-only to itself and everything it needs is somewhere else on the machine. It also carries the one consent this plugin will not assume, because notifications that fire on their own ship switched off and this is where they get switched on. Its subject is the machine — the binaries, the permissions, the one consent — while installing or updating the plugin itself is the host's own plugin command.
description-codex: Settle what this machine still needs before the computer-use capabilities actually work on it, and put those pieces in place with the user's agreement. Reach for it on "set up computer-use", "初始化一下", "装一下依赖", "enable the finish notification", "turn on the turn-end notification", "开启完成通知", "why is mdxv not found", "the browser stack is missing" — and whenever a capability here reports a prerequisite that lives outside the plugin, since the plugin directory is read-only to itself and everything it needs is somewhere else on the machine. It also carries the one consent this plugin will not assume, because notifications that fire on their own ship switched off and this is where they get switched on. Its subject is the machine — the binaries, the permissions, the one consent — while installing or updating the plugin itself is the host's own plugin command.
command: true
argument-hint: "[optional: notify | mdx | browser — default is all three]"
allowed-tools: Bash, Read
---

# Set up computer-use on this machine

The plugin arrives complete. What does not arrive is everything it reaches for that lives outside
its own directory — a renderer installed globally, an npm package that has never been fetched, a
config file in the user's home that records a decision only they can make.

This is the one place those are handled, and the reason it exists as an explicit step rather than as
setup scattered through the other skills is **consent**. Two of these actions change the machine
outside the plugin — a global npm install, and switching on notifications that fire without being
asked. Neither belongs in a skill that is triggered while doing something else.

## How to run it

**Report first, then ask, then act — in that order, and never fold them together.** The point of
reporting is that most of the time most of it is already in place, and the user should be agreeing
to the two things that are missing rather than to a list of six.

```bash
command -v mdxv || echo "mdx-artifact: mdxv not installed"
"${PLUGIN_ROOT}/skills/notify-user/scripts/notify.sh" --doctor
```

Read the doctor output rather than summarising it — it names the config file, whether the automatic
notifications are on, which backend will be used, and it posts a live test banner. Then present what
is missing, what each fix costs, and let the user pick. **An action they did not choose is not
covered by having run this skill.**

## notify-user — the one thing that ships off

Manual sending already works with no setup. The automatic half does not, and that is deliberate: a
notification the model sends is one somebody asked for, while a notification that fires because a
turn ended is one nobody agreed to. `on-turn-end` and `on-blocked` both default to false.

```bash
"${PLUGIN_ROOT}/skills/notify-user/scripts/notify.sh" --init     # writes the config, both lines live
"${PLUGIN_ROOT}/skills/notify-user/scripts/notify.sh" --doctor   # prove it, with a real banner
```

`--init` refuses to overwrite an existing file, so on a machine that already has one, edit that file
instead — it is the user's, and it survives plugin updates in a way a scripted change does not.

<!--@claude-->
Nothing needs registering after that. The hooks are loaded because the plugin is enabled; what
`--init` changes is whether they do anything. So a user who ran this once and later wants silence
edits `on-turn-end: false` — they never have to uninstall anything.
<!--@codex-->
There is no hook mechanism on this end, so `--init` governs manual sends only and the "automatic"
half has nothing to switch on. Say that plainly rather than implying a turn-end notification is
coming; the skill is invoked here, not triggered.
<!--@common-->
Whether anything fires automatically depends entirely on the host — most have no hook concept, in
which case `--init` governs manual sends only. Do not promise a turn-end notification without
having established that this host can produce one.
<!--@end-->

## mdx-artifact — the renderer

`mdxv` is a global npm package, deliberately decoupled from any repo:

```bash
command -v mdxv >/dev/null || npm install -g mdx-viewer
mdxv --version
```

A global install is a real change to their machine. Ask. If they decline, the skill still works via
`npx -p mdx-viewer mdxv doc.mdx` — slower on first use, and worth saying so rather than presenting
the refusal as a dead end.

## graceful-browser — warming what is already there

Nothing to install: the bundled `chrome-devtools` MCP server runs through `npx` on demand. What is
worth doing once is paying the first fetch now instead of in the middle of a task, where it looks
like a hang:

```bash
npx -y chrome-devtools-mcp@latest --version
```

Long enough to belong in the background while the rest of this continues. Chrome itself is a
separate question — if it is not installed, say so; this skill does not install browsers.

## What it never does

- **It does not install or update the plugin.** That is the host's own plugin command, and confusing
  the two makes a failure in one look like a failure in the other.
- **It does not act without being told.** Every step here touches something outside the plugin
  directory, which is exactly why they are collected in a place the user has to ask for.
- **It does not report success it has not seen.** `npm install -g` exiting 0 is not `mdxv --version`
  answering, and a notification handed to the OS is not a banner anyone saw. Verify, then say so.
