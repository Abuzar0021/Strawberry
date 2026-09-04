"use client";

import { stagger } from "@/hooks/strawberry/useScene";

/**
 * Reveal helpers for split text.
 *
 * The node lists are cached per layer. Re-running `querySelectorAll` inside a
 * frame callback is the classic way to turn a cheap transform write into a
 * layout read, and a headline of 22 characters would do it sixty times a second
 * for the length of a chapter.
 */
const cache = new WeakMap<HTMLElement, Map<string, HTMLElement[]>>();

export function nodes(el: HTMLElement, selector: string): HTMLElement[] {
  let per = cache.get(el);
  if (!per) cache.set(el, (per = new Map()));
  let found = per.get(selector);
  if (!found) per.set(selector, (found = Array.from(el.querySelectorAll<HTMLElement>(selector))));
  return found;
}

/** Characters rise into place, one after another, over the front of the scene. */
export function revealChars(el: HTMLElement, t: number, span = 0.42) {
  const list = nodes(el, ".ch");
  for (let i = 0; i < list.length; i++) {
    const k = stagger(t, i, list.length, span);
    list[i].style.opacity = String(k);
    list[i].style.transform = `translate3d(0, ${(1 - k) * 0.42}em, 0)`;
  }
}

/** Lines slide out from behind their own mask. */
export function revealLines(el: HTMLElement, t: number, span = 0.4, selector = ".ln > i") {
  const list = nodes(el, selector);
  for (let i = 0; i < list.length; i++) {
    const k = stagger(t, i, list.length, span, 0.62);
    list[i].style.transform = `translate3d(0, ${(1 - k) * 105}%, 0)`;
  }
}

/** Everything else - chips, paragraphs, buttons - fades up as a group. */
export function revealBlocks(el: HTMLElement, t: number, span = 0.46, selector = "[data-rise]") {
  const list = nodes(el, selector);
  for (let i = 0; i < list.length; i++) {
    const k = stagger(t, i, list.length, span, 0.6);
    list[i].style.opacity = String(k);
    list[i].style.transform = `translate3d(0, ${(1 - k) * 18}px, 0)`;
  }
}
