# Etapa 9 — Flujos guiados por máquina de estados (sin OpenAI)

**Estado: ✅ Completada**

## Objetivo

Hasta la etapa 8, todo pasaba por `ChatSession`/OpenAI — incluso operaciones 100% deterministas como dar de alta una persona o listar las propiedades. El usuario pidió separar el sistema en dos caminos: **flujos guiados por botones/máquina de estados** (0 tokens) para todo lo repetitivo y estructurado, y **OpenAI reservado solo para lenguaje natural que requiere interpretación real**. Objetivo explícito: 80-90% de las operaciones sin pasar por el modelo.

## Decisiones tomadas en la planificación

- **"Ediciones simples" = el mismo patrón que ya tenía `cargar_seguro_finaer`** (completar/actualizar campos de un contrato existente), llevado a flujo guiado. No se agregó edición general de persona/propiedad/contrato/monto — sigue descartada, como en el roadmap desde la etapa 6.
- **Los flujos guiados arrancan solo desde botones** (menú "➕ Nueva carga" y accesos contextuales). El texto libre sigue yendo a OpenAI como siempre — el modelo ya sabe ejecutar las mismas altas conversacionalmente, así que no se pierde funcionalidad. No hay matcher de palabras clave sobre texto libre.

## Arquitectura: motor de flujos que reutiliza las tools existentes

El punto clave: cada tool de alta (`crearPersonaTool`, `crearPropiedadTool`, `crearContratoTool`, `crearReciboTool`, `crearGastoTool`, `cargarSeguroFinaerTool`) ya tenía exactamente la lógica necesaria — `inputSchema` (zod) define los campos, `run(input)` ya llama al repo/service y arma el texto de confirmación. Un flujo guiado no reimplementa nada de esto: solo agrega una capa que recolecta esos mismos campos paso a paso por botones/texto corto, y al final llama a `xTool.run(datos)` tal cual. El resultado de un alta por flujo guiado y por IA es idéntico, byte a byte.

### El motor (`src/core/flows/`)

- **`types.ts`**: `CampoFlujo` (texto/número/monto/fecha/período/opciones/entidad/confirmación), `PasoFlujo`, `DefinicionFlujo`, `FlowState`/`FlowFrame` (pila, para soportar sub-flujos anidados).
- **`flowEngine.ts`**: `iniciarFlujo`, `procesarTexto`, `procesarSeleccion` — avanza paso a paso, salta pasos condicionales (`saltar`), valida cada tipo de campo sin tocar la base, y solo al llegar al paso de confirmación ejecuta la tool real. Acepta un **registro de flujos inyectable** (por defecto los reales) para poder testear la mecánica genérica con flujos de prueba en memoria, sin pegarle a la base.
- **`validadores.ts`**: parsers de lo que el usuario escribe (fecha DD/MM/AAAA o "hoy", monto con `$`/separador de miles, período MM/AAAA) — devuelven `null` si no matchea, y el motor re-pregunta sin gastar IA.
- **`detectarInterrupcion.ts`**: única heurística de "el usuario se fue del flujo" (preguntas, comandos, frases del menú, cancelación explícita) — determinista, 0 IA.
- **`entidadHelpers.ts`**: buscadores reutilizables (`buscarPersonasParaFlujo`, `buscarPropiedadesParaFlujo`, `buscarContratosVigentesParaFlujo`) sobre los repos ya existentes.
- **`definiciones/*.flow.ts`**: los 6 flujos (uno por tool de alta), cada uno declarando sus pasos y llamando a la tool real en `ejecutar`.

### Sub-flujos: alta inline de una entidad que no existe

Cuando un paso "entidad" (ej. elegir el inquilino de un contrato) no encuentra coincidencias, ofrece "➕ Crear nueva": empuja un nuevo frame a la pila con el flujo correspondiente (`crear_persona`, `crear_propiedad`), y al confirmarse, el id creado (extraído del `(id: ...)` que ya devuelven las tools) y su etiqueta de negocio se inyectan en el campo del flujo padre, que continúa donde estaba. Esto permite crear un inquilino nuevo sin salir del alta del contrato — mismo resultado que hoy logra la IA encadenando `crear_persona` + `crear_contrato`, pero disparado por botones. Se probó con sub-flujos anidados dos niveles (contrato → propiedad → propietario) contra la base real.

### Garantes: loop acotado

Un contrato puede tener 0 o más garantes. En vez de agregar un primitivo de "loop" al motor, se modela con pasos condicionales encadenados (hasta 3 garantes: "¿agregar garante?" → selector → "¿agregar otro?" → ...) — más simple que un mecanismo genérico, y cubre el caso real sin sobre-ingeniería.

### Botones y menú principal: cortar el camino a OpenAI donde ya era determinista

