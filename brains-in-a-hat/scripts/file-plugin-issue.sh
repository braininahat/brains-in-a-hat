#!/usr/bin/env bash
#
# file-plugin-issue.sh — File a GitHub issue on the brains-in-a-hat plugin repo.
#
# Always targets braininahat/brains-in-a-hat regardless of the current working
# directory. When the plugin is running inside another project, issues must
# land on the plugin's home repo — not the host project.
#
# Before creating, deduplicates by title: if a close-title match exists (open
# or closed), appends a recurrence comment noting the calling project instead
# of opening a duplicate.
#
# Usage:
#   file-plugin-issue.sh --title "Short title" [--body "text" | --body @path]
#                        [--label label1,label2] [--dry-run]
#
#   Body from stdin:
#     echo "Details here" | file-plugin-issue.sh --title "Short title"
#
# Output:
#   Prints the resulting issue URL (or comment URL) on stdout.
#
# Flags:
#   --title    (required) Issue title
#   --body     Issue body text, or @/path/to/file to read from a file
#   --label    Comma-separated labels (can be repeated)
#   --dry-run  Print what would happen without hitting GitHub
set -euo pipefail

PLUGIN_REPO="braininahat/brains-in-a-hat"

# ---------- helpers ----------------------------------------------------------

_calling_project() {
  # Derive a human-readable name for the project that invoked this script.
  local remote
  remote=$(git config --get remote.origin.url 2>/dev/null || true)
  if [ -n "$remote" ]; then
    # Strip protocol prefix and .git suffix, keep owner/repo portion
    remote="${remote##*:}"         # strip git@host: or similar
    remote="${remote#//}"          # strip leading // (https://)
    remote="${remote#*/}"          # strip host (github.com/)
    remote="${remote%.git}"        # strip trailing .git
    printf '%s' "$remote"
  else
    basename "$PWD"
  fi
}

_read_body() {
  local raw="$1"
  if [ -z "$raw" ]; then
    # Try stdin if not a tty
    if [ ! -t 0 ]; then
      cat
    else
      printf ''
    fi
    return
  fi
  if [[ "$raw" == @* ]]; then
    local path="${raw#@}"
    if [ ! -f "$path" ]; then
      printf 'file-plugin-issue: body file not found: %s\n' "$path" >&2
      exit 1
    fi
    cat "$path"
  else
    printf '%s' "$raw"
  fi
}

_find_duplicate() {
  # Search for an existing issue (open or closed) whose title closely matches.
  # Returns the issue number on stdout, or empty string if none found.
  local title="$1"
  gh issue list \
    -R "$PLUGIN_REPO" \
    --state all \
    --search "$title" \
    --json number,title \
    --jq '.[0].number // empty' 2>/dev/null || true
}

# ---------- arg parsing ------------------------------------------------------

TITLE=""
BODY_RAW=""
LABELS=()
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --title)
      TITLE="${2:?--title requires a value}"
      shift 2
      ;;
    --body)
      BODY_RAW="${2:?--body requires a value}"
      shift 2
      ;;
    --label)
      IFS=',' read -ra _lbls <<< "${2:?--label requires a value}"
      LABELS+=("${_lbls[@]}")
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --)
      shift
      break
      ;;
    *)
      printf 'file-plugin-issue: unknown argument: %s\n' "$1" >&2
      printf 'Usage: %s --title "..." [--body "..." | --body @path] [--label l1,l2] [--dry-run]\n' \
        "$(basename "$0")" >&2
      exit 2
      ;;
  esac
done

if [ -z "$TITLE" ]; then
  printf 'file-plugin-issue: --title is required\n' >&2
  exit 2
fi

# ---------- resolve body & calling project -----------------------------------

BODY=$(_read_body "$BODY_RAW")
CALLING_PROJECT=$(_calling_project)

# ---------- dedup check ------------------------------------------------------

EXISTING_NUM=$(_find_duplicate "$TITLE")

# Guard: EXISTING_NUM must be a plain integer; reject anything else (jq
# parse errors, multi-line output, stray text) to prevent passing garbage
# to `gh issue comment`.
if [ -n "$EXISTING_NUM" ] && ! printf '%s' "$EXISTING_NUM" | grep -qE '^[0-9]+$'; then
  printf 'file-plugin-issue: unexpected dedup result (not an integer): %s — skipping duplicate check\n' \
    "$EXISTING_NUM" >&2
  EXISTING_NUM=""
fi

# ---------- dry-run path -----------------------------------------------------

if [ "$DRY_RUN" = true ]; then
  printf '[dry-run] repo: -R %s\n' "$PLUGIN_REPO"
  if [ -n "$EXISTING_NUM" ]; then
    printf '[dry-run] action: gh issue comment (duplicate found: #%s)\n' "$EXISTING_NUM"
    printf '[dry-run] comment: "Recurrence reported from project: %s"\n' "$CALLING_PROJECT"
    printf '[dry-run] would output: https://github.com/%s/issues/%s#comment-<new>\n' \
      "$PLUGIN_REPO" "$EXISTING_NUM"
  else
    printf '[dry-run] action: gh issue create\n'
    printf '[dry-run] title: %s\n' "$TITLE"
    if [ -n "$BODY" ]; then
      printf '[dry-run] body: (provided, %d chars)\n' "${#BODY}"
    else
      printf '[dry-run] body: (empty)\n'
    fi
    if [ "${#LABELS[@]}" -gt 0 ]; then
      printf '[dry-run] labels: %s\n' "${LABELS[*]}"
    fi
    printf '[dry-run] would output: https://github.com/%s/issues/<new>\n' "$PLUGIN_REPO"
  fi
  exit 0
fi

# ---------- live path --------------------------------------------------------

if [ -n "$EXISTING_NUM" ]; then
  # Duplicate found — comment on the existing issue noting the recurrence
  COMMENT_BODY="Recurrence reported from project: \`${CALLING_PROJECT}\`."
  if [ -n "$BODY" ]; then
    COMMENT_BODY="${COMMENT_BODY}

${BODY}"
  fi
  RESULT_URL=$(gh issue comment "$EXISTING_NUM" \
    -R "$PLUGIN_REPO" \
    --body "$COMMENT_BODY" \
    | grep -oP 'https://\S+' | head -1 || true)
  # gh issue comment doesn't print a URL by default; construct it
  if [ -z "$RESULT_URL" ]; then
    RESULT_URL="https://github.com/${PLUGIN_REPO}/issues/${EXISTING_NUM}"
  fi
else
  # Build the gh issue create command
  CREATE_ARGS=(-R "$PLUGIN_REPO" --title "$TITLE")
  if [ -n "$BODY" ]; then
    CREATE_ARGS+=(--body "$BODY")
  fi
  for lbl in "${LABELS[@]}"; do
    CREATE_ARGS+=(--label "$lbl")
  done
  RESULT_URL=$(gh issue create "${CREATE_ARGS[@]}")
fi

printf '%s\n' "$RESULT_URL"
