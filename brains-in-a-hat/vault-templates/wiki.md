---
type: wiki
write-path: "~/.brains_in_a_hat/vault/"
title: "{{title}}"
tags: []
source: {{source}}
project: "{{key}}"
date: "{{date}}"
status: active
---

<!--
Filename convention: <KEY>--wiki-<slug>.md at vault root.
Example: -home-varun-repos-esc-ultrasuite-analysis--wiki-ctc-decoding.md
After writing:
  source "$CLAUDE_PLUGIN_ROOT/hooks/lib-common.sh"
  ensure_vault_index "$KEY"
-->

# {{title}}

{{content}}

## Sources
- {{sources}}

## Related
- [[{{related}}]]
