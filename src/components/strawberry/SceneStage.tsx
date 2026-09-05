"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { gsap } from "@/lib/gsap";
import { FRAG, VERT } from "@/lib/sceneShader";
import { onStageFrame, subscribeStage } from "@/hooks/strawberry/useStrawberryScrub";
import { SCENES_FILM, SCENE_OVERLAY } from "@/data/strawberry";

/**
 * The video stage.
 *
 * Nine films, each playing at its own rate as a `VideoTexture`, with scroll
 * deciding only which two are bound and how far through the handover between
 * them it has got. Nothing is seeked: setting `currentTime` from a scroll
 * handler has to find a keyframe and decode forward to the frame asked for, and
 * none of that is bounded by the frame budget. A playing video is decoded
 * off-thread and the texture upload is the only cost this code carries.
 *
 * Three rules govern the memory, and they matter more than the effect does:
 * only what is near the playhead exists, everything else is disposed outright,
 * and the shader never sees fewer than two live textures.
 */

/** Share of a film's slice given over to the transition out of it. */
const HANDOVER = 0.3;
/** How far ahead of the playhead a film is created. */
const REACH = 1;
/** The overlay lives at this key; the films use their own indices. */
const OVERLAY_KEY = -1;

type Slot = { video: HTMLVideoElement; texture: THREE.VideoTexture };

