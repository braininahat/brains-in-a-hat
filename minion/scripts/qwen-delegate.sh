#!/usr/bin/env bash
# qwen-delegate.sh — thin wrapper around `qwen -p` headless for minion skill.
#
# Usage:
#   qwen-delegate.sh <persona> [--allow-read] [--session <id>] [<prompt>]
#
# <persona>       coder | analyst (loads minion/personas/<persona>.md as --append-system-prompt)
# --allow-read    expose read_file,grep_search,list_directory,glob (NOT write/edit/shell)
# --session <id>  use `-c` resume / --session-id for warm-session batching
# <prompt>        positional; if omitted, reads from stdin
#
# Reads from stdin if no positional prompt is given.
# Returns qwen's `.result` field on stdout. Non-zero exit on API error.
# Full JSON log goes to /tmp/qwen-delegate-<sessionid-or-pid>.json for debugging.
#
# Never passes --yolo. Never enables write/edit/shell tools. The delegating
# agent (Opus) is responsible for applying qwen's output to the filesystem.

set -euo pipefail

usage () {
    cat >&2 <<EOF
usage: $(basename "$0") <persona> [--allow-read] [--session <id>] [<prompt>]
       echo 'prompt' | $(basename "$0") <persona> [options]

personas: coder, analyst
EOF
    exit 2
}

[[ $# -ge 1 ]] || usage

PERSONA="$1" ; shift
ALLOW_READ=0
SESSION_ID=""
PROMPT=""

while [[ $# -gt 0 ]] ; do
    case "$1" in
        --allow-read)   ALLOW_READ=1 ; shift ;;
        --session)      SESSION_ID="$2" ; shift 2 ;;
        --help|-h)      usage ;;
        --*)            echo "unknown flag: $1" >&2 ; exit 2 ;;
        *)              PROMPT="$1" ; shift ;;
    esac
done

# Resolve plugin root (parent of scripts/ dir)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(dirname "$SCRIPT_DIR")"
PERSONA_FILE="$PLUGIN_ROOT/personas/${PERSONA}.md"

if [[ ! -f "$PERSONA_FILE" ]] ; then
    echo "persona not found: $PERSONA_FILE" >&2
    echo "available: $(ls "$PLUGIN_ROOT/personas/" | tr '\n' ' ')" >&2
    exit 2
fi

# Dependency checks
command -v qwen >/dev/null 2>&1 || { echo "qwen CLI not installed — npm install -g @qwen-code/qwen-code" >&2 ; exit 127 ; }
command -v jq   >/dev/null 2>&1 || { echo "jq not installed — apt-get install jq" >&2 ; exit 127 ; }

# Prompt from stdin if not given positionally
if [[ -z "$PROMPT" ]] ; then
    if [[ -t 0 ]] ; then
        echo "no prompt: pass as arg or via stdin" >&2
        exit 2
    fi
    PROMPT="$(cat)"
fi

[[ -n "$PROMPT" ]] || { echo "empty prompt" >&2 ; exit 2 ; }

# Persona body goes into --append-system-prompt (strip frontmatter first)
PERSONA_BODY="$(awk '/^---$/{count++; next} count>=2' "$PERSONA_FILE")"

# Build qwen argv
declare -a QWEN_ARGS=(
    -p "$PROMPT"
    --append-system-prompt "$PERSONA_BODY"
    --approval-mode default
    -o json
)

if [[ "$ALLOW_READ" == "1" ]] ; then
    QWEN_ARGS+=( --allowed-tools read_file grep_search list_directory glob )
fi

if [[ -n "$SESSION_ID" ]] ; then
    QWEN_ARGS+=( --session-id "$SESSION_ID" )
fi

# Run — capture full JSON, log for debugging, extract .result for caller
LOG_TAG="${SESSION_ID:-$$}"
LOG_FILE="/tmp/qwen-delegate-${LOG_TAG}.json"

RAW="$(qwen "${QWEN_ARGS[@]}" 2>&1 || true)"

# Log before parsing (in case parse fails)
printf '%s\n' "$RAW" > "$LOG_FILE"

# Locate the result event; qwen emits an array of events in JSON mode
RESULT="$(printf '%s' "$RAW" | jq -r '.[]? | select(.type=="result") | .result' 2>/dev/null || true)"
ERR_FLAG="$(printf '%s' "$RAW" | jq -r '.[]? | select(.type=="result") | .is_error' 2>/dev/null || true)"

if [[ -z "$RESULT" ]] ; then
    echo "qwen returned no result event — check $LOG_FILE" >&2
    # Surface the first ~500 chars to stderr for quick diagnosis
    printf '%s\n' "$RAW" | head -c 500 >&2
    echo "" >&2
    exit 1
fi

# API-error strings are surfaced as .result but is_error stays false; detect textually
if printf '%s' "$RESULT" | grep -q '^\[API Error' ; then
    echo "qwen API error: $RESULT" >&2
    echo "log: $LOG_FILE" >&2
    exit 3
fi

if [[ "$ERR_FLAG" == "true" ]] ; then
    echo "qwen reported is_error=true — check $LOG_FILE" >&2
    exit 4
fi

printf '%s\n' "$RESULT"
