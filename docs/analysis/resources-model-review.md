# Informe: Modelo de Recursos y su relación con Proveedores

Fecha: 2026-06-16
Autor: análisis de agente sobre el código y las specs (`specs/001-saas-multitenant-booking/`)
Estado: informe de análisis — **no se ha modificado código**

---

## 1. Resumen ejecutivo (TL;DR)

Tu intuición es correcta en lo importante y conviene matizarla:

1. **Los recursos SÍ existen y están completos en el backend.** El modelo de "activo físico limitado con cantidad" (salas, boxes, sillones, máquinas) está implementado en dominio, aplicación, motor de disponibilidad, checkout y persistencia (PostgreSQL/RLS). Tu ejemplo "4 terapeutas pero solo 2 salas" **ya está resuelto y probado** a nivel de motor.

2. **Lo que falta es la UI**: no hay entrada "Recursos" en el menú ni pantalla para gestionarlos. Por eso "no los ves". Es una brecha de interfaz, no de lógica.

3. **Tu petición concreta —"recursos asignados a proveedores"— NO está modelada, y además difiere de lo que dice el spec.** El spec asigna recursos **por servicio (y por ubicación)**, no por proveedor. Son dos modelos de negocio distintos; ambos son legítimos pero capturan realidades diferentes. Esto merece una decisión explícita antes de construir nada (ver §4 y §6).

4. **La entidad "Ubicación" (multi-sede) está en el spec pero NO está implementada.** El data-model define `Resource.scope` y `Resource.location_id`, y el spec menciona "ubicaciones" en US1 y en la entidad Service/Resource, pero no existe ninguna entidad, tabla ni ruta de Location. Brecha real respecto al spec.

---

## 2. Qué existe hoy (verificado en código)

### 2.1 Entidad Resource

`packages/domain/src/catalog/service.ts`:

```ts
export interface Resource {
  id: string;
  tenantId: string;
  name: string;
  quantity: number;   // nº de unidades idénticas (p.ej. 2 salas)
  status: CatalogStatus;
}

export interface ServiceResource {  // demanda de un servicio sobre un recurso
  tenantId: string;
  serviceId: string;
  resourceId: string;
  units: number;       // unidades que consume cada reserva de ese servicio
}
```

### 2.2 El motor de disponibilidad respeta la capacidad

`services/api/src/application/scheduling/availability-engine.ts`:

```ts
function resourcesAvailable(occupied, demands) {
  return demands.every((demand) => {
    const unitsInUse = demand.existingAllocations
      .filter((a) => intervalsOverlap(occupied, a))
      .reduce((sum, a) => sum + a.units, 0);
    return unitsInUse + demand.unitsRequired <= demand.resourceQuantity;
  });
}
```

Es decir: un slot solo se ofrece si `(unidades ya ocupadas en ese intervalo) + (unidades que pide la reserva) <= (cantidad total del recurso)`.

### 2.3 El checkout reserva y libera recursos

`services/api/src/api/checkout-routes.ts`:
- Antes de cobrar adquiere **locks** del proveedor **y de cada recurso** demandado.
- Al aprobarse el pago, `recordBookingOccupancy(...)` persiste la asignación de recursos.
- Al cancelar, `releaseBookingOccupancy(...)` libera proveedor y recursos.

### 2.4 Persistido en PostgreSQL con RLS

`packages/persistence/src/schema.ts` define las tablas `resources`, `service_resources` y `resource_allocations`. No es solo en memoria.

### 2.5 Cobertura de spec y tests

- **FR-008**: "calcular disponibilidad combinando horarios, buffers, extras, **recursos**, busy events, capacidad, locks y políticas." → cumplido.
- **US1, escenario 3** (`spec.md`): dos servicios que comparten un recurso de cantidad 1; al bloquear uno, el otro no puede usarlo en ese intervalo. → implementado y validado en `quickstart.md`.

---

## 3. Tu ejemplo: "4 terapeutas, 2 salas"

Hoy esto se modela así:

1. Creas un recurso **"Sala de terapia"** con `quantity = 2`.
2. El servicio **"Terapia"** declara `ServiceResource { resourceId: salaTerapia, units: 1 }`.
3. Tienes 4 proveedores (terapeutas) activos asignados al servicio.

Resultado: aunque haya 4 terapeutas libres a las 10:00, el motor **solo ofrece 2 slots simultáneos** a las 10:00, porque a la tercera reserva `unitsInUse(2) + 1 > quantity(2)`. **El cuello de botella de las salas se respeta correctamente.**

> Conclusión: el caso que te preocupa **ya funciona** — pero por la vía *recurso↔servicio*, no *recurso↔proveedor*.

---

## 4. La distinción clave: recurso↔servicio vs recurso↔proveedor

Tu frase fue "recursos… asignados a los proveedores". El sistema actual los asigna **a los servicios**. No es lo mismo y conviene decidirlo a conciencia:

| Modelo | Significado | ¿Implementado? | Cuándo es el correcto |
|---|---|---|---|
| **Recurso ↔ Servicio** (actual, y lo que dice el spec) | "El servicio Masaje consume 1 unidad del pool de Salas (2)." Cualquier reserva de ese servicio compite por el pool. | Sí | Recursos **compartidos como pool**: salas, boxes, sillones, máquinas que cualquier profesional puede usar. |
| **Recurso ↔ Proveedor** (tu petición) | "La terapeuta Ana usa específicamente la Sala A." El recurso queda ligado a una persona. | No | Recursos **dedicados** a un profesional, o **elegibilidad** (qué unidades puede usar cada proveedor). |

