/**
 * PEAR — content and the scroll timeline.
 *
 * The whole site is one pinned stage. Every scene below is a window on a single
 * 0–1 playhead rather than a section in the document, so the numbers here are
 * the layout: change a range and the scene moves. They live in one table so the
 * ordering stays readable and two scenes cannot silently overlap.
 */

export const BRAND = {
  name: "Strawberry",
  tagline: "Not an agency on the clock, a partner in the upside.",
  description:
    "Strawberry builds custom software, ranks it where customers search, and takes its pay as a share of the revenue it earns. No retainers, no hours.",
  org: "STRAWBERRY · OMNISTACKSDIGITAL.COM",
  email: "omnistacksdigital@gmail.com",
} as const;

/**
 * How tall the runway is, in viewport heights. The source runs 5350vh; the
 * scenes below are authored against a normalised playhead, so this is a single
 * pacing dial — raising it slows every scene by the same proportion.
 */
export const RUNWAY_VH = 4800;

export type Ground = "cobalt" | "azure" | "bone" | "night";

/**
 * A painted plate behind the stage.
 *
 * `src` is where finished artwork goes. Until a file exists at that path the
 * loader paints the procedural stand-in named by `sketch` instead, so dropping
 * real art in is a file copy and no code change. `ground` is the flat colour the
 * plate resolves to at its edges — the copy layers read it to decide whether
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
   * Optional moving version of this plate.
   *
   * The still is always loaded first and is what the stage opens on; the clip
   * replaces it as a texture once it has decoded a frame. So a missing or slow
   * video costs nothing but the motion, and reduced motion never fetches one.
   */
  motion?: string;
  /**
   * Drive this plate's clip from the scroll playhead instead of letting it play
   * on its own clock.
   *
   * Only worth it for a clip that depicts a journey — something that is
   * visibly different at its end than at its start. Scrubbing a clip whose
   * motion merely oscillates reads as a still image that stutters, because the
   * visitor drags thousands of pixels of scroll to produce a change they cannot
   * see. A scrubbed clip must also be encoded all-intra or every seek decodes
   * forward from a distant keyframe.
   */
  scrub?: boolean;
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

