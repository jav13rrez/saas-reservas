# Referencia UX: Amelia Admin Console

**Propósito:** Notas propias (no código) sobre la UX de la consola de administración de Amelia Premium.
Estas observaciones guían el diseño de nuestras pantallas de admin, no son código fuente.

**Método:** capturas compartidas por el propietario del proyecto, anotadas aquí en forma de árbol y
notas de campo. Se actualiza en sesiones sucesivas.

**Estado:** en progreso — secciones marcadas con `[pendiente]` aún no revisadas.

---

## Estructura del menú principal

```
Amelia (sidebar)
├── Dashboard
├── Calendar
├── Bookings
├── Events
├── Employees
├── Catalog
│   ├── Services
│   ├── Packages
│   └── Resources          ← vive aquí, no como área top-level
├── Locations
├── Customers
├── Finance
├── Notifications
├── Customize
├── Custom Fields
├── Features & Integrations
└── Settings
```

**Decisión nuestra:** mantenemos Recursos como área top-level (junto a Catálogo/Servicios) porque
el caso "4 terapeutas / 2 salas" requiere que el operador configure recursos antes de crear
servicios y proveedores. En Amelia están bajo Catalog porque su uso de recursos es más secundario.

---

## Dashboard

**Revisado: 2026-06-16** (ejemplo "Sports and Gym").

Estructura general, de arriba a abajo:

```
Dashboard
├── Tabs: [ Appointments | Events ]        ← dos modos del dashboard
├── Barra de filtro: rango de fechas (Jun 16 – Jul 16, 2026) + icono de filtro avanzado
├── Fila de 3 KPI cards
│   ├── (Appointments) Total appointments  → nº + % vs período anterior + sparkline
│   │   (Events)       Total events
│   ├── (Appointments) Customers           → nº + desglose New / Returning con barra
│   │   (Events)       Attendees
│   └── Occupancy rate                     → % + Occupied vs Available
│       · Appointments: en horas (8h 30min ocupadas / 2795h disponibles)
│       · Events:       en plazas/asientos (101 occupied / 503 available)
├── Revenue (gráfico de líneas)
│   ├── importe grande + % vs anterior
│   └── comparación "This range" vs "Previous range" (dos series)
├── Daily occupancy (heatmap tipo calendario mensual)
│   ├── grid M T W T F S S, celdas coloreadas por carga del día
│   └── nota: usa datos mensuales, no el rango global
├── Upcoming appointments / Upcoming events (tabla)
│   ├── Appointments: Date | Time | Customer | Employee (avatar) | Service | Duration
│   └── Events:       Date & time | Name (avatar) | Status (dropdown Open/Closed) | Booked (0/15) | Organizer
│   └── paginación (5/page, "Total 23", ir a página)
└── Top trends (tabla con sub-tabs)
    ├── sub-tabs: [ Employees | Services | Packages ]
    └── Employees: Employee (avatar) | # of appointments | Sum of payments | # of hours in appointment | Percentage of load (barra)
```

Observaciones / ideas a robar:
- **Dos dashboards en uno** (Appointments vs Events) con tabs. Citas y eventos son modelos
  distintos y los KPIs cambian (horas vs asientos). Nuestro split Reservas/Eventos encaja.
- **Occupancy rate** es un KPI central y se mide en la unidad del recurso limitante: horas de
  agenda para citas, asientos para eventos. Encaja perfecto con nuestro modelo de capacidad.
- **Top trends por Employee** incluye "Percentage of load" (carga) — exactamente la métrica que
  da sentido al constraint "4 terapeutas / 2 salas": ver quién está saturado.
- **Comparación vs período anterior** en casi todo (los % y la segunda serie del revenue).
- Status de evento editable inline desde la tabla (dropdown Open/Closed).

Implicación para nuestro `Inicio`: hoy es un placeholder. Un primer dashboard útil = 3 KPI
(reservas del rango, clientes nuevos/recurrentes, ocupación) + próximas reservas + carga por
proveedor. Lo dejamos anotado para una iteración posterior.

Preguntas pendientes:
- ¿El filtro avanzado (icono) permite filtrar por Employee/Service/Location?
- ¿El heatmap de Daily occupancy es clicable hacia el día en Calendar?

---

## Calendar

**Revisado: 2026-06-16** (vista Month).

