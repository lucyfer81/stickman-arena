#!/usr/bin/env python3
import sys
from PIL import Image

def analyze(path):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    px = im.load()
    bright = redish = cyan = yellow = green = purple = nonbg = 0
    rowhit = [0] * h
    colhit = [0] * w
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            mx, mn = max(r, g, b), min(r, g, b)
            if mx > 200 and mx - mn < 45: bright += 1
            if r > 150 and g < 110 and b < 110: redish += 1
            if b > 150 and g > 150 and r < 130: cyan += 1
            if r > 200 and g > 180 and b < 130: yellow += 1
            if g > 150 and r < 140 and b < 140: green += 1
            if r > 130 and b > 130 and g < 110: purple += 1
            if not (r < 45 and g < 45 and b < 60):
                nonbg += 1; rowhit[y] += 1; colhit[x] += 1
    top = next((y for y in range(h) if rowhit[y] > 5), -1)
    bot = next((y for y in range(h - 1, -1, -1) if rowhit[y] > 5), -1)
    left = next((x for x in range(w) if colhit[x] > 5), -1)
    right = next((x for x in range(w - 1, -1, -1) if colhit[x] > 5), -1)
    pct = 100.0 * nonbg / (w * h)
    print(f"[{path}] {w}x{h} nonbg={pct:.1f}% bright={bright} red={redish} cyan={cyan} yellow={yellow} green={green} purple={purple}")
    print(f"   content box: x[{left}..{right}] y[{top}..{bot}]")

for p in sys.argv[1:]:
    try:
        analyze(p)
    except Exception as e:
        print(p, "ERR", e)
