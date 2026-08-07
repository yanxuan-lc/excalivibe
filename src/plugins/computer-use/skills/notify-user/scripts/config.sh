#!/bin/sh
# notify-user — the single place configuration is resolved. Sourced, never executed.
#
# Precedence, highest first:
#   1. the environment — a NOTIFY_USER_* variable already set always wins
#   2. the YAML file   — $NOTIFY_USER_CONFIG, else ~/.config/excalivibe/notify-user.yaml
#
# Vendor directory, capability filename. `~/.config/notify-user/` would have been a namespace grab
# on a name nobody owns, and `~/.exvibe/` would have solved that by abandoning XDG — which the
# vendor directory keeps. Later capabilities that need settings land beside this file, not in a
# second dotfile tree.
#   3. the defaults at the bottom of this file
#
# ── The accepted YAML is a subset, and a small one ────────────────────────────────────────────
# There is no YAML parser in POSIX sh, and this file is sourced at the end of every turn, so
# depending on `yq` or Python would mean the whole feature stops working on a machine that lacks
# them. What is implemented instead is a **flat mapping**:
#
#     enabled: true              # true/false, yes/no, on/off, 1/0
#     channels: [macos]          # or  channels: macos, webhook
#     sound: Glass               # empty, "" or null means silent
#     min-seconds: 60
#
# and that is the entire grammar. No nesting, no block sequences (`- item`), no anchors, no
# multi-line scalars. Full-line and trailing ` #` comments are honoured; single and double quotes
# are stripped.
#
# **Everything outside the subset is reported, never skipped.** A parser that half-understands a
# file is worse than one that refuses it: an indented line quietly ignored looks exactly like a
# setting that had no effect, and the only symptom of this feature misbehaving is silence.
# `notify.sh --doctor` exists to surface those reports at a moment someone is reading.
#
# The file is **read, not sourced**, and is data throughout — nothing in it can execute.

notify_user__is_set() { eval "[ \"\${$1+x}\" = x ]"; }

# Trim ASCII spaces from both ends of $1 into $notify_user__t, without spawning anything: this runs
# once per prompt, and a handful of sed processes per line is a cost paid on every turn.
notify_user__trim() {
  notify_user__t=$1
  while :; do case $notify_user__t in ' '*) notify_user__t=${notify_user__t# } ;; *) break ;; esac; done
  while :; do case $notify_user__t in *' ') notify_user__t=${notify_user__t% } ;; *) break ;; esac; done
}

NOTIFY_USER_CONFIG_PROBLEMS=0
notify_user__gripe() {
  NOTIFY_USER_CONFIG_PROBLEMS=$((NOTIFY_USER_CONFIG_PROBLEMS + 1))
  printf 'notify-user: %s:%s: %s\n' "$NOTIFY_USER_CONFIG_PATH" "$1" "$2" >&2
}

# Two paths, and they are different questions. `_PATH` is the file that was actually read, empty
# when there is none — no file on disk is the normal state, not an error, because the defaults are
# already a working configuration. `_DEFAULT_PATH` is where one would go, which is what `--init`
# writes to and what `--doctor` names.
NOTIFY_USER_CONFIG_DEFAULT_PATH="${XDG_CONFIG_HOME:-$HOME/.config}/excalivibe/notify-user.yaml"
NOTIFY_USER_CONFIG_PATH=""
if [ -n "${NOTIFY_USER_CONFIG:-}" ]; then
  NOTIFY_USER_CONFIG_DEFAULT_PATH=$NOTIFY_USER_CONFIG
  if [ -r "$NOTIFY_USER_CONFIG" ]; then
    NOTIFY_USER_CONFIG_PATH=$NOTIFY_USER_CONFIG
  elif [ -z "${NOTIFY_USER_CONFIG_QUIET:-}" ]; then
    # Pointed somewhere explicitly and it is not there: say so. Falling back to the defaults in
    # silence is how a typo'd path becomes an afternoon of wondering why nothing applies. The one
    # caller that sets QUIET is `--init`, whose entire job is that the file does not exist yet.
    printf 'notify-user: NOTIFY_USER_CONFIG points at %s, which cannot be read — using defaults\n' \
      "$NOTIFY_USER_CONFIG" >&2
  fi
else
  for notify_user__c in \
    "$NOTIFY_USER_CONFIG_DEFAULT_PATH" \
    "${XDG_CONFIG_HOME:-$HOME/.config}/excalivibe/notify-user.yml"; do
    if [ -r "$notify_user__c" ]; then
      NOTIFY_USER_CONFIG_PATH=$notify_user__c
      break
    fi
  done
fi

if [ -n "$NOTIFY_USER_CONFIG_PATH" ]; then
  # `grep -n` rather than counting iterations: word splitting on newlines collapses blank lines, so
  # a counter drifts the moment the file has one — and a diagnostic pointing at the wrong line is
  # worse than one with no line at all. Numbering up front makes the number the file's, not ours.
  # Blank and comment lines are dropped inside the loop, where they no longer cost the count.
  notify_user__body=$(sed -e 's/\r$//' "$NOTIFY_USER_CONFIG_PATH" 2>/dev/null | grep -n '' || true)

  notify_user__ifs=$IFS
  IFS='