```
Calendar
├── Toolbar
│   ├── [icono filtro] · [Today] · [<] [>] · "June 2026" · [Month ▾] · [+ Add]
│   └── Month ▾ = selector de vista (Month / Week / Day / List, típico de Amelia)
├── Grid mensual MON–SUN (semana empieza en lunes en este ejemplo)
│   ├── cada día: número arriba; día actual (16) con badge morado
│   ├── citas/eventos como chips de color: "10:30 am Body Attack"
│   ├── color por tipo/servicio (cada servicio su color)
│   └── overflow → enlace "+N more" (p.ej. "+7 more")
```

Observaciones / ideas a robar:
- **Selector de vista** Month/Week/Day/List en un dropdown único, no tabs. Nuestra pantalla
  Calendario hoy es solo semanal por proveedor; Amelia usa vista temporal (mes/semana/día) y deja
  el filtrado por empleado al panel de filtros, no como eje de la rejilla.
- **Color por servicio** es clave para legibilidad cuando hay muchísimas citas. Deberíamos asignar
  un color estable por servicio (o por proveedor) en nuestra rejilla.
- **`+N more`** para no romper la celda cuando hay solapes — patrón estándar de calendario mensual.
- **`+ Add`** crea cita/evento directamente desde el calendario (mismo modal que Bookings → New).
- **`Today`** y flechas `< >` para navegación — ya lo tenemos en nuestra vista semanal.

Diferencia de enfoque importante:
- Amelia: eje = **tiempo** (mes/semana/día), el empleado es un **filtro**.
- Nosotros (ahora): eje = **proveedor** (filas) × días (columnas), una sola semana.
- Ambos son válidos. La vista "por proveedor" nuestra es buena para ver carga/solapes de cada
  profesional (alineado con el constraint de recursos); la de Amelia es mejor para ver la agenda
  global. **Posible objetivo:** ofrecer ambas (toggle "Por tiempo" / "Por proveedor").

Preguntas pendientes:
- ¿El panel de filtro (icono) permite filtrar por Employee / Service / Location a la vez?
- En vista Week/Day, ¿hay columnas por empleado o una sola línea temporal?
- ¿Click en una cita abre detalle o el modal de edición?

---

## Bookings

**Revisado: 2026-06-16** (listados; falta el modal "New Appointment").

Tres tabs, igual que el Dashboard pero añadiendo Packages:

```
Bookings
├── Tabs: [ Appointments | Packages | Events ]
├── Toolbar (común a las 3 tabs)
│   ├── [Search bookings] · [rango de fechas Jun 16 2026 – Jun 16 2027] · [icono filtro]
│   └── derecha: [ ··· acciones masivas ] · [ + ]
│   └── nota: rango por defecto = 1 año completo (no 1 mes como el Dashboard)
├── Appointments (tabla)
│   ├── cols: [✓] | ID | DATE | TIME | CUSTOMER | SERVICE | TYPE (icono) | ··· (acciones fila)
│   ├── ID numérico corto (99, 55, 95…)
│   ├── CUSTOMER puede ser múltiple ("BAW Media, John Doe") → reserva de grupo
│   ├── columnas ordenables (flechas ↕ en ID, CUSTOMER, SERVICE)
│   ├── flechas ◀ ▶ para hacer scroll horizontal de columnas (hay más de las visibles)
│   └── paginación: "Total 23", selector 10/page, páginas + "Go to"
├── Packages (tabla)
│   └── mismo layout; aquí vacío → empty state "No results found / Try adjusting your search or filters"
└── Events (tabla)
    ├── cols: [✓] | CODE | DATE | TIME | ATTENDEE | EVENT | ··· (acciones)
    ├── CODE = hash corto (38dec, 9364f…) en vez de ID numérico
    └── ATTENDEE en vez de CUSTOMER, EVENT en vez de SERVICE
```

Observaciones / ideas a robar:
- **Selección masiva** (checkbox por fila + acciones "···" arriba) — útil para cancelar/exportar
  en lote. Hoy no lo tenemos.
- **Búsqueda + rango de fechas + filtro avanzado** siempre presentes. Nuestra tabla de Reservas no
  tiene búsqueda ni filtros aún → mejora clara.
- **Columnas ordenables** (sort por cliente/servicio/ID).
- **Reservas de grupo**: un appointment puede tener varios clientes. Nuestro modelo actual es
  1 reserva = 1 cliente; anotar como diferencia (capacidad de servicio min/max → group booking).
