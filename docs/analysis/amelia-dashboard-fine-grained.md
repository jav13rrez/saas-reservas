# Amelia Dashboard — Fine-Grained Documentation

## Overview

El **Dashboard** es la página de inicio del admin. Presenta métricas clave de negocio a nivel general, con dos vistas principales: **Appointments** (reservas/citas) y **Events** (eventos). Cada vista muestra widgets de métricas, gráficos de tendencia, ocupación diaria, y una tabla de próximas reservas/eventos.

---

## Dashboard Structure

### Top Controls

| Campo | Tipo | Opciones/Valores | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Date Range Picker** | Input rango fechas | Formato: `MMM D, YYYY - MMM D, YYYY` | Última semana | 🔶 | 🟡 |
| **Filter Button** | Botón con icono funnel | Abre filtros (TBD) | - | ❌ | 🟡 |
| **Appointments Tab** | Botón/Pestaña | Label: "Appointments" | Activo por defecto | ✅ | 🟢 |
| **Events Tab** | Botón/Pestaña | Label: "Events" | Inactivo | ✅ | 🟢 |

---

## Appointments View Widgets

### Métricas Principales (4 widgets superiores)

| Widget | Tipo | Valor mostrado | Cálculo/Fuente | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|---|
| **Total appointments** | KPI card | Número entero + % cambio | Conteo de reservas en rango | 0 | ✅ | 🟢 |
| **Customers** | KPI card | Número entero + % cambio | Conteo de clientes únicos | 0 | ✅ | 🟢 |
| **Occupancy rate** | KPI card | Porcentaje + gráfica barra | (Booked slots / Total slots) × 100 | 0% | ✅ | 🟢 |
| **Revenue** | KPI card | Monto USD + % cambio | Suma de pagos confirmados | $0.00 | ✅ | 🟢 |

Nota: El % de cambio compara el rango actual vs. período anterior con indicador de color (verde ↑, rojo ↓).

### Gráficos Secundarios

| Widget | Tipo | Ejes / Series | Nota | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Daily occupancy** | Heatmap/Grid | Eje X: M T W T F S S (días semana), Eje Y: semanas del mes | Cada celda es un día; color intenso = mayor ocupación. Selector de mes superior derecho (ej: "Jun, 2026") | ✅ | 🟢 |
| **Top trends** (si existe) | Gráfico barras/líneas | Eje X: Semanas/días, Eje Y: Appointments count | Muestra tendencia de reservas en el período | 🔶 | 🟡 |

### Tabla: Upcoming Appointments

| Columna | Tipo | Valores/Formato | Acciones | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **DATE** | Texto | `MMM DD, YYYY` | - | ✅ | 🟢 |
| **TIME** | Texto | `HH:MM am/pm` | - | ✅ | 🟢 |
| **CUSTOMER** | Avatar + Texto | Nombre de cliente + foto circular | Clicar abre perfil cliente | ✅ | 🟢 |
| **EMPLOYEE** | Avatar + Texto | Nombre empleado + foto circular | Clicar abre perfil empleado | ✅ | 🟢 |
| **SERVICE** | Texto | Nombre servicio | - | ✅ | 🟢 |
| **DURATION** | Texto | `1h`, `30m`, etc. | - | ✅ | 🟢 |
| **PAID** | Monto USD | `$0.00`, `$XX.XX` | - | ✅ | 🟢 |

---

## Events View Widgets

### Métricas Principales

| Widget | Tipo | Valor mostrado | Cálculo/Fuente | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|---|
| **Total events** | KPI card | Número entero + % cambio + gráfico sparkline | Conteo de eventos en rango | 0 | ✅ | 🟢 |
| **Attendees** | KPI card | Número entero + % cambio + barra segmentada (New/Returning) | Conteo de asistentes confirmados | 0 | ✅ | 🟢 |
| **Occupancy rate** | KPI card | Porcentaje + barra | (Registrados / Capacidad) × 100 | 0% | ✅ | 🟢 |
| **Revenue** | KPI card | Monto USD + % cambio + gráfico líneas | Suma de ingresos por eventos | $0.00 | ✅ | 🟢 |

### Gráficos Secundarios (Events)

| Widget | Tipo | Contenido | Estado SaaS | Prioridad |
|---|---|---|---|---|
| **Daily occupancy** | Heatmap/Grid | Ídem Appointments: M-S grid por semana del mes, dropdown mes | ✅ | 🟢 |

### Tabla: Upcoming Events

| Columna | Tipo | Valores/Formato | Acciones | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **DATE & TIME** | Texto | `MMM DD, YYYY at HH:MM am/pm` | - | ✅ | 🟢 |
| **NAME** | Texto | Nombre del evento | Clicar abre modal evento | ✅ | 🟢 |
| **STATUS** | Etiqueta/Dropdown | `Closed`, `Open`, `Cancelled` (con icono) | Clicar expande menú de opciones | ✅ | 🟢 |
| **BOOKED** | Texto | `0 / 15`, `5 / 20` (registrados / capacidad) | - | ✅ | 🟢 |
| **ORGANIZER** | Avatar + Texto | Nombre empleado + foto | Clicar abre perfil | 🔶 | 🟡 |
| **STAFF** | Avatar + Texto | Nombre empleado + foto | Clicar abre perfil | 🔶 | 🟡 |

---

## Resumen de Brechas Críticas

### Prioridad Roja (🔴)

*(Ninguna identificada. El Dashboard es funcional en su estructura base.)*

### Prioridad Amarilla (🟡)

1. **Filter Button** — El botón de filtro está presente pero los filtros específicos (por empleado, servicio, ubicación, estado) no están documentados. Revisar qué filtros aplica cada vista.
2. **Top Trends Widget** — No se confirma si existe en Appointments; si existe, necesita documentación de qué serie muestra.
3. **Event Status Dropdown** — Verificar qué estados pueden cambiar desde el dashboard (Closed → Open, etc.) y si hay restricciones.

### Notas de Implementación

- Ambas vistas comparten la misma estructura de layout: 4 KPI cards superiores, gráficos secundarios, tabla inferior.
- Los porcentajes de cambio deben comparar el rango seleccionado vs. el período anterior de igual duración.
- El date range picker debe permitir seleccionar rangos personalizados (click en las fechas abre calendar picker).
- Los heatmaps de ocupación usan un color degradado (púrpura/azul intenso = mayor ocupación; gris oscuro = sin reservas).
- La tabla de "Upcoming" es un preview; para editar reservas/eventos, se abre el modal de detalle (no documentado aquí, ver `amelia-bookings-fine-grained.md` y `amelia-events-fine-grained.md`).
