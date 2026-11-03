import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // three.js ships untranspiled ESM; let Next handle it in the server bundle.
  transpilePackages: ["three"],
};

export default nextConfig;
