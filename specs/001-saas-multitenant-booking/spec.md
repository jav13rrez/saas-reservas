# Feature Specification: SaaS multitenant de reservas inspirado en Amelia Premium para multiples verticales

**Feature Branch**: `001-saas-multitenant-booking`

**Created**: 2026-06-09

**Status**: Draft

**Input**: User description: "Crear una base de producto y arquitectura para un SaaS multitenant de reservas inspirado en Amelia Premium, enriquecida con el documento SaaS Multitenant_ Amelia Booking Analysis.md y desacoplada de WordPress."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tenant publica una operacion reservable completa (Priority: P1)

Como tenant admin, quiero crear la cuenta corporativa, configurar marca/dominio, categorias, servicios, providers, ubicaciones, recursos, horarios, descansos, festivos, buffers, extras y politicas de cancelacion/reprogramacion para publicar una experiencia de reservas real.

**Why this priority**: Es la base de cualquier vertical. Sin tenant, catalogo, providers, recursos y disponibilidad no hay inventario vendible ni motor de reservas.

**Independent Test**: Crear un tenant con subdominio, un provider, un servicio con buffers, un recurso limitado y un horario semanal. Verificar que el frontend publico muestra slots correctos, omite seleccion de provider cuando solo hay uno y bloquea slots cuando el recurso no esta disponible.

**Acceptance Scenarios**:

1. **Given** un tenant nuevo, **When** el admin configura un servicio con provider, duracion, precio, buffers y horario, **Then** el sistema expone disponibilidad solo dentro de las reglas configuradas.
2. **Given** un tenant con un unico provider activo asignado al servicio, **When** un cliente abre el widget de reserva, **Then** el paso de seleccion de provider se omite.
3. **Given** dos servicios que comparten un recurso con cantidad `1`, **When** un cliente bloquea provisionalmente un slot para uno de ellos, **Then** el otro servicio no puede reservar ese mismo recurso durante la duracion total del slot.

---

### User Story 2 - Cliente reserva, paga y recibe confirmacion transaccional (Priority: P2)

Como cliente final, quiero reservar uno o varios servicios, seleccionar extras, aplicar cupones o paquetes, pagar online o registrar pago presencial, y recibir confirmacion con el estado correcto.

**Why this priority**: Convierte el catalogo en ingresos y exige resolver las reglas centrales de Amelia Premium: carrito, extras, depositos, pagos, aprobacion, estados y notificaciones.

**Independent Test**: Ejecutar una compra de carrito con dos reservas, extras, deposito parcial y pago Stripe/PayPal simulado. Verificar bloqueos Redis, reservas `Pending`, subpagos por reserva, aprobacion tras webhook y liberacion de locks ante fallo.

**Acceptance Scenarios**:

1. **Given** un cliente selecciona servicio, extra y numero de asistentes, **When** el sistema calcula precio y duracion, **Then** aplica `duracion_total = servicio + extras + buffer_before + buffer_after` y precio segun servicio, extras, personas, cupones e impuestos.
2. **Given** un carrito con multiples reservas pagado en una transaccion padre, **When** una reserva individual se cancela, **Then** el sistema calcula y ejecuta reembolso parcial solo del subpago asociado a esa reserva.
3. **Given** un pago declinado o expirado, **When** el TTL del lock termina, **Then** el slot vuelve a estar disponible y la reserva queda rechazada o expirada con auditoria.

---

### User Story 3 - Staff y clientes gestionan cambios con politicas y privacidad (Priority: P3)

Como provider o cliente, quiero cancelar, reprogramar, consultar mi panel y ejercer derechos de privacidad bajo politicas del tenant sin romper calendarios, pagos ni auditoria.

**Why this priority**: La operacion real empieza despues de confirmar una reserva. Cancelaciones, reprogramaciones, reembolsos, customer panel, employee panel y GDPR definen confianza y soporte.

**Independent Test**: Crear una reserva aprobada, intentar cancelar antes y despues del umbral minimo, reprogramar a un slot con conflicto, ejecutar anonimizado GDPR y verificar que calendarios, pagos, notificaciones y auditoria quedan consistentes.

**Acceptance Scenarios**:

