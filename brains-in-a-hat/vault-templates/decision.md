---
type: decision
write-path: "~/.brains_in_a_hat/vault/"
project: "{{key}}"
agents: []
date: "{{date}}"
tags: [decision]
status: active
---

<!--
Filename convention: <KEY>--decision-<slug>.md at vault root.
After writing:
  source "$CLAUDE_PLUGIN_ROOT/hooks/lib-common.sh"
  ensure_vault_index "$KEY"
-->

# Decision: {{title}}

## Context
Why this decision was needed. Link to the [[retro-{{date}}]] or task that prompted it.

## Options Considered
- **Option A**: description — tradeoff analysis
- **Option B**: description — tradeoff analysis

## Decision
What was decided and why. Reference the recommending agent: [[agent-{{agent}}]].

## Consequences
- Affected components: [[component-x]]
- Supersedes: [[decision-previous]] (if applicable, set that note's status to `superseded`)
- Follow-up: what needs to happen next
