# /minion:delegate — Delegation Workflow

Activate the minion delegation workflow. Devstral handles code generation; Opus handles architecture, review, and application.

## What to do

### 1. Activate

Set the active flag so advisory hooks fire:
```bash
bash -c 'source "${CLAUDE_PLUGIN_ROOT}/hooks/lib.sh" && activate'
```

### 2. Ensure server

Call `ensure_server` to verify llama-server is healthy. It auto-spawns with the optimal config if not running. Wait for it to confirm ready before proceeding.

### 3. Read and plan

Read the codebase using Glob, Grep, and Read tools. Understand:
- The task at hand (from the user's request)
- Relevant existing code, patterns, and interfaces
- Which parts require Devstral (implementation) vs Opus (judgment)

### 4. Delegate

For each implementation task, craft a precise prompt and call `ask_devstral_agent`:

```
ask_devstral_agent(
    prompt="<specific task description with relevant context, interfaces, and examples>",
    cwd="<project directory>",
    persona="devstral-coder"  # or "devstral-analyst" for exploration
)
```

**Prompt crafting guidelines:**
- Give Devstral everything it needs in the prompt — don't assume it remembers prior calls
- Include relevant type signatures, function signatures, or examples
- Scope each call to one file or one logical unit
- If a task depends on output from a prior task, include that output in the prompt

### 5. Review

Examine Devstral's output before applying:
- Does it match the existing code style and conventions?
- Are the interfaces correct?
- Is the logic sound?
- Are there any obvious bugs or security issues?

If the output needs adjustment, either fix it yourself or re-delegate with a more specific prompt.

### 6. Apply

Use Write for new files, Edit for modifications. Apply Devstral's output to the filesystem.

### 7. Iterate

Repeat steps 4–6 for each task. After all tasks are complete, run a final review pass.

## What Devstral does vs what Opus does

| Task | Owner |
|------|-------|
| Architecture decisions | Opus |
| Complex business logic | Opus |
| Security-sensitive code | Opus |
| Integration and wiring | Opus |
| Boilerplate and scaffolding | Devstral |
| CRUD / standard patterns | Devstral |
| Tests and fixtures | Devstral |
| Refactoring to existing pattern | Devstral |
| Documentation strings | Devstral |

## Deactivating

When the workflow is complete:
```bash
bash -c 'source "${CLAUDE_PLUGIN_ROOT}/hooks/lib.sh" && deactivate'
```
