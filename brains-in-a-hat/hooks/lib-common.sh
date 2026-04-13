#!/usr/bin/env bash
#
# lib-common.sh — Shared utility functions for brains-in-a-hat hooks.
#
# Source from other hook scripts:
#   source "$(dirname "${BASH_SOURCE[0]}")/lib-common.sh"

# ── Roots ─────────────────────────────────────────────────────────────

BIH_HOME="${BIH_HOME:-${HOME}/.brains_in_a_hat}"
VAULT_DIR="${VAULT_DIR:-${BIH_HOME}/vault}"
SESSIONS_DIR="${BIH_HOME}/sessions"
STATE_ROOT="${BIH_HOME}/state"

# ── Key derivation ────────────────────────────────────────────────────
# KEY is a stable, sanitized absolute path to the git worktree root (or
# pwd if not a git repo). Matches Claude Code's own project-scoping at
# ~/.claude/projects/<sanitized-abs-path>/.
#
# Example: /home/varun/repos/esc/ultrasuite-analysis
#       →  -home-varun-repos-esc-ultrasuite-analysis

detect_project_key() {
  local root
  root=$(git rev-parse --show-toplevel 2>/dev/null) || root=""
  [ -n "${root}" ] || root="$(pwd)"
  root=$(realpath "${root}" 2>/dev/null || printf '%s' "${root}")
  printf '%s' "${root}" | sed 's|/|-|g'
}

# 10-char hex hash of the key — used for team_name since full sanitized
# paths exceed Claude Code's team_name length limit.
key_hash() {
  printf '%s' "$1" | sha256sum | head -c 10
}

# ── SID → key resolution ──────────────────────────────────────────────
# Every hook except session-start resolves its key by reading
# ${SESSIONS_DIR}/${SID}.key. If the file doesn't exist, the hook is
# running for a session that hasn't been bootstrapped (or for a non-
# team session) and should exit 0.

read_session_key() {
  local sid="$1"
  [ -n "${sid}" ] || return 0
  local f="${SESSIONS_DIR}/${sid}.key"
  [ -f "${f}" ] || return 0
  cat "${f}" 2>/dev/null || true
}

# ── Directory resolution ──────────────────────────────────────────────

state_dir() {
  local key="$1"
  [ -n "${key}" ] || return 1
  printf '%s/%s' "${STATE_ROOT}" "${key}"
}

# vault_file_for <key> <category> [<slug>]
#   category: session-log|patterns|workflow|backlog|index → flat
#             retro|decision|wiki|research → require slug
vault_file_for() {
  local key="$1" cat="$2" slug="${3:-}"
  case "$cat" in
    session-log|patterns|workflow|backlog|index)
      printf '%s/%s--%s.md' "${VAULT_DIR}" "${key}" "${cat}" ;;
    retro|decision|wiki|research)
      [ -n "${slug}" ] || return 1
      printf '%s/%s--%s-%s.md' "${VAULT_DIR}" "${key}" "${cat}" "${slug}" ;;
    *) return 1 ;;
  esac
}

# ── Per-project index note (Obsidian-native "pointer dir") ────────────
# Idempotent. Creates <KEY>--index.md if missing, then scans the vault
# for all <KEY>--*.md files and ensures each is linked from the index
# under its category section. Safe to call after every artifact write.
# Uses a directory lock to serialize concurrent callers.

ensure_vault_index() {
  local key="$1"
  [ -n "${key}" ] || return 0
  mkdir -p "${VAULT_DIR}"
  local index="${VAULT_DIR}/${key}--index.md"
  local lock="${index}.lock.d"
  local template="${CLAUDE_PLUGIN_ROOT:-}/vault-templates/index.md"
  local human
  human=$(detect_project_name)

  local acquired=0 i
  for i in 1 2 3 4 5 6 7 8 9 10; do
    if mkdir "${lock}" 2>/dev/null; then acquired=1; break; fi
    sleep 0.1
  done
  [ "${acquired}" = "1" ] || return 0

  if [ ! -f "${index}" ]; then
    if [ -f "${template}" ]; then
      sed -e "s|{{key}}|${key}|g" -e "s|{{project}}|${human}|g" \
          -e "s|{{date}}|$(date -I)|g" "${template}" > "${index}"
    else
      cat > "${index}" <<EOF
---
type: index
project: ${key}
project_name: "${human}"
created: $(date -I)
---

# ${human}

> Index for project key \`${key}\`. Links auto-maintained by Gale.

## Session log

## Retros

## Decisions

## Wiki

## Research

## Patterns / Workflow / Backlog

EOF
    fi
  fi

  local f base tail stem section link
  for f in "${VAULT_DIR}/${key}"--*.md; do
    [ -f "$f" ] || continue
    base=$(basename "$f")
    [ "$base" = "${key}--index.md" ] && continue
    tail="${base#${key}--}"
    stem="${tail%.md}"
    case "$stem" in
      session-log) section="## Session log" ; link="[[${key}--session-log]]" ;;
      patterns)    section="## Patterns / Workflow / Backlog" ; link="[[${key}--patterns]]" ;;
      workflow)    section="## Patterns / Workflow / Backlog" ; link="[[${key}--workflow]]" ;;
      backlog)     section="## Patterns / Workflow / Backlog" ; link="[[${key}--backlog]]" ;;
      retro-*)     section="## Retros"     ; link="[[${key}--${stem}|${stem#retro-}]]" ;;
      decision-*)  section="## Decisions"  ; link="[[${key}--${stem}|${stem#decision-}]]" ;;
      wiki-*)      section="## Wiki"       ; link="[[${key}--${stem}|${stem#wiki-}]]" ;;
      research-*)  section="## Research"   ; link="[[${key}--${stem}|${stem#research-}]]" ;;
      *) continue ;;
    esac
    if ! grep -qF "${link}" "${index}"; then
      awk -v sect="${section}" -v line="- ${link}" '
        { print }
        $0 == sect { print line }
      ' "${index}" > "${index}.tmp.$$" && mv "${index}.tmp.$$" "${index}"
    fi
  done

  rmdir "${lock}" 2>/dev/null || true
}

# ── Team name ─────────────────────────────────────────────────────────

team_name_for_key() {
  local key="$1"
  [ -n "${key}" ] || { printf 'hatbrains-unknown'; return; }
  local base
  base=$(printf '%s' "${key}" | awk -F- '{print $NF}')
  printf 'hatbrains-%s-%s' "${base:-unknown}" "$(key_hash "${key}")"
}

# ── Legacy helpers (unchanged behavior) ───────────────────────────────

detect_project_name() {
  local name
  name=$(gh repo view --json name -q '.name' 2>/dev/null || true)
  if [ -n "${name}" ]; then
    printf '%s' "${name}"
    return
  fi
  basename "$(pwd)"
}

# vault_find <type> [<project>]
# Returns newline-separated paths sorted by mtime (newest first).
# Restricted to vault root (maxdepth 1) — pre-migration, files may
# exist in legacy subdirs (decisions/) and won't be found by this.

vault_find() {
  local type="$1" project="${2:-}"
  [ -d "$VAULT_DIR" ] || return 0
  local matches
  matches=$(find "$VAULT_DIR" -maxdepth 1 -type f -name '*.md' \
            -exec grep -l "^type: ${type}$" {} + 2>/dev/null) || true
  [ -n "$matches" ] || return 0
  if [ -n "$project" ]; then
    matches=$(echo "$matches" | xargs grep -l "^project:.*${project}" 2>/dev/null) || true
  fi
  [ -n "$matches" ] || return 0
  echo "$matches" | xargs ls -t 2>/dev/null
}
