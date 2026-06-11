# Graph Variants

Este proyecto tiene varias salidas de Graphify con objetivos distintos.

## 1. Arquitectura completa

Ruta: `archive/graphify-full/`

Uso:

- Entender el plugin completo de Amelia Premium.
- Ver integraciones, extensiones y superficie amplia del producto.
- Consultas globales de funcionalidades.

Incluye:

- Core PHP de `reference/amelia-source/src`
- Bootstrap del plugin
- Integraciones y parte de extensiones server-side

Excluye:

- `vendor/`
- imágenes, markdown, PDFs
- bundles y assets pesados
- `v3/`, `redesign/`, `view/`, `templates/`

## 2. Backend completo

Ruta: `reference/graphify/backend/`

Uso:

- Analizar el backend del plugin sin ruido de frontend ni extensiones.
- Seguir lógica de negocio y persistencia WordPress/PHP.

Incluye:

- `reference/amelia-source/src`
- `reference/amelia-source/ameliabooking.php`

Excluye:

- `extensions/`
- `public/`
- `vendor/`
- assets y contenido documental

## 3. SaaS Core

Ruta: `reference/graphify/saas-core/`

Uso:

- Base recomendada para diseñar un SaaS multitenant inspirado en Amelia.
- Ver una arquitectura más reusable y menos acoplada a WordPress.
- Recuperar `graph.html` con un corpus suficientemente pequeño.

Incluye:

- `reference/amelia-source/ameliabooking.php`
- `reference/amelia-source/src/Domain`
- `reference/amelia-source/src/Application/Services`
- `reference/amelia-source/src/Application/Common`
- `reference/amelia-source/src/Infrastructure/API`
- `reference/amelia-source/src/Infrastructure/Common`
- `reference/amelia-source/src/Infrastructure/ContainerConfig`
- `reference/amelia-source/src/Infrastructure/DB`
- `reference/amelia-source/src/Infrastructure/Repository`

Excluye a propósito:

- `src/Application/Commands`
- `src/Application/Controller`
- `src/Infrastructure/Routes`
- `extensions/`, `public/`, `vendor/`

Motivo:

- Conserva entidades, servicios de dominio, repositorios, persistencia e integraciones.
- Quita capas de transporte y handlers WordPress que inflan el grafo pero aportan menos al diseño de un SaaS independiente.

## Fuente Amelia

Ruta: `reference/amelia-source/`

Uso:

- Consultar detalles finos del plugin original cuando los documentos Spec Kit no basten.
- Verificar comportamiento de dominio inspirado en Amelia Premium.

Nota:

- No es código base del SaaS nuevo.
- No debe importarse ni copiarse directamente sin rediseño explícito.
