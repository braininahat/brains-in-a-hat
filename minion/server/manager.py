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

LLAMA_SERVER = Path("/home/varun/repos/personal/llama.cpp/build/bin/llama-server")


@dataclass
class ServerConfig:
    model: ModelDef
    quant: QuantVariant
    kv_type: str        # e.g. "bf16", "q8_0"
    gpu_only: bool      # False → add -nkvo, more threads
    context: str        # "auto", "32k", "64k", ...
    flash: str          # "on" / "off"
    cuda: str           # "on" / "off"  (GGML_CUDA_GRAPH_OPT)
    cpu_moe: str        # "on" / "off"
    port: int


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
        """Build complete llama-server argv as a list (no shell interpolation)."""
        cfg = self.config
        args: list[str] = [str(LLAMA_SERVER)]

        # Model source: local HF cache → llama.cpp cache → HF download
        local_path = Path(cfg.quant.local_path)
        llama_cache = (
            Path.home() / ".cache" / "llama.cpp"
            / f"unsloth_{cfg.model.hf_repo.replace('/', '_')}_{cfg.quant.hf_file}"
        )
        if local_path.exists():
            args += ["-m", str(local_path)]
        elif llama_cache.exists():
            args += ["-m", str(llama_cache)]
        else:
            args += ["-hf", cfg.model.hf_repo, "-hff", cfg.quant.hf_file]

        # Context
        if cfg.context == "auto":
            args += ["-c", "0", "-fitc", "8192"]
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
            "-t", str(threads),
            "-tb", str(threads),
            "-b", "2048",
            "-ub", "512",
            "-np", "1",
            "--flash-attn", cfg.flash,
            "-ctk", cfg.kv_type,
            "-ctv", cfg.kv_type,
            "--jinja",
            "--temp", str(cfg.model.temp),
            "--top-p", str(cfg.model.top_p),
            "--top-k", str(cfg.model.top_k),
            "--min-p", str(cfg.model.min_p),
            "--cont-batching",
            "--mlock",
            "--metrics",
        ]

        if not cfg.gpu_only:
            args.append("-nkvo")

        if cfg.model.chat_template:
            ct = Path(cfg.model.chat_template)
            if ct.exists():
                args += ["--chat-template-file", str(ct)]

        if cfg.cpu_moe == "on":
            args.append("--cpu-moe")

        # Auto-fitter must come last
        args += ["-fitt", "512"]

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
