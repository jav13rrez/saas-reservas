# Recorrido del menú admin — Análisis de huecos (puente a Spec-Kit)

Última actualización: 2026-06-24 (deep-dive Amelia: Catalog/Finance/Bookings)

## Propósito

Documento **vivo** del recorrido del panel admin (`apps/admin`) área por área. Para cada
área del sidebar registra: **(1) qué hace hoy** en el código, **(2) qué dice la referencia
Amelia** (`docs/analysis/amelia-*-fine-grained.md`), **(3) los huecos**, y **(4) el/los
candidato(s) a feature de Spec-Kit**.

Es el **puente** entre la investigación (`amelia-*-fine-grained.md`, material de input) y la
planificación formal: cada candidato aquí listado se convertirá en su propia feature con
`/speckit-specify` → `/speckit-plan` → `/speckit-tasks`. **No es un TSD**: el TSD/plan se
genera por feature con `/speckit-plan`.

Convención de estado por área del recorrido:

- ⏳ Pendiente · 🔍 En análisis · ✅ Analizada (huecos registrados)

## Síntesis del recorrido (2026-06-23) — completado

### Madurez por área

| Madurez | Áreas |
|---|---|
| **Madura** (CRUD + editar) | Recursos (6), Proveedores (8) |
| **Funcional básica** (crear+toggle, sin editar) | Reservas (2), Servicios (5), Ubicaciones (7), Clientes (9) |
| **Real solo-lectura** | Calendario (3, matriz), Operaciones (11) |
| **Placeholder, backend existe** | Eventos (4), Facturación (10), Auditoría (12) |
| **Placeholder / wizard** | Inicio (1), Configuración (13) |

### Decisiones transversales surgidas — RESUELTAS (2026-06-24, ADR-0021)

Las ocho quedaron resueltas con el dueño y registradas en
`docs/adr/0021-cross-cutting-product-decisions.md`. Resumen:

1. **Categoría como entidad** → **Sí**, entidad de primera clase (no texto libre).
   Toca Servicios/Reservas/widget. → feature `categorias-entidad`.
2. **Online/virtual** (servicio + ubicación) → **Diferido a post-MVP**.
3. **Group booking / partición de cantidad** → **Sigue diferido** (ADR-0016).
4. **Políticas (cancelación/reprogramación) + moneda** → **Global por tenant**
   (`tenant_settings`); override por sede como extensión futura. → `tenant-settings`.
5. **IA Facturación** → **Separar** Facturación (SaaS) de Finanzas (negocio) en el menú.
6. **IA sidebar** (Notifications/Customize/Custom Fields/Integrations) → **Plegadas en
   Configuración**; Customize ligado al widget público.
7. **Auth/plataforma** → **Superficie de plataforma separada con auth superadmin**
   (mueve Operaciones + provisión de tenants); proveedor separado de `staff_accounts`
   pero **vinculable** (`staff.providerId` opcional). → `plataforma-superadmin`.
8. **Ciclo de estados de reserva** → **6 estados**, default **Approved**, configurable
   por tenant. → `reservas-ciclo-estados-pagos`.

### Clúster crítico para el MVP (🔴)

- `tenant-settings` (políticas de tiempo, sender email por tenant, activar pasarela, perfil del tenant) — área 13.
- Ciclo de estados de reserva + pagos manuales — área 2.
- `plataforma-superadmin` (auth de plataforma; hoy `/operations` expone todos los tenants sin protección) — área 11.
- Worker de notificaciones email (pendiente pre-existente; ver TECH_DEBT/HANDOFF).

### Catálogo de candidatos a feature (Spec-Kit)

`dashboard-operacion` · `reservas-ciclo-estados-pagos` · `reservas-gestion-ux` ·
`calendario-vistas-interaccion` · `eventos-admin-ui` · `servicios-edicion-ux` ·
`categorias-entidad` · `paquetes` · `ubicaciones-edicion-detalle` · `proveedores-detalle-ux` ·
`proveedores-finanzas-comisiones` · `clientes-perfil-360` · `saas-billing-plan-ui` ·
`finanzas-pagos` · `cupones` · `plataforma-superadmin` ·
`tenant-settings` · `auditoria-busqueda-ui` · `recursos-cantidad-avanzada`.