- **Appointments vs Events son tablas distintas** con columnas distintas (ID vs CODE, Customer vs
  Attendee). Coherente con tenerlos como áreas separadas.
- **TYPE** como columna (icono): probablemente online/in-person, o individual/grupo. Pendiente
  confirmar al ver el detalle.
- Rango por defecto **amplio (1 año)** en listados, frente al mensual del dashboard.

### Modales "+ New booking" (revisado 2026-06-16)

El botón `+` abre un modal distinto según el tipo. Layout común: breadcrumb arriba
(`Bookings > New …`), panel izquierdo con tabs + "Tips & suggestions", formulario a la derecha,
botones `Close` / `Book` abajo a la derecha. Los campos con `*` rojo son obligatorios.

**New appointment** (el importante para nuestra pantalla Reservas):

```
Tabs izquierda: [ Details | Customers ]      ← cliente va en su PROPIA tab
Details (formulario, en este orden):
  1. Category            (dropdown, OPCIONAL — filtra los servicios)
  2. Service *           (dropdown)
  3. Employee *          (dropdown)
  4. Date *  |  Time *   (en la misma fila)
  5. Location *          (dropdown)
  6. [✓] Notify the customer(s)     ← decide si se envían notificaciones
  7. Note (internal)     (textarea — nota interna, no visible al cliente)
Customers (tab aparte): selección de cliente(s) → admite varios (group booking)
```

Orden Amelia: **Category → Service → Employee → Date → Time → Location → (Customers en tab) → Note**.
Nuestro orden actual: Service → Provider → Customer → Start.

Diferencias a considerar:
- **Category como primer filtro** (opcional) para acotar la lista de servicios. No lo tenemos;
  encaja con agrupar el catálogo por categorías.
- **Location es un campo explícito** del appointment. Nosotros la derivamos del recurso; Amelia
  deja elegirla (un servicio/empleado puede estar en varias sedes).
- **Cliente en una tab aparte** y admite **varios** (reserva de grupo) + botón inline para crear
  cliente nuevo (ver package/event abajo). Nosotros: un solo cliente en un `select` en la misma fila.
- **`Notify the customer(s)`**: toggle para enviar o no las notificaciones de esa reserva. Útil
  para altas manuales sin spamear. Anotar para cuando tengamos notificaciones.
- **`Note (internal)`**: nota interna por reserva. No la tenemos.
- **Date y Time separados**, no un `datetime-local` único como el nuestro. Time es un dropdown
  (probablemente con los slots disponibles ya calculados por el motor, no texto libre).

**New package booking** (más simple):

```
1. Package *
2. Customer *            (+ botón "Customer" para crear cliente nuevo inline)
3. [✓] Notify the customer(s)
```

**New event booking**:

```
1. Event *
2. Attendee *           (+ botón "Attendee" para crear asistente nuevo inline)
```

Patrón a robar: **botón "+ Customer/Attendee" pegado al dropdown** para crear la entidad sin salir
del modal. Y **cada tipo de booking tiene su propio modal** con sus campos (coherente con tablas y
tabs separadas).

Pendiente:
- Acciones del menú "···" por fila (editar, cancelar, status, eliminar).
- Los **status** de una cita (no como columna; ¿en el detalle o como filtro?).
- Cómo es el `Time` dropdown: ¿muestra solo slots libres según disponibilidad del empleado?

---

## Events

**Revisado: 2026-06-16** (lista + ficha "New Event").

### Lista

```
Events
├── Toolbar: [Search events] · [rango fechas] · [icono filtro] · [···] · [ + ]
├── Tabla
│   ├── cols: [✓] | ID | DATE & TIME | NAME (avatar) | STATUS (dropdown) | BOOKED | ORGANIZER | ···
│   ├── STATUS editable inline con color: Open (verde) / Closed (gris) / Full (morado) / Canceled (rojo)
│   ├── BOOKED = aforo "0 / 15", "100 / 100" (reservados / capacidad)
│   └── ORGANIZER (persona responsable)
└── paginación: Total 379, 10/page
```

### Ficha (New Event) — modal con tabs

