/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output produces a self-contained .next/standalone/ directory
  // containing only what's needed at runtime, with a tiny node_modules subset.
  // Required for the multi-stage Dockerfile in this repo.
  output: "standalone",
}

export default nextConfig
