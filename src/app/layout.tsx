import type { Metadata, Viewport } from "next";
import { Newsreader, Inter, JetBrains_Mono } from "next/font/google";
import "./strawberry.css";
import { SmoothScroll } from "@/components/chrome/SmoothScroll";
import { BRAND } from "@/data/strawberry";

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
  title: `${BRAND.name} — ${BRAND.tagline}`,
  description: BRAND.description,
  openGraph: {
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description: BRAND.description,
    type: "website",
  },
};

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
