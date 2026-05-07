import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ConsultorIA — Cámara de Comercio de Barranquilla',
  description: 'Panel de gestión de leads PotencIA — Cámara de Comercio de Barranquilla',
  // El favicon (icon.svg) se autodetecta desde app/ por convención de Next.js 16.
  openGraph: {
    title: 'ConsultorIA — Cámara de Comercio de Barranquilla',
    description: 'Panel de gestión de leads PotencIA',
    locale: 'es_CO',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  )
}
