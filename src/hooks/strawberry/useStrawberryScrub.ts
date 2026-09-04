"use client";

import { useEffect, type RefObject } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";

type Listener = (progress: number, velocity: number) => void;

const listeners = new Set<Listener>();
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
 * Drives the playhead from the stage element.
 *
 * ScrollTrigger reports the raw position; a lerp on GSAP's ticker eases the
 * value everything else consumes. That easing is the difference between the
 * plates cross-dissolving like film and stepping like a slider - the dissolve
 * keeps running for a moment after the wheel stops, and a flicked trackpad
 * cannot jump a whole chapter in one tick.
 */
export function useStageScrub(stage: RefObject<HTMLElement | null>, lerp = 0.085) {
  useEffect(() => {
    const el = stage.current;
    if (!el) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let target = 0;

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

    const tick = () => {
      const prev = smoothed;
      smoothed = reduced ? target : smoothed + (target - smoothed) * lerp;
      if (Math.abs(target - smoothed) < 0.00002) smoothed = target;
      velocity = smoothed - prev;
      if (smoothed !== prev || velocity !== 0) listeners.forEach((fn) => fn(smoothed, velocity));
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
  }, [stage, lerp]);
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
