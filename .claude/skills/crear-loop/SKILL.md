---
name: crear-loop
description: Diseña y redacta "loops" (bucles autónomos plan→implementación→validación→corrección→promoción) para el proyecto en el que se invoca, apoyándose en sus documentos de flujo (CLAUDE.md, HANDOFF.md, PLANNING.md, PROGRESS.md, README) y en documentos adicionales que indique el usuario. Usar cuando el usuario pida "crea un loop", "diseña un bucle", "quiero automatizar esta tarea", "monta un /loop para...", "que un agente haga esto solo y repita hasta que funcione", o cualquier variante de convertir una tarea recurrente/iterativa en un bucle que un agente ejecute sin supervisión paso a paso. El usuario que invoca esta skill puede no tener experiencia técnica: la skill debe resolver los detalles técnicos por él y solo preguntarle lo estrictamente necesario (credenciales, decisiones de negocio, ambigüedades) antes de dar el loop por terminado.
---

# Crear Loop

Un loop no es un prompt. Es: **objetivo + criterio de éxito verificable automáticamente
+ condición de parada**. Esta skill no ejecuta el loop — produce su especificación
(un archivo listo para lanzar con `/loop` o `/goal`) y confirma con el usuario, con
preguntas, todo lo que un agente no podría resolver por sí solo a mitad de la
ejecución.

Fundamento (no lo repitas al usuario salvo que pregunte "por qué así"):
plan → implementación → validación → corrección → promoción → verificación
posterior → documentación/memoria. El **verify** es el corazón del loop: sin una
comprobación automática y objetiva, no hay loop, hay un agente aplaudiéndose a sí
mismo.

## Proceso

### 0. Descubrir el contexto del proyecto actual

Antes de preguntar nada, lee lo que ya existe en el directorio de trabajo actual
(y su raíz de repo si es distinta):

- `CLAUDE.md`, `AGENTS.md`, `GEMINI.md` — reglas del proyecto, cómo se trabaja aquí.
- `HANDOFF.md` — estado de traspaso entre sesiones/personas.
- `PLANNING.md` — el plan vigente, de donde debería salir el objetivo del loop.
- `PROGRESS.md` — qué está hecho, qué falta, qué falló antes. Este archivo (o uno
  equivalente) es candidato natural a **memoria/estado del loop**.
- `README.md`, `package.json` / `pyproject.toml` / etc. — stack técnico real:
  cómo se testea, se lintea, se compila, se despliega este proyecto.
- Cualquier otro documento que el usuario mencione explícitamente en su petición.

No asumas que estos ficheros existen con esos nombres exactos — búscalos (Glob
`*.md` en la raíz y en `docs/`) y trata como equivalente cualquier fichero que
cumpla el mismo papel aunque se llame distinto. Si no encuentras nada de esto,
dilo y sigue solo con lo que el usuario aporte en el momento.

Extrae de esos documentos: el objetivo de más alto nivel del proyecto, las
convenciones que no se deben romper, cómo se verifica hoy que algo funciona
(tests, lint, build, un flujo manual), y qué tareas pendientes hay ya anotadas
que podrían ser candidatas al loop.

### 1. Determinar el objetivo del loop

