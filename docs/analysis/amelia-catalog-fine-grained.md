# Amelia Catalog — Fine-Grained Documentation

## Overview

**Catalog** administra **3 tipos de recursos principales:**
1. **Services** — Servicios individuales (ej: "Aerobic", "Yoga", "Massage")
2. **Packages** — Paquetes de servicios (ej: "10 clases de yoga")
3. **Resources** — Recursos compartidos (ej: "Yoga mats", "Studio Room 1")

Cada tipo tiene su propia lista, filtros, y modal de creación/edición.

---

## Estructura de Pestañas Principales

| Tab | Botón Crear | Tabla Principal | Columnas Clave | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Services** | "+ Service" | Services List | NAME, CATEGORY, DURATION, PRICE, EMPLOYEES | ✅ | 🟢 |
| **Packages** | "+ Package" | Packages List | NAME, SERVICES, PRICE, DURATION | 🔶 | 🟡 |
| **Resources** | "+ Resource" | Resources List (vacía si no existen) | NAME, QUANTITY, SHARED/PER-SERVICE/PER-LOCATION | 🔶 | 🟡 |

---

## Services List View

### Controles Superiores

| Control | Tipo | Opciones/Valores | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Search Box** | Input text | Buscar por: nombre, categoría | - | 🔶 | 🟡 |
| **Filter by Category** | Dropdown / Buttons | Listado de categorías + "All" | All | 🔶 | 🟡 |
| **Sort** | Dropdown | `Name (A-Z)`, `Price (Low-High)`, `Recently Added`, `Most Booked` | Name (A-Z) | 🔶 | 🟡 |
| **+ Add Service** | Botón primario | Abre modal New Service | - | ✅ | 🟢 |

### Tabla Services

| Columna | Tipo | Contenido | Acciones | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **NAME** | Texto / Icono | Nombre servicio (+ icono si existe) | Click abre modal Edit | ✅ | 🟢 |
| **CATEGORY** | Badge / Texto | Categoría a la que pertenece | - | 🔶 | 🟡 |
| **DURATION** | Texto | `1h`, `30m`, `1h 30m` | - | ✅ | 🟢 |
| **PRICE** | Monto USD | `$0.00`, `$XX.XX` | - | ✅ | 🟢 |
| **EMPLOYEES** | Número | "2 employees offer this" | Click abre lista | 🔶 | 🟡 |
| **BOOKINGS** | Número | "15 bookings" (en período seleccionado) | - | 🔶 | 🟡 |
| **STATUS** | Badge | `Active` (verde), `Inactive` (gris) | Click abre menu | 🔶 | 🟡 |
| **ACTIONS** | Menú | Edit, Delete, Duplicate, View Analytics | ⋯ menu | 🔶 | 🟡 |

---

## Modal: New / Edit Service

### Estructura General

Tabs / Sections:
1. **Details** (nombre, descripción, duración, precio)
2. **Employees** (quiénes ofrecen este servicio)
3. **Gallery** (imágenes/fotos del servicio)
4. **Settings** (opciones avanzadas: buffer, Min capacity, etc.)

### Tab: Details

| Campo | Tipo | Opciones/Valores | Validación | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Service Name** | Input text | Nombre servicio | Required, max 100 | - | ✅ | 🟢 |
| **Category** | Dropdown / Creatable | Listado de categorías + opción "New Category" | Optional | - | 🔶 | 🟡 |
| **Description (short)** | Input text | Descripción corta (1 línea) | Optional, max 200 | - | 🔶 | 🟡 |
| **Description (long)** | Rich text / Markdown | Descripción completa para el cliente | Optional | - | 🔶 | 🟡 |
| **Duration** | Time picker | HH:MM | Required | 01:00 | ✅ | 🟢 |
| **Price** | Input currency | USD | Required, ≥0 | 0.00 | ✅ | 🟢 |
| **Deposit Required** | Checkbox | ☑ / ☐ | - | False | 🔶 | 🟡 |
| **Deposit Amount** (si checked) | Input currency | ≤ Price | - | 0.00 | 🔶 | 🟡 |
| **Color** | Color picker | Hex color para calendario | - | Blue | 🔶 | 🟡 |
| **Icon** (si existe) | Icon picker | Icono para mostrar en listados | Optional | - | 🔶 | 🟡 |
| **Status** | Radio | `Active`, `Inactive` | - | `Active` | ✅ | 🟡 |