> **Correcciones del deep-dive Amelia (2026-06-24, Catalog/Finance/Bookings):**
> - 🆕 **`paquetes`** añadido — el modal de Package en Amelia es grande (5 tabs + config por
>   servicio: nº de citas, min/max bookings, empleados, ubicaciones, "cliente elige empleado",
>   capacidad compartida). No estaba capturado. Tiene además su pestaña en Reservas (compra del
>   cliente con contador de uso). Áreas 5 (Catálogo) y 2 (Reservas).
> - ❌ **`gift-cards-store-credit` retirado** — el Finance real de Amelia es **Transactions /
>   Invoices / Coupons**; **no hay Gift Cards**. La candidata anterior se basaba en una suposición
>   errónea (ver área 10 corregida).

---

## Índice de áreas (sidebar)

| #  | Sección        | Área              | Ruta          | Estado recorrido |
|----|----------------|-------------------|---------------|------------------|
| 1  | General        | Inicio            | `/`           | ✅               |
| 2  | Agenda         | Reservas          | `/bookings`   | ✅               |
| 3  | Agenda         | Calendario        | `/calendar`   | ✅               |
| 4  | Agenda         | Eventos           | `/events`     | ✅               |
| 5  | Catálogo       | Servicios         | `/services`   | ✅               |
| 6  | Catálogo       | Recursos          | `/resources`  | ✅               |
| 7  | Catálogo       | Ubicaciones       | `/locations`  | ✅               |
| 8  | Catálogo       | Proveedores       | `/providers`  | ✅               |
| 9  | Catálogo       | Clientes          | `/customers`  | ✅               |
| 10 | Administración | Facturación       | `/billing`    | ✅               |
| 11 | Administración | Operaciones       | `/operations` | ✅               |
| 12 | Administración | Auditoría         | `/audit`      | ✅               |
| 13 | Administración | Configuración     | `/settings`   | ✅               |

---

## 1. Inicio (Dashboard) — `/`

**Estado actual** (`apps/admin/src/features/dashboard/index.tsx`)
Placeholder. Título + 5 tarjetas de accesos directos a otras áreas. Sin datos en vivo
("It does not fetch live data yet"). No hay KPIs, gráficos ni próximas reservas.

**Referencia Amelia** (`amelia-dashboard-fine-grained.md`)
Tabs Appointments | Events; filtro por rango de fechas; 3 KPI cards (Total reservas,
Clientes nuevos/recurrentes, **Occupancy rate**) con comparación vs período anterior;
Revenue (gráfico); Daily occupancy (heatmap); tabla de próximas reservas; **Top trends**
con "% de carga por proveedor".

**Huecos**
Todo el contenido + **capa de reporting/agregación inexistente** (no hay endpoints de
métricas; el resto de la app sí tiene datos en demo-store/API, pero nada los agrega).

**Candidato(s) a spec**
- `dashboard-operacion` — KPIs (reservas del rango · clientes nuevos/recurrentes ·
  ocupación) + próximas reservas + carga por proveedor. Requiere capa de reporting nueva.
- Prioridad: media (no bloquea MVP; alto valor percibido).

---

## 2. Reservas (Bookings) — `/bookings`

**Estado actual** (`apps/admin/src/features/bookings/index.tsx`)
La pantalla más funcional del catálogo. Crear reserva encadenando
Servicio → Proveedor (solo elegibles) → Cliente → Inicio (`datetime-local`), con rechazo
del store si el proveedor no es elegible para el recurso, no trabaja en la ubicación, no
hay capacidad o ya está ocupado. Tabla: Inicio · Servicio · Proveedor · Cliente · Importe ·
Estado. Cancelar reserva confirmada. Estado **binario** (confirmed/cancelled).

