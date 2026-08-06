#!/usr/bin/env python3
import sys
from PIL import Image

def cls(r, g, b):
    mx, mn = max(r, g, b), min(r, g, b)
    if mx < 60:
        return ' '
    if mx > 190 and mx - mn < 50:
        return '#'  # white/bright
    if g > 130 and b > 150 and r < 150:
        return 'C'  # cyan
    if r > 170 and g < 130 and b < 130:
        return 'R'  # red/orange
    if r > 180 and g > 150 and b < 120:
        return 'Y'  # yellow
    if g > 140 and r < 150 and b < 150:
        return 'G'  # green
    if r > 120 and b > 120 and g < 120:
        return 'P'  # purple
    if mx < 110:
        return '.'
    return ':'

def render(path, cols=120, rows=46):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    px = im.load()
    cw = w / cols
    ch = h / rows
    print(f"=== {path} ({w}x{h}) ===")
    for row in range(rows):
        line = []
        for col in range(cols):
            x = int((col + 0.5) * cw)
            y = int((row + 0.5) * ch)
            r, g, b = px[x, y]
            line.append(cls(r, g, b))
        print(''.join(line))

for p in sys.argv[1:]:
    try:
        render(p)
    except Exception as e:
        print(p, "ERR", e)
