import { PLATE_CUES, PLATES, PLATE_BY_ID, type Ground } from "@/data/strawberry";

/** How much of the runway one plate takes to hand over to the next. */
export const DISSOLVE = 0.026;

/**
 * The iris gets roughly twice the runway of a dissolve.
 *
 * A halftone dissolve reads at any speed because it is a texture effect - it
 * looks the same at every moment. The iris is a movement, and a movement given
 * only 400px of scroll is over before it registers as one.
 */
export const IRIS = 0.055;

/**
 * A bridge is a whole filmed shot, so it needs the most runway of the three -
 * it has a beginning, a middle and an end to get through, where a dissolve only
 * has a strength.
 */
export const BRIDGE = 0.075;

const INDEX_OF = new Map(PLATES.map((p, i) => [p.id, i]));

export type Cue = {
  /** Index into `PLATES` of the outgoing plate. */
  from: number;
  /** Index of the incoming one. Equal to `from` when nothing is handing over. */
  to: number;
  /** 0 while settled on `from`, 1 once settled on `to`. */
  mix: number;
  /** Progress through the segment the outgoing plate owns, for parallax. */
  seg: number;
  /** Which cue index we are in, so each segment can drift its own way. */
  segIndex: number;
  /**
   * The incoming segment's own progress, and its index.
   *
   * The parallax has to be blended from `seg`/`segIndex` to these across the
   * handover. Without it the camera reads `seg` alone, which snaps 1 -> 0 at
   * every boundary while `dir` simultaneously flips sign - a hard cut in zoom
   * and pan that looks like a jump cut in the footage.
   */
  segTo: number;
  segIndexTo: number;
  /** How the handover into `to` is drawn. */
  via: "dissolve" | "iris" | "bridge";
  /** The bridge clip's source, when `via` is "bridge". */
  bridge?: string;
};

/**
 * Resolves the playhead to a pair of plates and the dissolve between them.
 *
 * Both the renderer and the copy layers need this - the renderer to blend two
 * textures, the copy to know whether it is currently standing on a cream ground
 * or a bone one - so it is computed in one place and read twice rather than
 * derived twice with two chances to disagree.
 */
const widthOf = (cue: { via?: "dissolve" | "iris" | "bridge" }) =>
  cue.via === "bridge" ? BRIDGE : cue.via === "iris" ? IRIS : DISSOLVE;

/** Where cue `i`'s own stretch ends - the moment its handover starts. */
function endOf(i: number) {
  const next = PLATE_CUES[i + 1];
  return next ? next.at - widthOf(next) / 2 : 1;
}

/** Progress through cue `i`'s stretch, clamped to 0-1. */
function progressIn(i: number, p: number) {
  const start = PLATE_CUES[i].at;
  const end = endOf(i);
  return end > start ? Math.min(1, Math.max(0, (p - start) / (end - start))) : 0;
}

const ease = (raw: number) =>
  raw <= 0 ? 0 : raw >= 1 ? 1 : raw * raw * (3 - 2 * raw);

export function cueAt(p: number): Cue {
  // the last cue whose start we have passed
  let i = 0;
  for (let k = 0; k < PLATE_CUES.length; k++) {
    if (p >= PLATE_CUES[k].at) i = k;
  }

  /* A handover window is centred on the cue it arrives at, so half of it lies
     *after* that cue. Without this branch the segment index advances at the
     cue, `from` becomes the incoming plate and the mix resets - which snapped
     every handover at its own midpoint and threw away the second half. */
  const wIn = widthOf(PLATE_CUES[i]);
  if (i > 0 && p < PLATE_CUES[i].at + wIn / 2) {
    const prev = PLATE_CUES[i - 1];
    const mix = ease((p - (PLATE_CUES[i].at - wIn / 2)) / wIn);
    return {
      from: INDEX_OF.get(prev.plate) ?? 0,
      to: INDEX_OF.get(PLATE_CUES[i].plate) ?? 0,
      mix,
      // the outgoing plate has run out its own stretch by now
      seg: 1,
      segIndex: i - 1,
      // the incoming one has already started its own, which is what the
      // parallax blends toward so the camera never jumps at the boundary
      segTo: progressIn(i, p),
      segIndexTo: i,
      via: PLATE_CUES[i].via ?? "dissolve",
      bridge: PLATE_CUES[i].bridge,
    };
  }

  const from = INDEX_OF.get(PLATE_CUES[i].plate) ?? 0;
  const next = PLATE_CUES[i + 1];

  /* A plate's stretch ends when its handover BEGINS, not at the next cue.
     A scrubbed clip is driven by this, and its action has to have finished
     before the transition starts pulling the plate apart - a curtain still
     closing while the iris is already opening through it reads as two things
     fighting rather than one following the other. */
  const seg = progressIn(i, p);

  if (!next)
    return { from, to: from, mix: 0, seg, segIndex: i, segTo: seg, segIndexTo: i, via: "dissolve" };

  const mix = ease((p - (next.at - widthOf(next) / 2)) / widthOf(next));
  const to = INDEX_OF.get(next.plate) ?? from;

  return {
    from,
    to: mix > 0 ? to : from,
    mix,
    seg,
    segIndex: i,
    // before the next cue this clamps to 0, which is exactly where the
    // trailing branch picks it up on the other side of the boundary
    segTo: progressIn(i + 1, p),
    segIndexTo: i + 1,
    via: next.via ?? "dissolve",
    bridge: next.bridge,
  };
}

/**
 * The ground the stage currently resolves to.
 *
 * The flip happens at the halfway point of a dissolve, not at its end: past
 * halfway the incoming plate is the one the copy has to stay legible against.
 */
export function groundAt(p: number): Ground {
  const c = cueAt(p);
  const cue = c.mix > 0.5 && PLATE_CUES[c.segIndex + 1]
    ? PLATE_CUES[c.segIndex + 1]
    : PLATE_CUES[c.segIndex];
  return PLATE_BY_ID[cue.plate]?.ground ?? PLATES[0].ground;
}
