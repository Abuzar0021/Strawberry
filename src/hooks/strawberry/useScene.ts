"use client";

import { useEffect, useRef, type RefObject } from "react";
import { subscribeStage, sceneAlpha, within, isStill } from "./useStrawberryScrub";

type Frame = (ctx: { t: number; alpha: number; el: HTMLElement }) => void;

/**
 * Binds a layer to its window on the playhead.
 *
 * Every scene wants the same three things — fade in, drift past, fade out — and
 * then something of its own. The shared part lives here so nine layers cannot
 * drift into nine slightly different fades, and `onFrame` gets the local 0–1 for
 * whatever the scene does beyond that.
 *
 * `inert` matters more than it looks: a layer at zero opacity still holds
 * focusable controls, and tabbing into an invisible "Request Partnership" that
 * sits three chapters back is a real way to lose a keyboard user.
 */
export function useScene<T extends HTMLElement>(
  range: readonly number[],
  onFrame?: Frame,
  opts: { drift?: number; fade?: number; fadeIn?: number } = {}
): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const frame = useRef<Frame | undefined>(onFrame);
  frame.current = onFrame;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const drift = opts.drift ?? 34;
    const fade = opts.fade ?? 0.16;
    const fadeIn = opts.fadeIn ?? fade;
    let wasVisible: boolean | null = null;

    return subscribeStage((p) => {
      // In document mode the layer is laid out by CSS and must be left alone.
      if (isStill()) return;
      const alpha = sceneAlpha(p, range, fade, fadeIn);
      const visible = alpha > 0.002;

      if (visible !== wasVisible) {
        wasVisible = visible;
        el.inert = !visible;
        // a layer that is not on screen should not be composited at all
        el.style.visibility = visible ? "visible" : "hidden";
      }
      if (!visible) return;

      const t = within(p, range);
      el.style.opacity = String(alpha);
      el.style.transform = `translate3d(0, ${(0.5 - t) * drift}px, 0)`;
      frame.current?.({ t, alpha, el });
    });
    // ranges are module constants; re-subscribing on every render would churn
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return ref;
}

/**
 * Staggered reveal for a set of split elements.
 *
 * Returns the transform for item `i` of `n` given the scene's local progress.
 * The stagger is spread over the first `span` of the window, so the last
 * character has landed well before the scene starts leaving.
 */
export function stagger(t: number, i: number, n: number, span = 0.34, per = 0.55) {
  const step = (span * (1 - per)) / Math.max(1, n - 1);
  const local = (t - i * step) / (span * per);
  return local < 0 ? 0 : local > 1 ? 1 : local * local * (3 - 2 * local);
}
