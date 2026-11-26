import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "prisma"],


  allowedDevOrigins: ["192.168.1.93"],
};

export default nextConfig;
