---
name: delegate
description: Delegate drafting work to the local Qwen Code CLI via headless mode. Use when the user asks to "use minion", "delegate to qwen", "draft with qwen", or proactively when the task is (a) bounded and well-specified code generation, (b) review/analysis of code that fits in the prompt, or (c) batch boilerplate the user will review before shipping. Do NOT use for open-ended architecture work, honesty-critical judgement calls, or anything that will ship without human review.
user-invocable: true
argument-hint: <task description>
---

# /minion:delegate — Qwen CLI Delegation Workflow

**Opus plans and reviews. Qwen drafts code. No MCP server, no llama-server autospawn.**

Drafting is delegated to `qwen -p` (headless). Opus (you) builds the structured prompt, qwen generates, Opus reviews, Opus applies via Write/Edit. Qwen never writes to the filesystem directly — its output is a string that Opus decides what to do with.

## Prerequisites (one-time, don't reinvoke unless failing)

- `command -v qwen` returns a path. If missing: tell the user to `npm install -g @qwen-code/qwen-code` and stop.
- A qwen-compatible backend is reachable. Usually that's `llama-qwen` (user's zshrc alias) serving on `http://localhost:8000/v1`. If the server is down, tell the user to start it — do NOT autospawn.
- Qwen config at `~/.qwen/settings.json` points at the intended backend. Skill does not modify it.

## When to delegate

| Task shape | Delegate? | Why |
|---|---|---|
| Write function/class from explicit spec + tests | YES | Qwen follows explicit requirements well. Fast. |
| Review a bounded module for real bugs | YES | With a forced-commitment answer format qwen is honest. |
| Draft a commit message from `git diff --cached` | YES | Strictly scoped. Claude reviews before committing. |
| Generate docstrings / boilerplate over many files | YES | Great fit for `qwen -c` session-warmed batching. |
| Refactor preserving behavior | SOMETIMES | Works for single-file. Verify with tests after. |
| Architecture decision / design doc | NO | Qwen fills in exactly what you ask; doesn't infer constraints. Stay in Opus. |
| Honesty call on subtle bug | ONLY with forced-commit format | Qwen hedges unless instructed otherwise. |
| Multi-file reasoning across a large codebase | NO | Use Opus subagents or `devstral` agent mode instead. |
| Anything that ships without human review | NO | Qwen produces subtly-wrong code if the spec is under-specified. |

## The structured-prompt template (non-negotiable)

Qwen does what you explicitly ask and nothing more. Implicit expectations that Sonnet/Opus would infer (use `re.fullmatch` not `re.match`, include `import pytest`, etc.) must be spelled out, or qwen will miss them. Benchmark evidence: tone-only reframes ("you are a senior engineer, self-review") do NOT close the gap. Explicit numbered requirements do.

Every delegated prompt must have this structure:

```
TASK: <one-sentence summary>

REQUIREMENTS:
1. <explicit behavior>
2. <explicit behavior>
3. <edge case to handle>
...

ANTI-REQUIREMENTS:
- <common wrong approach to avoid>
- <pattern to NOT use>

TESTS (if applicable): <exact cases to cover, with expected inputs/outputs>

OUTPUT FORMAT: <exact constraints — "single fenced python code block, no preamble, no trailing prose">
```

If you cannot fill in every section, the task is probably too open-ended for delegation — stay in Opus.

## Invocation patterns

All go through `scripts/qwen-delegate.sh`. Four shapes matter.

### Pattern 1 — Pure codegen (no tools needed)

Prompt contains everything qwen needs. No filesystem access. Safest shape.

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/qwen-delegate.sh" coder <<'PROMPT'
TASK: Implement parse_iso8601_duration.

REQUIREMENTS:
1. Signature: parse_iso8601_duration(s: str) -> datetime.timedelta
2. Use re.fullmatch (NOT re.match) so trailing garbage is rejected
3. Support fractional seconds: "PT1.5S" must work — convert via float(), not int()
4. Reject weeks (W), months, and bare "P"/"PT" with ValueError
5. Non-str input raises ValueError

ANTI-REQUIREMENTS:
- Do NOT use re.match (accepts partial matches)
- Do NOT forget to import pytest in the test section
- Do NOT put `if __name__ == "__main__":` before the test function defs

TESTS: (exactly 3)
- parse("PT5H3M2S") == timedelta(hours=5, minutes=3, seconds=2)
- parse("PT1.5S") == timedelta(seconds=1.5)
- parse("garbage") raises ValueError

OUTPUT FORMAT: single fenced python code block, no preamble, no trailing prose
PROMPT
```

### Pattern 2 — Review/analysis of code you paste in

Stdin-piped content + analyst persona. Still no filesystem tools.

```bash
cat path/to/module.py | bash "${CLAUDE_PLUGIN_ROOT}/scripts/qwen-delegate.sh" analyst \
  'TASK: Review for real bugs.
  REQUIREMENTS:
  1. List only bugs that would cause incorrect behavior or crashes.
  2. Format: one bullet per bug as "- line N: <description>".
  3. If none: respond with exactly "no bugs".
  ANTI-REQUIREMENTS:
  - Do not flag style, missing docstrings, missing type hints, or "consider" suggestions.
  - Do not hedge or list edge cases for robustness.
  OUTPUT FORMAT: bullets only, no preamble, no trailing prose.'
