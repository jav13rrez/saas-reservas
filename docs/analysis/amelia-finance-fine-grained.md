# Amelia Finance — Fine-Grained Documentation

## Overview

**Finance** administra **3 aspectos económicos principales:**
1. **Transactions** — Historial de todos los pagos (citas, eventos, paquetes)
2. **Invoices** — Facturas generadas por reservas
3. **Coupons** — Códigos de descuento y promociones

Cada tab tiene su propia lista con filtros y modalesdediferentes campos.

---

## Estructura de Pestañas Principales

| Tab | Botón | Tabla Principal | Columnas Clave | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Transactions** | (lista readonly) | Transactions List | DATE, CUSTOMER, BOOKING, STATUS, AMOUNT | 🔶 | 🟡 |
| **Invoices** | (lista readonly) | Invoices List | INVOICE #, CUSTOMER, DATE, BOOKING, STATUS | 🔶 | 🟡 |
| **Coupons** | "+ Coupon" | Coupons List | CODE, DISCOUNT, USAGE, VALID UNTIL, STATUS | 🔶 | 🟡 |

---

## TAB 1: Transactions List View

**Historial de todos los pagos de citas, eventos y paquetes.** Este tab es de solo lectura (sin botón de crear nuevo).

### Controles Superiores

| Control | Tipo | Opciones/Valores | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Date Range Picker** | Input rango | `MMM DD, YYYY - MMM DD, YYYY` | Jun 24, 2026 - Jun 24, 2027 | 🔶 | 🟡 |
| **Filter Button** | Botón icono | Abre filtros avanzados | - | 🔶 | 🟡 |

### Tabla Transactions

| Columna | Tipo | Contenido | Acciones | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **ID** | Número | Número transacción | - | 🔶 | 🟡 |
| **PAYMENT DATE** | Texto | `MMM DD, YYYY` | - | 🔶 | 🟡 |
| **CUSTOMER** | Avatar + Texto | Nombre cliente + foto | Click abre perfil | 🔶 | 🟡 |
| **EMPLOYEES** | Avatar(s) | Empleado(s) asociado(s) | - | 🔶 | 🟡 |
| **BOOKING** | Texto | Nombre cita/servicio | - | 🔶 | 🟡 |
| **STATUS** | Badge | `Pending` (naranja), `Paid` (verde), etc. | Dropdown cambiar estado | 🔶 | 🟡 |
| **AMOUNT** | Monto USD | `$XX.XX` | - | 🔶 | 🟡 |
| **ACTIONS** | Menú | (menú con opciones) | ⋯ menu | 🔶 | 🟡 |

---

## TAB 2: Invoices List View

**Facturas generadas por reservas.** Este tab también es de solo lectura.

### Controles Superiores

| Control | Tipo | Opciones/Valores | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Date Range Picker** | Input rango | `MMM DD, YYYY - MMM DD, YYYY` | Jun 24, 2026 - Jun 24, 2027 | 🔶 | 🟡 |
| **Filter Button** | Botón icono | Abre filtros avanzados | - | 🔶 | 🟡 |

### Tabla Invoices

| Columna | Tipo | Contenido | Acciones | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **INVOICE #** | Número | Número de factura (ej: #1) | Click abre detalle | 🔶 | 🟡 |
| **CUSTOMER** | Texto | Nombre cliente | - | 🔶 | 🟡 |
| **INVOICE DATE** | Texto | `MMM DD, YYYY` | - | 🔶 | 🟡 |
| **EMPLOYEES** | Texto | Nombre empleado (si aplica) | - | 🔶 | 🟡 |
| **BOOKING** | Texto | Nombre cita/evento | - | 🔶 | 🟡 |
| **STATUS** | Badge | `Pending` (naranja), `Sent` (gris), `Paid` (verde) | Dropdown cambiar | 🔶 | 🟡 |

---

## TAB 3: Coupons List View

