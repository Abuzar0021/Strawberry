"use client";

import type Lenis from "lenis";

let instance: Lenis | null = null;

export const registerLenis = (l: Lenis | null) => {
  instance = l;
};

export const getLenis = () => instance;

/**
 * Navigate to a chapter.
 *
 * Two things this avoids:
 *
 * 1. Native `scrollIntoView({ behavior: "smooth" })` runs the browser's own
 *    animation while Lenis is driving `scrollTop` from its rAF loop. The two
 *    fight, and the page stutters or lands short. When Lenis owns the scroll,
 *    it has to perform the jump.
 *
 * 2. Handing Lenis the element and letting it resolve the offset itself landed
 *    every chapter a consistent 208px short here. Passing an absolute position
 *    computed at call time is unambiguous, and a correction pass afterwards
 *    absorbs any layout the pinned sections shifted while the scroll was in
 *    flight.
 */
export function scrollToChapter(id: string) {
  const el = document.getElementById(id);
  if (!el) return;

  const positionOf = () => Math.round(el.getBoundingClientRect().top + window.scrollY);

  if (!instance) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  instance.scrollTo(positionOf(), {
    duration: 1.3,
    onComplete: () => {
      const drift = Math.round(el.getBoundingClientRect().top);
      if (Math.abs(drift) > 2) instance?.scrollTo(window.scrollY + drift, { duration: 0.35 });
    },
  });
}
