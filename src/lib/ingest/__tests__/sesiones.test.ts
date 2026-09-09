/**
 * Normalizador del .xlsx de registro de sesión.
 *
 * Reemplaza el nodo `Normalize Rows` de n8n/WF-3 y unifica su mapeo de estados
 * con el del nodo `Map Session Status`, que producían resultados distintos
 * entre sí (exploration.md §2 D-3).
 */
import { describe, it, expect } from 'vitest'
import {
  mapResultadoAStatus,
  headersLookLikeSesiones,
  normalizeSesionRow,
} from '../sesiones'

function fila(valores: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    'Id': 'SES-001',
    'Fecha de la Sesión': '2026-09-15',
    'Nombre del Usuario Atendido': 'Ana Pérez',
    'Correo del Usuario Atendido': 'ana@empresa.com',
    'Celular del usuario atendido': '3001234567',
    'Cedula del Usuario Atendido': '1234567890',
    'Nit de la Empresa': '900123456',
    'Municipio': 'Barranquilla',
    'Cargo del Usuario Atendido': 'Gerente',
    'Nivel del Cargo': 'Directivo',
    'Área del Usuario Atendido': 'Operaciones',
    'Nombre de la empresa': 'Empresa SAS',
    'Sexo Usuario Atendido': 'F',
    'Hora de inicio': '14:00',
    'Hora de finalización': '15:00',
    'Duración de la Sesión / Minutos': '60',
    'Modalidad de la Sesión': 'Virtual',
    'Consultor / Coder': 'Carlos Consultor',
    'Correo Institucional / Consultor': 'carlos@camarabaq.org.co',
    'Nivel de potencia': 'Alto',
    'Categoría del caso (Potencia)1': 'Automatización',
    'Categoria del Caso de Uso': 'Agentes',
    'Pregunta': '¿Cómo automatizo mi facturación?',
    'Motivo de la Consulta': 'Proceso manual',
    'Estado Inicial – Situación Antes de la Intervención': 'Todo en Excel',
    'Acciones Realizadas Durante la Sesión (Describir paso a paso lo trabajado)': 'Se construyó un flujo',
    'Resultado Final – Situación Después de la Intervención': 'Flujo funcionando',
    'Estimación del Impacto Generado': '10 horas al mes',
    'Entregables Producidos': 'Plantilla y guía',
    'Cantidad de nuevos productos creados': '2',
    '¿La sesión fue grabada?': 'Si',
    'Enlace de Grabación': 'https://ejemplo.co/video',
    'Adjuntar Evidencia': 'https://ejemplo.co/evidencia',
    'Confirmo que este caso NO corresponde a automatización o integración de sistemas complejos.': 'Si',
    'Resultado de la sesión': 'Caso resuelto en la sesión',
    ...valores,
  }
}

describe('mapResultadoAStatus', () => {
  it('mapea los siete estados desde el texto del resultado', () => {
    expect(mapResultadoAStatus('Caso resuelto en la sesión')).toBe('Resuelto')
    expect(mapResultadoAStatus('Queda en seguimiento')).toBe('En seguimiento')
    expect(mapResultadoAStatus('La sesión fue cancelada, cancelado por el cliente')).toBe('Cancelado')
    expect(mapResultadoAStatus('El usuario no asistió a la sesión')).toBe('No asistió')
    expect(mapResultadoAStatus('Hay que escalar el caso')).toBe('Escalar')
  })

  it('no distingue mayúsculas', () => {
    expect(mapResultadoAStatus('RESUELTO')).toBe('Resuelto')
    expect(mapResultadoAStatus('NO ASISTIÓ')).toBe('No asistió')
  })

  it('reconoce no asistió con y sin tilde', () => {
    expect(mapResultadoAStatus('no asistio')).toBe('No asistió')
    expect(mapResultadoAStatus('no asistió')).toBe('No asistió')
  })

  it('prefiere el patrón más específico cuando hay varios', () => {
    // 'no asistió' gana sobre 'seguimiento'
    expect(mapResultadoAStatus('No asistió, queda en seguimiento')).toBe('No asistió')
    // 'cancelado' gana sobre 'resuelto'
    expect(mapResultadoAStatus('Cancelado, no se resuelto nada')).toBe('Cancelado')
  })

  it('usa Resuelto como valor por defecto cuando hay texto no reconocido', () => {
    expect(mapResultadoAStatus('Se hizo la sesión completa')).toBe('Resuelto')
  })

  it('devuelve null con resultado vacío, en blanco o nulo (R31b)', () => {
    expect(mapResultadoAStatus('')).toBeNull()
    expect(mapResultadoAStatus('   ')).toBeNull()
    expect(mapResultadoAStatus(null)).toBeNull()
  })
})