export function SceneStage({ onUnavailable }: { onUnavailable: () => void }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const mount: HTMLDivElement = el;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: false,
        alpha: false,
        powerPreference: "high-performance",
      });
    } catch {
      onUnavailable();
      return;
    }
    /* Caps the drawing buffer on a 3x phone at 1.5x. Past that, the fragment
       cost of a full-screen shader is what makes a handset hot and eventually
       drops its context - not the video decode, which runs on dedicated
       silicon and barely registers. */
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // one opaque pixel, so a uniform is never null between disposals
    const blank = new THREE.DataTexture(new Uint8Array([10, 9, 8, 255]), 1, 1);
    blank.needsUpdate = true;

    const uniforms = {
      u_texCurrent: { value: blank as THREE.Texture },
      u_texNext: { value: blank as THREE.Texture },
      u_texOverlay: { value: blank as THREE.Texture },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uAspectA: { value: new THREE.Vector2(1, 1) },
      uAspectB: { value: new THREE.Vector2(1, 1) },
      uAspectOverlay: { value: new THREE.Vector2(1, 1) },
      uOverlayMix: { value: 0 },
      uProgress: { value: 0 },
      uTime: { value: 0 },
      uBlock: { value: 26 },
      uSplit: { value: 0.022 },
      uBreath: { value: 0.0035 },
    };

    const material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms,
      depthTest: false,
    });
    const geometry = new THREE.PlaneGeometry(2, 2);
    scene.add(new THREE.Mesh(geometry, material));

    /* Live slots, keyed by index into the sequence. Nothing outside this map
       exists: no element, no texture, no decoder, no buffered bytes. */
    const slots = new Map<number, Slot>();
    let alive = true;

    function open(key: number, src: string): Slot {
      const found = slots.get(key);
      if (found) return found;
      const video = document.createElement("video");
      video.src = src;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = "auto";
      video.crossOrigin = "anonymous";
      video.setAttribute("aria-hidden", "true");
      /* In the document, but out of the way.
         A detached video element is not reliably decoded - Chrome will report
         it as playing while never producing a frame, so the texture stays black
         and nothing says why. `display: none` does the same thing for the same
         reason. One transparent pixel in the corner keeps it a rendered element
         without any of it being visible. */
      video.className = "scene-src";
      mount.appendChild(video);

      const texture = new THREE.VideoTexture(video);
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      texture.colorSpace = THREE.SRGBColorSpace;

      const slot: Slot = { video, texture };
      slots.set(key, slot);
      return slot;
    }

    /**
     * Frees a film completely.
     *
     * `dispose()` returns the GPU memory. Detaching `src` and calling `load()`
     * is what returns the decoder and the buffered bytes, which is the larger
     * figure and the one a phone runs out of first - disposing the texture
     * alone leaves the video buffering away in the background.
     */
    function close(key: number) {
      const slot = slots.get(key);
      if (!slot) return;
      slot.video.pause();
      slot.texture.dispose();
      slot.video.removeAttribute("src");
      slot.video.load();
      slot.video.remove();
      slots.delete(key);
    }

    const aspectOf = (v: HTMLVideoElement, out: THREE.Vector2) => {
      const vw = v.videoWidth || 16;
      const vh = v.videoHeight || 9;
      const view = renderer.domElement.width / renderer.domElement.height;
      const tex = vw / vh;
      if (tex > view) out.set(tex / view, 1);
      else out.set(1, view / tex);
    };

    const fit = () => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      renderer.setSize(r.width, r.height, false);
      uniforms.uResolution.value.set(renderer.domElement.width, renderer.domElement.height);
      // the block grid is tied to the short edge, so the mosh is the same size
      // on a phone as on a desktop rather than a different effect entirely
      uniforms.uBlock.value = Math.max(14, Math.min(r.height, r.width) / 26);
    };
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    fit();

    // Only the first two exist at load. Everything else is made on approach.
    const first = open(0, SCENES_FILM[0]);
    const second = open(1, SCENES_FILM[1]);
    uniforms.u_texCurrent.value = first.texture;
    uniforms.u_texNext.value = second.texture;
    void first.video.play().catch(() => {});

    const n = SCENES_FILM.length;
    let playing = new Set<number>([0]);
    const wake = (want: Set<number>) => {
      for (const k of playing) if (!want.has(k)) slots.get(k)?.video.pause();
      for (const k of want) {
        if (!playing.has(k)) void slots.get(k)?.video.play().catch(() => {});
      }
      playing = want;
    };

    const unsub = subscribeStage((p) => {
      // every film owns an equal share of the scroll height
      const x = Math.max(0, Math.min(0.99999, p)) * n;
      const i = Math.floor(x);
      const local = x - i;

      /* The ping-pong. `current` is the film being left and `next` the one
         being arrived at. When the scroll crosses into the following slice the
         index advances, progress falls back to zero, and what was `next`
         becomes `current` - neither texture is created or destroyed to do it,
         which is what stops a black frame appearing at the seam. */
      const current = Math.min(i, n - 1);
      const next = Math.min(i + 1, n - 1);
      const t = local < 1 - HANDOVER ? 0 : (local - (1 - HANDOVER)) / HANDOVER;

      // created on approach, never on demand in the middle of a blend
      const keep = new Set<number>();
      for (let k = current; k <= Math.min(current + REACH, n - 1); k++) {
        open(k, SCENES_FILM[k]);
        keep.add(k);
      }

      const a = slots.get(current)!;
      const b = slots.get(next) ?? a;
      uniforms.u_texCurrent.value = a.texture;
      uniforms.u_texNext.value = b.texture;
      uniforms.uProgress.value = t;
      aspectOf(a.video, uniforms.uAspectA.value);
      aspectOf(b.video, uniforms.uAspectB.value);

      /* The layered section: two films on one slice, screened together rather
         than following one another. It swells in and out within its own slice,
         so it has finished before the handover at the end of that slice begins
         and the two effects never fight. */
      let overlay = 0;
      if (current === SCENE_OVERLAY.at) {
        overlay = Math.sin(Math.min(1, local / (1 - HANDOVER)) * Math.PI);
        const o = open(OVERLAY_KEY, SCENE_OVERLAY.src);
        keep.add(OVERLAY_KEY);
        uniforms.u_texOverlay.value = o.texture;
        aspectOf(o.video, uniforms.uAspectOverlay.value);
      }
      uniforms.uOverlayMix.value = overlay;

      /* Anything the playhead has left is freed outright - unless it is still
         bound to a uniform, because disposing a bound texture is a black
         frame. */
      for (const k of [...slots.keys()]) {
        if (keep.has(k)) continue;
        const tex = slots.get(k)!.texture;
        if (tex === uniforms.u_texCurrent.value || tex === uniforms.u_texNext.value) continue;
        if (tex === uniforms.u_texOverlay.value) uniforms.u_texOverlay.value = blank;
        close(k);
        playing.delete(k);
      }

      // the film being arrived at stays paused until the transition starts
      const want = new Set<number>([current]);
      if (t > 0) want.add(next);
      if (overlay > 0.001) want.add(OVERLAY_KEY);
      wake(want);
    });

    /* Drawn every frame, not only when the scroll moves. The idle swell and
       the video decode both advance on their own, so a dirty flag here would
       freeze the picture the moment the reader stopped scrolling. */
    const unhook = onStageFrame(() => {
      if (!alive) return;
      uniforms.uTime.value = gsap.ticker.time;
      renderer.render(scene, camera);
    });

    return () => {
      alive = false;
      unsub();
      unhook();
      ro.disconnect();
      for (const k of [...slots.keys()]) close(k);
      blank.dispose();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [onUnavailable]);

  return <div ref={host} className="plate-gl" aria-hidden="true" />;
}
