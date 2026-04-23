import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/booking
 * Recibe reservas desde Power Automate (Microsoft Bookings)
 *
 * Headers requeridos:
 *   x-webhook-secret: <BOOKING_WEBHOOK_SECRET>
 *
 * Body esperado desde Power Automate:
 * {
 *   "full_name": "Juan Pérez",
 *   "email": "juan@empresa.com",
 *   "phone": "3001234567",          // opcional
 *   "city": "Barranquilla",         // opcional
 *   "fecha_sesion": "2025-08-10",   // YYYY-MM-DD
 *   "hora_inicio": "09:00",         // HH:mm
 *   "hora_fin": "10:00",            // HH:mm  opcional
 *   "modalidad": "Virtual",         // opcional, default Virtual
 *   "service_name": "Consultoría IA" // nombre del servicio en Bookings
 * }
 */
export async function POST(req: NextRequest) {
  // Verificar secret
  const secret = req.headers.get('x-webhook-secret')
  if (secret !== process.env.BOOKING_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const rawText = await req.text()
    let body: Record<string, string>
    try {
      const parsed = JSON.parse(rawText)
      if (typeof parsed === 'string') {
        const inner = parsed.replace(/^[^{]*/, '').replace(/[^}]*$/, '').replace(/\\"/g, '"')
        body = JSON.parse(inner)
      } else {
        body = parsed
      }
    } catch {
      const clean = rawText.replace(/^[^{]*/, '').replace(/[^}]*$/, '').replace(/\\"/g, '"').replace(/\\n/g, '')
      body = JSON.parse(clean)
    }

    const {
      full_name,
      email,
      phone = null,
      city = null,
      service_name = null,
    } = body

    // Normalizar modalidad (evitar '' que rompe el constraint en la tabla `sesiones`)
    const modalidadRaw = body.modalidad
    const modalidad = (() => {
      if (typeof modalidadRaw !== 'string') return 'Virtual'
      const cleaned = modalidadRaw.trim()
      if (!cleaned) return 'Virtual'
      const key = cleaned.toLowerCase()
      if (key === 'virtual') return 'Virtual'
      if (key === 'presencial') return 'Presencial'
      return cleaned
    })()

    // Acepta formatos típicos:
    // - "04/10/2026 15:00:00" (MM/DD/YYYY HH:mm:ss)
    // - "2026-04-10 15:00:00" (YYYY-MM-DD HH:mm:ss)
    // - ISO: "2026-04-10T15:00:00Z" / "2026-04-10T15:00:00-05:00"
    function parseBookingDate(dt: string): { fecha: string; hora: string } {
      if (!dt) return { fecha: '', hora: '' }

      const trimmed = String(dt).trim()

      // ISO / Date-parsable
      if (trimmed.includes('T')) {
        const d = new Date(trimmed)
        if (!Number.isNaN(d.getTime())) {
          const yyyy = String(d.getFullYear())
          const mm = String(d.getMonth() + 1).padStart(2, '0')
          const dd = String(d.getDate()).padStart(2, '0')
          const hh = String(d.getHours()).padStart(2, '0')
          const min = String(d.getMinutes()).padStart(2, '0')
          return { fecha: `${yyyy}-${mm}-${dd}`, hora: `${hh}:${min}` }
        }
      }

      const [datePart, timePart] = trimmed.split(' ')
      const hora = timePart ? timePart.slice(0, 5) : ''

      // YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
        return { fecha: datePart, hora }
      }

      // MM/DD/YYYY
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(datePart)) {
        const [month, day, year] = datePart.split('/')
        const mm = String(month).padStart(2, '0')
        const dd = String(day).padStart(2, '0')
        return { fecha: `${year}-${mm}-${dd}`, hora }
      }

      return { fecha: '', hora }
    }

    const start = parseBookingDate(body.fecha_sesion)
    const end = parseBookingDate(body.hora_fin)

    const fecha_sesion = start.fecha
    const hora_inicio = start.hora
    const hora_fin = end.hora || null

    if (!full_name || !email || !fecha_sesion || !hora_inicio) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: full_name, email, fecha_sesion, hora_inicio' },
        { status: 400 }
      )
    }

    // 1. Buscar consultor por email (ideal) o nombre (fallback) del StaffMember
    const staffEmailRaw = body.staff_email || null
    const staffEmail = typeof staffEmailRaw === 'string' ? staffEmailRaw.trim().toLowerCase() : null
    const staffNameRaw = body.staff_name ?? body.staff_display_name ?? null
    const staffName = typeof staffNameRaw === 'string' ? staffNameRaw.trim() : null

    console.log('staff_email recibido:', staffEmail)
    console.log('staff_name recibido:', staffName)
    console.log('body completo:', JSON.stringify(body))
    let consultorId: string | null = null
    let consultorMatchedBy: 'email' | 'name' | null = null

    if (staffEmail) {
      const { data: consultor } = await supabase
        .from('consultores')
        .select('id')
        .ilike('email', staffEmail)
        .single()
      if (consultor) {
        consultorId = consultor.id
        consultorMatchedBy = 'email'
      }
    }
    if (!consultorId && staffName) {
      // Fallback: algunos triggers no entregan el email del staff en "Created" y solo traen el nombre.
      const { data: consultor } = await supabase
        .from('consultores')
        .select('id')
        .ilike('nombre', staffName)
        .maybeSingle()

      if (consultor) {
        consultorId = consultor.id
        consultorMatchedBy = 'name'
      }
    }

    // 2. Buscar si ya existe un lead con ese email
    const { data: leadExistente } = await supabase
      .from('leads')
      .select('id')
      .eq('email', email)
      .single()

    let leadId: string

    if (leadExistente) {
      leadId = leadExistente.id
      await supabase
        .from('leads')
        .update({
          status: 'Agendado',
          phone: phone ?? undefined,
          city: city ?? undefined,
          ...(consultorId && { id_consultor_asignado: consultorId }),
        })
        .eq('id', leadId)
    } else {
      const { data: nuevoLead, error: leadError } = await supabase
        .from('leads')
        .insert({
          full_name,
          email,
          phone,
          city,
          status: 'Agendado',
          solution: service_name,
          id_consultor_asignado: consultorId,
        })
        .select('id')
        .single()

      if (leadError || !nuevoLead) {
        console.error('Error creando lead:', leadError)
        return NextResponse.json({ error: 'Error creando lead' }, { status: 500 })
      }
      leadId = nuevoLead.id
    }

    // 3. Crear o actualizar la sesión asociada (idempotente por lead + fecha + hora)
    const { data: sesionExistente } = await supabase
      .from('sesiones')
      .select('id_sesion')
      .eq('id_lead', leadId)
      .eq('fecha_sesion', fecha_sesion)
      .eq('hora_inicio', hora_inicio)
      .maybeSingle()

    let sesionError: unknown = null

    if (sesionExistente?.id_sesion) {
      const { error } = await supabase
        .from('sesiones')
        .update({
          ...(consultorId && { id_consultor: consultorId }),
          hora_fin,
          modalidad,
          caso_de_uso: service_name,
        })
        .eq('id_sesion', sesionExistente.id_sesion)
      sesionError = error
    } else {
      const { error } = await supabase.from('sesiones').insert({
        id_lead: leadId,
        id_consultor: consultorId,
        fecha_sesion,
        hora_inicio,
        hora_fin,
        modalidad,
        caso_de_uso: service_name,
        status: 'En seguimiento',
      })
      sesionError = error
    }

    if (sesionError) {
      console.error('Error creando sesión:', sesionError)
      return NextResponse.json({ error: 'Error creando sesión' }, { status: 500 })
    }

    return NextResponse.json(
      { ok: true, lead_id: leadId, consultor_id: consultorId, consultor_matched_by: consultorMatchedBy },
      { status: 201 }
    )
  } catch (err) {
    console.error('Error en /api/booking:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
