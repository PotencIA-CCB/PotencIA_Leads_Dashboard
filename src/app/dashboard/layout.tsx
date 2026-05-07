'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient, getCurrentConsultor, invalidateAuthCache } from '@/lib/supabase-browser'

const navItems = [
  { label: 'Leads', href: '/dashboard', icon: 'analytics' },
  { label: 'Métricas', href: '/dashboard/metricas', icon: 'assessment' },
  { label: 'Consultores', href: '/dashboard/consultores', icon: 'psychology', adminOnly: true },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [nombre, setNombre] = useState('')
  const [rol, setRol] = useState('')

  useEffect(() => {
    let cancelled = false
    getCurrentConsultor().then((c) => {
      if (cancelled || !c) return
      setNombre(c.nombre)
      setRol(c.rol)
    })
    return () => { cancelled = true }
  }, [])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    invalidateAuthCache()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-[#f7f9fc]" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-screen w-[260px] bg-[#003087] flex flex-col py-6 shadow-2xl z-50" aria-label="Navegación principal">
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
            {nombre && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#00C8FF] flex items-center justify-center text-white text-sm font-bold">
                  {nombre.charAt(0).toUpperCase()}
                </div>
                <div className="leading-tight">
                  <p className="text-sm font-bold text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{nombre}</p>
                  <p className="text-[10px] text-white/50 uppercase tracking-widest">{rol}</p>
                </div>
              </div>
            )}
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
      <header className="fixed top-0 right-0 w-[calc(100%-260px)] h-16 bg-white/80 backdrop-blur-md border-b border-slate-100 flex items-center px-8 z-40">
        <h1 className="text-lg font-bold text-[#003087]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          Executive Intelligence Dashboard
        </h1>
      </header>

      {/* Main */}
      <main className="ml-[260px] pt-20 pb-12 px-8 min-h-screen">
        {children}
      </main>

      {/* IA Insight FAB */}
      <div className="fixed bottom-8 right-8 pointer-events-none">
        <div className="bg-[#003087] text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 pointer-events-auto">
          <span className="material-symbols-outlined text-[#00C8FF]">psychology</span>
          <div className="text-xs">
            <p className="font-bold">IA Insight</p>
            <p className="text-white/70">Dashboard activo</p>
          </div>
        </div>
      </div>
    </div>
  )
}
