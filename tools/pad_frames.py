"""切り分けたポーズ画像（slice_sheet.py の出力）を、同じ大きさの透明な台紙に「足もと中央そろえ」で並べ直す。

全コマが同じ縮尺・同じ位置になるので、ゲームは今の表示枠（68×68）のまま絵だけを差し替えられる。
立ち姿（front）が、元のバトル画像（assets/characters/battle/<id>.png）と同じ高さの割合・同じ足もとの位置になるように合わせる。

使い方:
  python tools/pad_frames.py --id wankou --src ../gemini-images/sliced
  → assets/characters/battle-anim/wankou/{front,walk_1,walk_2,attack_1,attack_2,hit}.png（128×128）
"""
import argparse
import math
import sys
from pathlib import Path

from PIL import Image

POSES = ["front", "walk_1", "walk_2", "attack_1", "attack_2", "hit"]
OUT_SIZE = 128
WEB = Path(__file__).resolve().parent.parent


def trim(img: Image.Image) -> Image.Image:
    box = img.getchannel("A").point(lambda a: 255 if a > 16 else 0).getbbox()
    return img.crop(box) if box else img


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--id", required=True)
    ap.add_argument("--src", required=True, help="slice_sheet.py の出力フォルダ（<id>_<pose>.png）")
    a = ap.parse_args()

    ref = Image.open(WEB / "assets/characters/battle" / f"{a.id}.png").convert("RGBA")
    rbox = ref.getchannel("A").point(lambda v: 255 if v > 16 else 0).getbbox()
    ref_h_ratio = (rbox[3] - rbox[1]) / ref.height
    ref_bottom_ratio = (ref.height - rbox[3]) / ref.height

    frames = {}
    for pose in POSES:
        path = Path(a.src) / f"{a.id}_{pose}.png"
        if not path.exists():
            print(f"見つかりません: {path}", file=sys.stderr)
            return 1
        frames[pose] = trim(Image.open(path).convert("RGBA"))

    stand_h = frames["front"].height
    side = math.ceil(stand_h / ref_h_ratio)
    bottom = round(side * ref_bottom_ratio)
    need_w = max(f.width for f in frames.values())
    need_h = max(f.height for f in frames.values()) + bottom
    if need_w > side or need_h > side:
        print(f"注意: はみ出すコマがあるため台紙を広げます（立ち姿が元より少し小さく見えます） {side} → {max(need_w, need_h)}")
        side = max(need_w, need_h)

    out = WEB / "assets/characters/battle-anim" / a.id
    out.mkdir(parents=True, exist_ok=True)
    for pose, f in frames.items():
        canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
        canvas.alpha_composite(f, ((side - f.width) // 2, side - bottom - f.height))
        canvas.resize((OUT_SIZE, OUT_SIZE), Image.LANCZOS).save(out / f"{pose}.png", optimize=True)
    print(f"{a.id}: {len(frames)} コマを {out} に保存（台紙 {side}px → {OUT_SIZE}px）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
