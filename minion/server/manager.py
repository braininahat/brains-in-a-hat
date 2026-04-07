"""ServerManager — spawns and manages a llama-server process.

Ported from agent-server-py with no TUI dependency.
"""

from __future__ import annotations

import asyncio
import os
import socket
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path

import httpx

from .models import ModelDef, QuantVariant

def _find_llama_server() -> Path:
    """Find llama-server binary on PATH.

    Users should ensure the desired llama-server (ik_llama.cpp or mainline)
    is on PATH or symlinked to ~/.local/bin/llama-server.
    """
    import shutil
    which = shutil.which("llama-server")
    if which:
        return Path(which)
    return Path("llama-server")


LLAMA_SERVER = _find_llama_server()


@dataclass
class ServerConfig:
    model: ModelDef
    quant: QuantVariant
    kv_type: str        # e.g. "bf16", "q8_0", "q4_0"
    gpu_only: bool      # False → add -nkvo, more threads
    context: str        # "auto", "32k", "64k", ...
    flash: str          # "on" / "off"
    cuda: str           # "on" / "off"  (GGML_CUDA_GRAPH_OPT)
    cpu_moe: str        # "on" / "off"
    port: int
    hadamard_kv: bool = True  # Hadamard transforms for K/V cache (ik_llama.cpp)


class ServerManager:
    def __init__(self, config: ServerConfig) -> None:
        self.config = config
        self._proc: subprocess.Popen | None = None

    def check_port(self) -> tuple[bool, int | None]:
        """Return (in_use, pid_or_None). Uses socket connect + ss for PID."""
        cfg = self.config
        try:
            with socket.create_connection(("127.0.0.1", cfg.port), timeout=0.5):
                pass
        except (ConnectionRefusedError, OSError):
            return False, None

        try:
            out = subprocess.check_output(
                ["ss", "-tlnp", f"sport = :{cfg.port}"],
                text=True, stderr=subprocess.DEVNULL,
            )
            for line in out.splitlines():
                if f":{cfg.port}" in line and "pid=" in line:
                    pid_part = line.split("pid=")[1].split(",")[0]
                    return True, int(pid_part)
        except Exception:
            pass
        return True, None

    def build_args(self) -> list[str]:
        """Build complete llama-server argv as a list (no shell interpolation).

        Targets ik_llama.cpp (ikawrakow fork) with Hadamard KV transforms,
        auto-fit tensor offloading, and improved MoE performance.
        """
        cfg = self.config
        args: list[str] = [str(LLAMA_SERVER)]

        # Model source: local HF cache → HF download
        local_path = Path(cfg.quant.local_path)
        if local_path.exists():
            args += ["-m", str(local_path)]
        else:
            args += ["-hf", cfg.model.hf_repo, "-hff", cfg.quant.hf_file]

        # Context — ik_llama.cpp uses -c 0 for auto-sizing
        if cfg.context == "auto":
            args += ["-c", "0"]
        else:
            ctx_map = {
                "32k": 32768, "64k": 65536, "96k": 98304,
                "128k": 131072, "192k": 196608, "256k": 262144, "384k": 393216,
            }
            args += ["-c", str(ctx_map.get(cfg.context, int(cfg.context)))]

        threads = 4 if cfg.gpu_only else 16

        args += [
            "--host", "0.0.0.0",
            "--port", str(cfg.port),
            "-ngl", "999",
            "-t", str(threads),
            "-tb", str(threads),
            "-b", "2048",
            "-ub", "512",
            "-np", "1",
            "--flash-attn", cfg.flash,
            "-ctk", cfg.kv_type,
            "-ctv", cfg.kv_type,
            "--jinja",
            "--mlock",
            "--metrics",
        ]

        # Hadamard transforms for KV cache (ik_llama.cpp feature)
        if cfg.hadamard_kv:
            args += ["-khad", "-vhad"]

        if not cfg.gpu_only:
            args.append("-nkvo")

        if cfg.model.chat_template:
            ct = Path(cfg.model.chat_template)
            if ct.exists():
                args += ["--chat-template-file", str(ct)]

        if cfg.cpu_moe == "on":
            args.append("--cpu-moe")

        # ik_llama.cpp auto-fit tensor offloading
        args.append("--fit")

        return args

    def spawn(self) -> subprocess.Popen:
        cfg = self.config
        env = os.environ.copy()
        if cfg.cuda == "on":
            env["GGML_CUDA_GRAPH_OPT"] = "1"
        else:
            env.pop("GGML_CUDA_GRAPH_OPT", None)

        self._proc = subprocess.Popen(self.build_args(), env=env)
        return self._proc

    async def wait_healthy(self, timeout: float = 120.0) -> int:
        """Poll /health until ready, return n_ctx from /props."""
        cfg = self.config
        url_health = f"http://localhost:{cfg.port}/health"
        url_props = f"http://localhost:{cfg.port}/props"
        deadline = time.monotonic() + timeout

        async with httpx.AsyncClient() as client:
            while time.monotonic() < deadline:
                try:
                    r = await client.get(url_health, timeout=2.0)
                    if r.status_code == 200:
                        break
                except httpx.TransportError:
                    pass
                await asyncio.sleep(0.5)
            else:
                raise TimeoutError(f"Server did not become healthy within {timeout}s")

            r = await client.get(url_props, timeout=5.0)
            r.raise_for_status()
            data = r.json()
            return int(data.get("default_generation_settings", {}).get("n_ctx", 0))

    def shutdown(self) -> None:
        if self._proc and self._proc.poll() is None:
            self._proc.terminate()
            try:
                self._proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                self._proc.kill()
        self._proc = None
