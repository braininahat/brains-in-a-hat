#!/usr/bin/env python3
"""Turn a project's Claude Code transcripts into dated conversation text, in chunks.

    python3 -I digest.py <project root> <output dir> [chunk chars]

Keeps what people and Claude said, and one line per tool call; drops tool output,
system reminders and other bulk. Writes chunk-NN.md files and index.json.
"""
import glob
import json
import os
import re
import sys

REMINDER = re.compile(r"<system-reminder>.*?</system-reminder>", re.S)
NOISE = re.compile(r"<(command-[a-z-]+|local-command-[a-z-]+|task-notification)>.*?</\1>", re.S)


def project_dir(root: str) -> str:
    return os.path.join(os.path.expanduser("~/.claude/projects"), re.sub(r"[^A-Za-z0-9]", "-", os.path.abspath(root)))


def clean(text: str, limit: int) -> str:
    text = NOISE.sub("", REMINDER.sub("", text)).strip()
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text if len(text) <= limit else text[:limit] + f" …[{len(text) - limit} chars cut]"


def tool_line(block: dict) -> str:
    args = block.get("input") or {}
    for key in ("command", "file_path", "path", "pattern", "query", "url", "description", "prompt", "title"):
        v = args.get(key)
        if isinstance(v, str) and v:
            return f"{block.get('name')}: {v.splitlines()[0][:160]}"
    return str(block.get("name"))


def lines_of(path: str):
    """(timestamp, text) for each kept record of one transcript, with the session's title."""
    out, title = [], None
    for raw in open(path, errors="replace"):
        try:
            r = json.loads(raw)
        except ValueError:
            continue
        kind = r.get("type")
        if kind == "custom-title":
            title = r.get("customTitle") or title
        if kind not in ("user", "assistant"):
            continue
        ts = (r.get("timestamp") or "")[:16].replace("T", " ")
        content = (r.get("message") or {}).get("content")
        if kind == "user" and isinstance(content, str):
            t = clean(content, 1500)
            if t:
                out.append((ts, f"USER: {t}"))
        elif isinstance(content, list):
            for b in content:
                if not isinstance(b, dict):
                    continue
                if b.get("type") == "text":
                    t = clean(b.get("text", ""), 2000 if kind == "assistant" else 1500)
                    if t:
                        out.append((ts, f"{'CLAUDE' if kind == 'assistant' else 'USER'}: {t}"))
                elif b.get("type") == "tool_use":
                    out.append((ts, f"TOOL {tool_line(b)}"))
    return out, title


def main() -> None:
    root, out_dir = sys.argv[1], sys.argv[2]
    size = int(sys.argv[3]) if len(sys.argv) > 3 else 100_000
    pdir = project_dir(root)
    files = sorted(glob.glob(os.path.join(pdir, "**", "*.jsonl"), recursive=True))
    sections = []
    for f in files:
        lines, title = lines_of(f)
        if not lines:
            continue
        rel = os.path.relpath(f, pdir)
        kind = "subagent" if os.sep in rel else "session"
        head = f"## {kind} {title or os.path.basename(f)[:8]} ({lines[0][0]} to {lines[-1][0]})"
        body = "\n".join(f"[{ts}] {t}" for ts, t in lines)
        sections.append((lines[0][0], kind, head, body))
    # Main sessions first, oldest first, then subagents, oldest first.
    sections.sort(key=lambda s: (s[1] != "session", s[0]))
    os.makedirs(out_dir, exist_ok=True)
    chunks, cur = [], ""
    for _, _, head, body in sections:
        piece = f"{head}\n{body}\n\n"
        while len(piece) > size:  # split long sections on line breaks
            cut = piece.rfind("\n", 0, size)
            cut = cut if cut > 0 else size
            if cur:
                chunks.append(cur)
                cur = ""
            chunks.append(piece[:cut])
            piece = f"{head} (continued)\n{piece[cut:].lstrip()}"
        if len(cur) + len(piece) > size and cur:
            chunks.append(cur)
            cur = ""
        cur += piece
    if cur:
        chunks.append(cur)
    index = []
    for i, c in enumerate(chunks, 1):
        name = f"chunk-{i:02d}.md"
        with open(os.path.join(out_dir, name), "w") as fh:
            fh.write(c)
        stamps = re.findall(r"^\[(\d{4}-\d\d-\d\d[ \d:]*)\]", c, re.M)
        index.append({"file": os.path.join(out_dir, name), "chars": len(c), "from": stamps[0] if stamps else "", "to": stamps[-1] if stamps else ""})
    memory = sorted(glob.glob(os.path.join(pdir, "memory", "*.md")))
    with open(os.path.join(out_dir, "index.json"), "w") as fh:
        json.dump({"project": root, "transcripts": len(files), "chunks": index, "memory": memory}, fh, indent=2)
    print(f"{len(files)} transcripts -> {len(index)} chunks, {sum(x['chars'] for x in index)} chars; {len(memory)} memory notes")


if __name__ == "__main__":
    main()
