"use client";

import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap";
import { FAQ, FAQ_LEAD, SCENES_FILM, CARDS_OVER } from "@/data/strawberry";
import { subscribeStage, clamp01, smoothstep } from "@/hooks/strawberry/useStrawberryScrub";

/**
 * The cards that float over the void in the vines.
 *
 * They ride the same playhead everything else does rather than owning a
 * ScrollTrigger of their own. That matters here more than elsewhere: the film
 * behind them is pinned by the same value, so a trigger of their own would be
 * a second measurement of the same scroll and the cards would drift against the
 * sky by a frame whenever the two disagreed.
 *
 * Depth is the flat paper against the sky and nothing else - no shadow, no
 * blur, no gradient. A card is a rectangle of #F2F1ED that happens to be in
 * front.
 */
export function Cards() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const cards = Array.from(el.querySelectorAll<HTMLElement>("[data-card]"));
    const lead = el.querySelector<HTMLElement>("[data-lead]");

    // the slice of the runway the vines film owns
    const span = 1 / SCENES_FILM.length;
    const from = CARDS_OVER * span;

    return subscribeStage((p) => {
      const t = clamp01((p - from) / span);
      const shown = t > 0.001 && t < 0.999;
      if (el.hidden === shown) el.hidden = !shown;
      if (!shown) return;

      if (lead) lead.style.opacity = String(smoothstep(clamp01((t - 0.04) / 0.16)));

      cards.forEach((card, i) => {
        /* Each card rises from below the fold, staggered, and holds. The rise
           is a transform and the fade an opacity - the two properties a
           compositor can animate without touching layout, which is what keeps
           this smooth over a video that is already decoding. */
        const step = 0.08;
        const k = smoothstep(clamp01((t - 0.1 - i * step) / 0.34));
        const y = (1 - k) * 46;
        card.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
        card.style.opacity = k.toFixed(3);
      });
    });
  }, []);

  return (
    <div className="cards" ref={root} hidden>
      <p className="cards-lead t-display" data-lead style={{ opacity: 0 }}>
        {FAQ_LEAD}
      </p>
      <div className="cards-row">
        {FAQ.slice(0, 3).map((item, i) => (
          <article className="card" data-card key={i} style={{ opacity: 0 }}>
            <span className="card-num t-mono">{String(i + 1).padStart(2, "0")}</span>
            <h3 className="card-q">{item.q}</h3>
            <p className="card-a">{item.a}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
