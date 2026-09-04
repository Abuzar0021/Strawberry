"use client";

/**
 * The stage renderer.
 *
 * One quad, two plate textures, and a dissolve that breaks the image into
 * printing dots on its way from one plate to the next. The dot pass is the
 * signature of the whole site: at rest a plate is just a painting, but while it
 * is handing over it shatters into halftone against the flat ground colour, the
 * way a duotone separation looks when the screen is too coarse.
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

uniform sampler2D uA;
uniform sampler2D uB;
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

void main() {
  vec2 uvA = cover(vUv, uAspectA, uZoom, uPan);
  vec2 uvB = cover(vUv, uAspectB, uZoom, uPan * 1.14);

  /* ---- bridge -------------------------------------------------------
     A filmed transition already contains the whole handover, so the stage
     gets out of the way: one texture, cover-fitted, no blend and no halftone.
     Anything else here would be a second effect fighting the first. */
  if (uTrans > 2.5) {
    /* A plain crossfade, used only to ease a bridge clip in and out against
       the plates on either side. A bridge is generated separately from the
       plate clips, so its first and last frames rarely match theirs exactly;
       cutting straight to one shows that mismatch as a jump. */
    vec3 pa = texture2D(uA, clamp(uvA, 0.001, 0.999)).rgb;
    vec3 pb = texture2D(uB, clamp(uvB, 0.001, 0.999)).rgb;
    vec3 mixed = mix(pa, pb, clamp(uMix, 0.0, 1.0));
    float gx = hash(vUv * uRes + fract(uTime) * 91.0) - 0.5;
    gl_FragColor = vec4(mixed + gx * uGrain, 1.0);
    return;
  }

  if (uTrans > 1.5 && uTrans < 2.5) {
    vec3 cb = texture2D(uA, clamp(uvA, 0.001, 0.999)).rgb;
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
    vec2 sa = (uvA - 0.5) * (1.0 - k * 0.92) + 0.5;
    vec2 sb = (uvB - 0.5) * (0.25 + k * 0.75) + 0.5;
    vec3 ca = texture2D(uA, clamp(sa, 0.001, 0.999)).rgb;
    vec3 cb = texture2D(uB, clamp(sb, 0.001, 0.999)).rgb;

    vec3 outCol = mix(ca, cb, k);
    float g0 = hash(vUv * uRes + fract(uTime) * 91.0) - 0.5;
    gl_FragColor = vec4(outCol + g0 * uGrain, 1.0);
    return;
  }

  vec3 a = texture2D(uA, clamp(uvA, 0.001, 0.999)).rgb;
  vec3 b = texture2D(uB, clamp(uvB, 0.001, 0.999)).rgb;

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
  /** 0 = halftone dissolve, 1 = iris. */
  trans: number;
};

type Slot = {
  tex: WebGLTexture;
  aspect: [number, number];
  ground: [number, number, number];
  /** Set when this slot is being driven by a clip rather than a still. */
  video: HTMLVideoElement | null;
  /** A new video frame is waiting to be pushed to the texture. */
  pending: boolean;
};

/** `requestVideoFrameCallback` is not in every lib.dom yet. */
type FrameVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: () => void) => number;
};

