# Etapa 8 — Botones interactivos contextuales (Telegram)

**Estado: ✅ Completada**

## Objetivo

El asistente era 100% texto: había que escribir todo, incluso respuestas triviales como "IPC" o "sí". El usuario pidió que el bot use los botones nativos de Telegram, cambiando dinámicamente según el momento de la conversación — un menú principal fijo y teclados contextuales que aparecen solo cuando tienen sentido — sin perder la posibilidad de escribir en lenguaje natural en cualquier momento.

## El problema de diseño

`ChatSession` es un loop de tool-calling puro: no existía ningún lugar donde el código (fuera del modelo) supiera "en qué momento de la conversación estamos" para decidir qué botones mostrar.

## Solución: dos mecanismos

1. **Inferido automáticamente** (sin depender del modelo): después de que `crear_propiedad`, `crear_contrato`, `crear_recibo` o `crear_gasto` se ejecutan con éxito, `ChatSession` ya sabe con certeza qué acaba de pasar y elige el set de botones correspondiente (`post_propiedad`, `post_contrato`, `post_pago`, `post_gasto`). 100% confiable.
2. **Señalado por el modelo**: una tool nueva y liviana, `sugerir_botones`, que el modelo llama junto con su pregunta en texto cuando está por hacer una pregunta de opción múltiple (índice, frecuencia, Finaer sí/no, responsable de gasto, tipo de persona, filtro de estado de pago, o al mostrar el detalle de una propiedad/contrato puntual). No toca la base — solo indica qué botones mostrar. Depende de que el modelo coopere; si en algún caso puntual no la llama, la respuesta sale sin botones pero la conversación sigue funcionando en texto — degradación aceptada, no un bug.

Prioridad si ambos aplicaran en el mismo turno: lo señalado por `sugerir_botones` gana (más específico que la inferencia automática).

## Qué se implementa

- `ChatSession.enviarMensaje()` cambia de `Promise<string>` a `Promise<{ texto: string; teclado?: ContextoTeclado }>`. `ejecutarTool()` ahora devuelve `{ ok, contenido }` en vez de un string plano, para poder distinguir éxito/fracaso al inferir el contexto.
- `sugerir_botones.tool.ts`: define `ContextoTeclado` (compartido por `ChatSession` y por `telegram/keyboards.ts`) y la tool que el modelo llama para señalar 8 de los 12 contextos posibles (los otros 4, "post_*", se infieren solos).
- `consultar_contrato.tool.ts`: tool nueva, necesaria para que "👀 Ver contrato" muestre algo real — no existía ninguna que juntara propiedad, inquilino, garantes, fechas, valor vigente, actualización y Finaer en un solo lugar.
- `telegram/keyboards.ts`: el menú principal (Reply Keyboard, 5 botones) y los 12 teclados contextuales (Inline Keyboard), con la traducción de cada botón/callback_data a la frase en lenguaje natural que se le manda a `ChatSession` — igual que si el usuario la hubiera escrito.
- `telegram/index.ts`: `/start`/`/ayuda` mandan el menú principal; nuevo handler `callback_query:data` que resuelve navegación pura (menú principal, cancelar) sin gastar la API de OpenAI, y el resto vía el mismo camino que un mensaje de texto.
- `cli/index.ts`: ajustado al nuevo tipo de retorno (imprime el teclado sugerido entre corchetes, para poder probar por consola).

## Bug preexistente encontrado y corregido

Al probar el flujo de `crear_contrato`, `buscar_persona` con el filtro `rol: "inquilino"` no encontraba a una persona recién dada de alta — el filtro exige que la persona **ya sea** inquilino en algún contrato existente, imposible para su primer contrato. Esto podía llevar al modelo a asumir que la persona "no existe" y crear un duplicado. No es un bug de esta etapa (existía desde el v1), pero lo destapó esta prueba — se corrigió aclarando en la descripción de la tool que el filtro de rol no sirve para asignaciones nuevas.

## Decisiones

- **Se respetó el listado de botones exacto que pidió el usuario por cada pantalla**, incluso donde no es uniforme (ej. "seleccion_persona"/"indice"/"frecuencia"/"finaer_si_no"/"responsable_gasto"/"estado_pago" no incluyen un botón de "menú principal", a diferencia de los "post_*" y "detalle"). El Reply Keyboard del menú principal queda visible de todas formas de forma persistente en Telegram, así que nunca se pierde la posibilidad de volver — no hizo falta forzar un botón extra en cada pantalla.
- **Frecuencia**: botones Mensual/Trimestral/Semestral/Anual (los 4 valores que ya existen en la base), sin agregar "cuatrimestral" — decisión explícita del usuario en la planificación.
- **"Estado del pago" es un filtro de consulta**, no dispara ninguna escritura — no hizo falta tocar la lógica de pagos.
- **Navegación pura sin pasar por el modelo**: "🏠 Menú principal" y "❌ Cancelar" se resuelven directo en `telegram/index.ts`, sin llamar a la API de OpenAI — coherente con el criterio de minimizar el consumo de la API.

## Fuera de alcance

- El digest diario (`scheduler.ts`) sigue siendo texto plano — cubre varias propiedades a la vez, no hay un único contexto al que atarle un teclado.
- No se convirtió el asistente en un wizard rígido: la conversación en lenguaje natural sigue funcionando exactamente igual con o sin botones.

## Progreso

- [x] `sugerir_botones` y `consultar_contrato` (tools nuevas)
- [x] `ChatSession` trackea tools exitosas del turno y resuelve el teclado con la prioridad correcta
- [x] `telegram/keyboards.ts` con los 12 contextos + menú principal, fieles al pedido del usuario
- [x] `telegram/index.ts`: reply keyboard en `/start`/`/ayuda`, handler de `callback_query`, navegación sin gastar API
- [x] `cli/index.ts` adaptado
- [x] Bug de `buscar_persona` + `rol` corregido
- [x] Typecheck, lint, 13 tests en verde
- [x] Verificación sin LLM: los 12 contextos arman los botones exactos pedidos, ningún `callback_data` sin texto mapeado
- [x] Verificación mínima con LLM: `sugerir_botones` se llamó correctamente para frecuencia, índice y Finaer; `post_contrato` se infirió automáticamente tras un alta real

## Resultado

El bot ahora ofrece navegación por botones en los puntos de mayor fricción (preguntas de opción múltiple y "qué hacer después de..."), sin perder la posibilidad de escribir en lenguaje natural en cualquier momento — tal como pidió el usuario.