En la práctica, muchos negocios necesitan una **combinación**: el *servicio* exige un *tipo* de recurso (grupo/pool), y al reservar se asigna *cualquier unidad libre* de ese grupo, **opcionalmente filtrada** por qué unidades puede usar el proveedor elegido. El modelo actual cubre la primera mitad (pool por servicio) pero **no** la elegibilidad por proveedor.

Ejemplos para decidir:
- **Peluquería**: 4 peluqueros, 3 sillones cualquiera-sirve → *recurso↔servicio* basta (lo actual).
- **Clínica con salas dedicadas**: la Dra. X solo opera en el Quirófano 1 → necesitas *recurso↔proveedor* (elegibilidad).
- **Multi-sede**: el recurso "Sala" existe en la sede A y en la B, y el proveedor trabaja en una sede → necesitas **Ubicación** (no implementada) + elegibilidad.

---

## 5. Brechas identificadas (resumen)

| # | Brecha | Severidad | Origen |
|---|---|---|---|
| **B1** | **No hay UI de Recursos** (ni entrada de menú ni pantalla CRUD ni asignación servicio↔recurso). | Alta (operativa) | UI nunca construida |
| **B2** | **No existe relación Proveedor↔Recurso** (ni elegibilidad ni recurso dedicado). | Media–Alta (depende del negocio) | Fuera del modelo actual y del spec |
| **B3** | **No existe entidad Ubicación/Location** pese a estar en el spec (US1, `Service`, `Resource.location_id`, `Resource.scope`). Multi-sede no modelado. | Media | Divergencia respecto al spec |
| **B4** | Campos `scope` y `location_id` del data-model **no implementados** en el dominio `Resource`. | Baja | Divergencia data-model ↔ código |
| **B5** | Los recursos no se exponen en el flujo de alta rápida (`/settings` actual) ni en Servicios. | Baja | UI parcial |

Notas:
- B1 es la causa de que "no los veas". Es puramente de interfaz; el backend está listo.
- B2 y B3 son **decisiones de producto**, no bugs. El spec deliberadamente puso recursos "por servicio/ubicación" y dejó la asignación backend-only ("resource allocation is backend-only and not customer-selectable"). Cambiar a "por proveedor" amplía el spec.

---

## 6. Opciones de modelado (recomendación)

Si confirmas que necesitas el comportamiento "recurso ligado a proveedor", hay tres niveles de ambición:

### Opción A — Mínima (solo cerrar B1): UI sobre el modelo actual
- Construir pantalla **Recursos** (CRUD de recurso + cantidad) y la asignación **Servicio↔Recurso** (units).
- No toca el dominio. Resuelve "4 terapeutas / 2 salas" hoy mismo y lo hace visible/configurable.
- **No** cubre recurso dedicado a un proveedor concreto.

### Opción B — Recomendada: grupos de recurso + elegibilidad por proveedor
- Mantener `Resource` (pool con cantidad) y `ServiceResource` (qué exige el servicio).
- Añadir **`ProviderResource`** (qué unidades/recursos puede usar cada proveedor) y, en el motor, filtrar la disponibilidad por la intersección *recurso exigido por el servicio* ∩ *recurso elegible por el proveedor*.
- Cubre tanto el pool compartido como la dedicación/elegibilidad. Es el modelo más cercano a la realidad de clínicas y centros con salas/equipos específicos.
- Coste: cambio en dominio, motor de disponibilidad, checkout (locks), persistencia y UI.

### Opción C — Completa: Ubicaciones + recursos + elegibilidad (alinear 100% con spec)
- Añadir entidad **Location** (sede), ligar `Resource.location_id` y `Service`/`Provider` a ubicaciones, y combinar con la elegibilidad de la Opción B.
- Es el modelo "enterprise" multi-sede que el spec insinúa. Mayor alcance; recomendable solo si multi-sede es un requisito real a corto plazo.

**Recomendación:** decidir entre **A** y **B** según si "recurso dedicado a un profesional" es un caso real de tus clientes objetivo. Si tu vertical son clínicas/centros de terapia (como sugiere tu ejemplo), **B** es la correcta. Dejar **C** (ubicaciones) para una fase posterior salvo que multi-sede sea inmediato.

---

## 7. Impacto en el roadmap de UI

- La pantalla **Recursos** debería existir como área propia en el menú (sección "Catálogo", junto a Servicios y Proveedores).
- La pantalla **Proveedores** que íbamos a construir **debería esperar a esta decisión**: si elegimos la Opción B, Proveedores incluirá un bloque "Recursos elegibles", lo que cambia su diseño.
- La pantalla **Servicios** actual debería ampliarse para declarar qué recursos exige (`ServiceResource`).
- Cuando conectemos al backend real, los endpoints de recurso ya existen parcialmente (`POST /v1/admin/resources`, `POST /v1/admin/services/:id/resources`); faltarían los **GET de listado** (como en el resto de áreas).

---

## 8. Decisiones que necesito de ti

1. **¿Modelo de recursos por servicio (A) o por servicio + elegibilidad por proveedor (B)?** (o C si multi-sede es inmediato)
2. **¿Multi-sede (Ubicaciones) entra en el alcance ahora o se aplaza?**
3. Según 1 y 2, reordenamos: probablemente **Recursos** pasa por delante de **Proveedores** en la cola de UI.
