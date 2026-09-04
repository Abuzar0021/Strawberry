# Strawberry

A one-page scroll narrative built as a single pinned stage: the document is a
tall empty runway, one sticky viewport holds everything, and scroll position is
the only input. There are no sections — a "chapter" is a position on a playhead.

Nine painted plates hand over to one another as you scroll, each one a
scroll-scrubbed clip whose frames are driven directly by the wheel.

## Running it

```bash
npm install
npm run build && npm start        # http://localhost:3000
```

`npm run dev` works for editing but is noticeably heavier to scroll; judge the
motion on a production build.

## How it fits together

| | |
|---|---|
| `src/data/strawberry.ts` | the whole layout — runway height, scene windows, plate cues, and all copy. No JSX. |
| `src/lib/strawberryCues.ts` | resolves the playhead to a pair of plates and the handover between them |
| `src/lib/strawberryGL.ts` | the renderer: halftone dissolve, iris, bridge and crossfade |
| `src/lib/strawberryPlates.ts` | loads stills and clips; paints stand-ins when artwork is missing |
| `src/components/strawberry/` | one component per scene, plus the stage and the plate canvas |
| `src/hooks/strawberry/` | the scroll playhead, and the hook binding a layer to its window |
| `public/strawberry/art/` | nine plates (still + clip) and three bridge clips |

Everything reads one lerped 0–1 value. Nothing owns a ScrollTrigger of its own.

### Handovers

Three kinds, chosen per cue in `PLATE_CUES`:

- **dissolve** — the house style. The plate shatters into 15°-screened printing
  dots against its own ground colour and resolves back.
- **iris** — a circle opens from the centre with both plates counter-scaling
  through it. Spent only where the site should feel like it is going somewhere.
- **bridge** — a filmed transition that plays across the handover, eased in and
  out against the plates either side.

### Scrubbed clips

Each plate's clip is positioned by the playhead rather than played. That imposes
two requirements which are easy to get wrong:

- clips must be encoded **all-intra**, or every seek decodes forward from a
  distant keyframe and the scroll stutters;
- a clip is only handed to the stage once it is **fully buffered**, because a
  seek past the buffered edge stalls on the network and leaves a stale frame.

`window.stageClipTimes()` returns each clip's current time — the only way to
tell a frozen clip from a moving one, since the camera keeps drifting either way.

## Fallbacks

Reduced motion, or any browser without a WebGL context, gets an ordinary
stacked document: same content, still images, nothing moving. It says which of
the two reasons applied in the console. Handhelds and metered connections keep
the stills rather than pulling ~90 MB of video.

## Artwork

The nine plates are generated neoclassical paintings. `strawberryPlates.ts`
paints a procedural stand-in for any that is missing, so the site runs with no
artwork at all — a 404 there is the fallback working, not an error.
