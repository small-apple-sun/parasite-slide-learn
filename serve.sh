#!/usr/bin/env bash
# 在「形态学识图」项目根目录启动本地 HTTP，便于加载 data/slides.json。
cd "$(dirname "$0")"
PORT="${1:-8766}"
echo "形态学识图：http://127.0.0.1:${PORT}/"
echo "若端口被占用，可传参换端口：./serve.sh 9000"
exec python3 -m http.server "$PORT"
