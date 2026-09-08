/**
 * Coerciones de tipos para la ingesta.
 *
 * Rescatadas de n8n/WF-3 (nodo `Normalize Rows`), donde vivían minificadas en
 * una línea dentro del JSON del workflow y sin un solo test.
 *
 * addMinutes existe para reemplazar el cálculo de hora_fin de WF-2, que usaba
 * `new Date` + `getHours()` y por tanto dependía de la zona horaria del
 * proceso: el navegador corre en America/Bogota y el Worker en UTC, así que la
 * misma fila daba resultados distintos en la previsualización y en la escritura.
 */
import { describe, it, expect } from 'vitest'
import { toDate, toTime, toInt, toBool, addMinutes, trimOrNull } from '../coerce'

describe('toDate', () => {
  it('devuelve tal cual una fecha ISO', () => {
    expect(toDate('2026-09-15')).toBe('2026-09-15')
  })

  it('recorta la parte de hora de un timestamp ISO', () => {
    expect(toDate('2026-09-15T14:30:00Z')).toBe('2026-09-15')
  })

  it('convierte un serial de Excel contando desde 1899-12-30', () => {
    // 1 = 1899-12-31, así que 46280 cae en 2026-09-15
    expect(toDate(46280)).toBe('2026-09-15')
  })

  it('acepta el serial de Excel como cadena', () => {
    expect(toDate('46280')).toBe('2026-09-15')
  })

  it('interpreta DD/MM/YYYY con el día primero', () => {
    expect(toDate('15/09/2026')).toBe('2026-09-15')
  })

  it('acepta un día mayor a 12, que en formato MM/DD sería inválido', () => {
    expect(toDate('25/09/2026')).toBe('2026-09-25')
  })

  it('rechaza un mes mayor a 12', () => {
    expect(toDate('31/13/2026')).toBeNull()
  })

  it('rechaza un día mayor a 31', () => {
    expect(toDate('32/01/2026')).toBeNull()
  })

  it('devuelve null con cadena vacía, guion y basura', () => {
    expect(toDate('')).toBeNull()
    expect(toDate('-')).toBeNull()
    expect(toDate('no es una fecha')).toBeNull()
  })

  it('devuelve null con null y undefined', () => {
    expect(toDate(null)).toBeNull()
    expect(toDate(undefined)).toBeNull()
  })

  it('usa componentes UTC de un objeto Date, sin desplazar por zona horaria', () => {
    expect(toDate(new Date(Date.UTC(2026, 8, 15)))).toBe('2026-09-15')
  })
})

describe('toTime', () => {
  it('normaliza HH:MM', () => {
    expect(toTime('14:30')).toBe('14:30')
  })

  it('rellena la hora de un solo dígito', () => {
    expect(toTime('9:05')).toBe('09:05')
  })

  it('recorta los segundos', () => {
    expect(toTime('14:30:45')).toBe('14:30')
  })

  it('convierte una fracción de día de Excel', () => {
    expect(toTime(0.5)).toBe('12:00')
    expect(toTime('0.5')).toBe('12:00')
    expect(toTime('.75')).toBe('18:00')
  })

  it('rechaza horas y minutos fuera de rango', () => {
    expect(toTime('25:00')).toBeNull()
    expect(toTime('12:60')).toBeNull()
  })

  it('devuelve null con vacío y basura', () => {
    expect(toTime('')).toBeNull()
    expect(toTime('a las tres')).toBeNull()
    expect(toTime(null)).toBeNull()
  })
})

describe('toInt', () => {
  it('convierte enteros en cadena', () => {
    expect(toInt('45')).toBe(45)
  })

  it('acepta números', () => {
    expect(toInt(45)).toBe(45)
  })

  it('trunca decimales', () => {
    expect(toInt('45.7')).toBe(45)
  })

  it('devuelve null con vacío y basura', () => {
    expect(toInt('')).toBeNull()
    expect(toInt('cuarenta')).toBeNull()
    expect(toInt(null)).toBeNull()
  })
})

describe('toBool', () => {
  it('reconoce los afirmativos en español e inglés', () => {
    for (const v of ['si', 'sí', 'SI', 'Sí', 'yes', 'true', '1', 'TRUE']) {
      expect(toBool(v)).toBe(true)
    }
  })

  it('devuelve false para negativos, vacío y nulos', () => {
    for (const v of ['no', 'No', 'false', '0', '', null, undefined]) {
      expect(toBool(v)).toBe(false)
    }
  })

  it('acepta booleanos nativos', () => {
    expect(toBool(true)).toBe(true)
    expect(toBool(false)).toBe(false)
  })
})

describe('addMinutes', () => {
  it('suma dentro del mismo día', () => {
    expect(addMinutes('14:30', 45)).toBe('15:15')
  })

  it('cruza la medianoche envolviendo a las 24 horas', () => {
    expect(addMinutes('23:45', 30)).toBe('00:15')
  })

  it('devuelve la misma hora al sumar cero', () => {
    expect(addMinutes('09:00', 0)).toBe('09:00')
  })

  it('devuelve null si falta la hora o la duración', () => {
    expect(addMinutes(null, 30)).toBeNull()
    expect(addMinutes('14:30', null)).toBeNull()
  })

  it('devuelve null con una hora mal formada', () => {
    expect(addMinutes('14h30', 30)).toBeNull()
  })

  it('no depende de la zona horaria del proceso', () => {
    // Protege contra el bug de WF-2. Este test recalcula con el TZ del proceso
    // ya fijado; la verificación cruzada real la hace el paso B4 corriendo la
    // suite con TZ=UTC y con TZ=America/Bogota.
    expect(addMinutes('23:45', 30)).toBe('00:15')
    expect(addMinutes('00:10', 1430)).toBe('00:00')
  })
})

describe('trimOrNull', () => {
  it('recorta espacios', () => {
    expect(trimOrNull('  hola  ')).toBe('hola')
  })

  it('devuelve null con vacío, solo espacios, null y undefined', () => {
    expect(trimOrNull('')).toBeNull()
    expect(trimOrNull('   ')).toBeNull()
    expect(trimOrNull(null)).toBeNull()
    expect(trimOrNull(undefined)).toBeNull()
  })
})
