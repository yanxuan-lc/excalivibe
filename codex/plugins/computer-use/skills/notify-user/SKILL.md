---
name: notify-user
description: Decide whether a moment in the work is worth pulling a human's attention back, and reach them off-screen when it is. Use it when a long job finishes with nobody watching, when progress is blocked on an answer only they can give, when something broke in a way that will not resolve itself, or when someone asks to be told when it is over — "ping me", "notify me", "tell me when this finishes", "弄完叫我", "发个通知". Also covers which channel those notifications go out over, how it is configured, and why a turn ended without one. macOS Notification Center is the channel implemented today. Not for anything the user will read on their next glance at the terminal — that belongs in the reply, and notifying it is the noise that gets all of them switched off.
---

# notify-user — reach the human where the terminal cannot

Everything you write lands in one place, and that place is a window the user walked away from. A
long build, a slow migration, a test suite — the moment they stop watching, your output stops being
communication and becomes a log they will read later. A notification is the one channel that
crosses back.

Which makes it a channel worth spending carefully. Every notification you send costs a little of
the credibility of the next one, and a channel that cries wolf gets muted — after which the one
message that genuinely mattered is also the one nobody sees.

## When it is worth interrupting someone

The question is not "is this important". It is **"is their attention somewhere else, and does this
need it back"**. Three shapes pass that test:

- **Finished, and nobody was watching.** The work is over and the next move is theirs. This is the
  common one, and the only signal that matters is elapsed time — a turn that took eight seconds was
  watched, a turn that took nine minutes was not.
- **Blocked on them.** A permission decision, a missing credential, an ambiguity you cannot resolve
  by picking. Nothing else happens until they come back, so the cost of silence is the whole
  session sitting idle.
- **Broken and staying broken.** A failure you cannot work around, in a run they expected to walk
  away from. Not every error — the ones where continuing to wait is pointless.

Three shapes that fail it, and they fail it every time:

- **Progress.** "Step 3 of 7 done" is what the terminal is for.
- **Anything already in your reply.** They will read it in the same glance that would have read the
  notification. Sending both spends the channel for nothing.
- **Anything under a minute old.** If the work started while they were looking, they are still
  looking.

Two rules for the message itself: **one notification per event, not per step**, and **put the answer
in the body, not the preamble**. A banner shows one line for four seconds. "Migration finished, 41k
rows, 2 failures" is a notification. "The task you requested has now completed" is a beep with extra
steps.

## Sending one

```bash
${CODEX_PLUGIN_ROOT}/skills/notify-user/scripts/notify.sh "migration finished — 41k rows, 2 failures"
```

| flag | effect |
|---|---|
| `-m, --message TEXT` | the body; also accepted as the trailing positional argument |
| `-t, --title TEXT` | the headline, defaulting to `NOTIFY_USER_TITLE` |
| `-s, --subtitle TEXT` | a second line, on channels that have one |
| `--sound NAME` / `--silent` | a macOS system sound (`Glass`, `Ping`, `Hero`, …), or none |
| `--channel LIST` | comma-separated, overriding the configured channels for this one call |
| `--dry-run` | resolve everything and print it, send nothing |
| `--doctor` | report the resolved setup and send one live test notification |
| `--init` | write the config file and switch the automatic notifications on; never overwrites |

Branch on the exit code rather than on the output:

| exit | meaning |
|---|---|
| `0` | at least one channel took it |
| `1` | every channel failed; the reasons are on stderr, verbatim — pass them on rather than paraphrasing |
| `2` | the call was malformed |
| `3` | the user has notifications switched off. **A deliberate no-op, not a failure** — do not retry it, do not route around it, and do not report it as an error |

`3` is the one worth reading twice. Someone who wrote `enabled: false` has already answered the
question this skill exists to ask.

## Sending needs no setup; being interrupted does

**Sending works immediately** — no config file, no daemon, no registration. Reach for `notify.sh`
the moment a task calls for it.

**The automatic half ships off.** A notification you send is one somebody asked for. A notification
that fires because a turn ended is one nobody agreed to, on a machine whose owner only installed a
plugin — and a plugin that starts posting banners on install gets uninstalled rather than
configured. So `on-turn-end` and `on-blocked` both default to false, and switching them on is an
explicit act:

- **`notify.sh --init`** — writes the config file with those two lines live. This is where the
  consent is recorded. It refuses to overwrite an existing file.
- **`notify.sh --doctor`** — prints what resolved and from where, then sends one real notification.
  Reach for this the moment someone says notifications are not working, because every layer below
  the script (Focus, per-app permission, whether a display exists at all) is invisible from inside
  it, and a send that returns `0` proves only that the OS took the message.

