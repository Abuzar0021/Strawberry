"use client";

/**
 * The stage renderer.
 *
 * One quad, four plate textures, and a dissolve that breaks the image into
 * printing dots on its way from one plate to the next. The dot pass is the
 * signature of the whole site: at rest a plate is just a painting, but while it
 * is handing over it shatters into halftone against the flat ground colour, the
 * way a duotone separation looks when the screen is too coarse.
 *
 * Four textures rather than two because each plate is a frame sequence and is
 * held as a *pair* - the frame before the playhead and the frame after it -
 * blended by however far between them the scroll currently sits. Frames sit
 * about sixty pixels of scroll apart, close enough that the blend reads as
 * motion rather than as a double exposure, and it means the plates move
 * continuously instead of stepping from one frame to the next. It also means a
 * half-downloaded sequence is smooth rather than jerky: the pair simply spans a
 * wider gap until the frames between it arrive.
 *
 * Written against GLSL ES 1.00 so a WebGL1 context is enough; WebGL2 is taken
 * when offered only because it is the better-tested path in current browsers.
 */

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAG = `
precision highp float;

varying vec2 vUv;

uniform sampler2D uA0;     // plate A, frame at or before the playhead
uniform sampler2D uA1;     // plate A, frame after it
uniform sampler2D uB0;
uniform sampler2D uB1;
uniform float uFa;         // how far between A's two frames the scroll sits
uniform float uFb;
uniform vec2  uRes;        // drawing buffer size, px
uniform vec2  uAspectA;    // cover-fit scale for plate A
uniform vec2  uAspectB;
uniform vec2  uPan;        // shared parallax offset, uv
uniform float uZoom;
uniform float uMix;        // 0 = fully A, 1 = fully B
uniform vec3  uGroundA;
uniform vec3  uGroundB;
uniform float uCell;       // halftone cell size, px
uniform float uGrain;
uniform float uTime;
uniform float uTrans;      // 0 dissolve, 1 iris, 2 bridge, 3 crossfade

const float PI = 3.14159265;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

/* Value noise - only used to give the dissolve sweep a soft, uneven edge. */
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

vec2 cover(vec2 uv, vec2 aspect, float zoom, vec2 pan) {
  return (uv - 0.5) / (aspect * zoom) + 0.5 + pan;
}

/* Each plate is sampled from its two frames at once. Doing the blend here
   rather than by uploading pre-mixed pixels is what keeps the motion
   continuous no matter how coarsely the sequence has downloaded so far. */
vec3 plateA(vec2 uv) {
  vec2 c = clamp(uv, 0.001, 0.999);
  return mix(texture2D(uA0, c).rgb, texture2D(uA1, c).rgb, uFa);
}

vec3 plateB(vec2 uv) {
  vec2 c = clamp(uv, 0.001, 0.999);
  return mix(texture2D(uB0, c).rgb, texture2D(uB1, c).rgb, uFb);
}

void main() {
  vec2 uvA = cover(vUv, uAspectA, uZoom, uPan);
  vec2 uvB = cover(vUv, uAspectB, uZoom, uPan * 1.14);

  if (uTrans > 2.5) {
    /* A plain crossfade, used only to ease a bridge sequence in and out
       against the plates on either side. A bridge is generated separately from
       the plate clips, so its first and last frames rarely match theirs
       exactly; cutting straight to one shows that mismatch as a jump. */
    vec3 mixed = mix(plateA(uvA), plateB(uvB), clamp(uMix, 0.0, 1.0));
    float gx = hash(vUv * uRes + fract(uTime) * 91.0) - 0.5;
    gl_FragColor = vec4(mixed + gx * uGrain, 1.0);
    return;
  }

  /* ---- bridge -------------------------------------------------------
     A filmed transition already contains the whole handover, so the stage
     gets out of the way: one plate, cover-fitted, no blend and no halftone.
     Anything else here would be a second effect fighting the first. */
  if (uTrans > 1.5 && uTrans < 2.5) {
    vec3 cb = plateA(uvA);
    float gb = hash(vUv * uRes + fract(uTime) * 91.0) - 0.5;
    gl_FragColor = vec4(cb + gb * uGrain, 1.0);
    return;
  }

  /* ---- iris ----------------------------------------------------------
     A circle opens from just above centre and the two plates counter-scale
     through it: the outgoing one rushes at the viewer while the incoming one
     blooms out of the point. The rim is broken by noise that drifts with
     time, so the opening keeps crawling even when the scroll is still - that
     is what makes it read as a portal rather than a wipe. */
  if (uTrans > 0.5 && uTrans < 1.5) {
    vec2 asp = vec2(uRes.x / uRes.y, 1.0);
    vec2 o = vec2(0.5, 0.47) * asp;
    /* The circle has to travel past the furthest corner or the handover never
       finishes and plate A survives in the corners at full mix. */
    float maxD = max(max(distance(o, vec2(0.0, 0.0)), distance(o, vec2(asp.x, 0.0))),
                     max(distance(o, vec2(0.0, 1.0)), distance(o, asp)));
    float w = 0.20;
    float n = noise(vUv * 5.5 + uTime * 0.06);
    float edge = uMix * (maxD + w) + (n - 0.5) * 0.055;
    float k = clamp(1.0 - smoothstep(edge - w, edge, distance(o, vUv * asp)), 0.0, 1.0);

    /* Counter-scale: the outgoing plate rushes at the viewer as it is pushed
       out, the incoming one blooms from the point. This is what separates a
       portal from a circular wipe. */
    vec3 ca = plateA((uvA - 0.5) * (1.0 - k * 0.92) + 0.5);
    vec3 cb = plateB((uvB - 0.5) * (0.25 + k * 0.75) + 0.5);

    vec3 outCol = mix(ca, cb, k);
    float g0 = hash(vUv * uRes + fract(uTime) * 91.0) - 0.5;
    gl_FragColor = vec4(outCol + g0 * uGrain, 1.0);
    return;
  }

  vec3 a = plateA(uvA);
  vec3 b = plateB(uvB);

  /* The wipe runs diagonally and is roughed up by noise, so the two plates
     never trade places along a straight line. */
  float sweep = vUv.x * 0.34 + (1.0 - vUv.y) * 0.26 + noise(vUv * 3.2) * 0.22;
  float local = clamp(uMix * 1.9 - sweep * 0.82, 0.0, 1.0);
  local = local * local * (3.0 - 2.0 * local);

  vec3 base   = mix(a, b, local);
  vec3 ground = mix(uGroundA, uGroundB, local);

  /* Halftone strength peaks in the middle of the handover and is zero at both
     ends, so a settled plate is never dotted. */
  float ht = sin(clamp(uMix, 0.0, 1.0) * PI);
  ht = ht * ht;

  if (ht > 0.002) {
    /* Screen angle. 15 degrees is the classic one, and it keeps the grid off
       both axes so it does not beat against the pixel rows. */
    float ang = 0.2618;
    mat2 rot = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
    vec2 px = rot * (vUv * uRes);

    float cell = max(uCell, 3.0);
    vec2 cellUv = mod(px, cell) / cell - 0.5;
    float d = length(cellUv) * 2.0;

    /* Dot area follows how far the pixel sits from the ground colour, so the
       plate's own darks stay solid and its ground opens up. */
    float ink = clamp(length(base - ground) * 1.55, 0.0, 1.0);
    float radius = sqrt(ink);
    float aa = 2.0 / cell;
    float mask = smoothstep(radius + aa, radius - aa, d);

    base = mix(base, mix(ground, base, mask), ht);
  }

  /* Paper grain. Animated a little, or it reads as dirt on the lens. */
  float g = hash(vUv * uRes + fract(uTime) * 91.0) - 0.5;
  base += g * uGrain;

  gl_FragColor = vec4(base, 1.0);
}
`;

