#!/usr/bin/env python3
"""根据 data/slides.json 生成 data/slides.embed.js，供双击 index.html（file://）时加载题库。"""
import os
import sys


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    slides_path = os.path.join(root, "data", "slides.json")
    out_path = os.path.join(root, "data", "slides.embed.js")
    if not os.path.isfile(slides_path):
        print("找不到 data/slides.json", file=sys.stderr)
        sys.exit(1)
    with open(slides_path, "r", encoding="utf-8") as f:
        raw = f.read().strip()
    if not raw:
        print("slides.json 为空", file=sys.stderr)
        sys.exit(1)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("window.__SLIDES_EMBED__ = ")
        f.write(raw)
        f.write(";\n")
    print("已写入", out_path)


if __name__ == "__main__":
    main()
