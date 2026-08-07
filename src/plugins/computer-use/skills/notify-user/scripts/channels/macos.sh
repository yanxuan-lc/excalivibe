#!/bin/sh
# notify-user channel — macOS Notification Center, through osascript.
#
# The channel contract, which is all any channel file has to honour:
#   in   NOTIFY_TITLE · NOTIFY_SUBTITLE · NOTIFY_MESSAGE · NOTIFY_SOUND (each may be empty)
#   out  exit 0 once the message is away; non-zero with a reason on stderr otherwise
#   never write to stdout — a caller may be a hook whose stdout is read by the harness
#
# `osascript` is the whole implementation, and that is deliberate: it is part of macOS, so this
# channel has no install step, no third-party binary and nothing to keep up to date. The cost is
# that a notification posts under whichever app is scripting it rather than under an identity of
# its own, which is the first thing to check when one does not appear.
set -eu

if [ "$(uname -s)" != Darwin ]; then
  printf 'notify-user/macos: this is %s, not macOS\n' "$(uname -s)" >&2
  exit 1
fi

TITLE=${NOTIFY_TITLE:-Agent}
SUBTITLE=${NOTIFY_SUBTITLE:-}
MESSAGE=${NOTIFY_MESSAGE:-}
SOUND=${NOTIFY_SOUND:-}

# AppleScript string literals cannot hold a raw newline, and a backslash or a double quote ends the
# literal early — so flatten and escape before interpolating, or a message containing a quote
# becomes a syntax error rather than a notification.
flatten() { printf '%s' "$1" | tr '\n\r\t' '   ' | tr -s ' '; }
escape() { printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'; }

script="display notification \"$(escape "$(flatten "$MESSAGE")")\""
script="$script with title \"$(escape "$(flatten "$TITLE")")\""
if [ -n "$SUBTITLE" ]; then script="$script subtitle \"$(escape "$(flatten "$SUBTITLE")")\""; fi
if [ -n "$SOUND" ]; then script="$script sound name \"$(escape "$SOUND")\""; fi

osascript -e "$script" >/dev/null
