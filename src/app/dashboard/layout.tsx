'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

const navItems = [
  { label: 'Leads', href: '/dashboard', icon: 'analytics' },
  { label: 'Métricas', href: '/dashboard/metricas', icon: 'assessment' },
  { label: 'Sesiones', href: '/dashboard/sesiones', icon: 'event_note' },
  { label: 'Consultores', href: '/dashboard/consultores', icon: 'psychology', adminOnly: true },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [nombre, setNombre] = useState('')
  const [rol, setRol] = useState('')

  useEffect(() => {
    async function fetchUser() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('consultores')
        .select('nombre, rol')
        .eq('auth_id', user.id)
        .single()
      if (data) {
        setNombre(data.nombre)
        setRol(data.rol)
      }
    }
    fetchUser()
  }, [])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-[#f7f9fc]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-screen w-[260px] bg-[#003087] flex flex-col py-6 shadow-2xl z-50">
        {/* Logo */}
        <div className="px-6 mb-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center overflow-hidden">
            <Image src="/logo-camarabaq.png" alt="CamaraBAQ" width={36} height={36} style={{ width: '36px', height: '36px', objectFit: 'contain' }} />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight" style={{ fontFamily: 'Poppins, sans-serif' }}>ConsultorIA</h2>
            <p className="text-[10px] text-white/80 font-medium uppercase tracking-widest">CamaraBAQ Intelligence</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 space-y-1">
          {navItems
            .filter((item) => !item.adminOnly || rol === 'admin')
            .map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-all duration-200 ${
                  pathname === item.href
                    ? 'bg-white/10 text-[#00AEEF] border-l-4 border-[#00AEEF] font-semibold'
                    : 'text-white/70 hover:text-white hover:bg-white/5'
                }`}
                style={{ fontFamily: 'Poppins, sans-serif' }}
              >
                <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                <span className="text-sm tracking-tight">{item.label}</span>
              </Link>
            ))}
        </nav>

        {/* Bottom */}
        <div className="px-4 mt-auto space-y-1">
          <div className="mb-4 px-4 py-3">
            {nombre && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#00AEEF] flex items-center justify-center text-white text-sm font-bold">
                  {nombre.charAt(0).toUpperCase()}
                </div>
                <div className="leading-tight">
                  <p className="text-sm font-bold text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>{nombre}</p>
                  <p className="text-[10px] text-white/50 uppercase tracking-widest">{rol}</p>
                </div>
              </div>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition-all duration-200"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
            <span className="text-sm tracking-tight" style={{ fontFamily: 'Poppins, sans-serif' }}>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* Header */}
      <header className="fixed top-0 right-0 w-[calc(100%-260px)] h-16 bg-white/80 backdrop-blur-md border-b border-slate-100 flex items-center px-8 z-40">
        <h1 className="text-lg font-bold text-[#003087]" style={{ fontFamily: 'Poppins, sans-serif' }}>
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
          <span className="material-symbols-outlined text-[#00AEEF]">psychology</span>
          <div className="text-xs">
            <p className="font-bold">IA Insight</p>
            <p className="text-white/70">Dashboard activo</p>
          </div>
        </div>
      </div>
    </div>
  )
}
