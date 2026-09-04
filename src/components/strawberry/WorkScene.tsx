"use client";

import { useScene } from "@/hooks/strawberry/useScene";
import { nodes } from "@/lib/strawberryReveal";
import { smoothstep, clamp01 } from "@/hooks/strawberry/useStrawberryScrub";
import { SCENES, WORK } from "@/data/strawberry";

/**
 * Chapter two: the work, told against a measure.
 *
 * Three copy groups share one window, handing over to each other while the
 * plate behind them holds. The vertical rule with its ticks is doing real work
 * - it is the only thing on screen that shows how far through the chapter you
 * are, on a stage where the scrollbar is measuring a runway and not a document.
 */
export function WorkScene() {
  const ref = useScene<HTMLDivElement>(
    SCENES.work,
    ({ t, el }) => {
      const groups = nodes(el, "[data-g]");
      const per = 1 / groups.length;

      groups.forEach((g, i) => {
        const local = clamp01((t - i * per) / per);
        // up over the first fifth, hold, down over the last fifth
        const a =
          t < i * per || t > (i + 1) * per
            ? 0
            : smoothstep(Math.min(local / 0.2, (1 - local) / 0.2, 1));
        g.style.opacity = String(a);
        g.style.transform = `translate3d(0, ${(0.5 - local) * 30}px, 0)`;
        g.inert = a < 0.02;
      });

      const head = nodes(el, "[data-head]")[0];
      if (head) head.style.transform = `translate3d(0, ${t * 100}%, 0)`;

      // The readout is the chapter's own progress. The reference shows the
      // same thing beside its tick rail; it is not a claim about anything.
      const read = nodes(el, "[data-read]")[0];
      if (read) read.textContent = `${Math.round(t * 100)}%`;

    },
    { drift: 0, fade: 0.09 }
  );

  return (
    <div className="layer" ref={ref}>
      <div className="work-measure">
        {Array.from({ length: 11 }).map((_, i) => (
          <span
            key={i}
            className="absolute left-0 h-px bg-[var(--hair)]"
            style={{ top: `${(i / 10) * 100}%`, width: i % 5 === 0 ? 26 : 13 }}
          />
        ))}
        <span
          data-head
          className="absolute left-[-13px] top-0 h-px w-[30px] bg-[var(--fg)]"
          aria-hidden="true"
        />
        <span data-read className="t-mono absolute left-[-52px] top-[-4px] opacity-70" aria-hidden="true" />
      </div>

      {WORK.groups.map((g, i) => (
        <div key={i} data-g={i} className="work-copy">
          <span className="chip t-mono">{g.chip}</span>
          <h2 className="t-title mt-4">
            {g.headline.map((line) => (
              <span className="block" key={line}>
                {line}
              </span>
            ))}
          </h2>
          <p className="t-stand mt-5 opacity-85">{g.body}</p>
        </div>
      ))}
    </div>
  );
}
