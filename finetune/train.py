#!/usr/bin/env python3
"""Truffle QLoRA fine-tune (docs/03_finetune_plan.md).

Default path: Unsloth FastModel, 4-bit base, LoRA r=16 alpha=16 dropout=0 on
attention + MLP of the language layers only, Gemma 4 chat template, loss on
Truffle's replies only (train_on_responses_only).

Fallback path (--no-unsloth): transformers + bitsandbytes + peft, same LoRA,
same masking, plain transformers Trainer. Slower, but no Unsloth needed.

Real run (48GB GPU, see finetune/README.md):
    python finetune/train.py --out runs/truffle-r16
Dry run (tiny ungated model):
    python finetune/train.py --model unsloth/gemma-3-270m-it \
        --train finetune/data/examples.jsonl --eval finetune/data/examples.jsonl \
        --max-steps 3 --out runs/dry
Check the chat template and the loss mask without loading weights:
    python finetune/train.py --render-only 2 --train finetune/data/examples.jsonl --out /tmp/x
"""

from __future__ import annotations

import argparse
import json
import os
import platform
import sys
import time
from importlib import metadata
from pathlib import Path

HERE = Path(__file__).resolve().parent

LORA_TARGETS = ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"]


def parse_args(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--model", default="unsloth/gemma-4-31B-it")
    ap.add_argument("--train", default=str(HERE / "data/generated/train.jsonl"))
    ap.add_argument("--eval", default=str(HERE / "data/generated/eval_holdout.jsonl"),
                    help="eval loss set; pass '' to skip")
    ap.add_argument("--out", required=True, help="output dir for the LoRA adapter and train_meta.json")
    ap.add_argument("--max-steps", type=int, default=-1, help="cap optimizer steps (dry runs); -1 = use epochs")
    ap.add_argument("--max-seq-length", type=int, default=4096)
    ap.add_argument("--epochs", type=float, default=2)
    ap.add_argument("--lr", type=float, default=2e-4)
    ap.add_argument("--batch", type=int, default=2)
    ap.add_argument("--grad-accum", type=int, default=8)
    ap.add_argument("--warmup-ratio", type=float, default=0.05)
    ap.add_argument("--r", type=int, default=16)
    ap.add_argument("--alpha", type=int, default=16)
    ap.add_argument("--seed", type=int, default=3407)
    ap.add_argument("--logging-steps", type=int, default=5)
    ap.add_argument("--save-steps", type=int, default=50, help="checkpoint every N steps (resume after preemption)")
    ap.add_argument("--chat-template", default="gemma-4-thinking",
                    help="Unsloth chat template name (gemma-4-thinking for 26B/31B per Unsloth docs)")
    ap.add_argument("--instruction-part", default="<|turn>user\n")
    ap.add_argument("--response-part", default="<|turn>model\n")
    ap.add_argument("--thinking-render", choices=["off", "tier"], default="off",
                    help="off: render every example with enable_thinking=False (voice is learned in the "
                         "no-think format, base thinking left alone). tier: enable_thinking=True for high tier.")
    ap.add_argument("--no-4bit", action="store_true", help="load the base in 16-bit (LoRA, not QLoRA)")
    ap.add_argument("--no-unsloth", action="store_true", help="plain transformers + peft path")
    ap.add_argument("--render-only", type=int, default=0,
                    help="load only the tokenizer, print N rendered examples and their loss mask, exit")
    return ap.parse_args(argv)


# --------------------------------------------------------------------------- data

def load_jsonl(path):
    rows = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            if line.strip():
                rows.append(json.loads(line))
    return rows


def tier_of(row):
    return (row.get("meta") or {}).get("tier", "medium")


def render(tokenizer, row, thinking_render):
    """Chat-template one example to training text (no leading <bos>; the tokenizer adds it)."""
    msgs = [{"role": m["role"], "content": m["content"]} for m in row["messages"]]
    think = thinking_render == "tier" and tier_of(row) == "high"
    tok = getattr(tokenizer, "tokenizer", tokenizer)
    bos = getattr(tok, "bos_token", None) or ""
    try:
        text = tokenizer.apply_chat_template(msgs, tokenize=False, add_generation_prompt=False,
                                             enable_thinking=think)
    except Exception:
        # Multimodal processors may want content parts.
        parts = [{"role": m["role"], "content": [{"type": "text", "text": m["content"]}]} for m in msgs]
        text = tokenizer.apply_chat_template(parts, tokenize=False, add_generation_prompt=False,
                                             enable_thinking=think)
    return text.removeprefix(bos) if bos else text


def response_mask(input_ids, instr_ids, resp_ids):
    """labels: -100 everywhere except inside model turns (after resp marker, up to the next
    instruction marker). Same rule as Unsloth's train_on_responses_only."""
    labels = [-100] * len(input_ids)
    n, i, inside = len(input_ids), 0, False
    while i < n:
        if input_ids[i:i + len(resp_ids)] == resp_ids:
            i += len(resp_ids)
            inside = True
            continue
        if input_ids[i:i + len(instr_ids)] == instr_ids:
            inside = False
            i += len(instr_ids)
            continue
        if inside:
            labels[i] = input_ids[i]
        i += 1
    return labels


# ------------------------------------------------------------------------- helpers

def versions():
    out = {"python": platform.python_version()}
    for pkg in ("unsloth", "unsloth_zoo", "transformers", "trl", "peft", "torch", "datasets",
                "bitsandbytes", "accelerate", "xformers", "triton"):
        try:
            out[pkg] = metadata.version(pkg)
        except metadata.PackageNotFoundError:
            out[pkg] = None
    try:
        import torch
        out["cuda"] = torch.version.cuda
        if torch.cuda.is_available():
            out["gpu"] = torch.cuda.get_device_name(0)
            out["gpu_mem_gb"] = round(torch.cuda.get_device_properties(0).total_memory / 2**30, 1)
            out["bf16_supported"] = torch.cuda.is_bf16_supported()
    except Exception as e:  # noqa: BLE001
        out["torch_error"] = repr(e)
    return out


def log(msg):
    print(f"[train {time.strftime('%H:%M:%S')}] {msg}", flush=True)


def write_meta(out: Path, meta: dict):
    out.mkdir(parents=True, exist_ok=True)
    (out / "train_meta.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")


# ------------------------------------------------------------------------- render

def render_only(a):
    from transformers import AutoTokenizer
    tokenizer = AutoTokenizer.from_pretrained(a.model)
    if not a.no_unsloth and a.chat_template:
        from unsloth.chat_templates import get_chat_template
        tokenizer = get_chat_template(tokenizer, chat_template=a.chat_template)
    tok = getattr(tokenizer, "tokenizer", tokenizer)
    instr = tok(a.instruction_part, add_special_tokens=False)["input_ids"]
    resp = tok(a.response_part, add_special_tokens=False)["input_ids"]
    log(f"instruction_part {a.instruction_part!r} -> {instr}")
    log(f"response_part {a.response_part!r} -> {resp}")
    for row in load_jsonl(a.train)[: a.render_only]:
        text = render(tokenizer, row, a.thinking_render)
        ids = tok(text)["input_ids"]
        labels = response_mask(ids, instr, resp)
        trained = tok.decode([t for t, l in zip(ids, labels) if l != -100])
        print("=" * 30, "RENDERED", "=" * 30)
        print(text)
        print("-" * 30, f"TRAINED ON ({sum(l != -100 for l in labels)} of {len(ids)} tokens)", "-" * 30)
        print(trained)
    return 0


# -------------------------------------------------------------------------- main

def main(argv=None):
    a = parse_args(argv)
    if a.render_only:
        return render_only(a)

    out = Path(a.out).expanduser()
    t0 = time.time()
    hyper = {
        "model": a.model, "train": a.train, "eval": a.eval or None,
        "max_seq_length": a.max_seq_length, "load_in_4bit": not a.no_4bit,
        "lora": {"r": a.r, "alpha": a.alpha, "dropout": 0, "bias": "none", "targets": LORA_TARGETS,
                 "finetune_vision_layers": False, "finetune_language_layers": True},
        "epochs": a.epochs, "max_steps": a.max_steps, "lr": a.lr,
        "per_device_batch": a.batch, "grad_accum": a.grad_accum,
        "effective_batch": a.batch * a.grad_accum, "warmup_ratio": a.warmup_ratio,
        "scheduler": "linear", "optim": "adamw_8bit", "weight_decay": 0.001, "seed": a.seed,
        "chat_template": a.chat_template, "instruction_part": a.instruction_part,
        "response_part": a.response_part, "thinking_render": a.thinking_render,
        "path": "transformers+peft" if a.no_unsloth else "unsloth",
    }
    if not a.no_unsloth:
        import unsloth  # noqa: F401  (must import before transformers so its patches apply)
    vers = versions()
    log("hyperparameters " + json.dumps(hyper))
    log("versions " + json.dumps(vers))
    meta = {"status": "running", "started": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
            "hyperparameters": hyper, "versions": vers, "argv": sys.argv}
    write_meta(out, meta)

    import torch
    from datasets import Dataset

    train_rows = load_jsonl(a.train)
    eval_rows = load_jsonl(a.eval) if a.eval else []
    log(f"train examples {len(train_rows)}, eval examples {len(eval_rows)}")
    bf16 = torch.cuda.is_available() and torch.cuda.is_bf16_supported()

    if a.no_unsloth:
        model, tokenizer = load_plain(a, bf16)
    else:
        from unsloth import FastModel
        model, tokenizer = FastModel.from_pretrained(
            model_name=a.model, max_seq_length=a.max_seq_length,
            load_in_4bit=not a.no_4bit, full_finetuning=False, dtype=None,
        )
        model = FastModel.get_peft_model(
            model,
            finetune_vision_layers=False, finetune_language_layers=True,
            finetune_attention_modules=True, finetune_mlp_modules=True,
            r=a.r, lora_alpha=a.alpha, lora_dropout=0, bias="none",
            random_state=a.seed, use_gradient_checkpointing="unsloth",
        )
        from unsloth.chat_templates import get_chat_template
        tokenizer = get_chat_template(tokenizer, chat_template=a.chat_template)

    tok = getattr(tokenizer, "tokenizer", tokenizer)
    if tok.pad_token is None:
        tok.pad_token = tok.eos_token
    train_ds = Dataset.from_list([{"text": render(tokenizer, r, a.thinking_render)} for r in train_rows])
    eval_ds = Dataset.from_list([{"text": render(tokenizer, r, a.thinking_render)} for r in eval_rows]) if eval_rows else None
    log("rendered example 0:\n" + train_ds[0]["text"])

    logging_steps = 1 if 0 < a.max_steps < a.logging_steps else a.logging_steps
    # transformers 5 dropped warmup_ratio: turn the 5 percent into explicit steps.
    import math
    steps_per_epoch = math.ceil(len(train_rows) / (a.batch * a.grad_accum))
    total_steps = a.max_steps if a.max_steps > 0 else math.ceil(steps_per_epoch * a.epochs)
    warmup_steps = max(1, math.ceil(a.warmup_ratio * total_steps))
    log(f"total optimizer steps {total_steps}, warmup steps {warmup_steps}")
    meta["hyperparameters"].update(total_steps=total_steps, warmup_steps=warmup_steps)
    common = dict(
        per_device_train_batch_size=a.batch, per_device_eval_batch_size=a.batch,
        gradient_accumulation_steps=a.grad_accum, warmup_steps=warmup_steps,
        num_train_epochs=a.epochs, max_steps=a.max_steps, learning_rate=a.lr,
        logging_steps=logging_steps, optim="adamw_8bit", weight_decay=0.001,
        lr_scheduler_type="linear", seed=a.seed, output_dir=str(out / "checkpoints"),
        report_to="none", bf16=bf16, fp16=torch.cuda.is_available() and not bf16,
        save_strategy="steps", save_steps=a.save_steps, save_total_limit=2,
        eval_strategy="epoch" if eval_ds is not None else "no",
    )

    if a.no_unsloth:
        trainer = plain_trainer(a, model, tokenizer, train_ds, eval_ds, common)
    else:
        from trl import SFTConfig, SFTTrainer
        from unsloth.chat_templates import train_on_responses_only
        trainer = SFTTrainer(
            model=model, tokenizer=tokenizer, train_dataset=train_ds, eval_dataset=eval_ds,
            args=SFTConfig(dataset_text_field="text", max_length=a.max_seq_length,
                           dataset_num_proc=1, packing=False, **common),
        )
        trainer = train_on_responses_only(trainer, instruction_part=a.instruction_part,
                                          response_part=a.response_part)

    # Show what the loss sees, so a wrong marker is caught before burning GPU time.
    row = trainer.train_dataset[0]
    trained = [t for t, l in zip(row["input_ids"], row["labels"]) if l != -100]
    log(f"loss mask check: {len(trained)} of {len(row['input_ids'])} tokens trained")
    log("trained text of example 0:\n" + tok.decode(trained))
    if not trained:
        raise SystemExit("loss mask is empty: response_part does not match the rendered template")

    stats = trainer.train()
    eval_metrics = trainer.evaluate() if eval_ds is not None else {}
    model.save_pretrained(str(out))
    tokenizer.save_pretrained(str(out))
    wall = time.time() - t0
    meta.update({
        "status": "done", "finished": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "wall_time_s": round(wall, 1), "global_steps": stats.global_step,
        "train_loss": stats.training_loss, "train_metrics": stats.metrics,
        "eval_metrics": eval_metrics,
        "log_history": trainer.state.log_history,
        "peak_gpu_mem_gb": round(torch.cuda.max_memory_reserved() / 2**30, 2) if torch.cuda.is_available() else None,
    })
    write_meta(out, meta)
    log(f"saved LoRA adapter to {out} (wall {wall:.1f}s, steps {stats.global_step}, "
        f"train_loss {stats.training_loss:.4f}, eval {eval_metrics})")
    return 0


# --------------------------------------------------------------- fallback path

def load_plain(a, bf16):
    import torch
    from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
    from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig

    dtype = torch.bfloat16 if bf16 else torch.float16
    quant = None if a.no_4bit else BitsAndBytesConfig(
        load_in_4bit=True, bnb_4bit_quant_type="nf4", bnb_4bit_use_double_quant=True,
        bnb_4bit_compute_dtype=dtype)
    model = AutoModelForCausalLM.from_pretrained(a.model, quantization_config=quant, dtype=dtype,
                                                 device_map="auto", attn_implementation="eager")
    if quant is not None:
        model = prepare_model_for_kbit_training(model, use_gradient_checkpointing=True)
    # Language layers only: skip anything under a vision or audio tower.
    targets = r"^(?!.*(vision|audio|multi_modal)).*\.(" + "|".join(LORA_TARGETS) + r")$"
    model = get_peft_model(model, LoraConfig(r=a.r, lora_alpha=a.alpha, lora_dropout=0.0,
                                             bias="none", target_modules=targets, task_type="CAUSAL_LM"))
    model.print_trainable_parameters()
    tokenizer = AutoTokenizer.from_pretrained(a.model)
    try:
        from unsloth.chat_templates import get_chat_template  # template only, if available
        tokenizer = get_chat_template(tokenizer, chat_template=a.chat_template)
    except Exception as e:  # noqa: BLE001
        log(f"unsloth chat templates unavailable ({e!r}); using the model's own template")
    return model, tokenizer


def plain_trainer(a, model, tokenizer, train_ds, eval_ds, common):
    from transformers import DataCollatorForSeq2Seq, Trainer, TrainingArguments

    tok = getattr(tokenizer, "tokenizer", tokenizer)
    instr = tok(a.instruction_part, add_special_tokens=False)["input_ids"]
    resp = tok(a.response_part, add_special_tokens=False)["input_ids"]

    def encode(batch):
        enc = tok(batch["text"], truncation=True, max_length=a.max_seq_length)
        enc["labels"] = [response_mask(ids, instr, resp) for ids in enc["input_ids"]]
        return enc

    train_ds = train_ds.map(encode, batched=True, remove_columns=["text"])
    if eval_ds is not None:
        eval_ds = eval_ds.map(encode, batched=True, remove_columns=["text"])
    common["gradient_checkpointing"] = True
    common["remove_unused_columns"] = False
    return Trainer(model=model, args=TrainingArguments(**common), train_dataset=train_ds,
                   eval_dataset=eval_ds,
                   data_collator=DataCollatorForSeq2Seq(tok, padding=True, label_pad_token_id=-100))


if __name__ == "__main__":
    sys.exit(main())
