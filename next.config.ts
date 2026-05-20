import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['trycloudflare.com', '*.trycloudflare.com', 'applies-cst-jackets-roots.trycloudflare.com.'],
};

export default nextConfig;

import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