1. **Given** una politica de cancelacion minima, **When** un cliente intenta cancelar fuera del plazo permitido, **Then** el sistema rechaza la operacion sin modificar reserva, pago ni calendario.
2. **Given** una reserva aprobada con pago online, **When** el cliente cancela dentro de plazo, **Then** el sistema cancela la reserva, elimina o actualiza evento externo, procesa reembolso segun politica y emite eventos/notificaciones.
3. **Given** un cliente solicita eliminacion GDPR, **When** la accion se confirma, **Then** se anonimizan datos personales en perfil y reservas pasadas preservando metricas no identificables.

---

### User Story 4 - Tenant vende eventos, tickets, recurrencias y lista de espera (Priority: P4)

Como tenant admin, quiero crear eventos independientes de providers, configurar capacidad, tickets, precios dinamicos, recurrencia, lista de espera y reglas de propagacion para operar talleres, clases, seminarios o actividades grupales.

**Why this priority**: Amelia Premium no solo vende citas; eventos y tickets amplian el producto a verticales con cupos, recurrencia y venta anticipada.

**Independent Test**: Crear evento recurrente con tickets General/VIP, capacidad compartida, early-bird pricing y waitlist. Agotar capacidad, cancelar un ticket y verificar token temporal para el primer candidato de la lista.

**Acceptance Scenarios**:

1. **Given** un evento con capacidad total y ticket categories, **When** la venta alcanza el limite, **Then** el sistema bloquea compra directa y activa la lista de espera.
2. **Given** un attendee cancela, **When** se libera capacidad, **Then** el sistema protege la plaza para la lista de espera, genera token TTL y promueve al candidato con mayor prioridad.
3. **Given** una serie recurrente, **When** el admin edita `This only` o `This & future`, **Then** el sistema modifica solo el evento actual o propaga cambios a instancias futuras de forma transaccional.

---

### User Story 5 - Integraciones premium operan de forma segura y escalable (Priority: P5)

Como tenant premium, quiero conectar pagos, calendarios, videollamadas, WhatsApp, email, SMS, webhooks, almacenamiento y OAuth propio para automatizar la operacion sin mezclar credenciales ni cuotas con otros tenants.

**Why this priority**: Es la diferencia entre una agenda basica y un SaaS premium. Tambien mitiga brechas documentadas de Amelia sobre OAuth, sincronizacion bidireccional, WhatsApp, archivos y pagos.

**Independent Test**: Conectar Stripe Connect o credenciales directas, OAuth de calendario en modo plataforma y modo tenant, WhatsApp Cloud API con health check, webhook de calendario externo y subida de archivo con escaneo.

**Acceptance Scenarios**:

1. **Given** un provider conecta Google/Outlook, **When** se crea o modifica una reserva, **Then** el sistema sincroniza evento externo y mantiene mapping `externalId`.
2. **Given** un empleado modifica una cita desde Google/Outlook, **When** el webhook externo llega al SaaS, **Then** el backend valida el evento, actualiza la reserva local y notifica al cliente.
3. **Given** un tenant configura WhatsApp Cloud API, **When** se guardan credenciales, **Then** el sistema valida permisos antes de activar plantillas y mapeo de placeholders.

## Edge Cases

