import path from "node:path";
import type { NextConfig } from "next";

const basePath = process.env.CHAT_BASE_PATH || "";

const nextConfig: NextConfig = {
  basePath: basePath || undefined,
  output: "standalone",
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  transpilePackages: ["@template/shared"],
  poweredByHeader: false,
};

export default nextConfig;
