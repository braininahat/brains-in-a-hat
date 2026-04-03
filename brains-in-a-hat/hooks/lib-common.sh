#!/usr/bin/env bash
# lib-common.sh — Shared helpers for brains-in-a-hat hooks

detect_project_name() {
  local name
  name=$(gh repo view --json name -q '.name' 2>/dev/null || true)
  if [ -n "${name}" ]; then
    printf '%s' "${name}"
    return
  fi
  basename "$(pwd)"
}
