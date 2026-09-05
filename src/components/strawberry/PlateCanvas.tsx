"use client";

import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap";
import { createStage, type Stage } from "@/lib/strawberryGL";
import { loadPlate } from "@/lib/strawberryPlates";
import {
  createSequence,
  fetchGenerations,
  framePairAt,
  loadFrame,
  type Sequence,
} from "@/lib/strawberrySequence";
import { cueAt } from "@/lib/strawberryCues";
import {
  getStageProgress,
  onStageFrame,
  subscribeStage,
} from "@/hooks/strawberry/useStrawberryScrub";
import { PLATES, PLATE_CUES, FRAMES } from "@/data/strawberry";
import { markFilmReady, resetFilm } from "@/lib/strawberryLoad";

/**
 * The painted plates behind everything.
 *
 * Two loads, in order. The stills go up first and are what the stage opens on;
 * the frame sequences arrive afterwards and take over their slots. That
 * ordering is the whole design: the site is complete and correct from the first
 * paint, and motion is something it gains rather than something it waits for.
 *
 * Rendering is on demand. A settled plate is a still image, and re-rasterising
 * a full-viewport shader sixty times a second to show the same pixels is the
 * kind of cost that only ever surfaces as a warm laptop.
 */
export function PlateCanvas({ onUnavailable }: { onUnavailable: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;

    let stage: Stage | null = null;
    try {
      stage = createStage(el);
    } catch {
      stage = null;
    }
    if (!stage) {
      onUnavailable();
      return;
    }

    let alive = true;
    let dirty = true;
    let dissolving = false;
    let state = {
      from: 0,
      to: 0,
      mix: 0,
      zoom: 1.06,
      pan: [0, 0] as [number, number],
      cell: 9,
      trans: 0,
    };
    resetFilm();

    /** Sequences, indexed to match PLATES, with the bridges after them. */
    const seqs: (Sequence | null)[] = [];
    const bridges = [...new Set(PLATE_CUES.map((c) => c.bridge).filter(Boolean))] as string[];
    const bridgeSlot = new Map<string, number>();
    /** Where the playhead wants each sequence to sit, 0-1. */
    const at: number[] = [];
    /**
     * The slots actually on screen right now.
     *
     * A frame that lands for a chapter nobody is looking at must not be pushed
     * to the GPU. Uploading a full-viewport texture costs the same whether or
     * not it is visible, and doing it seven hundred times while the sequences
     * download turns the load into a slideshow - which is exactly the
     * stuttering the frames were meant to remove.
     */
    const live = new Set<number>([0]);

    const dpr = () => Math.min(window.devicePixelRatio || 1, 1.5);
    /** Width of the drawing buffer in device pixels, which is what decides
        whether a sharper set of frames has anywhere to go. */
    let canvasPx = 0;
    const fit = () => {
      const r = el.getBoundingClientRect();
      canvasPx = r.width * dpr();
      stage?.resize(r.width, r.height, dpr());
      dirty = true;
    };
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    fit();

    /**
     * How much film this connection should fetch.
     *
     * Screen size is deliberately not part of it. A phone on wifi takes these
     * perfectly well, and refusing every narrow viewport made the point of the
     * site invisible on the device most people open it on.
     *
     * `effectiveType` is not a veto either, which cost an hour to learn: it is
     * a rolling estimate of recent throughput, not a property of the link, and
     * Chrome will call a good connection "3g" - or "2g", under load - right
     * after it has finished downloading something heavy. Treating that as a
     * refusal left the plates as stills on hardware that could have run the
     * whole thing, and it did so intermittently, which is worse.
     *
     * So it scales the download instead of gating it. Every tier below the top
     * one still moves; they differ in how fine the grain is, which the pair
     * blend renders as softness rather than as stepping.
     */
    const film = (): "none" | "opening" | "coarse" | "all" => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "none";
      const c = (navigator as { connection?: { saveData?: boolean; effectiveType?: string } })
        .connection;
      // the only outright refusals are the ones the reader asked for
      if (c?.saveData) return "none";
      const type = c?.effectiveType ?? "";
      // roughly 300KB, and already preloaded by the document: the opening
      // chapter moves and the rest stay paintings
      if (/(^|-)(2g|slow)/.test(type)) return "opening";
      // about ten frames a chapter, nine megabytes, whole runway scrubbing
      if (/(^|-)3g/.test(type)) return "coarse";
      return "all";
    };

    /**
     * Positions a slot's sequence where the playhead is asking for.
     *
     * The pair barely changes between one rendered frame and the next, so the
     * work here is almost always a single uniform; a texture is only sent when
     * the scroll actually crosses a frame boundary.
     */
    const show = (slot: number) => {
      const seq = seqs[slot];
      if (!seq) return;
      const pair = framePairAt(seq, at[slot] ?? 0);
      if (!pair) return;
      const settled =
        pair.ia === seq.ia && pair.ib === seq.ib && Math.abs(pair.frac - seq.frac) < 0.002;
      if (settled) return;
      seq.ia = pair.ia;
      seq.ib = pair.ib;
      seq.frac = pair.frac;
      stage?.setFrames(slot, pair.ia, pair.a, pair.ib, pair.b, pair.frac);
      dirty = true;
    };

    /* Read-only probes. The frames are not in the DOM, so without these there
       is no way to tell a stuck sequence from a moving one - the camera keeps
       drifting either way, which is how a freeze went unnoticed before.
       `shown` is where on the GPU each sequence is sitting - its leading frame
       plus how far past it - and `loaded` is what has arrived; a slot can
       legitimately have many frames and none of them shown, because a chapter
       nobody is looking at is not worth uploading. */
    const probe = window as unknown as {
      playhead?: number;
      stageClipTimes?: () => (number | null)[];
      stageFilm?: () => {
        shown: number;
        loaded: number;
        sharp: number;
        n: number;
        live: boolean;
      }[];
    };
    const positionOf = (s: Sequence | null) =>
      !s || s.ia < 0 ? null : s.ia + (s.ib > s.ia ? (s.ib - s.ia) * s.frac : 0);
    probe.stageClipTimes = () => seqs.map((s) => positionOf(s ?? null));
    probe.stageFilm = () =>
      seqs.map((s, i) => ({
        shown: positionOf(s ?? null) ?? -1,
        loaded: s?.loaded ?? 0,
        sharp: s?.sharp ?? 0,
        n: s?.n ?? 0,
        live: live.has(i),
      }));

    const unsub = subscribeStage((p) => {
      probe.playhead = p;
      const c = cueAt(p);

      /* No camera move.
         There used to be a push-in and a drift here, blended across handovers.
         It was a mistake on artwork that already carries its own motion: at
         zoom 1.075 with the pan at full travel the stage was showing about 78%
         of the picture and sliding that window around, so a frame composed with
         the figure standing clear on her ledge got blown up, pushed into the
         left edge and cut off at the feet. The plates are cover-fitted and left
         alone now - the only crop is the one a 16:9 frame cannot avoid in a
         16:10 viewport, and the only movement is the movement that was filmed. */
      const camera = () => ({ zoom: 1, panX: 0, panY: 0 });

      const cam = camera();

      state = {
        from: c.from,
        to: c.to,
        mix: c.mix,
        zoom: cam.zoom,
        pan: [cam.panX, cam.panY] as [number, number],
        // the screen coarsens as the dissolve peaks, which is what sells it as
        // a printing plate rather than a crossfade
        cell: 7 + Math.sin(Math.min(1, c.mix) * Math.PI) * 9,
        trans: c.via === "iris" ? 1 : 0,
      };
      dissolving = c.mix > 0.001 && c.mix < 0.999;
      dirty = true;

      // each plate's own stretch is its sequence's timeline
      at[c.from] = c.seg;
      if (c.to !== c.from) at[c.to] = 0;
      live.clear();
      live.add(c.from);
      live.add(c.to);
      show(c.from);
      if (c.to !== c.from) show(c.to);

      /* A bridge is a filmed handover generated separately from the plates
         either side, so its first and last frames do not match theirs exactly.
         Cutting straight in and out shows that as a jump, so it is eased: a
         short crossfade in, the bridge alone through the middle, and a short
         crossfade out. */
      const bIdx = c.bridge ? bridgeSlot.get(c.bridge) : undefined;
      if (bIdx !== undefined && dissolving) {
        const RAMP = 0.18;
        at[bIdx] = c.mix;
        live.add(bIdx);
        show(bIdx);
        if (c.mix < RAMP) {
          state = { ...state, from: c.from, to: bIdx, mix: c.mix / RAMP, trans: 3 };
        } else if (c.mix > 1 - RAMP) {
          state = { ...state, from: bIdx, to: c.to, mix: (c.mix - (1 - RAMP)) / RAMP, trans: 3 };
        } else {
          state = { ...state, from: bIdx, to: bIdx, mix: 0, trans: 2 };
        }
      }
    });

    /* Drawn from the playhead's own clock, immediately after it has been
       published, so the picture on screen is the position the page is at rather
       than the one it was at two frames ago. A settled plate is a still image,
       and re-rasterising a full-viewport shader sixty times a second to show
       the same pixels is the kind of cost that only ever surfaces as a warm
       laptop - so nothing is drawn unless something moved. */
    const unhook = onStageFrame(() => {
      if (!alive || !stage) return;
      if (!dirty && !dissolving) return;
      stage.render(state, gsap.ticker.time);
      dirty = dissolving;
    });

    /* Slots exist before anything has been downloaded.
       Each opens on its chapter's own ground colour, so the page is a finished
       composition from its first painted frame and simply gains detail. The
       film is started immediately rather than behind the stills: gating the
       sequences on nine painted plates put three seconds between arriving and
       the first frame that moves, which is the whole complaint. */
    PLATES.forEach((p, i) => {
      stage.addSlot(p.tone);
      at[i] = 0;
    });
    for (const bridge of bridges) {
      const slot = stage.addSlot(PLATES[0].tone);
      bridgeSlot.set(bridge, slot);
      at[slot] = 0;
    }
    dirty = true;

    void loadSequences();

    /* The stills come in alongside, and stand down wherever the film has
       already landed. They are what a reduced-motion or offline visit sees,
       and until then they are simply a better placeholder than a flat wash. */
    void Promise.all(
      PLATES.map(async (plate, i) => {
        const source = await loadPlate(plate);
        if (!alive || !stage) return;
        if ((seqs[i]?.ia ?? -1) >= 0) return;
        stage.setSource(i, source);
        dirty = true;
      }),
    ).catch(() => {});

    async function loadSequences() {
      const want = film();
      if (want === "none") return markFilmReady();

      const plan: { slot: number; base: string }[] = [];
      PLATES.forEach((p, i) => {
        if (p.film && FRAMES[p.film]) plan.push({ slot: i, base: p.film });
      });
      if (want !== "opening") {
        for (const base of bridges) {
          const slot = bridgeSlot.get(base);
          if (slot !== undefined && FRAMES[base]) plan.push({ slot, base });
        }
      } else {
        plan.length = Math.min(plan.length, 1);
      }
      for (const { slot, base } of plan) seqs[slot] = createSequence(base, FRAMES[base]);

      const cueOf = (slot: number) =>
        slot < PLATES.length
          ? PLATE_CUES.find((c) => c.plate === PLATES[slot].id)?.at ?? 0
          : PLATE_CUES.find((c) => bridgeSlot.get(c.bridge ?? "") === slot)?.at ?? 0;

      /* Every clip is refined a generation at a time, and a generation is
         finished across all twelve before the next one starts. The first is a
         handful of frames strided over each clip - seventy-eight images in
         total, about six megabytes - and that alone makes the entire runway
         scrubbable end to end. Perfecting one clip before starting the next
         would leave the later chapters with nothing at all while the first was
         being finished, and a reader can be in chapter seven a second after
         arriving. */
      const gens = new Map(plan.map(({ slot }) => [slot, fetchGenerations(seqs[slot]!.n)]));
      const depth = Math.max(...[...gens.values()].map((g) => g.length));
      /* How far to refine. Each tier stops at the point where more frames stop
         buying motion and start only buying grain. */
      const last = want === "opening" ? 0 : want === "coarse" ? 1 : depth - 1;
      const queue = new Map<number, number[]>();

      const nextJob = () => {
        /* Whichever unfinished chapter the reader is nearest goes first, read
           fresh on every pick rather than fixed when the queue was built. A
           reader who jumps to the end should not wait for the opening to
           finish downloading before the ending will move. */
        const p = getStageProgress();
        let slot = -1;
        let near = Infinity;
        for (const [s, list] of queue) {
          if (!list.length) continue;
          const d = Math.abs(cueOf(s) - p);
          if (d < near) {
            near = d;
            slot = s;
          }
        }
        if (slot < 0) return null;
        return { slot, i: queue.get(slot)!.shift()! };
      };

      const LANES = 8;
      const run = (sharp: boolean) => async () => {
        for (let job = nextJob(); alive && job; job = nextJob()) {
          const seq = seqs[job.slot];
          if (!seq) continue;
          await loadFrame(seq, job.i, sharp);
          if (!alive) return;
          // only what is on screen is worth a texture upload
          if (live.has(job.slot)) {
            // a sharper copy of a frame already on the GPU carries the same
            // index, so the slot has to be told to look again
            if (sharp) stage?.invalidate(job.slot);
            show(job.slot);
          }
          if (job.slot === 0) markFilmReady();
        }
      };

      const sweep = async (sharp: boolean) => {
        for (let g = 0; g < depth; g++) {
          queue.clear();
          for (const { slot } of plan) {
            const gen = gens.get(slot)![g];
            if (gen?.length) queue.set(slot, [...gen]);
          }
          if (!queue.size) continue;
          await Promise.all(Array.from({ length: LANES }, run(sharp)));
          markFilmReady();
          // true only when the sweep actually reached the end, rather than
          // stopping at the depth this connection was allotted
          if (g >= last) return g >= depth - 1;
        }
        return true;
      };

      const whole = await sweep(false);
      markFilmReady();

      /* The sharp set only goes to screens that can show it.
         A phone's canvas is under 650px after the pixel-ratio cap, so the light
         film is already at or above native there and the sharp one would be
         sixty-six megabytes of pixels it cannot draw. */
      if (!whole || !alive) return;
      if (canvasPx < 800) return;
      await sweep(true);
    }

    return () => {
      alive = false;
      unsub();
      unhook();
      ro.disconnect();
      stage.destroy();
    };
  }, [onUnavailable]);

  return <canvas ref={canvas} className="plate-gl" aria-hidden="true" />;
}
