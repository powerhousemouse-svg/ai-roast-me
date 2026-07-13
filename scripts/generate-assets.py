#!/usr/bin/env python3
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
ASSETS.mkdir(parents=True, exist_ok=True)


def make_icon(size: int, out: Path) -> None:
    img = Image.new("RGB", (size, size), "#000000")
    draw = ImageDraw.Draw(img)
    margin = size // 8
    draw.rounded_rectangle(
        [margin, margin, size - margin, size - margin],
        radius=size // 6,
        fill="#111111",
        outline="#22ff88",
        width=max(4, size // 128),
    )
    try:
        font = ImageFont.truetype(
            "/System/Library/Fonts/Apple Color Emoji.ttc",
            size=int(size * 0.42),
        )
        text = "🔥"
        bbox = draw.textbbox((0, 0), text, font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        draw.text(
            ((size - tw) / 2, (size - th) / 2 - size * 0.04),
            text,
            font=font,
            embedded_color=True,
        )
    except Exception:
        draw.text((size // 2 - 30, size // 2 - 20), "RL", fill="#22ff88")
    img.save(out, "PNG")


def make_splash(w: int, h: int, out: Path) -> None:
    img = Image.new("RGB", (w, h), "#000000")
    draw = ImageDraw.Draw(img)
    draw.text((w // 2 - 120, h // 2 - 80), "ROASTLORD", fill="#ffffff")
    draw.text((w // 2 - 130, h // 2 + 10), "GET ABSOLUTELY COOKED", fill="#22ff88")
    img.save(out, "PNG")


if __name__ == "__main__":
    make_icon(1024, ASSETS / "icon.png")
    make_splash(2732, 2732, ASSETS / "splash.png")
    print("Generated assets/icon.png and assets/splash.png")