const sizeOf = (source: TexImageSource): [number, number] =>
  "videoWidth" in source
    ? [(source as HTMLVideoElement).videoWidth, (source as HTMLVideoElement).videoHeight]
    : [(source as HTMLImageElement).width, (source as HTMLImageElement).height];

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
    A: u("uA"),
    B: u("uB"),
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
  gl.uniform1i(U.A, 0);
  gl.uniform1i(U.B, 1);

  const slots: Slot[] = [];
  let lost = false;

  const onLost = (e: Event) => {
    e.preventDefault();
    lost = true;
  };
  canvas.addEventListener("webglcontextlost", onLost);

  /** Pushes the current contents of `source` into a slot's texture. */
  function write(slot: Slot, source: TexImageSource) {
    gl!.bindTexture(gl!.TEXTURE_2D, slot.tex);
    gl!.pixelStorei(gl!.UNPACK_FLIP_Y_WEBGL, 1);
    gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGB, gl!.RGB, gl!.UNSIGNED_BYTE, source);
    const [w, h] = sizeOf(source);
    if (w && h) slot.aspect = [w / h, 1];
  }

  function upload(source: TexImageSource, groundHex: string): Slot {
    const tex = gl!.createTexture()!;
    gl!.bindTexture(gl!.TEXTURE_2D, tex);
    // NPOT-safe: clamp + linear, no mips
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);
    const slot: Slot = { tex, aspect: [1, 1], ground: hexToRgb(groundHex), video: null, pending: false };
    write(slot, source);
    return slot;
  }

  return {
    /** Uploads the whole plate set once; order matches `PLATES`. */
    setPlates(sources: { source: TexImageSource; ground: string }[]) {
      slots.length = 0;
      for (const s of sources) slots.push(upload(s.source, s.ground));
    },

    /**
     * Swaps a settled still for its moving version.
     *
     * The clip drives the slot from here on. Uploads are gated on
     * `requestVideoFrameCallback` so the texture is only rewritten when the
     * decoder actually produces a frame - a 24fps clip on a 120Hz display
     * would otherwise be re-uploaded five times per frame it has.
     */
    setMotion(index: number, video: HTMLVideoElement, onFrame?: () => void) {
      const slot = slots[index];
      if (!slot) return;
      slot.video = video;
      write(slot, video);
      const rvfc = (video as FrameVideo).requestVideoFrameCallback;
      if (rvfc) {
        /* `onFrame` has to wake the host's render loop. A decoded frame that
           nobody draws is invisible, and on a scrubbed plate the loop is
           asleep by the time a seek lands - so without this every frame on
           screen is one seek behind, and letting go of the wheel leaves you
           looking at a stale one. */
        const pump = () => {
          slot.pending = true;
          onFrame?.();
          (video as FrameVideo).requestVideoFrameCallback?.(pump);
        };
        rvfc.call(video, pump);
      } else {
        // no frame callback: fall back to uploading on every render
        slot.pending = true;
      }
    },

    hasPlates: () => slots.length > 0,

    /**
     * Appends an empty slot and returns its index.
     *
     * Bridge clips are not plates - they belong to a handover rather than to a
     * chapter - so they get their own slots past the end of the plate list
     * rather than being squeezed into it.
     */
    addSlot(groundHex: string) {
      const tex = gl!.createTexture()!;
      gl!.bindTexture(gl!.TEXTURE_2D, tex);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);
      // one black pixel until the clip decodes its first frame
      gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGB, 1, 1, 0, gl!.RGB, gl!.UNSIGNED_BYTE,
        new Uint8Array([0, 0, 0]));
      slots.push({ tex, aspect: [16 / 9, 1], ground: hexToRgb(groundHex), video: null, pending: false });
      return slots.length - 1;
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

      /* Only the two slots actually on screen are refreshed. Pushing nine
         full-frame video textures per frame to show two of them is the kind of
         cost that shows up as a warm laptop and nothing else. */
      for (const slot of [A, B]) {
        if (!slot.video || slot.video.readyState < 2) continue;
        if (!slot.pending && (slot.video as FrameVideo).requestVideoFrameCallback) continue;
        write(slot, slot.video);
        slot.pending = false;
      }

      const viewAspect = canvas.width / canvas.height;

      /* Cover-fit: scale the axis that would otherwise letterbox. */
      const fit = (texAspect: number): [number, number] =>
        texAspect > viewAspect ? [texAspect / viewAspect, 1] : [1, viewAspect / texAspect];

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, A.tex);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, B.tex);

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
      slots.forEach((s) => gl.deleteTexture(s.tex));
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
    },
  };
}

export type Stage = NonNullable<ReturnType<typeof createStage>>;
