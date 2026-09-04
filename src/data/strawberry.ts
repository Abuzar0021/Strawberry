/**
 * STRAWBERRY - content and the scroll timeline.
 *
 * The whole site is one pinned stage. Every scene below is a window on a single
 * 0–1 playhead rather than a section in the document, so the numbers here are
 * the layout: change a range and the scene moves. They live in one table so the
 * ordering stays readable and two scenes cannot silently overlap.
 */

export const BRAND = {
  name: "Strawberry",
  tagline: "Solo-built · Self-hosted · Yours.",
  description:
    "Fast, self-hosted sites for businesses that are finished renting their own storefront. You get the code, the keys, the hosting account, and an invoice that actually ends.",
  org: "OMNISTACK DIGITAL · DUBLIN · JAKARTA",
  email: "omnistacksdigital@gmail.com",
} as const;

/**
 * How tall the runway is, in viewport heights.
 *
 * Every scene below is authored against a normalised playhead, so this is one
 * dial for the pace of the whole site. At 4800 the nine chapters were spread
 * over forty-eight screen-heights - close to four hundred wheel notches end to
 * end, and five or six screens of scrolling to get through a single plate and
 * two paragraphs. Each chapter was well made and there was simply too much
 * turning between them.
 *
 * 3600 keeps every relative proportion and gives back a quarter of the
 * distance. Frames land about 43px of scroll apart at that pace, which the
 * renderer blends across, so nothing is coarser for it.
 */
export const RUNWAY_VH = 3600;

export type Ground = "cobalt" | "azure" | "bone" | "night";

/**
 * A painted plate behind the stage.
 *
 * `src` is where finished artwork goes. Until a file exists at that path the
 * loader paints the procedural stand-in named by `sketch` instead, so dropping
 * real art in is a file copy and no code change. `ground` is the flat colour the
 * plate resolves to at its edges - the copy layers read it to decide whether
 * they are setting type in cream or in ink.
 */
export type Plate = {
  id: string;
  src: string;
  /**
   * The semantic ground. Decides whether copy sets in cream or in ink, and is
   * the colour the stand-in paints when the artwork is missing.
   */
  ground: Ground;
  /**
   * The frame sequence that makes this plate move, named by its folder under
   * `/strawberry/frames/`.
   *
   * Not a video. A clip has to be fetched, buffered and then seeked before it
   * can show the frame the scroll is asking for, and every one of those steps
   * can stall; a frame is an ordinary image, complete the moment it lands.
   * Omitting this leaves the plate a still, which costs nothing else.
   */
  film?: string;
  /**
   * The exact colour this plate's flat areas resolve to, measured off the
   * finished painting rather than assumed from the token.
   *
   * The shader mixes toward this during the halftone pass, so it has to be the
   * real value: four plates can all be "cobalt" and still sit 20 points apart
   * in lightness, and a shared token would show a seam mid-dissolve on at
   * least two of them.
   */
  tone: string;
  sketch:
    | "curtain"
    | "graft"
    | "ladder"
    | "cut"
    | "halftone-pear"
    | "orbit"
    | "canopy"
    | "sapling"
    | "grove";
  alt: string;
};

/**
 * How many frames each sequence has.
 *
 * Chosen so that consecutive frames differ by the same amount everywhere,
 * rather than so they are the same distance apart in scroll.
 *
 * Sampling at a constant frame rate maps scroll to the source's timecode, and
 * these clips do not move at a constant rate: one of the bridges sits nearly
 * still for a third of its length and then whips, so at an even sample it
 * showed a run of steps eleven times its own median. That is what reads as a
 * cut. Frames are picked along each clip's cumulative-change curve instead, so
 * equal scroll buys equal movement - dead time in the footage is compressed
 * away and fast passages get the frames they need.
 *
 * The counts below follow from one number, a step of 3.6, applied to every
 * clip. What is left is source-limited: a single frame-to-frame jump larger
 * than the step cannot be subdivided by any sampling, and the two that remain
 * sit inside a bridge's crossfade ramp.
 */
