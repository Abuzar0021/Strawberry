import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { formats: ["image/avif", "image/webp"] },
  async redirects() {
    return [
      // Luna's site was built at /gaze and later promoted to the root, since
      // this deployment is hers. The old path was shared while it was being
      // built, so it forwards rather than 404ing.
      { source: "/gaze", destination: "/", permanent: true },
    ];
  },
};

export default nextConfig;
