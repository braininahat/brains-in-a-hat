# minion Plugin

**Opus plans and reviews. Devstral generates code.**

This plugin wires a local Devstral 24B model into your Claude Code workflow as a code-generation minion. Opus (you) retains architectural judgment and code review. Devstral handles implementation throughput.

## Activation

Run `/minion:delegate` to activate the delegation workflow. This sets an active flag and primes the workflow described below.

## Prompt flow

1. Opus reads the codebase and designs the approach
2. Opus crafts a precise, scoped prompt for each implementation task
3. Opus calls `ask_devstral_agent` with the prompt and project cwd
4. Devstral explores the codebase (read-only: read_file, grep, glob_files, ls) and returns implementation
5. Opus reviews the output for correctness, style, and completeness
6. Opus applies the result using Write/Edit tools

Devstral never acts autonomously — it only responds to prompts crafted by Opus.

## MCP tools

- `ask_devstral(prompt, system?, max_tokens?)` — one-shot stateless query
- `ask_devstral_agent(prompt, cwd?, system?, persona?, max_tokens?, max_iterations?)` — agentic loop with read-only codebase tools
- `ensure_server()` — checks if llama-server is healthy on localhost:8000; auto-spawns with optimal config if not running

## Auto-spawn

The `ensure_server` tool detects available VRAM via nvidia-smi and selects the optimal model+quant+KV config automatically:
- Default: Devstral Q4_K_XL + bf16 KV (fits any 24GB GPU)
- If >20GB free VRAM: Devstral Q5_K_XL

Call `ensure_server` before the first `ask_devstral_agent` call if you're unsure whether the server is running.

## Hook behavior

When the minion is active, a PreToolUse advisory hook fires on Write/Edit/NotebookEdit/Bash tool calls that target source code files (.py, .ts, .js, .rs, .go, .cpp, etc.). The hook never blocks — it suggests using `ask_devstral_agent` as an alternative. You can ignore the suggestion and proceed.

## Agent personas

- `devstral-coder` — code generation: reads before writing, no placeholders, output only
- `devstral-analyst` — codebase analysis: file:line refs, structured findings, no speculation