export type StageState = {
  from: number;
  to: number;
  mix: number;
  zoom: number;
  pan: [number, number];
  cell: number;
  /** 0 = halftone dissolve, 1 = iris, 2 = bridge, 3 = crossfade. */
  trans: number;
};

type Slot = {
  /** The frame at or before the playhead, and the one after it. */
  a: WebGLTexture;
  b: WebGLTexture;
  /** Which frames those hold. `ib` of -1 means there is nothing to blend to. */
  ia: number;
  ib: number;
  /** How far between them the playhead sits, 0-1. */
  frac: number;
  aspect: [number, number];
  ground: [number, number, number];
};

const sizeOf = (source: TexImageSource): [number, number] => {
  const img = source as HTMLImageElement;
  return [img.naturalWidth || img.width, img.naturalHeight || img.height];
};

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type);
  if (!sh) throw new Error("shader alloc failed");
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`shader: ${log}`);
  }
  return sh;
}

const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

export function createStage(canvas: HTMLCanvasElement) {
  const gl = (canvas.getContext("webgl2", { antialias: false, alpha: false }) ??
    canvas.getContext("webgl", { antialias: false, alpha: false })) as WebGLRenderingContext | null;
  if (!gl) return null;

  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const u = (name: string) => gl.getUniformLocation(prog, name);
  const U = {
    fa: u("uFa"),
    fb: u("uFb"),
    res: u("uRes"),
    aspectA: u("uAspectA"),
    aspectB: u("uAspectB"),
    pan: u("uPan"),
    zoom: u("uZoom"),
    mix: u("uMix"),
    groundA: u("uGroundA"),
    groundB: u("uGroundB"),
    cell: u("uCell"),
    grain: u("uGrain"),
    time: u("uTime"),
    trans: u("uTrans"),
  };
  gl.uniform1i(u("uA0"), 0);
  gl.uniform1i(u("uA1"), 1);
  gl.uniform1i(u("uB0"), 2);
  gl.uniform1i(u("uB1"), 3);

  const slots: Slot[] = [];
  let lost = false;

  const onLost = (e: Event) => {
    e.preventDefault();
    lost = true;
  };
  canvas.addEventListener("webglcontextlost", onLost);

  function newTexture(fill: [number, number, number]) {
    const tex = gl!.createTexture()!;
    gl!.bindTexture(gl!.TEXTURE_2D, tex);
    // NPOT-safe: clamp + linear, no mips
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);
    gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGB, 1, 1, 0, gl!.RGB, gl!.UNSIGNED_BYTE,
      new Uint8Array(fill.map((c) => Math.round(c * 255))));
    return tex;
  }

  /** Pushes an image into one of a slot's two textures. */
  function write(slot: Slot, tex: WebGLTexture, source: TexImageSource) {
    gl!.bindTexture(gl!.TEXTURE_2D, tex);
    gl!.pixelStorei(gl!.UNPACK_FLIP_Y_WEBGL, 1);
    gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGB, gl!.RGB, gl!.UNSIGNED_BYTE, source);
    const [w, h] = sizeOf(source);
    if (w && h) slot.aspect = [w / h, 1];
  }

  return {
    /**
     * Appends a slot and returns its index.
     *
     * It opens on a single pixel of its own ground colour. An empty slot is on
     * screen for the first few hundred milliseconds of every visit, and a flat
     * wash of the right colour is a backdrop the copy is already designed to
     * sit on; black would be a hole in the page.
     */
    addSlot(groundHex: string) {
      const ground = hexToRgb(groundHex);
      slots.push({
        a: newTexture(ground),
        b: newTexture(ground),
        ia: -1,
        ib: -1,
        frac: 0,
        aspect: [16 / 9, 1],
        ground,
      });
      return slots.length - 1;
    },

    /**
     * Puts a single still in a slot, with nothing to blend toward.
     *
     * This is the painted plate: what a reduced-motion visit sees for the whole
     * scroll, and what everyone else sees for the moment before the sequence
     * reaches that chapter.
     */
    setSource(index: number, source: TexImageSource) {
      const slot = slots[index];
      if (!slot) return;
      write(slot, slot.a, source);
      slot.ia = -1;
      slot.ib = -1;
      slot.frac = 0;
    },

    /**
     * Positions a slot between two frames of its sequence.
     *
     * Advancing by one frame costs no upload at all: the frame we were heading
     * toward becomes the frame we are leaving, so the two textures are simply
     * swapped and only the new leading frame is sent. That is what makes a
     * continuous scrub affordable - one upload per frame crossed, rather than
     * two per rendered frame.
     */
    setFrames(
      index: number,
      ia: number,
      imgA: TexImageSource,
      ib: number,
      imgB: TexImageSource | null,
      frac: number,
    ) {
      const slot = slots[index];
      if (!slot) return;

      if (ia !== slot.ia) {
        if (ia === slot.ib) {
          const t = slot.a;
          slot.a = slot.b;
          slot.b = t;
          slot.ib = -1;
        } else {
          write(slot, slot.a, imgA);
        }
        slot.ia = ia;
      }

      if (imgB && ib !== ia) {
        if (ib !== slot.ib) {
          write(slot, slot.b, imgB);
          slot.ib = ib;
        }
        slot.frac = frac;
      } else {
        // only one frame to go on: hold on it rather than blending toward junk
        slot.ib = -1;
        slot.frac = 0;
      }
    },

    /**
     * Forget what a slot is holding.
     *
     * Needed when a frame is replaced by a sharper copy of the same frame: the
     * index has not changed, so nothing downstream would otherwise notice there
     * are new pixels to send.
     */
    invalidate(index: number) {
      const slot = slots[index];
      if (!slot) return;
      slot.ia = -1;
      slot.ib = -1;
    },

    resize(cssW: number, cssH: number, dpr: number) {
      const w = Math.max(1, Math.round(cssW * dpr));
      const h = Math.max(1, Math.round(cssH * dpr));
      if (canvas.width === w && canvas.height === h) return;
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    },

    render(s: StageState, time: number) {
      if (lost || slots.length === 0) return;
      const A = slots[Math.min(s.from, slots.length - 1)];
      const B = slots[Math.min(s.to, slots.length - 1)];

      const viewAspect = canvas.width / canvas.height;

      /* Cover-fit: scale the axis that would otherwise letterbox. */
      const fit = (texAspect: number): [number, number] =>
        texAspect > viewAspect ? [texAspect / viewAspect, 1] : [1, viewAspect / texAspect];

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, A.a);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, A.ib < 0 ? A.a : A.b);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, B.a);
      gl.activeTexture(gl.TEXTURE3);
      gl.bindTexture(gl.TEXTURE_2D, B.ib < 0 ? B.a : B.b);

      gl.uniform1f(U.fa, A.ib < 0 ? 0 : A.frac);
      gl.uniform1f(U.fb, B.ib < 0 ? 0 : B.frac);
      gl.uniform2f(U.res, canvas.width, canvas.height);
      gl.uniform2fv(U.aspectA, fit(A.aspect[0]));
      gl.uniform2fv(U.aspectB, fit(B.aspect[0]));
      gl.uniform2f(U.pan, s.pan[0], s.pan[1]);
      gl.uniform1f(U.zoom, s.zoom);
      gl.uniform1f(U.mix, s.mix);
      gl.uniform3fv(U.groundA, A.ground);
      gl.uniform3fv(U.groundB, B.ground);
      gl.uniform1f(U.cell, s.cell);
      gl.uniform1f(U.grain, 0.028);
      gl.uniform1f(U.time, time);
      gl.uniform1f(U.trans, s.trans);

      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },

    destroy() {
      canvas.removeEventListener("webglcontextlost", onLost);
      slots.forEach((s) => {
        gl.deleteTexture(s.a);
        gl.deleteTexture(s.b);
      });
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
    },
  };
}

export type Stage = NonNullable<ReturnType<typeof createStage>>;
