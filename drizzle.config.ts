import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("Falta la variable de entorno DATABASE_URL (ver .env.example)");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/core/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: databaseUrl,
  },
  strict: true,
  verbose: true,
});