**Referencia Amelia** (`amelia-bookings-fine-grained.md`)
Tabs Appointments | Packages | Events. Toolbar: Search + Date Range + Filtros avanzados
(status/employee/service/location/customer/payment status) + Bulk actions + Add New.
Tabla con columnas Date · Time · Customer (avatar) · Service · Employee (avatar) ·
Duration · **Status** (badge de 6 estados, cambio inline) · Paid · Actions. Modal con tabs
**Details / Payment / Notes**: Payment (método, estado de pago, depósito, transacción,
cupón); Notes (staff notes / client notes / timeline). Acciones de fila: Edit, Delete,
Duplicate, Send SMS/Email, View Invoice, Reschedule, Change Status. Cliente nuevo inline.

**Huecos**
- **Dominio:** ciclo de estados real (Pending → Approved → Rejected/Cancelled/Completed/
  No-show) con transiciones que disparan notificaciones. Hoy es binario.
- **Pagos manuales:** tab Payment completa (método, estado, depósito, cupón, transacción).
- **Gestión/UX:** búsqueda, rango de fechas, panel de filtros, orden de columnas, bulk
  actions, acciones de fila (edit/delete/duplicate/reschedule/send/invoice), columna
  Duration, avatares.
- **Slot picker:** Time debe ofrecer solo slots libres según agenda del empleado (hoy es
  `datetime-local` libre que puede rechazarse al enviar).
- **Conceptos nuevos:** Packages y Events como tabs; reserva de grupo (varios clientes);
  Categoría como filtro previo; Ubicación explícita (incl. virtual/online).
- **Notas / notificaciones:** nota interna por reserva; toggle "Notify the customer(s)".

**Candidato(s) a spec**
- `reservas-ciclo-estados-pagos` — estados + transiciones + notificaciones + tab Payment
  (pagos manuales). Toca dominio. Prioridad: alta.
- `reservas-gestion-ux` — búsqueda/filtros/orden/bulk/acciones de fila/slot picker/modal
  con tabs. Prioridad: alta.
- `paquetes` (parte de Reservas) — pestaña **Packages** = compras de paquete del cliente con
  contador de uso (`0/12 Booked`) y estado Active/Expired/Cancelled. Ver área 5.
- (Group booking y Events se tratan en sus propias áreas/decisiones pendientes.)

**Detalle confirmado (deep-dive 2026-06-24, `amelia-bookings-fine-grained.md`)**
- **6 estados** corroborados (Pending/Approved/Rejected/Cancelled/Completed/No-show) — alinea con
  ADR-0021 #8 (nuestro default = Approved configurable; Amelia usa default Pending).
- **Tab Payment** al detalle: Payment Method (`Cash/Card/Check/Bank Transfer/Stripe/PayPal/Offline`),
  Payment Status (`Paid/Not Paid/Partial`), Deposit, Transaction ID, Coupon/Discount Code, Notes.
- **Filtros avanzados** por status/employee/service/location/customer/payment-status; búsqueda por
  cliente/servicio/empleado/referencia; rango de fechas; acciones de fila (Edit/Delete/Duplicate/
  Send SMS/Email/View Invoice/Reschedule/Change Status).
- **3 pestañas** distintas con modales propios (Appointments documentado; Packages y Events con
  modal de creación aún TBD en la referencia).

---

## 3. Calendario — `/calendar`

**Estado actual** (`apps/admin/src/features/calendar/index.tsx`)
Matriz semanal: una fila por proveedor, una columna por día; cada celda lista las reservas
**confirmadas** de ese proveedor ese día (hora + servicio + cliente). Navegación por semanas
(◀ Hoy ▶), día actual resaltado. **Solo lectura**: sin click-para-editar ni crear.

**Referencia Amelia** (`amelia-calendar-fine-grained.md`)
3 vistas (Month / Week / Day) con **eje de horas** y bloques proporcionales a la duración,
color por tipo, click para abrir/editar, **+ Add**, **drag & drop reschedule** (validando
disponibilidad), **filtros** (empleado/servicio/ubicación/estado/cliente). Muestra
appointments **y** events.

**Huecos**
- Nuestra vista **no es la de Amelia**: es una *matriz de ocupación proveedor×día* (panorama),
  no un *calendario temporal interactivo*. Falta el **eje de horas** y bloques por duración.
- Las **3 vistas** (Month/Week/Day).
- **Interacción**: abrir/editar reserva, +Add, **drag&drop reschedule**.
- **Filtros**.
- Mostrar **eventos** (hoy solo appointments confirmadas).

