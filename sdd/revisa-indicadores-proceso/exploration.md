## Exploration: Revisa a profundidad la sección Indicadores de Proceso — jerarquía tipo organigrama + responsive design

### Current State

La sección "Indicadores de Proceso" se encuentra en la página de Business Intelligence (`src/app/dashboard/bi/page.tsx:230-242`) y es renderizada por el componente `LeadsFunnel` (`src/components/dashboard/LeadsFunnel.tsx`, 279 líneas).

**Estructura del componente**:

```
LeadsFunnel
├── Tree 1 — Landing (líneas 106-177)
│   ├── Root: "se registraron en landing" (max-w-[600px])
│   ├── .funnel-stem (vertical 24px)
│   └── Level 2: .funnel-branch max-w-[940px] (flex row, 2 hijos)
│       ├── Left:  "nunca agendaron" (lead perdido)
│       └── Right: "sí agendaron"
│           ├── .funnel-stem (condicional: landingBooked > 0)
│           └── Level 3: .funnel-branch-right w-full (flex row, 2 hijos)
│               ├── Left:  "agendaron pero no asistieron" (rojo, no-shows)
│               └── Right: "completaron todo el ciclo" (verde)
│
├── Tree 2 — Bookings (líneas 180-220)
│   ├── Root: "bookings totales" (max-w-[600px])
│   ├── .funnel-stem
│   └── Level 2: .funnel-branch max-w-[940px] (flex row, 2 hijos)
│       ├── Left:  "solo agendaron" (ámbar)
│       └── Right: "agendaron y asistieron sin landing" (violeta)
│
└── Summary Table (líneas 223-276)
    └── 4 SummaryRow: ciclo completo, nunca agendaron, no-shows, bookings sin landing
```

**Data flow**: `useBusinessIntelligence()` → `computeFunnelStats()` → `LeadsFunnel(stats, totalBookings)`.

**Tipo FunnelStats** (`src/lib/capturaStats.ts:12-21`): 8 campos — 7 usados en el componente, 1 muerto (`asistieronSinLandingNiBooking`).

**Tipos de tarjeta**: `FunnelCard` renderiza icono circular (48px/52px) + número grande (34px/40px, Space Grotesk) + label (13px/15px). `SummaryRow` renderiza filas de tabla con icono + label + valor.

---

### Tree Connector Analysis — CSS en `src/app/globals.css:60-134`

Las líneas del árbol se dibujan exclusivamente con pseudo-elementos CSS. No hay SVG, canvas ni imágenes.

#### `.funnel-stem` (líneas 60-65)
```css
width: 1px; height: 24px; background: #cbd5e1; margin: 0 auto;
```
✅ **Correcto.** Línea vertical de 24px centrada. Conecta un nodo padre con la línea horizontal inferior.

#### `.funnel-branch` (líneas 67-81)
```css
display: flex; position: relative; padding-top: 24px;
```
`::before`: línea horizontal `left: 25%; right: 25%`. Para 2 hijos con `flex: 1` (50% cada uno), sus centros están en 25% y 75%. La línea horizontal va exactamente de centro a centro. El stem del padre cae al 50% donde forma la T.

✅ **Correcto para Level 2.** La geometría es precisa.

#### `.funnel-child::before` (líneas 91-100)
```css
top: -24px; left: 50%; transform: translateX(-50%); width: 1px; height: 24px;
```
✅ **Correcto.** Línea vertical desde el centro del hijo hacia arriba hasta la línea horizontal del branch.

#### `.funnel-branch-right` (líneas 102-121) ← EL PROBLEMA
```css
display: flex; position: relative; padding-top: 24px;
```
`::before`: `left: 16%; right: 5%`

❌ **INCORRECTO.** Para 2 hijos iguales dentro de `.funnel-branch-right` (cada uno `flex: 1` = 50%), los centros están en **25% y 75%**. La línea horizontal debería ir de 25% a 75% (`left: 25%; right: 25%`), igual que `.funnel-branch::before`.

**Valores actuales vs correctos:**

