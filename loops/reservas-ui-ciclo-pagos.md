# Loop: reservas-ui-ciclo-pagos (T012/T013, feature 004)

> Generado por la skill `crear-loop` el 2026-07-01. Fuente: `HANDOFF.md` (sección
> "Empieza por aquí"), `specs/004-reservas-ciclo-estados-pagos/tasks.md` (Fase 5,
> T012/T013) y `spec.md`, más investigación directa del código de
> `apps/admin` (seam demo/api, demo-store, ausencia de tests de UI). Decisión del
> usuario: el VERIFY se apoya en tests de lógica (seam + demo-store), no en tests
> de componente React.

## GOAL

La pantalla Reservas de `apps/admin` (ambos modos, `demo` y `api`) soporta el
ciclo de 6 estados del dominio (`pending`, `approved`, `rejected`, `canceled`,
`completed`, `no_show`) con acciones por fila (Aprobar/Rechazar/Completar/No-show)
que respetan las transiciones válidas del backend, y una sección de pago manual
(método/estado/importe/depósito/referencia/notas) editable y persistente — y todo
el gate del proyecto (`typecheck`, `lint`, `format:check`, `test`, build de
`apps/admin`) pasa en verde, incluyendo tests nuevos que cubren el mapeo de
estados, las transiciones válidas/inválidas y el alta/lectura del pago manual.

## CONTEXTO QUE EL AGENTE DEBE LEER ANTES DE EMPEZAR

- `HANDOFF.md` — punto de reanudación; confirma que el backend de la feature 004
  está completo y que T012/T013 es la UI pendiente.
- `specs/004-reservas-ciclo-estados-pagos/spec.md` — clarificaciones ya resueltas
  (no hay decisiones de producto abiertas): estados terminales, cuándo se crea
  Pending vs Approved, pago único por reserva, sin gate de tiempo.
- `specs/004-reservas-ciclo-estados-pagos/tasks.md` — Fase 5 (T012, T013) es el
  alcance exacto de este loop. No toques nada de las Fases 1-4 (backend, ya
  cerrado) ni la Fase 6 (Polish, ya cerrada).
- `packages/domain/src/bookings/booking.ts` — `BookingStatus` y `TRANSITIONS`
  reales (fuente de verdad de qué transición es válida).
- `packages/domain/src/payments/manual-payment.ts` — tipos y validación del pago
  manual.
- `services/api/src/...` rutas ya existentes: `POST /v1/admin/bookings/:id/{approve,reject,complete,no-show}`
  y `GET`/`PUT /v1/admin/bookings/:id/payment` (usa estas rutas tal cual desde el
  modo `api` del seam; no las modifiques).
- `apps/admin/src/server/source/bookings.ts` — seam actual; el mapeo de línea
  ~87 (`status: booking.status === "approved" ? "confirmed" : "cancelled"`) es el
  punto exacto que hay que reescribir para pasar los 6 estados reales.
- `apps/admin/src/server/source/settings.ts` + `apps/admin/app/api/settings/route.ts`
  — patrón de referencia limpio del seam demo/api (3 capas: demo-store → source →
  route handler) a replicar para las nuevas acciones y para `booking-payment.ts`.
- `apps/admin/src/server/demo-store.ts` — modelo actual de 2 estados
  (`confirmed`/`cancelled`, líneas ~118, ~131, ~993) y el cálculo de ocupación
  (`unitsInUse`/`providerBusy`, líneas ~877 y ~890) que hoy usa
  `status !== "confirmed"`.
- `apps/admin/src/features/bookings/index.tsx` — componente de la pantalla,
  incluida la interfaz `AdminBooking` duplicada (línea ~46) y el cálculo de color
  de badge (líneas ~344-348).
- `docs/design-system.md` (ADR-0008) — reglas duras: tokens de `packages/ui`,
  iconos solo `lucide-react`, sin emojis en UI de producto.
- `vitest.config.ts` — proyecto `unit` cubre `tests/unit/**` y
  `packages/*/src/**`; **no** cubre `apps/admin` todavía. Primer paso del loop:
  añadir `apps/admin/src/**/*.test.ts` al `include` del proyecto `unit`.
- No hace falta ninguna credencial nueva: todo el trabajo es local (demo-store)
  o contra rutas de `services/api` que ya existen y ya están probadas.

## REGLAS DE NEGOCIO YA DECIDIDAS (no re-preguntar, solo aplicar)

