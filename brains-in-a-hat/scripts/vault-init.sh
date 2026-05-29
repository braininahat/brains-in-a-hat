#!/usr/bin/env bash
#
# vault-init.sh — Bootstrap and detect the brains-in-a-hat personal vault.
#
# The vault is a git repository the user owns (typically a private GitHub
# repo named `hatbrains-vault`). Librarian uses it as external memory,
# pulling/pushing every TeammateIdle tick to keep multi-device state in sync.
#
# Usage:
#   vault-init.sh detect                      # print JSON status; no changes
#   vault-init.sh init [<path>]               # `git init` an empty vault locally
#   vault-init.sh clone [<repo>] [<path>]     # `git clone` an existing vault
#   vault-init.sh auto                        # detect + recommend (no changes)
#   vault-init.sh                             # alias for `auto`
#
# Defaults:
#   <path>  = $BRAINS_VAULT_DIR if set, else ~/.hatbrains
#   <repo>  = $BRAINS_VAULT_REPO if set, else <gh-user>/hatbrains-vault
#
# The script never makes destructive changes silently — `init` errors if the
# target already exists as a git repo, and `clone` errors if the target
# already exists.
set -euo pipefail

DEFAULT_VAULT_PATH="${BRAINS_VAULT_DIR:-${HOME}/.hatbrains}"
DEFAULT_REPO_NAME="hatbrains-vault"

CMD="${1:-auto}"
shift || true

_gh_user() {
  gh api user --jq .login 2>/dev/null || true
}

_default_repo() {
  if [ -n "${BRAINS_VAULT_REPO:-}" ]; then
    printf '%s' "$BRAINS_VAULT_REPO"
    return
  fi
  local user
  user=$(_gh_user)
  [ -n "$user" ] || return 0
  printf '%s/%s' "$user" "$DEFAULT_REPO_NAME"
}

_remote_exists() {
  local repo="$1"
  [ -n "$repo" ] || return 1
  gh repo view "$repo" >/dev/null 2>&1
}

case "$CMD" in
  detect | auto)
    path="${1:-$DEFAULT_VAULT_PATH}"
    repo=$(_default_repo)
    exists_local=false
    is_git=false
    has_remote=false
    if [ -d "$path" ]; then
      exists_local=true
      if git -C "$path" rev-parse --git-dir >/dev/null 2>&1; then
        is_git=true
      fi
    fi
    if _remote_exists "$repo"; then
      has_remote=true
    fi

    printf '{ "path": "%s", "repo": "%s", "exists_local": %s, "is_git": %s, "has_remote": %s }\n' \
      "$path" "$repo" "$exists_local" "$is_git" "$has_remote"

    if [ "$CMD" = "auto" ]; then
      echo
      if [ "$is_git" = "true" ]; then
        echo "Vault is ready at $path (git repo)."
      elif [ "$exists_local" = "true" ]; then
        echo "Directory exists at $path but is not a git repo."
        echo "  Run: $(basename "$0") init \"$path\""
      elif [ "$has_remote" = "true" ]; then
        echo "Remote vault detected at $repo."
        echo "  Run: $(basename "$0") clone \"$repo\" \"$path\""
      else
        echo "No vault found locally or on GitHub."
        echo "  To start fresh: $(basename "$0") init \"$path\""
        echo "  Then add a remote with: gh repo create --private --source=\"$path\" --push"
      fi
    fi
    ;;

  init)
    path="${1:-$DEFAULT_VAULT_PATH}"
    if [ -e "$path" ] && [ ! -d "$path" ]; then
      echo "Refusing to init: $path exists and is not a directory." >&2
      exit 1
    fi
    if [ -d "$path" ] && git -C "$path" rev-parse --git-dir >/dev/null 2>&1; then
      echo "Already a git repo at $path — nothing to init." >&2
      exit 0
    fi
    mkdir -p "$path"
    (
      cd "$path"
      git init -q
      mkdir -p attachments
      if [ ! -f README.md ]; then
        cat > README.md <<'README'
# brains-in-a-hat vault

Personal external memory for the brains-in-a-hat Claude Code plugin.

## Layout — flat, no directories

All notes at vault root (plus `attachments/` for images). Discovery is
frontmatter-driven; structure is virtual via Dataview queries in `index.md`.

```
<vault>/
├── index.md                                # top-level dashboard
├── <repoKey>--learnings.md                 # per-repo learnings
├── <projectGroup>--shared--learnings.md    # cross-repo learnings
├── <projectGroup>--session-log.md          # chronological session log
├── <descriptor>--decision.md               # one file per decision
├── <concept>.md                            # wiki entries
└── attachments/                            # images, plots, etc.
```

Every file uses YAML frontmatter (`type`, `projectGroup`, `repoKey`, `date`,
`status`, `tags`, `related`, `superproject`) — Dataview-queryable in Obsidian.

## Sync

Librarian runs `git pull --rebase --autostash` on session start and on every
TeammateIdle tick, commits, and pushes immediately. Add a remote to enable
multi-device sync:

```bash
gh repo create hatbrains-vault --private --source=. --push
```
README
      fi
      git add .
      git -c user.email=brains-in-a-hat@local -c user.name="brains-in-a-hat" commit -q -m "init: empty vault"
    )
    echo "Initialized vault at $path"
    echo "Add to your shell: export BRAINS_VAULT_DIR=$path"
    echo "Add a remote: gh repo create hatbrains-vault --private --source=\"$path\" --push"
    ;;

  clone)
    repo="${1:-$(_default_repo)}"
    path="${2:-$DEFAULT_VAULT_PATH}"
    if [ -z "$repo" ]; then
      echo "No repo specified and no \$BRAINS_VAULT_REPO / default could be derived." >&2
      echo "Usage: $(basename "$0") clone <owner/repo> [<path>]" >&2
      exit 1
    fi
    if [ -e "$path" ]; then
      echo "Refusing to clone: $path already exists." >&2
      echo "Move it aside first, or pass a different path." >&2
      exit 1
    fi
    gh repo clone "$repo" "$path"
    echo "Cloned $repo to $path"
    echo "Add to your shell: export BRAINS_VAULT_DIR=$path"
    ;;

  *)
    echo "Usage: $(basename "$0") {detect|auto|init|clone} [args...]" >&2
    exit 2
    ;;
esac