**Candidato(s) a spec**
- `calendario-vistas-interaccion` — Month/Week/Day con eje temporal, click/editar/crear,
  drag reschedule, filtros. **Depende** de Reservas (slot picker + reprogramar + estados).
- Prioridad: media-alta (muy visible, pero dependiente).

---

## 4. Eventos — `/events`

**Estado actual** (`apps/admin/app/events/page.tsx`)
Pantalla **placeholder** ("en construcción"). **Caso inverso al Dashboard**: el **backend está
completo y probado** (User Story 4, T051–T061): dominio de eventos
(`packages/domain/src/events`), precios + **lista de espera** + **recurrencia**
(`application/events`), **resolución de conflictos** (`application/scheduling`), rutas
(`services/api/src/api/event-routes.ts`). Hay motor, no hay pantalla.

**Referencia Amelia** (`amelia-events-fine-grained.md`)
Lista con búsqueda/filtros/estado (Upcoming/Open/Closed/Cancelled); tabla (Fecha · Nombre ·
Organizador · Ubicación · **Booked X/Y** · Status · Attendees). Modal con tabs **Details /
Description / Pricing / Attendees / Notes**: capacidad, recurrencia, color, precio/depósito,
gestión de asistentes (añadir, marcar pagado/no-show, **check-in**), **waitlist** con
"promote to attendee".

**Huecos**
- **Pantalla completa** (lista + tabla + modal con tabs) — es casi todo UI, no dominio.
- Verificar contra `event-routes.ts` qué falta de dominio: **check-in**, estados
  Open/Closed/Cancelled diferenciados, depósito, color, export de asistentes.

**Candidato(s) a spec**
- `eventos-admin-ui` — superficie admin sobre el motor existente. **Alto ROI** (backend hecho).
- Prioridad: alta dentro de su grupo (rentable).

---

## 5. Servicios — `/services`

**Estado actual** (`apps/admin/src/features/services/index.tsx`)
Lista + **crear** (Nombre · Categoría[texto libre] · Duración · Buffer-after · Precio) +
**activar/desactivar**. Tabla: Servicio · Categoría · Duración · Precio · Estado. Sin editar,
sin borrar, sin búsqueda/filtro/orden. Recursos se asocian desde la pantalla Recursos (hub).

**Referencia Amelia** (`amelia-catalog-fine-grained.md`)
Lista con búsqueda/filtro por categoría/orden + columnas Employees/Bookings/Status. Modal con
tabs **Details / Employees / Gallery / Settings**: descripción corta/larga, **depósito**,
color, icono; Settings con **min/max advance booking**, buffer antes/después, **min/max
capacity + group booking**, **online/virtual**, "require customer confirmation". **Categorías
como entidad** (nombre, color, icono, orden, conteo).

**Huecos (dominio + UI)**
- 🔴 **Categoría como entidad** (hoy texto libre) — Decisión pendiente #2; transversal
  (servicios, filtros, modal de reserva, widget).
- **Group booking** (min/max capacity) — Decisión pendiente #1/#4 (diferida ADR-0016).
- **Servicio online/virtual** — Decisión pendiente #5.
- Ventanas de reserva (min/max advance), **depósito**, **buffer-before**, require confirmation.
- UI: **editar** (modal con tabs), galería, descripción/color/icono, búsqueda/filtros/orden.

**Detalle confirmado (deep-dive 2026-06-24, `amelia-catalog-fine-grained.md`)**
- **Categoría como entidad** confirmada: nombre (unique), descripción, color, icono, **display
  order**, conteo de servicios. Modal y lista propios. Alinea con ADR-0021 #1.