- Ocupación de slot en el demo-store: se libera al pasar a `rejected` o
  `canceled`; se mantiene ocupado en `pending`, `approved`, `completed` y
  `no_show` (igual que ya hace el backend real: "reject frees occupancy;
  approve/complete/no-show do not").
- Alta de reserva en el demo-store debe respetar `requiresApproval` del tenant
  (igual que `AdminBookingService.createBooking` real): si está activo, crea en
  `pending`; si no, en `approved`. Lee el flag vía el seam de settings ya
  existente (`source/settings.ts`), no inventes una fuente nueva.
- Paleta de badges por estado (tokens de `packages/ui`, sin hardcodear hex):
  `pending` = warning, `approved` = success, `completed` = tono neutro/primario
  de éxito (distínguelo visualmente de `approved`, p. ej. con un icono de check
  doble o el token "info"), `rejected`/`canceled`/`no_show` = danger o
  texto-muted (usa danger para rejected/no_show, muted para canceled, ya que
  canceled no es un fallo sino una decisión del cliente/staff). Sé consistente
  y documenta la elección en el propio código con un comentario corto si no es
  obvia.

## CADA ITERACIÓN

1. Lee `loops/reservas-ui-ciclo-pagos.state.md` (créalo si no existe) para saber
   qué sub-tarea sigue y qué falló en el intento anterior.
2. Ejecuta la siguiente sub-tarea pendiente, en este orden si empiezas de cero:
   a. Añadir `apps/admin/src/**/*.test.ts` al `include` del proyecto `unit` en
      `vitest.config.ts`.
   b. Extender `BookingStatus` a los 6 estados en `demo-store.ts` (tipo,
      creación respetando `requiresApproval`, cálculo de ocupación) y en la
      interfaz `AdminBooking` de `features/bookings/index.tsx` (o eliminar la
      duplicación importando el tipo del store/seam si es más simple).
   c. Reescribir el mapeo de `source/bookings.ts` para pasar los 6 estados sin
      colapsar, y añadir las funciones de transición
      (`approveBooking`/`rejectBooking`/`completeBooking`/`noShowBooking`) que
      en modo `demo` mutan el store validando contra `TRANSITIONS` de
      `packages/domain`, y en modo `api` llaman a las rutas
      `POST /v1/admin/bookings/:id/{approve,reject,complete,no-show}`.
   d. Añadir `apps/admin/app/api/bookings/[id]/{approve,reject,complete,no-show}/route.ts`
      (Next route handlers finos, mismo patrón que `[id]/route.ts` existente).
   e. Añadir `source/booking-payment.ts` (get/upsert, demo llama al store, api
      llama a `GET`/`PUT /v1/admin/bookings/:id/payment`), extender
      `demo-store.ts` con almacenamiento de pago por reserva, y añadir
      `app/api/bookings/[id]/payment/route.ts`.
   f. UI: botones de acción por fila (solo las transiciones válidas desde el
      estado actual, deshabilita o esconde el resto) y sección de Payment
      (formulario método/estado/importe/depósito/referencia/notas) en
      `features/bookings/index.tsx`, usando iconos `lucide-react` y tokens de
      `packages/ui` únicamente.
   g. Tests unitarios (`apps/admin/src/**/*.test.ts`): mapeo de 6 estados sin
      colapso, transición inválida rechazada (espeja `TRANSITIONS` del
      dominio), ocupación correcta tras cada transición, upsert/get de pago
      manual (incluye validación de depósito ≤ importe).
3. Ejecuta VERIFY.
4. Si falla: anota en el archivo de estado qué falló y por qué (mensaje de error
   real, no una suposición), corrige solo eso, vuelve a VERIFY. No avances a la
   siguiente sub-tarea de la lista hasta que la actual pase su parte del gate.
5. Si pasa: marca la sub-tarea como hecha en el archivo de estado y pasa a la
   siguiente. Cuando las 7 (a-g) estén hechas y VERIFY completo pase, el loop ha
   terminado con éxito.

## VERIFY

Todo lo siguiente debe terminar en verde, en este orden:

```
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm --filter @saas-reservas/admin build
```

Adicionalmente, `pnpm test` debe incluir al menos un archivo bajo
`apps/admin/src/**/*.test.ts` que cubra: (1) mapeo de los 6 estados sin colapso
a 2, (2) al menos una transición inválida rechazada, (3) upsert + lectura de un
pago manual con depósito ≤ importe aceptado y depósito > importe rechazado.

## STOP WHEN

- Éxito: VERIFY pasa completo, con los tests nuevos presentes y en verde.
- Límite duro: 8 iteraciones fallidas consecutivas del mismo sub-paso, o si el
  loop lleva más de 90 minutos de ejecución acumulada sin pasar VERIFY completo.
  En ese caso, para y reporta en `ON STOP` en qué sub-paso quedó atascado y el
  error exacto de la última corrida.

## ESTADO / MEMORIA

`loops/reservas-ui-ciclo-pagos.state.md` (créalo en la primera iteración si no
existe): lista de las 7 sub-tareas (a-g) con estado `pendiente/en curso/hecho`,
y un log breve por intento fallido (comando ejecutado, error, qué se cambió
para corregirlo). No dupliques esto en `PROGRESS.md` durante el loop; al cerrar
el loop (con éxito o por límite duro), añade una única entrada resumen a
`PROGRESS.md` y actualiza `tasks.md` (marca T012/T013 con `[x]` solo si VERIFY
pasó completo) y `HANDOFF.md` (mueve el "empieza por aquí" a lo que siga).

## COMPUERTAS HUMANAS

Ninguna — el loop es autónomo de principio a fin. No requiere despliegue,
credenciales nuevas, ni envío externo; toca solo código y demo-store locales, y
rutas de API ya construidas y ya cubiertas por tests de backend. Al terminar
(éxito o límite duro), el resultado sigue viviendo en la rama de trabajo local;
abrir PR contra `main` requiere confirmación explícita del usuario (regla del
proyecto: "no commitees features directo en main", y CLAUDE.md pide preguntar
antes de publicar/mergear).

## ON STOP

- Con éxito: resume qué sub-tareas se completaron, pega el resultado final de
  VERIFY, actualiza `PROGRESS.md`/`HANDOFF.md`/`tasks.md` como se indica arriba,
  y pregunta al usuario si quiere que se abra PR (no lo abras solo).
- Sin éxito (límite duro): dile al usuario exactamente en qué sub-paso (a-g) se
  quedó, el error real de la última corrida de VERIFY, y qué se descartó como
  solución (para no repetir el mismo intento en una relanzada futura).

## CÓMO LANZARLO

```
/loop "usa la especificación de loops/reservas-ui-ciclo-pagos.md"
```

o, para que corra dentro de la sesión actual hasta cumplir la condición de
éxito sin repetirse en el tiempo:

```
/goal "VERIFY de loops/reservas-ui-ciclo-pagos.md pasa completo"
```
