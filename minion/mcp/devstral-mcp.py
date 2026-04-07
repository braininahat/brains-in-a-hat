#!/usr/bin/env -S uv run --script
# /// script
# dependencies = ["fastmcp", "httpx"]
# ///
"""MCP server exposing the local Devstral model as a tool for Claude Code.

Tools:
  - ask_devstral: one-shot prompt → text (stateless, fast)
  - ask_devstral_agent: agent loop with read-only codebase tools (supports multiturn via session_id)
  - ensure_server: checks health, auto-spawns with optimal config if needed
  - list_sessions / clear_session: manage multiturn conversation sessions
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

from fastmcp import FastMCP
import httpx

mcp = FastMCP("devstral")

DEVSTRAL_URL = "http://localhost:8000/v1/chat/completions"
DEVSTRAL_PORT = 8000
AGENTS_DIR = Path(os.environ.get("CLAUDE_PLUGIN_ROOT", str(Path(__file__).parent.parent))) / "agents"
MAX_RESULT_BYTES = 8192

# Path to server/ package — lives alongside mcp/ in the plugin root
_PLUGIN_ROOT = Path(os.environ.get("CLAUDE_PLUGIN_ROOT", str(Path(__file__).parent.parent)))
_SERVER_DIR = _PLUGIN_ROOT / "server"

# In-memory conversation sessions — keyed by session_id, value is messages list.
# Persists for the lifetime of the MCP server process (= Claude Code session).
_SESSIONS: dict[str, list[dict]] = {}


# ---------------------------------------------------------------------------
# Agent tool definitions (OpenAI function-calling format)
# ---------------------------------------------------------------------------

AGENT_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read a file's contents with line numbers.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "File path relative to working directory"},
                    "offset": {"type": "integer", "description": "Start line (1-based). Optional."},
                    "limit": {"type": "integer", "description": "Max lines to read. Optional."},
                },
                "required": ["path"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "grep",
            "description": "Search for a regex pattern across files using ripgrep. Returns matching lines with paths.",
            "parameters": {
                "type": "object",
                "properties": {
                    "pattern": {"type": "string", "description": "Regex pattern to search for"},
                    "path": {"type": "string", "description": "Directory or file to search in. Default: working directory."},
                    "glob_filter": {"type": "string", "description": "File glob filter, e.g. '*.py'. Optional."},
                },
                "required": ["pattern"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "glob_files",
            "description": "Find files matching a glob pattern. Returns paths sorted by modification time.",
            "parameters": {
                "type": "object",
                "properties": {
                    "pattern": {"type": "string", "description": "Glob pattern, e.g. '**/*.py' or 'src/*.qml'"},
                    "path": {"type": "string", "description": "Base directory. Default: working directory."},
                },
                "required": ["pattern"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "ls",
            "description": "List directory contents with type indicators (d/ for directories).",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Directory path. Default: working directory."},
                },
                "required": [],
            },
        },
    },
]


# ---------------------------------------------------------------------------
# Tool executors
# ---------------------------------------------------------------------------

def _safe_resolve(cwd: str, path: str) -> Path:
    base = Path(cwd).resolve()
    target = (base / path).resolve()
    if not str(target).startswith(str(base)):
        raise ValueError(f"Path traversal blocked: {path}")
    return target


def _truncate(text: str) -> str:
    if len(text) > MAX_RESULT_BYTES:
        return text[:MAX_RESULT_BYTES] + f"\n... (truncated at {MAX_RESULT_BYTES} bytes)"
    return text


def _exec_read_file(args: dict, cwd: str) -> str:
    target = _safe_resolve(cwd, args["path"])
    if not target.is_file():
        return f"Error: not a file: {args['path']}"
    lines = target.read_text(errors="replace").splitlines()
    offset = max(0, args.get("offset", 1) - 1)
    limit = args.get("limit", len(lines))
    selected = lines[offset:offset + limit]
    numbered = [f"{offset + i + 1:>5}\t{line}" for i, line in enumerate(selected)]
    return _truncate("\n".join(numbered))


def _exec_grep(args: dict, cwd: str) -> str:
    search_path = _safe_resolve(cwd, args.get("path", "."))
    cmd = ["rg", "--no-heading", "-n", "--max-count=50", args["pattern"], str(search_path)]
    if "glob_filter" in args:
        cmd.extend(["--glob", args["glob_filter"]])
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
        output = result.stdout or result.stderr or "No matches found"
        return _truncate(output)
    except subprocess.TimeoutExpired:
        return "Error: grep timed out (5s limit)"


def _exec_glob(args: dict, cwd: str) -> str:
    base = _safe_resolve(cwd, args.get("path", "."))
    if not base.is_dir():
        return f"Error: not a directory: {args.get('path', '.')}"
    matches = sorted(base.glob(args["pattern"]), key=lambda p: p.stat().st_mtime, reverse=True)
    lines = [str(p.relative_to(base)) for p in matches[:100]]
    return _truncate("\n".join(lines) if lines else "No matches found")


def _exec_ls(args: dict, cwd: str) -> str:
    target = _safe_resolve(cwd, args.get("path", "."))
    if not target.is_dir():
        return f"Error: not a directory: {args.get('path', '.')}"
    entries = sorted(target.iterdir())
    lines = []
    for e in entries:
        if e.name.startswith("."):
            continue
        prefix = "d/ " if e.is_dir() else "   "
        lines.append(f"{prefix}{e.name}")
    return _truncate("\n".join(lines) if lines else "(empty directory)")


TOOL_EXECUTORS = {
    "read_file": _exec_read_file,
    "grep": _exec_grep,
    "glob_files": _exec_glob,
    "ls": _exec_ls,
}


def _execute_tool(tool_call: dict, cwd: str) -> str:
    name = tool_call["function"]["name"]
    raw_args = tool_call["function"]["arguments"]
    args = json.loads(raw_args) if isinstance(raw_args, str) else raw_args
    executor = TOOL_EXECUTORS.get(name)
    if not executor:
        return f"Error: unknown tool '{name}'"
    try:
        return executor(args, cwd)
    except ValueError as e:
        return f"Error: {e}"
    except Exception as e:
        return f"Error executing {name}: {e}"


# ---------------------------------------------------------------------------
# Context injection
# ---------------------------------------------------------------------------

def _gather_context(cwd: str) -> str:
    sections = []
    p = Path(cwd).resolve()
    for parent in [p, *p.parents]:
        cm = parent / "CLAUDE.md"
        if cm.exists():
            sections.append(f"# Project Instructions\n{cm.read_text(errors='replace')}")
            break
    slug = str(p).replace("/", "-").lstrip("-")
    mem = Path.home() / ".claude" / "projects" / slug / "memory" / "MEMORY.md"
    if mem.exists():
        sections.append(f"# Project Memory\n{mem.read_text(errors='replace')}")
    return "\n\n---\n\n".join(sections)


def _load_persona(persona: str) -> str:
    path = AGENTS_DIR / f"{persona}.md"
    if not path.exists():
        return ""
    text = path.read_text()
    if text.startswith("---"):
        end = text.find("---", 3)
        if end != -1:
            text = text[end + 3:].lstrip("\n")
    return text


# ---------------------------------------------------------------------------
# MCP tools
# ---------------------------------------------------------------------------

@mcp.tool()
async def ask_devstral(
    prompt: str,
    system: str = "You are a helpful coding assistant.",
    max_tokens: int = 2048,
) -> str:
    """Query the local Devstral model for code generation, analysis, or questions.

    Each call is stateless — include all necessary context in the prompt.
    """
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            DEVSTRAL_URL,
            json={
                "model": "devstral",
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": prompt},
                ],
                "max_tokens": max_tokens,
            },
            timeout=120.0,
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]


@mcp.tool()
async def ask_devstral_agent(
    prompt: str,
    cwd: str = ".",
    session_id: str = "",
    system: str = "You are a coding assistant with access to the codebase. Use the available tools to explore files before answering. Be thorough but concise.",
    persona: str = "",
    max_tokens: int = 4096,
    max_iterations: int = 12,
) -> str:
    """Run Devstral as an agent with read-only codebase tools.

    Devstral can call read_file, grep, glob_files, and ls to explore the codebase.
    All file access is read-only and sandboxed to cwd.

    Set persona to "devstral-coder" or "devstral-analyst" to load that agent's prompt.

    Pass session_id to maintain conversation across multiple calls — Devstral
    will remember prior messages and tool results. Omit for stateless one-shot.
    """
    cwd = str(Path(cwd).resolve())

    # Session continuity: reuse prior messages or start fresh
    if session_id and session_id in _SESSIONS:
        messages = _SESSIONS[session_id]
        messages.append({"role": "user", "content": prompt})
    else:
        context = _gather_context(cwd)
        if persona:
            persona_text = _load_persona(persona)
            if persona_text:
                system = persona_text
        if context:
            system = f"{context}\n\n---\n\n{system}"

        system += (
            f"\n\nYou have a maximum of {max_iterations} tool-call rounds. "
            f"Budget carefully: read only what you need, then stop calling tools "
            f"and write your complete answer. Do not spend all rounds reading — "
            f"reserve at least 2 rounds for your final response."
        )

        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ]
    tool_call_count = 0
    tool_trace: list[str] = []  # human-readable trace of tool calls

    async with httpx.AsyncClient() as client:
        for iteration in range(max_iterations):
            # On the last iteration, withhold tools to force text synthesis
            use_tools = iteration < max_iterations - 1

            request_body: dict = {
                "model": "devstral",
                "messages": messages,
                "max_tokens": max_tokens,
            }
            if use_tools:
                request_body["tools"] = AGENT_TOOLS

            resp = await client.post(
                DEVSTRAL_URL,
                json=request_body,
                timeout=120.0,
            )
            resp.raise_for_status()
            msg = resp.json()["choices"][0]["message"]
            messages.append(msg)

            tool_calls = msg.get("tool_calls")
            if not tool_calls:
                answer = msg.get("content", "")
                if session_id:
                    _SESSIONS[session_id] = messages
                if tool_trace:
                    trace_block = "\n".join(tool_trace)
                    return f"{answer}\n\n---\n**Tool trace** ({tool_call_count} calls):\n{trace_block}"
                return answer

            for tc in tool_calls:
                fn = tc.get("function", {})
                fn_name = fn.get("name", "?")
                fn_args = fn.get("arguments", "")
                try:
                    args_dict = json.loads(fn_args) if isinstance(fn_args, str) else fn_args
                except (json.JSONDecodeError, TypeError):
                    args_dict = {"raw": fn_args}
                args_summary = ", ".join(f"{k}={repr(v)[:80]}" for k, v in args_dict.items())
                tool_trace.append(f"  [{iteration+1}] {fn_name}({args_summary})")

                result = _execute_tool(tc, cwd)
                result_preview = result[:120].replace("\n", " ") + ("..." if len(result) > 120 else "")
                tool_trace.append(f"       → {result_preview}")
                tool_call_count += 1
                messages.append({
                    "role": "tool",
                    "content": result,
                    "tool_call_id": tc.get("id", ""),
                })

            # Inject countdown into the last tool result when running low
            remaining = max_iterations - iteration - 1
            if remaining <= 3 and remaining > 0 and messages[-1]["role"] == "tool":
                messages[-1]["content"] += (
                    f"\n\n[{remaining} iteration(s) remaining — "
                    f"stop reading and write your answer now.]"
                )

    last = messages[-1]
    answer = last.get("content", f"Agent reached {max_iterations} iterations without a final answer.")
    if session_id:
        _SESSIONS[session_id] = messages
    if tool_trace:
        trace_block = "\n".join(tool_trace)
        return f"{answer}\n\n---\n**Tool trace** ({tool_call_count} calls):\n{trace_block}"
    return answer


@mcp.tool()
async def list_sessions() -> str:
    """List active Devstral conversation sessions with message counts."""
    if not _SESSIONS:
        return "No active sessions."
    lines = []
    for sid, msgs in _SESSIONS.items():
        user_msgs = [m for m in msgs if m.get("role") == "user"]
        last_user = user_msgs[-1]["content"][:80] if user_msgs else "—"
        lines.append(f"  {sid}: {len(msgs)} messages, last user: \"{last_user}\"")
    return f"{len(_SESSIONS)} active session(s):\n" + "\n".join(lines)


@mcp.tool()
async def clear_session(session_id: str) -> str:
    """Clear a Devstral conversation session, freeing its message history."""
    if session_id in _SESSIONS:
        msg_count = len(_SESSIONS.pop(session_id))
        return f"Session '{session_id}' cleared ({msg_count} messages)."
    return f"Session '{session_id}' not found."


@mcp.tool()
async def ensure_server(
    model_id: str | None = None,
    quant_id: str | None = None,
    context: int = 32768,
    kv_type: str = "bf16",
) -> str:
    """Check if llama-server is healthy on localhost:8000. Auto-spawns with optimal config if not.

    Detects free VRAM, checks which model files are cached locally, estimates
    KV cache overhead, and selects the best config that fits. Never picks a
    quant that isn't locally cached (avoids multi-GB download timeouts).

    Args:
        model_id: Override model selection (e.g. "devstral", "qwen35"). Auto-selects if None.
        quant_id: Override quant selection (e.g. "Q4_K_XL", "Q5_K_XL"). Auto-selects if None.
        context: Target context length in tokens (default 32768).
        kv_type: KV cache dtype — "bf16", "f16", "q8_0", or "q4_0" (default "bf16").

    Returns a status string with model info, VRAM budget breakdown, and
    available alternatives so Opus can make informed decisions.
    """
    health_url = f"http://localhost:{DEVSTRAL_PORT}/health"
    props_url = f"http://localhost:{DEVSTRAL_PORT}/props"

    # Check if already healthy
    async with httpx.AsyncClient() as client:
        try:
            r = await client.get(health_url, timeout=2.0)
            if r.status_code == 200:
                try:
                    props = await client.get(props_url, timeout=3.0)
                    n_ctx = props.json().get("default_generation_settings", {}).get("n_ctx", "?")
                except Exception:
                    n_ctx = "?"
                return f"Server already running. Status: healthy. Context: {n_ctx} tokens."
        except httpx.TransportError:
            pass

    # Not running — auto-spawn
    if str(_SERVER_DIR) not in sys.path:
        sys.path.insert(0, str(_SERVER_DIR.parent))

    try:
        from minion.server.autoconfig import (
            GpuBusyError, check_gpu_contention, detect_vram, detect_total_vram,
            select_config, list_candidates, estimate_kv_cache_mib,
        )
        from minion.server.manager import ServerManager
    except ImportError:
        if str(_PLUGIN_ROOT) not in sys.path:
            sys.path.insert(0, str(_PLUGIN_ROOT))
        from server.autoconfig import (
            GpuBusyError, check_gpu_contention, detect_vram, detect_total_vram,
            select_config, list_candidates, estimate_kv_cache_mib,
        )
        from server.manager import ServerManager

    try:
        check_gpu_contention()
    except GpuBusyError as e:
        return f"GPU busy ({e}) — delegating skipped. Opus will work directly."

    vram_free = detect_vram()
    vram_total = detect_total_vram()

    # Build a summary of available options for Opus
    candidates = list_candidates(vram_free, context, kv_type)
    options_summary = []
    for c in candidates[:8]:  # Top 8 options
        status = "cached+fits" if c["cached"] and c["fits"] else \
                 "cached" if c["cached"] else \
                 "needs download" if c["fits"] else "too large"
        options_summary.append(
            f"  {c['model'].name} {c['quant'].id}: "
            f"model={c['model_mib']:.0f}MiB + kv={c['kv_mib']:.0f}MiB "
            f"= {c['total_mib']:.0f}MiB [{status}]"
        )

    config = select_config(
        "code", vram_free, port=DEVSTRAL_PORT,
        context=context, kv_type=kv_type,
        model_id=model_id, quant_id=quant_id,
    )
    kv_est = estimate_kv_cache_mib(config.model.id, context, kv_type)

    manager = ServerManager(config)

    in_use, _ = manager.check_port()
    if in_use:
        return f"Port {DEVSTRAL_PORT} in use but server not responding to /health. Check manually."

    manager.spawn()

    try:
        n_ctx = await manager.wait_healthy(timeout=120.0)
        return (
            f"Server spawned successfully.\n"
            f"Model: {config.model.name} {config.quant.id}\n"
            f"KV: {config.kv_type} | Flash: {config.flash} | Context: {n_ctx} tokens\n"
            f"VRAM: {vram_free}/{vram_total} MiB free | "
            f"Model: ~{config.quant.size_gb * 1024:.0f} MiB | "
            f"KV cache: ~{kv_est:.0f} MiB\n"
            f"\nAvailable configs:\n" + "\n".join(options_summary)
        )
    except TimeoutError as e:
        manager.shutdown()
        return (
            f"Server failed to start: {e}\n"
            f"Tried: {config.model.name} {config.quant.id}\n"
            f"VRAM: {vram_free}/{vram_total} MiB free\n"
            f"\nAvailable configs:\n" + "\n".join(options_summary)
        )


if __name__ == "__main__":
    mcp.run()
