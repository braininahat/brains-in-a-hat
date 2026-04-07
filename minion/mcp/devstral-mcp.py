#!/usr/bin/env -S uv run --script
# /// script
# dependencies = ["fastmcp", "httpx"]
# ///
"""MCP server exposing the local Devstral model as a tool for Claude Code.

Three tools:
  - ask_devstral: one-shot prompt → text (stateless, fast)
  - ask_devstral_agent: agent loop with read-only codebase tools
  - ensure_server: checks health, auto-spawns with optimal config if needed
"""

from __future__ import annotations

import asyncio
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
    system: str = "You are a coding assistant with access to the codebase. Use the available tools to explore files before answering. Be thorough but concise.",
    persona: str = "",
    max_tokens: int = 4096,
    max_iterations: int = 10,
) -> str:
    """Run Devstral as an agent with read-only codebase tools.

    Devstral can call read_file, grep, glob_files, and ls to explore the codebase.
    All file access is read-only and sandboxed to cwd.

    Set persona to "devstral-coder" or "devstral-analyst" to load that agent's prompt.
    """
    cwd = str(Path(cwd).resolve())

    context = _gather_context(cwd)
    if persona:
        persona_text = _load_persona(persona)
        if persona_text:
            system = persona_text
    if context:
        system = f"{context}\n\n---\n\n{system}"

    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": prompt},
    ]

    async with httpx.AsyncClient() as client:
        for iteration in range(max_iterations):
            resp = await client.post(
                DEVSTRAL_URL,
                json={
                    "model": "devstral",
                    "messages": messages,
                    "tools": AGENT_TOOLS,
                    "max_tokens": max_tokens,
                },
                timeout=120.0,
            )
            resp.raise_for_status()
            msg = resp.json()["choices"][0]["message"]
            messages.append(msg)

            tool_calls = msg.get("tool_calls")
            if not tool_calls:
                return msg.get("content", "")

            for tc in tool_calls:
                result = _execute_tool(tc, cwd)
                messages.append({
                    "role": "tool",
                    "content": result,
                    "tool_call_id": tc.get("id", ""),
                })

    last = messages[-1]
    return last.get("content", f"Agent reached {max_iterations} iterations without a final answer.")


@mcp.tool()
async def ensure_server() -> str:
    """Check if llama-server is healthy on localhost:8000. Auto-spawns with optimal config if not.

    Uses nvidia-smi to detect free VRAM and selects the best Devstral quant + KV config.
    Returns a status string with model info.
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
    # Add server/ to path so we can import without installing
    if str(_SERVER_DIR) not in sys.path:
        sys.path.insert(0, str(_SERVER_DIR.parent))

    try:
        from minion.server.autoconfig import detect_vram, select_config
        from minion.server.manager import ServerManager
    except ImportError:
        # Fallback: add plugin root directly
        if str(_PLUGIN_ROOT) not in sys.path:
            sys.path.insert(0, str(_PLUGIN_ROOT))
        from server.autoconfig import detect_vram, select_config
        from server.manager import ServerManager

    vram = detect_vram()
    config = select_config("code", vram, port=DEVSTRAL_PORT)
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
            f"VRAM detected: {vram} MiB free"
        )
    except TimeoutError as e:
        manager.shutdown()
        return f"Server failed to start: {e}"


if __name__ == "__main__":
    mcp.run()
