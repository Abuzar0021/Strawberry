# Moving plates — all nine

**The engine is done and tested.** Drop nine `.mp4` files in this directory with
the names below and they take over automatically. No code change.

How it behaves: the still loads first and is what the stage opens on; each clip
replaces its plate as a texture once it has decoded a frame. Only the two plates
on screen ever play — everything else is paused with its decoder idle — so nine
clips cost the same at runtime as two. A missing or broken clip silently leaves
that plate as its still.

Workflow assumed here: **one start image plus a prompt**, through the Flow agent.
No end frame.

---

## Two rules

**1. Do not re-describe the subject.** The start image supplies it. Every noun
you add is an invitation to reinvent something, and what comes back is a face
that drifts or a robe that changes colour. Say what moves, how much, and what
stays still. Two sentences is usually right.

**2. Nothing may travel.** With only a start frame there is no way to force the
clip back to where it began, so every prompt below describes motion that
*oscillates* — out and back, brighten and dim, sway and return. Nothing pours,
nothing completes, nothing ends up somewhere new.

The second rule is not stylistic. It is what makes the encode step work.

## The loop is made at encode time, not in the prompt

Without an end frame the clip stops wherever it stops, and a straight loop jumps
visibly every few seconds. The fix: **append a reversed copy of the clip to
itself.** The result is seamless by construction — the last frame *is* the first
frame.

That is why the motion has to oscillate. Reversed breathing is still breathing;
reversed pouring is water climbing back into a can.

Generate **4–6 seconds**. The ping-pong doubles it, and a shorter clip has less
time to drift off-model.

## The suffix — paste onto every prompt

> Static locked-off camera: no pan, no tilt, no dolly, no zoom, no push-in, no
> handheld drift. The background stays completely still. Motion is slow, small
> and continuous, and returns to where it started — nothing travels across the
> frame and no action completes. One unbroken shot, no cuts. The painting's
> canvas weave and brushwork stay fixed to the frame and do not crawl or slide.
> No text. Silent.

Three of those earn their place:

- **Locked-off camera.** The shader already applies its own push-in and parallax
  per segment. A clip that also drifts compounds with it into seasickness.
- **Background completely still.** The halftone pass mixes each plate toward its
  measured tone. A moving ground makes the dissolve show a crawling seam.
- **Weave fixed to the frame.** Painterly texture boiling is the clearest tell
  that a painting is AI video.

---

## The nine

Start images are in `C:\Users\omnis\Downloads\plates-for-flow\`.

### 1 · `01-hero-curtain.jpeg` → `hero-curtain.mp4`
> The heavy curtain breathes — its folds swell an inch and settle back. The red
> sash and the hem of the white robe lift faintly and fall. The woman holds her
> position and her grip on the curtain.

### 2 · `02-model-graft.jpeg` → `model-graft.mp4`
> The fingers press very slightly down on the peg and ease off again, the small
> plantlet nodding once and settling. The hands stay where they are.

### 3 · `03-model-ladder.jpeg` → `model-ladder.mp4`
> The crowd shifts weight and resettles, robes stirring, one or two heads tilting
> up and back down. Nobody moves from their place. The figure on the plinth stays
> completely still.

### 4 · `04-model-cut.jpeg` → `model-cut.mp4`
> The light travels slowly across the gilded fruit and back, the gold brightening
> and dulling as it turns a few degrees in her hand. The knife stays where it is.
> Her head and body do not move.

### 5 · `05-work-pear.jpeg` → `work-pear.mp4`
> The screened fruit rocks a few degrees on its vertical axis and back, the
> printed dot grid sliding across its surface and returning. The dots stay crisp
> and regular. The halftone clouds breathe very slightly larger and smaller.

### 6 · `06-terms-orbit.jpeg` → `terms-orbit.mp4`
> The suspended fruit rises and falls a few millimetres and turns slightly one
> way then the other, as if weightless. The halo of light around it brightens and
> dims in the same rhythm. The dark red drapery sways and returns.

### 7 · `07-faq-canopy.jpeg` → `faq-canopy.mp4`
> A light breeze lifts the leaves framing the edges and lets them fall back; the
> hanging fruit swing a little on their stems and settle. The cloud in the open
> centre swells and thins without moving across the sky.

### 8 · `08-apply-sapling.jpeg` → `apply-sapling.mp4`
> The long runner and the white flowers sway to the right and back once. The
> stars pulse and twinkle at different rates. The fine constellation lines stay
> perfectly fixed.

### 9 · `09-footer-grove.jpeg` → `footer-grove.mp4`
> Both figures breathe — drapery stirring, the woman's grip shifting slightly on
> the watering can, the man's hand hovering over the fruit without closing on it.
> The strawberry leaves move faintly. Nothing is poured and nothing is picked.

---

## Encoding

`ffmpeg` is installed but **not on PATH**:

```
C:\Users\omnis\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.1-full_build\bin\ffmpeg.exe
```

One command per clip. It strips the audio Veo generates, scales, ping-pongs, and
writes a web-ready file:

```bash
ffmpeg -i in.mp4 -an -filter_complex \
  "[0:v]scale=1280:-2,fps=24,split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1[v]" \
  -map "[v]" -c:v libx264 -crf 23 -pix_fmt yuv420p -movflags +faststart out.mp4
```

**1280 wide, not 1600.** The plates get cover-fitted and pushed in behind type;
1280 is indistinguishable on screen and roughly halves nine files. Target ~1 MB
each — about 9 MB for the set, which is the real cost of doing all nine. If one
lands much above that, raise CRF to 25 before dropping resolution.

`reverse` buffers the whole clip in memory. Fine at 6s and 1280; do not feed it
a 30-second 4K source.

**This recipe is verified.** On a 4s test source it produced exactly 192 frames
(96 x 2), and the loop seam measured a mean channel difference of **0.17**
against a control of **8.98** for two genuinely different frames — i.e. the last
frame and the first frame are identical to within h.264 quantisation noise.

One frame is duplicated at the turnaround (the clip's final frame plays twice as
the direction flips). At 24fps that is a 42ms hold and is not perceptible; if you
ever want it gone, drop the first frame of the reversed segment with
`[b]reverse,select='gt(n\,0)',setpts=N/FRAME_RATE/TB[r]`.

## Verifying

The engine path was tested end to end with a synthetic clip — frames confirmed
reaching the GPU texture, and confirmed static again once the clip was removed.
For your own:

1. Scroll to the plate and watch it for 30 seconds. A ping-ponged clip should
   have no perceptible restart. If you can see one, the motion had net travel
   and the prompt needs tightening, not the encode.
2. Screenshot twice a second apart — differing bytes mean the clip is live.

Watch the handovers too, not just the rest states. A clip is at its most
revealing mid-dissolve, when it is being torn into halftone.

Keep every still. They stay the reduced-motion path and the fallback for any
clip that doesn't work out, and `PLATES` mixes stills and clips freely.

---

## Optional: the hero as a one-shot

The hero is the only plate a visitor always meets from its first frame, so it is
the only one that can carry a real action instead of an oscillation — the curtain
actually drawn aside, playing once and holding.

Single-image generation suits this better than a loop does, since there is no end
frame to fight:

> She draws the curtain aside and completes her step forward, coming to rest.
> The curtain settles behind her and stops moving.

It needs a small engine change — a `once` flag on the plate so it does not loop
or restart — which is about five lines. Ask if you want it; the ambient version
above is a perfectly good hero on its own.
