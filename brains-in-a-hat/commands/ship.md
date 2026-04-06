---
name: ship
description: "Ship changes: fetch, branch, commit, push, create PR, and optionally merge. Usage: /ship [branch-name] [--merge]"
allowed-tools: ["Bash", "Read", "Grep", "Glob"]
---

# Ship

Automates the full shipping workflow: fetch, branch, commit, push, PR, merge.

## Arguments

Parse the user's arguments from `$ARGUMENTS`:
- First positional arg: branch name (optional — auto-generated from changes if omitted)
- `--merge` or `-m`: also merge the PR after creation
- `--draft`: create as draft PR
- Anything in quotes after `--title` or `-t`: PR title override
- Anything in quotes after `--msg`: commit message override

## Process

Execute these steps in order. Stop and report if any step fails.

### 1. Pre-flight checks

```bash
git fetch origin
git status
git diff --cached --stat
git diff --stat
git log --oneline -5
```

- Confirm there are changes to ship (staged, unstaged, or untracked). If clean, abort with message.
- Identify the main/default branch (`main` or `master`).
- Check for merge conflicts with the base branch: `git merge-tree $(git merge-base HEAD origin/<main>) HEAD origin/<main>` — warn if conflicts detected.

### 2. Stage changes

- If there are unstaged or untracked changes, show them and stage all relevant files: `git add` specific files (avoid `.env`, credentials, large binaries).
- If only staged changes exist, use those as-is.
- Show `git diff --cached --stat` to confirm what will be committed.

### 3. Create branch

- If on the main branch, create and switch to a new branch:
  - Use the provided branch name, OR
  - Auto-generate: take the most-changed directory + a 2-3 word summary of changes, kebab-case (e.g., `feat/hooks-vault-bypass`, `fix/docx-claim-renumbering`)
- If already on a feature branch, stay on it.
- Run `git pull origin <current-branch> --rebase` if the branch exists on remote, to incorporate any upstream changes.

### 4. Commit

- Auto-generate a commit message by analyzing the staged diff:
  - Summarize the nature of the changes (feat/fix/refactor/docs/chore)
  - Focus on the "why" not the "what"
  - Keep to 1-2 sentences
- If `--msg` was provided, use that instead.
- Commit using a HEREDOC for the message:
  ```bash
  git commit -m "$(cat <<'EOF'
  <message>
  EOF
  )"
  ```
- If pre-commit hooks fail, report the failure and stop. Do NOT use `--no-verify`.

### 5. Push

```bash
git push -u origin <branch-name>
```

### 6. Create PR

- Generate a PR title (short, under 70 chars) or use `--title` override.
- Generate a PR body with:
  - `## Summary` — 1-3 bullet points from the commit(s)
  - `## Test plan` — checklist of verification steps
- Create the PR:
  ```bash
  gh pr create --title "<title>" --body "$(cat <<'EOF'
  <body>
  EOF
  )"
  ```
- If `--draft` was specified, add `--draft` flag.
- Report the PR URL.

### 7. Merge (if --merge)

Only if `--merge` was passed:
- Wait for CI checks: `gh pr checks <pr-number> --watch` (timeout 5 minutes)
- If checks pass: `gh pr merge <pr-number> --squash --delete-branch`
- If checks fail: report the failures and skip merge
- After merge, switch back to main and pull: `git checkout <main> && git pull origin <main>`

## Output

At the end, print a summary:

```
Shipped: <branch> → <base>
PR: <url>
Status: <merged | open | draft>
```