export const FRAMES: Record<string, number> = {
  "apply-sapling": 39,
  "bridge-cut-to-work": 96,
  "bridge-orbit-to-canopy": 156,
  "bridge-work-to-orbit": 110,
  "faq-canopy": 83,
  "footer-grove": 60,
  "hero-curtain": 142,
  "model-cut": 47,
  "model-graft": 116,
  "model-ladder": 55,
  "terms-orbit": 33,
  "work-pear": 48,
};

export const PLATES: Plate[] = [
  {
    id: "curtain",
    src: "/strawberry/art/hero-curtain.webp",
    film: "hero-curtain",
    ground: "cobalt",
    tone: "#1a5380",
    sketch: "curtain",
    alt: "A figure in classical dress stepping out from behind a heavy curtain.",
  },
  {
    id: "graft",
    src: "/strawberry/art/model-graft.webp",
    film: "model-graft",
    ground: "bone",
    tone: "#d4d1c2",
    sketch: "graft",
    alt: "Two hands pegging a strawberry runner into the soil with a wooden pin.",
  },
  {
    id: "ladder",
    src: "/strawberry/art/model-ladder.webp",
    film: "model-ladder",
    ground: "bone",
    tone: "#c2b7a2",
    sketch: "ladder",
    alt: "A figure raised on a stone plinth above a crowd of onlookers.",
  },
  {
    id: "cut",
    src: "/strawberry/art/model-cut.webp",
    film: "model-cut",
    ground: "bone",
    tone: "#c8c5b1",
    sketch: "cut",
    alt: "A figure in a green velvet robe holding a knife to a gilded strawberry.",
  },
  {
    id: "halftone-pear",
    src: "/strawberry/art/work-pear.webp",
    film: "work-pear",
    ground: "cobalt",
    tone: "#094777",
    sketch: "halftone-pear",
    alt: "A strawberry rendered as a coarse printing halftone against a blue ground.",
  },
  {
    id: "orbit",
    src: "/strawberry/art/terms-orbit.webp",
    film: "terms-orbit",
    ground: "azure",
    tone: "#236f8a",
    sketch: "orbit",
    alt: "A gilded strawberry suspended in a ring of light.",
  },
  {
    id: "canopy",
    src: "/strawberry/art/faq-canopy.webp",
    film: "faq-canopy",
    ground: "cobalt",
    tone: "#14568b",
    sketch: "canopy",
    alt: "Looking up through strawberry foliage into an open circle of sky.",
  },
  {
    id: "sapling",
    src: "/strawberry/art/apply-sapling.webp",
    film: "apply-sapling",
    ground: "night",
    tone: "#10304c",
    sketch: "sapling",
    alt: "A young strawberry plant beneath a constellation.",
  },
  {
    id: "grove",
    src: "/strawberry/art/footer-grove.webp",
    film: "footer-grove",
    ground: "cobalt",
    tone: "#10598b",
    sketch: "grove",
    alt: "Two figures tending a bed of bearing strawberry plants.",
  },
];

export const PLATE_BY_ID: Record<string, Plate> = Object.fromEntries(
  PLATES.map((p) => [p.id, p])
);

/** The four chapters the left-hand rail counts through. */
export type Handover = "dissolve" | "iris" | "bridge";

export const PLATE_CUES: {
  at: number;
  plate: string;
  via?: Handover;
  /**
   * A filmed transition that carries the whole handover on its own, named by
   * its folder under `/strawberry/frames/`.
   *
   * Only possible where the two plates share a shape - a gilded strawberry
   * becoming a printed one is the same object twice, so the sequence can bend
   * it. Where they share nothing the model can only crossfade, which the shader
   * already does better; those cues keep `dissolve`.
   */
  bridge?: string;
}[] = [
  { at: 0.0, plate: "curtain" },
  // leaving the statement and entering the argument
  { at: 0.1, plate: "graft", via: "iris" },
  { at: 0.2, plate: "ladder" },
  { at: 0.295, plate: "cut" },
  // the gilded fruit turns into the printed one, in place
  { at: 0.395, plate: "halftone-pear", via: "bridge", bridge: "bridge-cut-to-work" },
  // the dots close back up into solid gold
  { at: 0.545, plate: "orbit", via: "bridge", bridge: "bridge-work-to-orbit" },
  // one fruit recedes and becomes one of many
  { at: 0.722, plate: "canopy", via: "bridge", bridge: "bridge-orbit-to-canopy" },
  // daylight canopy into the night sky of the application
  { at: 0.862, plate: "sapling", via: "iris" },
  { at: 0.938, plate: "grove" },
];

