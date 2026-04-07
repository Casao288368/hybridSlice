#!/usr/bin/env bash

# Hybrid 批量续跑脚本：
# - 遍历 /root/hybrid-candidates-repos 下的所有仓库（或你指定的子集）
# - 对每个仓库调用 ./script-placer.sh
# - 无论单个仓库成功/失败，都不会中断整个批次
# - 使用一个“已处理列表”文件实现可重复、多次续跑

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HYBRID_CANDIDATES_ROOT="${PROJECT_ROOT}/hybrid-candidates-repos"
LOG="${PROJECT_ROOT}/hybrid_script_placer_resume.log"
DONE_FILE="${PROJECT_ROOT}/hybrid_script_placer_done.txt"

mkdir -p "$(dirname "$LOG")"
touch "$LOG" "$DONE_FILE"

echo "Hybrid batch resume started at $(date)" | tee -a "$LOG"
echo "PROJECT_ROOT=$PROJECT_ROOT" | tee -a "$LOG"
echo "HYBRID_CANDIDATES_ROOT=$HYBRID_CANDIDATES_ROOT" | tee -a "$LOG"

# 允许通过参数指定要处理的仓库列表文件（一行一个 repo 名）
REPO_LIST_FILE="${1:-}"

if [[ -n "$REPO_LIST_FILE" ]]; then
  if [[ ! -f "$REPO_LIST_FILE" ]]; then
    echo "Repo list file '$REPO_LIST_FILE' does not exist." | tee -a "$LOG"
    exit 1
  fi
  mapfile -t ALL_REPOS < <(grep -v '^\s*$' "$REPO_LIST_FILE")
else
  # 默认：遍历整个 hybrid-candidates-repos 目录
  mapfile -t ALL_REPOS < <(ls -1 "$HYBRID_CANDIDATES_ROOT")
fi

echo "Total repos to consider: ${#ALL_REPOS[@]}" | tee -a "$LOG"

for repo in "${ALL_REPOS[@]}"; do
  # 归一化 repo 名（去掉可能的路径前缀）
  repo_name="$(basename "$repo")"

  # 若该仓库已在 DONE_FILE 中，说明之前已跑过（无论成功失败），跳过实现“续跑”
  if grep -Fxq "$repo_name" "$DONE_FILE"; then
    echo "[SKIP] $repo_name already processed (in $DONE_FILE)" | tee -a "$LOG"
    continue
  fi

  REPO_PATH="${HYBRID_CANDIDATES_ROOT}/${repo_name}"
  if [[ ! -d "$REPO_PATH" ]]; then
    echo "[SKIP] $repo_name does not exist under $HYBRID_CANDIDATES_ROOT" | tee -a "$LOG"
    echo "$repo_name" >> "$DONE_FILE"
    continue
  fi

  echo "=== BEGIN ${repo_name} (resume) ===" | tee -a "$LOG"

  set +e
  ( cd "$PROJECT_ROOT" && ./script-placer.sh "$REPO_PATH" >>"$LOG" 2>&1 )
  exit_code=$?
  set -e

  if [[ $exit_code -eq 0 ]]; then
    echo "=== OK ${repo_name} (resume) ===" | tee -a "$LOG"
  else
    echo "=== FAIL ${repo_name} (resume, exit=$exit_code) ===" | tee -a "$LOG"
  fi

  echo "$repo_name" >> "$DONE_FILE"
  echo | tee -a "$LOG"
done

echo "Hybrid batch resume finished at $(date)" | tee -a "$LOG"

