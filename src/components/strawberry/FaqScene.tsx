"use client";

import { useEffect, useRef } from "react";
import { useScene } from "@/hooks/strawberry/useScene";
import { nodes } from "@/lib/strawberryReveal";
import { clamp01, smoothstep } from "@/hooks/strawberry/useStrawberryScrub";
import { FAQ, FAQ_LEAD, SCENES } from "@/data/strawberry";

/** Strokes of the hand-drawn flourish under the lead-in, in draw order. */
const FLOURISH = [
  "M2 14 C 14 4, 34 4, 52 11",
  "M52 11 C 66 16, 74 11, 70 5",
  "M70 5 C 66 0, 56 2, 58 9",
  "M58 9 C 60 15, 74 16, 86 11",
  "M92 8 l 0 0.4",
];

const STEP = 360 / FAQ.length;

/**
 * Chapter four: the questions, on a ring.
 *
 * The cards are placed with real depth - `translateZ` out to a radius, then a
 * counter-rotation so each one still faces the viewer - and the ones at the back
 * are blurred and dimmed. A flat carousel that cross-faded five positions would
 * need the same amount of code and would read as a slideshow; this reads as an
 * object being turned, which is the only reason to spend a 3D context on it.
 */
export function FaqScene() {
  /* The ring leans very slightly toward the pointer. Kept in a ref and read
     inside the frame callback, so moving the mouse never triggers a render. */
  const point = useRef({ x: 0, y: 0 }).current;
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      point.x = (e.clientX / window.innerWidth - 0.5) * 2;
      point.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [point]);

  const sig = useRef<SVGSVGElement>(null);

  // Dash lengths are measured rather than authored: a hand-drawn path's length
  // is not something to eyeball, and getting it wrong leaves a stroke that
  // either snaps in or never finishes.
  useEffect(() => {
    const svg = sig.current;
    if (!svg) return;
    svg.querySelectorAll("path").forEach((p) => {
      const len = p.getTotalLength();
      p.style.strokeDasharray = String(len);
      p.style.strokeDashoffset = String(len);
    });
  }, []);

  const ref = useScene<HTMLDivElement>(
    SCENES.faq,
    ({ t, el }) => {
      // The ring turns through four steps, so every card faces front once.
      const spin = smoothstep(clamp01((t - 0.12) / 0.76)) * STEP * (FAQ.length - 1);
      const open = smoothstep(clamp01(t / 0.16));

      /* Ring mechanics taken from the reference build.
         Per card, with `a` the angle in radians and `o = (cos(a)+1)/2` the
         depth:
             scale      r * (0.58 + 0.42 * o^1.4)
             translateY sin(a) * 26 - (1 - r) * 34
             blur       round((1 - o) * 8.4) / 2      -> 0.5px steps, max 4.2
         The scale curve matters most: a linear ramp keeps the back cards too
         large and the ring reads flat. The exponent is what gives it depth.
         `sin(a)` is signed, so the two sides of the ring rise and fall in
         opposite directions instead of both drifting the same way. */
      const radius = Math.min(360, Math.max(210, window.innerWidth * 0.26));

      nodes(el, "[data-fq]").forEach((card, i) => {
        const deg = i * STEP - spin;
        const a = (deg * Math.PI) / 180;
        const o = (Math.cos(a) + 1) / 2;

        const scale = open * (0.58 + 0.42 * Math.pow(o, 1.4));
        const ty = Math.sin(a) * 26 - (1 - open) * 34;

        card.style.transform =
          `translate(${(-50 + point.x * 2.4).toFixed(2)}%, ${(-50 + point.y * 2).toFixed(2)}%) ` +
          `rotateY(${deg.toFixed(2)}deg) translateZ(${radius.toFixed(1)}px) ` +
          `rotateY(${(-deg).toFixed(2)}deg) translateY(${ty.toFixed(1)}px) ` +
          `scale(${scale.toFixed(3)})`;

        /* Quantised to the same half-pixel steps the reference uses. A fresh
           filter value forces another filter pass, so writing one per frame is
           what made this chapter drop frames. */
        const blur = Math.round((1 - o) * 8.4) / 2;
        if (card.dataset.blur !== String(blur)) {
          card.dataset.blur = String(blur);
          card.style.filter = blur > 0.05 ? `blur(${blur}px)` : "none";
        }
        const z = Math.round(o * 20);
        if (card.dataset.z !== String(z)) {
          card.dataset.z = String(z);
          card.style.zIndex = String(z);
        }
        // only the card actually facing the viewer reveals its answer
        const facing = o > 0.9 && open > 0.92;
        if (facing !== card.classList.contains("on")) card.classList.toggle("on", facing);
      });

      // The flourish writes itself across the front of the scene.
      const strokes = nodes(el, "[data-stroke]") as unknown as SVGPathElement[];
      strokes.forEach((p, i) => {
        const a = i / strokes.length;
        const b = (i + 1) / strokes.length;
        const k = smoothstep(clamp01((clamp01((t - 0.04) / 0.3) - a) / (b - a)));
        const len = p.getTotalLength ? p.getTotalLength() : 100;
        p.style.strokeDashoffset = String(len * (1 - k));
        p.style.opacity = k > 0 ? "1" : "0";
      });

      const lead = nodes(el, "[data-lead]")[0];
      if (lead) lead.style.opacity = String(smoothstep(clamp01((t - 0.02) / 0.14)));
    },
    { drift: 0, fade: 0.12 }
  );

  return (
    <div className="layer" ref={ref}>
      <div className="absolute inset-x-0 top-[6%] text-center">
        <p
          data-lead
          className="t-display"
          style={{ fontSize: "clamp(1.75rem,6vw,5.5rem)", opacity: 0 }}
        >
          {FAQ_LEAD}
        </p>
        <svg
          ref={sig}
          className="sig mx-auto mt-2 block"
          viewBox="0 0 96 20"
          width="clamp(90px,12vw,180px)"
          height="24"
          fill="none"
          aria-hidden="true"
        >
          {FLOURISH.map((d, i) => (
            <path key={i} d={d} data-stroke style={{ opacity: 0 }} />
          ))}
        </svg>
      </div>

      <div className="ring">
        <div className="ring-in">
          {FAQ.map((item, i) => (
            <div className="fq" data-fq key={i}>
              <span className="num t-mono">{String(i + 1).padStart(2, "0")}</span>
              <h3>{item.q}</h3>
              <p>{item.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
