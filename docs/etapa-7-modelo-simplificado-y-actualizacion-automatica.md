# Etapa 7 — Modelo simplificado + actualización automática de alquiler por IPC

**Estado: ✅ Completada (código) — pendiente que el usuario cargue `RAPIDAPI_KEY` para usar el cálculo real**

## Objetivo

El usuario pidió repensar el modelo de datos con un solo criterio: que un usuario sin conocimientos técnicos pueda administrar sus alquileres por chat con la menor cantidad posible de pasos y módulos. Esto significó **sacar alcance** (reparaciones, proveedores, documentación, edición/borrado) a la vez que se **sumaba** la pieza que más valor agrega: actualizar el alquiler automáticamente por IPC sin tener que calcularlo a mano.

## Qué cambia

### 1. Gastos unificados
`seguros` e `impuestos_servicios` (etapas 2/3) se reemplazan por una sola tabla `gastos_propiedad`: mismo flujo de alta para expensas, ABL, ARBA, luz, gas, agua, internet, seguro hogar, seguro incendio u otro. Se pierden los campos específicos de seguro (compañía, número de póliza) — quedan en `observaciones` como texto libre, a cambio de un solo lugar para cualquier gasto.

### 2. Seguro Finaer, parte del contrato
El Finaer no es una entidad aparte: son 5 campos directamente en `contratos` (activo, póliza, inicio, vencimiento, observaciones). El estado (vigente/vencido) se calcula por fecha, no se guarda. Se carga en un paso aparte con `cargar_seguro_finaer` (o junto con el alta del contrato, si ya se sabe).

### 3. Actualización automática del alquiler (IPC)
Cada contrato tiene `frecuencia_actualizacion` (siempre se pregunta al crear el contrato, nunca se asume) y, opcional, `indice_actualizacion` (IPC/ICL). `actualizar_alquiler`:
1. Chequea internamente (sin llamar a ninguna API) si ya corresponde actualizar, comparando la fecha de la última actualización registrada (o la fecha de inicio del contrato, si es la primera vez) con la frecuencia configurada.
2. Si no corresponde, lo dice y no gasta la llamada externa.
3. Si corresponde y el índice es IPC, llama a `POST https://arquilerapi1.p.rapidapi.com/calculate` con `amount`=alquiler original, `date`=inicio del contrato, `months`=la frecuencia en meses, `rate`="ipc" — siempre con los valores **originales** del contrato, no los últimos actualizados, porque la API recalcula toda la trayectoria desde el origen.
4. Guarda el último período aplicable en `actualizaciones_contrato` (existía en el schema desde el v1, nunca se había usado) y muestra valor anterior, valor actualizado, diferencia y desde cuándo aplica.

Si el contrato no usa índice IPC, la tool lo dice y no actualiza nada (ICL queda fuera del alcance de esta integración).

### 4. Módulos deshabilitados (no eliminados)
Reparaciones, proveedores y documentación quedan fuera del asistente: sus tools ya no se registran en `tools/index.ts` ni se mencionan en el `systemPrompt.ts`, pero el schema, los repos, los services y los archivos de tools siguen en el repo intactos — un upgrade futuro solo necesita volver a registrarlos.

### 5. Sin edición de contratos, con una excepción acotada
Se mantiene la decisión de no tener edición/borrado general. La única excepción es `cargar_seguro_finaer`, que solo toca los 5 campos de Finaer de un contrato ya existente — no es edición general, es completar un dato que el usuario dijo explícitamente que se carga en un paso aparte.

## Decisiones de simplificación (más allá de lo pedido)

- **Estado del Finaer y de los gastos, calculado, no guardado**: igual que el resto del sistema (contratos, vencimientos), evita un campo que se puede desincronizar de la fecha real.
- **Frecuencia de actualización: se pregunta siempre** (decisión explícita del usuario, contraria a mi recomendación inicial de asumir "trimestral" en silencio) — prioriza no asumir mal sobre menos preguntas.
- **`actualizaciones_contrato` reutilizada tal cual** (ya estaba en el schema desde el v1): "último valor vigente" = la fila con `fecha_vigencia` más reciente; no hizo falta ningún campo nuevo.
- **Montos comparados en la app, no vía el campo `dif` de la API**: la diferencia mostrada al usuario se calcula contra el último valor que el propio sistema tiene guardado, no contra el período anterior que devuelve la API — más robusto si en algún momento no se llamó puntualmente.

## Migración de base

Como la migración mezclaba altas y bajas de enums con nombres parecidos (`tipo_impuesto_servicio` → `tipo_gasto`), `drizzle-kit generate` pedía una confirmación interactiva que no se puede responder en este entorno (sin TTY). Se resolvió en dos pasos: primero una migración puramente aditiva (nuevo enum/tabla, conviviendo con los viejos), aplicada; después, con lo nuevo ya creado, una segunda migración que solo borra lo viejo (sin ambigüedad de rename posible). Documentado por si se repite el patrón en una etapa futura.

Antes de migrar se truncó la base (autorizado explícitamente — "son datos de prueba").

## Fuera de alcance

- Edición/borrado general de contratos, propiedades, personas, proveedores.
- Subida real de archivos (Supabase Storage) — ya cubierto por Drive antes de deshabilitar documentación.
- Recordatorios por-evento escalados.
- Interfaz web, WhatsApp/email — quedaron confirmados como próximos pasos, fuera de este plan.
- Que el índice ICL tenga su propia integración de actualización automática (hoy solo IPC).

## Progreso

- [x] Schema: `gastos_propiedad` (reemplaza `seguros`+`impuestos_servicios`), campos de Finaer y frecuencia/índice en `contratos`, `observaciones` en `pagos`, `actualizaciones_contrato` reutilizada con constraint único
- [x] Migración en dos pasos aplicada contra Supabase
- [x] Repos/services nuevos: `gastosPropiedad`, `actualizacionesContrato`, `actualizacionAlquiler` (throttle + llamada a ARquilerAPI)
- [x] Tools nuevas: `crear_gasto`, `listar_gastos`, `marcar_gasto_pagado`, `actualizar_alquiler`, `cargar_seguro_finaer`; `crear_contrato` ampliado
- [x] Reparaciones/proveedores/documentación deshabilitados (código intacto)
- [x] `agenda.service.ts`/`vencimientos.service.ts` actualizados (gastos unificados, Finaer, actualización pendiente — sin llamar a la API para listar)
- [x] `systemPrompt.ts` reescrito para el alcance simplificado
- [x] Typecheck, lint, 13 tests en verde
- [x] Verificación funcional: **directo contra services/repos/DB** (sin gastar OpenAI) para la mayoría de los casos, y un mínimo de 4 mensajes reales por chat para confirmar que el modelo elige bien las tools nuevas — según el criterio de QA acordado con el usuario
- [ ] Falta: que el usuario cargue `RAPIDAPI_KEY` en Render/`.env` para probar el cálculo real contra la API (hoy la tool responde "sin_configurar" de forma controlada)

## Resultado

El asistente pasa de 27 a 17 herramientas activas, todas más simples de razonar ("un gasto es un gasto", "el Finaer es del contrato"), y suma la funcionalidad de mayor valor pedida: actualizar el alquiler por IPC sin cálculo manual, gastando la API externa solo cuando realmente corresponde.
