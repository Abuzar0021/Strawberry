"use client";

import { BRAND } from "@/data/strawberry";

/**
 * The floating apply pill.
 *
 * Fixed to the bottom of the viewport, and the reason it is wrapped rather
 * than positioned directly is mobile: a fixed element pinned with `bottom`
 * alone is re-laid-out every time the URL bar collapses or returns, which on
 * an address-bar-hiding browser is on every scroll gesture, and it reads as the
 * button twitching. The wrapper owns the position and never changes; the pill
 * inside it owns the paint. `will-change: transform` puts the pair on their own
 * layer so neither is re-rasterised when the page behind them scrolls.
 *
 * The offset is `env(safe-area-inset-bottom)` so it clears a home indicator
 * rather than sitting under it.
 */
export function ApplyPill({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="pill-dock">
      <button
        type="button"
        className="pill t-mono"
        onClick={onOpen}
        aria-label={`Apply to work with ${BRAND.name}`}
      >
        Apply
      </button>
    </div>
  );
}
