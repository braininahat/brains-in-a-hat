#!/usr/bin/env bash
#
# lib-common.sh — Shared utility functions for brains-in-a-hat hooks
#
# Source this file from other hook scripts:
#   source "$(dirname "${BASH_SOURCE[0]}")/lib-common.sh"

# BRAINS_VAULT_DIR: user-facing env var pointing at the user's personal vault git repo.
# The vault is expected to be a git repository — Librarian pulls/commits/pushes
# to keep it synced across devices. Recommended setup:
#   git clone <your-private-vault-repo-url> ~/.hatbrains
#   export BRAINS_VAULT_DIR=~/.hatbrains
# Or use `scripts/vault-init.sh` to bootstrap a fresh vault locally and add a
# remote later.
#
# Resolution order (first hit wins):
#   1. $BRAINS_VAULT_DIR (explicit user setting)
#   2. existing $VAULT_DIR from caller (legacy)
#   3. ~/.hatbrains (canonical default)
#   4. ~/.brains_in_a_hat/vault (legacy fallback for pre-1.0.0 installs)
if [ -n "${BRAINS_VAULT_DIR:-}" ]; then
  VAULT_DIR="${BRAINS_VAULT_DIR}"
elif [ -n "${VAULT_DIR:-}" ]; then
  :  # Use whatever the caller set
elif [ -d "${HOME}/.hatbrains" ]; then
  VAULT_DIR="${HOME}/.hatbrains"
else
  VAULT_DIR="${HOME}/.brains_in_a_hat/vault"  # legacy fallback
fi
export VAULT_DIR

# ── Project detection ─────────────────────────────────────────────────

# detect_project_name — legacy; returns a single name. Prefer derive_project_key.
detect_project_name() {
  local name
  name=$(gh repo view --json name -q '.name' 2>/dev/null || true)
  if [ -n "${name}" ]; then
    printf '%s' "${name}"
    return
  fi
  basename "$(pwd)"
}

# Read a string field from .brains_in_a_hat/project.json in the current repo.
# Returns empty if file or key missing. Pure-bash JSON read (no jq dependency).
_project_json_get() {
  local key="$1"
  local repo_root
  repo_root=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
  local file="${repo_root}/.brains_in_a_hat/project.json"
  [ -f "$file" ] || return 0
  if command -v jq >/dev/null 2>&1; then
    jq -r --arg k "$key" '.[$k] // empty' "$file" 2>/dev/null
  else
    # Tolerant of compact or pretty JSON; matches "key": "value"
    grep -oE "\"${key}\"[[:space:]]*:[[:space:]]*\"[^\"]+\"" "$file" 2>/dev/null \
      | head -1 \
      | sed -E "s/\"${key}\"[[:space:]]*:[[:space:]]*\"([^\"]+)\"/\1/"
  fi
}

# Normalize a string into a vault-safe key: lowercase, alphanumerics + hyphens.
_slugify() {
  echo "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g'
}

# derive_project_key — the canonical key for THIS repo. Stable across worktrees
# and clone paths because it prefers committed config (project.json) and the
# git remote URL over filesystem-derived names.
#
# Resolution order:
#   1. .brains_in_a_hat/project.json:repoKey
#   2. basename of `git remote get-url origin` stripped of credentials and .git
#   3. basename of repo toplevel
derive_project_key() {
  local key
  key=$(_project_json_get repoKey)
  if [ -n "$key" ]; then
    _slugify "$key"
    return
  fi

  local remote
  remote=$(git remote get-url origin 2>/dev/null || true)
  if [ -n "$remote" ]; then
    # Strip credentials, protocol, and .git suffix; take the repo name
    remote=${remote%%.git}
    remote=${remote##*[:/]}
    if [ -n "$remote" ]; then
      _slugify "$remote"
      return
    fi
  fi

  local toplevel
  toplevel=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
  _slugify "$(basename "$toplevel")"
}

# derive_project_group — the constellation this repo belongs to. Multiple repos
# can share a projectGroup (e.g., pulse-model + pulse-ui + pulse-paper all
# declare projectGroup: pulse). Repos without a declared group fall into "_solo".
#
# Resolution order:
#   1. .brains_in_a_hat/project.json:projectGroup
#   2. "_solo" (intentional sentinel; ungrouped repos still get a stable path)
derive_project_group() {
  local group
  group=$(_project_json_get projectGroup)
  if [ -n "$group" ]; then
    _slugify "$group"
    return
  fi
  echo "_solo"
}

# vault_group_dir — full path to this project group's vault subdir.
# Creates it (and the vault root) if missing. Does NOT git-init the vault —
# that's vault-init.sh's job.
vault_group_dir() {
  local group
  group=$(derive_project_group)
  local dir="${VAULT_DIR}/${group}"
  mkdir -p "$dir" 2>/dev/null || true
  printf '%s' "$dir"
}

# vault_is_git_repo — exits 0 if VAULT_DIR is a git working tree, 1 otherwise.
# Useful for hooks that want to warn the user about lost sync.
vault_is_git_repo() {
  [ -d "${VAULT_DIR}/.git" ] || git -C "$VAULT_DIR" rev-parse --git-dir >/dev/null 2>&1
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
