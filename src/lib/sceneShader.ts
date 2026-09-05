"use client";

/**
 * The transition shader.
 *
 * Two video textures and one mix. Scroll drives `uProgress`, which is 0 while
 * scene A is settled, runs to 1 across a handover, and resets. Time drives
 * `uTime`, which never stops - the picture has to stay alive when the scroll
 * does, or the page looks frozen rather than paused.
 *
 * The two effects are deliberately separate. The handover is a datamosh: the
 * frame is quantised into blocks and each block's UV is thrown by a per-block
 * random, with the three colour channels thrown by different amounts so the
 * displacement smears into red and cyan at the edges. The idle is a slow
 * simplex swell, an order of magnitude smaller, which reads as the surface
 * breathing rather than as anything happening.
 */

export const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const FRAG = /* glsl */ `
precision highp float;

varying vec2 vUv;

/* Two textures, always. Which video is bound to which flips as the sequence
   advances - a ping-pong, so nothing is ever created or destroyed mid-blend
   and there is no frame where a slot is empty. */
uniform sampler2D u_texCurrent;
uniform sampler2D u_texNext;
uniform vec2  uResolution;   // drawing buffer, px
uniform vec2  uAspectA;      // cover-fit scale per texture
uniform vec2  uAspectB;

/* The overlay layer, used only where two films are meant to sit on top of one
   another rather than follow one another. Zero mix everywhere else, so it
   costs one texture fetch and nothing else. */
uniform sampler2D u_texOverlay;
uniform vec2  uAspectOverlay;
uniform float uOverlayMix;
uniform float uProgress;     // 0 settled on A, 1 settled on B
uniform float uTime;         // seconds, never paused
uniform float uBlock;        // datamosh block size, px
uniform float uSplit;        // chromatic aberration, uv
uniform float uBreath;       // idle swell amplitude, uv

/* --- simplex noise (Ashima / Gustavson, 2D) -------------------------- */
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                     -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                        + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy),
                          dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

/* Cover-fit, so a 16:9 source fills any viewport with the minimum crop and
   nothing else. No zoom, no pan: the only crop is the one the aspect forces. */
vec2 cover(vec2 uv, vec2 aspect) {
  /* Over-scaled by a hair so the displacement never reaches the outermost row
     of the texture. Clamping there smears the edge pixel into a bar, which on
     a mosh block reads as a hole punched in the frame rather than as glitch. */
  return (uv - 0.5) / (aspect * 1.02) + 0.5;
}

void main() {
  /* ---- idle ---------------------------------------------------------
     A slow two-octave swell that runs whether or not the scroll is moving.
     Amplitude is a few thousandths of the frame - enough that the surface is
     never completely still, small enough that you would not call it motion. */
  float sw = snoise(vUv * 2.6 + uTime * 0.10)
           + snoise(vUv * 5.7 - uTime * 0.07) * 0.5;
  vec2 breath = vec2(sw, snoise(vUv * 3.1 - uTime * 0.08)) * uBreath;

  /* ---- datamosh -----------------------------------------------------
     Strongest halfway through the handover and zero at both ends, so a settled
     scene is never displaced. The frame is quantised into blocks and each
     block is thrown by its own random - the quantisation is what makes it read
     as a codec losing its reference frame rather than as a blur. */
  float m = sin(clamp(uProgress, 0.0, 1.0) * 3.14159265);
  float mosh = m * m;

  vec2 blocks = floor(vUv * uResolution / max(uBlock, 2.0));
  vec2 kick = vec2(hash(blocks), hash(blocks + 37.0)) - 0.5;
  // the vertical throw is the smaller one; an even scatter reads as noise
  kick.y *= 0.45;
  // strong enough to read as a codec dropping its reference frame, not so
  // strong that the picture stops being a picture
  vec2 shove = kick * mosh * 0.10;

  // channels are thrown by different amounts, which is the aberration
  float split = uSplit * mosh;

  vec2 uvA = cover(vUv + breath + shove, uAspectA);
  vec2 uvB = cover(vUv + breath + shove * -0.7, uAspectB);

  vec3 a, b;
  a.r = texture2D(u_texCurrent, clamp(uvA + vec2( split, 0.0), 0.001, 0.999)).r;
  a.g = texture2D(u_texCurrent, clamp(uvA,                      0.001, 0.999)).g;
  a.b = texture2D(u_texCurrent, clamp(uvA + vec2(-split, 0.0), 0.001, 0.999)).b;
  b.r = texture2D(u_texNext,    clamp(uvB + vec2(-split, 0.0), 0.001, 0.999)).r;
  b.g = texture2D(u_texNext,    clamp(uvB,                      0.001, 0.999)).g;
  b.b = texture2D(u_texNext,    clamp(uvB + vec2( split, 0.0), 0.001, 0.999)).b;

  /* The layered section. Screen rather than a straight add: adding two bright
     classical plates together clips to white across most of the frame, where
     screen keeps the highlights and still reads as light on light. */
  if (uOverlayMix > 0.001) {
    vec2 uvO = cover(vUv + breath + shove * 0.5, uAspectOverlay);
    vec3 o = texture2D(u_texOverlay, clamp(uvO, 0.001, 0.999)).rgb;
    a = mix(a, 1.0 - (1.0 - a) * (1.0 - o), uOverlayMix);
  }

  /* The wipe is per-block too, so scenes trade place in slabs rather than by
     fading. A block's threshold is its own random, spread around the progress,
     which means at any moment some blocks have already switched and some have
     not - that is the mosh, and it is why this never reads as a crossfade. */
  /* The threshold has to travel past both ends of the range the blocks occupy,
     or some of them never commit and a faint checker of the other film is left
     behind on a settled scene. */
  float edge = uProgress * 1.9 - 0.45;
  float t = smoothstep(edge - 0.42, edge + 0.42, hash(blocks + 11.0) * 0.55 + vUv.x * 0.45);
  vec3 col = mix(b, a, t);

  // a little brightening at the peak, the way a dropped frame flashes
  col += mosh * 0.05;

  gl_FragColor = vec4(col, 1.0);
}
`;
