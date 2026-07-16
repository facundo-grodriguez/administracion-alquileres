# Asistente de administración de alquileres (bot de Telegram)

Bot de Telegram para centralizar la gestión de un portfolio de alquileres: propiedades, personas (inquilinos/propietarios/garantes), contratos, cobros, seguros, impuestos/servicios, reparaciones (con proveedor asignado), documentación (links a Google Drive) y control financiero básico. Entiende preguntas en lenguaje natural usando la API de OpenAI (function calling), contra una base Postgres (Supabase), y manda un resumen de agenda proactivo una vez por día.

**Versión actual: v6** (ver [docs/roadmap.md](docs/roadmap.md) para el detalle de qué se hizo en cada etapa y qué queda pendiente — interfaz web y WhatsApp, confirmadas para más adelante).

## Requisitos

- Node.js 22 o superior (probado con 24 LTS)
- Una cuenta y proyecto de [Supabase](https://supabase.com) (Postgres)
- Una API key de [OpenAI](https://platform.openai.com/api-keys)
- Un bot de Telegram (token de [@BotFather](https://t.me/BotFather))

## Setup

1. Instalar dependencias:

   ```sh
   npm install
   ```

2. Crear un bot en Telegram: escribile a [@BotFather](https://t.me/BotFather), mandá `/newbot`, seguí los pasos y guardá el **token** que te da.

3. En Supabase, copiar la connection string de Postgres: **Settings → Database → Connection string → "Transaction pooler"** (puerto 6543). Reemplazá `[YOUR-PASSWORD]` por la contraseña de tu base. Eso es tu `DATABASE_URL`.

4. Copiar `.env.example` a `.env` y completar:
   - `OPENAI_API_KEY` (de platform.openai.com/api-keys)
   - `DATABASE_URL` (la connection string del paso anterior)
   - `TELEGRAM_BOT_TOKEN` (el del paso 2)
   - `TELEGRAM_ALLOWED_USER_IDS` se completa en el paso 7

   ```sh
   cp .env.example .env
   ```

5. Aplicar la migración inicial contra la base de Supabase:

   ```sh
   npm run db:migrate
   ```

6. (Opcional, recomendado para probar) Cargar datos de ejemplo:

   ```sh
   npm run seed
   ```

7. **Autorizar tu usuario de Telegram** (importante: un bot es público, así que solo responden los IDs autorizados):

   ```sh
   npm run bot
   ```

   Con el bot corriendo, mandale cualquier mensaje desde Telegram. Como todavía no estás autorizado, te va a responder con **tu ID de Telegram**. Copiá ese número, ponelo en `TELEGRAM_ALLOWED_USER_IDS` en el `.env` (separá con comas si hay varios) y reiniciá el bot (`Ctrl+C` y de nuevo `npm run bot`).

8. Listo. Ahora escribile al bot en lenguaje natural.

### Preguntas de ejemplo (con los datos de `npm run seed`)

- "¿Qué tengo pendiente hoy?"
- "¿Está pago el alquiler de Juan?"
- "¿Qué alquileres están atrasados?"
- "¿Qué seguros tengo que renovar?"
- "¿Qué vence esta semana?"
- "¿Qué reparaciones tengo abiertas?"
- "Cargá un seguro de La Caja para [propiedad] que vence el 30/08"
- "Dá de alta a Pedro Fernández como nueva persona, DNI 32111222"
- "Cargá una reparación en [propiedad]: se rompió tal cosa, la hace [proveedor], costo 50000"
- "Buscame un plomero en [zona]"
- "¿Quién paga el internet de [propiedad], el propietario o el inquilino?"
- "Vinculá la carpeta de Drive de [propiedad]: [link]"
- "Mostrame la documentación de [propiedad]"
- "¿Cómo viene el balance de [propiedad] este mes?"

### Comandos del bot

- `/agenda` — resumen completo: alquileres a cobrar, vencimientos próximos (contratos, seguros, impuestos/servicios) y reparaciones abiertas
- `/enviar_agenda` — dispara el recordatorio diario en el momento (para probarlo)
- `/reset` — empezar una conversación nueva (borra el historial de esa charla)
- `/ayuda` — ayuda

### Recordatorio diario automático

El bot manda una vez por día (por defecto 09:00, hora Argentina) el resumen de la agenda a los IDs autorizados. Se configura con `AGENDA_HORA`, `AGENDA_TIMEZONE` y `AGENDA_DIAS_ANTICIPACION` en el `.env`. **Requiere que el bot esté corriendo a esa hora** — corriendo local, depende de que la PC esté prendida; desplegado en Render (ver [Deploy](#deploy-247) abajo) corre solo, con la salvedad del free tier que se explica ahí.

## Deploy 24/7

Para que el bot funcione sin depender de la PC del administrador, ver la guía paso a paso en [`docs/etapa-5-deploy-24-7.md`](docs/etapa-5-deploy-24-7.md). Resumen: se despliega en [Render](https://render.com) (plan free) usando el `render.yaml` de este repo, con un modo webhook (en vez de long-polling) que le permite al servicio recibir mensajes aunque el free tier lo duerma por inactividad. Como el free tier no corre nada mientras está dormido, el recordatorio diario depende de un ping externo (gratis, vía GitHub Actions) que lo despierta un rato antes de `AGENDA_HORA` — ver el detalle y las limitaciones conocidas en el documento de la etapa.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run bot` | Inicia el bot de Telegram (interfaz principal) |
| `npm run chat` | Chat por consola (útil para probar sin Telegram) |
| `npm run seed` | Carga datos de prueba en la base |
| `npm run db:generate` | Genera una migración SQL a partir de `src/core/db/schema.ts` |
| `npm run db:migrate` | Aplica las migraciones pendientes contra `DATABASE_URL` |
| `npm test` | Corre los tests (Vitest) |
| `npm run lint` | Corre Biome (lint) |
| `npm run format` | Formatea el código con Biome |

## Sobre el modelo y el costo

Por defecto usa `gpt-5.4` (buen equilibrio calidad/costo, sin requerir verificación extra de cuenta). Se cambia con `OPENAI_MODEL` en el `.env`.

La familia más nueva `gpt-5.6` (tiers `sol` / `terra` / `luna`) puede devolver **401** aunque tengas crédito cargado: aparece listada en la API pero tiene un rollout gateado — hace falta que OpenAI habilite el acceso a nivel organización (revisá platform.openai.com/settings/organization/general). No es un bug del proyecto.

## Estructura

```
src/
  config/env.ts                # validación de variables de entorno
  core/
    db/                        # schema Drizzle, cliente de DB, cliente de Storage (fase 2)
    repositories/               # acceso tipado a cada tabla
    services/                   # lógica de negocio (pagos, vencimientos, agenda, reparaciones, movimientos financieros)
    assistant/
      systemPrompt.ts
      openaiClient.ts
      defineTool.ts              # tipo/helper de tool agnóstico al proveedor de LLM
      chatSession.ts            # loop de tool-calling con la Chat Completions API de OpenAI
      tools/                    # una tool por archivo + index.ts
  interfaces/
    telegram/index.ts           # bot de Telegram (interfaz principal)
    cli/index.ts                # chat por consola (para pruebas)
scripts/seed.ts
tests/
```

El core (`src/core`) es agnóstico de interfaz: Telegram y la CLI son capas delgadas de entrada/salida sobre la misma lógica. Agregar una web app más adelante no requiere reescribir nada.

## Seguridad

- El bot solo responde a los IDs listados en `TELEGRAM_ALLOWED_USER_IDS`. A cualquier otro le contesta que no está autorizado (y le muestra su ID, para que puedas agregarlo si corresponde).
- El `.env` está en `.gitignore`: nunca lo subas al repo.

## Historial de versiones

- **v1 — MVP**: personas, propiedades, contratos, pagos.
- **v2 — Agenda y recordatorios**: seguros, impuestos/servicios, reparaciones, agenda unificada, recordatorio diario proactivo.
- **v3 — Proveedores, documentación y financiero**: proveedores asignables a reparaciones, comprobantes adjuntos, responsable de pago en obligaciones, documentación con links a Drive, balance de ingresos/gastos por propiedad.
- **v4 — Lenguaje de negocio**: nunca muestra IDs internos ni fechas ISO; confirmaciones completas en lenguaje de administración inmobiliaria, con formato uniforme.
- **v5 — Deploy 24/7**: modo webhook + `render.yaml` para correr en Render sin depender de que el administrador tenga la PC prendida.
- **v6 — Garantes y balance** *(actual)*: consulta de garantes por chat; seguros e impuestos/servicios se pueden marcar como pagados y se reflejan solos en el balance financiero.

Detalle completo de cada etapa en [`docs/`](docs/README.md).

## Próximas fases

- Interfaz web: panel de solo lectura (agenda, balance, listados), reutilizando `src/core` sin cambios.
- WhatsApp como canal adicional (costo no es problema para este volumen, pero requiere verificación de Meta Business).

Edición/borrado de datos, subida real de archivos y recordatorios por-evento escalados se evaluaron y se descartaron por ahora — ver [docs/roadmap.md](docs/roadmap.md) para el detalle de por qué.
