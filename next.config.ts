import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { formats: ["image/avif", "image/webp"] },

  async headers() {
    return [
      {
        /*
         * The frames and the paintings never change under a given name.
         *
         * Next serves everything in `public/` with `max-age=0,
         * must-revalidate`, which is the right default for a folder that could
         * hold anything and exactly wrong for seven hundred and sixty files
         * that are only ever replaced by being given new names. Without this a
         * second visit revalidates every one of them before a plate can move,
         * which is most of a first visit's cost paid again for nothing.
         */
        source: "/strawberry/:kind(frames|art)/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
