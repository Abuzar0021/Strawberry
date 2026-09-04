"use client";

import { useScene } from "@/hooks/strawberry/useScene";
import { revealBlocks, revealLines } from "@/lib/strawberryReveal";
import { BRAND, SCENES } from "@/data/strawberry";

/**
 * The close.
 *
 * The wordmark lands last, over the plate where the bed is finally bearing.
 * The lambda standing in for the "a" is the site's one joke, and it only works
 * because nothing else here is playful - so it is kept, and it survives the
 * longer name because the "a" sits near the middle either way.
 */
export function CloseScene() {
  const ref = useScene<HTMLDivElement>(
    SCENES.footer,
    ({ t, el }) => {
      revealBlocks(el, t, 0.5);
      revealLines(el, t - 0.04, 0.44);
    },
    { drift: 18 }
  );

  return (
    <div className="layer" ref={ref}>
      <div className="absolute inset-x-0 top-[16%] text-center">
        <p className="wordmark" data-rise>
          <span className="sr-only">{BRAND.name}</span>
          <span aria-hidden="true">
            str<span className="lam">λ</span>wberry.
          </span>
        </p>

        <p className="t-subhead mx-auto mt-[clamp(2rem,14vh,9rem)] max-w-[22em] opacity-95">
          <span className="sr-only">{BRAND.tagline}</span>
          <span aria-hidden="true">
            <span className="ln">
              <i>Not an agency on the clock, a</i>
            </span>
            <span className="ln">
              <i>partner in the upside.</i>
            </span>
          </span>
        </p>
      </div>

      <div
        className="t-mono absolute inset-x-[var(--v1)] bottom-[8%] flex flex-wrap justify-between gap-4 opacity-75"
        data-rise
      >
        <span>{BRAND.org}</span>
        <a href={`mailto:${BRAND.email}`} className="underline-offset-4 hover:underline">
          {BRAND.email.toUpperCase()}
        </a>
      </div>
    </div>
  );
}
