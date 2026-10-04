# Prove the top tier's sparkle flash travels right to left.
#
# Renders of the compare page are caught at several moments of one sweep. For
# each frame this measures the track band of the LAST card (auto-detected from
# the blue fill), counts near-white pixels per column (the sparks; the static
# thumb adds a constant that the residual cancels), subtracts the across-frame
# mean profile, and reports where the residual peaks. A right-to-left wave makes
# those peaks walk left as time advances.
#
# usage: python sweep-check.py frame1.png frame2.png [frame3.png ...]
import sys
from PIL import Image


def track_band(image):
    """Row range of the last card's capsule, found from its blue/violet fill."""
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
        runs.append((start, len(rows) - 1))
    if not runs:
        return None
    return runs[-1]


def profile(image, y0, y1, threshold=168):
    width, _ = image.size
    pixels = image.load()
    counts = []
    for x in range(width):
        hits = 0
        for y in range(y0, y1 + 1):
            r, g, b = pixels[x, y]
            if r >= threshold and g >= threshold and b >= threshold:
                hits += 1
        counts.append(hits)
    return counts


def main():
    paths = sys.argv[1:]
    if len(paths) < 2:
        print("need at least two frames")
        return
    frames = [Image.open(path).convert("RGB") for path in paths]
    band = track_band(frames[0])
    if band is None:
        print("could not locate the top card's track band")
        return
    print(f"top-card track band: y {band[0]}..{band[1]}")
    profiles = [profile(frame, band[0], band[1]) for frame in frames]
    width = len(profiles[0])
    mean = [sum(p[x] for p in profiles) / len(profiles) for x in range(width)]
    peaks = []
    for index, prof in enumerate(profiles):
        residual = [prof[x] - mean[x] for x in range(width)]
        peak = max(range(width), key=lambda x: residual[x])
        peaks.append(peak)
        print(f"frame {index + 1} ({paths[index]}): residual peak at x={peak}, max residual={residual[peak]:.1f}")
    if len(peaks) >= 2:
        deltas = [peaks[i + 1] - peaks[i] for i in range(len(peaks) - 1)]
        direction = "leftward -> OK" if sum(deltas) < 0 else "rightward -> WRONG DIRECTION"
        print(f"peak movement: {deltas} -> {direction}")


main()
