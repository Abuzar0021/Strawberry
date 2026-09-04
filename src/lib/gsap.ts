"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ ease: "power3.out" });
  // coalesce callbacks to one per tick instead of one per scroll event
  ScrollTrigger.config({ limitCallbacks: true, ignoreMobileResize: true });
}

export { gsap, ScrollTrigger };

/** SSR-safe layout effect. */
export const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : () => {};

/**
 * Scopes every tween and ScrollTrigger created inside `setup` to a container
 * and reverts them on unmount — the single cleanup path for the whole site.
 */
export function useGsapScope<T extends HTMLElement>(
  setup: (api: { self: T; mm: gsap.MatchMedia; ctx: gsap.Context }) => void,
  deps: unknown[] = []
): RefObject<T | null> {
  const ref = useRef<T | null>(null);

  useIsoLayoutEffect(() => {
    const self = ref.current;
    if (!self) return;
    const mm = gsap.matchMedia();
    // `ctx` is handed to the setup so work that has to wait — for fonts, for a
    // measurement — can still be registered inside the scope and reverted with it
    const ctx = gsap.context((c: gsap.Context) => setup({ self, mm, ctx: c }), self);
    return () => {
      mm.revert();
      ctx.revert();
    };
  }, deps);

  return ref;
}

export const BREAKPOINTS = {
  motion: "(prefers-reduced-motion: no-preference)",
  still: "(prefers-reduced-motion: reduce)",
  desktop: "(min-width: 1024px) and (prefers-reduced-motion: no-preference)",
  handheld: "(max-width: 1023px) and (prefers-reduced-motion: no-preference)",
} as const;
