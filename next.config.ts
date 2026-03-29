import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };
    return config;
  },
  // Externalize packages with native bindings or CommonJS-only modules so they
  // are not bundled by the Next.js server-component bundler.
  serverExternalPackages: ["@prisma/client", "pdfkit", "ws"],
};

export default nextConfig;