- Reserva simultanea del mismo provider/recurso/slot por varios clientes en milisegundos.
- Reembolso parcial de una reserva dentro de un carrito con deposito y otras reservas activas.
- Expiracion de token de customer panel o intento de reutilizacion del enlace passwordless.
- Evento externo editado directamente en calendario del provider sin pasar por el SaaS.
- Recurrent booking con una o varias ocurrencias en festivos, vacaciones, busy events o falta de recurso.
- Evento recurrente editado parcialmente con asistentes ya registrados.
- Archivo adjunto con extension valida pero MIME real peligroso.
- Tenant con dominio personalizado mal configurado o CNAME apuntando a tenant incorrecto.
- Fallo de webhook de pago despues de reserva `Pending` y lock Redis expirado.
- Tenant corporativo que supera cuotas OAuth de la app compartida.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST usar `Tenant` como entidad raiz con `tenant_id` en toda tabla de negocio tenant-owned.
- **FR-002**: El sistema MUST usar PostgreSQL RLS con parametro de sesion `app.current_tenant_id` para bloquear lecturas/escrituras cross-tenant.
- **FR-003**: El sistema MUST resolver tenant por subdominio, dominio personalizado o contexto autenticado, y cargar branding, zona horaria, idioma, politicas e integraciones del tenant.
- **FR-004**: El sistema MUST modelar providers con email unico por tenant, horarios, descansos, dias libres, dias especiales, permisos y calendario externo.
- **FR-005**: El sistema MUST impedir reservas de servicios basados en citas si no hay al menos un provider activo asignado.
- **FR-006**: El sistema MUST modelar categorias, servicios, extras, paquetes, cupones, impuestos, capacidad minima/maxima, buffers y reglas de precio.
- **FR-007**: El sistema MUST ocultar extras y forzar duracion base cuando una reserva se agenda dentro de un paquete si asi lo define la regla de paquetes heredada de Amelia.
- **FR-008**: El sistema MUST calcular disponibilidad combinando horarios del provider, buffers, extras, recursos, busy events externos, capacidad, locks Redis y politicas de ventana de reserva.
- **FR-009**: El sistema MUST crear locks Redis con namespace tenant y TTL configurable, por defecto 10 minutos, antes de iniciar checkout de pago.
- **FR-010**: El sistema MUST registrar reservas como `Pending` antes del pago y aprobarlas solo tras confirmacion fiable de gateway o politica tenant.
- **FR-011**: El sistema MUST soportar Stripe/PayPal direct checkout con credenciales tenant encriptadas y Stripe Connect-style platform routing con application fees.
- **FR-012**: El sistema MUST soportar transacciones padre de carrito y subpagos por booking para conciliacion y reembolsos parciales.
- **FR-013**: El sistema MUST emitir eventos y notificaciones para booking added, canceled, rescheduled, approved, rejected, payment captured, refunded y failed.
- **FR-014**: El sistema MUST soportar staff panel con gestion de calendario, dias libres, clientes y reprogramacion segun permisos.
- **FR-015**: El sistema MUST soportar customer panel con acceso passwordless mediante JWT asimetrico, nonce de un solo uso, TTL de 15 minutos y cookie segura.
- **FR-016**: El sistema MUST aplicar politicas de tiempo minimo antes de cancelar o reprogramar y mantener auditoria de decisiones rechazadas.
- **FR-017**: El sistema MUST anonimizar datos personales de clientes bajo flujo GDPR conservando registros no identificables para metricas y facturacion.
- **FR-018**: El sistema MUST modelar eventos con capacidad total, tickets, precios por ticket, early-bird pricing, limite de asistentes adicionales y cierre por minimo de capacidad.
- **FR-019**: El sistema MUST implementar lista de espera con prioridad calculada, token temporal, TTL configurable, expiracion y promocion automatica.
- **FR-020**: El sistema MUST diferenciar recurrent appointments de recurrent events: las citas recurrentes pertenecen a una serie de cliente; cada evento recurrente genera entidad independiente.
- **FR-021**: El sistema MUST soportar resolucion de conflictos recurrentes mediante `suggest closest available date` y `omit conflicting occurrence`.
- **FR-022**: El sistema MUST soportar edicion de eventos recurrentes con alcance `this only` y `this & future`.
- **FR-023**: El sistema MUST soportar calendario Google/Outlook bidireccional con OAuth plataforma y OAuth corporativo por tenant.
- **FR-024**: El sistema MUST procesar webhooks externos de calendario para reflejar cambios hechos fuera del SaaS.
- **FR-025**: El sistema MUST soportar videomeetings generadas automaticamente mediante providers como Meet, Zoom o Teams segun integracion.
- **FR-026**: El sistema MUST integrar WhatsApp Cloud API por tenant con Phone Number ID, Permanent Access Token, WABA ID, health check y mapeo de templates.
- **FR-027**: El sistema MUST usar almacenamiento de archivos por ruta `tenants/{tenant_id}/...` con URLs firmadas de TTL corto.
- **FR-028**: El sistema MUST validar uploads por MIME real, extension permitida, tamano, cuota tenant y escaneo antivirus antes de persistir.
- **FR-029**: El sistema MUST aislar Redis keys bajo prefijos `tenant:{tenant_id}:...`.
- **FR-030**: El sistema MUST exponer API para admin tenant, staff, cliente, booking publico, webhooks externos e integraciones.

### Key Entities

