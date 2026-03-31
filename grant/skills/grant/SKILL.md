---
description: "Visualize something — architecture, git activity, code flow, comparisons, or any question where seeing beats reading. Grant communicates through interactive HTML artifacts."
argument-hint: "[explain <topic> | analyze | compare <A> vs <B> | timeline | <any question>]"
allowed-tools: ["Agent", "Read", "Grep", "Glob", "Bash", "Write"]
---

# Grant — Visual-First Communicator

Spawn the `grant` agent to answer the user's question through an interactive HTML visualization.

## Process

1. Parse the user's request to determine what needs visualizing
2. Spawn `grant` agent (model=inherit, run_in_background=true)
3. Grant reads the codebase, gathers data, and writes a self-contained HTML artifact to `.claude/grant/`
4. Grant opens the artifact in the default browser
5. Present Grant's one-line summary to the user

## Argument Routing

| Invocation | What Grant Does |
|------------|-----------------|
| `/grant analyze` | Full repo analysis dashboard — structure, activity, complexity |
| `/grant explain <topic>` | Animated walkthrough of how `<topic>` works in this codebase |
| `/grant compare <A> vs <B>` | Side-by-side interactive comparison |
| `/grant timeline` | Git activity visualization — commits, branches, contributors |
| `/grant <any question>` | Grant picks the best visualization for the question |

## Examples

- `/grant explain the authentication flow`
- `/grant analyze`
- `/grant compare REST vs GraphQL for our API`
- `/grant timeline`
- `/grant where are the most complex files?`
- `/grant how do the agents communicate?`
