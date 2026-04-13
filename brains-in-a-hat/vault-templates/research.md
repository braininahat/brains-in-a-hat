---
type: research
write-path: "~/.brains_in_a_hat/vault/"
project: "{{key}}"
agents: [researcher]
date: "{{date}}"
tags: [research]
status: active
---

<!--
Filename convention: <KEY>--research-<topic-slug>.md at vault root.
After writing:
  source "$CLAUDE_PLUGIN_ROOT/hooks/lib-common.sh"
  ensure_vault_index "$KEY"
-->

# Research: {{topic}}

## Question
What we're trying to decide or understand.

## Options Evaluated
| Criterion | Option A | Option B | Option C |
|-----------|----------|----------|----------|
| ...       | ...      | ...      | ...      |

## Recommendation
Option X because [evidence-based reasoning].

Referenced by: [[decision-y]] (link to the decision this research informed)

## Sources
- [links to docs, papers, repos]