```
Tabs izquierda: [ Details | Pricing | Recurring | Gallery | Settings ]

Details:
  · Upload image
  · Name *            (Translate)
  · Color *           (#1a84ee)  ← color del evento en el calendario
  · [toggle] Show on website
  · Start date – End date | Start time | End time
  · [+ Add Date]      ← un evento puede tener varias fechas/sesiones
  · [✓] Booking opens immediately      (si no, se define cuándo abre)
  · [✓] Booking closes when event starts
  · Location (dropdown)
  · Custom address
  · Organizer (dropdown)
  · Staff (dropdown)   ← empleados que atienden el evento (varios)
  · Tags (dropdown)
  · Description (Text/HTML)
  · botones: Close | Save

Pricing:   tipos de entrada / precios (TicketType, dynamic pricing)
Recurring: recurrencia (cada instancia es un registro independiente)
Gallery:   imágenes
Settings:  ajustes adicionales del evento
```

Observaciones / ideas a robar:
- **STATUS de evento como dropdown coloreado e inline** (Open/Closed/Full/Canceled). El nuestro de
  reservas es solo confirmed/cancelled; los eventos necesitan más estados (aforo lleno, cerrado).
- **BOOKED = reservados / capacidad** visible en la tabla — el aforo es protagonista, coherente con
  el KPI "occupancy en asientos" del dashboard.
- **Color por evento** (campo explícito) → alimenta el color del calendario. Refuerza la nota de
  Calendar de asignar color estable.
- **`+ Add Date`**: un evento con múltiples sesiones/fechas. Más rico que un único start/end.
- **Booking window**: "opens immediately" + "closes when event starts" — ventana de reserva
  configurable. Útil para nuestro modelo de eventos (US4, ya implementado en backend).
- **Staff (varios)** y **Organizer (uno)** son roles distintos en el evento.
- Coincide con nuestro dominio de eventos (US4: TicketType, waitlist, recurrencia). La UI de Eventos
  nuestra es placeholder; esto da el mapa para construirla.

Diferencia con Appointments: el evento es **uno-a-muchos** (capacidad/aforo, varios asistentes,
ticket types), mientras la cita es 1:1 (cliente↔slot de empleado). Por eso tablas, modales y
estados distintos — justifica mantener Reservas y Eventos como áreas separadas.

---

## Employees

**Revisado: 2026-06-16** (lista + ficha "New employee").

### Lista

```
Employees
├── Toolbar: [Search employees] · [icono filtro] · derecha [··· acciones masivas] · [ + ]
├── Tabla
│   ├── cols: [✓] | ID | NAME (avatar, sortable) | VISIBILITY | AVAILABILITY | PHONE | EMAIL | ···
│   ├── VISIBILITY  = badge "Visible" (verde)         → del toggle "Show on website"
│   ├── AVAILABILITY = badge "Available" (verde)      → estado derivado de work hours/days off
│   └── flechas ◀ ▶ scroll horizontal de columnas
└── paginación: Total 14, 10/page
```

### Ficha (New / Edit employee) — modal con tabs

```
Tabs izquierda: [ Details | Services | Work hours | Days off | Special days ]

Details:
  · Upload image (avatar)
  · First name *      (con opción Translate i18n)
  · Last name *       (Translate)
  · Email *
  · [toggle] Show on website            ← controla VISIBILITY de la lista
  · Phone number (con selector de país/bandera)
  · Badge (dropdown)                    ← etiqueta/insignia del empleado
  · Location (dropdown)                 ← UNA ubicación en este ejemplo
  · Time zone (dropdown, default UTC)
  · Employee panel password (campo con ojo)   ← acceso al portal de empleado
  · WordPress user (dropdown)           ← vincula a un usuario WP existente
  · Description (editor Text/HTML, toolbar rich, Translate)
  · Note (internal)
  · botones: Close | Save

Services:     (tab aparte) asignación de servicios que presta + override de precio/duración por empleado
Work hours:   horario semanal del empleado
Days off:     días libres / vacaciones
Special days: jornadas con horario especial
```

Observaciones / ideas a robar:
- **MUY IMPORTANTE — no hay tab "Resources" en el empleado.** En Amelia los recursos NO se asignan
  al empleado; la elegibilidad proveedor↔recurso es una **extensión nuestra (modelo B, ADR-0015)**
  que va más allá de Amelia. Confirma que nuestra decisión es un añadido consciente, no una copia.
