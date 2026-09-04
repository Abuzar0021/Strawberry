"use client";

import type { Ground, Plate } from "@/data/strawberry";

/**
 * The plates behind the stage, and the stand-ins used until real ones exist.
 *
 * Pear's own stage is carried by commissioned neoclassical painting. This file
 * paints a substitute for each plate so the shader, the dissolves and the whole
 * scroll can be built, reviewed and shipped before any artwork is finished. The
 * stand-ins are deliberately reductive - a ground wash, a canvas weave, a
 * vignette and a silhouette - because the one thing worse than an obvious
 * placeholder is a placeholder good enough that nobody replaces it.
 *
 * `loadPlate` prefers the real file and only falls back, so finishing the site
 * is a copy into `public/strawberry/art/` and no code change at all.
 */

/**
 * The named grounds, measured off the finished plates.
 *
 * `base` is only the fallback and the pre-load background - the shader takes
 * each plate's own `tone`. `ink` is the decision that actually matters here:
 * whether copy standing on this ground sets in cream or in ink.
 */
export const GROUNDS: Record<Ground, { base: string; deep: string; ink: string }> = {
  cobalt: { base: "#0f5285", deep: "#08375a", ink: "cream" },
  azure: { base: "#227190", deep: "#17566f", ink: "cream" },
  bone: { base: "#c8c5b0", deep: "#b0ad98", ink: "ink" },
  night: { base: "#0f314d", deep: "#071e30", ink: "cream" },
};

const GOLD = "#c2a365";
const GOLD_LIT = "#e6c987";
const SHADE = "rgba(28,24,16,0.42)";

const PLATE_W = 1600;
const PLATE_H = 1000;

type Ctx = CanvasRenderingContext2D;

/** Deterministic noise, so a plate looks identical between reloads. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function ground(ctx: Ctx, g: Ground) {
  const { base, deep } = GROUNDS[g];
  const grad = ctx.createLinearGradient(0, 0, 0, PLATE_H);
  grad.addColorStop(0, deep);
  grad.addColorStop(0.55, base);
  grad.addColorStop(1, deep);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, PLATE_W, PLATE_H);

  // two soft washes break the flatness the way a brushed ground would
  const r = rng(7);
  for (let i = 0; i < 3; i++) {
    const x = PLATE_W * (0.2 + r() * 0.6);
    const y = PLATE_H * (0.2 + r() * 0.6);
    const rad = PLATE_W * (0.28 + r() * 0.3);
    const wash = ctx.createRadialGradient(x, y, 0, x, y, rad);
    wash.addColorStop(0, "rgba(255,255,255,0.07)");
    wash.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, PLATE_W, PLATE_H);
  }
}

/** The linen weave that reads under every plate on the reference build. */
function weave(ctx: Ctx) {
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x < PLATE_W; x += 3) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, PLATE_H);
  }
  for (let y = 0; y < PLATE_H; y += 3) {
    ctx.moveTo(0, y);
    ctx.lineTo(PLATE_W, y);
  }
  ctx.stroke();
  ctx.restore();
}

function vignette(ctx: Ctx) {
  const v = ctx.createRadialGradient(
    PLATE_W / 2,
    PLATE_H / 2,
    PLATE_H * 0.25,
    PLATE_W / 2,
    PLATE_H / 2,
    PLATE_W * 0.72
  );
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.34)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, PLATE_W, PLATE_H);
}

/** A pear outline, drawn from its widest point so it can be scaled anywhere. */
function pearPath(ctx: Ctx, cx: number, cy: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - r * 1.45);
  ctx.bezierCurveTo(cx + r * 0.62, cy - r * 1.3, cx + r * 0.5, cy - r * 0.35, cx + r * 0.86, cy + r * 0.2);
  ctx.bezierCurveTo(cx + r * 1.2, cy + r * 0.86, cx + r * 0.6, cy + r * 1.35, cx, cy + r * 1.35);
  ctx.bezierCurveTo(cx - r * 0.6, cy + r * 1.35, cx - r * 1.2, cy + r * 0.86, cx - r * 0.86, cy + r * 0.2);
  ctx.bezierCurveTo(cx - r * 0.5, cy - r * 0.35, cx - r * 0.62, cy - r * 1.3, cx, cy - r * 1.45);
  ctx.closePath();
}

