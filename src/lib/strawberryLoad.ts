"use client";

/**
 * Whether the opening plate's clip has arrived.
 *
 * Deliberately the narrowest possible signal: the loader only needs to know
 * when the first plate can move, not how the whole download is going. Anything
 * richer would invite a progress bar that measures ninety megabytes nobody is
 * waiting for.
 */

type Listener = (firstReady: boolean) => void;

const listeners = new Set<Listener>();
let firstReady = false;

export const isFilmReady = () => firstReady;

export function markFilmReady() {
  if (firstReady) return;
  firstReady = true;
  listeners.forEach((fn) => fn(true));
}

export function subscribeFilm(fn: Listener) {
  listeners.add(fn);
  fn(firstReady);
  return () => {
    listeners.delete(fn);
  };
}

/** A second mount must not inherit the previous one's state. */
export function resetFilm() {
  firstReady = false;
}
