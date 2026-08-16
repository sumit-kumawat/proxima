#!/usr/bin/env sh
# Proxima IDE — startup hook. code-server runs every executable in $ENTRYPOINTD
# at container start (as the `coder` user, before the editor boots). This renders
# OpenCode's config so the in-guest AI agent talks ONLY to the Proxima LLM
# gateway — the tenant never sees the upstream endpoint, keys, or real model names.
#
# Provisioning (Proxima) sets the environment:
#   PROXIMA_IDE_GATEWAY_URL   the OpenAI-compatible base, e.g.
#                              https://proxima.example.com/api/ide/<vmId>/llm/v1
#   PROXIMA_IDE_TOKEN         the per-VM gateway token (referenced via {env:…},
#                              so it is NEVER written to the config file in clear)
#   PROXIMA_IDE_MODELS_JSON   OpenCode `models` map, e.g. {"shared:llama":{"name":"Llama 3.1"}}
#   PROXIMA_IDE_DEFAULT_MODEL optional default, e.g. shared:llama
#
# With no gateway env set this is a no-op (OpenCode keeps its own built-in models).
set -eu

[ -n "${PROXIMA_IDE_GATEWAY_URL:-}" ] || exit 0

CONFIG_DIR="${HOME:-/home/coder}/.config/opencode"
mkdir -p "$CONFIG_DIR"

# NB: don't use `${VAR:-{}}` — POSIX sh treats the first `}` as the end of the
# expansion and leaks the second as a literal, corrupting the JSON. Default plainly.
MODELS="${PROXIMA_IDE_MODELS_JSON:-}"
[ -n "$MODELS" ] || MODELS='{}'
DEFAULT_LINE=""
if [ -n "${PROXIMA_IDE_DEFAULT_MODEL:-}" ]; then
  DEFAULT_LINE="  \"model\": \"proxima/${PROXIMA_IDE_DEFAULT_MODEL}\","
fi

cat > "$CONFIG_DIR/opencode.json" <<EOF
{
  "\$schema": "https://opencode.ai/config.json",
$DEFAULT_LINE
  "provider": {
    "proxima": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Proxima",
      "options": {
        "baseURL": "${PROXIMA_IDE_GATEWAY_URL}",
        "apiKey": "{env:PROXIMA_IDE_TOKEN}"
      },
      "models": ${MODELS}
    }
  }
}
EOF

echo "[proxima-ide] wrote OpenCode gateway config -> $CONFIG_DIR/opencode.json"