- **Tab Settings del servicio** al detalle: Min/Max Duration, Min/Max Advance Booking (días),
  Buffer before/after, Min/Max Capacity, Allow Group Booking, **Online/Virtual** (toggle Zoom/Meet),
  Require Customer Confirmation. (Online/virtual y group booking siguen diferidos — ADR-0021 #2/#3.)
- **Tabs del modal**: Details / Employees / Gallery / Settings (en algún caso + Tips). Acciones de
  fila: Edit / Delete / Duplicate / View Analytics.

**Candidato(s) a spec**
- `servicios-edicion-ux` — editar + modal con tabs + settings de agenda + búsqueda/filtros.
- `categorias-entidad` — categoría como entidad de primera clase (transversal). Prioridad alta.
- `paquetes` — ver sub-sección siguiente. **Feature nueva** (no estaba capturada).

### Sub-sección Packages (Catálogo) — 🆕 candidata `paquetes`

**Referencia Amelia** (`amelia-catalog-fine-grained.md`, TAB 2)
Un paquete agrupa varios servicios (ej: "10 clases de yoga"). Lista propia (NAME · SERVICES ·
PRICE · DURATION) + modal con **5 tabs**:
- **Details**: imagen, nombre, color, **Duration** (unidad Months/Years + cantidad), "limit
  package purchases per customer", descripción rich-text.
- **Services**: multi-select de servicios + "shared capacity across services"; **por servicio**:
  precio, empleados, ubicaciones, **nº de citas incluidas**, **min/max bookings**, "cliente elige
  empleado".
- **Pricing**: price type (Custom), precio, descuento %, precio calculado, depósito.
- **Gallery** (hasta 4 imágenes) · **Settings** (TBD).

**Huecos / notas**
- Dominio nuevo: entidad Package + relación N:M con servicios con atributos por línea + reglas de
  consumo (citas usadas vs incluidas). Conecta con la pestaña **Packages de Reservas** (área 2:
  compra del cliente con contador `0/12 Booked`, estado Active/Expired/Cancelled).
- "shared capacity across services" y group booking enlazan con `recursos-cantidad-avanzada`
  (diferido).

**Candidato a spec**
- `paquetes` — catálogo de paquetes + compra/uso en reservas. Prioridad: media (post-MVP;
  feature amplia, dominio nuevo). Depende de `categorias-entidad`/`servicios-edicion-ux` flojamente.

---

## 6. Recursos — `/resources`  ⭐ pantalla más madura

**Estado actual** (`apps/admin/src/features/resources/index.tsx`)
Implementación de referencia del modelo **hub** (ADR-0016). **CRUD completo** (crear, **editar**,
activar/desactivar) + **cantidad** (unidades) + tres grupos de checkboxes: Ubicaciones (vacío =
todas), Servicios que consumen el recurso (vacío = ninguno), Proveedores elegibles (vacío =
cualquiera). Tabla con chips. **Backend completo y probado** (resources-model-review.md): motor
de disponibilidad + checkout + persistencia RLS; caso "4 terapeutas / 2 salas" funciona E2E.

**Referencia**
Amelia mete Resources en Catalog (no top-level); "New resource" añade image + color +
descripción. Decisiones pendientes (`amelia-ux-reference.md`): **#1 partición de cantidad**
(shared/per-service/per-location, diferida en ADR-0016) y **#4 group booking**.

**Huecos**
- Diferido (solo bajo demanda): **partición de cantidad** + **group booking**.
- Cosméticos: imagen/color/descripción del recurso, búsqueda, borrar.

**Candidato(s) a spec**
- `recursos-cantidad-avanzada` — partición de cantidad + group booking. Prioridad baja
  (condicionada a demanda). **Sin acción para MVP** — área madura.

---

## 7. Ubicaciones — `/locations`

**Estado actual** (`apps/admin/src/features/locations/index.tsx`)
Lista + **crear** (Nombre · Zona horaria · Dirección) + **activar/desactivar**. Multi-sede
(model C) soportado en backend. **Sin editar** (solo crear/toggle).

**Referencia Amelia** (`amelia-locations-fine-grained.md`)
Modal con tabs **Details / Hours / Employees / Services / Settings**: ciudad/provincia/CP/país/
teléfono/email/web/descripción/foto + **Type Physical/Virtual/Hybrid** (enlace Zoom); horario de
apertura por sede; empleados/servicios de la sede; **Settings**: zona horaria, **ventana de
cancelación/reprogramación**, **moneda**, separador decimal, máx. reservas concurrentes.

**Huecos**
- **Editar** ubicación + modal con tabs.
- **Ubicación virtual/híbrida** con enlace de reunión → Decisión pendiente #5 (conecta con
  servicios online + integración de meetings).
