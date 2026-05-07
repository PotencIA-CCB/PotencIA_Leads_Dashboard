import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import LoginForm from './LoginForm'

export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Si ya hay sesión activa Y el usuario está registrado en consultores,
  // mandalo al dashboard. Si no es consultor, lo dejamos en /login para
  // que vea el mensaje de "tu cuenta no tiene acceso" del propio form.
  if (user) {
    const { data: consultor } = await supabase
      .from('consultores')
      .select('id')
      .eq('auth_id', user.id)
      .single()
    if (consultor) redirect('/dashboard')
  }

  return <LoginForm />
}
