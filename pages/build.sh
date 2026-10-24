#!/bin/bash
# 生成 GitHub Pages 要发布的文件：app/ 放原样的页面和资源，外层每个页面是一个装框的外壳。
# 用法：bash pages/build.sh 输出目录（一般是 gh-pages 分支的工作目录）
set -e
SRC="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:?请给出输出目录}"
PAGES="index draw rank score admin final"
mkdir -p "$OUT/app"
rsync -a --delete "$SRC/vendor" "$SRC/fonts" "$SRC/assets" "$SRC/theme.css" "$SRC/cloud.js" "$SRC/deco.js" "$OUT/app/"
for p in $PAGES; do cp "$SRC/$p.html" "$OUT/app/"; done
cp "$SRC/pages/shell.js" "$OUT/shell.js"
for p in $PAGES; do
  title=$(grep -o '<title>[^<]*</title>' "$SRC/$p.html" | head -1)
  cat > "$OUT/$p.html" <<HTML
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="theme-color" content="#f6f0e3">
$title
<style>html,body{margin:0;height:100%;background:#f6f0e3;overflow:hidden}iframe{position:fixed;inset:0;width:100%;height:100%;border:0;display:block}</style>
</head>
<body>
<script src="shell.js?v=1"></script>
</body>
</html>
HTML
done
touch "$OUT/.nojekyll"
echo "已生成到 $OUT"
