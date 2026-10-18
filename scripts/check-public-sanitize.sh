#!/usr/bin/env bash
# 公开仓库脱敏门禁
#
# 本仓库是公开仓库。同步 skill 内容时，容易把只对内部维护者有效的信息一起带进来
# （本机绝对路径、内部源码位置引用、内部系统地址、内部协作人姓名等）。
# 这个脚本把其中「可以用通用模式识别」的部分做成门禁；CI 会对每个 PR 运行它。
#
# 用法：
#   scripts/check-public-sanitize.sh
#   SANITIZE_EXTRA_PATTERNS=/path/to/local.txt scripts/check-public-sanitize.sh
#
# 例外：扫全仓时，文档本身需要举例说明「哪些形态不该出现」。这类**故意示范**的行可在
# 行尾加标记 `sanitize:allow`（建议用 HTML 注释承载，渲染不可见），该行即被跳过。
#
# 关于内部专有词（内部人名、内部仓库名、内部域名、公司邮箱等）：
# 这些词本身不能写进本仓库（否则规则文件自己就泄密了）。请把它们逐行写进一个
# **不提交**的本地文件（例如 scripts/.sanitize-local.txt，已在 .gitignore 中），
# 再用 SANITIZE_EXTRA_PATTERNS 指给脚本；提交前本地跑一次即可。
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SELF_REL="scripts/check-public-sanitize.sh"

# 通用模式：只包含「本身不敏感」的形态特征
GENERIC_PATTERNS=(
  # 本机绝对路径（macOS / Linux）。前缀加边界，避免误伤 URL 里的 /home/ 路径段。
  '(^|[^A-Za-z0-9._:/~-])(/Users|/home)/[A-Za-z0-9._-]+/'
  '[A-Za-z]:\\Users\\'                              # 本机绝对路径（Windows）
  '(^|[^A-Za-z0-9_~])~/code/'                       # 个人代码目录惯例
  '[A-Za-z0-9_-]+\.(ts|tsx|vue|js|mjs|d\.ts):[0-9]+' # 源码 文件:行号 形式的引用
)

fail=0

scan_one() {
  local pattern="$1"
  local label="$2"
  local hits
  # 行尾带 `sanitize:allow` 的行视为「文档故意示范」，跳过。
  # --untracked：本地自查时连「新增但尚未提交」的文件一起扫（受 .gitignore 约束）。
  hits="$(git grep -nIE --untracked -- "$pattern" -- . ":(exclude)${SELF_REL}" 2>/dev/null \
    | grep -v 'sanitize:allow' || true)"
  if [ -n "$hits" ]; then
    printf '\n[命中] %s\n%s\n' "$label" "$hits"
    fail=1
  fi
}

printf '扫描通用模式…\n'
for pattern in "${GENERIC_PATTERNS[@]}"; do
  scan_one "$pattern" "模式: $pattern"
done

if [ -n "${SANITIZE_EXTRA_PATTERNS:-}" ]; then
  if [ ! -f "$SANITIZE_EXTRA_PATTERNS" ]; then
    printf '\n[跳过] SANITIZE_EXTRA_PATTERNS 指向的文件不存在: %s\n' "$SANITIZE_EXTRA_PATTERNS"
  else
    printf '扫描本地扩展规则: %s\n' "$SANITIZE_EXTRA_PATTERNS"
    while IFS= read -r line || [ -n "$line" ]; do
      case "$line" in
        '' | '#'*) continue ;;
      esac
      scan_one "$line" "本地规则: $line"
    done < "$SANITIZE_EXTRA_PATTERNS"
  fi
else
  printf '未设置 SANITIZE_EXTRA_PATTERNS，跳过内部专有词检查（建议本地补跑）。\n'
fi

if [ "$fail" -ne 0 ]; then
  printf '\n❌ 检测到疑似不应公开的内容。请参考 README《公开仓库内容边界》处理后重试。\n'
  exit 1
fi

printf '\n✅ 脱敏检查通过\n'