export const CHAPTERS = [
  { n: 1, label: "The Model", at: 0.1 },
  { n: 2, label: "The Work", at: 0.37 },
  { n: 3, label: "The Terms", at: 0.55 },
  { n: 4, label: "Questions", at: 0.73 },
] as const;

/**
 * Scene windows on the playhead, each `[in, out]`.
 *
 * Derived from the cue table rather than written out, because they were
 * written out and they drifted. Each window used to stop short of the next
 * one, and the gaps added up to eighteen per cent of the runway with no copy
 * on it at all - nearly six thousand pixels of scrolling past artwork with
 * nothing to read, on top of the fades at either end of every window. Barely
 * half the site was ever showing copy at full strength.
 *
 * A chapter now owns the runway from its own cue to the next one, so the copy
 * hands over exactly where the plates do. The fades still cover the handover:
 * each scene asks for a fade narrow enough that it runs out inside the
 * transition rather than well before it starts.
 */
const SCENE_SEQUENCE = [
  "hero",
  "beat1",
  "beat2",
  "beat3",
  "work",
  "terms",
  "faq",
  "apply",
  "footer",
] as const;

/**
 * How far each window reaches past its cue into its neighbours'.
 *
 * Without it the windows meet exactly on the cue, where the outgoing scene has
 * finished fading and the incoming one has not started - both at zero on the
 * same frame, which reads as a blink rather than a handover.
 *
 * It wants to be about half a scene's fade width, so the two ramps cross near
 * the middle. Twice that and they cross near the top instead: both headlines
 * legible at once, sitting on top of each other, which is worse than the blink
 * it was meant to fix.
 */
const OVERLAP = 0.006;

export const SCENES = SCENE_SEQUENCE.reduce(
  (acc, name, i) => {
    const from = PLATE_CUES[i].at;
    const to = PLATE_CUES[i + 1]?.at ?? 1;
    acc[name] = [Math.max(0, from - (i ? OVERLAP : 0)), Math.min(1, to + OVERLAP)];
    return acc;
  },
  {} as Record<(typeof SCENE_SEQUENCE)[number], readonly [number, number]>,
);

export type SceneName = keyof typeof SCENES;

/**
 * Scene order, and the plate each one stands on.
 *
 * Only the document fallback needs this - with no shader running, each layer
 * has to paint its own ground so the copy still has something legible behind
 * it. The order must match the order the layers are rendered in.
 */
export const SCENE_ORDER: { scene: SceneName; plate: string }[] = [
  { scene: "hero", plate: "curtain" },
  { scene: "beat1", plate: "graft" },
  { scene: "beat2", plate: "ladder" },
  { scene: "beat3", plate: "cut" },
  { scene: "work", plate: "halftone-pear" },
  { scene: "terms", plate: "orbit" },
  { scene: "faq", plate: "canopy" },
  { scene: "apply", plate: "sapling" },
  { scene: "footer", plate: "grove" },
];

/**
 * Which plate is on screen across the runway, and where each hands over.
 *
 * `via` picks how the handover INTO that plate is drawn. The halftone dissolve
 * is the house style and carries most of them; the iris is a bigger gesture -
 * a circle opening from the centre with both plates counter-scaling through it -
 * and is spent only where the site is meant to feel like it is going somewhere.
 * Using it everywhere would cost the dissolve its meaning.
 */

export const HERO = {
  headline: "Websites you actually own.",
  // the separator hangs at the end of the first line; leading a line with it
  // reads as a bullet point rather than as a continuation
  subhead: ["Solo-built · Self-hosted ·", "Yours."],
  cta: "Start a build",
  badge: "Dublin · Jakarta",
  stand:
    "Fast, self-hosted sites for businesses that are finished renting their own storefront. You get the code, the keys, the hosting account, and an invoice that actually ends.",
} as const;

