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
      modalidad = 'Virtual',
    } = body

    // Parsear fechas de Bookings: "04/10/2026 15:00:00" → "2026-04-10" y "15:00"
    function parseBookingDate(dt: string): { fecha: string; hora: string } {
      if (!dt) return { fecha: '', hora: '' }
      const [datePart, timePart] = dt.split(' ')
      const [month, day, year] = datePart.split('/')
      const hora = timePart ? timePart.slice(0, 5) : ''
      return { fecha: `${year}-${month}-${day}`, hora }
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

    // 1. Buscar consultor por email del StaffMember
    const staffEmail = body.staff_email || null
    console.log('staff_email recibido:', staffEmail)
    console.log('body completo:', JSON.stringify(body))
    let consultorId: string | null = null

    if (staffEmail) {
      const { data: consultor } = await supabase
        .from('consultores')
        .select('id')
        .eq('email', staffEmail)
        .single()
      if (consultor) consultorId = consultor.id
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

    // 3. Crear la sesión asociada
    const { error: sesionError } = await supabase.from('sesiones').insert({
      id_lead: leadId,
      id_consultor: consultorId,
      fecha_sesion,
      hora_inicio,
      hora_fin,
      modalidad,
      caso_de_uso: service_name,
      status: 'En seguimiento',
    })

    if (sesionError) {
      console.error('Error creando sesión:', sesionError)
      return NextResponse.json({ error: 'Error creando sesión' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, lead_id: leadId }, { status: 201 })
  } catch (err) {
    console.error('Error en /api/booking:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
