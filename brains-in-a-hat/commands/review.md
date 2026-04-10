---
name: review
description: "Manual pre-commit QA advisory. Not automated — fire this when staging changes for commit."
allowed-tools: ["Agent", "Read", "Grep", "Glob", "Bash"]
---

# Review

Manual only. Not lifecycle-automated. Fire when staging changes for commit.

Spawn Chase (qa-engineer) to review staged changes.

## Process

1. Run `git diff --cached --name-only` and `git diff --name-only` to identify modified files
2. Spawn `qa-engineer` agent (model=sonnet)
3. QA runs tests, checks syntax, looks for regressions
4. Returns an advisory report — findings are informational, not blocking
5. Present the QA report to the user

## Note

This is advisory only. QA reports findings but never blocks commits. The user decides whether to act on the report.
