# Recorrido del menú admin — Análisis de huecos (puente a Spec-Kit)

Última actualización: 2026-06-23

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
| 8  | Catálogo       | Proveedores       | `/providers`  | ⏳               |
| 9  | Catálogo       | Clientes          | `/customers`  | ⏳               |
| 10 | Administración | Facturación       | `/billing`    | ⏳               |
| 11 | Administración | Operaciones       | `/operations` | ⏳               |
| 12 | Administración | Auditoría         | `/audit`      | ⏳               |
| 13 | Administración | Configuración     | `/settings`   | ⏳               |

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
- (Group booking, Packages y Events se tratan en sus propias áreas/decisiones pendientes.)

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

**Candidato(s) a spec**
- `servicios-edicion-ux` — editar + modal con tabs + settings de agenda + búsqueda/filtros.
- `categorias-entidad` — categoría como entidad de primera clase (transversal). Prioridad alta.

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

## Notas transversales (se irán acumulando)

- Las marcas **Estado SaaS ✅/🔶** de los `amelia-*-fine-grained.md` son una autoevaluación
  útil pero **aproximada**: deben validarse contra el código real (p. ej. "Search Box ✅"
  pero la pantalla Reservas no tiene búsqueda). El recorrido confirma el estado real.
- Patrón Amelia "el hub declara sus relaciones" (ADR-0016) ya adoptado en Recursos.
- Ubicación **virtual/online** confirmada por capturas (Bookings: "Zoom Meeting") — es la
  Decisión pendiente #5 de `amelia-ux-reference.md`.
