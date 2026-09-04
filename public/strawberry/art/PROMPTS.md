# Plate prompts

Nine images. Generate **plate 1 first, approve it, then generate the other eight
with plate 1 attached as a style reference** — prompting nine independently and
hoping they match is the way this goes wrong.

Subjects below are written for **strawberry**. Swap the fruit noun throughout if
the brand changes again; nothing else in a prompt depends on it.

---

## The style sentence — paste verbatim into every prompt

> Oil on canvas in the neoclassical academic manner, c. 1820. Visible canvas
> weave, restrained palette, matte varnish, soft directional daylight from the
> upper left. Painterly but precise; no visible brush texture in the flat areas.

## The rules line — also paste into every prompt

> 16:10 landscape. The background is a single flat uninterrupted [COLOUR] that
> runs to all four edges with no gradient, vignette or border. No text, no
> lettering, no signature, no watermark, no frame.

## Negative prompt (if the tool has a field for it)

```
text, letters, words, signature, watermark, logo, border, frame, collage,
split screen, multiple panels, modern clothing, photorealism, HDR, lens flare
```

---

## The nine

Ground colours are load-bearing — they are the tokens the shader mixes toward
mid-dissolve and the copy picks its ink from. Use these exact hexes.

### 1 · `hero-curtain.webp` — cobalt `#0a5f9e` — **keep the left third empty**

> A young figure in a white classical chiton with a deep red sash, stepping out
> from behind a heavy dark theatrical curtain that is being drawn aside. The
> figure and the curtain occupy the right two thirds of the frame; the left
> third is empty flat ground. A pale marble step runs along the bottom edge.

### 2 · `model-graft.webp` — bone `#dcdcd2` — **keep the left third empty**

> Two hands, close, pegging a strawberry runner into the soil with a small
> wooden pin — a young plantlet on a slender stolon being fixed down to root.
> Hands and plant sit right of centre; the left third is empty flat ground.

### 3 · `model-ladder.webp` — bone `#dcdcd2` — **keep the left third empty**

> A single figure in pale classical dress standing raised on a low stone plinth
> above a loose crowd of smaller robed figures, seen from slightly below. The
> plinth is right of centre; the crowd recedes to the right edge; the left third
> is empty flat ground.

### 4 · `model-cut.webp` — bone `#dcdcd2` — **keep the left third empty**

> A figure in a deep green velvet robe with gold embroidery, in profile, holding
> a single large gilded strawberry in one hand and bringing a small silver knife
> to it with the other. The figure fills the right half; the strawberry sits at
> centre; the left third is empty flat ground.

### 5 · `work-fruit.webp` — cobalt `#0a5f9e` — **subject on the LEFT, copy goes right**

> A single strawberry rendered as a coarse black-and-cream printing halftone —
> visible dot screen, newsprint separation, no smooth shading — set large on the
> left half of the frame. Small halftone clouds float in the upper right. The
> ground is flat uninterrupted blue.

*(If you keep the filename `work-pear.webp`, no code change is needed; if you
rename it, update `PLATES` in `src/data/pear.ts`.)*

### 6 · `terms-orbit.webp` — azure `#0b7baa` — **keep the left third empty**

> A single gilded strawberry suspended in mid-air, lit from within by a soft
> circular halo of pale light, centred slightly right. A length of dark red
> drapery falls from the top right corner. Nothing else in the frame; the left
> third is empty flat ground.

### 7 · `faq-canopy.webp` — cobalt `#0a5f9e` — **keep the centre open**

> Looking up from ground level through strawberry foliage — broad trefoil leaves
> and hanging ripe fruit crowding in from all four edges, framing an open circle
> of clear blue sky at the centre. A small halftone cloud sits high in the
> opening.

### 8 · `apply-sapling.webp` — night `#073568` — **keep the left third empty**

> A single young strawberry plant with one long runner reaching out to the
> right, seen against a deep night-blue sky scattered with stars linked by fine
> constellation lines. The plant is right of centre; the left third is empty
> flat ground.

### 9 · `footer-grove.webp` — cobalt `#0a5f9e` — **keep the centre clear for the wordmark**

> Two figures in classical dress facing one another across a low bed of bearing
> strawberry plants — one on the left with a brass watering can, one on the
> right in a green robe reaching to pick. They stand at the far left and far
> right edges; the centre of the frame is open flat blue sky with a small
> halftone cloud near the top.

---

## Getting them made

**Route A — Flow (recommended for a set).** Google's filmmaking workspace, with
Nano Banana as its built-in image engine. The reason to prefer it here is
**ingredients / references**: generate plate 1, then attach it as a reference on
the other eight so the whole set holds one light and one palette. Flow also has
Veo if you decide any plate should be a slow moving loop — the stage takes a
`<video>` as a texture with no other change.

**Route B — Gemini app or Google AI Studio.** Faster for iterating on one plate.
Ask for 16:10 explicitly; the default tends to square. AI Studio also hands you
the API call, which is how you'd batch the remaining eight once plate 1 is
locked.

Either way the underlying model is the same family, so pick on workflow, not
quality. The premium image tier buys more precision on brand consistency; the
default is plenty for artwork that gets halftoned and pushed behind type.

## After generation

1. Convert to `.webp` at ~85 quality — these are full-bleed and there are nine.
2. **Sample the corner pixels** against the ground hex above. Do not eyeball it;
   a corner that disagrees shows a visible seam mid-dissolve.
3. Drop the files in this directory. No code change — the loader prefers the
   file and only falls back to the painted stand-in.
4. Reload and check the **middles** of the dissolves (around 10%, 20%, 30%, 37%,
   55%, 72%, 86% down the page), not just the rest states.
