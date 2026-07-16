# Etapa 4 — Lenguaje de negocio y ocultamiento de detalles técnicos

**Estado: ✅ Completada**

## Objetivo

El asistente debía hablar siempre como una herramienta de administración inmobiliaria, nunca como un sistema técnico. Antes de esta etapa, algunas respuestas se filtraban con UUIDs internos (ej: "ID: 78c39c6f-ca05-4c26-a661-f4807040eed0"), fechas en formato ISO (2026-07-15 en vez de 15/07/2026) y confirmaciones demasiado escuetas ("Contrato creado."). El pedido fue explícito: nunca mostrar información técnica, hablar siempre en lenguaje de negocio, identificar propiedades por dirección (nunca por ID), dar confirmaciones completas y naturales, y mantener un formato uniforme en toda la app.

## Qué se implementa

### 1. Ocultamiento de IDs con dos capas de defensa
- **`systemPrompt.ts`**: regla explícita y ejemplos concretos — nunca UUIDs, IDs internos, nombres de tabla/campo ni mensajes de implementación; excepción solo si el usuario pide el ID a propósito.
- **Tools**: se sacaron los IDs que no hacen falta para encadenar llamadas (documentos, seguros, impuestos/servicios, movimientos financieros, pagos) y se movieron a un marcador `(id: ...)` al final de la línea — nunca al principio ni mezclado con el texto — en los pocos casos donde el modelo sí necesita el ID para una llamada siguiente (propiedad, persona, proveedor, reparación, contrato). El system prompt le explica al modelo qué es ese marcador y que nunca debe repetirlo.
- Se corrigieron además varios mensajes de error tipo "No se encontró la propiedad {uuid}" que filtraban el ID igual por la rama de error — ahora dicen "No encontré esa propiedad, volvé a buscarla con buscar_propiedad" sin exponer nada.

### 2. Fechas y períodos en formato argentino
Nuevos helpers `formatoFechaAR` (YYYY-MM-DD → DD/MM/AAAA) y `formatoPeriodoAR` (YYYY-MM → "Julio 2026") en `util/fecha.ts`, aplicados en todos los puntos donde se muestra una fecha: confirmaciones de alta, listados, agenda y balance financiero.

**Importante**: `/agenda` y el recordatorio diario (`enviarDigestDiario`) arman su mensaje con `agenda.service.ts::formatearResumenAgenda` y lo mandan **directo a Telegram sin pasar por el modelo** — ahí una regla en el system prompt no alcanza, había que formatear la fecha en el propio servicio. Se corrigió ahí directamente (no solo en las tools), que es el mismo motivo por el que `movimientos.service.ts::formatearBalance` también se tocó directo.

### 3. Confirmaciones completas
Las tools de alta (`crear_contrato`, `crear_recibo`, `crear_propiedad`, `crear_reparacion`, `crear_seguro`, `crear_impuesto_servicio`, `crear_documento`, `crear_movimiento_financiero`, `crear_persona`, `crear_proveedor`) ahora resuelven y devuelven los datos de negocio relevantes (dirección de la propiedad, nombre del inquilino/propietario/proveedor, montos, fechas) en vez de solo confirmar con el ID. Se agregaron dos lookups nuevos (`personasRepo.obtenerPersonaPorId`, `proveedoresRepo.obtenerProveedorPorId`) y `pagos.service.crearRecibo` ahora devuelve también el contrato resuelto (propiedad + inquilino) para que `crear_recibo` pueda armar la confirmación sin una consulta extra.

### 4. Formato uniforme
El system prompt define la estructura esperada para toda respuesta que confirma una acción: confirmación breve → información principal → datos relevantes → próximo paso sugerido (cuando corresponda), con dos ejemplos completos (alta de contrato, registro de pago) tomados directamente de los que pidió el usuario.

## Decisiones

- **Dos capas, no una**: el system prompt gobierna lo que el modelo *compone*, pero `/agenda` y el digest diario nunca pasan por el modelo — sin arreglar `agenda.service.ts` y `movimientos.service.ts` directamente, esas dos rutas habrían seguido mostrando fechas ISO pese a la regla en el prompt. Cualquier funcionalidad futura que arme texto para el usuario sin pasar por el modelo tiene que aplicar `formatoFechaAR`/`formatoPeriodoAR` a mano — no alcanza con confiar en el prompt.
- **IDs solo donde hacen falta para encadenar**: en vez de exponer todos los IDs marcados como "no mostrar" y confiar 100% en la instrucción del modelo, se sacaron directamente los que ningún otro tool usa como input (documento, seguro, impuesto/servicio, movimiento financiero, pago). Menos superficie expuesta = menos riesgo, en vez de depender solo de que el modelo obedezca.
- **Enriquecer en la tool, no en el service**: los services (`pagos.service`, `reparaciones.service`) siguen devolviendo datos de negocio sin preocuparse por presentación; las tools hacen el lookup adicional (ej. `propiedadesRepo.obtenerPropiedadPorId`) y arman el texto. Excepción: `pagos.service.crearRecibo` sí devuelve el contrato resuelto porque ya lo necesitaba internamente para el movimiento financiero — evita una consulta duplicada.

## Hallazgo operativo (no de código)

Al probar esta etapa se detectó que `npm run seed` se había corrido sobre una base que ya no estaba vacía — el usuario había cargado datos reales por Telegram entre sesiones. Como `seed.ts` no es idempotente, agregó datos de prueba encima de los reales en vez de fallar. Se identificaron con precisión (por `created_at`) las filas de prueba vs. las reales y se dejó la decisión de limpieza en manos del usuario en vez de borrar automáticamente. Lección para el futuro: **verificar que la base esté vacía antes de correr `seed.ts`**, no asumirlo por el estado de la sesión anterior.

## Fuera de alcance

- No se tocó el modelo de datos ni se agregaron campos de piso/depto separados — la desambiguación de propiedades sigue dependiendo de que la dirección cargada sea lo bastante específica (regla ya existente: ante ambigüedad, preguntar mostrando dirección completa + zona + propietario, nunca un ID).
- No se widened el "próximo paso sugerido" a una lógica programática — queda como criterio del modelo, guiado por los ejemplos del prompt.

## Progreso

- [x] Helpers `formatoFechaAR` / `formatoPeriodoAR`
- [x] `systemPrompt.ts` reescrito con las 6 reglas + 2 ejemplos completos
- [x] `agenda.service.ts` y `movimientos.service.ts` corregidos (rutas que evitan al modelo)
- [x] Las 23 tools revisadas: IDs innecesarios eliminados, IDs necesarios movidos a marcador `(id: ...)`, fechas formateadas, mensajes de error sin fugas de ID
- [x] Confirmaciones de alta enriquecidas con datos de negocio (contrato, recibo, propiedad, reparación, seguro, impuesto/servicio, documento, movimiento financiero, persona, proveedor)
- [x] Typecheck, lint y 13 tests en verde
- [x] Prueba end-to-end por chat real: se verificó que ningún ID ni fecha ISO aparece en ninguna respuesta, con altas de persona/propiedad/contrato/pago/proveedor/reparación y consultas de agenda/balance/búsqueda

## Resultado

Ninguna respuesta del asistente —por chat ni por el digest diario— vuelve a mostrar UUIDs, IDs internos ni fechas en formato ISO. Las confirmaciones de alta muestran los datos de negocio relevantes con la estructura pedida (confirmación → info principal → datos → próximo paso), verificado con una batería de pruebas reales contra OpenAI y la base.
