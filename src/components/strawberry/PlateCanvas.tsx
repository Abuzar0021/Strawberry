"use client";

import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap";
import { createStage, type Stage } from "@/lib/strawberryGL";
import { loadPlate } from "@/lib/strawberryPlates";
import {
  coarseCount,
  createSequence,
  fetchOrder,
  framePairAt,
  loadFrame,
  type Sequence,
} from "@/lib/strawberrySequence";
import { cueAt } from "@/lib/strawberryCues";
import { subscribeStage, getStageProgress } from "@/hooks/strawberry/useStrawberryScrub";
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
    const fit = () => {
      const r = el.getBoundingClientRect();
      stage?.resize(r.width, r.height, dpr());
      dirty = true;
    };
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    fit();

    /**
     * Whether this device should fetch the sequences at all.
     *
     * Screen size is deliberately not a reason to refuse. A phone on wifi takes
     * these perfectly well, and refusing every narrow viewport made the point of
     * the site invisible on the device most people open it on. What matters is
     * what the connection says about itself: an explicit data-saver request, or
     * a link slow enough that the download would outlast the visit.
     */
    const wantsFilm = () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
      const c = (navigator as { connection?: { saveData?: boolean; effectiveType?: string } })
        .connection;
      if (c?.saveData) return false;
      if (c?.effectiveType && /(^|-)([23]g|slow)/.test(c.effectiveType)) return false;
      return true;
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
      stageFilm?: () => { shown: number; loaded: number; n: number; live: boolean }[];
    };
    const positionOf = (s: Sequence | null) =>
      !s || s.ia < 0 ? null : s.ia + (s.ib > s.ia ? (s.ib - s.ia) * s.frac : 0);
    probe.stageClipTimes = () => seqs.map((s) => positionOf(s ?? null));
    probe.stageFilm = () =>
      seqs.map((s, i) => ({
        shown: positionOf(s ?? null) ?? -1,
        loaded: s?.loaded ?? 0,
        n: s?.n ?? 0,
        live: live.has(i),
      }));

    const unsub = subscribeStage((p) => {
      probe.playhead = p;
      const c = cueAt(p);

      /* Parallax is blended between the outgoing segment and the incoming one
         across a handover. Each segment pushes in and drifts the opposite way
         to the one before, but `seg` resets 1 -> 0 at every boundary and the
         direction flips at the same instant, so reading either directly puts a
         hard jump in zoom and pan exactly where the eye is already being asked
         to accept a new plate. */
      const camera = (segv: number, idx: number) => {
        const dir = idx % 2 === 0 ? 1 : -1;
        return {
          zoom: 1.075 - segv * 0.055,
          panX: (segv - 0.5) * 0.05 * dir,
          panY: (segv - 0.5) * 0.03,
        };
      };
      const a = camera(c.seg, c.segIndex);
      const b = camera(c.segTo, c.segIndexTo);
      const k = c.mix;
      const lerp = (x: number, y: number) => x + (y - x) * k;

      state = {
        from: c.from,
        to: c.to,
        mix: c.mix,
        zoom: lerp(a.zoom, b.zoom),
        pan: [lerp(a.panX, b.panX), lerp(a.panY, b.panY)] as [number, number],
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

    const tick = () => {
      if (!alive || !stage) return;
      if (!dirty && !dissolving) return;
      stage.render(state, gsap.ticker.time);
      dirty = dissolving;
    };
    gsap.ticker.add(tick);

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
      if (!wantsFilm()) return markFilmReady();

      const plan: { slot: number; base: string }[] = [];
      PLATES.forEach((p, i) => {
        if (p.film && FRAMES[p.film]) plan.push({ slot: i, base: p.film });
      });
      for (const base of bridges) {
        const slot = bridgeSlot.get(base);
        if (slot !== undefined && FRAMES[base]) plan.push({ slot, base });
      }
      for (const { slot, base } of plan) seqs[slot] = createSequence(base, FRAMES[base]);

      const cueOf = (slot: number) =>
        slot < PLATES.length
          ? PLATE_CUES.find((c) => c.plate === PLATES[slot].id)?.at ?? 0
          : PLATE_CUES.find((c) => bridgeSlot.get(c.bridge ?? "") === slot)?.at ?? 0;

      /* Two passes over every sequence. The first takes a strided handful from
         each - about ten frames - which is already enough to scrub that clip
         end to end; only then does the second fill in between them. Perfecting
         one clip before starting the next would leave the later chapters with
         nothing at all while the first was being finished, and the reader can
         be in chapter seven within a second of arriving. */
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
      const drain = async () => {
        const run = async () => {
          for (let job = nextJob(); alive && job; job = nextJob()) {
            const seq = seqs[job.slot];
            if (!seq) continue;
            await loadFrame(seq, job.i);
            if (!alive) return;
            // only what is on screen is worth a texture upload
            if (live.has(job.slot)) show(job.slot);
            if (job.slot === 0) markFilmReady();
          }
        };
        await Promise.all(Array.from({ length: LANES }, run));
      };

      for (const { slot } of plan) {
        const seq = seqs[slot]!;
        queue.set(slot, fetchOrder(seq.n).slice(0, coarseCount(seq.n)));
      }
      await drain();
      markFilmReady();

      for (const { slot } of plan) {
        const seq = seqs[slot]!;
        queue.set(slot, fetchOrder(seq.n).slice(coarseCount(seq.n)));
      }
      await drain();
      markFilmReady();
    }

    return () => {
      alive = false;
      unsub();
      ro.disconnect();
      gsap.ticker.remove(tick);
      stage.destroy();
    };
  }, [onUnavailable]);

  return <canvas ref={canvas} className="plate-gl" aria-hidden="true" />;
}