Los 4 accesos fijos del Reply Keyboard ("🏠 Propiedades", "📄 Contratos", "💰 Pagos", "📊 Resumen") dejaron de mandar una frase a `ChatSession` — ahora llaman directo a los repos/services (`listarPropiedades`, `listarContratosVigentes`, `resumenCobrosDelMes`, `obtenerResumenAgenda`+`formatearResumenAgenda`) — mismo patrón que ya usaba el comando `/agenda` desde la etapa 2. "➕ Nueva carga" pasó de mandar una frase al modelo a mostrar un teclado con los 6 flujos disponibles.

## Qué se implementa

- `src/core/flows/` completo (motor + 6 definiciones de flujo + helpers).
- `src/interfaces/telegram/flowKeyboards.ts`: traduce cada `ResultadoFlujo` a un mensaje + `InlineKeyboard` de Telegram.
- `src/interfaces/telegram/menuDirecto.ts`: los 4 accesos fijos del menú principal, sin IA.
- `src/interfaces/telegram/index.ts`: un flujo activo se resuelve siempre por el motor, nunca por OpenAI; si el texto libre no valida contra el paso actual, se re-pregunta (tampoco gasta IA) salvo que sea una interrupción real, que cancela el flujo y sigue el camino normal.
- `src/core/repositories/propiedades.repository.ts`: se agregó `listarPropiedades()` (no existía una función para listar todas, solo búsqueda por texto).

## Fix de infraestructura encontrado en el camino

4 archivos (`db/client.ts`, `db/storage.ts`, `assistant/openaiClient.ts`, `assistant/usageLogger.ts`) usaban el alias `@/config/env.js` en vez del import relativo que usa el resto del proyecto — nunca había fallado porque ningún test previo importaba nada que tocara esos archivos. Al agregar tests que sí llegan a `db/client.ts` (transitivamente, vía los repos), Vitest no pudo resolver el alias (no hay `vitest.config.ts` con `resolve.alias`). Se corrigió la inconsistencia (imports relativos, como en el resto del proyecto) en vez de agregar configuración nueva solo para un alias que no se usaba en ningún otro lado — y se sacó el `paths` de `tsconfig.json`, que quedó sin uso.

## Decisiones de alcance

- **Campos opcionales de bajo uso no se piden en el flujo guiado** (ej. `email`/`dirección`/`notas` de una persona, `observaciones` de un gasto): el flujo guiado cubre el camino común; esos campos siguen disponibles solo por chat con IA — no hacía falta un wizard de 10 pasos para un caso raro.
- **Prioridad de auto-selección**: si una búsqueda de entidad devuelve exactamente 1 resultado, se selecciona solo (sin mostrar botones) — mismo criterio que ya usa `resolverContrato` en el camino de IA.

## Fuera de alcance (explícito)

- Edición general de datos ya cargados — sigue descartada.
- Arranque de flujos por palabras clave en texto libre — solo por botones en esta etapa.
- "Contexto activo" (última propiedad/contrato mencionados) para que los botones `accion:*` post-IA de la etapa 8 (ej. "👀 Ver contrato" después de una respuesta del modelo) se resuelvan sin OpenAI — mejora real, pero de otro alcance (requeriría que `ChatSession` exponga qué entidades tocó cada tool call). Candidato natural para una etapa futura.
- Soporte de flujos guiados por CLI — el motor es agnóstico de Telegram a propósito (facilita testear sin red), pero conectarlo a `interfaces/cli` queda fuera de esta etapa.

## Progreso

- [x] Motor de flujos (`flowEngine.ts`) + tipos + validadores + detector de interrupción
- [x] 6 definiciones de flujo, cada una llamando a la tool real correspondiente
- [x] Sub-flujos anidados (alta inline) probados 2 niveles de profundidad
- [x] Loop acotado de garantes (hasta 3)
- [x] `telegram/flowKeyboards.ts` + `telegram/menuDirecto.ts` + cableado en `telegram/index.ts`
- [x] Fix del alias `@/` inconsistente (bloqueaba los tests nuevos)
- [x] Typecheck, lint, 57 tests en verde (validadores, detector de interrupción, motor con flujos de prueba en memoria, teclados)
- [x] Verificación de punta a punta contra la base real (script descartable, borrado después): los 6 flujos, sub-flujos anidados, garantes, condicional de Finaer, e interrupción real — todo sin ninguna llamada a OpenAI
- [ ] Prueba manual por el usuario en Telegram real — no la pude ejecutar yo mismo (no tengo un cliente de Telegram); la lógica que corre detrás de cada botón está 100% verificada contra la base real, lo único no probado en vivo es el cableado fino de grammY (`ctx.reply`, `answerCallbackQuery`)

## Resultado

Dar de alta una persona, propiedad, contrato, pago o gasto, y cargar el Seguro Finaer, ahora se puede hacer 100% por botones, sin gastar una sola llamada a OpenAI — incluyendo casos con entidades que no existían todavía (se crean inline) y contratos con garantes. El texto libre sigue funcionando exactamente igual que antes para todo lo que requiere interpretación.
