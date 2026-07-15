# Asistente de administración de alquileres (bot de Telegram)

Bot de Telegram para centralizar la gestión de un portfolio de alquileres: propiedades, personas (inquilinos/propietarios/garantes), contratos y cobros. Entiende preguntas en lenguaje natural usando la API de Claude (Anthropic) con tool use, contra una base Postgres (Supabase).

Este es el **v1 / MVP**: cubre personas, propiedades, contratos y pagos. Documentación, proveedores, reparaciones, control financiero completo y recordatorios automáticos quedan para fases siguientes (ver abajo).

## Requisitos

- Node.js 18 o superior (recomendado 20+)
- Una cuenta y proyecto de [Supabase](https://supabase.com) (Postgres)
- Una API key de [Anthropic](https://console.anthropic.com)
- Un bot de Telegram (token de [@BotFather](https://t.me/BotFather))

## Setup

1. Instalar dependencias:

   ```sh
   npm install
   ```

2. Crear un bot en Telegram: escribile a [@BotFather](https://t.me/BotFather), mandá `/newbot`, seguí los pasos y guardá el **token** que te da.

3. En Supabase, copiar la connection string de Postgres: **Settings → Database → Connection string → "Transaction pooler"** (puerto 6543). Reemplazá `[YOUR-PASSWORD]` por la contraseña de tu base. Eso es tu `DATABASE_URL`.

4. Copiar `.env.example` a `.env` y completar:
   - `ANTHROPIC_API_KEY` (de console.anthropic.com)
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

- "¿Está pago el alquiler de Juan?"
- "¿Qué alquileres están atrasados?"
- "¿Qué contratos vencen este mes?"
- "Dá de alta a Pedro Fernández como nueva persona, DNI 32111222"

### Comandos del bot

- `/agenda` — resumen de vencimientos próximos y alquileres atrasados
- `/reset` — empezar una conversación nueva (borra el historial de esa charla)
- `/ayuda` — ayuda

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

Por defecto usa `claude-opus-4-8` (máxima calidad). Para este caso de uso, `claude-sonnet-5` alcanza de sobra y cuesta bastante menos — si querés bajar costos, poné `CLAUDE_MODEL=claude-sonnet-5` en el `.env`.

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
      claudeClient.ts
      chatSession.ts            # orquesta el Tool Runner de Claude, devuelve el texto de la respuesta
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