- **Horario de apertura por sede** (distinto del horario por proveedor, que ya existe).
- Tabs Employees/Services = vistas inversas del hub (atajo/solo lectura).

**Decisión transversal pendiente**
¿Dónde viven las **políticas de cancelación/reprogramación** y la **moneda**? (global / por
sede / por servicio). El motor de políticas ya existe (US3); falta decidir el punto de config.

**Candidato(s) a spec**
- `ubicaciones-edicion-detalle` — editar + Details ricos + tipo virtual. Prioridad media.

---

## 8. Proveedores — `/providers`  (madura)

**Estado actual** (`apps/admin/src/features/providers/index.tsx`)
**CRUD completo** (crear, **editar**, activar/desactivar). Datos: Nombre · Email · Zona horaria.
Asignación de Ubicaciones + Servicios (checkboxes). **Enlace "Agenda"** por fila → editor de
**Work hours / Days off / Special days** (objetivo 3, implementado E2E).

**Referencia Amelia** (`amelia-employees-fine-grained.md`)
Modal con tabs **Details / Work Hours / Days Off / Special Days / Services / Assigned Locations
/ Finance**: foto, teléfono, rol/título, bio, welcome email; override de precio + buffer por
empleado-servicio; **Finance** (comisión %/fija, método de pago, IBAN, salario, contrato).

**Huecos**
- ✅ Agenda (work hours/days off/special days) ya existe.
- **Finance / comisiones**: ausente — área de dominio nueva y grande (nómina del profesional).
- Details ricos (foto, teléfono, rol, bio), búsqueda/filtro, avatares.
- Override de precio/buffer por proveedor-servicio.

**Decisión transversal (relevante para Auth)**
"Proveedor" es entidad de catálogo, separada de `staff_accounts` (login, ADR-0017). Decidir
**si un proveedor es además usuario con login** (portal staff) y cómo se vinculan. Directamente
relacionado con el objetivo de cuentas tenant/superadmin.

**Candidato(s) a spec**
- `proveedores-detalle-ux` — foto/teléfono/rol/bio + búsqueda. Prioridad media.
- `proveedores-finanzas-comisiones` — dominio nuevo. Prioridad media/baja.

---

## 9. Clientes — `/customers`

**Estado actual** (`apps/admin/src/features/customers/index.tsx`)
Lista + **crear** (Nombre · Email · Teléfono) + **activar/desactivar**. Cliente es entidad de
primera clase. **Sin editar**, sin búsqueda, sin perfil.

**Referencia Amelia** (`amelia-customers-fine-grained.md`)
Lista con búsqueda/filtros + columnas Bookings · Total Spent · Last Booking · Status. Modal con
tabs **Details / Address / Bookings / Invoices / Notes**: fecha nac., género, foto, **password**
(cuenta cliente), newsletter, **status incl. Blacklisted**; dirección + facturación; historial
de reservas; **facturas + store credit**; notas + timeline.

**Huecos**
- **Editar** + perfil con tabs.
- **Búsqueda/filtros** (doc marca ✅ pero la pantalla no tiene búsqueda → discrepancia).
- **Métricas** (nº reservas, total gastado, última) → depende de la **capa de reporting** del
  Dashboard; **historial de reservas** (join ya disponible en datos).
- **Blacklist** (bloquea nuevas reservas), **store credit** (ligado a Finance/reembolsos).
- **GDPR**: anonimización existe en backend (US3) pero no expuesta aquí.
- Bulk/export, avatares, newsletter.

**Nota de Auth**
"Cuenta de cliente / password" conecta con el **portal passwordless de cliente** (US3, backend).

**Candidato(s) a spec**
- `clientes-perfil-360` — editar + tabs + historial/métricas + blacklist. Depende de reporting
  (Dashboard) y Finance (store credit/facturas). Prioridad media.

---

## 10. Facturación — `/billing`  ⚠️ cruce conceptual (IA)

