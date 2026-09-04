"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { registerLenis } from "@/lib/scroll";

/**
 * Lenis drives the scroll; GSAP's ticker drives Lenis; ScrollTrigger reads
 * Lenis. One clock, so pinned sections never drift out of step with the
 * smoothed scroll position.
 */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const lenis = new Lenis({
      duration: 1.05,
      // long, shallow tail: physical without feeling like the page is on a delay
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      touchMultiplier: 1.6,
      syncTouch: false,
    });

    registerLenis(lenis);
    lenis.on("scroll", ScrollTrigger.update);

    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    // Layout is measured from text metrics, and those change the moment the
    // display face swaps in. Triggers computed against the fallback font are
    // simply wrong, so re-measure once the real fonts have landed.
    document.fonts?.ready.then(() => ScrollTrigger.refresh());

    // Nothing should keep decoding in a background tab. rAF already stops, but
    // playing video does not.
    const onVisibility = () => {
      const hidden = document.hidden;
      document.querySelectorAll("video").forEach((v) => {
        if (hidden) v.pause();
        else if (v.dataset.ambient === "true") void v.play().catch(() => {});
      });
      if (hidden) lenis.stop();
      else lenis.start();
    };
    document.addEventListener("visibilitychange", onVisibility);

    ScrollTrigger.refresh();

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      gsap.ticker.remove(raf);
      registerLenis(null);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
