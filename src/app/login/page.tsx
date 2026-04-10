'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import Image from 'next/image'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Credenciales incorrectas. Verifica tu email y contraseña.')
      setLoading(false)
      return
    }
    const { data: consultor } = await supabase
      .from('consultores')
      .select('id')
      .eq('auth_id', authData.user.id)
      .single()
    if (!consultor) {
      await supabase.auth.signOut()
      setError('Tu cuenta no tiene acceso a este panel. Contacta al administrador.')
      setLoading(false)
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="bg-[#F2F4F7] min-h-screen flex items-center justify-center px-4 py-8 sm:px-6" style={{ fontFamily: 'Poppins, sans-serif' }}>
      <main className="w-full max-w-[480px] sm:max-w-[520px]">

        {/* Card */}
        <div className="bg-white rounded-lg shadow-xl border-t-[4px] border-[#003087]">
          <div className="p-6 sm:p-10 md:p-12">

            {/* Brand */}
            <div className="flex flex-col items-center mb-10">
              <div className="mb-6 flex items-center justify-center">
                <Image
                  src="/logo-camarabaq.png"
                  alt="CamaraBAQ Logo"
                  width={160}
                  height={64}
                  style={{ width: 'clamp(120px, 30vw, 160px)', height: 'auto', objectFit: 'contain' }}
                  priority
                />
              </div>
              <h1 className="font-bold text-base sm:text-[20px] text-[#003087] tracking-tight text-center">
                ConsultorIA — Panel de Gestión
              </h1>
              <p className="text-[#444652] text-xs sm:text-sm mt-2 font-normal opacity-70 text-center">
                Executive Intelligence Access
              </p>
            </div>

            {/* Form */}
            <form className="space-y-6" onSubmit={handleLogin}>

              {/* Email */}
              <div className="space-y-2">
                <label className="block text-[0.75rem] font-normal uppercase tracking-[0.05em] text-[#444652]" htmlFor="email">
                  Correo Electrónico
                </label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-0 top-1/2 -translate-y-1/2 text-[#747683] group-focus-within:text-[#003087] transition-colors">
                    mail
                  </span>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="consultor@camarabaq.org.co"
                    className="w-full pl-8 pr-0 py-3 bg-transparent border-0 border-b border-[#C8CDD5] focus:border-[#003087] focus:ring-0 transition-all placeholder:text-[#747683]/50 text-[#191c1e] outline-none"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <label className="block text-[0.75rem] font-normal uppercase tracking-[0.05em] text-[#444652]" htmlFor="password">
                    Contraseña
                  </label>
                  <a className="text-[0.7rem] font-normal text-[#003087] hover:underline transition-colors" href="#">
                    ¿Olvidó su clave?
                  </a>
                </div>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-0 top-1/2 -translate-y-1/2 text-[#747683] group-focus-within:text-[#003087] transition-colors">
                    lock
                  </span>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-8 pr-0 py-3 bg-transparent border-0 border-b border-[#C8CDD5] focus:border-[#003087] focus:ring-0 transition-all placeholder:text-[#747683]/50 text-[#191c1e] outline-none"
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm text-[#ba1a1a]">{error}</p>
              )}

              {/* CTA */}
              <div className="pt-6">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#003087] hover:opacity-90 disabled:opacity-50 text-white font-bold py-3 sm:py-4 rounded-lg shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-sm sm:text-base"
                >
                  <span>{loading ? 'Ingresando...' : 'INICIAR SESIÓN'}</span>
                  {!loading && <span className="material-symbols-outlined text-sm">arrow_forward</span>}
                </button>
              </div>
            </form>

            {/* Footer */}
            <div className="mt-12 text-center">
              <p className="text-xs text-[#444652]/60 font-normal">
                © 2024 Cámara de Comercio de Barranquilla.<br />
                Inteligencia Estratégica para el Atlántico.
              </p>
            </div>
          </div>
        </div>

        {/* External Links */}
        <div className="mt-8 flex justify-center gap-6">
          <a className="flex items-center gap-1.5 text-xs font-normal text-[#444652] hover:text-[#003087] transition-colors" href="#">
            <span className="material-symbols-outlined text-base">help</span>
            SOPORTE TÉCNICO
          </a>
          <div className="w-1 h-1 rounded-full bg-[#c4c6d4] self-center" />
          <a className="flex items-center gap-1.5 text-xs font-normal text-[#444652] hover:text-[#003087] transition-colors" href="#">
            <span className="material-symbols-outlined text-base">verified_user</span>
            PRIVACIDAD
          </a>
        </div>

      </main>
    </div>
  )
}
