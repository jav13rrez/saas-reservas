# Amelia Calendar — Fine-Grained Documentation

## Overview

El **Calendar** permite visualizar y gestionar reservas (appointments) y eventos en diferentes vistas temporales: Month (mes), Week (semana), Day (día). Cada vista muestra los eventos/reservas con código de color y permite hacer clic para editar o crear nuevas instancias. El calendario soporta navegación por períodos y filtrado (visible mediante icono funnel).

---

## Calendar Controls

| Campo/Control | Tipo | Opciones/Valores | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Filter Button** | Botón icono (funnel) | Abre panel de filtros (TBD) | - | ❌ | 🟡 |
| **Today Button** | Botón | Label: "Today" | - | ✅ | 🟢 |
| **Previous Period** | Botón flecha izquierda | Navigate -1 período | - | ✅ | 🟢 |
| **Next Period** | Botón flecha derecha | Navigate +1 período | - | ✅ | 🟢 |
| **Current Period Display** | Texto legible | Muestra rango actual (ej: "June 2026", "June 22, 2026 - June 28, 2026", "Tuesday, June 23, 2026") | - | ✅ | 🟢 |
| **View Mode Dropdown** | Select | Opciones: `Month`, `Week`, `Day` | Month | ✅ | 🟢 |
| **Add Button** | Botón primario | Label: "+ Add" | - | ✅ | 🟢 |

---

## Month View

### Layout

- **Grid de 7 columnas** (MON, TUE, WED, THU, FRI, SAT, SUN)
- **Cada celda** = un día del mes
- **Número de día** en esquina superior izquierda de cada celda
- **Eventos/Reservas** como etiquetas coloreadas dentro de celdas
- **"+X more"** si hay más eventos que espacio en la celda (click expande?)

### Evento/Reserva Item (dentro de celda Month)

| Atributo | Tipo | Ejemplo | Estado SaaS | Prioridad |
|---|---|---|---|---|
| **Nombre** | Texto | "Online Yoga DIY - Practice..." (truncado si largo) | ✅ | 🟢 |
| **Color de fondo** | Enum | Azul claro (Appointments) / Púrpura (Events) / Otros colores por tipo | ✅ | 🟢 |
| **Icono** (opcional) | Icono pequeño | Ej: pin, asterisco, etc. | 🔶 | 🟡 |
| **Click behavior** | Interacción | Abre modal detalle del evento | ✅ | 🟢 |

---

## Week View

### Layout

- **Encabezado**: MON, TUE, WED, THU, FRI, SAT, SUN con fechas (ej: "22", "23")
- **Hoy destacado** con círculo/badge de color (ej: "23" en rosa)
- **Eje Y izquierdo**: Horas (5:00 AM, 6:30 AM, 8:00 AM, 9:30 AM, 11:00 AM, 12:30 PM, 2:00 PM, ...) con background rayado para horas no laborales
- **Eventos/Reservas** como bloques horizontales con:
  - Nombre del evento
  - Hora de inicio y fin (ej: "5:00 am - 6:30 am")
  - Color de fondo según tipo

### Evento/Reserva Item (Week)

| Atributo | Tipo | Ejemplo | Estado SaaS | Prioridad |
|---|---|---|---|---|
| **Nombre** | Texto | "Morning Stretching and Running with Edward Tipton" | ✅ | 🟢 |
| **Hora** | Texto | "5:00 am - 6:30 am" | ✅ | 🟢 |
| **Duración visual** | Alto del bloque | Proporcional a duración | ✅ | 🟢 |
| **Color** | Enum | Púrpura claro (Events), Azul claro (Appointments) | ✅ | 🟢 |
| **Click/Drag** | Interacción | Click abre modal; Drag reschedulea (TBD) | ✅ | 🔶 |

---

## Day View

### Layout

- **Encabezado**: Día semana completo (ej: "Tuesday, June 23, 2026")
- **Una sola columna** con eje de tiempo
- **Eje Y**: Horas con background rayado para no-labor
- **Eventos/Reservas** como bloques con mismo formato que Week

### Evento/Reserva Item (Day)

Idéntico a Week View.

---

## Filtros (Funnel Icon)

| Filtro | Tipo | Opciones | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **By Employee** | Multi-select | Listado de empleados | Todos | ❌ | 🟡 |
| **By Service** | Multi-select | Listado de servicios | Todos | ❌ | 🟡 |
| **By Location** | Multi-select | Listado de ubicaciones | Todas | ❌ | 🟡 |
| **By Status** | Multi-select | `Pending`, `Approved`, `Cancelled`, `Completed` | Todos | ❌ | 🟡 |
| **By Customer** | Search/Select | Nombre de cliente | - | ❌ | 🟡 |

*(Nota: Los filtros están visibles en el UI pero no documentados en detalle debido a congelación de la página. Se requiere exploración adicional.)*

---

## Crear Nueva Reserva/Evento (Botón "+ Add")

| Campo | Tipo | Opciones/Valores | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Type** (selector inicial) | Radio / Buttons | `Appointment` vs `Event` | - | 🔶 | 🟡 |

*(Nota: El modal de creación se abre pero el detalle está documentado en `amelia-bookings-fine-grained.md` y `amelia-events-fine-grained.md`.)*

---

## Drag & Drop / Rescheduling

- **Comportamiento**: Arrastrar un evento/reserva en Week/Day view reschedulea a nueva hora/día
- **Validación**: Sistema debe validar disponibilidad de empleado, no conflictos
- **Feedback**: ¿Se muestra confirmación? ¿Requiere click adicional? **(TBD)**

---

## Resumen de Brechas Críticas

### Prioridad Roja (🔴)

*(Ninguna bloqueante identificada.)*

### Prioridad Amarilla (🟡)

1. **Filtros** — Botón funnel visible pero panel de filtros no explorado. Documentar qué criterios aplican (empleado, servicio, ubicación, estado, cliente).
2. **Drag & Drop Rescheduling** — Confirmar que es posible, validaciones y UX de confirmación.
3. **Add Button Flow** — Clarificar si abre selector de tipo (Appointment vs Event) o modal directo.
4. **"+X more" Behavior** — Verificar si hace expand inline o abre modal con listado.

### Notas de Implementación

- Las 3 vistas (Month, Week, Day) comparten el mismo pool de datos; cambiar view no filtra, solo cambia visualización.
- Los colores de evento pueden ser configurables por tipo de evento (Appointments = azul, Events = púrpura, Custom = otro). Revisar `amelia-customize-fine-grained.md` para confirmación.
- Hora de inicio/fin se muestra siempre visible en bloques Week/Day. En Month, truncado o no visible (revisar).
- El background rayado en horas no-labor (ej: antes de 5 AM, después de 10 PM) indica período fuera de horario estándar. ¿Es configurable por ubicación?
- La navegación entre períodos (< >) es semanal en Week view, mensual en Month view, y diaria en Day view.
