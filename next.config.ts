import type { NextConfig } from "next";

const appVersion =
  process.env.NEXT_PUBLIC_APP_VERSION ??
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.GITHUB_SHA ??
  process.env.npm_package_version ??
  "0.0.0";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
  },
};

export default nextConfig;
