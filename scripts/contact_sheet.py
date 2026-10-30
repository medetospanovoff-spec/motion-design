"""Tile PNG stills into one contact sheet for quick visual QC: contact_sheet.py out.png in1.png ..."""
import sys
from PIL import Image, ImageDraw

out, files = sys.argv[1], sys.argv[2:]
tw, th, cols = 270, 480, 6
rows = (len(files) + cols - 1) // cols
sheet = Image.new("RGB", (tw * cols, (th + 24) * rows), "#222")
d = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    im = Image.open(f).convert("RGB").resize((tw, th))
    x, y = (i % cols) * tw, (i // cols) * (th + 24)
    sheet.paste(im, (x, y + 24))
    d.text((x + 6, y + 6), f.split("/")[-1], fill="#fff")
sheet.save(out)
