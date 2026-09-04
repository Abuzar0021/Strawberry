"use client";

import { useEffect, useState } from "react";
import { subscribeFilm } from "@/lib/strawberryLoad";
import { LOADING } from "@/data/strawberry";

/**
 * The opening hold.
 *
 * It waits for the first plate's clip and nothing more. Waiting for all twelve
 * would be honest about the download and wrong about the experience: only the
 * opening plate is on screen at the start, and the rest arrive long before the
 * scroll reaches them.
 *
 * It also gets out of the way on its own after a moment, because a loader that
 * can outstay a slow connection is worse than a still that never had one.
 */
export function Loader() {
  const [gone, setGone] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stop = subscribeFilm((first) => {
      if (first) setReady(true);
    });
    // never hold the page hostage to a slow network
    const bail = setTimeout(() => setReady(true), 4000);
    return () => {
      stop();
      clearTimeout(bail);
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    // let the fade finish before the element leaves the tree
    const t = setTimeout(() => setGone(true), 700);
    return () => clearTimeout(t);
  }, [ready]);

  if (gone) return null;

  return (
    <div className="loader" data-ready={ready ? "1" : "0"} aria-hidden={ready}>
      <p className="loader-word t-display">{LOADING.word}</p>
      <p className="loader-sub t-mono">{LOADING.sub}</p>
      <span className="loader-rule" />
    </div>
  );
}
