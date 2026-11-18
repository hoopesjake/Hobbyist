import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // This app is fully personalized/auth-gated, so there's no static shell worth
  // instant-navigation validation for. Only opt in per-route if that changes.
  experimental: { instantInsights: { validationLevel: "manual-warning" } },
  images: { remotePatterns: [{ protocol: "https", hostname: "covers.openlibrary.org", pathname: "/b/id/**" }, { protocol: "https", hostname: "image.tmdb.org", pathname: "/t/p/**" }, { protocol: "https", hostname: "images.igdb.com", pathname: "/igdb/image/upload/**" }] },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