**Gestión de cupones/códigos de descuento.**

#### Controles

| Control | Tipo | Opciones/Valores | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Search Box** | Input text | Buscar por: código, nombre | - | 🔶 | 🟡 |
| **Filter / Status** | Buttons | `Active`, `Inactive`, `Expired`, `All` | Active | 🔶 | 🟡 |
| **+ Add Coupon** | Botón primario | Abre modal New Coupon | - | 🔶 | 🟡 |

#### Tabla Coupons

| Columna | Tipo | Contenido | Acciones | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **CODE** | Texto | Código cupón (ej: "SUMMER20") | Click abre modal Edit | 🔶 | 🟡 |
| **DISCOUNT** | Texto | `20%` o `$10 off` | - | 🔶 | 🟡 |
| **TYPE** | Badge | `Percentage`, `Fixed Amount` | - | 🔶 | 🟡 |
| **USAGE** | Número | `5 / 10` (usado / máximo) | - | 🔶 | 🟡 |
| **VALID UNTIL** | Fecha | `MMM DD, YYYY` o `Never` | - | 🔶 | 🟡 |
| **STATUS** | Badge | `Active` (verde), `Inactive` (gris), `Expired` (rojo) | Click menu | 🔶 | 🟡 |
| **ACTIONS** | Menú | Edit, Delete, View Usage | ⋯ menu | 🔶 | 🟡 |

#### Modal: New / Edit Coupon

| Campo | Tipo | Opciones/Valores | Validación | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Coupon Code** | Input text | Código alfanumérico | Required, unique, max 20 | - | 🔶 | 🟡 |
| **Description** | Input text | Descripción interna | Optional, max 100 | - | 🔶 | 🟡 |
| **Discount Type** | Radio | `Percentage`, `Fixed Amount` | Required | `Percentage` | 🔶 | 🟡 |
| **Discount Value** | Input number | % o $ | Required, >0 | 10 | 🔶 | 🟡 |
| **Max Usage** | Input number | Máximo usos (vacío = unlimited) | Optional | Unlimited | 🔶 | 🟡 |
| **Valid From** | Date picker | Fecha inicio | - | Today | 🔶 | 🟡 |
| **Valid Until** | Date picker | Fecha fin (o Never) | ≥ Valid From | - | 🔶 | 🟡 |
| **Applicable To** | Multi-select | `All Services`, `Specific Services` | All | `All Services` | 🔶 | 🟡 |
| **Services** (si Specific) | Checkboxes | Listado de servicios | - | - | 🔶 | 🟡 |
| **Status** | Radio | `Active`, `Inactive` | - | `Active` | 🔶 | 🟡 |

### Controles Superiores (Coupons Tab)

| Control | Tipo | Opciones/Valores | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Search Box** | Input text | Buscar por: código cupón, nombre | - | 🔶 | 🟡 |
| **+ Coupon** | Botón primario | Abre modal New Coupon | - | 🔶 | 🟡 |

### Tabla Coupons

| Columna | Tipo | Contenido | Acciones | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **CODE** | Texto | Código cupón (ej: "SUMMER20") | Click abre modal Edit | 🔶 | 🟡 |
| **DISCOUNT** | Texto | `20%` o `$10 off` | - | 🔶 | 🟡 |
| **USAGE** | Número | `5 / 10` (usado / máximo) | - | 🔶 | 🟡 |
| **VALID UNTIL** | Fecha | `MMM DD, YYYY` o `Never` | - | 🔶 | 🟡 |
| **STATUS** | Badge | `Active` (verde), `Inactive` (gris), `Expired` (rojo) | Click menu cambiar | 🔶 | 🟡 |
| **ACTIONS** | Menú | Edit, Delete, View Usage | ⋯ menu | 🔶 | 🟡 |

### Modal: New / Edit Coupon