**Estado actual** (`apps/admin/app/billing/page.tsx`) — **placeholder**
Apunta a la **facturación del SaaS**: planes (Starter/Professional/Enterprise), feature flags,
**cuotas de uso del tenant**. Backend hecho: dominio billing (`packages/domain/src/billing`:
hasFeature/isWithinQuota/bookingQuotaRemaining), conciliación Stripe (worker), gating premium.

**Referencia Amelia** (`amelia-finance-fine-grained.md`) — **otro concepto** · ⚠️ **corregido 2026-06-24**
"Finance" de Amelia = dinero del negocio frente a SUS clientes, con **3 tabs reales**:
- **Transactions** (solo lectura): historial de pagos (ID · payment date · customer · employees ·
  booking · **status** Pending/Paid · amount); date-range + filtros.
- **Invoices** (solo lectura): facturas (invoice # · customer · date · booking · status
  Pending/Sent/Paid).
- **Coupons** (editable): lista (code · discount · type · usage · valid until · status) + modal
  (code, descripción, **Percentage/Fixed**, value, max usage, valid from/until, applicable to
  All/Specific services, status).
- Global: KPIs (Total Revenue / Outstanding / Refunds / Discounts) + **export** (CSV/PDF/Excel).
- ❌ **NO hay "Gift Cards"** en el Finance de Amelia (la versión anterior de este doc lo asumía por
  error). Tampoco "Payments" como tab — es **Transactions**.

**Hallazgo de IA (arquitectura de información)**
Nuestro menú mezcla dos conceptos bajo "Facturación":
1. **Facturación SaaS** (plan/cuota del tenant) — tu negocio cobra al tenant. Backend hecho,
   falta UI.
2. **Finanzas del negocio** (transacciones, facturas y cupones de SUS clientes) — sin sitio en el
   sidebar hoy.

**Huecos**
- (1) `saas-billing-plan-ui` — UI sobre backend existente.
- (2) **Transactions**: dominio existe (checkout/Stripe/conciliación); falta pantalla + reporting
  (KPIs) + refund/recibo desde admin + export.
- 🆕 **Invoices**: superficie nueva (lista readonly + estado Pending/Sent/Paid; ¿generación auto
  por reserva?). Dominio de facturación del negocio aún no modelado.
- 🆕 **Cupones** — no modelados (dominio nuevo), aplican en checkout. Modal ya 100% especificado.

