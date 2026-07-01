# Loop: <nombre-corto-del-loop>

> Generado por la skill `crear-loop` el <fecha>. Fuente: <qué documentos del
> proyecto y qué indicaciones del usuario se usaron>.

## GOAL

<Objetivo final, en una frase verificable. Ej: "todas las queries lentas
detectadas en logs/slow-queries.log tienen un índice propuesto y el EXPLAIN
confirma que el plan de ejecución mejora".>

## CONTEXTO QUE EL AGENTE DEBE LEER ANTES DE EMPEZAR

- <documento 1 del proyecto, p. ej. PLANNING.md>
- <documento 2, p. ej. schema de BBDD o convenciones de estilo>
- <cualquier credencial/acceso ya confirmado como disponible, y dónde vive:
  p. ej. "connection string en DATABASE_URL, ya presente en .env">

## CADA ITERACIÓN

1. <paso concreto y accionable, sin ambigüedad>
2. <paso concreto y accionable>
3. <paso concreto y accionable>
4. <re-ejecutar la verificación>

## VERIFY

<Comando o comprobación exacta y automática. Ej: "`npm test` sale en verde",
"la query `SELECT count(*) FROM x WHERE y IS NULL` devuelve 0", "el build
`npm run build` termina sin errores y sin warnings de tipo".>

## STOP WHEN

- Éxito: VERIFY pasa.
- Límite duro: <N> iteraciones alcanzadas, o <tiempo/coste máximo>.

## ESTADO / MEMORIA

<Qué archivo guarda el progreso entre iteraciones: qué se intentó, qué falló,
qué queda. Ej: "PROGRESS.md, sección '## Loop <nombre>'" o "loops/<nombre>.state.md".>

## COMPUERTAS HUMANAS (si aplica)

<Puntos donde el loop se detiene obligatoriamente a esperar aprobación humana
explícita, con quién debe aprobar y qué debe confirmar. Si no hay ninguna,
escribe "Ninguna — el loop es autónomo de principio a fin".>

## ON STOP

<Qué debe hacer el agente al terminar, con éxito o sin él: resumir qué cambió,
qué sigue fallando, dónde quedó documentado.>

## CÓMO LANZARLO

```
/loop <intervalo-opcional> "<prompt o ruta a este archivo>"
```

o, si debe correr dentro de la sesión actual hasta cumplir la condición:

```
/goal "<condición de éxito tal como aparece en VERIFY>"
```