### Tab: Employees

Lista de empleados que ofrecen este servicio. Puede ser multi-select de todos los empleados activos.

| Elemento | Tipo | Contenido | Estado SaaS | Prioridad |
|---|---|---|---|---|
| **Employees Checkboxes** | Checkboxes | Listado de empleados, ☑ si asignado | 🔶 | 🟡 |
| **[✓] Employee Name** | Checkbox | Ej: "Edwina Appleby", "Edward Tipton" | 🔶 | 🟡 |

*Nota: Según ADR-0016, el modelo va a cambiar. Actualmente es `service.resourceIds[]` (lista de empleados). Futuro será `resource.serviceIds[]` (empleado declara servicios).*

### Tab: Gallery

| Elemento | Tipo | Contenido | Acciones | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Images List** | Grid de thumbnails | Fotos del servicio (up to N imágenes) | Drag to reorder, Delete | 🔶 | 🟡 |
| **+ Upload Image** | File upload button | JPG, PNG, WebP (max 5MB) | Click abre picker | 🔶 | 🟡 |
| **Set as Featured** | Button (per image) | Marca imagen como la principal | Click marca | 🔶 | 🟡 |

### Tab: Settings

| Campo | Tipo | Opciones/Valores | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Min Duration** | Time picker | Duración mínima permitida | 00:00 | 🔶 | 🟡 |
| **Max Duration** | Time picker | Duración máxima permitida | 99:59 | 🔶 | 🟡 |
| **Min Advance Booking** | Input days | Días mínimos antes de reservar (ej: 1 día) | 0 | 🔶 | 🟡 |
| **Max Advance Booking** | Input days | Máximo días anticipados (ej: 90 días) | 365 | 🔶 | 🟡 |
| **Buffer Time (before)** | Time picker | Tiempo buffer antes de siguiente reserva | 00:00 | 🔶 | 🟡 |
| **Buffer Time (after)** | Time picker | Tiempo buffer después de reserva | 00:00 | 🔶 | 🟡 |
| **Min Capacity** | Input number | Número mínimo de clientes para esta reserva | 1 | 🔶 | 🟡 |
| **Max Capacity** | Input number | Número máximo | 1 | 🔶 | 🟡 |
| **Allow Group Booking** | Checkbox | ☑ / ☐ | False | 🔶 | 🟡 |
| **Online/Virtual** | Checkbox | ☑ Servicio online (Zoom/Meet link) | False | 🔶 | 🟡 |
| **Require Customer Confirmation** | Checkbox | ☑ / ☐ Esperar aceptación del cliente | False | 🔶 | 🟡 |

---

## Categories Sub-Section (si existe)

### Categories List View

| Columna | Tipo | Contenido | Acciones | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **NAME** | Texto | Nombre categoría (ej: "Yoga", "Fitness") | Click abre Edit | 🔶 | 🟡 |
| **SERVICES COUNT** | Número | Cuántos servicios pertenecen | - | 🔶 | 🟡 |
| **ACTIONS** | Menú | Edit, Delete | ⋯ | 🔶 | 🟡 |

### Modal: New / Edit Category

| Campo | Tipo | Opciones | Validación | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Category Name** | Input text | Nombre | Required, unique, max 50 | - | 🔶 | 🟡 |
| **Description** | Text area | Descripción de la categoría | Optional | - | 🔶 | 🟡 |
| **Color** | Color picker | Color para mostrar en UI | - | Blue | 🔶 | 🟡 |
| **Icon** | Icon picker | Icono representativo | Optional | - | 🔶 | 🟡 |
| **Display Order** | Input number | Orden en que aparece en listado | - | Auto | 🔶 | 🟡 |

