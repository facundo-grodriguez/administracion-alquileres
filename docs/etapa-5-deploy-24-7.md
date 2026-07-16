# Etapa 5 — Deploy 24/7 (Render free tier)

**Estado: ✅ Completada (código) — pendiente que el usuario cree la cuenta y despliegue**

## Objetivo

Sacar la dependencia de tener el bot corriendo local: que funcione (chat y recordatorio diario) sin depender de que la PC del administrador esté prendida.

## Decisión

**Render, plan free**, elegido explícitamente por el usuario con esta contrapartida conocida: el free tier duerme el proceso tras ~15 min sin tráfico HTTP entrante. Alternativa descartada: Background Worker pago (~7 USD/mes) que no duerme nunca — se prefirió no pagar, con las limitaciones que eso implica (ver abajo).

## Qué se implementa

### 1. Modo webhook
El bot corría solo por long-polling (`bot.start()`), que no genera tráfico HTTP entrante y por lo tanto nunca despertaría un servicio dormido. Se agregó un modo webhook en `src/interfaces/telegram/index.ts`, activado automáticamente si existe `RENDER_EXTERNAL_URL` (Render la define sola) o `WEBHOOK_URL` (override manual para otros hosts). Sin ninguna de las dos, sigue en long-polling — **desarrollo local no cambia**.

En modo webhook se levanta un servidor HTTP mínimo (`node:http`, sin agregar Express) que atiende `/telegram-webhook` con `webhookCallback(bot, "http")` de grammY, y responde `200 OK` a cualquier otra ruta — eso es lo que permite que un ping externo despierte el proceso sin necesidad de que sea tráfico de Telegram.

### 2. Ping externo antes del recordatorio diario
El problema central del free tier: un proceso dormido no dispara su propio `node-cron`. Si nadie le escribió al bot antes de `AGENDA_HORA`, el recordatorio de las 9am no sale.

Mitigación: `.github/workflows/keep-alive-ping.yml`, un workflow de GitHub Actions (gratis) que le pega una request al bot todos los días a las 11:50 UTC (08:50 ART, 10 min antes del default de `AGENDA_HORA`) para despertarlo a tiempo. Requiere el secret `BOT_URL` en el repo con la URL del servicio de Render. **No es 100% infalible** — GitHub documenta que los workflows programados pueden demorar bajo carga alta — pero cubre el caso normal sin costo.

**Importante**: si se cambia `AGENDA_HORA` en Render, hay que actualizar el cron del workflow a mano (queda documentado en el comentario del archivo).

### 3. `render.yaml`
Blueprint para que Render precargue casi toda la configuración (tipo de servicio, build/start command, variables con default) al crear el servicio desde el repo — solo quedan por completar a mano los 4 secrets (`OPENAI_API_KEY`, `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ALLOWED_USER_IDS`).

## Fuera de alcance / limitaciones conocidas

- El primer mensaje después de un período de inactividad va a tardar en responder (cold start de Render) — aceptado explícitamente por el usuario, uso de una sola persona por ahora.
- El recordatorio diario depende del ping externo llegando a horario; no hay garantía dura como la habría con el plan pago.
- No se probó el modo webhook contra un endpoint público real (no se puede sin desplegar) — se verificó por revisión de código, typecheck y que la firma de `webhookCallback(bot, "http")` matchea `node:http`. La verificación real queda para después del primer deploy.

## Progreso

- [x] Modo webhook agregado a `telegram/index.ts` (con fallback a long-polling en local)
- [x] `render.yaml`
- [x] `.github/workflows/keep-alive-ping.yml`
- [x] `.env.example` documentado (`PORT`, `WEBHOOK_URL`)
- [x] Typecheck, lint, 13 tests en verde
- [ ] Cuenta de Render creada y servicio desplegado (acción del usuario)
- [ ] Secret `BOT_URL` cargado en GitHub Actions (acción del usuario)
- [ ] Verificación end-to-end contra el deploy real (mensaje, `/agenda`, recordatorio diario)

## Resultado

Código listo para desplegar en Render free tier. Falta la parte que solo puede hacer el usuario: crear la cuenta, conectar el repo y cargar los secrets (guía paso a paso dada aparte).
