import type { Metadata, Viewport } from "next";
import { Newsreader, Inter, JetBrains_Mono } from "next/font/google";
import "./strawberry.css";
import { SmoothScroll } from "@/components/chrome/SmoothScroll";
import { BRAND, FRAMES, PLATES } from "@/data/strawberry";
import { coarseCount, fetchOrder, framePath } from "@/lib/strawberrySequence";

/* The reference build sets its display face in Flecha and its text in GT Standard, both
   licensed. These are the closest open equivalents: a transitional serif that
   holds up at 7rem with negative tracking, a neutral grotesque underneath it,
   and a mono for the tracked labels. */
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["300", "400"],
  style: ["normal", "italic"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: `${BRAND.name} - ${BRAND.tagline}`,
  description: BRAND.description,
  openGraph: {
    title: `${BRAND.name} - ${BRAND.tagline}`,
    description: BRAND.description,
    type: "website",
  },
};

/**
 * The opening chapter's frames, asked for by the HTML rather than by script.
 *
 * These are the images the very first scroll moves through, and nothing can
 * move until they exist. Requesting them while the document is still parsing
 * rather than after the bundle has downloaded, hydrated and built a WebGL
 * context takes most of a second off a cold visit. Only the coarse pass is
 * listed - about ten frames, enough to scrub the chapter end to end - because
 * the rest are refinement and would only compete with these for the connection.
 */
const OPENING = PLATES[0].film;
const OPENING_FRAMES = OPENING
  ? fetchOrder(FRAMES[OPENING])
      .slice(0, coarseCount(FRAMES[OPENING]))
      .map((i) => framePath(OPENING, i))
  : [];

export const viewport: Viewport = {
  themeColor: "#0a5f9e",
  colorScheme: "light",
};

export default function StrawberryLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${newsreader.variable} ${inter.variable} ${jetbrains.variable}`}
    >
      <body>
        {OPENING_FRAMES.map((href) => (
          <link key={href} rel="preload" as="image" href={href} fetchPriority="high" />
        ))}
        <a
          href="#apply"
          className="t-mono sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:bg-[var(--press)] focus:px-4 focus:py-3 focus:text-[var(--cream)]"
        >
          Skip to the application
        </a>
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}