---

## Acciones Rápidas

| Acción | Efecto | Estado SaaS | Prioridad |
|---|---|---|---|
| **Edit** | Abre modal Edit Service (todos tabs) | ✅ | 🟢 |
| **Delete** | Confirmación, elimina servicio (¿qué pasa con reservas?) | 🔶 | 🟡 |
| **Duplicate** | Crea copia del servicio con "_copy" en nombre | 🔶 | 🟡 |
| **View Analytics** | Abre dashboard de estadísticas del servicio | 🔶 | 🟡 |

---

## Validaciones y Lógica

1. **Duración**: Debe ser > 0 y formato válido (HH:MM).

2. **Precio**: Puede ser 0 (servicio gratuito), pero si Deposit Required, deposit ≤ price.

3. **Capacidad**: 
   - Min Capacity ≤ Max Capacity
   - Si Allow Group Booking = false, Max Capacity = 1

4. **Advance Booking**:
   - Min ≤ Max
   - Afecta qué fechas se muestran en widget booking

5. **Eliminación**:
   - Si servicio tiene reservas futuras, ¿se puede eliminar o solo inactivar?
   - Eliminar categoría vacía vs con servicios

6. **Employee Assignment**:
   - Cambiar empleados en servicio existente: ¿afecta reservas ya hechas?

---

## Resumen de Brechas Críticas

### Prioridad Roja (🔴)

1. **Service-Employee Model** — ADR-0016 indica cambio pendiente de modelo. Documentar impacto en UI/UX.

### Prioridad Amarilla (🟡)

1. **Buffer Time (before/after)** — Confirmar si se suma al total de duración o es independiente.
2. **Min/Max Advance Booking** — Confirmar si es número de días o fecha/hora específica.
3. **Group Booking** — Confirmar si existe y cómo se maneja (ej: "Book for 3 people").
4. **Online/Virtual Services** — Confirmar si automáticamente genera Zoom/Meet link o es manual.
5. **Deletion Policy** — Soft delete o hard delete. Qué pasa con reservas históricas.
6. **Service Analytics** — Qué métricas muestra (bookings, revenue, customer feedback).

### Notas de Implementación

- El Tab **Settings** puede ser accordion/collapsible para mejor UX.
- Los campos Min/Max Duration, Buffer Time usan formato HH:MM y deben validarse.
- Images en Gallery pueden ser drag-droppable para reordenar.
- **Category** es una relación M:1 (muchos servicios, una categoría). Permitir crear categoría nueva on-the-fly.
- **Online Services** debería tener toggle visual distinto (ej: "🌐 Online") en tabla.

---

## TAB 2: Packages List View

### Overview

La pestaña **Packages** muestra los paquetes de servicios que ofrece el negocio. Un paquete es un conjunto de servicios bundleados (ej: "10 clases de yoga"). Cada paquete tiene precio, duración y lista de servicios incluidos.

### Controles Superiores

| Control | Tipo | Opciones/Valores | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Search Box** | Input text | Buscar por: nombre paquete | - | 🔶 | 🟡 |
| **Filter Button** | Botón icono | Abre filtros avanzados (por servicio, categoría) | - | 🔶 | 🟡 |
| **+ Package** | Botón primario | Abre modal New Package | - | 🔶 | 🟡 |

### Tabla Packages

| Columna | Tipo | Contenido | Acciones | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **NAME** | Texto | Nombre paquete (ej: "Online Yoga & Meditation") | Click abre modal Edit | 🔶 | 🟡 |
| **SERVICES** | Número | Cantidad de servicios en el paquete | - | 🔶 | 🟡 |
| **PRICE** | Monto USD | `$XX.XX` | - | 🔶 | 🟡 |
| **DURATION** | Texto | Duración total o periodo (ej: "1 Month") | - | 🔶 | 🟡 |
| **ACTIONS** | Menú | Edit, Delete, Duplicate | ⋯ menu | 🔶 | 🟡 |

