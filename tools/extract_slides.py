#!/usr/bin/env python3
"""
从 PDF 智能提取幻灯片内容，生成 data/slides.json。

特点：
自动识别页面中的核心配图，并单独裁切提取（不包含外围边框与文字）；
自动寻找图片上方的文字作为 ID 和标题（如“2021410阴道毛滴虫”）；
自动寻找图片下方的文字作为题干提示（如“请报告图片中对象的名称”）；
从而实现「文字与配图完全分离」。

用法示例：
  python3 tools/extract_slides.py extract pdfs/sample.pdf --clear
"""
import argparse
import json
import os
import re
import sys
import fitz  # PyMuPDF


def project_root() -> str:
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def write_embed(slides_path: str) -> None:
    embed_path = os.path.join(os.path.dirname(slides_path), "slides.embed.js")
    try:
        with open(slides_path, "r", encoding="utf-8") as f:
            raw = f.read().strip()
        with open(embed_path, "w", encoding="utf-8") as ef:
            ef.write("window.__SLIDES_EMBED__ = ")
            ef.write(raw)
            ef.write(";\n")
        print(f"已生成 {embed_path}（解压文件夹后可直接双击 index.html 打开）")
    except OSError as e:
        print(f"警告：无法写入 slides.embed.js: {e}", file=sys.stderr)


