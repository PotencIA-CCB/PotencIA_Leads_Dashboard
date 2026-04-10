# Changelog

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
- Página de sesiones con formulario de registro y tabla de historial
- Página de consultores con métricas individuales (solo admin)
- Autenticación con Supabase Auth
- Sidebar con navegación y perfil de usuario
- Sistema de roles `admin` y `consultor`
