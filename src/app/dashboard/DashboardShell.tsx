'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient, invalidateAuthCache } from '@/lib/supabase-browser'
import { useWindowWidth } from '@/hooks/useWindowWidth'

interface DashboardShellProps {
  nombre: string
  rol: string
  children: React.ReactNode
}

const navItems = [
  { label: 'Leads', href: '/dashboard', icon: 'analytics' },
  { label: 'Business Intelligence', href: '/dashboard/bi', icon: 'insights' },
  { label: 'Novedades', href: '/dashboard/novedades', icon: 'campaign' },
  { label: 'Consultores', href: '/dashboard/consultores', icon: 'psychology', adminOnly: true },
]

export default function DashboardShell({ nombre, rol, children }: DashboardShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const isDesktop = useWindowWidth() >= 768

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    invalidateAuthCache()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-[#f7f9fc]" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Mobile overlay */}
      {!isDesktop && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-screen w-[260px] bg-[#003087] flex flex-col py-6 shadow-2xl z-50 transition-transform duration-300 ease-in-out ${
          isDesktop || sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Navegación principal"
      >
        {/* Logo */}
        <div className="px-6 mb-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center overflow-hidden">
            <Image src="/logo-camarabaq.png" alt="CamaraBAQ" width={36} height={36} style={{ width: '36px', height: '36px', objectFit: 'contain' }} />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>ConsultorIA</h2>
            <p className="text-[10px] text-white/80 font-medium uppercase tracking-widest">CamaraBAQ Intelligence</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 space-y-1" aria-label="Menú de navegación">
          {navItems
            .filter((item) => !item.adminOnly || rol === 'admin')
            .map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm border-l-4 cursor-pointer ${
                  pathname === item.href
                    ? 'bg-white/10 text-[#00C8FF] border-[#00C8FF] font-semibold'
                    : 'text-white/70 border-transparent'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">{item.icon}</span>
                <span className="text-sm tracking-tight">{item.label}</span>
              </Link>
            ))}
        </nav>

        {/* Bottom */}
        <div className="px-4 mt-auto space-y-1">
          <div className="mb-4 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#00C8FF] flex items-center justify-center text-white text-sm font-bold">
                {nombre.charAt(0).toUpperCase()}
              </div>
              <div className="leading-tight">
                <p className="text-sm font-bold text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{nombre}</p>
                <p className="text-[10px] text-white/50 uppercase tracking-widest">{rol}</p>
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-white/70 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
            <span className="text-sm tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 md:left-[260px] h-16 bg-white/80 backdrop-blur-md border-b border-slate-100 flex items-center gap-3 px-4 sm:px-6 lg:px-8 z-40">
        <button
          className={`${isDesktop ? 'hidden' : 'flex'} items-center justify-center w-9 h-9 rounded-lg text-[#003087] hover:bg-slate-100 transition-colors shrink-0`}
          onClick={() => setSidebarOpen(true)}
          aria-label="Abrir menú"
        >
          <span className="material-symbols-outlined text-[22px]">menu</span>
        </button>
        <h1 className="text-base md:text-lg font-bold text-[#003087] truncate" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          Executive Intelligence Dashboard
        </h1>
      </header>

      {/* Main */}
      <main className="md:ml-[260px] pt-20 pb-12 px-4 sm:px-6 lg:px-8 min-h-screen">
        <div className="max-w-screen-2xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  )
}
