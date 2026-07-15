# Asistente de administración de alquileres (bot de Telegram)

Bot de Telegram para centralizar la gestión de un portfolio de alquileres: propiedades, personas (inquilinos/propietarios/garantes), contratos y cobros. Entiende preguntas en lenguaje natural usando la API de OpenAI (function calling), contra una base Postgres (Supabase).

Este es el **v1 / MVP**: cubre personas, propiedades, contratos y pagos. Documentación, proveedores, reparaciones, control financiero completo y recordatorios automáticos quedan para fases siguientes (ver abajo).

## Requisitos

- Node.js 18 o superior (recomendado 20+)
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

### Comandos del bot

- `/agenda` — resumen completo: alquileres a cobrar, vencimientos próximos (contratos, seguros, impuestos/servicios) y reparaciones abiertas
- `/enviar_agenda` — dispara el recordatorio diario en el momento (para probarlo)
- `/reset` — empezar una conversación nueva (borra el historial de esa charla)
- `/ayuda` — ayuda

### Recordatorio diario automático

El bot manda una vez por día (por defecto 09:00, hora Argentina) el resumen de la agenda a los IDs autorizados. Se configura con `AGENDA_HORA`, `AGENDA_TIMEZONE` y `AGENDA_DIAS_ANTICIPACION` en el `.env`. **Requiere que el bot esté prendido a esa hora** — para que llegue siempre, hay que desplegarlo 24/7 (etapa siguiente).

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
    services/                   # lógica de negocio (pagos, vencimientos, agenda)
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

## Próximas fases (fuera de este v1)

- Documentación digital: subida real de contratos/pólizas/comprobantes a Supabase Storage.
- Base de datos de proveedores y su vínculo con reparaciones.
- Historial de reparaciones.
- Control financiero completo (ingresos/gastos/resultado neto por propiedad).
- Recordatorios automáticos push (recordar vencimientos por Telegram sin que preguntes), vía un job programado.
- Interfaz web, reutilizando `src/core` sin cambios.
