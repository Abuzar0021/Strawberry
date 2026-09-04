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
};

export function createSequence(base: string, n: number): Sequence {
  return { base, n, imgs: new Array(n).fill(null), ia: -1, ib: -1, frac: 0, loaded: 0 };
}

/** The two frames a position falls between, and how far between them it is. */
export type Pair = {
  ia: number;
  a: HTMLImageElement;
  ib: number;
  b: HTMLImageElement | null;
  frac: number;
};

/** Where a frame lives. Also used by the layout to preload the opening ones. */
export const framePath = (base: string, i: number) =>
  `/strawberry/frames/${base}/${String(i).padStart(3, "0")}.webp`;

/**
 * The order frames are fetched in.
 *
 * A coarse pass first - every `stride`-th frame - so a handful of images makes
 * the whole clip scrubbable end to end. Then the stride halves, and halves
 * again, until every frame is accounted for. Refining by bisection rather than
 * filling left to right keeps the clip evenly sharp at every moment: the
 * alternative gives you a silky opening and a stuttering ending for as long as
 * the download lasts.
 */
export function fetchOrder(n: number, coarse = 8): number[] {
  const out: number[] = [];
  const seen = new Set<number>();
  const push = (i: number) => {
    if (i >= 0 && i < n && !seen.has(i)) {
      seen.add(i);
      out.push(i);
    }
  };

  let stride = Math.max(1, Math.floor(n / coarse));
  for (let i = 0; i < n; i += stride) push(i);
  push(n - 1);
  while (stride > 1) {
    stride = Math.max(1, stride >> 1);
    for (let i = 0; i < n; i += stride) push(i);
  }
  for (let i = 0; i < n; i++) push(i);
  return out;
}

/** How many entries at the head of `fetchOrder` make up the coarse pass. */
export function coarseCount(n: number, coarse = 8): number {
  if (n <= 0) return 0;
  const stride = Math.max(1, Math.floor(n / coarse));
  // the strided walk, plus the last frame when the walk does not land on it
  return Math.min(n, Math.floor((n - 1) / stride) + 1 + ((n - 1) % stride ? 1 : 0));
}

export function loadFrame(seq: Sequence, i: number): Promise<void> {
  return new Promise((resolve) => {
    if (seq.imgs[i]) return resolve();
    const img = new Image();
    img.decoding = "async";
    img.src = framePath(seq.base, i);
    const done = () => {
      seq.imgs[i] = img;
      seq.loaded++;
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
