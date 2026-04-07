"""Model registry for the minion plugin.

Defines QuantVariant, ModelDef dataclasses and the MODELS list with all
supported local models. Ported from agent-server-picker.py.
"""

from __future__ import annotations

import os
from dataclasses import dataclass

_HOME = os.path.expanduser("~")

# Chat template lives in the agent-server repo alongside the GGUF cache
_DEVSTRAL_CHAT_TEMPLATE = f"{_HOME}/repos/personal/agent-server/devstral-chat-template.jinja"


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
        hf_repo="unsloth/Devstral-Small-2-24B-Instruct-2512-GGUF",
        quants=[
            QuantVariant(
                id="Q4_K_XL",
                label="Q4_K_XL (~17 GB)",
                size_gb=17.0,
                local_path=f"{_HOME}/.cache/huggingface/gguf/Devstral-Small-2-24B-Instruct-2512-UD-Q4_K_XL.gguf",
                hf_file="Devstral-Small-2-24B-Instruct-2512-UD-Q4_K_XL.gguf",
            ),
            QuantVariant(
                id="Q5_K_XL",
                label="Q5_K_XL (~20 GB)",
                size_gb=20.0,
                local_path=f"{_HOME}/.cache/huggingface/gguf/Devstral-Small-2-24B-Instruct-2512-UD-Q5_K_XL.gguf",
                hf_file="Devstral-Small-2-24B-Instruct-2512-UD-Q5_K_XL.gguf",
            ),
            QuantVariant(
                id="Q6_K_XL",
                label="Q6_K_XL (~23 GB)",
                size_gb=23.0,
                local_path=f"{_HOME}/.cache/huggingface/gguf/Devstral-Small-2-24B-Instruct-2512-UD-Q6_K_XL.gguf",
                hf_file="Devstral-Small-2-24B-Instruct-2512-UD-Q6_K_XL.gguf",
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
