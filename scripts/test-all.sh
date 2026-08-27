#!/usr/bin/env bash
# 遍历全部插件：node --check 语法检查 + npm test（单元测试 + 覆盖率门禁 + Gherkin 验收）
# 与 .github/workflows/ci.yml 保持一致。
set -e
for d in plugins/*/; do
  [ -f "$d/package.json" ] || continue
  echo "== $d =="
  for f in lib/index.js lib/client.js; do
    if [ -f "$d$f" ]; then
      node --check "$d$f"
    fi
  done
  (cd "$d" && npm test)
done
echo "ALL PLUGIN TESTS PASSED"