- **Scheduling propio del empleado** (Work hours / Days off / Special days) que **nosotros aún no
  tenemos**. Hoy nuestra disponibilidad se calcula en el motor (backend) pero el admin no expone la
  edición del horario por proveedor. Brecha clara para una iteración.
- **Services en tab aparte**, no checkboxes inline como hicimos. Y probablemente permite **override
  de precio/duración por empleado** (Amelia lo hace). Nosotros: serviceIds como checkboxes simples.
- **Una Location (singular)** en la ficha de este ejemplo (gym de una sede). Confirmar si admite
  varias — el spec sí ("providers may work at one or more locations").
- **Portal de empleado** integrado: `Employee panel password` + `WordPress user`. Nuestro
  equivalente: portal de proveedor con permisos (ya existe en backend).
- **Show on website** (visibilidad pública) separado de activo/inactivo. Distinción útil: un
  empleado puede estar activo internamente pero oculto del widget.
- **i18n por campo** ("Translate") y **Note interna** y **avatar** — detalles de madurez del producto.

Comparativa rápida con nuestra ficha de Proveedor:
| Campo Amelia | ¿Lo tenemos? |
| --- | --- |
| Nombre/email/timezone | Sí |
| Avatar | No |
| Show on website (visibilidad) | No (solo active) |
| Badge | No |
| Location(s) | Sí (multi, checkboxes) |
| Services (con override precio/duración) | Parcial (solo asignación, sin override) |
| Work hours / Days off / Special days | **No** |
| Resources elegibles | **Sí (extensión nuestra; Amelia no lo tiene)** |
| Panel password / WP user | Backend sí, UI no |
| Description / Note interna | No |

---

## Catalog

[pendiente — compartir capturas: Services y Resources]

### Services

Preguntas clave:
- ¿Ficha de un Service: qué tabs tiene?
- ¿Cómo se asignan Employees al servicio?
- ¿Dónde se configura la duración, buffer before/after, precio?
- ¿Hay campo de capacidad (min/max attendees)?
- ¿Extras vinculados al servicio?
- ¿Hay campo de Category?

### Resources (dentro de Catalog)

Preguntas clave:
- ¿Cómo se crea un Resource? (nombre, cantidad/quantity)
- ¿Se vincula el Resource al Service aquí o en la ficha del Service?
- ¿Hay campo de Location en el Resource?
- ¿Aparece alguna vista de ocupación del recurso?

### Packages

[pendiente]

---

## Locations

[pendiente — compartir captura]

Preguntas clave:
- ¿Qué campos tiene una Location? (nombre, dirección, timezone, teléfono, foto…)
- ¿Se asignan Employees a la Location desde aquí o desde la ficha del Employee?
- ¿Hay mapa embebido?

---

## Customers

[pendiente — compartir captura]

Preguntas clave:
- ¿Qué campos tiene la ficha de un Customer?
- ¿Historial de reservas dentro de la ficha?
- ¿Hay notas internas o tags?
- ¿Cómo se busca/filtra?

---

## Finance

[pendiente — compartir captura]

Preguntas clave:
- ¿Listado de transacciones o resumen por período?
- ¿Hay exportación?
- ¿Gestión de reembolsos?

---

## Notifications

[pendiente]

Preguntas clave:
- ¿Por trigger (booking created, reminder, cancellation…)?
- ¿Email / SMS / WhatsApp?
- ¿Editor de plantillas o integración con servicio externo?

---

## Customize

[pendiente]

---

## Custom Fields

[pendiente]

---

## Features & Integrations

[pendiente]

---

## Settings

[pendiente — compartir captura]

Preguntas clave:
- ¿Datos generales del tenant (nombre, logo, timezone, moneda)?
- ¿Configuración de pagos (gateway)?
- ¿Política de cancelación?

---

## Observaciones transversales

*(Se irán añadiendo a medida que veamos más pantallas)*

- Los **Resources están dentro de Catalog**, no son top-level. Decisión consciente nuestra de
  separarlos por la importancia del constraint de capacidad física.
- El menú de Amelia no tiene área separada de **"Recursos"** ni **"Ubicaciones"** en primer nivel
  para versiones sin multi-sede — Locations aparece porque es una feature premium.
- La navegación es **plana** (sin sub-menús colapsables en sidebar), igual que la nuestra.

---

*Última actualización: 2026-06-16*