describe('headersLookLikeSesiones', () => {
  it('reconoce los encabezados del Excel de sesión', () => {
    expect(headersLookLikeSesiones(['Fecha de la Sesión', 'Correo del Usuario Atendido'])).toBe(true)
  })

  it('reconoce la variante con Correo electrónico', () => {
    expect(headersLookLikeSesiones(['Fecha', 'Correo electrónico'])).toBe(true)
  })

  it('rechaza los encabezados del .tsv de bookings', () => {
    const bookings = ['Date Time', 'Customer Name', 'Customer Email', 'Booking Id']
    expect(headersLookLikeSesiones(bookings)).toBe(false)
  })
})

describe('normalizeSesionRow', () => {
  it('normaliza una fila completa', () => {
    const r = normalizeSesionRow(fila(), 2)
    expect(r.ok).toBe(true)
    if (!r.ok) return

    expect(r.row.clave).toBe('SES-001')
    expect(r.row.lead.p_email).toBe('ana@empresa.com')
    expect(r.row.lead.p_nombre_completo).toBe('Ana Pérez')
    expect(r.row.lead.p_id_num).toBe('1234567890')
    expect(r.row.lead.p_nit).toBe('900123456')
    expect(r.row.lead.p_city).toBe('Barranquilla')
    expect(r.row.lead.p_cargo).toBe('Gerente')
    expect(r.row.lead.p_company_role_level).toBe('Directivo')
    expect(r.row.lead.p_company_role_area).toBe('Operaciones')
    expect(r.row.lead.p_empresa).toBe('Empresa SAS')
    expect(r.row.lead.p_sexo).toBe('F')
    expect(r.row.lead.p_origen).toBe('sesion')

    expect(r.row.consultoria.fecha).toBe('2026-09-15')
    expect(r.row.consultoria.hora_inicio).toBe('14:00')
    expect(r.row.consultoria.hora_fin).toBe('15:00')
    expect(r.row.consultoria.duracion_minutos).toBe(60)
    expect(r.row.consultoria.modalidad).toBe('Virtual')
    expect(r.row.consultoria.staff_name).toBe('Carlos Consultor')
    expect(r.row.consultoria.staff_email).toBe('carlos@camarabaq.org.co')
    expect(r.row.consultoria.nivel_potencia).toBe('Alto')
    expect(r.row.consultoria.categoria_caso).toBe('Automatización')
    expect(r.row.consultoria.categoria_caso_uso).toBe('Agentes')
    expect(r.row.consultoria.status).toBe('Resuelto')

    expect(r.row.registro.id_externo).toBe('SES-001')
    expect(r.row.registro.pregunta).toBe('¿Cómo automatizo mi facturación?')
    expect(r.row.registro.motivo_consulta).toBe('Proceso manual')
    expect(r.row.registro.estado_inicial).toBe('Todo en Excel')
    expect(r.row.registro.acciones_realizadas).toBe('Se construyó un flujo')
    expect(r.row.registro.resultado_final).toBe('Flujo funcionando')
    expect(r.row.registro.estimacion_impacto).toBe('10 horas al mes')
    expect(r.row.registro.entregables).toBe('Plantilla y guía')
    expect(r.row.registro.cantidad_productos).toBe(2)
    expect(r.row.registro.sesion_grabada).toBe(true)
    expect(r.row.registro.enlace_grabacion).toBe('https://ejemplo.co/video')
    expect(r.row.registro.confirmo_no_automatizacion).toBe(true)
    expect(r.row.registro.duracion_sesion_minutos).toBe(60)
  })

  it('rechaza la fila sin correo', () => {
    const r = normalizeSesionRow(fila({ 'Correo del Usuario Atendido': '' }), 34)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.fila).toBe(34)
    expect(r.errores.some((e) => /correo/i.test(e.motivo))).toBe(true)
  })

  it('rechaza la fila con correo sin arroba', () => {
    const r = normalizeSesionRow(fila({ 'Correo del Usuario Atendido': 'ana.empresa.com' }), 34)
    expect(r.ok).toBe(false)
  })

  it('acepta la variante de encabezado Correo electrónico', () => {
    const base = fila()
    delete base['Correo del Usuario Atendido']
    base['Correo electrónico'] = 'otra@empresa.com'
    const r = normalizeSesionRow(base, 2)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.row.lead.p_email).toBe('otra@empresa.com')
  })

  it('rechaza la fila con fecha ilegible', () => {
    const r = normalizeSesionRow(fila({ 'Fecha de la Sesión': '-' }), 130)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.errores.some((e) => /fecha/i.test(e.motivo))).toBe(true)
  })

  it('acepta un serial de Excel en la fecha', () => {
    const r = normalizeSesionRow(fila({ 'Fecha de la Sesión': 46280 }), 2)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.row.consultoria.fecha).toBe('2026-09-15')
  })

  it('acepta una fracción de día en la hora de inicio', () => {
    const r = normalizeSesionRow(fila({ 'Hora de inicio': 0.5 }), 2)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.row.consultoria.hora_inicio).toBe('12:00')
  })

  it('deja el status en null cuando el resultado viene vacío (R31b)', () => {
    const r = normalizeSesionRow(fila({ 'Resultado de la sesión': '' }), 2)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.row.consultoria.status).toBeNull()
    expect(r.row.registro.resultado).toBeNull()
  })

  it('usa la clave de fallback cuando falta la columna Id', () => {
    const r = normalizeSesionRow(fila({ 'Id': '' }), 2)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.row.clave).toBe('ana@empresa.com|2026-09-15')
    expect(r.row.registro.id_externo).toBeNull()
  })

  it('resuelve a Virtual cuando falta la modalidad', () => {
    const r = normalizeSesionRow(fila({ 'Modalidad de la Sesión': '' }), 2)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.row.consultoria.modalidad).toBe('Virtual')
  })

  it('normaliza Presencial en la modalidad', () => {
    const r = normalizeSesionRow(fila({ 'Modalidad de la Sesión': 'presencial' }), 2)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.row.consultoria.modalidad).toBe('Presencial')
  })

  it('usa cero cuando falta la cantidad de productos', () => {
    const r = normalizeSesionRow(fila({ 'Cantidad de nuevos productos creados': '' }), 2)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.row.registro.cantidad_productos).toBe(0)
  })

  it('encuentra las columnas con encabezados variantes y acentos', () => {
    const base = fila()
    delete base['Estado Inicial – Situación Antes de la Intervención']
    base['ESTADO INICIAL'] = 'sin proceso'
    const r = normalizeSesionRow(base, 2)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.row.registro.estado_inicial).toBe('sin proceso')
  })

  it('nunca incluye datos personales en el motivo del error', () => {
    const r = normalizeSesionRow(fila({ 'Correo del Usuario Atendido': 'ana.perez@empresa.com', 'Fecha de la Sesión': '-' }), 34)
    expect(r.ok).toBe(false)
    if (r.ok) return
    for (const e of r.errores) {
      expect(e.motivo).not.toContain('ana.perez@empresa.com')
    }
  })
})