'
  set -f # a title or a URL may contain * or ?; nothing here should glob
  for notify_user__row in $notify_user__body; do
    notify_user__n=${notify_user__row%%:*}
    notify_user__line=${notify_user__row#*:}

    case $notify_user__line in
      '#'* | [[:space:]]*'#'*) continue ;;
      *[![:space:]]*) ;;
      *) continue ;; # empty, or nothing but whitespace
    esac

    case $notify_user__line in
      [[:space:]]*)
        notify_user__gripe "$notify_user__n" \
          "indented — the accepted YAML is a flat mapping, with no nested blocks"
        continue ;;
      -*)
        notify_user__gripe "$notify_user__n" \
          "a block sequence item — write a list inline instead, as [a, b]"
        continue ;;
      *:*) ;;
      *)
        notify_user__gripe "$notify_user__n" "not a 'key: value' line"
        continue ;;
    esac

    notify_user__trim "${notify_user__line%%:*}"; notify_user__key=$notify_user__t
    notify_user__trim "${notify_user__line#*:}"; notify_user__val=$notify_user__t

    # A trailing comment, per YAML, needs whitespace in front of the #. Quoted values keep theirs.
    case $notify_user__val in
      \"*\" | \'*\') ;;
      *' #'*) notify_user__trim "${notify_user__val%% #*}"; notify_user__val=$notify_user__t ;;
    esac
    case $notify_user__val in
      \"*\") notify_user__val=${notify_user__val#\"}; notify_user__val=${notify_user__val%\"} ;;
      \'*\') notify_user__val=${notify_user__val#\'}; notify_user__val=${notify_user__val%\'} ;;
      '~' | null | Null | NULL) notify_user__val="" ;;
    esac
    # An inline flow sequence is the natural YAML spelling of a channel list; downstream every
    # consumer already splits on commas, so unwrapping the brackets is the whole implementation.
    case $notify_user__val in
      \[*\]) notify_user__val=${notify_user__val#\[}; notify_user__val=${notify_user__val%\]} ;;
    esac

    notify_user__var=""
    notify_user__kind=text
    case $notify_user__key in
      enabled) notify_user__var=NOTIFY_USER_ENABLED; notify_user__kind=bool ;;
      channels)
        notify_user__var=NOTIFY_USER_CHANNELS
        # An empty value is allowed everywhere else (`sound:` means silent), but "deliver to
        # nowhere" is not a thing anyone means — it is what `channels:` followed by an indented
        # list leaves behind, and accepting it would mute the feature without saying so.
        if [ -z "$notify_user__val" ]; then
          notify_user__gripe "$notify_user__n" \
            "channels needs at least one name, written inline as [macos]"
          continue
        fi ;;
      sound) notify_user__var=NOTIFY_USER_SOUND ;;
      title) notify_user__var=NOTIFY_USER_TITLE ;;
      min-seconds) notify_user__var=NOTIFY_USER_MIN_SECONDS; notify_user__kind=int ;;
      on-turn-end) notify_user__var=NOTIFY_USER_ON_TURN_END; notify_user__kind=bool ;;
      on-blocked) notify_user__var=NOTIFY_USER_ON_BLOCKED; notify_user__kind=bool ;;
      *)
        notify_user__gripe "$notify_user__n" \
          "unknown key '$notify_user__key' — this build understands enabled, channels, sound, title, min-seconds, on-turn-end, on-blocked"
        continue ;;
    esac

    case $notify_user__kind in
      bool)
        case $notify_user__val in
          true | True | TRUE | yes | Yes | on | On | 1) notify_user__val=1 ;;
          false | False | FALSE | no | No | off | Off | 0) notify_user__val=0 ;;
          *)
            notify_user__gripe "$notify_user__n" \
              "$notify_user__key wants a boolean, got '$notify_user__val'"
            continue ;;
        esac ;;
      int)
        case $notify_user__val in
          '' | *[!0-9]*)
            notify_user__gripe "$notify_user__n" \
              "$notify_user__key wants a whole number of seconds, got '$notify_user__val'"
            continue ;;
        esac ;;
    esac

    notify_user__is_set "$notify_user__var" || eval "$notify_user__var=\$notify_user__val"
  done
  set +f
  IFS=$notify_user__ifs
fi

# `is_set` rather than `:=`, because an empty value is meaningful — `sound:` means silent, which
# `${VAR:=default}` would helpfully undo.
notify_user__is_set NOTIFY_USER_ENABLED || NOTIFY_USER_ENABLED=1
notify_user__is_set NOTIFY_USER_CHANNELS || NOTIFY_USER_CHANNELS=macos
notify_user__is_set NOTIFY_USER_SOUND || NOTIFY_USER_SOUND=Glass
notify_user__is_set NOTIFY_USER_TITLE || NOTIFY_USER_TITLE=Agent
notify_user__is_set NOTIFY_USER_MIN_SECONDS || NOTIFY_USER_MIN_SECONDS=60
# These two default **off**, and the asymmetry with NOTIFY_USER_ENABLED is the whole point. A
# notification the model sends is one somebody asked for; a notification the hook sends fires
# because a plugin got enabled, on a machine whose owner never agreed to be interrupted. A plugin
# that starts posting banners on install is one people uninstall rather than configure, so the
# automatic half ships inert and `notify.sh --init` is where the consent is recorded.
notify_user__is_set NOTIFY_USER_ON_TURN_END || NOTIFY_USER_ON_TURN_END=0
notify_user__is_set NOTIFY_USER_ON_BLOCKED || NOTIFY_USER_ON_BLOCKED=0

export NOTIFY_USER_ENABLED NOTIFY_USER_CHANNELS NOTIFY_USER_SOUND NOTIFY_USER_TITLE \
  NOTIFY_USER_MIN_SECONDS NOTIFY_USER_ON_TURN_END NOTIFY_USER_ON_BLOCKED \
  NOTIFY_USER_CONFIG_PATH NOTIFY_USER_CONFIG_DEFAULT_PATH NOTIFY_USER_CONFIG_PROBLEMS

unset notify_user__c notify_user__body notify_user__ifs notify_user__row notify_user__line \
  notify_user__n notify_user__key notify_user__val notify_user__var notify_user__kind \
  notify_user__t 2>/dev/null || true
