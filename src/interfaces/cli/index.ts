import { stdin, stdout } from "node:process";
import readline from "node:readline/promises";
import { ChatSession } from "../../core/assistant/chatSession.js";
import { formatearResumenAgenda, obtenerResumenAgenda } from "../../core/services/agenda.service.js";

const COMANDOS_SALIDA = new Set(["salir", "exit", "quit"]);

async function main(): Promise<void> {
  console.log("Asistente de administración de alquileres");
  console.log("Escribí 'salir' para terminar.\n");

  try {
    const resumen = await obtenerResumenAgenda();
    console.log(formatearResumenAgenda(resumen));
    console.log();
  } catch (error) {
    console.error("No se pudo cargar el resumen de agenda:", error instanceof Error ? error.message : error);
  }

  const rl = readline.createInterface({ input: stdin, output: stdout });
  const session = new ChatSession();

  try {
    while (true) {
      const entrada = await rl.question("> ");
      const texto = entrada.trim();
      if (texto === "") continue;
      if (COMANDOS_SALIDA.has(texto.toLowerCase())) break;

      try {
        const respuesta = await session.enviarMensaje(texto);
        stdout.write(`\n${respuesta}\n\n`);
      } catch (error) {
        console.error("\nOcurrió un error:", error instanceof Error ? error.message : error, "\n");
      }
    }
  } finally {
    rl.close();
  }

  console.log("Hasta luego.");
}

main();