export const PLATES: Plate[] = [
  {
    id: "curtain",
    src: "/strawberry/art/hero-curtain.webp",
    motion: "/strawberry/art/hero-curtain.mp4",
    scrub: true,
    ground: "cobalt",
    tone: "#1a5380",
    sketch: "curtain",
    alt: "A figure in classical dress stepping out from behind a heavy curtain.",
  },
  {
    id: "graft",
    src: "/strawberry/art/model-graft.webp",
    motion: "/strawberry/art/model-graft.mp4",
    scrub: true,
    ground: "bone",
    tone: "#d4d1c2",
    sketch: "graft",
    alt: "Two hands pegging a strawberry runner into the soil with a wooden pin.",
  },
  {
    id: "ladder",
    src: "/strawberry/art/model-ladder.webp",
    motion: "/strawberry/art/model-ladder.mp4",
    scrub: true,
    ground: "bone",
    tone: "#c2b7a2",
    sketch: "ladder",
    alt: "A figure raised on a stone plinth above a crowd of onlookers.",
  },
  {
    id: "cut",
    src: "/strawberry/art/model-cut.webp",
    motion: "/strawberry/art/model-cut.mp4",
    scrub: true,
    ground: "bone",
    tone: "#c8c5b1",
    sketch: "cut",
    alt: "A figure in a green velvet robe holding a knife to a gilded strawberry.",
  },
  {
    id: "halftone-pear",
    src: "/strawberry/art/work-pear.webp",
    motion: "/strawberry/art/work-pear.mp4",
    scrub: true,
    ground: "cobalt",
    tone: "#094777",
    sketch: "halftone-pear",
    alt: "A strawberry rendered as a coarse printing halftone against a blue ground.",
  },
  {
    id: "orbit",
    src: "/strawberry/art/terms-orbit.webp",
    motion: "/strawberry/art/terms-orbit.mp4",
    scrub: true,
    ground: "azure",
    tone: "#236f8a",
    sketch: "orbit",
    alt: "A gilded strawberry suspended in a ring of light.",
  },
  {
    id: "canopy",
    src: "/strawberry/art/faq-canopy.webp",
    motion: "/strawberry/art/faq-canopy.mp4",
    scrub: true,
    ground: "cobalt",
    tone: "#14568b",
    sketch: "canopy",
    alt: "Looking up through strawberry foliage into an open circle of sky.",
  },
  {
    id: "sapling",
    src: "/strawberry/art/apply-sapling.webp",
    motion: "/strawberry/art/apply-sapling.mp4",
    scrub: true,
    ground: "night",
    tone: "#10304c",
    sketch: "sapling",
    alt: "A young strawberry plant beneath a constellation.",
  },
  {
    id: "grove",
    src: "/strawberry/art/footer-grove.webp",
    motion: "/strawberry/art/footer-grove.mp4",
    scrub: true,
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
export const CHAPTERS = [
  { n: 1, label: "The Model", at: 0.1 },
  { n: 2, label: "The Work", at: 0.37 },
  { n: 3, label: "The Terms", at: 0.55 },
  { n: 4, label: "Questions", at: 0.73 },
] as const;

/**
 * Scene windows on the playhead, each `[in, out]`.
 *
 * Copy fades across the first and last tenth of its own window, so the gaps
 * between windows are what stop two scenes reading at once. Keep them.
 */
export const SCENES = {
  hero: [0.0, 0.082],
  beat1: [0.108, 0.19],
  beat2: [0.204, 0.286],
  beat3: [0.3, 0.352],
  work: [0.402, 0.53],
  terms: [0.552, 0.708],
  faq: [0.73, 0.852],
  apply: [0.868, 0.93],
  footer: [0.944, 1.0],
} as const;

export type SceneName = keyof typeof SCENES;

/**
 * Scene order, and the plate each one stands on.
 *
 * Only the document fallback needs this — with no shader running, each layer
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
 * is the house style and carries most of them; the iris is a bigger gesture —
 * a circle opening from the centre with both plates counter-scaling through it —
 * and is spent only where the site is meant to feel like it is going somewhere.
 * Using it everywhere would cost the dissolve its meaning.
 */
export type Handover = "dissolve" | "iris" | "bridge";

export const PLATE_CUES: {
  at: number;
  plate: string;
  via?: Handover;
  /**
   * A filmed transition that carries the whole handover on its own.
   *
   * Only possible where the two plates share a shape — a gilded strawberry
   * becoming a printed one is the same object twice, so the clip can bend it.
   * Where they share nothing the model can only crossfade, which the shader
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
  { at: 0.395, plate: "halftone-pear", via: "bridge", bridge: "/strawberry/art/bridge-cut-to-work.mp4" },
  // the dots close back up into solid gold
  { at: 0.545, plate: "orbit", via: "bridge", bridge: "/strawberry/art/bridge-work-to-orbit.mp4" },
  // one fruit recedes and becomes one of many
  { at: 0.722, plate: "canopy", via: "bridge", bridge: "/strawberry/art/bridge-orbit-to-canopy.mp4" },
  // daylight canopy into the night sky of the application
  { at: 0.862, plate: "sapling", via: "iris" },
  { at: 0.938, plate: "grove" },
];

export const HERO = {
  headline: "Strawberry makes you appear.",
  subhead: ["Not an agency on the clock,", "a partner in the upside."],
  cta: "Request Partnership",
  badge: "At your service",
  stand:
    "We build custom software, rank it where customers search, and take our pay as a share of the revenue it earns. No retainers, no hours: if you don’t grow, we don’t get paid.",
} as const;

/** Chapter one, told in three beats over three plates. */
export const BEATS = [
  {
    headline: ["We build it."],
    badge: "Custom software",
    stand: "Tailored software, built to be found.",
  },
  {
    headline: ["We rank it."],
    badge: "Search",
    stand: "Search and links that put you in front of the crowd.",
  },
  {
    headline: ["We share in", "what it earns."],
    badge: "Revenue share",
    stand: "No hours billed — we co-own the outcome.",
  },
] as const;

export const WORK = {
  groups: [
    {
      chip: "Search engine optimization",
      headline: ["Everything it takes to be", "found, under one roof."],
      body: "Search and software are one discipline at Strawberry. The product is built to rank from its first commit, and the SEO is done by the people who wrote the code.",
    },
    {
      chip: "Search engine optimization",
      headline: ["Search and software are one", "discipline at Strawberry."],
      body: "The product is built to rank from its first commit, and the SEO is done by the people who wrote the code.",
    },
    {
      chip: "Custom software",
      headline: [
        "We design and build the thing being",
        "ranked: storefronts, marketplaces,",
        "booking systems, the machinery a",
        "modern company sells through.",
      ],
      body: "Most software is built first and optimized later, which is backwards. Architecture, speed and structure decide rankings before the first word of copy is written, so ours ships fast, renders clean, and gives search engines a site they can read without excuses.",
    },
  ],
} as const;

export const TERMS = [
  {
    headline: ["No fees. A share", "of the upside."],
    lead: "You pay nothing to start: no retainer, no project fee, no hours on a clock. We carry the cost of strategy, development, content and links.",
    chip: "Full disclosure",
    small:
      "Our pay is an agreed share of the revenue the work creates, measured against your baseline and visible to both sides. You keep everything we build: the software, the content, the rankings. And we take on a few partners at a time, because when we are paid on the outcome, yes has to be earned.",
  },
  {
    headline: ["We say no more", "often than yes."],
    lead: "Our partners sell real products and services, have revenue to grow, and compete in markets where customers search: e-commerce, SaaS, marketplaces, service companies.",
    chip: "Full disclosure",
    small:
      "If that’s you, the terms above are the whole pitch. If you’re pre-revenue, want to rent developers by the hour, or need results by Friday, we’re the wrong partner, and we’ll tell you so in the first call.",
  },
] as const;

export const FAQ_LEAD = "Asked before";

export const FAQ = [
  {
    q: "What does it cost to work with Strawberry?",
    a: "Nothing upfront and nothing hourly. We fund the strategy, the software, the content and the link building ourselves. Our payment is an agreed percentage of the new revenue that work generates. If your revenue doesn’t grow, you owe us nothing.",
  },
  {
    q: "What share of the revenue do you take?",
    a: "It’s agreed per partnership before we start, and depends on how much building the opportunity needs. It applies only to growth above your existing baseline, never to the revenue you already had.",
  },
  {
    q: "Why revenue share instead of fees?",
    a: "Because hourly billing pays agencies for effort, not results. An agency on a retainer earns the same whether you grow or not. We removed the retainer, so the only way for us to get paid is to grow your revenue.",
  },
  {
    q: "How do you measure the revenue you create?",
    a: "Before we begin, we agree on a baseline from your existing numbers and on how new organic revenue is attributed: analytics, order data or bookings, depending on your business. Both sides see the same dashboard.",
  },
  {
    q: "How long before it pays off?",
    a: "Search compounds slowly, then quickly. Software and technical fixes land in weeks; rankings and revenue typically move within months. The model means the waiting costs you nothing: we’re the ones financing the ramp.",
  },
] as const;

export const APPLY = {
  lead: "The application",
  body: "Tell us what you sell and where you want to grow. Every application is read, and when the model fits we answer within a week.",
  cta: "Send the application",
  fields: [
    { k: "name", label: "Your name", type: "text", autoComplete: "name" },
    { k: "email", label: "Email", type: "email", autoComplete: "email" },
    { k: "grow", label: "What do you sell, and where do you want to grow?", type: "textarea" },
  ],
} as const;
