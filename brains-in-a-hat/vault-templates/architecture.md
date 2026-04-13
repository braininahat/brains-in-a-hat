---
type: architecture
write-path: "~/.brains_in_a_hat/vault/"
project: "{{key}}"
agents: [architect]
date: "{{date}}"
tags: [architecture]
status: active
---

<!--
Filename convention: <KEY>--research-<slug>.md (architecture notes use the research category).
After writing:
  source "$CLAUDE_PLUGIN_ROOT/hooks/lib-common.sh"
  ensure_vault_index "$KEY"
-->

# Architecture: {{title}}

## Overview
What was reviewed or designed.

## Key Decisions
- [[decision-x]]: rationale

## Concerns
- Boundary violations, coupling, etc.

## Diagram
(ASCII or mermaid if appropriate)
