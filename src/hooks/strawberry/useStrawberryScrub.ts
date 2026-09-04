"use client";

import { useEffect, type RefObject } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";

type Listener = (progress: number, velocity: number) => void;

const listeners = new Set<Listener>();
const frameHooks = new Set<() => void>();
let smoothed = 0;
let velocity = 0;
let stillMode = false;

/**
 * Whether the stage has stood down into an ordinary document.
 *
 * Reduced motion decides this before anything mounts; a missing WebGL context
 * decides it a beat later, once the renderer has tried and failed. Either way
 * the layers must stop driving their own opacity, or they will keep hiding
 * themselves in a page that no longer has a playhead to reveal them with.
 */
export const isStill = () => stillMode;
export const setStill = (v: boolean) => {
  stillMode = v;
};

/** Latest smoothed playhead, 0–1 across the whole runway. */
export const getStageProgress = () => smoothed;

/**
 * Subscribe to the playhead.
 *
 * Every layer on the stage - the WebGL plates, each copy scene, the chapter
 * rail, the FAQ carousel - reads this one value instead of owning a
 * ScrollTrigger of its own. Nine triggers measuring the same pinned element is
 * nine chances to disagree by a frame, and on a stage where the copy sits over
 * the artwork that disagreement is visible as the type sliding against the
 * plate.
 *
 * Deliberately not React state: at 120Hz this fires on every tick, and a
 * setState per tick would re-render nine layers to move a transform.
 */
export function subscribeStage(fn: Listener) {
  listeners.add(fn);
  fn(smoothed, velocity);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * Runs every frame, immediately after the playhead has been published.
 *
 * The renderer needs this rather than a ticker of its own. GSAP runs its
 * callbacks in the order they were added, and React runs effects children
 * first, so the canvas was registering its draw ahead of both the scroll
 * smoothing and the playhead - drawing the frame before last, every frame, for
 * about thirty milliseconds of lag that no amount of easing can hide. Ordering
 * that by hand across three components is the kind of thing that silently comes
 * undone; letting the clock's owner call the renderer cannot.
 */
export function onStageFrame(fn: () => void) {
  frameHooks.add(fn);
  return () => {
    frameHooks.delete(fn);
  };
}

/**
 * The stiffness of the spring that carries the playhead, in radians per second.
 *
 * A spring rather than the exponential lerp this used to be, because a spring
 * is the better filter at equal latency and this stage needs both.
 *
 * A wheel is a discrete device - a notch every forty or fifty milliseconds -
 * and a scroll chain has to turn that into continuous motion without putting
 * itself between your hand and the page. A one-pole lerp rolls off at 6dB an
 * octave, so buying another 10dB of ripple rejection costs three times the
 * settling time; the old one was set heavy enough to be smooth and was
 * therefore also slow. A critically damped spring rolls off at 12dB, and
 * carries velocity as state so velocity cannot jump when the target does.
 *
 * At 12 rad/s it attenuates the wheel's own ripple about 14dB harder than the
 * lerp it replaces while settling in 390ms rather than 560ms. Smoother and
 * more responsive, rather than a trade between them.
 */
const STIFFNESS = 12;

/**
 * Drives the playhead from the stage element.
 *
 * ScrollTrigger reports the position Lenis has smoothed to; the spring carries
 * the value everything else consumes, so a flicked trackpad cannot jump a whole
 * chapter between two frames and the dissolve keeps running for a moment after
 * the wheel stops.
 *
 * Integrated against elapsed time rather than per frame. A per-frame constant
 * converges twice as fast on a 120Hz display as on a 60Hz one, so the site
 * would literally feel different on two machines sitting next to each other.
 */
export function useStageScrub(stage: RefObject<HTMLElement | null>, stiffness = STIFFNESS) {
  useEffect(() => {
    const el = stage.current;
    if (!el) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let target = 0;
    let vel = 0;

    const st = ScrollTrigger.create({
      trigger: el,
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => {
        target = self.progress;
      },
    });

    // seed from wherever the browser restored the scroll to, so a reload
    // part-way down does not replay the whole runway from the hero
    target = st.progress;
    smoothed = st.progress;

    const tick = (_t: number, dt: number) => {
      const prev = smoothed;
      if (reduced) {
        smoothed = target;
        vel = 0;
      } else {
        // semi-implicit Euler, and the step is capped so a dropped frame
        // cannot hand the integrator a jolt it turns into an overshoot
        const h = Math.min(dt, 34) / 1000;
        vel += (-2 * stiffness * vel - stiffness * stiffness * (smoothed - target)) * h;
        smoothed += vel * h;
        if (Math.abs(target - smoothed) < 2e-6 && Math.abs(vel) < 4e-5) {
          smoothed = target;
          vel = 0;
        }
      }
      velocity = smoothed - prev;
      if (smoothed !== prev) listeners.forEach((fn) => fn(smoothed, velocity));
      // the renderer draws here, with the playhead it was just given
      frameHooks.forEach((fn) => fn());
    };

    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
      st.kill();
      // a second mount (fast refresh, route re-entry) must not inherit a
      // playhead from the instance that just died
      smoothed = 0;
      velocity = 0;
    };
  }, [stage, stiffness]);
}

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Local 0–1 progress of `p` inside a scene window. */
export const within = (p: number, range: readonly [number, number] | readonly number[]) =>
  clamp01((p - range[0]) / (range[1] - range[0]));

/** Smoothstep, the only easing the layers need once the playhead is eased. */
export const smoothstep = (t: number) => {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
};

/**
 * Opacity for a scene: up over the first `fadeIn` of its window, down over the
 * last `fade`. Returns 0 outside, which is what lets a layer switch itself
 * `inert`.
 *
 * The two are separable because of the hero: its window opens at zero, so a
 * symmetric fade would leave the opening statement invisible until the visitor
 * scrolled. It wants `fadeIn: 0` and an entrance of its own.
 */
export function sceneAlpha(
  p: number,
  range: readonly number[],
  fade = 0.16,
  fadeIn = fade
) {
  if (p < range[0] || p > range[1]) return 0;
  const t = within(p, range);
  const rise = fadeIn <= 0 ? 1 : t / fadeIn;
  const fall = fade <= 0 ? 1 : (1 - t) / fade;
  return smoothstep(Math.min(rise, fall, 1));
}
