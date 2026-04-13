#!/usr/bin/env bash
#
# lib-common.sh — Shared utility functions for brains-in-a-hat hooks
#
# Source this file from other hook scripts:
#   source "$(dirname "${BASH_SOURCE[0]}")/lib-common.sh"

VAULT_DIR="${VAULT_DIR:-${HOME}/.brains_in_a_hat/vault}"

# ── Project detection ─────────────────────────────────────────────────

detect_project_name() {
  local name
  name=$(gh repo view --json name -q '.name' 2>/dev/null || true)
  if [ -n "${name}" ]; then
    printf '%s' "${name}"
    return
  fi
  basename "$(pwd)"
}

# ── Vault lookup ──────────────────────────────────────────────────────
# vault_find <type> [<project>]
# Searches entire vault (flat root + legacy subdirs) by frontmatter properties.
# Returns newline-separated paths sorted by modification time (newest first).

vault_find() {
  local type="$1" project="${2:-}"
  [ -d "$VAULT_DIR" ] || return 0
  local matches
  matches=$(grep -rl "^type: ${type}$" "$VAULT_DIR" --include='*.md' 2>/dev/null) || true
  [ -n "$matches" ] || return 0
  if [ -n "$project" ]; then
    matches=$(echo "$matches" | xargs grep -l "^project:.*${project}" 2>/dev/null) || true
  fi
  [ -n "$matches" ] || return 0
  echo "$matches" | xargs ls -t 2>/dev/null
}
