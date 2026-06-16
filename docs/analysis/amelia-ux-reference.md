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

[pendiente — compartir captura]

Preguntas clave:
- ¿Vista de lista o de tabla? ¿Qué columnas?
- Modal "New Appointment": orden de los selectores (service → employee → customer → fecha/hora, u otro orden)
- ¿Hay búsqueda/filtros en la tabla? (por status, por employee, por fechas)
- ¿Acciones por fila? (ver detalle, cancelar, reagendar)
- ¿Status badges? (Pending / Approved / Canceled / No-show…)

---

## Events

[pendiente — compartir captura]

Preguntas clave:
- ¿Diferencia visual con Bookings?
- ¿Capacidad/aforo visible en tabla?
- ¿Hay lista de asistentes por evento?

---

## Employees

[pendiente — compartir captura]

Preguntas clave:
- ¿Ficha del employee: qué tabs o secciones tiene?
- ¿Cómo se asignan Services? (checkboxes, multi-select, drag…)
- ¿Cómo se asignan Locations?
- ¿Horario semanal: days off, working hours, breaks?
- ¿Hay campo de zona horaria por employee?
- ¿Aparece alguna referencia a Resources aquí o solo en Catalog?
- ¿Photo/avatar?

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
