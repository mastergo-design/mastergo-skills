#!/usr/bin/env bash
# 公开仓库门禁（两道）
#
# ① 脱敏检查：本仓库是公开仓库。同步 skill 内容时，容易把只对内部维护者有效的信息一起带进来
#    （本机绝对路径、内部源码位置引用、内部系统地址、内部协作人姓名等）。
#    这里把其中「可以用通用模式识别」的部分做成门禁；CI 会对每个 PR 运行它。
# ② 内容边界检查（同步策略）：skills/plugin-develop 是「插件 API skill」，
#    只允许插件 API 内容（API 参考 / 节点类型 / 开发指南 / 模板）。
#    内部维护流程（类型发布、文档站更新、E2E 单测）、插件审核与上线验证及其脚本禁止同步。
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
  EXTRA="$SANITIZE_EXTRA_PATTERNS"
elif [ -f "scripts/.sanitize-local.txt" ]; then
  # 默认回退：不设环境变量也自动启用本地词表（文件被 .gitignore，各机器自行维护）
  EXTRA="scripts/.sanitize-local.txt"
else
  EXTRA=""
fi

if [ -n "$EXTRA" ]; then
  if [ ! -f "$EXTRA" ]; then
    printf '\n[跳过] 扩展词表不存在: %s\n' "$EXTRA"
  else
    printf '扫描内部专有词表: %s\n' "$EXTRA"
    while IFS= read -r line || [ -n "$line" ]; do
      case "$line" in
        '' | '#'*) continue ;;
      esac
      scan_one "$line" "内部专有词: $line"
    done < "$EXTRA"
  fi
else
  printf '⚠️  无内部专有词表（scripts/.sanitize-local.txt 不存在），词表检查被跳过。\n'
  printf '    反向同步前务必补上词表——通用模式抓不住内部仓库名/服务名。\n'
fi

# ───────────────────────────── 内容边界（同步策略）─────────────────────────────
# plugin-develop 是「插件 API skill」：只允许插件 API 内容进入公开仓。
# 内部维护流程（类型发布 / 文档站更新 / E2E 单测）、插件审核与上线验证、
# 以及这些流程配套的脚本，一律不许同步进来。规则说明见 README《同步策略》。
# 允许清单是**白名单**：新增文件必须先在这里登记，并能在 PR 里说明「它属于插件 API 内容」。
BOUNDARY_DIR="skills/plugin-develop"
BOUNDARY_ALLOWED=(
  "${BOUNDARY_DIR}/SKILL.md"
  "${BOUNDARY_DIR}/references/api-quick-reference.md"
  "${BOUNDARY_DIR}/references/common-patterns.md"
  "${BOUNDARY_DIR}/references/development-guide.md"
  "${BOUNDARY_DIR}/references/node-types.md"
  "${BOUNDARY_DIR}/assets/main.ts.template"
  "${BOUNDARY_DIR}/assets/manifest.json.template"
  "${BOUNDARY_DIR}/assets/ui.html.template"
)

# 内部维护 / 审核流程特征词：出现即说明「非插件 API 内容」被同步进来了
BOUNDARY_DENY=(
  'MG_DOCS_ROOT'
  'MG_PLUGIN_TYPINGS'
  'MG_PLUGIN_DOCS'
  'MG_PLUGIN_TESTS'
  'plugin-docs'
  'plugins-repo'
  'plugin api update'
  '插件社区审核'
  '审核平台'
  'run-online'
  'audit\.js'
)

printf '检查内容边界（%s 只允许插件 API 内容）…\n' "$BOUNDARY_DIR"

while IFS= read -r f; do
  [ -n "$f" ] || continue
  allowed=0
  for a in "${BOUNDARY_ALLOWED[@]}"; do
    if [ "$f" = "$a" ]; then allowed=1; break; fi
  done
  if [ "$allowed" -eq 0 ]; then
    printf '\n[越界] %s\n  不在插件 API 允许清单内。若确属插件 API 内容，先在 scripts/check-public-sanitize.sh 与 README《同步策略》登记。\n' "$f"
    fail=1
  fi
done < <(git ls-files --cached --others --exclude-standard -- "$BOUNDARY_DIR")

for pattern in "${BOUNDARY_DENY[@]}"; do
  hits="$(git grep -nIE --untracked -- "$pattern" -- "$BOUNDARY_DIR" 2>/dev/null \
    | grep -v 'sanitize:allow' || true)"
  if [ -n "$hits" ]; then
    printf '\n[非插件 API 内容] 模式: %s\n%s\n' "$pattern" "$hits"
    fail=1
  fi
done

if [ "$fail" -ne 0 ]; then
  printf '\n❌ 检测到疑似不应公开的内容。请参考 README《公开仓库内容边界》《同步策略》处理后重试。\n'
  exit 1
fi

printf '\n✅ 脱敏检查通过（含插件 API 内容边界）\n'
