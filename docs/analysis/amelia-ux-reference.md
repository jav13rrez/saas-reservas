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

[pendiente — compartir captura]

Preguntas clave:
- ¿Qué KPIs muestra? (reservas hoy, ingresos, próximas citas…)
- ¿Hay widget de calendario rápido?
- ¿Accesos directos a acciones frecuentes?

---

## Calendar

[pendiente — compartir captura]

Preguntas clave:
- ¿Vista por defecto: día / semana / mes?
- ¿Se puede filtrar por Employee o por Service?
- ¿Se puede crear una cita directamente desde el calendario?
- ¿Cómo se muestra cuando hay dos bookings simultáneos del mismo Employee?

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
