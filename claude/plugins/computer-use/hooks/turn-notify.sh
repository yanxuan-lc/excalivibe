#!/bin/sh
# Claude Code hook — reach the user at the two moments the terminal cannot reach them.
#
#   turn-notify.sh prompt-start   UserPromptSubmit   stamp when this turn began; send nothing
#   turn-notify.sh turn-end       Stop               the turn is over — notify if it ran long enough
#   turn-notify.sh blocked        Notification       Claude is stuck on a permission decision
#
# Why a stamp: **Stop knows the turn ended and nothing about how long it took**, and a notification
# for every eight-second turn is one the user switches off within the hour. The elapsed time is the
# whole gate, so it has to be measured from the other end.
#
# Everything here writes to stderr and nothing to stdout. A UserPromptSubmit hook's stdout is
# injected into the model's context as extra instructions, so a stray echo would not be a cosmetic
# bug — it would be text the model reads as though the user had typed it.
set -eu
exec 1>&2

event=${1:-}
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
SKILL="$HERE/../skills/notify-user/scripts"
. "$SKILL/config.sh"

if [ "$NOTIFY_USER_ENABLED" != 1 ]; then exit 0; fi

STATE="${CLAUDE_PLUGIN_DATA:-${TMPDIR:-/tmp}}/notify-user-turns"
payload=$(cat 2>/dev/null || true)

# JSON, parsed by whatever is on the machine. jq and node both return the decoded string; without
# either, the fields simply come back empty and the notification degrades to a shorter one. That is
# the deliberate choice — a hand-rolled sed parser for `last_assistant_message` would quietly return
# truncated or wrong text on any message containing a quote, and wrong is worse than absent.
JQ=$(command -v jq 2>/dev/null || true)
NODE=$(command -v node 2>/dev/null || true)

field() {
  if [ -n "$JQ" ]; then
    printf '%s' "$payload" | "$JQ" -r --arg k "$1" '.[$k] // empty' 2>/dev/null || true
  elif [ -n "$NODE" ]; then
    printf '%s' "$payload" | "$NODE" -e 'let s="";process.stdin.on("data",d=>{s+=d}).on("end",()=>{try{const v=JSON.parse(s)[process.argv[1]];if(v!=null&&typeof v!=="object")process.stdout.write(String(v))}catch(e){}})' "$1" 2>/dev/null || true
  fi
}

# A notification body is one glanceable line. Flatten, squeeze, clip to 240 bytes, then let iconv
# drop the partial UTF-8 sequence the clip may have left behind — otherwise a Chinese summary ends
# in a replacement glyph.
clip() {
  v=$(printf '%s' "$1" | tr '\n\r\t' '   ' | tr -s ' ')
  printf '%.240s' "$v" | iconv -f UTF-8 -t UTF-8 -c 2>/dev/null || printf '%.240s' "$v"
}

duration() {
  s=$1
  if [ "$s" -lt 60 ]; then
    printf '%ds' "$s"
  elif [ "$s" -lt 3600 ]; then
    printf '%dm %ds' "$((s / 60))" "$((s % 60))"
  else
    printf '%dh %dm' "$((s / 3600))" "$((s % 3600 / 60))"
  fi
}

project() {
  p=${CLAUDE_PROJECT_DIR:-}
  if [ -z "$p" ]; then p=$(field cwd); fi
  if [ -n "$p" ]; then basename "$p"; else printf 'Claude Code'; fi
}

# One stamp file per session. Without a JSON parser there is no session id, so the key falls back to
# the project — two concurrent sessions in the same directory then share a stamp and one of them
# reports the other's elapsed time. Wrong by a few minutes, never wrong about having finished.
session_key() {
  k=$(field session_id)
  if [ -z "$k" ]; then k=$(project); fi
  printf '%s' "$k" | tr -c 'A-Za-z0-9._-' '-'
}

case $event in
  prompt-start)
    mkdir -p "$STATE" 2>/dev/null || exit 0
    # A turn that never reaches Stop (a crash, a kill) leaves its stamp behind. Sweeping on the way
    # in keeps the directory from growing without bound, and costs one find per prompt.
    find "$STATE" -type f -mtime +1 -delete 2>/dev/null || true
    date +%s >"$STATE/$(session_key)" 2>/dev/null || true
    ;;

  turn-end)
    if [ "$NOTIFY_USER_ON_TURN_END" != 1 ]; then exit 0; fi
    stamp="$STATE/$(session_key)"
    started=""
    if [ -f "$stamp" ]; then started=$(cat "$stamp" 2>/dev/null || true); fi
    rm -f "$stamp" 2>/dev/null || true

    subtitle="Finished"
    if [ -n "$started" ]; then
      elapsed=$(($(date +%s) - started))
      # Under the threshold the user was watching this happen — telling them is noise, and noise is
      # what gets the whole hook turned off.
      if [ "$elapsed" -lt "$NOTIFY_USER_MIN_SECONDS" ]; then exit 0; fi
      subtitle="Finished in $(duration "$elapsed")"
    fi

    body=$(clip "$(field last_assistant_message)")
    if [ -z "$body" ]; then body="The turn ended and Claude is waiting for you."; fi

    sh "$SKILL/notify.sh" --title "$(project)" --subtitle "$subtitle" --message "$body" || true
    ;;

  blocked)
    if [ "$NOTIFY_USER_ON_BLOCKED" != 1 ]; then exit 0; fi
    body=$(clip "$(field message)")
    if [ -z "$body" ]; then body="Claude needs a decision from you before it can go on."; fi
    # No elapsed gate here on purpose: a blocked turn is not making progress no matter how briefly
    # it has been blocked, and the cost of not knowing is the whole session sitting idle.
    sh "$SKILL/notify.sh" --title "$(project)" --subtitle "Waiting for you" --message "$body" || true
    ;;

  *)
    printf 'notify-user: turn-notify.sh needs one of prompt-start | turn-end | blocked, got "%s"\n' "$event"
    exit 2
    ;;
esac

exit 0
