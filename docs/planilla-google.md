# Planilla de Google (v9.10.0)

El bot mantiene al día una planilla de Google Sheets con todo lo cargado. Se actualiza sola unos
segundos después de cada cambio en el bot (y una vez por día, cuando cambian los meses atrasados).
Las consultas no la tocan: solo se reescribe si algo cambió.

## Pestañas

| Pestaña | Qué tiene |
|---|---|
| **Resumen** | Una fila por propiedad: propietario, si está alquilada o libre, inquilino, alquiler actual, cobrado / gastos / neto del año (lo mismo que 💵 Balance) y meses adeudados. Total al final. |
| **Alquileres** | Mes a mes de cada contrato (el más nuevo arriba): monto, vencimiento, estado (Pagado / Pendiente / Atrasado / Parcial) y fecha de pago. |
| **Gastos propiedades** | Cada gasto de cada propiedad: rubro, detalle, quién paga, monto, estado, fecha de pago y si resta del balance. Incluye los servicios de propiedad pagados desde el recordatorio. |
| **Servicios personales** | Tus servicios (Monotributo, celular...) mes a mes, hasta el mes que viene: monto, estado y fecha de pago. |

Cada pestaña tiene filtro en el encabezado. **No escribas a mano dentro de estas pestañas**: el bot las
reescribe enteras en cada actualización. Si querés hacer cuentas propias, usá una pestaña nueva (el bot
no toca las pestañas que no son suyas) o una copia.

Para bajarla como Excel: Archivo → Descargar → Microsoft Excel (.xlsx).

## Configuración (una sola vez, ~10 minutos)

El bot escribe con una **cuenta de servicio** de Google: una cuenta técnica gratuita que solo puede
tocar las planillas que le compartas. No usa tu contraseña.

1. Entrá a <https://console.cloud.google.com> con tu cuenta de Google y creá un proyecto
   (arriba a la izquierda → *Nuevo proyecto*, ej. "Bot alquileres").
2. Con ese proyecto elegido, buscá **Google Sheets API** en la barra de arriba y tocá **Habilitar**.
3. Menú → *IAM y administración* → **Cuentas de servicio** → *Crear cuenta de servicio*. Poné un nombre
   (ej. "planilla") → *Crear y continuar* → *Listo* (no hace falta darle roles).
4. Entrá a la cuenta creada → pestaña **Claves** → *Agregar clave* → *Crear clave nueva* → **JSON**.
   Se descarga un archivo `.json`. **Es secreto**: no lo mandes por chat ni lo subas al repo.
5. Copiá el mail de la cuenta de servicio (termina en `@...iam.gserviceaccount.com`).
6. Abrí la planilla en Google Drive → **Compartir** → pegá ese mail como **Editor** → *Enviar*.
7. En Render → el servicio del bot → **Environment** → agregá:
   - `GOOGLE_SERVICE_ACCOUNT_JSON`: abrí el `.json` con el Bloc de notas y pegá **todo** el contenido.
   - `GOOGLE_SHEET_ID`: el link de la planilla (o solo el ID que está en el link, entre `/d/` y `/edit`).
8. *Save Changes*. Render reinicia el bot y a los pocos segundos la planilla se llena.

En Telegram, `/planilla` la actualiza en el momento y te manda el link. En 🔎 Consultas aparece el botón
**📊 Planilla de Google**.

## Si no se actualiza

- `/planilla` te dice el motivo. El más común: la planilla no está compartida como **Editor** con el mail
  de la cuenta de servicio.
- En los Logs de Render, buscá "planilla". Si dice *Planilla de Google desactivada*, falta alguna de las
  dos variables o el JSON está incompleto.