| Campo | Tipo | Opciones/Valores | Validación | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Coupon Code** | Input text | Código alfanumérico | Required, unique, max 20 | - | 🔶 | 🟡 |
| **Description** | Input text | Descripción interna | Optional, max 100 | - | 🔶 | 🟡 |
| **Discount Type** | Radio | `Percentage`, `Fixed Amount` | Required | `Percentage` | 🔶 | 🟡 |
| **Discount Value** | Input number | % o $ | Required, >0 | 10 | 🔶 | 🟡 |
| **Max Usage** | Input number | Máximo usos (vacío = unlimited) | Optional | Unlimited | 🔶 | 🟡 |
| **Valid From** | Date picker | Fecha inicio | - | Today | 🔶 | 🟡 |
| **Valid Until** | Date picker | Fecha fin (o Never) | ≥ Valid From | - | 🔶 | 🟡 |
| **Applicable To** | Multi-select | `All Services`, `Specific Services` | All | `All Services` | 🔶 | 🟡 |
| **Services** (si Specific) | Checkboxes | Listado de servicios | - | - | 🔶 | 🟡 |
| **Status** | Radio | `Active`, `Inactive` | - | `Active` | 🔶 | 🟡 |

---

## Global Finance Controls

### Totals / KPIs Section

Resumen visible en top de Finance:

| Métrica | Tipo | Valor | Período | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Total Revenue** | KPI | `$X,XXX.XX` | Período seleccionado | 🔶 | 🟡 |
| **Outstanding Payments** | KPI | `$XXX.XX` (Pending + Partial) | - | 🔶 | 🟡 |
| **Refunds Issued** | KPI | `$XXX.XX` | Período seleccionado | 🔶 | 🟡 |
| **Discounts Applied** | KPI | `$XXX.XX` (via cupones) | Período seleccionado | 🔶 | 🟡 |

### Export / Reports

| Control | Tipo | Opciones | Estado SaaS | Prioridad |
|---|---|---|---|---|
| **Export Payments** | Button | CSV, PDF, Excel | 🔶 | 🟡 |
| **Export Coupons Used** | Button | CSV | 🔶 | 🟡 |
| **Financial Report** | Button | Abre PDF report (ingresos, gastos, profit) | 🔶 | 🟡 |

---

## Resumen de Brechas Críticas

### Prioridad Roja (🔴)

1. **Transactions & Invoices Modals** — NO DOCUMENTADO si existen modales al hacer click en filas (probablemente detalles readonly).

### Prioridad Amarilla (🟡)

1. **Payment Gateway Integration** — ¿Stripe/PayPal integrados? ¿Manual entry? ¿Webhooks para confirmar pagos?
2. **Refund Workflow** — ¿Disponible desde Transactions? ¿Manual o automático?
3. **Coupon Application Logic** — ¿Aplicable solo en checkout o después? ¿Validación en servidor?
4. **Invoice Generation** — ¿Automático por cada cita o manual? ¿Qué dispara creación?
5. **Transaction Status Workflow** — Confirmar qué cambios de estado son válidos (Pending → Paid, etc).
6. **Export Functionality** — ¿Disponible para Transactions/Invoices? ¿Formatos (CSV, PDF)?
7. **Filters Detail** — Documentar exactamente qué filtros tiene cada tab (por method, payment status, etc).

### Notas de Implementación

- Los **3 tabs** (Transactions, Invoices, Coupons) son **INDEPENDIENTES** - cada uno es su propia lista y contexto.
- **Transactions** e **Invoices** son **READONLY** - mostrar historial solamente, sin botón "+ crear nuevo".
- **Coupons** es el **ÚNICO TAB EDITABLE** - permite crear/editar/eliminar cupones.
- Los **Status de Pago** deben ser intuitivos visualmente (colores, iconos).
- El **Date Range Picker** es un control compartido entre todos los tabs.
- Las **Acciones en filas** (Edit, Delete, View, etc) son específicas por tab.