def _trim_top_banner(img_path: str) -> None:
    """如果图片顶部有一条彩色横幅（如蓝色渐变的「2011尿液沉渣形态学检查室间质评」），原地裁掉。

    从顶部逐行往下扫描，如果某一行的色彩饱和度较高（不是灰白/中性色），
    说明是装饰性横幅而非显微照片内容，就继续往下找到横幅结束位置并裁掉。
    """
    from PIL import Image
    img = Image.open(img_path)
    w, h = img.size
    if h < 60:
        return

    step_x = max(1, w // 30)

    def row_is_colored(row_y):
        """判断某一行是否为彩色（高饱和度），而非显微灰/白。"""
        sat_total = 0
        bright_total = 0
        count = 0
        for col in range(0, w, step_x):
            r, g, b = img.getpixel((col, row_y))[:3]
            mx = max(r, g, b)
            mn = min(r, g, b)
            sat = (mx - mn) / (mx + 1) * 255
            sat_total += sat
            bright_total += (r + g + b) / 3
            count += 1
        avg_sat = sat_total / count if count else 0
        avg_bright = bright_total / count if count else 0
        return avg_sat > 25 and avg_bright > 80

    def row_is_white(row_y):
        total = 0
        count = 0
        for col in range(0, w, step_x):
            r, g, b = img.getpixel((col, row_y))[:3]
            total += (r + g + b) / 3
            count += 1
        return (total / count if count else 0) > 235

    # 检查最顶部几行是不是彩色横幅
    if not (row_is_colored(2) or row_is_colored(5) or row_is_white(2)):
        return

    # 从顶部往下找，找到横幅结束的位置（变成显微照片的中性灰色区域）
    cut_row = 0
    max_scan = min(h, int(h * 0.35))
    for row in range(0, max_scan):
        if row_is_colored(row) or row_is_white(row):
            cut_row = row + 1
        else:
            break

    if cut_row > h * 0.05 and cut_row < h * 0.35:
        cropped = img.crop((0, cut_row, w, h))
        cropped.save(img_path, quality=85)
    img.close()


def _trim_bottom_caption(img_path: str) -> None:
    """如果图片底部有一条白底文字区（如「图 3-4-108 类管型（一）」），原地裁掉。

    从底部逐行往上扫描像素亮度，找到连续的白色/近白区域上边界，
    如果这块白区占图片高度的 3%～20%（典型说明条），就把它切掉。
    """
    from PIL import Image
    img = Image.open(img_path)
    w, h = img.size
    if h < 40:
        return

    step_x = max(1, w // 30)

    cut_row = h
    for row in range(h - 1, max(0, h - int(h * 0.22)) - 1, -1):
        total = 0
        count = 0
        for col in range(0, w, step_x):
            r, g, b = img.getpixel((col, row))[:3]
            total += (r + g + b) / 3
            count += 1
        avg = total / count if count else 0
        if avg < 228:
            break
        cut_row = row

    trimmed = h - cut_row
    if trimmed > h * 0.03 and trimmed < h * 0.20:
        cropped = img.crop((0, 0, w, cut_row))
        cropped.save(img_path, quality=85)
        img.close()


def cmd_extract(args: argparse.Namespace) -> None:
    pdf_path = args.pdf
    out_root = os.path.abspath(args.out or project_root())
    images_dir = os.path.join(out_root, "assets", "images")
    slides_path = os.path.join(out_root, "data", "slides.json")
    os.makedirs(images_dir, exist_ok=True)
    os.makedirs(os.path.dirname(slides_path), exist_ok=True)

    if args.clear:
        for name in os.listdir(images_dir):
            p = os.path.join(images_dir, name)
            if os.path.isfile(p):
                os.remove(p)
        print(f"已清空 {images_dir}")

    doc = fitz.open(pdf_path)
    cards = []
    saved_paths = []
    seq = int(args.id_start)
    matrix = fitz.Matrix(args.scale, args.scale)
    jpg_q = int(args.jpg_quality)

    print(f"开始智能提取 {pdf_path} ...")

    for page_idx in range(len(doc)):
        page = doc[page_idx]
        
        # 1. 寻找页面上的所有图片区域
        image_infos = page.get_image_info(xrefs=True)
        valid_bboxes = []
        
        # 过滤掉太小的图标（如院标、装饰线条）
        for img in image_infos:
            x0, y0, x1, y1 = img["bbox"]
            if (x1 - x0) > 100 and (y1 - y0) > 100:
                valid_bboxes.append(img["bbox"])
                
        # 兜底：如果 get_image_info 没抓到，用 text_dict 里的 image block 抓取
        if not valid_bboxes:
            blocks = page.get_text("dict").get("blocks", [])
            for b in blocks:
                if b.get("type") == 1:
                    x0, y0, x1, y1 = b["bbox"]
                    if (x1 - x0) > 100 and (y1 - y0) > 100:
                        valid_bboxes.append(b["bbox"])
        
        # 去重：同一位置多图层时，优先保留内层（较小的实际内容图，而非含装饰横幅的外框图）
        unique_images = []
        for bbox in valid_bboxes:
            x0, y0, x1, y1 = bbox
            area = (x1 - x0) * (y1 - y0)
            merged = False
            for idx, (ux0, uy0, ux1, uy1) in enumerate(unique_images):
                cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
                ucx, ucy = (ux0 + ux1) / 2, (uy0 + uy1) / 2
                if abs(cx - ucx) < 50 and abs(cy - ucy) < 50:
                    u_area = (ux1 - ux0) * (uy1 - uy0)
                    if area < u_area:
                        unique_images[idx] = bbox
                    merged = True
                    break
            if not merged:
                unique_images.append(bbox)

        # 2. 提取文本块，用于匹配标题和提示
        text_blocks = [b for b in page.get_text("dict").get("blocks", []) if b.get("type") == 0]

        # 3. 针对每个识别出的大图，进行文字匹配和裁切
        for bbox in unique_images:
            ix0, iy0, ix1, iy1 = bbox
            
            # --- 裁切图片，但避开图片下方的说明文字 ---
            # 如果图片区域高度包含了下方的说明文字（如白底黑字），尝试缩小下边界
            crop_rect = fitz.Rect(ix0 - args.margin, iy0 - args.margin, ix1 + args.margin, iy1 + args.margin)
            crop_rect = crop_rect.intersect(page.rect)
            
            # 检测图片内部底部是否有纯文本区域，如果是则切除
            try:
                # 检查底部最后 25% 的区域，如果在 PDF 中被识别为了带文本的区域，则把边界上移
                for tb in text_blocks:
                    tx0, ty0, tx1, ty1 = tb["bbox"]
                    # 如果文本块在图片框内（或稍微超出一点），且在图片下半部分
                    if tx0 > crop_rect.x0 - 20 and tx1 < crop_rect.x1 + 20:
                        if ty0 > crop_rect.y1 - (crop_rect.height * 0.25) and ty1 < crop_rect.y1 + 15:
                            if ty0 < crop_rect.y1:
                                crop_rect.y1 = ty0 - 2 # 把底边往上缩，裁掉文字
            except Exception:
                pass
            
            # --- 寻找图片周围的文字作为标题和提示 ---
            candidate_texts = []
            for tb in text_blocks:
                tx0, ty0, tx1, ty1 = tb["bbox"]
                if tx1 > ix0 - 50 and tx0 < ix1 + 50:
                    if ty1 >= iy0 - 60 and ty0 <= iy1 + 60:
                        txt = "".join(span["text"] for line in tb.get("lines", []) for span in line.get("spans", []))
                        txt = txt.replace("\n", " ").strip()
                        if txt and not ("责任" in txt and "团队" in txt) and "室间质" not in txt and "回顾" not in txt:
                            # 距离图片的距离（如果是内部则距离为0）
                            dist = 0
                            if ty1 < iy0: dist = iy0 - ty1
                            elif ty0 > iy1: dist = ty0 - iy1
                            candidate_texts.append((dist, txt))
            
            candidate_texts.sort(key=lambda x: x[0])
            
            title_text = ""
            slide_id = ""
            prompt_text = args.default_prompt
            
            # 1. 优先找带连续数字（比如题号）的作为 ID 和 标题
            used_txt = ""
            for dist, txt in candidate_texts:
                match = re.search(r'(\d{4,})\s*(.*)', txt)
                if match:
                    slide_id = match.group(1)
                    title_text = match.group(2).strip()
                    used_txt = txt
                    break
            
            # 2. 如果没找到带数字的，就把最近的那行文字作为标题
            if not slide_id and candidate_texts:
                slide_id = args.id_format.format(n=seq)
                seq += 1
                title_text = candidate_texts[0][1]
                used_txt = candidate_texts[0][1]
            elif not slide_id:
                slide_id = args.id_format.format(n=seq)
                seq += 1
                title_text = "待标注"
                
            # 3. 找第二近的文字作为 prompt
            remaining_texts = [txt for dist, txt in candidate_texts if txt != used_txt]
            if remaining_texts:
                prompt_text = remaining_texts[0]
            else:
                # 尝试从左边/右边找
                side_texts = []
                for tb in text_blocks:
                    tx0, ty0, tx1, ty1 = tb["bbox"]
                    if ty1 > iy0 and ty0 < iy1:
                        if tx1 <= ix0: # 在左边
                            dist = ix0 - tx1
                            txt = "".join(span["text"] for line in tb.get("lines", []) for span in line.get("spans", []))
                            txt = txt.replace("\n", " ").strip()
                            if txt and not ("责任" in txt and "团队" in txt) and "室间质" not in txt and "回顾" not in txt:
                                side_texts.append((dist, txt))
                        elif tx0 >= ix1: # 在右边
                            dist = tx0 - ix1
                            txt = "".join(span["text"] for line in tb.get("lines", []) for span in line.get("spans", []))
                            txt = txt.replace("\n", " ").strip()
                            if txt and not ("责任" in txt and "团队" in txt) and "室间质" not in txt and "回顾" not in txt:
                                side_texts.append((dist, txt))
                side_texts.sort(key=lambda x: x[0])
                if side_texts:
                    prompt_text = side_texts[0][1]

            # --- 裁切图片 ---
            pix = page.get_pixmap(clip=crop_rect, matrix=matrix, alpha=False)

            img_name = f"{slide_id}.jpg"
            img_path = os.path.join(images_dir, img_name)
            pix.save(img_path, output="jpeg", jpg_quality=jpg_q)
            del pix

            cards.append({
                "id": slide_id,
                "title": title_text,
                "image": f"assets/images/{img_name}",
                "prompt": prompt_text
            })
            saved_paths.append(img_path)
            print(f"  提取第 {page_idx + 1} 页配图: ID={slide_id} | 标题={title_text}")

    doc.close()

    print(f"\n后处理：裁掉顶部横幅和底部文字条 ({len(saved_paths)} 张图片)…")
    for img_path in saved_paths:
        _trim_top_banner(img_path)
        _trim_bottom_caption(img_path)

    with open(slides_path, "w", encoding="utf-8") as f:
        json.dump(cards, f, ensure_ascii=False, indent=2)

    print(f"全部完成！共提取 {len(cards)} 条数据，已保存至 {slides_path}")
    write_embed(slides_path)


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="寄生虫幻灯片智能抽图与 slides.json 生成")
    sub = p.add_subparsers(dest="command", required=True)

    p_ext = sub.add_parser("extract", help="智能识别页面上的大图与文字，自动分离提取")
    p_ext.add_argument("pdf", help="PDF 路径")
    p_ext.add_argument(
        "--out",
        default="",
        help="项目根目录（默认为本工具上级目录）",
    )
    p_ext.add_argument(
        "--margin",
        type=float,
        default=2.0,
        help="裁切时图边界外扩（或内缩）像素，默认外扩 2 像素防止边缘丢失",
    )
    p_ext.add_argument(
        "--scale",
        type=float,
        default=2.0,
        help="PyMuPDF 缩放矩阵（默认 2，约 144dpi）",
    )
    p_ext.add_argument(
        "--jpg-quality",
        type=int,
        default=82,
        help="JPEG 质量（默认 82）",
    )
    p_ext.add_argument(
        "--clear",
        action="store_true",
        help="抽取前清空 assets/images/",
    )
    p_ext.add_argument(
        "--id-start",
        type=int,
        default=1,
        help="无法识别 ID 时的自动起始序号",
    )
    p_ext.add_argument(
        "--id-format",
        default="auto_{n:04d}",
        help="无法识别 ID 时的格式，默认 auto_{n:04d}",
    )
    p_ext.add_argument(
        "--default-prompt",
        default="请报告图片中对象的名称",
        help="无法识别图片下方文字时写入的默认题干",
    )

    p_ext.set_defaults(_run=lambda a: cmd_extract(a))
    return p


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    if hasattr(args, "_run"):
        args._run(args)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
