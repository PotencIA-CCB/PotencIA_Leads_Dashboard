import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

/** Pure helper: extract the full name from a booking body. Exported for unit testing. */
export function extractNombreCompleto(body: Record<string, string | undefined>): string {
  return (body.full_name ?? body.nombre ?? '').trim()
}

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
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
      email,
      phone = null,
      city = null,
      service_name = null,
      id_num = null,
      nit = null,
    } = body

    const nombre_completo = extractNombreCompleto(body)

    const durationRaw = body.duration ?? null
    const duration = typeof durationRaw === 'number' ? durationRaw : (typeof durationRaw === 'string' ? parseInt(durationRaw, 10) || null : null)

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

    function parseBookingDate(dt: string): { fecha: string; hora: string } {
      if (!dt) return { fecha: '', hora: '' }
      const trimmed = String(dt).trim()
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
      if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
        return { fecha: datePart, hora }
      }
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

    if (!nombre_completo || !email || !fecha_sesion || !hora_inicio) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: nombre_completo (o full_name), email, fecha_sesion, hora_inicio' },
        { status: 400 }
      )
    }

    // 1. Buscar consultor por email institucional o alternativo
    const staffEmailRaw = body.staff_email || null
    const staffEmail = typeof staffEmailRaw === 'string' ? staffEmailRaw.trim().toLowerCase() : null
    const staffNameRaw = body.staff_name ?? body.staff_display_name ?? null
    const staffName = typeof staffNameRaw === 'string' ? staffNameRaw.trim() : null

    let consultorId: string | null = null
    let consultorMatchedBy: 'email' | 'name' | null = null

    if (staffEmail) {
      const { data: consultor } = await supabase
        .from('consultores')
        .select('id')
        .or(`email_institucional.ilike.${staffEmail},email.ilike.${staffEmail}`)
        .limit(1)
        .single()
      if (consultor) {
        consultorId = consultor.id
        consultorMatchedBy = 'email'
      }
    }
    if (!consultorId && staffName) {
      const { data: consultor } = await supabase
        .from('consultores')
        .select('id')
        .ilike('nombre', staffName)
        .limit(1)
        .maybeSingle()
      if (consultor) {
        consultorId = consultor.id
        consultorMatchedBy = 'name'
      }
    }

    // 2. Match o create lead
    const idNumClean = typeof id_num === 'string' ? id_num.trim() : ''
    const nitClean = typeof nit === 'string' ? nit.trim() : ''

    const { data: mergeResult, error: mergeError } = await supabase.rpc(
      'match_or_create_lead',
      {
        p_email: email,
        p_nombre_completo: nombre_completo,
        p_phone: phone,
        p_city: city,
        p_booking_customer_id: body.customer_id ?? null,
        p_id_num: idNumClean || null,
        p_nit: nitClean || null,
        p_sector: body.sector ?? null,
        p_empresa: body.empresa ?? null,
        p_origen: 'booking',
      }
    )

    if (mergeError || !mergeResult?.length) {
      console.error('Error en match_or_create_lead:', mergeError)
      return NextResponse.json({ error: 'Error procesando lead' }, { status: 500 })
    }

    const leadId: string = mergeResult[0].lead_id
    const leadMatchedBy: string = mergeResult[0].matched_by

    // 3. Crear o actualizar consultoría (idempotente por lead + fecha + hora)
    const { data: conExistente } = await supabase
      .from('consultorias')
      .select('id, categoria_caso_uso')
      .eq('id_lead', leadId)
      .eq('fecha', fecha_sesion)
      .eq('hora_inicio', hora_inicio)
      .maybeSingle()

    let consultoriaError: unknown = null

    if (conExistente?.id) {
      const existingCategoria =
        typeof conExistente.categoria_caso_uso === 'string'
          ? conExistente.categoria_caso_uso.trim()
          : ''
      const shouldWriteCategoria = !existingCategoria && !!service_name

      const updatePayload: Record<string, unknown> = {
        staff_name: staffName,
        staff_email: staffEmail,
        servicio: service_name,
        duracion_minutos: duration,
        hora_fin,
        modalidad,
        updated_at: new Date().toISOString(),
      }
      if (shouldWriteCategoria) {
        updatePayload.categoria_caso_uso = service_name
      }

      const { error } = await supabase
        .from('consultorias')
        .update(updatePayload)
        .eq('id', conExistente.id)
      consultoriaError = error
    } else {
      const { error } = await supabase.from('consultorias').insert({
        id_lead: leadId,
        id_consultor: consultorId ?? null,
        fecha: fecha_sesion,
        hora_inicio,
        hora_fin,
        duracion_minutos: duration,
        modalidad,
        servicio: service_name,
        categoria_caso_uso: service_name,
        staff_name: staffName,
        staff_email: staffEmail,
        booking_id: body.booking_id ?? body.customer_id ?? null,
        status: 'Agendado',
      })
      consultoriaError = error
    }

    if (consultoriaError) {
      console.error('Error creando consultoría:', consultoriaError)
      return NextResponse.json({ error: 'Error creando consultoría' }, { status: 500 })
    }

    return NextResponse.json(
      {
        ok: true,
        lead_id: leadId,
        consultor_id: consultorId,
        consultor_matched_by: consultorMatchedBy,
        lead_matched_by: leadMatchedBy,
      },
      { status: 201 }
    )
  } catch (err) {
    console.error('Error en /api/booking:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