**Decisión transversal pendiente**
Separar en el menú **"Facturación (SaaS)"** de **"Finanzas (negocio)"** antes de hacer specs
(ADR-0021 #5).

**Candidato(s) a spec**
- `saas-billing-plan-ui` (UI; backend hecho) · `finanzas-pagos` (pantalla Transactions + Invoices +
  refund/recibo + KPIs + export; depende de reporting) · `cupones` (dominio nuevo; modal
  especificado). _(`gift-cards-store-credit` retirado: no existe en Amelia.)_

---

## 11. Operaciones — `/operations`  🔐 embrión de superadmin

**Estado actual** (`apps/admin/src/features/operations/index.tsx`) — **pantalla real** (T077)
Dashboard **de plataforma** (cross-tenant): lista **todos los tenants** con estado de facturación,
barras de cuota (bookings/storage/notifications) y **log de auditoría** por tenant (API de
auditoría T078). Solo lectura. Datos reales (billing + audit). **Sin referencia Amelia** — es
concepto propio del SaaS.

**Hallazgos**
1. 🔐 Es el **embrión de la consola superadmin/plataforma** (objetivo Auth (b)). Pero vive
   **dentro de `apps/admin`** y **sin protección** → cualquiera en `/operations` ve **todos los
   tenants**. Mayor agujero de seguridad del recorrido.
2. 🎨 **Rompe el design system (ADR-0008)**: clases **Tailwind** + inglés, frente a tokens
   `var(--ui-*)` inline + español del resto.

**Huecos**
- Separar a una **superficie de plataforma** con **auth de superadmin**; mover aquí la provisión
  de tenants (`POST /v1/platform/tenants`, hoy abierta).
- Alinear al design system (tokens + español).

**Candidato(s) a spec**
- `plataforma-superadmin` — auth de plataforma + mover Operaciones + provisión de tenants +
  alinear DS. **Prioridad alta** (ligado al objetivo de Auth y a seguridad).

---

## 12. Auditoría — `/audit`

**Estado actual** (`apps/admin/app/audit/page.tsx`) — **placeholder**
Backend completo: `audit-routes.ts` (búsqueda paginada + filtros), `GET /audit/events` aislado
por `x-tenant-id`, eventos de auditoría en dominio. Operaciones ya muestra eventos recientes.

**Referencia**: **sin doc Amelia** — concepto propio del SaaS (Constitución, Principio V:
toda transición relevante emite evento + registro auditable).

**Huecos**
- Solo **UI**: pantalla con filtros (tipo/actor/rango fechas), paginación, export. Backend hecho.

**Candidato(s) a spec**
- `auditoria-busqueda-ui` — superficie sobre backend existente. Prioridad media-baja
  (parcialmente cubierto por Operaciones).

---

## 13. Configuración — `/settings`  ⭐ fundacional para MVP

**Estado actual** (`apps/admin/app/settings/page.tsx` → `features/tenant-setup`)
**No es un área de ajustes**: renderiza el **asistente de alta US1** (`TenantSetup`: crea
servicio→proveedor→asigna→horario + preview de disponibilidad). El código se declara "minimal".

**Referencia Amelia** (`amelia-settings-fine-grained.md`)
General · Activation · **Company** (perfil + horario global + días libres) · **Payments** ·
**Bookings** · **Notifications** (General/Email/SMS) · **Roles & permissions**.

**Huecos (varios 🔴 que bloquean el MVP)**
- 🔴 **Políticas de tiempo** (lead time reserva/cancelación/reprogramación): backend US3 listo,
  falta UI + persistencia en `tenant_settings`.
- 🔴 **Sender name/email por tenant** (Notifications > Email): hoy dispatcher usa global `.env`.
- 🔴 **Activar pasarela de pago** desde admin (Payments): Stripe wired, sin UI de activación.
- 🟡 **Default appointment status (Pending vs Approved)** → conecta con ciclo de estados (área 2).
- 🟡 **Autoasignación de proveedor** (Random/Round-robin…) → desbloquea widget sin elegir.
- 🟡 **Perfil del tenant** (logo/nombre/dirección/VAT) → facturas + branding del widget.
- 🟡 **Horario global de empresa**, **Roles & permissions** (UI).

**Candidato(s) a spec**
- `tenant-settings` — tabla `tenant_settings` + UI de políticas/sender/activación pagos/perfil.
  **Prioridad alta** (fundacional MVP).

---

## Áreas de Amelia SIN entrada en nuestro sidebar (decisión de IA)

Cuatro docs fine-grained no mapean a ninguna pantalla actual:
- **Notifications** (`amelia-notifications-fine-grained.md`) — plantillas email/SMS + triggers.
  Backend de mensajería existe (Brevo, ADR-0020). En Amelia parte vive en Settings.
- **Customize** (`amelia-customize-fine-grained.md`) — branding/apariencia del **widget público**.
- **Custom Fields** (`amelia-custom-fields-fine-grained.md`) — campos personalizados.
- **Features & Integrations** (`amelia-integrations-fine-grained.md`) — Zoom/Meet, Google/Outlook
  Calendar, WhatsApp, etc.

**Decisión de IA pendiente**: ¿áreas de primer nivel o plegadas (Notifications→Settings,
Customize→widget)? Resolver antes de planificar sus specs.

---

## Notas transversales (se irán acumulando)

- Las marcas **Estado SaaS ✅/🔶** de los `amelia-*-fine-grained.md` son una autoevaluación
  útil pero **aproximada**: deben validarse contra el código real (p. ej. "Search Box ✅"
  pero la pantalla Reservas no tiene búsqueda). El recorrido confirma el estado real.
- Patrón Amelia "el hub declara sus relaciones" (ADR-0016) ya adoptado en Recursos.
- Ubicación **virtual/online** confirmada por capturas (Bookings: "Zoom Meeting") — es la
  Decisión pendiente #5 de `amelia-ux-reference.md`.