**Si el usuario ya ha descrito la tarea con precisión** ("crea un loop para que
los tests de auth pasen"), no preguntes por preguntar: pasa al filtro del
punto 2.

**Si el usuario NO da una tarea concreta** (dice solo "crea un loop", "qué
loops puedo montar aquí", o algo vago tipo "automatiza los bugs"), no le pidas
a él que invente el objetivo — para eso está esta skill. En su lugar:

1. Extrae de `PLANNING.md`, `PROGRESS.md` y `HANDOFF.md` (o equivalentes) todo
   lo marcado como pendiente, roto, "por hacer", "próximos pasos", TODOs con
   contexto suficiente, issues abiertos referenciados, etc.
2. Evalúa cada pendiente contra el filtro del punto 2 (¿se repite o es una
   unidad ejecutable del plan?, ¿hay forma automática de verificarlo?, ¿el
   agente lo puede completar solo?, ¿"hecho" es objetivo?) y descarta los que
   no lo cumplan — no se los muestres como opción, o si los muestras, marca
   claramente por qué no son buenos candidatos a loop.
3. Presenta al usuario, con `AskUserQuestion`, una lista corta (2-4) de los
   mejores candidatos que sí sobreviven el filtro, cada uno en una frase
   simple ("qué se arregla" + "cómo sabremos que quedó bien"), y deja que
   elija uno (o pida ver más, o proponga el suyo).
4. Si no encuentras ningún pendiente que cumpla el filtro, dilo explícitamente
   y explica qué te faltó encontrar (por ejemplo: "no hay ningún pendiente con
   una forma automática de comprobarlo; dime uno y lo diseñamos igualmente" o
   "todo lo pendiente en PROGRESS.md son decisiones de producto, no tareas
   ejecutables por un agente").

En ambos casos, una vez fijado el objetivo, si es ambiguo pide que se concrete
con un ejemplo de una vez en que ese trabajo se hizo bien a mano — un loop se
diseña a partir de un caso manual que ya funcionó, no al revés.

### 2. Filtro de "¿esto merece ser un loop?"

Compruébalo contra las 4 condiciones. Si falla alguna, dilo explícitamente al
usuario (no lo apliques como excusa para no hacer nada, ofrécele igualmente la
opción de "aun así, quiero este loop" si insiste):

- La tarea se repite (al menos semanalmente) o es una unidad de trabajo dentro
  de un plan mayor con varias iteraciones previsibles.
- Existe (o se puede construir) una forma **automática** de rechazar un
  resultado malo: un test, un build, una query que devuelve un valor esperado,
  una regla dura. Si nada puede reprobar el trabajo, no hay loop, hay una
  petición puntual.
- El agente puede completar el ciclo entero él solo, sin que a mitad de la
  tarea necesite que el usuario haga clic en algo, apruebe algo o le pase un
  dato que no tiene.
- "Terminado" es objetivo, no una cuestión de gusto.

### 3. Barrido de bloqueos — la parte que NO se puede saltar

Antes de redactar una sola línea del loop, repasa cada tarea/iteración prevista
y pregúntate, para cada una: **¿podría un agente completar esto de principio a
fin sin pararse a esperar al usuario?** Busca específicamente:

- **Credenciales y secretos**: valores de `.env`, API keys, tokens, connection
  strings de base de datos que el agente necesitará y que no están ya
  disponibles en el entorno del proyecto (revisa `.env.example`/`.env.sample`
  para ver qué variables se esperan, y compáralo con lo que realmente exista).
- **Accesos externos**: BBDD, APIs de terceros, paneles de administración,
  entornos de staging/producción — ¿el agente tiene ya el acceso o el MCP/tool
  configurado, o hace falta que el usuario lo conecte antes?
- **Decisiones de negocio o de producto** que no se pueden derivar del código
  ni de los documentos ("¿qué copy usamos?", "¿qué proveedor de pago?") — estas
  nunca deben quedar como un paso ambiguo dentro del loop; o se resuelven ahora
  preguntando, o se convierten en una **compuerta humana explícita** (ver
  siguiente punto).
- **Aprobaciones obligatorias** (desplegar a producción, enviar comunicaciones
  externas, mover dinero, borrar datos) — estas SIEMPRE deben quedar como
  compuerta humana explícita al final del loop, nunca como paso que el agente
  decide solo.

Si encuentras algo bloqueante, **para aquí y pregunta al usuario** (con
`AskUserQuestion` si son decisiones cerradas, o en texto si son valores que debe
pegar/configurar él mismo, p. ej. secretos — nunca le pidas que te dicte un
secreto en texto plano si existe una alternativa: pídele que lo añada al `.env`
o al gestor de secretos del proyecto y confirme cuándo está hecho). No continúes
redactando el loop con placeholders tipo "TODO: pedir esto luego" — la
especificación final no debe contener ningún hueco de ese tipo.

### 4. Redactar la especificación del loop

Usa la plantilla [templates/loop-template.md](templates/loop-template.md). Puntos
que no son negociables:

- **VERIFY** tiene que ser un comando o comprobación concreta que ya exista o
  que el propio loop cree en su primera iteración (un test, un script, una
  query). Nunca "revisar que quede bien" sin más.
- **STOP WHEN** siempre lleva dos condiciones: éxito, y un límite duro de
  iteraciones (o de tiempo/coste) para que nunca corra indefinidamente.
- **ESTADO / MEMORIA**: indica qué archivo persiste el progreso entre
  iteraciones (reutiliza `PROGRESS.md` si el proyecto ya lo usa así, o crea
  `loop-state.md` junto al loop) — sin esto el agente repite errores porque
  olvida qué probó ya.
- **COMPUERTAS HUMANAS**: si en el paso 3 identificaste aprobaciones
  obligatorias, decláralas aquí como paso explícito con nombre ("esperar
  aprobación humana antes de desplegar a producción"), no las escondas dentro
  de una tarea automática.
- Cada tarea del loop debe quedar redactada de forma que un agente que nunca ha
  hablado contigo pueda ejecutarla solo con el archivo de loop y los documentos
  del proyecto — sin depender de que tú estés presente.

### 5. Guardar y explicar cómo lanzarlo

- Guarda la especificación en el proyecto, por ejemplo en `loops/<nombre>.md`
  (crea la carpeta `loops/` si no existe) — así queda versionado junto al
  código, no solo en el chat.
- Si el proyecto usa `PROGRESS.md`/`PLANNING.md` como flujo estándar, añade una
  referencia cruzada breve desde ahí al nuevo loop, para que quien abra esos
  documentos sepa que existe.
- Explica al usuario, en lenguaje simple, cómo arrancarlo: normalmente
  `/loop <prompt del loop o ruta al archivo>` (con intervalo si debe repetirse
  en el tiempo, o sin intervalo para que se autorregule dentro de la sesión
  actual), o `/goal` si lo que quiere es que la sesión no pare hasta cumplir la
  condición. No asumas que el usuario sabe qué es `/loop` — dáselo como un
  comando literal que puede copiar y pegar.

### 6. Cierre

Resume en 3-4 líneas, sin jerga: qué hará el loop, cómo sabrá que terminó, qué
pasa si falla 8 veces seguidas, y qué compuertas humanas quedaron (si alguna).
Pregunta si quiere lanzarlo ya o ajustarlo antes.

## Reglas invariables

- Nunca entregues un loop con un paso que diga, en esencia, "pedir al usuario
  X en este punto" salvo que ese paso sea una compuerta humana declarada
  explícitamente (producción, pagos, borrado de datos, envíos externos). Todo
  lo demás se resuelve **antes** de escribir el loop, no durante.
- Nunca inventes que una credencial o acceso existe: compruébalo (variables de
  entorno presentes, MCP/tool conectado) y si falta, pregunta antes de seguir.
- Prioriza reutilizar los documentos de flujo que ya tiene el proyecto en vez
  de crear un sistema paralelo — el loop debe encajar en `PLANNING.md` /
  `PROGRESS.md` si ya existen, no duplicarlos.
