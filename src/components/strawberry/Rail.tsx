"use client";

import { useEffect, useRef } from "react";
import { subscribeStage } from "@/hooks/strawberry/useStrawberryScrub";
import { CHAPTERS, SCENES } from "@/data/strawberry";

/**
 * The chapter rail.
 *
 * The only persistent navigation on the site, and the only affordance that
 * admits the page has parts. It marks the current chapter rather than linking to
 * anchors, because there are no anchors - every "section" is a window on one
 * playhead, so a chapter is a position to seek to.
 */
export function Rail({ seek }: { seek: (p: number) => void }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const buttons = Array.from(el.querySelectorAll<HTMLButtonElement>("button"));
    let current = -1;

    return subscribeStage((p) => {
      /* Past the last chapter the rail has nothing left to count, and the
         application sits in the same column it does. It stands down. */
      const done = p > SCENES.apply[0] - 0.03;
      el.style.opacity = done ? "0" : "1";
      // opacity alone still leaves four buttons in the tab order
      el.inert = done;

      // the last chapter whose start we have passed, or none at all - the
      // hero sits before chapter one and should not light it up
      let next = -1;
      for (let i = 0; i < CHAPTERS.length; i++) if (p >= CHAPTERS[i].at) next = i;
      if (next === current) return;
      current = next;
      buttons.forEach((b, i) => b.setAttribute("data-on", i === next ? "1" : "0"));
    });
  }, []);

  return (
    <nav className="rail" ref={ref} aria-label="Chapters">
      {CHAPTERS.map((c) => (
        <button
          key={c.n}
          type="button"
          data-on="0"
          onClick={() => seek(c.at + 0.02)}
          aria-label={`Chapter ${c.n}, ${c.label}`}
        >
          <span className="tick" aria-hidden="true" />
          <span className="label t-mono">
            <span className="opacity-55">Ch. {c.n}</span>
            <span className="ml-2">{c.label}</span>
          </span>
        </button>
      ))}
    </nav>
  );
}
