# Pear — plate slots

The stage renders nine plates. Every one of them currently falls back to a
procedural stand-in painted in `src/lib/pearPlates.ts`, because the finished
artwork does not exist yet.

**To finish the site, drop files here.** No code changes. The loader
(`loadPlate`) tries the path first and only paints a stand-in when the file
fails to decode, so a plate switches over the moment its file lands.

| File | Ground | Subject |
|---|---|---|
| `hero-curtain.webp` | cobalt `#0a5f9e` | A figure in classical dress stepping out from behind a heavy curtain |
| `model-graft.webp` | bone `#dcdcd2` | Two hands binding a grafted scion to a pear branch |
| `model-ladder.webp` | bone `#dcdcd2` | A figure on a ladder raised above a crowd in an orchard |
| `model-cut.webp` | bone `#dcdcd2` | A figure in a green robe holding a knife to a gilded pear |
| `work-pear.webp` | cobalt `#0a5f9e` | A pear as a coarse printing halftone |
| `terms-orbit.webp` | azure `#0b7baa` | A gilded pear suspended in a ring of light |
| `faq-canopy.webp` | cobalt `#0a5f9e` | Looking up through a pear canopy into open sky |
| `apply-sapling.webp` | night `#073568` | A young pear tree beneath a constellation |
| `footer-grove.webp` | cobalt `#0a5f9e` | Two figures tending a bearing pear tree |

## What the plates have to do

- **Land on the stated ground colour at the edges.** The dissolve shader mixes
  each plate toward its ground when it breaks the image into halftone dots, and
  the copy layers pick cream or ink type from the same value. A plate whose
  corners are a different colour than its token will show a seam mid-dissolve.
- **Be roughly 16:10 and at least 1600px wide.** The renderer cover-fits and
  then pushes in by about 7%, so anything smaller softens.
- **Keep the left third quiet.** Every scene sets its copy against the left
  margin. On the reference build the subject sits right of centre for exactly
  this reason.
- **No baked-in text.** All type is live DOM.

Change the ground for a plate in `src/data/pear.ts` (`PLATES`), not here.