### Modal: New / Edit Package

#### Estructura General

El modal tiene **5 tabs principales**:
1. **Details** (formulario básico)
2. **Services** (servicios incluidos + configuración por servicio)
3. **Pricing** (cálculo de precio con descuentos)
4. **Gallery** (imágenes: hasta 4)
5. **Settings** (opciones avanzadas)
+ Tab adicional: **Tips & suggestions**

#### Tab 1: Details

| Campo | Tipo | Opciones/Valores | Validación | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Image** | File upload (dragdrop) | JPG, PNG | - | - | 🔶 | 🟡 |
| **Name** | Input text | Nombre paquete | Required | - | 🔶 | 🟡 |
| **Translate** | Link | (abre traducción) | - | - | 🔶 | 🟡 |
| **Color** | Color picker | Hex color (#1788FB default) | - | #1788FB | 🔶 | 🟡 |
| **Duration** | Dropdown + Spinner | Unidad (Months/Years/etc) + cantidad | Required | Months, 1 | 🔶 | 🟡 |
| **Limit package purchases per customer** | Toggle | ☑ / ☐ | - | False | 🔶 | 🟡 |
| **Description** | Rich text editor | WYSIWYG (Text/HTML modes) | Optional | - | 🔶 | 🟡 |

#### Tab 2: Services

**Configuración detallada por servicio incluido en el paquete.**

| Elemento | Tipo | Contenido | Estado SaaS | Prioridad |
|---|---|---|---|---|
| **Services Multi-select** | Dropdown | Seleccionar servicios a incluir | 🔶 | 🟡 |
| **Shared capacity across services** | Toggle | ☑ Compartir capacidad entre servicios | 🔶 | 🟡 |
| **Tabla Servicios Incluidos** | Lista expandible | Para cada servicio: |  |  |
| - **Nombre + ID** | Display | (ej: "Online Yoga ID: 25") | 🔶 | 🟡 |
| - **Precio** | Input currency | Precio del servicio en paquete | 🔶 | 🟡 |
| - **Empleados** | Avatar group | (mostrar empleados asignados) | 🔶 | 🟡 |
| - **Tipo** | Badge | "Multiple" (indica multi-employee) | 🔶 | 🟡 |
| - **Number of appointments** | Spinner | Cuántas citas de este servicio incluye | 🔶 | 🟡 |
| - **Minimum bookings required** | Spinner | Mínimo de citas a reservar | 🔶 | 🟡 |
| - **Maximum bookings allowed** | Spinner | Máximo de citas permitidas | 🔶 | 🟡 |
| - **Employees** | Dropdown | Seleccionar empleados (si editable) | 🔶 | 🟡 |
| - **Locations** | Dropdown | Ubicaciones donde aplica (ej: "Zoom Meeting") | 🔶 | 🟡 |
| - **☑ Allow customers to choose employee on the customer panel** | Checkbox | Permitir que cliente elige empleado | 🔶 | 🟡 |

#### Tab 3: Pricing

| Campo | Tipo | Opciones/Valores | Validación | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Price type** | Dropdown | `Custom`, (otros tipos si existen) | - | `Custom` | 🔶 | 🟡 |
| **Price** | Input currency | Precio base paquete USD | Required, ≥0 | - | 🔶 | 🟡 |
| **Discount (%)** | Spinner | Descuento porcentaje (0-100) | - | 0 | 🔶 | 🟡 |
| **Package price** (calculated) | Display | Precio final después descuento | Read-only | Auto | 🔶 | 🟡 |
| **Deposit payment** | Toggle | ☑ Requiere depósito | - | False | 🔶 | 🟡 |

#### Tab 4: Gallery

Similar a Services — grid de imágenes hasta 4.

#### Tab 5: Settings

Probablemente contiene opciones avanzadas (TBD — no explorado completamente).

---



---

## TAB 3: Resources List View

### Overview

La pestaña **Resources** muestra los recursos compartidos necesarios para cumplir servicios (ej: "Yoga mats", "Studio Room 1", "Whiteboard"). Cada recurso tiene una cantidad y puede ser compartido (shared across all services) o específico (per service/per location).

### Controles Superiores

| Control | Tipo | Opciones/Valores | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Search Box** | Input text | Buscar por: nombre recurso | - | 🔶 | 🟡 |
| **+ Resource** | Botón primario | Abre modal New Resource | - | 🔶 | 🟡 |

### Tabla Resources (si hay items)

| Columna | Tipo | Contenido | Acciones | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **NAME** | Texto | Nombre recurso (ej: "Studio Room 1") | Click abre modal Edit | 🔶 | 🟡 |
| **QUANTITY** | Número | Cantidad disponible (ej: 2) | - | 🔶 | 🟡 |
| **TYPE** | Badge | "Shared", "Per Service", "Per Location" | - | 🔶 | 🟡 |
| **ACTIONS** | Menú | Edit, Delete | ⋯ menu | 🔶 | 🟡 |

### Modal: New / Edit Resource

#### Tab 1: Details

| Campo | Tipo | Opciones/Valores | Validación | Default | Estado SaaS | Prioridad |
|---|---|---|---|---|---|
| **Name** | Input text | Nombre recurso | Required | - | 🔶 | 🟡 |
| **Quantity** | Spinner | Número (1-9999) | Required, ≥1 | 1 | 🔶 | 🟡 |
| **Enable resource usage for a group booking** | Toggle | ☑ / ☐ | - | False | 🔶 | 🟡 |
| **Quantity is shared** (radio option) | Radio button | ☑ Compartido para todos (con dropdowns) | - | Selected | 🔶 | 🟡 |
| **(si Shared) Services** | Dropdown | "All services" (default) | - | All services | 🔶 | 🟡 |
| **(si Shared) Locations** | Dropdown | "All locations" (default) | - | All locations | 🔶 | 🟡 |
| **(si Shared) Employees** | Dropdown | "All employees" (default) | - | All employees | 🔶 | 🟡 |
| **Quantity per service** (radio option) | Radio button | ☐ Cantidad diferente por servicio | - | Not selected | 🔶 | 🟡 |
| **Quantity per location** (radio option) | Radio button | ☐ Cantidad diferente por ubicación | - | Not selected | 🔶 | 🟡 |

#### Tab 2: Tips & suggestions

Sección informativa (descripción, ayuda, documentación interna).

---

## Resumen Actualizado de Brechas Críticas

### Prioridad Roja (🔴)

1. **Packages Modal Structure** — NO DOCUMENTADO. Requiere exploración: servicios incluidos, duración, validaciones.
2. **Resources Modal Structure** — PARCIALMENTE documentado. Requiere verificar si hay tabs adicionales, dependencias service/location.

### Prioridad Amarilla (🟡)

1. **Service-Employee Model** — ADR-0016 indica cambio pendiente de modelo.
2. **Buffer Time (before/after)** — Confirmar mecánica exacta.
3. **Group Booking en Packages** — ¿Cómo se maneja?
4. **Resource Allocation Logic** — Cómo se valida cantidad compartida vs específica.
5. **Package Deletion Policy** — Soft vs hard delete, impacto en reservas.

### Notas de Implementación

- **Resources** son un componente avanzado (probablemente necesario solo en SaaS con high-concurrency).
- El selector de **"Quantity is shared" vs "per service" vs "per location"** es mutuamente excluyente (radio buttons).
- **Packages** necesitan validación: si servicio A de duración 1h + servicio B duración 1.5h = paquete total 2.5h.
- **Categories** pueden aplicarse a Services pero probablemente NO a Packages.
