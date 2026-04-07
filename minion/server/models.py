"""Model registry for the minion plugin.

Two-tier registry:
  1. Built-in MODELS list — always available as fallback.
  2. ~/.minion/models.json — dynamic registry written by Opus. Overrides
     built-ins when present. Same schema as the dataclasses below.

Use load_registry() to get the active list; it handles both tiers.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path

_HOME = os.path.expanduser("~")

# Chat template — check ~/.minion/ then fall back to None (use model default)
_DEVSTRAL_CHAT_TEMPLATE_PATH = f"{_HOME}/.minion/devstral-chat-template.jinja"
_DEVSTRAL_CHAT_TEMPLATE = _DEVSTRAL_CHAT_TEMPLATE_PATH if os.path.exists(_DEVSTRAL_CHAT_TEMPLATE_PATH) else None


@dataclass
class QuantVariant:
    id: str        # e.g. "Q4_K_XL"
    label: str     # e.g. "Q4_K_XL (~17 GB)"
    size_gb: float
    local_path: str   # absolute path to check for cache hit
    hf_file: str      # filename on HF hub (for -hff)


@dataclass
class ModelDef:
    id: str
    name: str
    is_moe: bool
    hf_repo: str
    quants: list[QuantVariant]
    chat_template: str | None  # path or None
    temp: float
    top_p: float
    top_k: int
    min_p: float


MODELS: list[ModelDef] = [
    ModelDef(
        id="devstral",
        name="Devstral 24B",
        is_moe=True,
        hf_repo="bartowski/mistralai_Devstral-Small-2-24B-Instruct-2512-GGUF",
        quants=[
            QuantVariant(
                id="Q4_K_M",
                label="Q4_K_M (~13.3 GB)",
                size_gb=13.3,
                local_path=f"{_HOME}/.cache/huggingface/gguf/mistralai_Devstral-Small-2-24B-Instruct-2512-Q4_K_M.gguf",
                hf_file="mistralai_Devstral-Small-2-24B-Instruct-2512-Q4_K_M.gguf",
            ),
            QuantVariant(
                id="Q5_K_M",
                label="Q5_K_M (~15.6 GB)",
                size_gb=15.6,
                local_path=f"{_HOME}/.cache/huggingface/gguf/mistralai_Devstral-Small-2-24B-Instruct-2512-Q5_K_M.gguf",
                hf_file="mistralai_Devstral-Small-2-24B-Instruct-2512-Q5_K_M.gguf",
            ),
            QuantVariant(
                id="Q6_K",
                label="Q6_K (~18 GB)",
                size_gb=18.0,
                local_path=f"{_HOME}/.cache/huggingface/gguf/mistralai_Devstral-Small-2-24B-Instruct-2512-Q6_K.gguf",
                hf_file="mistralai_Devstral-Small-2-24B-Instruct-2512-Q6_K.gguf",
            ),
        ],
        chat_template=_DEVSTRAL_CHAT_TEMPLATE,
        temp=0.15,
        top_p=0.95,
        top_k=20,
        min_p=0.0,
    ),
    ModelDef(
        id="qwen35",
        name="Qwen 3.5 27B",
        is_moe=False,
        hf_repo="unsloth/Qwen3.5-27B-GGUF",
        quants=[
            QuantVariant(
                id="Q4_K_XL",
                label="Q4_K_XL (~17.6 GB)",
                size_gb=17.6,
                local_path=f"{_HOME}/.cache/huggingface/gguf/Qwen3.5-27B-UD-Q4_K_XL.gguf",
                hf_file="Qwen3.5-27B-UD-Q4_K_XL.gguf",
            ),
            QuantVariant(
                id="Q5_K_XL",
                label="Q5_K_XL (~20.2 GB)",
                size_gb=20.2,
                local_path=f"{_HOME}/.cache/huggingface/gguf/Qwen3.5-27B-UD-Q5_K_XL.gguf",
                hf_file="Qwen3.5-27B-UD-Q5_K_XL.gguf",
            ),
        ],
        chat_template=None,
        temp=0.6,
        top_p=0.95,
        top_k=20,
        min_p=0.0,
    ),
    ModelDef(
        id="gemma4-26b",
        name="Gemma 4 26B",
        is_moe=True,
        hf_repo="unsloth/gemma-4-26B-A4B-it-GGUF",
        quants=[
            QuantVariant(
                id="UD-Q4_K_XL",
                label="UD-Q4_K_XL (~17.1 GB)",
                size_gb=17.1,
                local_path=f"{_HOME}/.cache/huggingface/gguf/gemma-4-26B-A4B-it-UD-Q4_K_XL.gguf",
                hf_file="gemma-4-26B-A4B-it-UD-Q4_K_XL.gguf",
            ),
            QuantVariant(
                id="UD-Q5_K_XL",
                label="UD-Q5_K_XL (~21.3 GB)",
                size_gb=21.3,
                local_path=f"{_HOME}/.cache/huggingface/gguf/gemma-4-26B-A4B-it-UD-Q5_K_XL.gguf",
                hf_file="gemma-4-26B-A4B-it-UD-Q5_K_XL.gguf",
            ),
        ],
        chat_template=None,
        temp=0.7,
        top_p=0.95,
        top_k=20,
        min_p=0.0,
    ),
    ModelDef(
        id="gemma4-31b",
        name="Gemma 4 31B",
        is_moe=False,
        hf_repo="unsloth/gemma-4-31B-it-GGUF",
        quants=[
            QuantVariant(
                id="UD-Q4_K_XL",
                label="UD-Q4_K_XL (~18.8 GB)",
                size_gb=18.8,
                local_path=f"{_HOME}/.cache/huggingface/gguf/gemma-4-31B-it-UD-Q4_K_XL.gguf",
                hf_file="gemma-4-31B-it-UD-Q4_K_XL.gguf",
            ),
            QuantVariant(
                id="UD-Q5_K_XL",
                label="UD-Q5_K_XL (~21.9 GB)",
                size_gb=21.9,
                local_path=f"{_HOME}/.cache/huggingface/gguf/gemma-4-31B-it-UD-Q5_K_XL.gguf",
                hf_file="gemma-4-31B-it-UD-Q5_K_XL.gguf",
            ),
        ],
        chat_template=None,
        temp=0.7,
        top_p=0.95,
        top_k=20,
        min_p=0.0,
    ),
]

MODEL_INDEX: dict[str, ModelDef] = {m.id: m for m in MODELS}

# Path to the dynamic registry file
DYNAMIC_REGISTRY_PATH = Path.home() / ".minion" / "models.json"


def _quant_from_dict(d: dict) -> QuantVariant:
    return QuantVariant(
        id=d["id"],
        label=d["label"],
        size_gb=float(d["size_gb"]),
        local_path=d["local_path"],
        hf_file=d["hf_file"],
    )


def _model_from_dict(d: dict) -> ModelDef:
    return ModelDef(
        id=d["id"],
        name=d["name"],
        is_moe=bool(d["is_moe"]),
        hf_repo=d["hf_repo"],
        quants=[_quant_from_dict(q) for q in d["quants"]],
        chat_template=d.get("chat_template"),
        temp=float(d["temp"]),
        top_p=float(d["top_p"]),
        top_k=int(d["top_k"]),
        min_p=float(d["min_p"]),
    )


def load_registry() -> dict[str, ModelDef]:
    """Return the active model registry.

    Loads ~/.minion/models.json if it exists and is valid JSON; falls back
    to the built-in MODEL_INDEX otherwise. Malformed JSON is silently ignored
    and the built-in registry is used instead.
    """
    if DYNAMIC_REGISTRY_PATH.exists():
        try:
            raw = json.loads(DYNAMIC_REGISTRY_PATH.read_text())
            models = [_model_from_dict(m) for m in raw]
            return {m.id: m for m in models}
        except Exception:
            pass
    return MODEL_INDEX