| Propiedad | Actual | Correcto | Error |
|-----------|--------|----------|-------|
| `left`    | 16%    | 25%      | −9% (empieza demasiado a la izquierda) |
| `right`   | 5%     | 25%      | −20% (termina demasiado a la derecha, en 95%) |

**Efecto visual**: La línea horizontal del Level 3 es asimétrica. El segmento izquierdo (desde el T-junction al centro del hijo izquierdo) es más largo de lo que debería. El segmento derecho se extiende 20% más allá del centro del hijo derecho. Rompe la estética de organigrama donde todas las uniones deben ser simétricas.

**Causa raíz**: Los valores `16%` y `5%` parecen ajustes manuales ("magic numbers") hechos para compensar visualmente algún otro desajuste, pero son geométricamente incorrectos. La regla correcta es `left: 25%; right: 25%` porque la estructura de hijos es idéntica a `.funnel-branch`.

#### Mobile hide rule (líneas 123-134)
```css
@media (max-width: 639px) {
  .funnel-stem, .funnel-branch::before,
  .funnel-child::before, .funnel-branch-right::before { display: none; }
  .funnel-branch, .funnel-branch-right { padding-top: 0; }
}
```
⚠️ **Funcional pero pobre.** Oculta TODAS las líneas en mobile. Las tarjetas se apilan verticalmente sin ningún indicador visual de jerarquía. No hay alternativa (indentación, bordes de color, dots, numeración).

---

### Responsive Gaps — Detallados por breakpoint

#### Mobile: < 640px (Tailwind `sm:`)
- ❌ Líneas de árbol: ocultas, sin alternativa visual de jerarquía
- ⚠️ Root cards: `max-w-[600px]` — a 360px viewport deja solo 30px de padding por lado con el `px-5` de la card, apenas suficiente
- ⚠️ Level 2 `.funnel-branch`: `max-w-[940px]` — no aplica restricción real en mobile, pero los dos hijos se muestran como columna (flex wrap no está definido, por lo que a < 640px con `max-w-[940px]` que es mayor que el viewport, el `flex` row se mantiene y las cards se comprimen horizontalmente)
- ⚠️ **Problema real en mobile**: `.funnel-branch` usa `display: flex` sin `flex-wrap`. A 360px con dos FunnelCards lado a lado, cada una con ícono (48px) + número (34px) + texto, el contenido se desborda o se comprime excesivamente
- ❌ Level 3 `.funnel-branch-right`: mismo problema — dos cards en row sin wrap a widths pequeños
- ⚠️ FunnelCard: `px-5 sm:px-6 py-4 sm:py-5` — padding base es 20px/16px, razonable pero el `gap-4` entre ícono y contenido suma presión horizontal
- ⚠️ Números grandes: `text-[34px]` sin reducción para pantallas < 360px
- ⚠️ Summary table: `overflow-x-auto` presente, pero puede requerir scroll horizontal en pantallas muy pequeñas

#### Tablet: 640px – 1023px
- ⚠️ Root cards `max-w-[600px]`: a 640px viewport, la card ocupa 600px + padding exterior → muy ajustado
- ⚠️ Level 2 `max-w-[940px]`: a 768px, cada hijo recibe ~384px (con gap y padding). Las FunnelCards con ícono 52px + número 40px + texto caben pero con poco margen
- ✅ Las líneas del árbol son visibles y funcionalmente correctas (salvo el bug de `.funnel-branch-right`)
- ❌ No hay breakpoint tablet específico para reorganizar el layout — se usa el mismo layout que desktop

#### Desktop: ≥ 1024px
- ✅ Layout funciona
- ❌ El bug de `.funnel-branch-right::before` es visible: línea horizontal asimétrica en Level 3

---

### Issues Found (numerados)

1. **`.funnel-branch-right::before` tiene valores incorrectos** (globals.css:114-115): `left: 16%; right: 5%` debe ser `left: 25%; right: 25%`. La línea horizontal del Level 3 es asimétrica, rompiendo la estética de organigrama.

