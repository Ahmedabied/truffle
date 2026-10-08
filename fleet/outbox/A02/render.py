#!/usr/bin/env python3
"""Generate shaded ASCII candidates and local-font PNG previews. No network use."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
import subprocess
import sys

sys.dont_write_bytecode = True

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
PREVIEW = ROOT / "preview"
CELL_W, CELL_H = 11, 20
ASPECT = CELL_W / CELL_H
RAMP = " .:-=+*#%@"
SAMPLES = 16
SCALE = 3
PHASES = {
    "new": math.pi,
    "waxing_crescent": 3 * math.pi / 4,
    "first_quarter": math.pi / 2,
    "waxing_gibbous": math.pi / 4,
    "full": 0,
    "waning_gibbous": -math.pi / 4,
    "last_quarter": -math.pi / 2,
    "waning_crescent": -3 * math.pi / 4,
}
PALETTES = {
    "dark": {
        "sky": ("#afd3e8", "#fff0d5"),
        "cloud": "#566f80", "sun": "#ad701e", "moon": "#586f80",
        "dunes_far": "#99775b", "dunes_near": "#81603f", "hills": "#466b55",
        "sand_field": "#9c805b", "grass_field": "#577848", "precip": "#527d99",
        "sand_bg": ("#f1dfb8", "#dbc294"), "grass_bg": ("#d5ddbb", "#b2c59b"),
        "pet": "#333f35",
    },
    "light": {
        "sky": ("#0a162b", "#2d465f"),
        "cloud": "#90aec7", "sun": "#f2d09a", "moon": "#f7e9c7",
        "dunes_far": "#7791aa", "dunes_near": "#a1b2bc", "hills": "#8ead9c",
        "sand_field": "#849dae", "grass_field": "#82a38e", "precip": "#a1c0d3",
        "sand_bg": ("#26394a", "#172a3b"), "grass_bg": ("#263f3c", "#172d2b"),
        "pet": "#e9ead8",
    },
}
PAPER = "#f2eee5"
LABEL = "#344653"
MUTED = "#64727b"
SHEET_W = 1056
MARGIN = 20
GAP = 16


def rgb(hex_color):
    return tuple(int(hex_color[i:i + 2], 16) for i in (1, 3, 5))


def normalized(vector):
    value = np.asarray(vector, dtype=float)
    return value / np.linalg.norm(value)


def sampled(width, height, surface):
    """Integrate coverage and surface brightness over rectangular character cells."""
    yy, xx = np.mgrid[0:height * SAMPLES, 0:width * SAMPLES]
    x = (xx + 0.5) / SAMPLES
    y = (yy + 0.5) / SAMPLES
    mask, luminance = surface(x, y)
    shape = (height, SAMPLES, width, SAMPLES)
    coverage = mask.astype(float).reshape(shape).mean(axis=(1, 3))
    energy = np.where(mask, luminance, 0).reshape(shape).mean(axis=(1, 3))
    tone = np.divide(energy, coverage, out=np.zeros_like(energy), where=coverage > 0)
    return coverage, np.clip(tone, 0, 1)


def quantize(coverage, tone, threshold=0.22, edge_power=0.45, ramp=RAMP, light_floor=1):
    """Invert brightness inside the silhouette. Outside cells stay transparent."""
    result = {}
    for direction in ("dark", "light"):
        density = (1 - tone) if direction == "dark" else tone
        density = density * np.power(coverage, edge_power)
        floor = light_floor if direction == "light" else 1
        index = np.clip(np.rint(density * (len(ramp) - 1)).astype(int), floor, len(ramp) - 1)
        result[direction] = [
            "".join(ramp[index[y, x]] if coverage[y, x] >= threshold else " "
                    for x in range(coverage.shape[1]))
            for y in range(coverage.shape[0])
        ]
    return result


def cloud(width, height, blobs, storm=False):
    light = normalized((-0.32, -0.86, 0.65))

    def surface(x, y):
        z_front = np.full_like(x, -1.0)
        nx, ny, nz = np.zeros_like(x), np.zeros_like(x), np.ones_like(x)
        for cx, cy, rx, ry, depth in blobs:
            q = 1 - ((x - cx) / rx) ** 2 - ((y - cy) / ry) ** 2
            inside = q > 0
            z = depth * np.sqrt(np.maximum(q, 0))
            visible = inside & (z > z_front)
            nx = np.where(visible, (x - cx) * ASPECT / (rx * ASPECT) ** 2, nx)
            ny = np.where(visible, (y - cy) / ry ** 2, ny)
            nz = np.where(visible, z / depth ** 2, nz)
            z_front = np.where(visible, z, z_front)
        normal_size = np.maximum(np.sqrt(nx * nx + ny * ny + nz * nz), 0.001)
        lambert = np.maximum(0, (nx * light[0] + ny * light[1] + nz * light[2]) / normal_size)
        # Broad upper scattering keeps the puffs soft. The base is occluded.
        base_shadow = np.clip((y / height - 0.48) / 0.52, 0, 1)
        tone = 0.28 + 0.69 * lambert + 0.08 * (1 - y / height) - 0.12 * base_shadow
        if storm:
            tone -= 0.16 * np.clip((y / height - 0.30) / 0.70, 0, 1)
        return z_front >= 0, np.clip(tone, 0.05, 0.98)

    result = quantize(*sampled(width, height, surface), threshold=0.38)
    if height == 1:
        # One row cannot carry a vertical gradient. Keep a fine tapered stroke.
        result = {"dark": [" .:---:. "], "light": [" .-++=-. "]}
    return result


def make_clouds():
    specs = [
        ("small", 7, 2, [
            (2.5, 0.86, 1.8, 0.83, 0.95), (4.55, 1.07, 2.13, 0.83, 1.00),
            (1.35, 1.24, 1.27, 0.63, 0.75),
        ]),
        ("medium", 11, 3, [
            (4.2, 1.22, 2.5, 1.18, 1.35), (7.05, 1.66, 2.48, 1.17, 1.3),
            (2.05, 2.05, 1.95, 0.86, 0.95), (9.25, 2.20, 1.59, 0.67, 0.9),
            (5.10, 2.20, 3.5, 0.69, 1.0),
        ]),
        ("large", 15, 4, [
            (5.8, 1.55, 2.65, 1.5, 1.7), (9.13, 2.05, 3.03, 1.63, 1.6),
            (3.05, 2.6, 2.82, 1.25, 1.4), (12.38, 2.91, 2.36, 0.95, 1.0),
            (7.8, 3.1, 5.1, 0.78, 1.15),
        ]),
        ("stratus", 20, 2, [
            (5.8, 0.99, 5.25, 0.82, 0.7), (11.08, 0.87, 4.6, 0.78, 0.8),
            (15.00, 1.21, 4.84, 0.65, 0.65), (2.83, 1.31, 2.7, 0.5, 0.6),
        ]),
        ("storm", 13, 5, [
            (6.1, 1.52, 2.8, 1.47, 1.9), (4.63, 2.83, 3.32, 1.90, 1.8),
            (8.36, 2.98, 2.95, 1.72, 1.9), (2.42, 4.05, 2.20, 0.82, 1.15),
            (10.72, 4.03, 2.04, 0.87, 1.1), (6.58, 4.06, 4.13, 0.85, 1.5),
        ]),
        ("wisp", 9, 1, [
            (4.00, 0.43, 3.97, 0.33, 0.3), (6.75, 0.60, 2.16, 0.23, 0.25),
        ]),
    ]
    return [{"name": name, **cloud(w, h, blobs, storm=name == "storm")}
            for name, w, h, blobs in specs]


def sun_disk():
    def surface(x, y):
        q = 1 - ((x - 3.5) / 2.65) ** 2 - ((y - 1.5) / 1.52) ** 2
        # Emissive disk, not a rock sphere. Exaggerate limb darkening at 7 x 3.
        tone = 0.25 + 0.74 * np.sqrt(np.maximum(q, 0))
        return q >= 0, tone
    result = quantize(*sampled(7, 3, surface), threshold=0.17)
    for mode in ("dark", "light"):
        row = list(result[mode][1])
        row[0] = row[6] = "-"
        result[mode][1] = "".join(row)
    return result


def horizon_sun():
    def surface(x, y):
        q = 1 - ((x - 6.5) / 6.43) ** 2 - ((y - 2.80) / 2.77) ** 2
        tone = 0.76 + 0.20 * np.sqrt(np.maximum(q, 0)) - 0.23 * (y / 3) ** 2
        return q >= 0, tone
    result = quantize(*sampled(13, 3, surface))
    # This is a clipped half disk. This row is the horizon, not another sun row.
    for mode in ("dark", "light"):
        result[mode][2] = "─" * 13
    return result


def moon(phase):
    angle = PHASES[phase]
    light = normalized((math.sin(angle), 0, math.cos(angle)))

    def surface(x, y):
        nx, ny = (x - 3.5) / 3.5, (y - 2) / 2
        q = 1 - nx * nx - ny * ny
        nz = np.sqrt(np.maximum(q, 0))
        lambert = np.maximum(0, nx * light[0] + ny * light[1] + nz * light[2])
        return q >= 0, lambert

    coverage, energy = sampled(7, 4, surface)
    # Apply photographic exposure after cell integration. This rescues the tiny
    # polar tips without moving the actual curved geometric terminator.
    tone = 0.96 * np.maximum(energy, 0) ** 0.40
    result = quantize(coverage, tone, threshold=0.22, edge_power=0.25, light_floor=0)
    if phase == "new":
        # A restrained earthshine cue. Do not draw a dotted full disk at night.
        result["light"] = ["       ", "  ...  ", "  ...  ", "       "]
    if phase in ("full", "waxing_gibbous", "waning_gibbous"):
        craters = [(2, 1), (4, 2)] if phase == "full" else (
            [(4, 1), (3, 2)] if phase == "waxing_gibbous" else [(2, 1), (3, 2)])
        for mode in ("dark", "light"):
            rows = [list(row) for row in result[mode]]
            for x, y in craters:
                # Dark dots on day faces, tiny missing-ink pits on night faces.
                rows[y][x] = ":" if mode == "dark" else "."
            result[mode] = ["".join(row) for row in rows]
    return result


def profile(x, points):
    """A smooth asymmetric ridge. Return height and the analytic local slope."""
    position = np.array([p[0] for p in points], dtype=float)
    height = np.array([p[1] for p in points], dtype=float)
    index = np.clip(np.searchsorted(position, x, side="right") - 1, 0, len(points) - 2)
    span = position[index + 1] - position[index]
    t = np.clip((x - position[index]) / span, 0, 1)
    smooth = t * t * (3 - 2 * t)
    delta = height[index + 1] - height[index]
    return height[index] + delta * smooth, delta * 6 * t * (1 - t) / span


def dune(width, height, near=False):
    points = ([(0, 2.87), (4, 2.1), (12, 0.18), (17, 2.20), (20, 2.84)] if near else
              [(0, 2.58), (5, 1.87), (11, 0.24), (17, 2.62),
               (22, 2.01), (29, 0.75), (34, 2.28), (40, 2.55)])

    def surface(x, y):
        top, slope = profile(x, points)
        depth = np.clip((y - top) / np.maximum(height - top, 0.1), 0, 1)
        facing_left = -slope / ASPECT
        tone = 0.56 + 0.41 * np.tanh(facing_left * 1.55) - 0.12 * depth
        # A narrow crest catches the light. A right-facing slip face stays dark.
        tone += 0.08 * np.exp(-depth * 6) * (slope < 0)
        if not near:
            # A low second ridge breaks the repeated vertical strips at the base.
            front, front_slope = profile(x, [(0, 3.85), (8, 3.70), (20, 2.75), (27, 3.75), (40, 3.87)])
            tone = np.where(y > front, 0.57 - 0.26 * np.tanh(front_slope / ASPECT * 2), tone)
        return y >= top, np.clip(tone, 0.10, 0.96)

    return quantize(*sampled(width, height, surface), threshold=0.24)


def hills():
    def surface(x, y):
        top, slope = profile(x, [(0, 2.03), (10, 1.04), (19, 2.15), (27, 1.32), (40, 2.07)])
        tone = 0.56 - 0.36 * np.tanh(slope / ASPECT * 2.2) - 0.1 * (y - top)
        return y >= top, np.clip(tone, 0.17, 0.9)
    result = quantize(*sampled(40, 3, surface), threshold=0.20)
    for mode in ("dark", "light"):
        grid = [list(row) for row in result[mode]]
        canopy = ".+#" if mode == "dark" else "#+."
        base = ":*#@#" if mode == "dark" else "#@#*:"
        for x in (4, 30):
            grid[0][x] = "^"
            grid[1][x - 1:x + 2] = list(canopy)
            grid[2][x - 2:x + 3] = list(base)
        grid[1][36] = "^"
        grid[2][35:38] = list(canopy)
        grid[1][22:24] = list(".:" if mode == "dark" else ":.")
        grid[2][21:25] = list(":+#*" if mode == "dark" else "*#+:")
        result[mode] = ["".join(row) for row in grid]
    return result


def field_from_motifs(motifs):
    result = {}
    for mode in ("dark", "light"):
        grid = [[" "] * 40 for _ in range(9)]
        for y, x, shadow, highlight in motifs:
            text = shadow if mode == "dark" else highlight
            assert len(shadow) == len(highlight)
            assert all(ch == " " for ch in grid[y][x:x + len(text)])
            grid[y][x:x + len(text)] = list(text)
        result[mode] = ["".join(row) for row in grid]
    return result


def sand_field():
    # Every mark is placed. No random bright speckles enter the pet's clear zone.
    return field_from_motifs([
        (0, 30, ".", "."),
        (1, 8, ".", "."), (1, 35, ".", "."),
        (2, 4, ".", "."), (2, 28, ".:", ":."),
        (3, 9, ".-", "-."), (3, 36, ".", "."),
        (4, 2, ".", "."), (4, 30, ".:-", "-:."),
        (5, 7, ".:-", "-:."), (5, 33, ".", "."), (5, 38, ".", "."),
        (6, 1, ".:-", "-:."), (6, 29, ".-", "-."), (6, 36, ".", "."),
        (7, 5, ".:--", "--:."), (7, 31, ".:-", "-:."), (7, 39, ".", "."),
        (8, 1, ".:-", "-:."), (8, 11, ".", "."), (8, 23, ".:-", "-:."),
        (8, 36, ".:", ":."),
    ])


def grass_field():
    return field_from_motifs([
        (0, 7, ",", ","),
        (1, 3, "'", "'"), (1, 32, ",", ","),
        (2, 9, ",", ","), (2, 28, "'", "'"), (2, 38, ",", ","),
        (3, 5, "v", "v"), (3, 33, ".:", ":."),
        (4, 1, "'", "'"), (4, 10, ",'", ",'"), (4, 36, "v", "v"),
        (5, 4, "\\/", "\\/"), (5, 30, ":+", "+:"), (5, 39, ",", ","),
        (6, 0, "v", "v"), (6, 9, ",'", ",'"), (6, 34, "\\|/", "\\|/"),
        (7, 4, "\\|/", "\\|/"), (7, 29, ",'", ",'"), (7, 37, ".:+", "+:."),
        (8, 0, ",'", ",'"), (8, 10, "v", "v"), (8, 23, ",'", ",'"),
        (8, 30, "\\|/", "\\|/"), (8, 39, ",", ","),
    ])


def vocabulary():
    def row(marks):
        line = [" "] * 40
        for x, text in marks:
            line[x:x + len(text)] = list(text)
        assert len(line) == 40
        return "".join(line)
    return {
        "rain_light": row([(7, "'"), (31, "'")]),
        "rain_medium": row([(3, "|"), (12, "'"), (20, "|"), (29, "|"), (37, "'")]),
        "rain_heavy": row([(1, "|"), (6, "/"), (10, "|"), (15, "|"), (19, "/"),
                            (23, "|"), (28, "|"), (33, "/"), (38, "|")]),
        "snow_light": row([(9, "."), (29, ".")]),
        "snow_medium": row([(4, "."), (15, "*"), (27, "."), (36, ".")]),
        "snow_heavy": row([(2, "."), (8, "*"), (14, "."), (21, "+"), (27, "."), (33, "*"), (39, ".")]),
        "heat_1": row([(5, "~"), (24, "~")]),
        "heat_2": row([(11, "~-"), (32, "~")]),
        "heat_3": row([(3, "-~"), (22, "~-"), (37, "~")]),
    }


def make_assets():
    return {
        "clouds": make_clouds(),
        "sun": sun_disk(),
        "sun_horizon": horizon_sun(),
        "moon": {name: moon(name) for name in PHASES},
        "dunes_far": dune(40, 4),
        "dunes_near": dune(20, 3, near=True),
        "hills": hills(),
        "sand_field": sand_field(),
        "grass_field": grass_field(),
        # Thin particles are neutral marks, not surfaces. Both ink directions use
        # these same rows. Changing ink colour is sufficient. Keep the flat API.
        "precip": vocabulary(),
    }


def entries(assets):
    for item in assets["clouds"]:
        yield "cloud_" + item["name"], item, "cloud"
    for name in ("sun", "sun_horizon"):
        yield name, assets[name], "sun"
    for name, item in assets["moon"].items():
        yield "moon_" + name, item, "moon"
    for name in ("dunes_far", "dunes_near", "hills", "sand_field", "grass_field"):
        yield name, assets[name], name
    for name, row in assets["precip"].items():
        yield name, {"dark": [row], "light": [row]}, "precip"


def validate(assets):
    expected = {"cloud_small": (7, 2), "cloud_medium": (11, 3), "cloud_large": (15, 4),
                "cloud_stratus": (20, 2), "cloud_storm": (13, 5), "cloud_wisp": (9, 1),
                "sun": (7, 3), "sun_horizon": (13, 3), "dunes_far": (40, 4),
                "dunes_near": (20, 3), "hills": (40, 3),
                "sand_field": (40, 9), "grass_field": (40, 9)}
    expected.update({"moon_" + name: (7, 4) for name in PHASES})
    expected.update({name: (40, 1) for name in vocabulary()})
    report = {}
    for name, item, _ in entries(assets):
        width, height = expected[name]
        stats = {}
        for mode in ("dark", "light"):
            rows = item[mode]
            assert len(rows) == height, (name, mode, "height")
            assert all(len(row) == width for row in rows), (name, mode, "width")
            assert all(ch == "─" or 32 <= ord(ch) <= 126 for row in rows for ch in row), name
            occupied = [sum(ch != " " for ch in row) for row in rows]
            stats[mode] = {"occupied_per_row": occupied,
                           "occupancy_pct": round(100 * sum(occupied) / (width * height), 2)}
        dark_mask = [[ch != " " for ch in row] for row in item["dark"]]
        light_mask = [[ch != " " for ch in row] for row in item["light"]]
        if name.startswith("moon_"):
            assert all(not lit or body for dark_row, light_row in zip(dark_mask, light_mask)
                       for body, lit in zip(dark_row, light_row)), (name, "light outside lunar body")
        else:
            assert dark_mask == light_mask, (name, "silhouette changed on inversion")
        report[name] = {"width": width, "height": height, **stats}
    assert len(report) == 30
    for name in ("sand_field", "grass_field"):
        for mode in ("dark", "light"):
            occupied = report[name][mode]["occupied_per_row"]
            assert occupied == sorted(occupied), (name, "perspective")
            assert report[name][mode]["occupancy_pct"] < 13
            assert all(row[14:26] == " " * 12 for row in assets[name][mode][2:8])
    for item in assets["clouds"]:
        if item["name"] == "wisp":
            continue
        for mode in ("dark", "light"):
            def mean_ink(row):
                return np.mean([RAMP.index(ch) for ch in row if ch != " "])
            top, bottom = mean_ink(item[mode][0]), mean_ink(item[mode][-1])
            assert (bottom > top) if mode == "dark" else (top > bottom), (item["name"], mode)
    for mode in ("dark", "light"):
        assert assets["sun_horizon"][mode][-1] == "─" * 13
        assert len({tuple(item[mode]) for item in assets["moon"].values()}) == 8
        for waxing, waning in (("waxing_crescent", "waning_crescent"),
                               ("first_quarter", "last_quarter"),
                               ("waxing_gibbous", "waning_gibbous")):
            assert [row[::-1] for row in assets["moon"][waxing][mode]] == assets["moon"][waning][mode]
        for name, left, right in (("dunes_far", 8, 14), ("dunes_near", 8, 15)):
            row = assets[name][mode][2]
            lit, shaded = RAMP.index(row[left]), RAMP.index(row[right])
            assert (lit < shaded) if mode == "dark" else (lit > shaded), (name, mode, "left light")
    return report


def existing_read(path):
    # Regeneration reads an existing generated destination before replacing it.
    if path.exists():
        path.read_bytes()


def save_text(path, text):
    existing_read(path)
    path.write_text(text, encoding="utf-8")


def save_png(path, image):
    existing_read(path)
    image.save(path, optimize=True)


def font_path(requested=None):
    if requested:
        path = Path(requested).expanduser().resolve()
        if not path.is_file():
            raise ValueError("Font file does not exist: " + str(path))
        return path
    for candidate in ("/usr/share/fonts/truetype/noto/NotoSansMono-Regular.ttf",
                      "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"):
        if Path(candidate).is_file():
            return Path(candidate)
    value = subprocess.check_output(["fc-match", "Noto Sans Mono", "-f", "%{file}"], text=True)
    if not Path(value).is_file():
        raise RuntimeError("No local monospace font. Use --font /absolute/path/to/font.ttf")
    return Path(value)


class Renderer:
    def __init__(self, font_file):
        self.font_file = font_file
        self.font = ImageFont.truetype(str(font_file), 18 * SCALE)
        advance = self.font.getlength("M")
        assert all(abs(self.font.getlength(char) - advance) < 0.1
                   for char in RAMP + "^v|'\\/─"), "Font glyph advances must be equal"
        label_path = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
        label_file = str(label_path if label_path.exists() else font_file)
        self.label = ImageFont.truetype(label_file, 14)
        self.small = ImageFont.truetype(label_file, 12)
        self.title = ImageFont.truetype(label_file, 23)
        self.heading = ImageFont.truetype(label_file, 17)
        self.glyphs = {}

    def gradient(self, width, height, colors):
        top, bottom = np.array(rgb(colors[0])), np.array(rgb(colors[1]))
        weight = np.linspace(0, 1, height)[:, None, None]
        pixels = np.broadcast_to(top * (1 - weight) + bottom * weight, (height, width, 3))
        return Image.fromarray(np.rint(pixels).astype("uint8"), mode="RGB")

    def glyph(self, char):
        if char not in self.glyphs:
            mask = Image.new("L", (CELL_W * SCALE, CELL_H * SCALE))
            draw = ImageDraw.Draw(mask)
            advance = self.font.getlength(char)
            draw.text(((CELL_W * SCALE - advance) / 2, 15.5 * SCALE), char,
                      fill=255, font=self.font, anchor="ls", stroke_width=0)
            self.glyphs[char] = mask.resize((CELL_W, CELL_H), Image.Resampling.LANCZOS)
        return self.glyphs[char]

    def draw_rows(self, image, rows, x, y, color):
        ink = rgb(color)
        for dy, row in enumerate(rows):
            for dx, char in enumerate(row):
                if char != " ":
                    image.paste(ink, (x + dx * CELL_W, y + dy * CELL_H), self.glyph(char))

    def tile(self, rows, mode, kind):
        width = (len(rows[0]) + 2) * CELL_W
        height = (len(rows) + 2) * CELL_H
        image = self.gradient(width, height, PALETTES[mode]["sky"])
        self.draw_rows(image, rows, CELL_W, CELL_H, PALETTES[mode][kind])
        return image

    def pair(self, name, item, kind, width):
        dark = self.tile(item["dark"], "dark", kind)
        light = self.tile(item["light"], "light", kind)
        height = dark.height + 58
        image = Image.new("RGB", (width, height), PAPER)
        draw = ImageDraw.Draw(image)
        label = name.removeprefix("moon_").replace("_", " ")
        draw.text((10, 5), label, fill=LABEL, font=self.label)
        dimension = f'{len(item["dark"][0])} x {len(item["dark"])}'
        draw.text((width - 12, 7), dimension, fill=MUTED, font=self.small, anchor="ra")
        total = dark.width + light.width + 12
        x = (width - total) // 2
        assert x >= 0, (name, width, total)
        draw.text((x, 28), "DAY / dark ink", fill=MUTED, font=self.small)
        draw.text((x + dark.width + 12, 28), "NIGHT / light ink", fill=MUTED, font=self.small)
        image.paste(dark, (x, 49))
        image.paste(light, (x + dark.width + 12, 49))
        return image

    def section(self, title, subtitle, values, columns):
        card_width = (SHEET_W - MARGIN * 2 - GAP * (columns - 1)) // columns
        cards = [self.pair(name, item, kind, card_width) for name, item, kind in values]
        rows = [cards[i:i + columns] for i in range(0, len(cards), columns)]
        height = 66 + sum(max(card.height for card in row) + GAP for row in rows)
        image = Image.new("RGB", (SHEET_W, height), PAPER)
        draw = ImageDraw.Draw(image)
        draw.text((MARGIN, 9), title, font=self.heading, fill=LABEL)
        draw.text((MARGIN, 36), subtitle, font=self.small, fill=MUTED)
        y = 66
        for row in rows:
            for i, card in enumerate(row):
                image.paste(card, (MARGIN + i * (card_width + GAP), y))
            y += max(card.height for card in row) + GAP
        return image

    def weather_sheet(self, assets):
        rows = list(assets["precip"].items())
        # Labels have their own band. Both rows remain native 440-pixel grids.
        image = Image.new("RGB", (SHEET_W, 73 + len(rows) * 49), PAPER)
        draw = ImageDraw.Draw(image)
        draw.text((20, 8), "06 / Weather row vocabulary", font=self.heading, fill=LABEL)
        draw.text((20, 36), "Neutral thin glyphs work in either ink. Shift row seeds; do not tile aligned columns.",
                  font=self.small, fill=MUTED)
        for i, (name, row) in enumerate(rows):
            y = 70 + i * 49
            count = sum(char != " " for char in row)
            draw.text((36, y), f'{name}  |  {count}/40 cells  |  {count * 2.5:g}%',
                      font=self.small, fill=MUTED)
            for j, mode in enumerate(("dark", "light")):
                tile = self.gradient(440, 25, PALETTES[mode]["sky"])
                self.draw_rows(tile, [row], 0, 1, PALETTES[mode]["precip"])
                image.paste(tile, (36 + j * 512, y + 19))
        return image

    def scene(self, assets, mode, country):
        palette = PALETTES[mode]
        image = self.gradient(440, 560, palette["sky"])
        ground = self.gradient(440, 200, palette[country + "_bg"])
        image.paste(ground, (0, 16 * CELL_H))
        clouds = {item["name"]: item for item in assets["clouds"]}
        # Resolve coloured layers at cell level. Do not overprint two glyphs in
        # the same cell when the near dune crosses the distant ridge.
        grid = [[" "] * 40 for _ in range(28)]
        inks = [[palette["pet"]] * 40 for _ in range(28)]

        def put(rows, x, y, color, opaque=False):
            for dy, row in enumerate(rows):
                for dx, char in enumerate(row):
                    cx, cy = x + dx, y + dy
                    if 0 <= cx < 40 and 0 <= cy < 28 and (opaque or char != " "):
                        grid[cy][cx] = char
                        inks[cy][cx] = color

        def stamp(asset, x, y, kind):
            if kind == "moon":
                # The dark version contains the complete body mask. Erase stars
                # inside the unlit hemisphere before stamping the light version.
                for dy, row in enumerate(asset["dark"]):
                    for dx, char in enumerate(row):
                        if char != " ":
                            grid[y + dy][x + dx] = " "
            put(asset[mode], x, y, palette[kind])

        if mode == "light":
            for x, y in ((1, 2), (16, 1), (35, 2), (20, 8), (37, 9), (3, 10), (17, 6)):
                put(["."], x, y, "#8da9c3")
            stamp(assets["moon"]["waxing_gibbous" if country == "sand" else "full"], 27, 2, "moon")
        else:
            stamp(assets["sun"], 28, 2, "sun")
        stamp(clouds["large"], 2, 3, "cloud")
        stamp(clouds["small"], 27, 8, "cloud")
        stamp(clouds["wisp"], 18, 6, "cloud")
        if country == "sand":
            stamp(assets["dunes_far"], 0, 12, "dunes_far")
            stamp(assets["dunes_near"], 0, 15, "dunes_near")
        else:
            stamp(assets["hills"], 0, 13, "hills")
        stamp(assets[country + "_field"], 0, 17, country + "_field")
        # Existing content Truffle from web/src/sprites.ts. Preview reference only.
        pet = ["     .----.     ", "   .' .  . '.   ", "  /          \\  ",
               " |   o    o   | ", " |    \\__/    | ", "  \\          /  ",
               "   '--------'   "]
        put([row.ljust(16) for row in pet], 12, 18, palette["pet"], opaque=True)
        put(["─" * 40, "  E [######....]  Truffle     6120 steps  "], 0, 26, palette["pet"])
        assert all(len(row) == 40 for row in grid)
        for y, row in enumerate(grid):
            for x, char in enumerate(row):
                if char != " ":
                    image.paste(rgb(inks[y][x]), (x * CELL_W, y * CELL_H), self.glyph(char))
        return image


def stack(images):
    image = Image.new("RGB", (max(item.width for item in images), sum(item.height for item in images)), PAPER)
    y = 0
    for item in images:
        image.paste(item, ((image.width - item.width) // 2, y))
        y += item.height
    return image


def render_all(assets, renderer):
    PREVIEW.mkdir(parents=True, exist_ok=True)
    all_entries = list(entries(assets))
    for name, item, kind in all_entries:
        for mode in ("dark", "light"):
            save_png(PREVIEW / f"{name}_{mode}-ink.png", renderer.tile(item[mode], mode, kind))
    sections = [
        ("clouds", renderer.section("01 / Clouds", "Top-left light. Filled puffs, dark bases. A one-row wisp averages both surfaces.",
                                    all_entries[:6], 2)),
        ("sun", renderer.section("02 / Sun", "Limb-darkened disk with side rays. The half disk ends on its own horizon row.",
                                 all_entries[6:8], 2)),
        ("moon_phases", renderer.section("03 / Moon phases", "Sphere normals and a rotating light. Waxing lights the right side. New moon has faint earthshine.",
                                         all_entries[8:16], 4)),
        ("landscape", renderer.section("04 / Landforms", "Left-facing slopes catch light. Right slip faces fall into shadow. No full-width flat horizon rule.",
                                       all_entries[16:19], 1)),
        ("textures", renderer.section("05 / Ground textures", "11.4% occupied. Marks grow toward the viewer. The middle foreground stays open for Truffle.",
                                      all_entries[19:21], 1)),
        ("weather", renderer.weather_sheet(assets)),
    ]
    header = Image.new("RGB", (SHEET_W, 105), PAPER)
    draw = ImageDraw.Draw(header)
    draw.text((20, 15), "TRUFFLE / Shaded ASCII atlas / A02", font=renderer.title, fill=LABEL)
    draw.text((20, 51), "Native 11 x 20 px cells. Day: density is shadow. Night: density is light. One ink per asset.",
              font=renderer.label, fill=MUTED)
    draw.text((20, 77), f"Local {renderer.font.getname()[0]}, 18 px. No bitmap fills inside shapes. All form comes from the glyphs.",
              font=renderer.small, fill=MUTED)
    for name, image in sections:
        save_png(PREVIEW / (name + ".png"), image)
    save_png(PREVIEW / "contact_sheet.png", stack([header] + [item[1] for item in sections]))
    scenes = Image.new("RGB", (944, 1258), PAPER)
    draw = ImageDraw.Draw(scenes)
    draw.text((20, 13), "TRUFFLE / 40 x 28 composition checks", font=renderer.title, fill=LABEL)
    draw.text((20, 46), "Terrain ends at row 25. The HUD is rows 26 and 27. Sprite spaces erase underlying ink.",
              font=renderer.small, fill=MUTED)
    for i, country in enumerate(("sand", "grass")):
        for j, mode in enumerate(("dark", "light")):
            image = renderer.scene(assets, mode, country)
            save_png(PREVIEW / f"scene_{country}_{mode}-ink.png", image)
            x, y = 20 + j * 464, 97 + i * 590
            draw.text((x, y - 22), f'{country.upper()} / {"DAY" if mode == "dark" else "NIGHT"}',
                      font=renderer.label, fill=LABEL)
            scenes.paste(image, (x, y))
    save_png(PREVIEW / "scene_contact_sheet.png", scenes)


def verify_previews(assets):
    manifest = json.loads((ROOT / "verification.json").read_text(encoding="utf-8"))
    assert manifest["cell_px"] == [11, 20]
    assert manifest["assets"] == validate(assets)
    files = {str(path.relative_to(ROOT)) for path in PREVIEW.glob("*.png")}
    assert files == set(manifest["pngs"])
    assert len(files) == 72
    for name, details in manifest["pngs"].items():
        path = ROOT / name
        assert hashlib.sha256(path.read_bytes()).hexdigest() == details["sha256"], name
        with Image.open(path) as image:
            assert image.format == "PNG" and image.mode == "RGB", name
            assert list(image.size) == details["size"], name
            image.verify()
    for name, item, _ in entries(assets):
        for mode in ("dark", "light"):
            path = f"preview/{name}_{mode}-ink.png"
            assert manifest["pngs"][path]["size"] == [
                (len(item[mode][0]) + 2) * CELL_W, (len(item[mode]) + 2) * CELL_H]
    for country in ("sand", "grass"):
        for mode in ("dark", "light"):
            assert manifest["pngs"][f"preview/scene_{country}_{mode}-ink.png"]["size"] == [440, 560]
    return len(files)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--font", help="Use an already-installed local monospace TTF.")
    parser.add_argument("--check", action="store_true", help="Validate saved JSON and PNGs without writing outputs.")
    args = parser.parse_args()
    if args.check:
        assets = json.loads((ROOT / "assets.json").read_text(encoding="utf-8"))
        report = validate(assets)
        assert assets == make_assets(), "Saved JSON differs from the deterministic generator"
        count = verify_previews(assets)
        print(f"PASS {len(report)} assets; both directions; exact dimensions; masks; phases; perspective; clear zone")
        print(f"PASS {count} PNGs; native cell sizes; decoded RGB images; SHA-256 manifest")
        return
    assets = make_assets()
    report = validate(assets)
    renderer = Renderer(font_path(args.font))
    save_text(ROOT / "assets.json", json.dumps(assets, indent=2, ensure_ascii=False) + "\n")
    render_all(assets, renderer)
    files = sorted(PREVIEW.glob("*.png"))
    manifest = {
        "cell_px": [CELL_W, CELL_H], "font": str(renderer.font_file),
        "font_size_px": 18, "supersample": SCALE, "surface_samples_per_cell": SAMPLES ** 2,
        "ramp": RAMP, "assets": report,
        "pngs": {str(path.relative_to(ROOT)): {"size": list(Image.open(path).size),
                                               "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
                 for path in files},
    }
    save_text(ROOT / "verification.json", json.dumps(manifest, indent=2) + "\n")
    print(f"PASS {len(report)} assets, {len(files)} PNGs, 11 x 20 px cells")
    print("Font: " + str(renderer.font_file))
    print("Contact sheet: " + str(PREVIEW / "contact_sheet.png"))
    print("Scene sheet: " + str(PREVIEW / "scene_contact_sheet.png"))
    for name in ("sand_field", "grass_field"):
        print(f'{name}: {report[name]["dark"]["occupancy_pct"]}% occupied; '
              f'{report[name]["dark"]["occupied_per_row"]}')


if __name__ == "__main__":
    main()
