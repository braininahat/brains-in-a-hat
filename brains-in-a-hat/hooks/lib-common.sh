#!/usr/bin/env bash
#
# lib-common.sh — Shared utility functions for brains-in-a-hat hooks
#
# Source this file from other hook scripts:
#   source "$(dirname "${BASH_SOURCE[0]}")/lib-common.sh"

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