/**
 * El .xlsx real llega desde read-excel-file con las celdas ya tipadas: las de
 * fecha y hora como Date y las numéricas como number. `col` las convertía a
 * texto antes de que `coerce` las viera, y el String de un Date
 * ("Sun Mar 01 2026 19:00:00 GMT-0500…") no lo entiende ningún parser de los
 * nuestros. En producción eso hizo fallar 397 de 399 filas con
 * "Fecha de la sesión ilegible".
 */
describe('celdas tipadas de Excel', () => {
  it('normaliza una fila con Date y number como los entrega read-excel-file', () => {
    const r = normalizeSesionRow(
      fila({
        'Fecha de la Sesión': new Date(Date.UTC(2026, 8, 15)),
        'Hora de inicio': new Date(Date.UTC(2026, 8, 15, 14, 0)),
        'Hora de finalización': new Date(Date.UTC(2026, 8, 15, 15, 0)),
        'Duración de la Sesión / Minutos': 60,
        'Cantidad de nuevos productos creados': 2,
      }),
      2,
    )

    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.row.consultoria.fecha).toBe('2026-09-15')
    expect(r.row.consultoria.hora_inicio).toBe('14:00')
    expect(r.row.consultoria.hora_fin).toBe('15:00')
    expect(r.row.consultoria.duracion_minutos).toBe(60)
    expect(r.row.registro.cantidad_productos).toBe(2)
  })
})
