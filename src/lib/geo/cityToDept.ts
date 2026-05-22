/**
 * Maps normalized Colombian city names (lowercase, trimmed, no accents)
 * to department names in UPPERCASE — matching the NOMBRE_DPT property
 * in colombia-departments.json (GeoJSON source: john-guerra/Colombia.geo.json).
 *
 * Key convention: same output as normalizeKey(city, '') from metricas.ts
 * Value convention: uppercase department name matching GeoJSON NOMBRE_DPT field
 */
export const CITY_TO_DEPT: Record<string, string> = {
  'bogota': 'SANTAFE DE BOGOTA D.C',
  'bogotá': 'SANTAFE DE BOGOTA D.C',
  'bogota dc': 'SANTAFE DE BOGOTA D.C',
  'bogotá dc': 'SANTAFE DE BOGOTA D.C',
  'medellin': 'ANTIOQUIA',
  'medellín': 'ANTIOQUIA',
  'cali': 'VALLE DEL CAUCA',
  'barranquilla': 'ATLANTICO',
  'cartagena': 'BOLIVAR',
  'cucuta': 'NORTE DE SANTANDER',
  'cúcuta': 'NORTE DE SANTANDER',
  'bucaramanga': 'SANTANDER',
  'pereira': 'RISARALDA',
  'manizales': 'CALDAS',
  'ibague': 'TOLIMA',
  'ibagué': 'TOLIMA',
  'villavicencio': 'META',
  'pasto': 'NARIÑO',
  'santa marta': 'MAGDALENA',
  'neiva': 'HUILA',
  'armenia': 'QUINDIO',
  'monteria': 'CORDOBA',
  'montería': 'CORDOBA',
  'sincelejo': 'SUCRE',
  'valledupar': 'CESAR',
  'popayan': 'CAUCA',
  'popayán': 'CAUCA',
  'tunja': 'BOYACA',
  'florencia': 'CAQUETA',
  'quibdo': 'CHOCO',
  'quibdó': 'CHOCO',
  'riohacha': 'LA GUAJIRA',
  'mocoa': 'PUTUMAYO',
  'yopal': 'CASANARE',
  'leticia': 'AMAZONAS',
  'mitu': 'VAUPES',
  'inirida': 'GUAINIA',
  'arauca': 'ARAUCA',
  'san jose del guaviare': 'GUAVIARE',
  'puerto carreno': 'VICHADA',
  'san andres': 'ARCHIPIELAGO DE SAN ANDRES PROVIDENCIA Y SANTA CATALINA',
}

/**
 * Look up a raw city string and return the matching NOMBRE_DPT value,
 * or null if the city is not in the map.
 */
export function cityToDept(rawCity: string | null | undefined): string | null {
  if (!rawCity) return null
  const key = rawCity.toLowerCase().trim()
  return CITY_TO_DEPT[key] ?? null
}
