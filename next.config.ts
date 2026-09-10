import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tunel de cloudflared para probar en movil desde local (ver README).
  // No tiene relacion con el hosting: el despliegue es en Vercel.
  allowedDevOrigins: ['trycloudflare.com', '*.trycloudflare.com', 'applies-cst-jackets-roots.trycloudflare.com.'],
};

export default nextConfig;
