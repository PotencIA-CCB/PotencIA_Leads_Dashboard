# ConsultorIA — Dashboard de Gestión PotencIA

Panel interno de gestión de leads y sesiones de consultoría para el programa **PotencIA** de la Cámara de Comercio de Barranquilla.

---

## Stack

- **Next.js 16** + React 19 + TypeScript
- **Tailwind CSS v4**
- **Supabase** — base de datos y autenticación
- **Recharts** — gráficas y métricas
- **DeepSeek API** — análisis de insights con IA
- **Microsoft Bookings + Power Automate** — integración de reservas

---

## Variables de entorno

Crea un archivo `.env.local` en la raíz del proyecto:

```env
NEXT_PUBLIC_SUPABASE_URL=<tu_supabase_url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<tu_anon_key>
SUPABASE_SERVICE_ROLE_KEY=<tu_service_role_key>
DEEPSEEK_API_KEY=<tu_deepseek_api_key>
BOOKING_WEBHOOK_SECRET=<tu_webhook_secret>
INSIGHTS_MIN_NEW_RECORDS=20
```

---

## Cómo correr el proyecto

```bash
npm install
npm run dev
```

La app corre en `http://localhost:3000`.

Para exponer el endpoint de booking públicamente (desarrollo):

```bash
cloudflared tunnel --url http://localhost:3000
```

---

## Roles

| Rol | Acceso |
|-----|--------|
| `admin` | Todos los leads, métricas globales, asignación de consultores, sección Consultores |
| `consultor` | Solo sus leads asignados, sus sesiones y métricas propias |

---

## Flujo completo

```
Cliente llena formulario en Landing
        ↓
Lead creado en Supabase (status: Pendiente)
        ↓
Cliente agenda en Microsoft Bookings
        ↓
Power Automate espera 2 minutos y hace POST a /api/booking
        ↓
Lead actualizado en Supabase (status: Agendado + consultor asignado)
        ↓
Admin/Consultor ve el lead en el dashboard
```

---

## Endpoints API

### `POST /api/booking`
Recibe reservas desde Power Automate (Microsoft Bookings).

**Headers requeridos:**
```
x-webhook-secret: <BOOKING_WEBHOOK_SECRET>
```

**Body:**
```json
{
  "full_name": "Juan Pérez",
  "email": "juan@empresa.com",
  "phone": "3001234567",
  "city": "Barranquilla",
  "fecha_sesion": "04/28/2026 09:00:00",
  "hora_fin": "04/28/2026 09:30:00",
  "service_name": "Soporte informático",
  "staff_email": "iaconsultor1@camarabaq.org.co",
  "staff_name": "Nombre del consultor (opcional)",
  "modalidad": "Virtual"
}
```
`fecha_sesion` y `hora_fin` también aceptan formatos ISO (`2026-04-28T09:00:00-05:00`).
`modalidad` acepta `Virtual` o `Presencial` (si llega vacío, se usa `Virtual`).

### `POST /api/insights`
Genera análisis estratégico con DeepSeek basado en las métricas actuales.

### `GET /api/insights`
Retorna el último insight generado.

---

## Estructura del proyecto

```
src/
├── app/
│   ├── api/
│   │   ├── booking/     # Webhook de Microsoft Bookings
│   │   └── insights/    # AI Insights con DeepSeek
│   ├── dashboard/
│   │   ├── consultores/ # Vista admin — métricas por consultor
│   │   ├── metricas/    # KPIs globales y gráficas
│   │   ├── sesiones/    # Registro y historial de sesiones
│   │   └── page.tsx     # Lista de leads
│   └── login/
├── components/
│   ├── LeadCard.tsx
│   └── LeadModal.tsx
├── hooks/
│   └── useMetricas.ts
├── lib/
│   ├── supabase-browser.ts
│   └── supabase-server.ts
└── types/
    └── index.ts
```

---

## Configuración Power Automate

1. Trigger: **When a appointment is Created** (Microsoft Bookings)
2. Acción: **Delay** — 2 minutos
3. Acción: **HTTP POST** a `<URL>/api/booking` con header `x-webhook-secret`

### Body recomendado (Power Automate → HTTP)

Este ejemplo asume que el trigger de Bookings expone `StaffMembers` (es lo más confiable para obtener el consultor asignado). Ajusta los nombres si tu conector los muestra distinto.

```json
{
  "full_name": "@{triggerBody()?['CustomerName']}",
  "email": "@{triggerBody()?['CustomerEmail']}",
  "phone": "@{triggerBody()?['CustomerPhone']}",
  "city": "@{triggerBody()?['City']}",
  "fecha_sesion": "@{coalesce(triggerBody()?['StartTime'], triggerBody()?['StartDateTime'])}",
  "hora_fin": "@{coalesce(triggerBody()?['EndTime'], triggerBody()?['EndDateTime'])}",
  "service_name": "@{triggerBody()?['ServiceName']}",
  "staff_email": "@{triggerBody()?['StaffMembers'][0]?['EmailAddress']}",
  "modalidad": "@{triggerBody()?['Selecciona la Modalidad de tu sesión']}"
}
```

Notas:
- Si `staff_email` llega vacío, el dashboard no podrá asignar consultor automáticamente. En ese caso revisa el payload del trigger para ubicar el campo correcto (o usa `staff_name` como fallback).
- Para que el match funcione, `consultores.email` en Supabase debe coincidir con el email del staff en Bookings.

---

## Base de datos (Supabase)

Tablas principales:
- `leads` — clientes registrados desde la landing o Bookings
- `consultores` — equipo interno con `auth_id` vinculado a Supabase Auth
- `sesiones` — sesiones de consultoría con horarios y entregables
- `insights` — análisis generados por IA guardados históricamente

### Acceso al dashboard (auth_id)

El login valida acceso por `consultores.auth_id` (UUID del usuario en Supabase Auth). Para habilitar un consultor:
1. Crear usuario en **Auth → Users**
2. Copiar su `User UID`
3. Actualizar la fila en `consultores`:
```sql
update consultores
set auth_id = '<USER_UID>'
where email = 'consultor@dominio.com';
```
