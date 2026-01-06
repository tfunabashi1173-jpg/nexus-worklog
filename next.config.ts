import type { NextConfig } from "next";

const commitRef = process.env.VERCEL_GIT_COMMIT_REF ?? "";
const isTagRef = /^v?\d+\.\d+\.\d+/.test(commitRef);
const appVersion =
  process.env.NEXT_PUBLIC_APP_VERSION ??
  process.env.npm_package_version ??
  (isTagRef ? commitRef : undefined) ??
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.GITHUB_SHA ??
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
