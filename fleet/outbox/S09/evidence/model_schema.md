# Model schema check

Checked on 2026-10-07. No model calls were used for this check.

Sources:

- https://developers.cloudflare.com/workers-ai/models/gemma-4-26b-a4b-it/
- https://huggingface.co/google/gemma-4-26B-A4B-it/raw/main/chat_template.jinja

The Cloudflare model page lists `messages`, `max_tokens`, `temperature`, `top_p`, `stream`, and `chat_template_kwargs`. It marks `max_tokens` as deprecated in favor of `max_completion_tokens`. S09 uses the requested `max_tokens` field. The output schema uses `choices` and `usage`.

The page exposes `chat_template_kwargs` as an object. It does not enumerate its keys or give a dedicated thinking switch. The upstream canonical Gemma 4 chat template contains these controls:

```jinja
{%- set enable_thinking = enable_thinking | default(false) -%}
{%- if enable_thinking -%}
{{- '<|think|>\n' -}}
{%- if not enable_thinking -%}
{{- '<|channel>thought\n<channel|>' -}}
```

These are separate relevant excerpts, not one complete template block. S09 passes `chat_template_kwargs: {"enable_thinking": false}` through the documented object. Whether Cloudflare honors this key is checked empirically in the saved responses. No extra instruction is added to the system or user prompts.

The model page lists $0.10 per million input tokens and $0.30 per million output tokens. Charges can depend on the account allowance. A token-based estimate is not a confirmed invoice.
