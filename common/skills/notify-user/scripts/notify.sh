#!/bin/sh
# notify-user — hand one message to the human over whatever channel they configured.
#
#   notify.sh "the migration finished, 41k rows moved"
#   notify.sh --title Deploy --subtitle staging --message "smoke tests green"
#   notify.sh --dry-run "…"        # resolve everything, print it, send nothing
#   notify.sh --doctor             # what is configured, what will send, and a live test banner
#   notify.sh --init               # write a commented config.yaml, if there is not one already
#
# Exit codes — the caller can branch on them:
#   0  at least one channel accepted the message
#   1  every configured channel failed; each reason is on stderr, verbatim
#   2  called wrong
#   3  notifications are switched off in the user's config. A deliberate no-op, not a failure —
#      distinct from 0 so a caller can tell "delivered" from "nobody wanted this"
#
# A channel is exactly one file, `channels/<name>.sh`. It is run with the message in its
# environment and exits 0 once the message is away. Adding a channel is adding that one file;
# nothing in here has to learn about it. The contract is the four NOTIFY_* variables below.
set -eu

SELF=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
# `--init` runs precisely because the file is not there yet, so the missing-file warning config.sh
# would otherwise print is the one piece of output guaranteed to be wrong.
case ${1:-} in --init) NOTIFY_USER_CONFIG_QUIET=1; export NOTIFY_USER_CONFIG_QUIET ;; esac
. "$SELF/config.sh"

usage() {
  cat <<'EOF'
usage: notify.sh [options] [message]

  -m, --message TEXT    the body (or pass it as the trailing argument)
  -t, --title TEXT      the headline; defaults to NOTIFY_USER_TITLE
  -s, --subtitle TEXT   a second line, where the channel supports one
      --sound NAME      macOS system sound name; defaults to NOTIFY_USER_SOUND
      --silent          no sound, whatever the config says
      --channel LIST    comma-separated; overrides NOTIFY_USER_CHANNELS for this call
      --dry-run         resolve and print, send nothing
      --doctor          report the resolved setup and send one live test notification
      --init            write a commented config.yaml; never overwrites an existing one
  -h, --help
EOF
}

channels_available() {
  for f in "$SELF"/channels/*.sh; do
    [ -f "$f" ] || continue
    b=${f##*/}
    printf '%s ' "${b%.sh}"
  done
}

# `--init` is where consent to be interrupted gets recorded, so it writes exactly two live lines —
# the ones that switch the automatic hook on — and leaves everything else commented. A template
# that pre-set the current defaults would freeze them, so anyone who ran --init once would stop
# receiving a later change to what "default" means; the commented lines are there for the key names
# and the accepted spellings, not to configure anything.
init_config() {
  target=$NOTIFY_USER_CONFIG_DEFAULT_PATH
  if [ -e "$target" ]; then
    printf 'notify-user: %s is already there — left exactly as it is\n' "$target" >&2
    return 2
  fi
  mkdir -p "$(dirname "$target")"
  cat >"$target" <<'YAML'
# notify-user — out-of-band notifications.
#
# The two live lines at the bottom are what this file is for: the automatic notifications ship off,
# and writing this file is how they get switched on. Set either to false to go back.
#
# Everything else is commented out and shown at its built-in default. Uncomment only what you want
# to differ — a line left commented keeps tracking the default if that default ever changes.
#
# A flat mapping is the whole accepted grammar — no nesting, no `- item` sequences. Anything else
# is reported with its line number rather than ignored; `notify.sh --doctor` surfaces those.
# An environment variable of the same name in NOTIFY_USER_UPPER_SNAKE form overrides any line here.

# enabled: true         # false switches every notification off, manual sends included

# channels: [macos]     # tried in order; macos is the only one this build ships

# sound: Glass          # any macOS system sound; empty or null for silence

# title: Agent          # headline used when the caller does not set one

# min-seconds: 60       # a turn shorter than this is one you watched happen, so it stays quiet

on-turn-end: true       # notify when a turn finishes and you were not watching
on-blocked: true        # notify when the work is waiting on a permission decision
YAML
  printf 'notify-user: wrote %s\n' "$target"
  printf 'Automatic notifications are now on — a finished turn after %ss, and any blocked one.\n' \
    "$NOTIFY_USER_MIN_SECONDS"
  return 0
}