- **Tenant**: Cuenta corporativa SaaS con marca, subdominio, dominios personalizados, zona horaria, idioma, politicas, plan, limites y configuracion global.
- **TenantDomain**: Subdominio o dominio personalizado que enruta hacia un tenant y puede requerir verificacion DNS/CNAME.
- **Provider**: Empleado o recurso humano asignable a servicios, con identidad, permisos, calendario, horarios, excepciones y credenciales externas.
- **ProviderSchedule**: Horarios, descansos, festivos, dias libres, dias especiales y ventanas reservables.
- **Category**: Agrupador tenant-scoped de servicios.
- **Service**: Oferta reservable con duracion base, precio, buffers, capacidad, providers, ubicaciones, recursos, extras y reglas.
- **Extra**: Complemento opcional que puede sumar coste y duracion, con regla de multiplicacion por personas cuando aplique.
- **Package**: Producto comercial que agrupa multiples citas, servicios y reglas de expiracion, precio y duracion.
- **Coupon**: Descuento con alcance, limites, fechas, reglas de uso y aplicabilidad.
- **Resource**: Activo fisico limitado con cantidad, asignacion por servicio/ubicacion y reglas de disponibilidad backend-only.
- **Customer**: Cliente final tenant-scoped con datos personales, campos personalizados, consentimiento, historial y estado GDPR.
- **CustomField**: Campo tenant/vertical configurable, incluyendo attachments validados y persistidos en storage aislado.
- **Booking**: Reserva transaccional de servicio o evento con estado, asignaciones, duracion, precio, pagos, auditoria y external mappings.
- **CartTransaction**: Transaccion padre para multiples bookings con subpagos conciliables.
- **PaymentTransaction**: Pago, deposito, reembolso o saldo ligado a booking/cart/gateway.
- **Event**: Actividad grupal independiente con recurrencia opcional, capacidad, tickets, asistentes y reglas de venta.
- **TicketType**: Categoria de ticket con precio, capacidad individual o compartida y reglas dinamicas.
- **WaitlistEntry**: Registro de espera con prioridad, estado, token temporal y expiracion.
- **IntegrationConnection**: Credenciales y estado de proveedor externo por tenant o provider.
- **ExternalCalendarMapping**: Relacion entre reserva/evento SaaS y evento externo Google/Outlook.
- **NotificationTemplate**: Plantilla tenant-scoped por canal con placeholders y mappings.
- **NotificationJob**: Trabajo inmediato o programado con canal, destinatario, payload, estado y reintentos.
- **AuditEvent**: Registro inmutable de acciones, estados, integraciones y decisiones de seguridad.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un tenant puede publicar un servicio reservable con provider, recurso y branding en menos de 30 minutos.
- **SC-002**: El sistema impide doble reserva de provider/recurso en el 100% de pruebas de concurrencia definidas.
- **SC-003**: Una reserva con pago online pasa por `Pending -> Approved` solo tras confirmacion de gateway o politica explicita.
- **SC-004**: El 100% de tablas tenant-owned incluidas en el MVP tienen `tenant_id`, indice correspondiente y politica RLS.
- **SC-005**: El 95% de webhooks externos se procesan idempotentemente con estado final observable.
- **SC-006**: La lista de espera promueve plazas liberadas respetando prioridad y TTL en todas las pruebas de evento.
- **SC-007**: Las pruebas de GDPR verifican que datos personales quedan anonimizados sin perder metricas no identificables.
- **SC-008**: Las credenciales de pago, OAuth y WhatsApp nunca aparecen en logs, respuestas API ni eventos de auditoria en claro.

## Assumptions

- El MVP sera una web app SaaS con API backend, workers y almacenamiento cloud; apps nativas quedan fuera de la primera iteracion.
- La estrategia v1 de tenancy queda decidida como PostgreSQL compartido con RLS, Redis namespacing y storage por prefijo tenant.
- La primera arquitectura sera modular monolith; los workers pueden separarse operacionalmente sin partir el dominio.
- Stripe Connect sera la opcion preferida para monetizacion de plataforma, con direct checkout como soporte para tenants que gestionen credenciales propias.
- Los calendarios soportados inicialmente seran Google Calendar y Outlook/Microsoft Graph.
- WhatsApp se implementara mediante Meta WhatsApp Business Cloud API, no mediante proveedores intermedios.
- El producto toma Amelia Premium como referencia funcional, no como codigo ni arquitectura a copiar.