```

### Pattern 3 — Investigation requiring file access

Only when the task genuinely needs qwen to read multiple files. Use read-only tools ONLY. Never `--yolo`.

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/qwen-delegate.sh" analyst --allow-read <<'PROMPT'
TASK: Find all call sites of my_function in src/.

REQUIREMENTS:
1. Use grep_search to enumerate matches.
2. For each match, emit "path:line — <one-line context>".
3. Do not read files you don't need to.

OUTPUT FORMAT: one line per call site. No preamble.
PROMPT
```

`--allow-read` enables only `read_file,grep_search,list_directory,glob`. It does NOT enable write/edit/shell tools. If you think you need those, use Claude's own tools instead — qwen is not the right delegate.

### Pattern 4 — Session-warmed batching

When delegating many related calls, the 15K-token baseline overhead caches across a warm session:

```bash
SID=$(uuidgen)
for f in src/*.py ; do
  bash "${CLAUDE_PLUGIN_ROOT}/scripts/qwen-delegate.sh" analyst --session "$SID" "$(cat <<EOF
TASK: Summarize public API of $(basename "$f").
... (structured prompt) ...
EOF
)"
done
```

## Output handling

`qwen-delegate.sh` returns the `.result` field from qwen's JSON output on stdout. On failure (API error, malformed JSON) it exits non-zero and emits diagnostics on stderr. The JSON also contains usage stats (tokens, duration) logged to `/tmp/qwen-delegate-<session>.log` for debugging.

Capture into a variable and review before applying:

```bash
draft="$(bash "${CLAUDE_PLUGIN_ROOT}/scripts/qwen-delegate.sh" coder <<'PROMPT'
...
PROMPT
)"

echo "$draft"  # you read this
# after manual review:
# - use Write/Edit to apply to the target file
# - or discard and re-delegate with refined requirements
```

## Review checklist before applying qwen's output

Opus MUST check these before hitting Write/Edit:

- **Requirements satisfied?** Walk the numbered list. Each one met?
- **Anti-requirements respected?** Did qwen slip in the thing you told it to avoid?
- **Output format exactly?** Single fenced block if you asked for one, not two. No stray preamble.
- **Imports / setup lines?** Qwen often forgets `import pytest` if tests use `pytest.raises`. Or puts `__main__` blocks before test function defs. Catch these.
- **Silent regressions?** For refactors: would every caller still work?
- **Honesty?** On review/analysis tasks, did qwen commit (the "no bugs" answer) or hedge? Hedging means the prompt didn't force commitment — re-delegate with stricter format.

If any check fails: either fix in place with Edit, or re-delegate with refined requirements. Never apply qwen's output blindly.

## What NOT to do

- **Do NOT use `--yolo`** or `--approval-mode yolo`. That auto-approves every tool call, including shell. Read-only investigation is fine; shell/write is not.
- **Do NOT give qwen write tools.** Qwen generates output, Opus applies. No exceptions.
- **Do NOT delegate honesty calls without the forced-commit format** ("respond with exactly X or Y, no prose"). Qwen hedges on open honesty questions.
- **Do NOT skip the structured template.** Free-form prompts produce subtly-buggy qwen output. Benchmark-proven.
- **Do NOT autospawn the llama-server.** If it's not running, tell the user to start it via their zshrc alias. The minion plugin has no server-lifecycle code.

## Activation

Set the active flag so the advisory hook fires on Write/Edit/Bash:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/hooks/lib.sh" && activate
```

When done:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/hooks/lib.sh" && deactivate
```

State lives at `.minion/state/active.<pid>` relative to the project's git root. The advisor hook reads this flag; without activation, the plugin stays silent.

## Personas

- `coder` → loaded from `${CLAUDE_PLUGIN_ROOT}/personas/coder.md`. Use for code generation tasks.
- `analyst` → loaded from `${CLAUDE_PLUGIN_ROOT}/personas/analyst.md`. Use for review/analysis.

Both are injected via `--append-system-prompt` by `qwen-delegate.sh`. They tell qwen to self-check against the caller's requirements before returning. They do NOT replace the structured template — they complement it.

## When qwen is genuinely the wrong tool

Signs you should stop and do it yourself (or use an Opus subagent):

- You cannot enumerate explicit requirements → task is too open-ended.
- The task requires multi-file reasoning across >5 files → context cost + qwen's literal-following bite.
- The task is honesty-critical with nuanced judgement ("is this a security issue? is this the right abstraction?") → qwen hedges or fabricates.
- The output will ship without review → don't.

## Troubleshooting

- `command not found: qwen` → uninstalled. `npm install -g @qwen-code/qwen-code`.
- `[API Error: Connection error. (cause: fetch failed)]` in the JSON → llama-server is down or unreachable. Check `curl http://localhost:8000/v1/models`. Tell user to start their `llama-qwen` alias.
- Empty `output_tokens` in the JSON → the API call errored; check the `result` field for the `[API Error]` string.
- Output is truncated → raise qwen's output budget (it's already generous by default; more often the model stopped at natural end).
