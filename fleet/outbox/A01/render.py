#!/usr/bin/env python3
"""Generate Truffle art and local Pillow proofs. No network access.

The exported sprites have no runtime dependency on this generator.

All output stays beside this file. Rows include their trailing spaces.
The grid is 11 by 20 pixels per cell. A font is never downloaded.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import math
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont
import PIL

ROOT = Path(__file__).resolve().parent
PREVIEW = ROOT / "preview"
CELL = (11, 20)
ASPECT = CELL[0] / CELL[1]
SUPERSAMPLE = 4
MOODS = ("content", "affectionate", "asleep", "tired", "wilting", "yawn")
STYLES = ("classic", "hatching", "blocks")
RECOMMENDED = "classic"
PALETTES = {
    "dark": {"background": "#dfcda6", "ink": "#34382e", "name": "dark-ink"},
    "light": {"background": "#172c3b", "ink": "#e8eddb", "name": "light-ink"},
}
SIZES = {"spore": (16, 5), "sprout": (16, 6), "truffle": (18, 8), "elder": (22, 10)}
ALLOWED = set(chr(n) for n in range(32, 127)) | set("░▒▓█─│")
LIGHT = (-0.58, -0.64, 0.72)
LIGHT = tuple(v / math.sqrt(sum(t * t for t in LIGHT)) for v in LIGHT)
CLASSIC_RAMP = " .:-=+*#%@"
BLOCK_RAMP = " .░▒▓█"
FONT_CANDIDATES = (
    "/usr/share/fonts/truetype/noto/NotoSansMono-Regular.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
)
# A few wide bumps. Tiny random speckles would obscure the expression.
WARTS = (
    (-0.62, -0.50, 0.23, 0.085),
    (-0.13, -0.77, 0.20, 0.075),
    (0.45, -0.56, 0.23, 0.125),
    (0.76, -0.04, 0.23, 0.110),
    (0.65, 0.50, 0.23, 0.100),
    (0.05, 0.78, 0.24, 0.085),
    (-0.58, 0.53, 0.24, 0.080),
    (-0.80, 0.00, 0.18, 0.085),
)


def clamp(n: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, n))


def output(path: Path, data: bytes) -> None:
    """Only write inside A01. Read old generated output before replacing it."""
    if not path.resolve().is_relative_to(ROOT):
        raise ValueError(f"Output outside A01: {path}")
    path.parent.mkdir(parents=True, exist_ok=True)
    previous = path.read_bytes() if path.exists() else None
    if previous != data:
        path.write_bytes(data)


def json_output(path: Path, value: Any) -> None:
    output(path, (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode())


def png_output(path: Path, image: Image.Image) -> None:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    output(path, buffer.getvalue())


def blank(w: int, h: int) -> list[list[str]]:
    return [[" "] * w for _ in range(h)]


def put(grid: list[list[str]], x: int, y: int, text: str) -> None:
    assert 0 <= y < len(grid), (x, y, text)
    assert 0 <= x and x + len(text) <= len(grid[0]), (x, y, text)
    grid[y][x:x + len(text)] = list(text)


def rows(grid: list[list[str]]) -> list[str]:
    return ["".join(row) for row in grid]


def shade(style: str, density: float, x: int, y: int) -> str:
    d = clamp(density)
    if style == "classic":
        return CLASSIC_RAMP[round(d * (len(CLASSIC_RAMP) - 1))]
    if style == "blocks":
        return BLOCK_RAMP[round(d * (len(BLOCK_RAMP) - 1))]
    # Engraving uses coherent diagonal cuts, not random slash noise.
    if d < 0.10:
        return " "
    if d < 0.22:
        return "." if (x + y) % 3 else ":"
    if d < 0.40:
        return "/" if (x + y) % 2 else ":"
    if d < 0.58:
        return "/"
    if d < 0.72:
        return "x" if (x - y) % 3 else "|"
    if d < 0.88:
        return "#" if (x + y) % 2 else "x"
    return "#"


def density(light: float, ramp: str, muted: bool = False) -> float:
    # Auto-level the 0.25 ambient term into the usable character range.
    value = clamp((light - 0.20) / 0.80)
    d = 1.0 - value if ramp == "dark" else value
    # Wilting is lower ink coverage, not a second ink color.
    return d * 0.65 if muted else d


def ellipsoid(
    w: int, h: int, cx: float, cy: float, rx: float, ry: float,
    bump: float = 1.0, shear: float = 0.0, sag: float = 0.0,
) -> dict[tuple[int, int], tuple[float, float, float]]:
    """Normal map in physical cell units. Returns luminance, u and v.

    The ellipsoid is shallow in Z. Gaussian relief changes its derivatives.
    The boundary has a subtle broad wobble, like a desert truffle skin.
    """
    samples = {}
    depth = rx * ASPECT * 0.82
    for y in range(h):
        for x in range(w):
            v = (y - cy) / ry
            center = cx - shear * v
            u = (x - center) / rx
            v -= sag * u * 0.20
            theta = math.atan2(v, u)
            border = 1.0 + bump * 0.020 * math.sin(7 * theta + 0.8)
            q = (u * u + v * v) / (border * border)
            if q >= 1.0:
                continue
            z = math.sqrt(max(0.025, 1.0 - u * u - v * v))
            du, dv = -u / z, -v / z
            for bx, by, radius, height in WARTS:
                h_bump = bump * height * math.exp(-((u - bx) ** 2 + (v - by) ** 2) / radius ** 2)
                du -= h_bump * 2 * (u - bx) / radius ** 2
                dv -= h_bump * 2 * (v - by) / radius ** 2
            normal = (-depth * du / (rx * ASPECT), -depth * dv / ry, 1.0)
            norm = math.sqrt(sum(n * n for n in normal))
            lambert = max(0.0, sum(n / norm * l for n, l in zip(normal, LIGHT)))
            light = 0.25 + 0.75 * lambert
            # Low frequency albedo variation, kept weaker than the lighting.
            light = clamp(light + bump * 0.025 * math.sin(9 * u + 4 * v) * math.cos(6 * v - u))
            samples[(x, y)] = (light, u, v)
    return samples


def paint_body(
    grid: list[list[str]], samples: dict, style: str, ramp: str,
    muted: bool = False,
) -> None:
    for (x, y), (light, u, v) in samples.items():
        d = density(light, ramp, muted)
        char = shade(style, d, x, y)
        left = (x - 1, y) not in samples
        right = (x + 1, y) not in samples
        top = (x, y - 1) not in samples
        bottom = (x, y + 1) not in samples
        # Only repair disappearing edges. Do not box the density map in a line.
        if d < 0.28:
            if left:
                char = "/" if v < -0.28 else "\\" if v > 0.38 else "("
            elif right:
                char = "\\" if v < -0.28 else "/" if v > 0.38 else ")"
            elif top:
                char = "." if abs(u) > 0.30 else "_"
            elif bottom:
                char = "_"
        grid[y][x] = char


def ground_shadow(grid: list[list[str]], style: str, ramp: str, x0: int, x1: int, y: int) -> None:
    for x in range(max(0, x0), min(len(grid[0]), x1 + 1)):
        t = (x - x0) / max(1, x1 - x0)
        # A contact shadow travels toward the lower right.
        light = 0.26 + 0.39 * t
        d = density(light, ramp) * math.sin(math.pi * (0.12 + 0.76 * t))
        grid[y][x] = shade(style, d, x, y)
    if ramp == "light":
        # Sparse rim, not a luminous night shadow.
        grid[y][max(0, x0)] = "_"
        grid[y][min(len(grid[0]) - 1, x1)] = "."


def face_plan(stage: str, mood: str) -> dict[str, Any]:
    if stage == "sprout":
        ex1, ex2, ey, mx, my, mw = 5, 9, 3, 7, 4, 1
    elif stage == "truffle":
        ex1, ex2, ey, mx, my, mw = 5, 10, 3, 6, 4, 4
    else:
        ex1, ex2, ey, mx, my, mw = 7, 12, 5, 8, 6, 4
    if mood == "affectionate":
        ex1, ex2, mx = ex1 + 1, ex2 + 1, mx + 1
    if mood in ("asleep", "wilting"):
        ey += 1
        my += 1
    eye = {"content": "o", "affectionate": "^", "asleep": "-", "tired": "u", "wilting": ",", "yawn": "-"}[mood]
    if mw == 1:
        mouth = {"content": "u", "affectionate": "v", "asleep": ".", "tired": "-", "wilting": "~", "yawn": "O"}[mood]
    else:
        mouth = {"content": "\\__/", "affectionate": "\\__/", "asleep": " .. ", "tired": " -- ", "wilting": " ~~ ", "yawn": "(  )"}[mood]
    # Opaque spaces isolate the face from texture and weather.
    clear = [[ex1 - 1, ey, ex2 - ex1 + 3], [mx - 1, my, mw + 2]]
    if stage != "sprout":
        clear.insert(0, [ex1 + 1, ey - 1, ex2 - ex1 - 1])
    return {
        "eyes": [[ex1, ey], [ex2, ey]], "mouth": [mx, my, mw],
        "face_clear": clear, "face_marks": {"eyes": [eye, eye], "mouth": mouth},
    }


def apply_face(grid: list[list[str]], face: dict) -> None:
    for x, y, width in face["face_clear"]:
        put(grid, x, y, " " * width)
    for (x, y), mark in zip(face["eyes"], face["face_marks"]["eyes"]):
        put(grid, x, y, mark)
    if face["mouth"]:
        x, y, _ = face["mouth"]
        put(grid, x, y, face["face_marks"]["mouth"])


def sprout_leaves(grid: list[list[str]], mood: str, ramp: str) -> None:
    lean = int(mood == "affectionate")
    if mood == "wilting":
        put(grid, 8, 1, "|@)")
        put(grid, 8, 2, "|")
    elif mood == "asleep":
        put(grid, 4, 1, "(__\\/__)")
        put(grid, 7, 2, "|")
    elif mood == "tired":
        put(grid, 4, 0, "_,   ,_")
        put(grid, 5, 1, "\\_|_/")
    else:
        # Two little cupped leaves. The night shoot has a denser lit leaf.
        leaves = "(_\\ /_)" if ramp == "dark" else "(## /:)"
        put(grid, 4 + lean, 0, leaves)
        put(grid, 6 + lean, 1, "\\|/")


def elder_flower(grid: list[list[str]], mood: str) -> None:
    if mood in ("asleep", "wilting"):
        put(grid, 12, 1, "_*")
        put(grid, 11, 2, "/")
    elif mood == "tired":
        put(grid, 11, 0, "_*")
        put(grid, 10, 1, "/")
    else:
        x = 11 + int(mood == "affectionate")
        put(grid, x - 1, 0, "\\*/")
        put(grid, x, 1, "|")


def elder_cracks(grid: list[list[str]], ramp: str, mood: str) -> None:
    dy = int(mood in ("asleep", "wilting"))
    dx = int(mood == "affectionate")
    cuts = ((6, 2, "/"), (5, 3, "|"), (6, 4, "\\"), (16, 3, "\\"), (17, 4, "|"), (16, 7, "/"), (15, 8, "|"))
    for x, y, char in cuts:
        x += dx
        y = min(8, y + dy)
        # Night fissures remove ink. One slash at their lip keeps the branch clear.
        grid[y][x] = char if ramp == "dark" or (x + y) % 2 else " "


def make_spore(style: str, mood: str) -> dict:
    w, h = SIZES["spore"]
    shift = int(mood == "affectionate")
    lowered = int(mood in ("asleep", "wilting"))
    seed = [7 + shift, 3 + lowered]
    result = {
        "size": [w, h], "anchor": [7, 4], "eyes": [], "mouth": None,
        "face_clear": [], "face_mode": "seed-only", "seed": seed,
        "face_marks": {"eyes": [], "mouth": ""},
    }
    for ramp in PALETTES:
        grid = blank(w, h)
        samples = ellipsoid(w, 3, 7.4 + shift * 0.5, 1.6 + lowered * 0.12, 6.3, 1.4 - lowered * 0.10, bump=0.15)
        paint_body(grid, samples, style, ramp, muted=mood == "wilting")
        # Broken sand crust above a single seed. No adult face on a spore.
        put(grid, 4 + shift, 1, "/")
        put(grid, 9 + shift, 1, "\\")
        put(grid, 0, 2, "__")
        put(grid, 14, 2, "__")
        put(grid, 7 + shift, 2, "v" if mood in ("tired", "wilting") else "'")
        if mood == "yawn":
            # Breathing parts the crust. The seed still has only one dot.
            put(grid, 6, 2, "\\ /")
        put(grid, seed[0], seed[1], ".")
        if not lowered:
            put(grid, 5 + shift, 4, "_   _")
        result[ramp] = rows(grid)
    return result


def make_stage(style: str, stage: str, mood: str) -> dict:
    if stage == "spore":
        return make_spore(style, mood)
    w, h = SIZES[stage]
    cx = (w - 1) / 2
    if stage == "sprout":
        cy, rx, ry, bump, floor = 3.55, 6.4, 1.95, 0.40, 5
    elif stage == "truffle":
        cy, rx, ry, bump, floor = 3.04, 7.95, 3.50, 1.0, 6
    else:
        cy, rx, ry, bump, floor = 4.84, 9.90, 4.05, 1.1, 8
    shear = 0.0
    sag = 0.0
    if mood == "affectionate":
        cx += 0.40
        shear = 0.85
    elif mood == "asleep":
        ry *= 0.77 if stage != "sprout" else 0.73
        cy = floor - ry + 0.65
        rx += 0.20
    elif mood == "tired":
        ry *= 0.93
        cy += 0.15
        sag = 0.55
    elif mood == "wilting":
        ry *= 0.77 if stage != "sprout" else 0.73
        cy = floor - ry + 0.65
        cx += 0.25
        shear = -0.60
        sag = 1.0
    elif mood == "yawn":
        ry *= 1.035
        rx -= 0.15
    samples = ellipsoid(w, floor + 1, cx, cy, rx, ry, bump, shear, sag)
    face = face_plan(stage, mood)
    result = {"size": [w, h], "anchor": [w // 2, h - 1], "face_mode": "face", **face}
    for ramp in PALETTES:
        grid = blank(w, h)
        paint_body(grid, samples, style, ramp, muted=mood == "wilting")
        if stage != "sprout":
            ground_shadow(grid, style, ramp, w // 2 - 4, w - 1, h - 1)
        else:
            put(grid, 0, 5, "__")
            put(grid, 14, 5, "__")
        if stage == "sprout":
            sprout_leaves(grid, mood, ramp)
        elif stage == "elder":
            elder_cracks(grid, ramp, mood)
            elder_flower(grid, mood)
        elif mood == "wilting":
            put(grid, 12, 0, "_@)")
            put(grid, 11, 1, "/")
        apply_face(grid, face)
        result[ramp] = rows(grid)
    return result


def make_mound(style: str, peek: bool) -> dict:
    face = {
        "eyes": [[4, 2], [8, 2]] if peek else [], "mouth": None,
        "face_clear": [[3, 2, 7]] if peek else [],
        "face_marks": {"eyes": ["o", "o"] if peek else [], "mouth": ""},
    }
    result = {"size": [14, 4], "anchor": [7, 3], "face_mode": "peek" if peek else "none", **face}
    for ramp in PALETTES:
        grid = blank(14, 4)
        samples = ellipsoid(14, 3, 6.2, 1.1, 6.0, 1.65, bump=0.20)
        paint_body(grid, samples, style, ramp)
        put(grid, 5, 1, "/")
        put(grid, 7, 1, "\\")
        # A submerged shoulder, not a second full creature.
        put(grid, 3, 3, "\\")
        for x in range(4, 9):
            grid[3][x] = shade(style, density(0.65 - 0.09 * (x - 4), ramp), x, 3)
        put(grid, 9, 3, "/")
        put(grid, 0, 2, "_")
        put(grid, 13, 2, "_")
        if peek:
            apply_face(grid, face)
        result[ramp] = rows(grid)
    return result


def make_stone(style: str, flower: bool) -> dict:
    result = {
        "size": [11, 6], "anchor": [5, 5], "eyes": [], "mouth": None,
        "face_clear": [], "face_mode": "none", "face_marks": {"eyes": [], "mouth": ""},
        "inscription": [3, 2, 3],
    }
    for ramp in PALETTES:
        grid = blank(11, 6)
        put(grid, 3, 0, ".---.")
        for y in range(1, 5):
            for x in range(3, 7):
                lum = 0.82 - 0.04 * (x - 3) - 0.045 * y
                grid[y][x] = shade(style, density(lum, ramp), x, y)
            # The shallow left bevel catches the light. The right side does not.
            grid[y][2] = shade(style, density(0.96, ramp), 2, y)
            put(grid, 7, y, "/" if y == 1 else "|")
            grid[y][8] = shade(style, density(0.29, ramp), 8, y)
            if y > 1:
                grid[y][9] = shade(style, density(0.25, ramp), 9, y)
            if y == 1:
                put(grid, 2, y, "/")
            else:
                put(grid, 1, y, "|")
        put(grid, 3, 2, "RIP ")
        put(grid, 3, 4, "____")
        ground_shadow(grid, style, ramp, 2, 10, 5)
        put(grid, 1, 5, "/")
        if flower:
            put(grid, 0, 3, "*")
            put(grid, 0, 4, "|/")
            put(grid, 0, 5, "_")
        result[ramp] = rows(grid)
    return result


def make_style(style: str) -> dict:
    result = {}
    for stage in SIZES:
        for mood in MOODS:
            result[f"{stage}_{mood}"] = make_stage(style, stage, mood)
    result["mound"] = make_mound(style, False)
    result["mound_peek"] = make_mound(style, True)
    result["stone"] = make_stone(style, False)
    result["stone_flower"] = make_stone(style, True)
    return result


class Renderer:
    def __init__(self, font_path: Path):
        self.font_path = font_path
        self.font = ImageFont.truetype(str(font_path), 18 * SUPERSAMPLE)
        self.label_font = ImageFont.truetype(str(font_path), 13)
        self.heading_font = ImageFont.truetype(str(font_path), 17)
        self.tiles: dict[str, Image.Image] = {}

    def glyph(self, char: str) -> Image.Image:
        if char not in self.tiles:
            w, h = (n * SUPERSAMPLE for n in CELL)
            tile = Image.new("L", (w, h), 0)
            draw = ImageDraw.Draw(tile)
            advance = self.font.getlength(char)
            draw.text(((w - advance) / 2, 15 * SUPERSAMPLE), char, font=self.font, fill=255, anchor="ls")
            self.tiles[char] = tile.resize(CELL, Image.Resampling.LANCZOS)
        return self.tiles[char]

    def coverage(self, char: str) -> float:
        return sum(self.glyph(char).getdata()) / (CELL[0] * CELL[1] * 255)

    def sprite(self, sprite_rows: list[str], ramp: str, pad: int = 2) -> Image.Image:
        palette = PALETTES[ramp]
        w, h = len(sprite_rows[0]), len(sprite_rows)
        image = Image.new("RGB", ((w + pad * 2) * CELL[0], (h + pad * 2) * CELL[1]), palette["background"])
        for y, line in enumerate(sprite_rows):
            for x, char in enumerate(line):
                if char != " ":
                    image.paste(palette["ink"], ((x + pad) * CELL[0], (y + pad) * CELL[1]), self.glyph(char))
        return image

    def sheet(self, all_styles: dict, names: list[str], title: str) -> Image.Image:
        col_w = 276
        row_heights = [max(all_styles[s][name]["size"][1] for s in STYLES) * CELL[1] + 60 for name in names]
        image = Image.new("RGB", (col_w * 6, 92 + sum(row_heights)), "#f4efe3")
        draw = ImageDraw.Draw(image)
        draw.text((16, 11), title, font=self.heading_font, fill="#34382e")
        draw.text((16, 36), f"11 x 20 px cells | upper-left light | single ink | {self.font.getname()[0]}", font=self.label_font, fill="#52584b")
        for c, (style, ramp) in enumerate((s, r) for s in STYLES for r in PALETTES):
            draw.text((c * col_w + 12, 65), f"{style} / {PALETTES[ramp]['name']}", font=self.label_font, fill="#34382e")
            y0 = 92
            for name, rh in zip(names, row_heights):
                palette = PALETTES[ramp]
                x0 = c * col_w
                draw.rectangle((x0 + 3, y0 + 2, x0 + col_w - 4, y0 + rh - 3), fill=palette["background"])
                draw.text((x0 + 12, y0 + 8), name, font=self.label_font, fill=palette["ink"])
                sprite = self.sprite(all_styles[style][name][ramp], ramp, pad=0)
                image.paste(sprite, (x0 + (col_w - sprite.width) // 2, y0 + 33))
                y0 += rh
        return image

    def mood_sheet(self, assets: dict, style: str) -> Image.Image:
        col_w = 264
        row_heights = [SIZES[stage][1] * CELL[1] + 52 for stage in SIZES] * 2 + [176, 176]
        image = Image.new("RGB", (col_w * 6, 68 + sum(row_heights)), "#f4efe3")
        draw = ImageDraw.Draw(image)
        draw.text((14, 12), f"{style}: all moods, then burrow and grave", font=self.heading_font, fill="#34382e")
        draw.text((14, 38), "Day above night. Face spacing is deliberately quiet.", font=self.label_font, fill="#52584b")
        y0 = 68
        for ramp in PALETTES:
            for stage in SIZES:
                rh = SIZES[stage][1] * CELL[1] + 52
                for c, mood in enumerate(MOODS):
                    palette = PALETTES[ramp]
                    x0 = c * col_w
                    draw.rectangle((x0 + 2, y0 + 2, x0 + col_w - 3, y0 + rh - 3), fill=palette["background"])
                    draw.text((x0 + 9, y0 + 7), f"{stage}: {mood}", font=self.label_font, fill=palette["ink"])
                    sprite = self.sprite(assets[f"{stage}_{mood}"][ramp], ramp, pad=0)
                    image.paste(sprite, (x0 + (col_w - sprite.width) // 2, y0 + 30))
                y0 += rh
        for ramp in PALETTES:
            for c, name in enumerate(("mound", "mound_peek", "stone", "stone_flower")):
                x0 = c * col_w
                palette = PALETTES[ramp]
                draw.rectangle((x0 + 2, y0 + 2, x0 + col_w - 3, y0 + 173), fill=palette["background"])
                draw.text((x0 + 9, y0 + 7), f"{name} / {ramp}", font=self.label_font, fill=palette["ink"])
                sprite = self.sprite(assets[name][ramp], ramp, pad=0)
                image.paste(sprite, (x0 + (col_w - sprite.width) // 2, y0 + 34))
            y0 += 176
        return image

    def world(self, assets: dict, ramp: str) -> Image.Image:
        grid = blank(40, 28)
        put(grid, 2, 1, "TRUFFLE / a walk leaves a little light")
        put(grid, 4, 4, "\\ | /" if ramp == "dark" else " .-. ")
        put(grid, 4, 5, "- O -" if ramp == "dark" else "(  . ")
        put(grid, 4, 6, "/ | \\" if ramp == "dark" else " `-. ")
        put(grid, 23, 4, "  .---. ")
        put(grid, 23, 5, " (_____) ")
        if ramp == "light":
            for x, y in ((18, 3), (31, 2), (35, 7), (13, 8), (3, 9)):
                put(grid, x, y, ".")
        put(grid, 0, 14, "_" * 40)
        for y in range(16, 26):
            for x in range(40):
                if (13 * x + 7 * y) % 47 == 0:
                    grid[y][x] = "."
        put(grid, 2, 21, "\\|/")
        put(grid, 34, 24, "\\|/")
        asset = assets["truffle_content"]
        for dy, line in enumerate(asset[ramp]):
            put(grid, 11, 17 + dy, line)
        put(grid, 0, 26, "_" * 40)
        put(grid, 1, 27, "E [######....]   Truffle   6120 steps")
        return self.sprite(rows(grid), ramp, pad=0)


def validate(all_styles: dict, renderer: Renderer) -> dict:
    count = 0
    lighting = {}
    bevels = {}
    for style, assets in all_styles.items():
        assert len(assets) == 28
        for name, asset in assets.items():
            w, h = asset["size"]
            stage = name.split("_")[0]
            expected = SIZES.get(stage, (14, 4) if name.startswith("mound") else (11, 6))
            assert (w, h) == expected, name
            ax, ay = asset["anchor"]
            assert 0 <= ax < w and ay == h - 1, (name, "anchor")
            assert len(asset["eyes"]) == len(asset["face_marks"]["eyes"])
            face_cells = {}
            for (x, y), mark in zip(asset["eyes"], asset["face_marks"]["eyes"]):
                face_cells[(x, y)] = mark
            if asset["mouth"]:
                mx, my, mw = asset["mouth"]
                assert len(asset["face_marks"]["mouth"]) == mw
                face_cells.update({(mx + dx, my): ch for dx, ch in enumerate(asset["face_marks"]["mouth"])})
            for ramp in PALETTES:
                art = asset[ramp]
                assert len(art) == h, (style, name, ramp)
                assert all(len(line) == w for line in art), (style, name, ramp, "padding")
                assert all(set(line) <= ALLOWED for line in art), (style, name, "glyphs")
                if style != "blocks":
                    assert all(line.isascii() for line in art)
                for (x, y), mark in face_cells.items():
                    assert 0 <= x < w and 0 <= y < h
                    assert art[y][x] == mark, (name, "face")
                for x, y, width in asset["face_clear"]:
                    assert 0 <= x and x + width <= w and 0 <= y < h
                    for xx in range(x, x + width):
                        assert art[y][xx] == face_cells.get((xx, y), " "), (name, "face noise")
                if "seed" in asset:
                    x, y = asset["seed"]
                    assert art[y][x] == "."
                    assert "".join(art[3:]).count(".") == 1, (name, "seed count")
                count += 1
            assert asset["dark"] != asset["light"], (style, name, "polarity")
        for stage in SIZES:
            for ramp in PALETTES:
                variants = {tuple(assets[f"{stage}_{mood}"][ramp]) for mood in MOODS}
                assert len(variants) == 6, (style, stage, ramp, "duplicate mood")
        # Measure actual output glyphs on the two shoulders of content Truffle.
        # Ignore the face patch, cast shadow, and outer contour cells.
        sample_map = ellipsoid(18, 7, 8.5, 3.04, 7.95, 3.5)
        points = {"lit": [], "shadow": []}
        face_spans = assets["truffle_content"]["face_clear"]
        for (x, y), (lum, u, v) in sample_map.items():
            if any(fy == y and fx <= x < fx + fw for fx, fy, fw in face_spans):
                continue
            if any((x + dx, y + dy) not in sample_map for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1))):
                continue
            if u < -0.20 and v < -0.10 and lum > 0.75:
                points["lit"].append((x, y))
            if u > 0.35 and v > 0.10 and lum < 0.55:
                points["shadow"].append((x, y))
        assert all(points.values())
        lighting[style] = {}
        bevels[style] = {}
        for ramp in PALETTES:
            art = assets["truffle_content"][ramp]
            coverage = {side: sum(renderer.coverage(art[y][x]) for x, y in coords) / len(coords) for side, coords in points.items()}
            good = coverage["lit"] < coverage["shadow"] if ramp == "dark" else coverage["lit"] > coverage["shadow"]
            assert good, (style, ramp, coverage)
            lighting[style][ramp] = {key: round(value, 5) for key, value in coverage.items()}
            stone = assets["stone"][ramp]
            left = sum(renderer.coverage(stone[y][2]) for y in (2, 3, 4)) / 3
            right = sum(renderer.coverage(stone[y][x]) for y in (2, 3, 4) for x in (8, 9)) / 6
            assert (left < right if ramp == "dark" else left > right), (style, "stone bevel", ramp)
            bevels[style][ramp] = {"lit_edge": round(left, 5), "shadow_side": round(right, 5)}
    advances = {char: round(renderer.font.getlength(char) / SUPERSAMPLE, 5) for char in sorted(ALLOWED)}
    # Font fallback must not silently change a cell's advance.
    assert max(advances.values()) - min(advances.values()) < 0.02, "Font is not uniformly monospace"
    return {
        "status": "PASS", "style_count": len(all_styles), "assets_per_style": 28,
        "rendered_sprite_count": count, "cell_px": list(CELL), "cell_aspect": ASPECT,
        "font": str(renderer.font_path), "font_family": renderer.font.getname(),
        "font_px": 18, "line_height_px": 20, "supersampling": SUPERSAMPLE,
        "pillow_version": PIL.__version__, "ambient": 0.25, "light_vector": LIGHT,
        "checks": ["exact stage and prop sizes", "padded rows", "allowed glyphs only", "ASCII-only classic and hatching", "face bounds and marks", "quiet face cells have no texture", "exactly one underground seed dot", "bottom anchors", "six distinct moods per stage and ramp", "different polarity maps", "output glyph density follows upper-left light", "stone bevel and side reverse density", "uniform font advances"],
        "ink_coverage_lighting_check": lighting,
        "lighting_sample_cells": points,
        "stone_bevel_check": bevels,
        "glyph_ink_coverage": {ch: round(renderer.coverage(ch), 5) for ch in CLASSIC_RAMP + "░▒▓█/\\|xo"},
        "glyph_advances_px": advances,
        "errors": [],
        "limits": ["Local Pillow proof, not an Android screenshot.", "Noto rasterization and block coverage can differ on a phone.", "Spore moods intentionally have no adult face."],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--font", type=Path, help="Existing local monospace font. No network access.")
    args = parser.parse_args()
    font_path = args.font or next((Path(p) for p in FONT_CANDIDATES if Path(p).exists()), None)
    if font_path is None or not font_path.is_file():
        parser.error("No local monospace font found. Pass --font /absolute/path/to/font.ttf.")
    renderer = Renderer(font_path)
    all_styles = {style: make_style(style) for style in STYLES}
    report = validate(all_styles, renderer)
    bundle = {
        "_meta": {
            "version": 1, "recommended_style": RECOMMENDED,
            "style_names": list(STYLES), "coordinates": "zero-based [x,y], relative to the sprite rectangle",
            "mouth_format": "[x,y,width]; null if there is no mouth",
            "grid": [40, 28], "cell_aspect": ASPECT,
            "ramp_keys": {"dark": "dark-ink on sand", "light": "light-ink on night blue"},
            "palettes": PALETTES, "font": str(font_path),
            "classic_ramp": CLASSIC_RAMP, "block_ramp": BLOCK_RAMP,
            "light": "upper left, Lambert + 0.25 ambient, broad warty relief",
            "compositing": "Stamp the full padded rectangle, including spaces. Do not trim rows.",
            "faces": "Full faces are baked in. To replace one, blank each face_clear span, then stamp eyes and mouth. Match posture before choosing coordinates.",
            "spore": "One seed dot under a cracked sand crust. eyes=[] and mouth=null are deliberate. Do not give it an adult face.",
            "no_face": "mound and stones have eyes=[] and mouth=null; mound_peek has only eyes.",
            "wilting": "Ink density is reduced to 65 percent. Use one ink color, not gray glyph colors.",
            "ground": "Place the last row at world row 24. Center the full sprite width in the 40-column world.",
            "alternatives": "Top-level assets are classic. styles contains complete alternative dictionaries.",
        },
        **all_styles[RECOMMENDED],
        "styles": {style: assets for style, assets in all_styles.items() if style != RECOMMENDED},
    }
    json_output(ROOT / "sprites.json", bundle)
    assert json.loads((ROOT / "sprites.json").read_text()) == bundle, "JSON round trip"
    expected_sizes = {}
    for style, assets in all_styles.items():
        for name, asset in assets.items():
            for ramp, palette in PALETTES.items():
                path = PREVIEW / f"{style}_{name}_{palette['name']}.png"
                expected_sizes[path.name] = ((asset["size"][0] + 4) * CELL[0], (asset["size"][1] + 4) * CELL[1])
                png_output(path, renderer.sprite(asset[ramp], ramp))
        png_output(PREVIEW / f"moods_{style}.png", renderer.mood_sheet(assets, style))
        for ramp, palette in PALETTES.items():
            world = renderer.world(assets, ramp)
            assert world.size == (40 * CELL[0], 28 * CELL[1])
            png_output(PREVIEW / f"world_{style}_{palette['name']}.png", world)
            png_output(PREVIEW / f"phone390_{style}_{palette['name']}.png", world.resize((390, round(world.height * 390 / world.width)), Image.Resampling.LANCZOS))
    names = list(all_styles[RECOMMENDED])
    png_output(PREVIEW / "contact_sheet.png", renderer.sheet(all_styles, names, "Truffle A01: every asset, all three styles and both ink directions"))
    comparison = [f"{stage}_content" for stage in SIZES] + ["mound_peek", "stone_flower"]
    png_output(PREVIEW / "style_comparison.png", renderer.sheet(all_styles, comparison, "Truffle A01: choose a surface treatment"))
    # A font swatch is useful when assessing real device fallbacks.
    swatch = [" .:-=+*#%@ /\\|xo       ", "  ░░ ▒▒ ▓▓ ██ ── ││   ", "  o    o     -    -    ", "   \\__/       (  )    "]
    swatch = [line.ljust(24) for line in swatch]
    for ramp, palette in PALETTES.items():
        png_output(PREVIEW / f"font_swatch_{palette['name']}.png", renderer.sprite(swatch, ramp))
    files = sorted(PREVIEW.glob("*.png"))
    expected_previews = 168 + 3 + 12 + 2 + 2
    assert len(files) == expected_previews, (len(files), expected_previews)
    for path in files:
        with Image.open(path) as image:
            if path.name in expected_sizes:
                assert image.size == expected_sizes[path.name], (path.name, "PNG size")
            image.verify()
    report["checks"].extend(["JSON round trip", "168 sprite PNG dimensions match exact cells", "40 x 28 world image dimensions"])
    report["preview_png_count"] = len(files)
    report["png_decode_check"] = "PASS"
    report["sprites_sha256"] = hashlib.sha256((ROOT / "sprites.json").read_bytes()).hexdigest()
    report["png_sha256"] = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
    json_output(ROOT / "verification.json", report)
    print(f"PASS: {len(all_styles)} styles, 84 assets, {report['rendered_sprite_count']} polarity variants.")
    print(f"PASS: {len(files)} PNGs decoded, 11 x 20 px cells, {renderer.font.getname()[0]}.")
    print(f"Assets: {ROOT / 'sprites.json'}")
    print(f"Compare: {PREVIEW / 'style_comparison.png'}")
    print(f"All: {PREVIEW / 'contact_sheet.png'}")


if __name__ == "__main__":
    main()