# `--doctor` answers the only question anyone actually has, which is "why did I not see anything".
# It reports what resolved, from where, and then sends one real notification, because every layer
# below this — Focus, per-app permission, whether a display exists at all — is invisible from here.
doctor() {
  verdict=0

  printf 'notify-user\n'
  if [ -n "$NOTIFY_USER_CONFIG_PATH" ]; then
    printf '  config       %s\n' "$NOTIFY_USER_CONFIG_PATH"
  else
    printf '  config       none, running on defaults\n'
    printf '               notify.sh --init writes a commented one at %s\n' "$NOTIFY_USER_CONFIG_DEFAULT_PATH"
  fi
  if [ "${NOTIFY_USER_CONFIG_PROBLEMS:-0}" -gt 0 ]; then
    printf '  PROBLEMS     %s line(s) were not understood, listed above — those settings did not apply\n' \
      "$NOTIFY_USER_CONFIG_PROBLEMS"
    verdict=1
  fi

  printf '  enabled      %s\n' "$([ "$NOTIFY_USER_ENABLED" = 1 ] && echo yes || echo 'no — everything below is inert')"
  printf '  channels     %s   (this build ships: %s)\n' "$NOTIFY_USER_CHANNELS" "$(channels_available)"
  printf '  sound        %s\n' "${NOTIFY_USER_SOUND:-none, silent}"
  printf '  title        %s\n' "$NOTIFY_USER_TITLE"
  if [ "$NOTIFY_USER_ON_TURN_END" = 1 ]; then
    printf '  turn end     on, once a turn has run %ss\n' "$NOTIFY_USER_MIN_SECONDS"
  else
    printf '  turn end     off — the automatic half ships inert; notify.sh --init switches it on\n'
  fi
  printf '  blocked      %s\n' \
    "$([ "$NOTIFY_USER_ON_BLOCKED" = 1 ] && echo 'on, with no time gate' || echo off)"

  if [ "$(uname -s)" = Darwin ]; then
    printf '  backend      osascript, part of macOS — nothing to install, and nothing to keep current\n'
    printf '               it posts under the app scripting it, so permission lives under that name\n'
  else
    printf '  backend      none — the macos channel is the only one, and this is %s\n' "$(uname -s)"
    verdict=1
  fi

  if command -v jq >/dev/null 2>&1; then
    printf '  summaries    jq — a finished turn carries its last message in the body\n'
  elif command -v node >/dev/null 2>&1; then
    printf '  summaries    node — a finished turn carries its last message in the body\n'
  else
    printf '  summaries    neither jq nor node — notifications still fire, with a generic body\n'
  fi

  if [ "$NOTIFY_USER_ENABLED" != 1 ]; then
    printf '\nSwitched off, so nothing was sent. Set enabled to true to try it.\n'
    return 3
  fi

  printf '\nSending one test notification now.\n'
  if sh "$SELF/notify.sh" --title notify-user --subtitle doctor \
    --message 'If you can read this, the channel works.'; then
    printf 'Handed to the OS. If no banner appeared, macOS suppressed it and the script cannot tell —\n'
    printf 'check Focus or Do Not Disturb, then the per-app switches in System Settings, Notifications.\n'
  else
    verdict=1
  fi
  return "$verdict"
}

# Both are whole-run modes rather than modifiers, so they are only recognised as the first argument.
# `|| rc=$?` rather than a bare call: under `set -e` a non-zero return would abort the script before
# it reached the exit, turning "doctor found a problem" into "doctor produced no verdict".
case ${1:-} in
  --doctor)
    rc=0
    doctor || rc=$?
    exit "$rc" ;;
  --init)
    rc=0
    init_config || rc=$?
    exit "$rc" ;;
esac

title=$NOTIFY_USER_TITLE
subtitle=""
message=""
sound=$NOTIFY_USER_SOUND
channels=$NOTIFY_USER_CHANNELS
dry=0

need_value() {
  if [ "$1" -lt 2 ]; then
    printf 'notify-user: %s needs a value\n' "$2" >&2
    exit 2
  fi
}

while [ $# -gt 0 ]; do
  case $1 in
    -m | --message) need_value $# "$1"; message=$2; shift 2 ;;
    -t | --title) need_value $# "$1"; title=$2; shift 2 ;;
    -s | --subtitle) need_value $# "$1"; subtitle=$2; shift 2 ;;
    --sound) need_value $# "$1"; sound=$2; shift 2 ;;
    --silent) sound=""; shift ;;
    --channel | --channels) need_value $# "$1"; channels=$2; shift 2 ;;
    --dry-run) dry=1; shift ;;
    -h | --help) usage; exit 0 ;;
    --) shift; break ;;
    -*)
      printf 'notify-user: unknown option %s\n' "$1" >&2
      usage >&2
      exit 2 ;;
    *) break ;;
  esac
done

if [ $# -gt 0 ]; then
  if [ -n "$message" ]; then
    printf 'notify-user: the message was given twice, as --message and as an argument\n' >&2
    exit 2
  fi
  message=$*
fi

if [ -z "$message" ]; then
  printf 'notify-user: nothing to send — give a message\n' >&2
  usage >&2
  exit 2
fi

if [ "$NOTIFY_USER_ENABLED" = 0 ]; then
  printf 'notify-user: switched off (NOTIFY_USER_ENABLED=0) — not sending\n' >&2
  exit 3
fi

if [ "$dry" = 1 ]; then
  printf 'notify-user: would send over [%s]\n  title    %s\n  subtitle %s\n  message  %s\n  sound    %s\n' \
    "$channels" "$title" "$subtitle" "$message" "$sound"
  exit 0
fi

sent=0
for ch in $(printf '%s' "$channels" | tr ',' ' '); do
  impl="$SELF/channels/$ch.sh"
  if [ ! -f "$impl" ]; then
    printf 'notify-user: no channel named "%s" — this build ships: %s\n' "$ch" "$(channels_available)" >&2
    continue
  fi
  # `sh "$impl"` rather than executing it: the common end is copied around by hand, and a channel
  # that lost its executable bit in transit should still send.
  if NOTIFY_TITLE=$title NOTIFY_SUBTITLE=$subtitle NOTIFY_MESSAGE=$message \
    NOTIFY_SOUND=$sound sh "$impl"; then
    sent=$((sent + 1))
  fi
done

if [ "$sent" -gt 0 ]; then
  exit 0
fi
printf 'notify-user: not delivered — no channel in [%s] accepted the message\n' "$channels" >&2
exit 1
