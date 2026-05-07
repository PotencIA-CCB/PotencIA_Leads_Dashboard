# Changelog

## [0.3.0] — 2026-05-07

### Cambios mayores

#### Unificación de leads (Form PotencIA + Microsoft Bookings)
- Nueva columna `source` en `leads` (`landing` | `booking` | `manual`) con first-touch attribution
- Trigger automático en `preleads` que hace upsert en `leads` por email/cédula/teléfono normalizado
- Una persona = una sola card sin importar cuántos canales toque
- Página `/dashboard/agendamientos` eliminada — toda la info se ve en `/dashboard`
- Página `/dashboard/sesiones` eliminada — las sesiones se crean automáticamente desde el webhook de Bookings

#### Deduplicación cross-canal
- Match por **booking_customer_id** (Microsoft stable ID)
- Match por **email** canónico o `booking_email`
- Match por **cédula** (`id_num`) — sin ventana temporal
- Match por **teléfono normalizado** — reemplaza la ventana de 72hs por match unconstrained
- Backfill retroactivo: dedup automática de leads existentes que comparten id_num o phone_normalized (con verificación de nombre para evitar falsos positivos)

#### Fix de booleans del Form PotencIA
- `merge_prelead_into_leads` ahora hace `coalesce(prelead, lead)` para `perfil_personal`, `perfil_empresa`, `autorizo_datos` (antes el `false` default del booking pisaba el `true` del form)
- Backfill retroactivo aplica los flags correctos a leads ya creados

### Frontend

#### Card de lead — rediseño metálico minimalista
- Estética metálica (gradient slate 100→50→200 con highlight interno)
- Avatar con iniciales en gradient acero
- Sin efectos hover (cards y botones estáticos)
- Cursor pointer en todo lo clickable
- Status chips sin shift al click (border consistente entre active/idle)
- Caso de uso visible (cita en cursiva, line-clamp-2, formateado sin guiones)
- Callout de agendamiento si aplica (fecha, hora, modalidad, consultor)
- Quitada la lógica de "Unificado" / "Landing" del card (ahora solo en modal)

#### Modal de lead — toda la info del Form PotencIA
- Header con avatar + pill de canal (Form PotencIA / Microsoft Bookings / Manual)
- Badge "Unificado" cuando el lead tiene datos de ambos canales
- Detección conservadora: solo `use_case` o `comments` (no flags de perfil con default false)
- Sección **Información de contacto**: email, email de Bookings (si difiere), teléfono, ciudad
- Sección **Información profesional**: cédula, NIT, cargo, área
- Sección **Necesidad del cliente**: solución, caso de uso, comentarios
- Sección **Perfil declarado**: booleans con ícono check verde (true) / X gris (false)
- Sección **Agendamiento**: fecha completa, horario, modalidad, consultor
- Modal de notas

#### Dashboard
- Stats reorganizados: Total activos / Pendientes / Agendados / En seguimiento / Resueltos (excluye cancelados del total)
- Filtros simplificados: solo búsqueda + chips de estado
- Vista única (lista grid)
- Banner sin asignar (admin) clickeable

#### Métricas
- "Casos de uso más solicitados" ahora usa `use_case` real del Form (antes mostraba `solution` que es servicio de Bookings)
- Empty state cuando no hay datos
- Texto formateado con espacios y mayúscula inicial (antes `"buzon-de-correo-inteligente"`, ahora `"Buzón de correo inteligente"`)
- Barra de ciudad muestra conteo encima de cada barra
- Nombre completo de ciudad sin truncar (`"Barranquilla"` en vez de `"Barra"`)
- Cards y botones sin hover effects

### Plataforma

#### Next.js 16 alignment
- `src/middleware.ts` → `src/proxy.ts` (file convention rename)
- File convention `app/icon.svg` para favicon (foquito en colores de marca, ~400 bytes)
- Metadata enriquecida (title, description, OG tags, locale)
- Eliminado uso de helpers/rutas obsoletas

#### Cloudflare Workers/Pages
- API routes con `dynamic = 'force-dynamic'` (compatible con edge)
- Auth fetch deduped vía promesa memoizada (evita lock contention de Supabase auth bajo React Strict Mode)

#### Seguridad
- Vulnerabilidad XSS en `postcss <8.5.10` parchada vía `overrides` en `package.json`
- `console.log` que exponían datos del cliente (body completo del booking) eliminados
- `npm audit` reporta 0 vulnerabilities

### Limpieza
- Eliminados: `src/lib/supabase.ts` (helper huérfano), `src/middleware.ts`, `src/app/dashboard/sesiones/`, `src/app/dashboard/agendamientos/`, 5 SVGs template de create-next-app, 2 imágenes pegadas por error en `supabase/migrations/`
- Eliminadas carpetas de referencia manual: `consulores/`, `consultor/`
- Eliminado `openspec/` (specs SDD desactualizados)
- Eliminado `supabase/.temp/` (cache CLI)
- `.gitignore` extendido: `.wrangler/`, `.dev.vars`, carpetas de referencia

### Migraciones SQL aplicadas
1. `20260506_unify_leads_with_preleads.sql` — columna `source` + trigger + backfill
2. `20260506_dedup_by_id_num.sql` — match por cédula + dedup retroactivo
3. `20260506_dedup_by_phone.sql` — match por teléfono unconstrained + dedup retroactivo
4. `20260506_fix_perfil_flags_merge.sql` — invierte coalesce de perfil flags + backfill

---

## [0.2.0] — 2026-04-10

### Agregado
- Integración con Microsoft Bookings via Power Automate
- Endpoint `POST /api/booking` para recibir reservas automáticamente
- Asignación automática de consultor basada en `StaffMembers` de Bookings
- Delay de 2 minutos en Power Automate para capturar el consultor asignado
- Banner de notificación en dashboard para leads agendados sin consultor (solo admin)
- Protección de ruta `/dashboard/consultores` — redirige si el rol no es `admin`
- Verificación de registro en tabla `consultores` al hacer login
- Métricas filtradas por rol — consultores solo ven sus propios datos
- Variables de entorno `SUPABASE_SERVICE_ROLE_KEY` y `BOOKING_WEBHOOK_SECRET`
- Soporte para `allowedDevOrigins` con Cloudflare Tunnel en desarrollo

### Corregido
- Input de búsqueda decorativo eliminado del header (no tenía funcionalidad)
- `proxy.ts` ahora protege correctamente las rutas del dashboard
- Columna `id_consultor` en tabla `sesiones` acepta `null` para reservas sin asignar

---

## [0.1.0] — 2026-04-01

### Agregado
- Dashboard inicial con lista de leads, filtros por estado y búsqueda
- Modal de detalle de lead con cambio de estado y asignación de consultor
- Página de métricas con KPIs, gráficas de línea, barras y donut
- AI Insights con DeepSeek — generación y persistencia de análisis
- Página de consultores con métricas individuales (solo admin)
- Autenticación con Supabase Auth
- Sidebar con navegación y perfil de usuario
- Sistema de roles `admin` y `consultor`
