import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import DashboardShell from './DashboardShell'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: consultor } = await supabase
    .from('consultores')
    .select('nombre, rol')
    .eq('auth_id', user.id)
    .single()
  if (!consultor) redirect('/login')

  return (
    <DashboardShell nombre={consultor.nombre} rol={consultor.rol}>
      {children}
    </DashboardShell>
  )
}
