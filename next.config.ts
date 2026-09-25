import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Uvoz šifrarnika šalje cijeli Excel fajl (oko 2 MB) Server Actionu.
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
