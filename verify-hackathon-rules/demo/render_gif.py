#!/usr/bin/env python3
"""Render the actual saved demo transcript as an animation. Requires Pillow only."""
import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--transcript", default=str(Path(__file__).parent / "sample/transcript.txt"))
parser.add_argument("--out", default=str(Path(__file__).parent / "demo.gif"))
parser.add_argument("--font", default="/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf")
args = parser.parse_args()
text = Path(args.transcript).read_text(encoding="utf-8").splitlines()
font = ImageFont.truetype(args.font, 23)
small = ImageFont.truetype(args.font, 17)
frames = []
for visible in (4, 9, len(text)):
    image = Image.new("RGB", (1280, 800), "#101923")
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((28, 26, 1252, 774), radius=20, fill="#172430", outline="#315260", width=2)
    draw.text((58, 48), "verify-hackathon-rules", font=font, fill="#ecf7f4")
    draw.rounded_rectangle((740, 46, 1216, 90), radius=12, fill="#263d3e")
    draw.text((758, 58), "OFFLINE FIXTURE  /  0 NETWORK CALLS", font=small, fill="#8de5c6")
    draw.line((58, 110, 1220, 110), fill="#315260", width=2)
    for index, line in enumerate(text[:visible]):
        color = "#8de5c6" if index in (0, 5, 10, 11) else "#e6edef"
        draw.text((58, 148 + index * 40), line, font=font, fill=color)
    draw.text((58, 728), "Rendered from the executed demo transcript. Synthetic event; not live API proof.", font=small, fill="#a7b9c2")
    frames.append(image)
frames[0].save(args.out, save_all=True, append_images=frames[1:], duration=[2400, 4200, 5400], loop=0, optimize=True)
print(f"Saved {args.out}")
