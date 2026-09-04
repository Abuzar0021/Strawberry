"use client";

import { useScene } from "@/hooks/strawberry/useScene";
import { nodes, revealLines } from "@/lib/strawberryReveal";
import { smoothstep, clamp01 } from "@/hooks/strawberry/useStrawberryScrub";
import { SCENES, TERMS } from "@/data/strawberry";

/**
 * Chapter three: the terms, in two panels.
 *
 * The headline sits at the top of the frame and the fine print at the bottom,
 * with the plate visible between them. That gap is the point — this is the
 * chapter where the site is asking to be trusted, so it leaves the commercial
 * terms uncrowded rather than packing them into a card.
 */
export function TermsScene() {
  const ref = useScene<HTMLDivElement>(
    SCENES.terms,
    ({ t, el }) => {
      const panels = nodes(el, "[data-f]");
      const per = 1 / panels.length;

      panels.forEach((panel, i) => {
        const local = clamp01((t - i * per) / per);
        const a =
          t < i * per || t > (i + 1) * per
            ? 0
            : smoothstep(Math.min(local / 0.22, (1 - local) / 0.22, 1));
        panel.style.opacity = String(a);
        panel.inert = a < 0.02;
        // The panel holds for a long time; the headline should not still be
        // arriving a third of the way through it.
        if (a > 0.002) revealLines(panel, local, 0.3);
      });
    },
    { drift: 0, fade: 0.1 }
  );

  return (
    <div className="layer" ref={ref}>
      {TERMS.map((panel, i) => (
        <div key={i} data-f={i} className="absolute inset-0" style={{ opacity: 0 }}>
          <div className="col" style={{ top: "34%" }}>
            <h2 className="t-fin">
              <span className="sr-only">{panel.headline.join(" ")}</span>
              <span aria-hidden="true">
                {panel.headline.map((line, k) => (
                  <span className="ln" key={k}>
                    <i>{line}</i>
                  </span>
                ))}
              </span>
            </h2>
          </div>

          <div className="col" style={{ top: "66%" }}>
            <p className="t-stand opacity-90">{panel.lead}</p>
            <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-[clamp(24px,4vw,60px)]">
              <span className="chip t-mono shrink-0 opacity-70">{panel.chip}</span>
              <p className="t-small max-w-[36em] opacity-75">{panel.small}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