/** Chapter one, told in three beats over three plates. */
export const BEATS = [
  {
    headline: ["We audit it."],
    badge: "Step one",
    stand: "What you have, what it costs you, and what is actually worth rebuilding.",
  },
  {
    headline: ["We build it."],
    badge: "Two to four weeks",
    stand: "One person, start to finish. Websites, web apps, AI automation, UI/UX and SEO.",
  },
  {
    headline: ["You keep it."],
    badge: "Handover",
    stand: "The code, the keys, the hosting account. No monthly platform fees. Ever.",
  },
] as const;

export const WORK = {
  groups: [
    {
      chip: "Website development",
      headline: ["Sites that are yours the", "day they ship."],
      body: "Built to be fast and self-hosted, handed over whole. You own the code, the keys and the hosting account, and there is no platform sitting between you and your own storefront.",
    },
    {
      chip: "Web applications",
      headline: ["The machinery a modern", "business runs on."],
      body: "Storefronts, booking systems, internal tools. Built by one person end to end, which is why it takes two to four weeks instead of two quarters.",
    },
    {
      chip: "AI automation · UI/UX · SEO",
      headline: ["Everything around the build,", "by the person who built it."],
      body: "The automation, the interface and the search work are done by whoever wrote the code, so nothing has to be explained twice or handed between three agencies.",
    },
  ],
} as const;

export const TERMS = [
  {
    headline: ["No monthly platform", "fees. Ever."],
    lead: "Four dollars a month for hosting, paid to your host, not to us, and not to a platform taking a cut of your own storefront.",
    chip: "What it costs",
    small:
      "There is no platform tax, no seat pricing and no plan to be upgraded out of. The hosting account is in your name from the day it is set up, so the bill you pay is the bill your host charges and nothing else is layered on top of it.",
  },
  {
    headline: ["An invoice that", "actually ends."],
    lead: "Audit, build, review, handover. Two to four weeks, one person, and then it is finished and it is yours.",
    chip: "How it works",
    small:
      "You are not buying a subscription to your own website. At handover you get the code, the keys and the hosting account, and if you never speak to us again the site keeps running exactly as it did the day it shipped.",
  },
] as const;

export const FAQ_LEAD = "Asked before";

/** Shown once, while the opening plate's clip buffers. */
export const LOADING = {
  word: "Ripening",
  sub: "Solo-built · Self-hosted · Yours.",
} as const;

export const FAQ = [
  {
    q: "What does it cost to run?",
    a: "Four dollars a month for hosting, paid directly to your host. There are no monthly platform fees, no seat pricing and no plan you get upgraded out of - the bill you pay is your host's bill and nothing is layered on top of it.",
  },
  {
    q: "How long does a build take?",
    a: "Two to four weeks. One person takes it from the first audit through to handover, which is why it is measured in weeks rather than quarters and why nothing has to be explained twice.",
  },
  {
    q: "What do I actually own at the end?",
    a: "The code, the keys and the hosting account. The account is in your name, so if you never speak to us again the site keeps running exactly as it did the day it shipped.",
  },
  {
    q: "How does the process work?",
    a: "Four steps. An audit of what you have and what it costs you, the build itself, a review with you, and then handover. One person throughout.",
  },
  {
    q: "What do you build?",
    a: "Websites, web applications, AI automation, UI/UX design and SEO. The automation and the search work are done by whoever wrote the code, rather than handed between three agencies.",
  },
] as const;

export const APPLY = {
  lead: "Start a build",
  body: "Tell us what you have now and what you want to own instead. Every enquiry is read, and you will hear back within a week.",
  cta: "Start a build",
  fields: [
    { k: "name", label: "Your name", type: "text", autoComplete: "name" },
    { k: "email", label: "Email", type: "email", autoComplete: "email" },
    { k: "grow", label: "What do you have now, and what should it become?", type: "textarea" },
  ],
} as const;
