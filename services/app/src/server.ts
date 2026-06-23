import { buildApp, buildPgServices, buildServices } from "./build-app";
import { createPool, migrate } from "./db";

// Laufzeit-Einstiegspunkt. Mit DATABASE_URL → Postgres (Migration + echte DB);
// ohne → In-Memory (lokaler Schnellstart). Läuft identisch auf Hetzner/On-Prem/Cloud.
async function pgServices(databaseUrl: string) {
  const pool = createPool(databaseUrl);
  await migrate(pool);
  return buildPgServices(pool);
}

async function start(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  const services = databaseUrl ? await pgServices(databaseUrl) : buildServices();
  const app = buildApp(services);
  const port = Number(process.env.PORT ?? "3001");
  await app.listen({ port, host: "0.0.0.0" });
  app.log.info(`KLARWERK API läuft auf :${port}`);
}

start().catch((error) => {
  process.stderr.write(`Serverstart fehlgeschlagen: ${String(error)}\n`);
  process.exit(1);
});
