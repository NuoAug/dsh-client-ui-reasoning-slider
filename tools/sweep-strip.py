# Stack several frames of chosen cards into one film strip, so a sparkle sweep's
# direction is visible in a single image.
#
# usage: python sweep-strip.py out.png <runA[,runB...]> frame1.png frame2.png ...
#   run indices are 0-based over the blue-filled capsules found top to bottom
#   (-1 = the last one). Each chosen run becomes one row per frame.
import sys
from PIL import Image, ImageDraw


def track_bands(image):
    """Row ranges of every capsule that carries a blue/violet fill."""
    width, height = image.size
    pixels = image.load()
    rows = []
    for y in range(height):
        hits = 0
        for x in range(0, width, 2):
            r, g, b = pixels[x, y]
            if b > r + 40 and b > 120 and g < b:
                hits += 1
        rows.append(hits)
    runs = []
    start = None
    for y, hits in enumerate(rows):
        if hits > width * 0.15:
            if start is None:
                start = y
        elif start is not None:
            runs.append((start, y - 1))
            start = None
    if start is not None:
        runs.append((start, height - 1))
    return runs


out = sys.argv[1]
wanted = [int(part) for part in sys.argv[2].split(",")]
paths = sys.argv[3:]
frames = [Image.open(path).convert("RGB") for path in paths]
bands = track_bands(frames[0])
picked = [bands[index] for index in wanted]
width = frames[0].size[0]

rows = []
label_height = 15
for index, frame in enumerate(frames):
    for run, band in zip(wanted, picked):
        top = max(0, band[0] - 78)
        bottom = min(frame.size[1], band[1] + 18)
        rows.append((f"run {run} · frame {index + 1}", frame.crop((0, top, width, bottom))))

height = sum(row[1].size[1] + label_height for row in rows)
strip = Image.new("RGB", (width, height), (24, 24, 28))
draw = ImageDraw.Draw(strip)
y = 0
for label, tile in rows:
    draw.text((6, y + 2), label, fill=(255, 255, 255))
    strip.paste(tile, (0, y + label_height))
    y += tile.size[1] + label_height
strip.save(out)
print(f"bands {picked}; wrote {out} {strip.size[0]}x{strip.size[1]}")
