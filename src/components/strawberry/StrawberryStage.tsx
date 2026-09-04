"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getLenis } from "@/lib/scroll";
import { GROUNDS } from "@/lib/strawberryPlates";
import { groundAt } from "@/lib/strawberryCues";
import { subscribeStage, useStageScrub, setStill } from "@/hooks/strawberry/useStrawberryScrub";
import { BRAND, PLATE_BY_ID, RUNWAY_VH, SCENES, SCENE_ORDER } from "@/data/strawberry";
import { PlateCanvas } from "./PlateCanvas";
import { Loader } from "./Loader";
import { Rail } from "./Rail";
import { HeroScene } from "./HeroScene";
import { BeatScene } from "./BeatScene";
import { WorkScene } from "./WorkScene";
import { TermsScene } from "./TermsScene";
import { FaqScene } from "./FaqScene";
import { ApplyScene } from "./ApplyScene";
import { CloseScene } from "./CloseScene";

/**
 * The stage.
 *
 * The document is one tall runway with a single sticky pin on it. Everything
 * the visitor sees - nine paintings and nine copy layers - lives inside that one
 * viewport-sized element, and scroll position is the only input any of it takes.
 *
 * The runway height is the site's whole information architecture: there are no
 * sections to link to, so a "chapter" is a position on a playhead and the rail
 * seeks to it.
 */
export function StrawberryStage() {
  const stage = useRef<HTMLElement>(null);
  const pin = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const [still, setIsStill] = useState(false);

  useStageScrub(stage);

  /* Reduced motion, and anything that cannot give us a GL context, get the
     document instead of the stage: same content, stacked, nothing moving. */
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      if (!mq.matches) return;
      setStill(true);
      setIsStill(true);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const noGl = useCallback(() => {
    setStill(true);
    setIsStill(true);
  }, []);

  /* The fallback is silent by design - it just becomes a different, simpler
     site. That makes it very hard to tell from the outside whether you are
     looking at a bug or at the document mode working correctly, so it says so
     once. Both causes are environmental and neither is visible in the markup. */
  useEffect(() => {
    if (!still) return;
    const why = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "the OS asks for reduced motion (Windows: Settings > Accessibility > Visual effects > Animation effects)"
      : "this browser gave no WebGL context (check chrome://gpu, or hardware acceleration)";
    console.info(
      `[${BRAND.name}] Running the static document fallback because ${why}. ` +
        "No video is loaded and the stage does not scrub in this mode."
    );
  }, [still]);

  /* The copy does not know which chapter it is in; it reads two custom
     properties. This is the one place that decides whether the stage is
     currently a cream-on-blue frame or an ink-on-bone one. */
  useEffect(() => {
    const el = pin.current;
    if (!el || still) return;
    let last = "";

    return subscribeStage((p) => {
      const g = groundAt(p);
      if (g === last) return;
      last = g;
      const onInk = GROUNDS[g].ink === "ink";
      el.dataset.ink = GROUNDS[g].ink;
      el.style.backgroundColor = GROUNDS[g].base;
      el.style.setProperty("--fg", onInk ? "#1d1c19" : "#fffaea");
      el.style.setProperty("--fg-dim", onInk ? "rgb(29 28 25 / 0.72)" : "rgb(255 250 234 / 0.72)");
      el.style.setProperty("--hair", onInk ? "rgb(29 28 25 / 0.16)" : "rgb(255 255 255 / 0.22)");
    });
  }, [still]);

  /* In document mode each layer paints its own ground, because there is no
     shader behind it to supply one. Layer order matches SCENE_ORDER. */
  useEffect(() => {
    const el = root.current;
    if (!el || !still) return;
    const layers = el.querySelectorAll<HTMLElement>(".layer");
    SCENE_ORDER.forEach(({ plate }, i) => {
      const layer = layers[i];
      if (!layer) return;
      /* A layer may already have hidden itself before the fallback was
         decided - the no-WebGL path only fires after the renderer has tried.
         `inert` and `visibility` are set from script, so CSS cannot take them
         back and this has to. */
      layer.inert = false;
      layer.style.visibility = "visible";
      layer.style.opacity = "";
      layer.style.transform = "";
      const g = PLATE_BY_ID[plate].ground;
      const onInk = GROUNDS[g].ink === "ink";
      layer.style.setProperty("--scene-ground", GROUNDS[g].base);
      layer.style.setProperty("--fg", onInk ? "#1d1c19" : "#fffaea");
      layer.dataset.ink = GROUNDS[g].ink;
      layer.style.color = onInk ? "#1d1c19" : "#fffaea";
    });
  }, [still]);

  /** Seek the playhead. Lenis owns the scroll, so it has to perform the jump. */
  const seek = useCallback((p: number) => {
    const el = stage.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const y = Math.round(top + p * (el.offsetHeight - window.innerHeight));
    const lenis = getLenis();
    if (lenis) lenis.scrollTo(y, { duration: 1.5 });
    else window.scrollTo({ top: y, behavior: "smooth" });
  }, []);

  const toApply = useCallback(() => seek(SCENES.apply[0] + 0.03), [seek]);

  return (
    <div ref={root} data-still={still ? "1" : "0"}>
      <Loader />
      <main>
        <section className="stage" ref={stage} style={{ height: `${RUNWAY_VH}vh` }}>
          <div className="pin" ref={pin} data-ink="cream">
            {!still && <PlateCanvas onUnavailable={noGl} />}

            {/* The frame: one rule across the top, one down the margin. It is
                the whole of the site's chrome, and it never moves. */}
            <span className="hair hair-h" style={{ top: "var(--rule)" }} aria-hidden="true" />
            <span className="hair hair-v" style={{ left: "var(--v1)" }} aria-hidden="true" />

            <a href="#apply" className="mark" aria-label={`${BRAND.name} - top of page`}>
              {/* A strawberry reduced to two strokes: the shoulder-and-taper of
                  the berry, and the calyx across the top. Drawn open rather than
                  filled so it reads at 24px against both grounds. */}
              <svg viewBox="0 0 24 30" fill="none" aria-hidden="true">
                <path
                  d="M12 9.2c5 0 8.2 2.6 8.2 6.4 0 4.6-4.6 11.6-8.2 11.6S3.8 20.2 3.8 15.6C3.8 11.8 7 9.2 12 9.2Z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                />
                <path
                  d="M12 9.2V4.4M12 8.4c-2.4 0-4.3-.9-5.3-2.4 2.4-1 4.3-.5 5.3 1 1-1.5 2.9-2 5.3-1-1 1.5-2.9 2.4-5.3 2.4Z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>

            <button type="button" className="apply t-mono" onClick={toApply}>
              Apply
              <span className="arw" aria-hidden="true">
                →
              </span>
            </button>

            <Rail seek={seek} />

            {/* Layer order is load-bearing: SCENE_ORDER indexes it. */}
            <HeroScene onApply={toApply} />
            <BeatScene index={0} range={SCENES.beat1} />
            <BeatScene index={1} range={SCENES.beat2} />
            <BeatScene index={2} range={SCENES.beat3} />
            <WorkScene />
            <TermsScene />
            <FaqScene />
            <ApplyScene />
            <CloseScene />
          </div>
        </section>
      </main>
    </div>
  );
}
