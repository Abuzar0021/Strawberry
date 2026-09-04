"use client";

import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap";
import { createStage, type Stage } from "@/lib/strawberryGL";
import { loadPlate, loadMotion } from "@/lib/strawberryPlates";
import { cueAt } from "@/lib/strawberryCues";
import { subscribeStage, getStageProgress } from "@/hooks/strawberry/useStrawberryScrub";
import { PLATES, PLATE_CUES } from "@/data/strawberry";
import { markFilmReady, resetFilm } from "@/lib/strawberryLoad";

/**
 * The painted plates behind everything.
 *
 * Two loads, in order. The stills go up first and are what the stage opens on;
 * the clips arrive afterwards and take over their slots one at a time. That
 * ordering is the whole design - the site is complete and correct from the
 * first paint, and motion is something it gains, never something it waits for.
 *
 * Rendering is on demand. A settled still is a still image, and re-rasterising
 * a full-viewport shader sixty times a second to show the same pixels is the
 * kind of cost that only ever surfaces as a warm laptop. The loop wakes for
 * scroll, for the length of a dissolve, and while a clip is actually playing.
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
    resetFilm();
    let dirty = true;
    let dissolving = false;
    let playing = false;
    let state = { from: 0, to: 0, mix: 0, zoom: 1.06, pan: [0, 0] as [number, number], cell: 9, trans: 0 };

    /**
     * Whether this device should fetch the films at all.
     *
     * The clips are 50-odd megabytes. On a phone that is a background effect
     * costing more than most whole websites, so handhelds, metered connections
     * and reduced-motion all keep the stills - which are the finished artwork
     * and look complete on their own.
     */
    const wantsFilm = () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
      if (window.matchMedia("(max-width: 900px)").matches) return false;
      const c = (navigator as { connection?: { saveData?: boolean; effectiveType?: string } })
        .connection;
      if (c?.saveData) return false;
      if (c?.effectiveType && /(^|-)([23]g|slow)/.test(c.effectiveType)) return false;
      return true;
    };

    /** Clips, indexed to match PLATES. Sparse until each one loads. */
    const clips: (HTMLVideoElement | null)[] = PLATES.map(() => null);
    /** Where the playhead currently wants each scrubbed clip to sit, 0-1. */
    const scrubAt: number[] = PLATES.map(() => 0);

    /* Bridge clips live in slots after the plates. They are scrubbed exactly
       like a plate, but by the handover's mix rather than by a segment. */
    const bridges = PLATE_CUES.filter((c) => c.bridge).map((c) => c.bridge as string);
    const bridgeSlot = new Map<string, number>();
    const bridgeClips: (HTMLVideoElement | null)[] = bridges.map(() => null);


    // DPR is capped at 1.5: this shader is fragment-bound and full-viewport, and
    // past that the extra samples buy nothing a painted plate can show.
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
     * Only the two plates on screen are allowed to decode.
     *
     * This is what makes nine clips affordable: at any moment at most two are
     * running, and everything else is paused with its decoder idle. Without it
     * the page holds nine simultaneous full-frame decodes to show one image.
     */
    const audition = () => {
      let any = false;
      for (let i = 0; i < clips.length; i++) {
        const v = clips[i];
        if (!v) continue;
        const onScreen = !document.hidden && (i === state.from || i === state.to);

        if (PLATES[i].scrub) {
          // Scrubbed clips never play; they are positioned by the playhead.
          if (!v.paused) v.pause();
          if (onScreen) seek(i, v);
          continue;
        }
        if (onScreen) {
          any = true;
          if (v.paused) void v.play().catch(() => {});
        } else if (!v.paused) {
          v.pause();
        }
      }
      playing = any;
    };

    /**
     * Positions a scrubbed clip.
     *
     * This is a pipeline, not a fire-and-forget. Only one seek can be in flight
     * on a video element, and assigning `currentTime` during one throws the
     * decode away and starts over - so a continuous scroll that issued a seek
     * per frame would spend all its time cancelling itself.
     *
     * But simply dropping a request while busy loses the newest position, and
     * nothing would ever go back for it: the clip stops on whatever frame last
     * happened to land and stays there while you keep scrolling. So the latest
     * target is always recorded, and `onSettled` below picks it up the moment
     * the decoder frees up.
     */
    const wanted: number[] = [];
    const seeking = new Set<number>();

    const pump = (i: number, v: HTMLVideoElement) => {
      if (!v.duration || Number.isNaN(v.duration)) return;
      if (seeking.has(i)) {
        const since = seekedAt.get(i);
        if (since === undefined || performance.now() - since < STALE_SEEK_MS) return;
        seeking.delete(i);   // the seek was lost; take the slot back
      }
      let target = wanted[i];
      if (target === undefined) return;

      /* Clamp to the downloaded range. Seeking past the buffered edge does not
         fail, it stalls on a stale frame, which is what glitching looks like.
         Scrubbing therefore covers only what has arrived and widens as the
         rest lands, instead of the clip being unusable until it is complete. */
      let end = 0;
      for (let k = 0; k < v.buffered.length; k++) {
        if (v.buffered.start(k) <= target) end = Math.max(end, v.buffered.end(k));
      }
      if (end > 0.2) target = Math.min(target, end - 0.1);
      // one frame at 12fps - below this the seek would land on the same frame
      if (Math.abs(v.currentTime - target) < 1 / 12) return;
      seeking.add(i);
      seekedAt.set(i, performance.now());
      v.currentTime = target;
      dirty = true;
    };

    const seek = (i: number, v: HTMLVideoElement) => {
      if (!v.duration || Number.isNaN(v.duration)) return;
      wanted[i] = scrubAt[i] * v.duration;
      pump(i, v);
    };

    /** A seek finished; take the newest target if the playhead has moved on. */
    /* A seek that never reports back would freeze its clip forever, because
       `pump` refuses to issue another while one is in flight. Browsers do drop
       `seeked` occasionally under load, so an in-flight seek older than this
       is treated as lost and the slot is released. */
    const STALE_SEEK_MS = 400;
    const seekedAt = new Map<number, number>();

    const onSettled = (i: number, v: HTMLVideoElement) => {
      seeking.delete(i);
      seekedAt.delete(i);
      dirty = true;
      pump(i, v);
    };

    const unsub = subscribeStage((p) => {
      const c = cueAt(p);
      const changed = c.from !== state.from || c.to !== state.to;
      /* Parallax is blended between the outgoing segment and the incoming one
         across the handover.

         Each segment pushes in and drifts the opposite way to the one before,
         so a long scroll never reads as one continuous pan across nine
         paintings. But `seg` resets 1 -> 0 at every boundary and `dir` flips
         sign at the same instant, so reading either directly puts a hard jump
         in zoom and pan right where the eye is already being asked to accept a
         new plate. Blending by `mix` makes the camera continuous through the
         cut, which is the difference between a handover and a jump cut. */
      const camera = (segv: number, idx: number) => {
        const dir = idx % 2 === 0 ? 1 : -1;
        return {
          zoom: 1.075 - segv * 0.055,
          panX: (segv - 0.5) * 0.05 * dir,
          panY: (segv - 0.5) * 0.03,
        };
      };
      const camA = camera(c.seg, c.segIndex);
      const camB = camera(c.segTo, c.segIndexTo);
      const k = c.mix;
      const lerp = (a: number, b: number) => a + (b - a) * k;

      state = {
        from: c.from,
        to: c.to,
        mix: c.mix,
        zoom: lerp(camA.zoom, camB.zoom),
        pan: [lerp(camA.panX, camB.panX), lerp(camA.panY, camB.panY)] as [number, number],
        // the screen coarsens as the dissolve peaks, which is what sells it as
        // a printing plate rather than a crossfade
        cell: 7 + Math.sin(Math.min(1, c.mix) * Math.PI) * 9,
        trans: c.via === "iris" ? 1 : 0,
      };
      dissolving = c.mix > 0.001 && c.mix < 0.999;
      dirty = true;

      /* A bridge is a filmed handover, but it is generated separately from the
         plate clips either side of it, so its first and last frames do not
         match theirs exactly. Cutting straight into it and straight out again
         shows that mismatch as a jump - which is what the cut at the head of
         the Work chapter was.

         So it is eased in and out: a short crossfade from the outgoing plate
         into the bridge, the bridge alone through the middle, and a short
         crossfade out to the incoming plate. */
      const bIdx = c.bridge ? bridgeSlot.get(c.bridge) : undefined;
      if (bIdx !== undefined && dissolving) {
        const RAMP = 0.18;
        const m = c.mix;
        scrubAt[bIdx] = m;
        const bv = bridgeClips[bridges.indexOf(c.bridge as string)];
        if (bv) seek(bIdx, bv);

        if (m < RAMP) {
          state = { ...state, from: c.from, to: bIdx, mix: m / RAMP, trans: 3 };
        } else if (m > 1 - RAMP) {
          state = { ...state, from: bIdx, to: c.to, mix: (m - (1 - RAMP)) / RAMP, trans: 3 };
        } else {
          state = { ...state, from: bIdx, to: bIdx, mix: 0, trans: 2 };
        }
      }

      /* Each plate owns the stretch of runway between its own cue and the next,
         so that segment's progress is the clip's timeline. The incoming plate
         of a dissolve has not started its stretch yet and sits at its first
         frame, which is what makes the handover read as one continuous shot. */
      scrubAt[c.from] = c.seg;
      if (c.to !== c.from) scrubAt[c.to] = 0;

      if (changed) audition();
      else {
        for (const i of [c.from, c.to]) {
          const v = clips[i];
          if (v && PLATES[i].scrub) seek(i, v);
        }
      }
    });

    /* Read-only probe. The clips live outside the DOM, so without this there is
       no way to tell a frozen clip from a moving one - the camera keeps
       drifting either way, which is exactly how a freeze went unnoticed. */
    (window as unknown as { stageClipTimes?: () => (number | null)[] }).stageClipTimes = () =>
      clips.map((c) => (c ? +c.currentTime.toFixed(3) : null));

    const tick = () => {
      if (!alive || !stage) return;
      if (!dirty && !dissolving && !playing) return;
      stage.render(state, gsap.ticker.time);
      dirty = dissolving;
    };
    gsap.ticker.add(tick);

    // Nothing should keep decoding in a background tab. rAF stops on its own;
    // a playing video does not.
    const onVisibility = () => {
      audition();
      dirty = true;
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Stills load in parallel and the first render waits for all of them. A
    // stage that pops in one painting at a time as the network answers looks
    // broken in a way that a half-second of ground colour does not.
    void Promise.all(PLATES.map((p) => loadPlate(p)))
      .then((sources) => {
        if (!alive || !stage) return;
        // the plate's measured tone, not its token - see Plate.tone
        stage.setPlates(sources.map((source, i) => ({ source, ground: PLATES[i].tone })));
        dirty = true;
        return loadClips().then(loadBridges);
      })
      .catch(() => {});

    /** Bridges load last: they are the least essential thing on the page. */
    async function loadBridges() {
      if (!wantsFilm()) return;
      for (let i = 0; i < bridges.length; i++) {
        if (!alive) return;
        try {
          const v = await loadMotion({ motion: bridges[i] } as never);
          if (!alive) {
            v.removeAttribute("src");
            v.load();
            return;
          }
          v.loop = false;
          if (!stage) return;
          bridgeClips[i] = v;
          const slot = stage.addSlot(PLATES[0].tone);
          bridgeSlot.set(bridges[i], slot);
          while (scrubAt.length <= slot) scrubAt.push(0);
          v.addEventListener("seeked", () => onSettled(slot, v));
          stage.setMotion(slot, v, () => {
            dirty = true;
          });
          dirty = true;
        } catch {
          /* no bridge; the cue falls back to its shader handover */
        }
      }
    }

    /**
     * Clips load nearest-first, re-deciding after every one.
     *
     * They used to load in fixed scroll order, which is only the right order
     * for a visitor who waits at the top. Anyone who starts scrolling
     * immediately outruns the queue and watches stills go by while the loader
     * is still fetching chapter two. Re-reading the playhead between loads
     * means whatever you are actually looking at is fetched next.
     */
    async function loadClips() {
      // nothing to wait for when the stills are the whole design
      if (!wantsFilm()) return markFilmReady();

      const pending = new Set<number>();
      PLATES.forEach((pl, i) => {
        if (pl.motion) pending.add(i);
      });
      bridges.forEach((_, i) => pending.add(PLATES.length + i));

      const cueOf = (i: number) =>
        i < PLATES.length
          ? PLATE_CUES.find((c) => c.plate === PLATES[i].id)?.at ?? 0
          : PLATE_CUES.find((c) => c.bridge === bridges[i - PLATES.length])?.at ?? 0;

      /** The pending clip whose cue is nearest the playhead right now. */
      const nearest = () => {
        const here = getStageProgress();
        let best = -1;
        let bestD = Infinity;
        for (const i of pending) {
          const d = Math.abs(cueOf(i) - here);
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        }
        return best;
      };

      const one = async (i: number) => {
        try {
          if (i < PLATES.length) {
            const v = await loadMotion(PLATES[i]);
            if (!alive) {
              v.removeAttribute("src");
              v.load();
              return;
            }
            clips[i] = v;
            /* Without this the clip seeks exactly once and then freezes: `pump`
               marks the slot as seeking and only `onSettled` clears it, so a
               missing listener means every later seek is skipped silently. */
            v.addEventListener("seeked", () => onSettled(i, v));
            stage?.setMotion(i, v, () => {
              dirty = true;
            });
            // the opening plate moving is the only thing the loader waits on
            if (i === 0) markFilmReady();
          } else {
            const bi = i - PLATES.length;
            const v = await loadMotion({ motion: bridges[bi] } as never);
            if (!alive) {
              v.removeAttribute("src");
              v.load();
              return;
            }
            bridgeClips[bi] = v;
            const slot = bridgeSlot.get(bridges[bi]);
            if (slot !== undefined) {
              v.addEventListener("seeked", () => onSettled(slot, v));
              stage?.setMotion(slot, v, () => {
                dirty = true;
              });
            }
          }
          audition();
          dirty = true;
        } catch {
          /* no clip for this one; the still stands */
        }
      };

      /* Three at a time. Strictly sequential was the right priority order and
         the wrong throughput — one request at a time leaves most of the
         connection idle, and the last clip landed a minute in. Priority is
         re-read every time a lane frees, so whatever you are looking at is
         still fetched first. */
      const LANES = 3;
      const lanes: Promise<void>[] = [];
      const run = async () => {
        while (alive && pending.size) {
          const i = nearest();
          if (i < 0) return;
          pending.delete(i);
          await one(i);
        }
      };
      for (let k = 0; k < LANES; k++) lanes.push(run());
      await Promise.all(lanes);
    }

    return () => {
      alive = false;
      unsub();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      gsap.ticker.remove(tick);
      // release the decoders, or they outlive the component
      for (const v of clips) {
        if (!v) continue;
        v.pause();
        v.removeAttribute("src");
        v.load();
      }
      stage.destroy();
    };
  }, [onUnavailable]);

  return <canvas ref={canvas} className="plate-gl" aria-hidden="true" />;
}
