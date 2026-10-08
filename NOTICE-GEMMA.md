# Gemma notice

Truffle uses **Gemma 4 31B IT**, developed by Google DeepMind. Its published
license is **Apache 2.0**. The exact training and serving checkpoints used by
this project identify the same license:

- Base: [google/gemma-4-31B-it](https://huggingface.co/google/gemma-4-31B-it).
- Training mirror: [unsloth/gemma-4-31B-it](https://huggingface.co/unsloth/gemma-4-31B-it).
- Quantized serving checkpoint: [RedHatAI/gemma-4-31B-it-FP8-dynamic](https://huggingface.co/RedHatAI/gemma-4-31B-it-FP8-dynamic).

Google publishes the applicable license at
[Gemma's Apache 2.0 license page](https://ai.google.dev/gemma/apache_2).
These publisher sources were checked on October 9, 2026.

The Truffle `r16` LoRA is a project-specific adaptation. Model weights and
adapter artifacts are separate from this repository's MIT application code.
This notice does not assign a new license to unpublished adapter files. A
distributed adapter or merged checkpoint should include its own accurate
model card, provenance, license files and retained upstream notices. Follow
Apache 2.0's redistribution conditions for any upstream material included.

An earlier version of this notice incorrectly applied the older Gemma Terms
of Use and their broad “Model Derivatives” wording to these Gemma 4
checkpoints and generated training examples. The cited Gemma 4 model cards
do not support that assertion. Do not infer a dataset's license solely from
the name of the model used to generate it; preserve the dataset's own source
and license information.