2. **Sin responsive layout para Level 2 y Level 3 en mobile** (LeadsFunnel.tsx:122, 149, 196): `.funnel-branch` y `.funnel-branch-right` usan `display: flex` sin `flex-wrap`. A < 640px, las tarjetas se comprimen horizontalmente en lugar de apilarse. Deberían convertirse a columna en mobile.

3. **Sin indicador de jerarquía alternativo en mobile** (globals.css:123-134): Las líneas se ocultan completamente. No hay indentación, dots, bordes de color ni ningún reemplazo visual.

4. **`asistieronSinLandingNiBooking` es código muerto** (capturaStats.ts:20, 120-125): El campo se computa en `computeFunnelStats` pero nunca se desestructura ni renderiza en `LeadsFunnel.tsx`. También está en `emptyFunnelStats` (bi/page.tsx:27) y en los test fixtures. O se debe renderizar en el UI o se debe eliminar del tipo y del cómputo.

5. **Test T-C04 tiene un falso positivo** (LeadsFunnel.test.tsx:66): `expect(html).toContain('1')` pasa porque el string "1" aparece dentro de "10" (totalLandingLeads), no porque `asistieronSinLandingNiBooking` se renderice. El campo jamás llega al HTML.

6. **`totalBookings` se pasa como prop separada pero no pertenece a `FunnelStats`** (LeadsFunnel.tsx:10, bi/page.tsx:240): No es un bug, pero es una inconsistencia de diseño — todos los demás valores vienen de `stats`, excepto este. Si se unifica, `totalBookings` debería ser parte de `FunnelStats`.

7. **Sin breakpoints intermedios para tipografía**: Los números grandes (`text-[34px] sm:text-[40px]`) no tienen ajuste para tablets (ej. `md:text-[36px]`). Los labels (`text-[13px] sm:text-[15px]`) tampoco.

8. **Falta `min-width` en el wrapper de la summary table**: Si bien tiene `overflow-x-auto`, no hay un `min-width` en el contenedor para evitar que la tabla se colapse excesivamente en mobile.

---

### Recommendation

**Arreglos críticos (jerarquía tipo organigrama)**:
1. Corregir `.funnel-branch-right::before`: cambiar `left: 16%; right: 5%` → `left: 25%; right: 25%` (línea 114-115 de globals.css). Esto alinea simétricamente la línea horizontal del Level 3 con los centros de sus hijos, igual que Level 2.
2. Para un look más refinado de organigrama, considerar agregar un círculo pequeño (4-6px) en cada punto de unión (donde el stem se encuentra con la línea horizontal) usando otro pseudo-elemento o un div explícito.

**Responsive design**:
3. Agregar `flex-col sm:flex-row` a `.funnel-branch` y `.funnel-branch-right` para que en mobile las tarjetas se apilen verticalmente en lugar de comprimirse. Ajustar `max-w` según breakpoint.
4. Reemplazar el `display: none` de las líneas en mobile por una alternativa visual: indentación con `pl-6` o `pl-8` en los hijos, o una línea vertical sutil a la izquierda (`border-l-2 border-slate-200`) para mantener la noción de jerarquía.
5. Ajustar `max-w-[600px]` de las root cards para mobile: `max-w-full sm:max-w-[600px]`.
6. Ajustar tipografía con breakpoints intermedios: `text-[28px] sm:text-[34px] md:text-[40px]` para números, `text-[11px] sm:text-[13px] md:text-[15px]` para labels.

**Limpieza**:
7. Decidir qué hacer con `asistieronSinLandingNiBooking`: o agregarlo al UI (quizás en la summary table), o eliminarlo del tipo, del cómputo y de los fixtures.
8. Corregir el test T-C04: eliminar la aserción `expect(html).toContain('1')` o reemplazarla por un valor que realmente se renderice (ej. verificar que `totalBookings: 20` se renderiza con `expect(html).toContain('>20<')`).

### Ready for Proposal
**Sí.** El análisis está completo. Se identificaron 8 issues concretos con ubicación exacta (archivo, línea, clase CSS). El cambio es acotado: ~20 líneas de CSS, ~10 líneas de JSX, limpieza de tipo + fix de test.