## Configuration

Settings resolve **environment → YAML file → default**. The file is
`${XDG_CONFIG_HOME:-~/.config}/excalivibe/notify-user.yaml` — vendor directory, capability filename,
so later settings land beside it rather than squatting another generic name (`.yml` also works, and
`NOTIFY_USER_CONFIG` overrides the path outright). It is read as data, never sourced — a settings
file consulted at the end of every turn should not be able to execute anything.

```yaml
enabled: true
channels: [macos]
sound: Glass          # empty or null for silence
title: Agent
min-seconds: 60
on-turn-end: true     # both default to false — writing them is the opt-in
on-blocked: true
```

| YAML key | environment override | default | what it decides |
|---|---|---|---|
| `enabled` | `NOTIFY_USER_ENABLED` | `true` | the master switch; off makes every send exit `3` |
| `channels` | `NOTIFY_USER_CHANNELS` | `[macos]` | tried in order |
| `sound` | `NOTIFY_USER_SOUND` | `Glass` | empty or `null` means silent |
| `title` | `NOTIFY_USER_TITLE` | `Agent` | the headline when the caller does not set one |
| `min-seconds` | `NOTIFY_USER_MIN_SECONDS` | `60` | how long a turn must run before finishing it is worth saying |
| `on-turn-end` | `NOTIFY_USER_ON_TURN_END` | `false` | notify when a turn ends — the opt-in |
| `on-blocked` | `NOTIFY_USER_ON_BLOCKED` | `false` | notify when the work is waiting on the user — the opt-in |

### The accepted YAML is a subset, and knowing where it stops matters

There is no YAML parser in POSIX sh, and this file is read at the end of every turn — depending on
`yq` or Python would mean the feature stops existing on a machine without them. So what is
implemented is a **flat mapping** and nothing else: no nesting, no `- item` block sequences, no
anchors, no multi-line scalars. Booleans may be written `true/false`, `yes/no`, `on/off` or `1/0`; a
list may be inline (`[a, b]`) or bare (`a, b`); quotes and trailing ` #` comments are handled.

**Everything outside that subset is reported with its line number, never skipped.** This is the part
worth internalising before editing someone's config: the natural YAML for these settings is nested —

```yaml
turn-end:            # ← reported: unknown key
  enabled: false     # ← reported: indented, and it did not apply
```

— and a parser that half-understood it would leave `on-turn-end` at its default while the file says
otherwise. That failure is invisible from the outside, because a setting that silently did not apply
and a setting that is working correctly both look like an absence of notifications. Run `--doctor`
after editing; it surfaces the count and exits non-zero.

**When someone wants notifications tuned, edit that file — never the scripts.** A scripted change is
lost on the next plugin update; the config file is theirs and survives.

## Adding a channel

A channel is one file, `scripts/channels/<name>.sh`, and the contract is small enough to state in
full:

- **in** — `NOTIFY_TITLE`, `NOTIFY_SUBTITLE`, `NOTIFY_MESSAGE`, `NOTIFY_SOUND` in the environment,
  any of them possibly empty
- **out** — exit `0` once the message is away; non-zero with the reason on stderr otherwise
- **never write to stdout** — a caller may be a hook whose stdout the harness reads as instructions

Drop the file in and it is selectable by name; `notify.sh` discovers channels by listing that
directory and never has to learn about them. Only `macos` exists today, and the honest reason is
that a webhook or chat channel written against an imagined account is a channel nobody has ever
watched a message arrive on.

## What actually goes wrong

- **The notification is sent and never appears.** macOS decides that, not the script, and it exits
  `0` either way — the OS accepted the message, it just declined to draw it. Check Focus / Do Not
  Disturb first, then **System Settings → Notifications** for the app that posted it. That app is
  whichever one scripted `osascript`, not "notify-user", which is neither obvious nor memorable and
  is the single most common reason this looks broken.
- **The banner is all there is.** No click target, no grouping, no icon of its own — `osascript` is
  part of macOS and that is what it offers. The trade is deliberate: this channel has no install
  step and no third-party binary to keep current, so it works on a machine the moment the plugin is
  enabled. Put anything actionable in the message text itself, because there is nothing to click.
- **No display, no notification.** Over SSH, in CI, in a container, `osascript` has nothing to draw
  on. Say so plainly instead of reporting a send that went nowhere.
- **Notifications are not delivery.** A banner that appears while the user is away from the machine
  is gone by the time they return, with nothing left behind. Anything that must survive being missed
  belongs in the reply as well.
