"use client";

import { useScene } from "@/hooks/strawberry/useScene";
import { revealLines, revealBlocks } from "@/lib/strawberryReveal";
import { Lines } from "./Split";
import { BEATS } from "@/data/strawberry";

/**
 * Chapter one, one beat at a time.
 *
 * Three near-identical scenes over three plates: the argument is carried by the
 * paintings changing underneath a sentence that keeps the same shape. Anything
 * that varied the layout between beats would break the repetition that makes
 * the three read as one claim.
 */
export function BeatScene({
  index,
  range,
}: {
  index: number;
  range: readonly number[];
}) {
  const beat = BEATS[index];
  const ref = useScene<HTMLDivElement>(range, ({ t, el }) => {
    revealLines(el, t, 0.44);
    revealBlocks(el, t - 0.05, 0.48);
  });

  return (
    <div className="layer" ref={ref}>
      <div className="col" style={{ top: "50%" }}>
        <Lines lines={beat.headline} className="t-beat" as="h2" />
      </div>
      <div
        className="col flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-[clamp(24px,6vw,86px)]"
        style={{ top: "72%" }}
      >
        <span className="chip t-mono shrink-0" data-rise>
          {beat.badge}
        </span>
        <p className="t-stand" data-rise>
          {beat.stand}
        </p>
      </div>
    </div>
  );
}
