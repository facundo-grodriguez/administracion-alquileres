import { z } from "zod";
import { sinPagar, textoSinPagar } from "../../services/sinPagar.service.js";
import { defineTool } from "../defineTool.js";

export const listarSinPagarTool = defineTool({
  name: "listar_sin_pagar",
  description:
    "Todo lo que falta pagar, junto: gastos de propiedades cargados sin pagar y vencimientos de servicios del mes " +
    "(personales y de propiedades), agrupado en Personal y cada propiedad, con subtotales. Usar para '¿qué tengo " +
    "sin pagar?', '¿qué me falta pagar?', '¿cuánto debo de gastos?'.",
  inputSchema: z.object({}),
  run: async () => textoSinPagar(await sinPagar()),
});