function stem(ctx: Ctx, cx: number, cy: number, r: number) {
  ctx.save();
  ctx.strokeStyle = "#4a3a1d";
  ctx.lineWidth = r * 0.12;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx + r * 0.02, cy - r * 1.4);
  ctx.quadraticCurveTo(cx + r * 0.22, cy - r * 1.85, cx + r * 0.12, cy - r * 2.15);
  ctx.stroke();
  ctx.restore();
}

function gildedPear(ctx: Ctx, cx: number, cy: number, r: number) {
  pearPath(ctx, cx, cy, r);
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.05, cx, cy, r * 1.6);
  g.addColorStop(0, GOLD_LIT);
  g.addColorStop(0.55, GOLD);
  g.addColorStop(1, "#8a6f3c");
  ctx.fillStyle = g;
  ctx.fill();
  stem(ctx, cx, cy, r);
}

/** A standing figure, reduced to drape and shoulder. */
function figure(ctx: Ctx, x: number, baseY: number, h: number, robe: string, flip = false) {
  ctx.save();
  ctx.translate(x, baseY);
  if (flip) ctx.scale(-1, 1);
  const w = h * 0.34;

  ctx.fillStyle = robe;
  ctx.beginPath();
  ctx.moveTo(-w * 0.32, -h * 0.72);
  ctx.quadraticCurveTo(-w * 0.95, -h * 0.34, -w * 1.05, 0);
  ctx.lineTo(w * 1.0, 0);
  ctx.quadraticCurveTo(w * 0.9, -h * 0.36, w * 0.32, -h * 0.72);
  ctx.closePath();
  ctx.fill();

  // head and shoulder, kept as one silhouette so it never reads as a portrait
  ctx.beginPath();
  ctx.ellipse(0, -h * 0.82, w * 0.24, h * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

const SKETCHES: Record<Plate["sketch"], (ctx: Ctx, g: Ground) => void> = {
  /* The opening: heavy drapery pulled aside, a figure stepping through. */
  curtain(ctx) {
    const r = rng(3);
    for (let i = 0; i < 9; i++) {
      const x = PLATE_W * 0.6 + i * 58;
      ctx.fillStyle = i % 2 ? "rgba(16,14,15,0.86)" : "rgba(34,31,32,0.9)";
      ctx.beginPath();
      ctx.moveTo(x, -20);
      ctx.bezierCurveTo(
        x - 70 + r() * 30,
        PLATE_H * 0.34,
        x + 40,
        PLATE_H * 0.62,
        x - 30 + r() * 40,
        PLATE_H + 20
      );
      ctx.lineTo(x + 120, PLATE_H + 20);
      ctx.bezierCurveTo(x + 150, PLATE_H * 0.6, x + 90, PLATE_H * 0.3, x + 110, -20);
      ctx.closePath();
      ctx.fill();
    }
    figure(ctx, PLATE_W * 0.63, PLATE_H * 0.98, PLATE_H * 0.78, "#efeadd");
    ctx.fillStyle = "#a4402c";
    ctx.fillRect(PLATE_W * 0.612, PLATE_H * 0.52, 70, 24);
    // the marble step the figure walks out onto
    ctx.fillStyle = "rgba(236,233,224,0.9)";
    ctx.fillRect(PLATE_W * 0.38, PLATE_H * 0.9, PLATE_W * 0.5, PLATE_H * 0.1);
  },

  /* Chapter one, beat one: a scion bound onto an established branch. */
  graft(ctx) {
    ctx.strokeStyle = "#5b4a33";
    ctx.lineCap = "round";
    ctx.lineWidth = 74;
    ctx.beginPath();
    ctx.moveTo(PLATE_W * 0.2, PLATE_H * 0.92);
    ctx.quadraticCurveTo(PLATE_W * 0.62, PLATE_H * 0.66, PLATE_W * 1.04, PLATE_H * 0.74);
    ctx.stroke();

    ctx.lineWidth = 22;
    ctx.strokeStyle = "#6b5942";
    ctx.beginPath();
    ctx.moveTo(PLATE_W * 0.64, PLATE_H * 0.74);
    ctx.lineTo(PLATE_W * 0.66, PLATE_H * 0.3);
    ctx.stroke();

    // the binding - the whole point of the image
    ctx.strokeStyle = "#cdbb8c";
    ctx.lineWidth = 7;
    for (let i = 0; i < 9; i++) {
      const y = PLATE_H * (0.68 + i * 0.014);
      ctx.beginPath();
      ctx.moveTo(PLATE_W * 0.61, y);
      ctx.lineTo(PLATE_W * 0.69, y + 6);
      ctx.stroke();
    }
    leaves(ctx, PLATE_W * 0.66, PLATE_H * 0.31, 160, 6);
  },

  /* Beat two: raised above the crowd. */
  ladder(ctx) {
    ctx.strokeStyle = "#6d5a3f";
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.moveTo(PLATE_W * 0.46, PLATE_H * 1.02);
    ctx.lineTo(PLATE_W * 0.56, PLATE_H * 0.05);
    ctx.moveTo(PLATE_W * 0.6, PLATE_H * 1.02);
    ctx.lineTo(PLATE_W * 0.68, PLATE_H * 0.05);
    ctx.stroke();
    ctx.lineWidth = 11;
    for (let i = 0; i < 11; i++) {
      const t = i / 10;
      ctx.beginPath();
      ctx.moveTo(PLATE_W * (0.46 + t * 0.1), PLATE_H * (1.02 - t * 0.97));
      ctx.lineTo(PLATE_W * (0.6 + t * 0.08), PLATE_H * (1.02 - t * 0.97));
      ctx.stroke();
    }
    // the crowd, as a row of low silhouettes so no one figure competes
    const r = rng(11);
    for (let i = 0; i < 14; i++) {
      figure(ctx, PLATE_W * (0.42 + i * 0.048), PLATE_H * 1.02, PLATE_H * (0.26 + r() * 0.09), "rgba(70,66,54,0.5)");
    }
    figure(ctx, PLATE_W * 0.57, PLATE_H * 0.2, PLATE_H * 0.3, "#efeadd");
  },

  /* Beat three: the cut, and what it divides. */
  cut(ctx) {
    figure(ctx, PLATE_W * 0.72, PLATE_H * 1.06, PLATE_H * 1.1, "#1f4034");
    gildedPear(ctx, PLATE_W * 0.53, PLATE_H * 0.5, 118);
    ctx.save();
    // the blade comes in from the figure's side and points back at the fruit
    ctx.translate(PLATE_W * 0.78, PLATE_H * 0.46);
    ctx.rotate(Math.PI - 0.42);
    ctx.fillStyle = "#d6d8d8";
    ctx.fillRect(0, -7, 210, 14);
    ctx.fillStyle = GOLD;
    ctx.fillRect(205, -12, 34, 24);
    ctx.restore();
  },

  /* Chapter two: the pear as a printing plate, not as fruit. */
  "halftone-pear"(ctx, g) {
    const cx = PLATE_W * 0.3;
    const cy = PLATE_H * 0.62;
    const r = 300;
    ctx.save();
    pearPath(ctx, cx, cy, r);
    ctx.clip();
    ctx.fillStyle = "#efe9d8";
    ctx.fillRect(0, 0, PLATE_W, PLATE_H);
    // the dots are drawn, not shaded, so the plate survives the shader's own
    // halftone pass without moiré fighting it
    ctx.fillStyle = GROUNDS[g].deep;
    for (let y = cy - r * 1.6; y < cy + r * 1.5; y += 15) {
      for (let x = cx - r * 1.3; x < cx + r * 1.3; x += 15) {
        const d = Math.hypot((x - cx) / r, (y - cy) / r);
        const rad = Math.min(6.4, 1.2 + d * 4.6);
        ctx.beginPath();
        ctx.arc(x, y, rad, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    stem(ctx, cx, cy, r);
    clouds(ctx, PLATE_W * 0.78, PLATE_H * 0.3, 190);
  },

  /* Chapter three: the object, lit and alone. */
  orbit(ctx) {
    const cx = PLATE_W * 0.56;
    const cy = PLATE_H * 0.5;
    const halo = ctx.createRadialGradient(cx, cy, 120, cx, cy, 300);
    halo.addColorStop(0, "rgba(255,255,255,0.32)");
    halo.addColorStop(0.62, "rgba(255,255,255,0.13)");
    halo.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, 300, 0, Math.PI * 2);
    ctx.fill();
    gildedPear(ctx, cx, cy, 145);
    // the falling drape that anchors the right edge of the frame
    ctx.fillStyle = "#9d3f2c";
    ctx.beginPath();
    ctx.moveTo(PLATE_W * 0.86, -10);
    ctx.quadraticCurveTo(PLATE_W * 0.98, PLATE_H * 0.3, PLATE_W * 0.9, PLATE_H * 0.56);
    ctx.lineTo(PLATE_W * 1.02, PLATE_H * 0.5);
    ctx.quadraticCurveTo(PLATE_W * 1.04, PLATE_H * 0.2, PLATE_W * 1.0, -10);
    ctx.closePath();
    ctx.fill();
  },

  /* Chapter four: looking up, which is where questions get asked. */
  canopy(ctx) {
    clouds(ctx, PLATE_W * 0.52, PLATE_H * 0.12, 210);
    for (const [x, y, s] of [
      [0.06, 0.1, 1.1],
      [0.02, 0.52, 0.95],
      [0.14, 0.86, 1.0],
      [0.9, 0.16, 1.05],
      [0.97, 0.6, 0.9],
      [0.82, 0.92, 1.15],
    ] as const) {
      leaves(ctx, PLATE_W * x, PLATE_H * y, 210 * s, 7);
      gildedPear(ctx, PLATE_W * x, PLATE_H * y, 52 * s);
    }
  },

  /* The application: a young tree, and something to aim at. */
  sapling(ctx) {
    ctx.strokeStyle = "#5d4a30";
    ctx.lineCap = "round";
    ctx.lineWidth = 15;
    ctx.beginPath();
    ctx.moveTo(PLATE_W * 0.5, PLATE_H * 1.02);
    ctx.lineTo(PLATE_W * 0.5, PLATE_H * 0.22);
    ctx.stroke();
    ctx.lineWidth = 7;
    const r = rng(23);
    for (let i = 0; i < 10; i++) {
      const y = PLATE_H * (0.28 + i * 0.06);
      const dir = i % 2 ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(PLATE_W * 0.5, y);
      ctx.quadraticCurveTo(
        PLATE_W * (0.5 + dir * 0.06),
        y - 40,
        PLATE_W * (0.5 + dir * (0.09 + r() * 0.04)),
        y - 70
      );
      ctx.stroke();
    }
    leaves(ctx, PLATE_W * 0.5, PLATE_H * 0.42, 260, 11);
    stars(ctx);
    clouds(ctx, PLATE_W * 0.78, PLATE_H * 0.42, 230);
  },

  /* The close: the thing bearing, and two people who put it there. */
  grove(ctx) {
    ctx.strokeStyle = "#5d4a30";
    ctx.lineWidth = 20;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(PLATE_W * 0.5, PLATE_H * 1.02);
    ctx.lineTo(PLATE_W * 0.5, PLATE_H * 0.3);
    ctx.stroke();
    ctx.lineWidth = 8;
    for (let i = 0; i < 8; i++) {
      const y = PLATE_H * (0.36 + i * 0.07);
      const dir = i % 2 ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(PLATE_W * 0.5, y);
      ctx.quadraticCurveTo(PLATE_W * (0.5 + dir * 0.07), y - 34, PLATE_W * (0.5 + dir * 0.12), y - 56);
      ctx.stroke();
      gildedPear(ctx, PLATE_W * (0.5 + dir * 0.12), y - 42, 26);
    }
    leaves(ctx, PLATE_W * 0.5, PLATE_H * 0.5, 300, 13);
    figure(ctx, PLATE_W * 0.13, PLATE_H * 1.04, PLATE_H * 0.68, "#efeadd");
    figure(ctx, PLATE_W * 0.88, PLATE_H * 1.04, PLATE_H * 0.7, "#1f4034", true);
    clouds(ctx, PLATE_W * 0.5, PLATE_H * 0.1, 170);
  },
};

function leaves(ctx: Ctx, cx: number, cy: number, spread: number, n: number) {
  const r = rng(Math.round(cx + cy));
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const d = r() * spread;
    const x = cx + Math.cos(a) * d;
    const y = cy + Math.sin(a) * d * 0.7;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.fillStyle = i % 3 ? "#2f4a24" : "#40602f";
    ctx.beginPath();
    ctx.ellipse(0, 0, 44, 17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/** Clouds are drawn as dots throughout - the site's one recurring motif. */
function clouds(ctx: Ctx, cx: number, cy: number, w: number) {
  const r = rng(Math.round(cx * 3 + cy));
  ctx.fillStyle = "rgba(244,241,231,0.92)";
  for (let i = 0; i < 900; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r());
    const x = cx + Math.cos(a) * d * w;
    const y = cy + Math.sin(a) * d * w * 0.42;
    // snap to a grid so the cloud reads as printed rather than sprayed
    const gx = Math.round(x / 9) * 9;
    const gy = Math.round(y / 9) * 9;
    ctx.beginPath();
    ctx.arc(gx, gy, 3.2 * (1 - d * 0.7), 0, Math.PI * 2);
    ctx.fill();
  }
}

function stars(ctx: Ctx) {
  const pts: [number, number][] = [
    [0.26, 0.05],
    [0.4, 0.13],
    [0.35, 0.19],
    [0.44, 0.3],
    [0.58, 0.04],
    [0.43, 0.45],
  ];
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  pts.forEach(([x, y], i) => {
    const px = PLATE_W * x;
    const py = PLATE_H * y;
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  });
  ctx.stroke();
  for (const [x, y] of pts) {
    const px = PLATE_W * x;
    const py = PLATE_H * y;
    const g = ctx.createRadialGradient(px, py, 0, px, py, 34);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, 34, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Paints one stand-in plate. */
export function paintPlate(plate: Plate): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = PLATE_W;
  c.height = PLATE_H;
  const ctx = c.getContext("2d");
  if (!ctx) return c;

  ground(ctx, plate.ground);
  ctx.save();
  ctx.globalAlpha = 0.92;
  SKETCHES[plate.sketch](ctx, plate.ground);
  ctx.restore();
  ctx.fillStyle = SHADE;
  ctx.globalCompositeOperation = "multiply";
  ctx.globalAlpha = 0.06;
  ctx.fillRect(0, 0, PLATE_W, PLATE_H);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  weave(ctx);
  vignette(ctx);
  return c;
}

/**
 * Resolves a plate to something the renderer can upload as a texture.
 *
 * The real file wins whenever it decodes. A missing file is the expected case
 * right now, not an error, so a failed load is silent and the stand-in stands in.
 */
export async function loadPlate(plate: Plate): Promise<TexImageSource> {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.src = plate.src;
    await img.decode();
    return img;
  } catch {
    return paintPlate(plate);
  }
}
