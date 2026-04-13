#!/usr/bin/env bash
#
# migrate-state-layout.sh — one-shot migration to per-key state layout.
#
# v0.7+ moves all runtime state out of in-tree .brains_in_a_hat/state/ to
# ~/.brains_in_a_hat/state/<KEY>/, and renames vault files from
# <project>--*.md to <KEY>--*.md so two checkouts of the same repo don't
# collide on the gh repo name.
#
# Idempotent. Safe to re-run. --dry shows what would change without writing.
#
# Actions:
#   1. Build {project_path → key} and {gh_name → key} maps from
#      ~/.brains_in_a_hat/active-sessions.jsonl (so we know which projects
#      have ever activated the team and what their canonical keys are).
#   2. For each known project: move its in-tree .brains_in_a_hat/state/
#      contents to ~/.brains_in_a_hat/state/<key>/.
#   3. Rename vault files <project>--*.md → <key>--*.md (using gh_name → key).
#   4. Bootstrap per-project index notes via ensure_vault_index for each key.
#   5. Park rogue files at ~/.brains_in_a_hat/state/* root level (from the
#      cwd-relative bug pre-v0.7) under ~/.brains_in_a_hat/state/_orphaned/.
#   6. Best-effort: rewrite `project:` frontmatter in vault notes to use KEY.

set -euo pipefail

DRY=0
[ "${1:-}" = "--dry" ] && DRY=1

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
PLUGIN_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
source "${PLUGIN_ROOT}/hooks/lib-common.sh"

# Make ensure_vault_index find its template
export CLAUDE_PLUGIN_ROOT="${PLUGIN_ROOT}"

say() { echo "[migrate] $*"; }
warn() { echo "[migrate] WARNING: $*" >&2; }
run() {
  if [ "$DRY" = "1" ]; then
    echo "+ $*"
  else
    "$@"
  fi
}

# ── Step 1: build project → key and gh-name → key maps ───────────────

declare -A PROJECT_KEYS   # absolute project path → key
declare -A NAME_KEYS      # gh repo name → key (with collision detection)
declare -A NAME_PATHS     # gh repo name → first project path seen (for collision msg)

if [ -f "${BIH_HOME}/active-sessions.jsonl" ]; then
  while IFS= read -r line; do
    p=$(echo "$line" | jq -r '.project // empty' 2>/dev/null) || continue
    n=$(echo "$line" | jq -r '.name // empty' 2>/dev/null) || true
    k=$(echo "$line" | jq -r '.key // empty' 2>/dev/null) || true
    [ -n "$p" ] || continue
    if [ -z "$k" ] || [ "$k" = "null" ]; then
      # Legacy entry (no .key field): compute key from project path.
      # realpath fails on missing/unmounted paths — fall back to the
      # raw path verbatim so dead entries don't abort the script.
      resolved=$(realpath "$p" 2>/dev/null || true)
      [ -n "$resolved" ] || resolved="$p"
      k=$(printf '%s' "$resolved" | sed 's|/|-|g')
      [[ "$k" == -* ]] || k="-${k#-}"
    fi
    PROJECT_KEYS["$p"]="$k"
    if [ -n "$n" ] && [ "$n" != "null" ]; then
      if [ -n "${NAME_KEYS[$n]:-}" ] && [ "${NAME_KEYS[$n]}" != "$k" ]; then
        warn "gh repo name collision: '$n' maps to BOTH '${NAME_KEYS[$n]}' (from ${NAME_PATHS[$n]}) and '$k' (from $p). First-wins applied; verify manually."
      else
        NAME_KEYS["$n"]="$k"
        NAME_PATHS["$n"]="$p"
      fi
    fi
  done < "${BIH_HOME}/active-sessions.jsonl"
fi
say "Discovered ${#PROJECT_KEYS[@]} project(s) in active-sessions.jsonl"

# ── Step 2: relocate in-tree state to per-key dirs ───────────────────

for proj in "${!PROJECT_KEYS[@]}"; do
  key="${PROJECT_KEYS[$proj]}"
  old="${proj}/.brains_in_a_hat/state"
  [ -d "$old" ] || continue
  new=$(state_dir "$key")
  say "Move in-tree state: $old → $new"
  run mkdir -p "$new"
  if [ "$DRY" = "1" ]; then
    echo "+ cp -a $old/. $new/ && rm -rf $old"
  else
    cp -a "$old/." "$new/" 2>/dev/null || true
    rm -rf "$old" 2>/dev/null || true
  fi
done

# ── Step 3: rename vault files <project>--*.md → <key>--*.md ─────────

if [ -d "$VAULT_DIR" ]; then
  shopt -s nullglob
  for f in "${VAULT_DIR}"/*.md; do
    [ -f "$f" ] || continue
    base=$(basename "$f")
    # Skip files that don't match the prefix pattern
    case "$base" in
      *--*) ;;
      *) continue ;;
    esac
    prefix="${base%%--*}"
    rest="${base#*--}"
    # Skip if already key-prefixed (starts with -)
    case "$prefix" in
      -*) continue ;;
    esac
    new_key="${NAME_KEYS[$prefix]:-}"
    if [ -z "$new_key" ]; then
      say "SKIP rename: $base (no key mapping for prefix '$prefix')"
      continue
    fi
    new_name="${new_key}--${rest}"
    new_path="${VAULT_DIR}/${new_name}"
    if [ "$f" = "$new_path" ]; then
      continue
    fi
    if [ -e "$new_path" ]; then
      warn "rename conflict: $new_path already exists, skipping $base"
      continue
    fi
    say "Rename: $base → $new_name"
    run mv "$f" "$new_path"
  done
  shopt -u nullglob
fi

# ── Step 4: bootstrap per-project index notes ────────────────────────

for key in "${PROJECT_KEYS[@]}"; do
  if [ "$DRY" = "1" ]; then
    echo "+ ensure_vault_index $key"
  else
    ensure_vault_index "$key" 2>/dev/null || warn "ensure_vault_index $key failed"
  fi
done

# ── Step 5: park rogue files at state root ───────────────────────────

shopt -s nullglob
orphaned="${STATE_ROOT}/_orphaned"
ROGUES=("${STATE_ROOT}"/*)
ANY_ROGUE=0
for f in "${ROGUES[@]}"; do
  [ -f "$f" ] || continue
  ANY_ROGUE=1
  break
done
if [ "$ANY_ROGUE" = "1" ]; then
  run mkdir -p "$orphaned"
  for f in "${STATE_ROOT}"/*; do
    [ -f "$f" ] || continue
    say "Orphan: $(basename "$f") → _orphaned/"
    run mv "$f" "$orphaned/"
  done
fi
shopt -u nullglob

# ── Step 6: rewrite project: frontmatter to use KEY (best-effort) ────

if [ -d "$VAULT_DIR" ]; then
  shopt -s nullglob
  for f in "${VAULT_DIR}"/*.md; do
    [ -f "$f" ] || continue
    base=$(basename "$f")
    case "$base" in
      -*--*) ;;
      *) continue ;;
    esac
    key="${base%%--*}"
    if grep -q '^project:' "$f" 2>/dev/null; then
      if [ "$DRY" = "1" ]; then
        echo "+ sed -i 's|^project:.*|project: \"${key}\"|' $f"
      else
        sed -i "s|^project:.*|project: \"${key}\"|" "$f"
      fi
    fi
  done
  shopt -u nullglob
fi

say "Migration complete."
[ -d "$orphaned" ] && say "Review ${orphaned} for keep/delete decisions."
[ "$DRY" = "1" ] && say "(dry run — no changes applied)"
