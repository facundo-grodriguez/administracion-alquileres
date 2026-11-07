// Flujos de las cuentas personales (v9.13.0), sin IA:
// "📒 Cuenta del mes" modifica un rubro el mes que fue distinto a lo reservado; "⚙️ Rubros de cuentas" agrega, cambia,
// vincula o saca rubros.
import { cargarCuentaTool, configurarCuentaTool } from "../../assistant/tools/cuentas.tool.js";
import * as cuentasRepo from "../../repositories/cuentas.repository.js";
import * as serviciosRepo from "../../repositories/serviciosVencimiento.repository.js";
import { formatoARS } from "../../util/formato.js";
import { type CandidatoFlujo, type DatosFlujo, type DefinicionFlujo, etiquetaKey } from "../types.js";

type Rubro = Awaited<ReturnType<typeof cuentasRepo.listarActivos>>[number];

const etiquetaRubro = (r: Rubro) =>
  `${r.tipo === "ingreso" ? "💵" : "🧾"} ${r.nombre}${r.previsto ? ` — ${formatoARS(r.previsto)}` : ""}${r.servicio ? ` · 🔗 ${r.servicio.nombre}` : ""}`;

async function rubros(query: string, filtro: (r: Rubro) => boolean = () => true): Promise<CandidatoFlujo[]> {
  const q = query.trim().toLowerCase();
  return (await cuentasRepo.listarActivos())
    .filter(filtro)
    .filter((r) => !q || r.nombre.toLowerCase().includes(q))
    .map((r) => ({ id: r.nombre, etiqueta: etiquetaRubro(r) }));
}

export const cargarCuentaFlow: DefinicionFlujo = {
  id: "cargar_cuenta",
  titulo: "📒 Cuenta del mes",
  etiqueta: (datos) => datos[etiquetaKey("rubro")] as string,
  pasos: [
    {
      id: "rubro",
      pregunta: () => "¿Qué rubro fue distinto este mes? (lo reservado ya cuenta como gastado)",
      campo: { tipo: "entidad", buscar: (q) => rubros(q), maxListado: 20 },
    },
    {
      id: "monto",
      pregunta: () => "¿Cuánto fue este mes?",
      campo: { tipo: "monto" },
    },
    {
      id: "__confirmar",
      pregunta: (datos) =>
        `Confirmá: ${datos.rubro} de este mes — ${formatoARS(datos.monto as string)} (en vez de lo reservado).`,
      campo: { tipo: "confirmacion" },
    },
  ],
  ejecutar: (datos) =>
    cargarCuentaTool.run({ rubro: datos.rubro as string, monto: datos.monto as string, modo: "total" }),
};

const ACCIONES = [
  { valor: "agregar", etiqueta: "➕ Agregar rubro" },
  { valor: "monto", etiqueta: "✏️ Cambiar lo reservado" },
  { valor: "vincular", etiqueta: "🔗 Vincular a un vencimiento" },
  { valor: "desvincular", etiqueta: "✂️ Desvincular" },
  { valor: "quitar", etiqueta: "🗑️ Quitar rubro" },
];

const nombreRubro = (datos: DatosFlujo) =>
  String(datos.accion === "agregar" ? (datos.nombre ?? "") : (datos.rubro ?? "")).trim();

async function vencimientosPersonales(query: string): Promise<CandidatoFlujo[]> {
  const q = query.trim().toLowerCase();
  return (await serviciosRepo.listarActivos())
    .filter((s) => !s.propiedadId)
    .filter((s) => !q || s.nombre.toLowerCase().includes(q))
    .map((s) => ({ id: s.nombre, etiqueta: `📅 ${s.nombre}${s.monto ? ` — ${formatoARS(s.monto)}` : ""}` }));
}

function textoConfirmar(datos: DatosFlujo): string {
  const nombre = nombreRubro(datos);
  switch (datos.accion) {
    case "agregar":
      return `Confirmá: agregar ${nombre} (${datos.tipo === "ingreso" ? "💵 ingreso" : "🧾 gasto"}) — ${formatoARS(datos.previsto as string)} por mes.`;
    case "monto":
      return `Confirmá: ${nombre} pasa a ${formatoARS(datos.previsto as string)} por mes.`;
    case "vincular":
      return `Confirmá: vincular ${nombre} al vencimiento ${datos.vencimiento}. Cuando lo pagues, cuenta lo pagado en vez de lo reservado.`;
    case "desvincular":
      return `Confirmá: separar ${nombre} de su vencimiento. Cuenta lo reservado y, si un mes es distinto, lo modificás vos.`;
    default:
      return `Confirmá: sacar ${nombre} de tus cuentas (lo ya cargado queda guardado).`;
  }
}

export const configurarCuentaFlow: DefinicionFlujo = {
  id: "configurar_cuenta",
  titulo: "⚙️ Rubros de cuentas",
  etiqueta: nombreRubro,
  pasos: [
    { id: "accion", pregunta: () => "¿Qué querés hacer?", campo: { tipo: "opciones", opciones: ACCIONES } },
    {
      id: "rubro",
      pregunta: () => "¿Qué rubro?",
      campo: {
        tipo: "entidad",
        buscar: (q, datos) =>
          rubros(q, (r) =>
            datos.accion === "desvincular"
              ? Boolean(r.servicioId)
              : datos.accion === "vincular"
                ? r.tipo === "gasto" && !r.servicioId
                : true,
          ),
        maxListado: 20,
      },
      saltar: (datos) => datos.accion === "agregar",
    },
    {
      id: "nombre",
      pregunta: () => "¿Cómo se llama el rubro? (ej. Compras, Nafta, Sueldo)",
      campo: { tipo: "texto" },
      saltar: (datos) => datos.accion !== "agregar",
    },
    {
      id: "tipo",
      pregunta: () => "¿Es un gasto o un ingreso?",
      campo: {
        tipo: "opciones",
        opciones: [
          { valor: "gasto", etiqueta: "🧾 Gasto" },
          { valor: "ingreso", etiqueta: "💵 Ingreso (sueldo)" },
        ],
      },
      saltar: (datos) => datos.accion !== "agregar",
    },
    {
      id: "previsto",
      pregunta: (datos) => (datos.tipo === "ingreso" ? "¿Cuánto cobrás por mes?" : "¿Cuánto reservás por mes?"),
      campo: { tipo: "monto" },
      saltar: (datos) => datos.accion !== "agregar" && datos.accion !== "monto",
    },
    {
      id: "vencimiento",
      pregunta: () => "¿A qué vencimiento? (cuando lo pagues, cuenta lo pagado en vez de lo reservado)",
      campo: { tipo: "entidad", buscar: vencimientosPersonales, maxListado: 20 },
      saltar: (datos) => datos.accion !== "vincular",
    },
    { id: "__confirmar", pregunta: textoConfirmar, campo: { tipo: "confirmacion" } },
  ],
  ejecutar: (datos) =>
    configurarCuentaTool.run({
      nombre: nombreRubro(datos),
      tipo: datos.accion === "agregar" ? (datos.tipo === "ingreso" ? "ingreso" : "gasto") : undefined,
      previsto: (datos.previsto as string | undefined) ?? undefined,
      vencimiento: datos.accion === "vincular" ? (datos.vencimiento as string) : undefined,
      desvincular: datos.accion === "desvincular" || undefined,
      quitar: datos.accion === "quitar" || undefined,
    }),
};
