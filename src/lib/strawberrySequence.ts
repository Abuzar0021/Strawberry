/**
 * Frame sequences.
 *
 * The plates are scrubbed as sequences of ordinary images rather than by
 * seeking a video. A video has to be fetched, buffered and seeked before it can
 * show the frame you asked for, and every one of those steps can stall; an
 * image is complete the moment it lands and drawing it is free. That is the
 * difference between motion arriving in seconds and motion arriving when the
 * download finishes.
 *
 * Frames are fetched coarse-first: a scattered handful across the whole clip so
 * the motion works immediately, then the gaps fill in behind. Asking for a
 * frame that has not arrived yet returns the nearest one that has, so the
 * sequence is always playable and simply gets finer.
 */

export type Sequence = {
  base: string;
  n: number;
  imgs: (HTMLImageElement | null)[];
  /** The pair currently on the GPU, so nothing is uploaded twice. */
  ia: number;
  ib: number;
  frac: number;
  loaded: number;
  /** Which frames have been replaced by their sharp version, and how many. */
  hi: boolean[];
  sharp: number;
};

export function createSequence(base: string, n: number): Sequence {
  return {
    base,
    n,
    imgs: new Array(n).fill(null),
    hi: new Array(n).fill(false),
    ia: -1,
    ib: -1,
    frac: 0,
    loaded: 0,
    sharp: 0,
  };
}

/** The two frames a position falls between, and how far between them it is. */
export type Pair = {
  ia: number;
  a: HTMLImageElement;
  ib: number;
  b: HTMLImageElement | null;
  frac: number;
};

/**
 * Where a frame lives.
 *
 * Every frame exists twice. The light one is 640px, which is native on a phone
 * and a little soft on a desktop, and the whole film of them is 15MB - four
 * times lighter than the sharp set, so it is complete and scrubbing while the
 * sharp set would still be arriving. The sharp one is 1280px and replaces it in
 * place afterwards, on screens wide enough to tell.
 *
 * That ordering is the point. A sharp frame that has not downloaded is not a
 * sharp frame, it is a missing one, and a missing frame is what choppy means.
 */
export const framePath = (base: string, i: number, sharp = false) =>
  `/strawberry/frames/${base}/${sharp ? "hi/" : ""}${String(i).padStart(3, "0")}.webp`;

/**
 * The order frames are fetched in, split into generations.
 *
 * The first generation is a handful of frames strided across the whole clip -
 * enough to scrub it end to end on its own. Each generation after that halves
 * the stride, so the clip refines evenly rather than sharpening from the left
 * while its ending still steps. The caller drains one generation across every
 * clip before starting the next, which is what stops the opening chapter being
 * perfected while the closing one has nothing at all.
 *
 * A generation is the unit deliberately: the gap between "the first chapter
 * moves" and "every chapter moves" is the whole of a visitor's patience, and
 * halving the first download halves that gap.
 */
export function fetchGenerations(n: number, coarse = 5): number[][] {
  if (n <= 0) return [];
  const seen = new Set<number>();
  const gens: number[][] = [];

  const take = (stride: number) => {
    const gen: number[] = [];
    for (let i = 0; i < n; i += stride) if (!seen.has(i)) (seen.add(i), gen.push(i));
    if (!seen.has(n - 1)) (seen.add(n - 1), gen.push(n - 1));
    if (gen.length) gens.push(gen);
  };

  let stride = Math.max(1, Math.floor(n / coarse));
  take(stride);
  while (stride > 1) take((stride = Math.max(1, stride >> 1)));

  const rest: number[] = [];
  for (let i = 0; i < n; i++) if (!seen.has(i)) rest.push(i);
  if (rest.length) gens.push(rest);
  return gens;
}

export function loadFrame(seq: Sequence, i: number, sharp = false): Promise<void> {
  return new Promise((resolve) => {
    // a light frame is worth loading only if nothing is there; a sharp one is
    // worth loading unless the sharp one is already there
    if (sharp ? seq.hi[i] : seq.imgs[i]) return resolve();
    const img = new Image();
    img.decoding = "async";
    img.src = framePath(seq.base, i, sharp);
    const done = () => {
      if (!seq.imgs[i]) seq.loaded++;
      seq.imgs[i] = img;
      if (sharp && !seq.hi[i]) {
        seq.hi[i] = true;
        seq.sharp++;
      }
      resolve();
    };
    img
      .decode()
      .then(done)
      .catch(() => resolve());
  });
}

/**
 * The two loaded frames a position falls between.
 *
 * Not the nearest single frame: the renderer blends the pair, so what matters
 * is which two it sits between and how far along. Both are found by searching
 * outward from the wanted position, which means a sequence that has only its
 * coarse pass still moves - the pair just spans a wider gap, and the motion
 * gets more literal as the frames between them arrive rather than less jerky.
 */
export function framePairAt(seq: Sequence, t: number): Pair | null {
  if (!seq.n) return null;
  const x = Math.max(0, Math.min(seq.n - 1, t * (seq.n - 1)));

  let lo = -1;
  for (let i = Math.floor(x); i >= 0; i--)
    if (seq.imgs[i]) {
      lo = i;
      break;
    }
  let hi = -1;
  for (let i = Math.ceil(x); i < seq.n; i++)
    if (seq.imgs[i]) {
      hi = i;
      break;
    }

  if (lo < 0 && hi < 0) return null;
  if (lo < 0) return { ia: hi, a: seq.imgs[hi]!, ib: hi, b: null, frac: 0 };
  if (hi < 0 || hi === lo) return { ia: lo, a: seq.imgs[lo]!, ib: lo, b: null, frac: 0 };

  return {
    ia: lo,
    a: seq.imgs[lo]!,
    ib: hi,
    b: seq.imgs[hi]!,
    frac: (x - lo) / (hi - lo),
  };
}
