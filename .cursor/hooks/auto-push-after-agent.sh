#!/usr/bin/env bash
# Agent stop hook: 若有未提交改动则 commit，再 push（需已配置 remote/upstream）。
#
# 取消本次仓库的自动推送（任选其一）：
#   • 在工作区创建空文件：.cursor/no-auto-push（已加入 .gitignore，仅本机生效）
#   • 环境变量：CURSOR_AUTO_PUSH=0
#
# 仅当 Agent 正常结束（stdin JSON 里 status=completed）时执行；aborted/error 不提交。

out() { printf '%s\n' "$1"; }

INPUT=$(cat || true)
STATUS="$(
  printf '%s' "$INPUT" | python3 -c '
import json, sys
try:
    d = json.load(sys.stdin)
    print(d.get("status") or "completed")
except Exception:
    print("completed")
' 2>/dev/null || echo "completed"
)"

if [[ "$STATUS" != "completed" ]]; then
  out '{}'
  exit 0
fi

ROOT="${CURSOR_PROJECT_DIR:-${CLAUDE_PROJECT_DIR:-}}"
if [[ -z "$ROOT" || ! -d "$ROOT" ]]; then
  out '{}'
  exit 0
fi
cd "$ROOT" || { out '{}'; exit 0; }

if [[ -f ".cursor/no-auto-push" ]]; then
  out '{}'
  exit 0
fi
if [[ "${CURSOR_AUTO_PUSH:-1}" == "0" ]]; then
  out '{}'
  exit 0
fi

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  out '{}'
  exit 0
fi

TS="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
# 有未暂存或未提交变更时才 commit
if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
  git add -A
  git commit -m "chore(agent): sync ${TS}" --no-verify 2>/dev/null || true
fi

git push --no-verify 2>/dev/null || true

out '{}'
exit 0
