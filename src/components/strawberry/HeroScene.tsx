"use client";

import { useEffect, useRef } from "react";
import { useScene } from "@/hooks/strawberry/useScene";
import { revealChars, revealBlocks } from "@/lib/strawberryReveal";
import { Chars } from "./Split";
import { HERO, SCENES } from "@/data/strawberry";

/** How long the opening statement takes to assemble, in ms. */
const INTRO = 1400;

/**
 * The opening statement.
 *
 * The headline is the only place on the site that splits to characters. At
 * 7.6rem the letters are large enough to read as objects arriving one at a
 * time; everywhere else the same treatment would read as a slot machine, which
 * is why every other scene splits to lines instead.
 *
 * This is also the one scene whose entrance is on a clock rather than on the
 * playhead. Its window opens at progress zero, so there is no scroll available
 * to reveal it with — a visitor who never touches the wheel has to be looking at
 * a finished page. Scroll only takes over for the exit.
 */
export function HeroScene({ onApply }: { onApply: () => void }) {
  const intro = useRef(0);

  const ref = useScene<HTMLDivElement>(
    SCENES.hero,
    ({ t, el }) => {
      // The reveal only ever moves forward: once the clock has opened it,
      // scrolling back up must not take the headline apart again.
      const k = Math.max(intro.current, t);
      revealChars(el, k, 0.5);
      revealBlocks(el, k - 0.06, 0.5);
    },
    { drift: 26, fadeIn: 0, fade: 0.22 }
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    let start = 0;
    let cancelled = false;

    const step = (now: number) => {
      if (cancelled) return;
      if (!start) start = now;
      // 0.62 rather than 1: the reveal spans the first half of the scene
      // window, so that is where "finished" sits on the same scale.
      intro.current = Math.min(1, (now - start) / INTRO) * 0.62;
      revealChars(el, intro.current, 0.5);
      revealBlocks(el, intro.current - 0.06, 0.5);
      if (intro.current < 0.62) raf = requestAnimationFrame(step);
    };

    // Splitting measures nothing, but the characters still shift when the
    // display face swaps in — starting after it lands keeps the stagger from
    // running twice over two different sets of positions.
    const kick = () => {
      if (!cancelled) raf = requestAnimationFrame(step);
    };
    if (document.fonts?.ready) void document.fonts.ready.then(kick);
    else kick();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [ref]);

  return (
    <div className="layer" ref={ref}>
      <div className="col col-wide" style={{ top: "34%" }}>
        <h1 className="t-display">
          <Chars text={HERO.headline} />
        </h1>

        <p className="t-subhead mt-[clamp(10px,1.35vw,23px)] opacity-90" data-rise>
          {HERO.subhead.map((line) => (
            <span className="block" key={line}>
              {line}
            </span>
          ))}
        </p>

        <button
          type="button"
          className="cta t-mono mt-[clamp(22px,2.6vw,44px)]"
          onClick={onApply}
          data-rise
        >
          {HERO.cta}
          <span className="arw" aria-hidden="true">
            →
          </span>
        </button>
      </div>

      {/* The standfirst sits below the fold line, where the reference build puts
          the sentence that actually explains the business. */}
      <div
        className="col flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-[clamp(24px,6vw,86px)]"
        style={{ top: "78%" }}
      >
        <span className="chip t-mono shrink-0" data-rise>
          {HERO.badge}
        </span>
        <p className="t-stand" data-rise>
          {HERO.stand}
        </p>
      </div>
    </div>
  );
}
