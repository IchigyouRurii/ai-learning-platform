#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_ROOT="${HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies"

if ! command -v node >/dev/null 2>&1; then
  if [[ -x "${RUNTIME_ROOT}/node/bin/node" ]]; then
    export PATH="${RUNTIME_ROOT}/node/bin:${PATH}"
  else
    echo "请先安装 Node.js 24 LTS。" >&2
    exit 1
  fi
fi

if ! command -v pnpm >/dev/null 2>&1; then
  if [[ -x "${RUNTIME_ROOT}/bin/fallback/pnpm" ]]; then
    export PATH="${RUNTIME_ROOT}/bin/fallback:${PATH}"
  else
    echo "请先运行 npm install -g pnpm@11.25.0。" >&2
    exit 1
  fi
fi

cd "${PROJECT_DIR}"
exec pnpm "${@:-dev}"
