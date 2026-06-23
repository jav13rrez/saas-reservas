# Prompt: Amelia Fine-Grained Documentation — Full Sidebar

## Contexto

Estoy construyendo un SaaS de reservas multitenant (`saas-reservas`) inspirado en el
plugin Amelia Premium para WordPress. El stack es: Next.js (admin), Fastify API,
Drizzle ORM, PostgreSQL con RLS, Redis, BullMQ.

Ya existe una referencia de alto nivel en:
`docs/analysis/amelia-ux-reference.md`

Y existe una referencia fina (campo a campo) de la sección Settings en:
`docs/analysis/amelia-settings-fine-grained.md`

El documento de Settings es el modelo a seguir. Para cada campo documenta:
tipo de control, todas las opciones posibles, valor por defecto, estado de
implementación en nuestro SaaS (✅/🔶/❌) y prioridad (🔴/🟡/🟢).

## Demo de Amelia

URL base:
```
https://sports.wpamelia.com/wp-admin/admin.php?page=wpamelia-
```

Credenciales del demo: **admin / admin**
(la sesión se resetea cada hora, en el minuto :15)

La UI es una **SPA Vue 3** con hash routing. El menú lateral corresponde a estas rutas:

| Sección sidebar | Hash / URL param |
|---|---|
| Dashboard | `page=wpamelia-dashboard` |
| Calendar | `page=wpamelia-calendar` |
| Bookings | `page=wpamelia-appointments` |
| Events | `page=wpamelia-events` |
| Employees | `page=wpamelia-employees` |
| Catalog | `page=wpamelia-services` |
| Locations | `page=wpamelia-locations` |
| Customers | `page=wpamelia-customers` |
| Finance | `page=wpamelia-finance` |
| Notifications | `page=wpamelia-notifications` |
| Customize | `page=wpamelia-customize` |
| Custom Fields | `page=wpamelia-custom-fields` |
| Features & Integrations | `page=wpamelia-settings#/integrations` |
| Settings | `page=wpamelia-settings#/general` ← ya documentado |

## Herramientas disponibles

Usa el **Chrome MCP** (`mcp__Claude_in_Chrome__*`) para navegar y extraer datos.
El Chrome MCP es DOM-aware; úsalo en lugar de web_fetch (que requiere autenticación WP).

Herramientas clave:
- `navigate` → ir a una URL
- `javascript_tool` → ejecutar JS para leer el DOM
- `computer` → hacer screenshots, clicks reales cuando el JS no funciona

## Lecciones aprendidas de la sesión de Settings

1. **Clicks programáticos no disparan Vue Router.** Usar `computer` (click visual real)
   para navegar entre sub-menús.
2. **Formularios con campos required bloquean navegación.** Si una página tiene inputs
   `required` vacíos, rellenarlos con el setter nativo antes de navegar:
   ```js
   const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
   setter.call(input, 'valor');
   input.dispatchEvent(new Event('input', { bubbles: true }));
   ```
3. **Dropdowns comparten portal DOM.** Al abrir un dropdown El-Select, sus opciones
   aparecen en un nodo `<body>` compartido. Abrirlo, capturar con JS las opciones del
   portal, cerrarlo antes de abrir el siguiente.
4. **Acordeones colapsados.** Clickar el header del acordeón con `computer` para
   expandirlo; el JS `.click()` no siempre dispara la animación de Vue.
5. **SMS de Amelia es servicio de pago.** El sub-tab SMS redirige a Email en el demo;
   documentarlo como «requiere cuenta Amelia SMS» y pasar al siguiente.
6. **La sesión WP expira.** Si aparece el modal de login, introducir admin/admin y
   hacer click en Log In antes de continuar.

## Tarea

Recorre **cada sección del sidebar**, en este orden:

1. Dashboard
2. Calendar
3. Bookings (Appointments list + filtros + modal New Appointment con todos sus campos)
4. Events (list + modal New Event con todos sus campos)
5. Employees (list + modal New Employee con todos sus campos, sub-tabs: Details, Work hours, Days off, Special days, Services, Assigned locations, Finance)
6. Catalog (Servicios: list + modal New Service con todos sus campos y sub-tabs; Categorías si existen)
7. Locations (list + modal New Location)
8. Customers (list + modal New Customer)
9. Finance (sub-tabs: Payments, Coupons, Gift cards)
10. Notifications (plantillas de email/SMS por evento: Appointment pending/approved/rejected/cancelled/rescheduled, Reminder, Follow-up, Wishlist, etc.)
11. Customize (widget booking: pasos, campos visibles, labels configurables)
12. Custom Fields (tipos de campo disponibles, a qué entidades aplican)
13. Features & Integrations (lista de integraciones y sus campos de configuración)

Para **cada sección** documenta:

- **Qué hace** (1 párrafo)
- **Campos del formulario / modal principal** (tabla con: Campo · Tipo · Opciones/valores · Default · Estado SaaS · Prioridad)
- **Sub-tabs o sub-secciones** (si existen, una tabla por sub-tab)
- **Observaciones para implementación** (brechas concretas, acciones recomendadas)

## Output

Genera **un archivo por sección del sidebar**, en `docs/analysis/`:

| Sección | Archivo de salida |
|---|---|
| Dashboard | `amelia-dashboard-fine-grained.md` |
| Calendar | `amelia-calendar-fine-grained.md` |
| Bookings | `amelia-bookings-fine-grained.md` |
| Events | `amelia-events-fine-grained.md` |
| Employees | `amelia-employees-fine-grained.md` |
| Catalog | `amelia-catalog-fine-grained.md` |
| Locations | `amelia-locations-fine-grained.md` |
| Customers | `amelia-customers-fine-grained.md` |
| Finance | `amelia-finance-fine-grained.md` |
| Notifications | `amelia-notifications-fine-grained.md` |
| Customize | `amelia-customize-fine-grained.md` |
| Custom Fields | `amelia-custom-fields-fine-grained.md` |
| Features & Integrations | `amelia-integrations-fine-grained.md` |

El documento de Settings ya existe: `amelia-settings-fine-grained.md`. Úsalo como
plantilla de formato exacto: tablas Markdown, emojis de estado/prioridad (✅/🔶/❌
y 🔴/🟡/🟢), sección final «Resumen de brechas críticas» ordenada por prioridad.

Guarda cada archivo en cuanto termines esa sección — no esperes a tener todas.
Así si la sesión se interrumpe, el trabajo parcial queda persistido.

Al terminar la sesión completa (o al interrumpirla), actualiza `HANDOFF.md` añadiendo
en «Changed files» la lista de archivos generados y la sección por la que se quedó
si no se completó todo.

## Notas adicionales

- El objetivo final es que Claude Code pueda leer este documento y saber exactamente
  qué features faltan en el SaaS, con qué prioridad implementarlas y cómo deberían
  comportarse según la referencia de Amelia.
- No copies código fuente de Amelia. Solo documenta UX y comportamiento observable.
- Si una sección está bloqueada en el demo o requiere datos que no existen (p.ej.
  Finance sin pagos reales), documenta lo que puedas ver en la UI vacía y anota
  «sin datos en demo».
- Prioriza anchura sobre profundidad: es mejor tener las 13 secciones documentadas
  a nivel de tabla que 3 secciones documentadas exhaustivamente.
