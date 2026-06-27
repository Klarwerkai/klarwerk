import { type AppServices, buildPgServices, buildServices } from "./build-app";
import { createPool, migrate } from "./db";
import { type SeedResult, seedDemo } from "./seed-demo";

// SCRUM-156/181: CLI-Runner für den Demo-Seed. Die eigentliche Seed-Logik liegt in `seed-demo.ts`
// (bewusst ohne build-app-Import, um Zyklen zu vermeiden). Hier nur die Service-Verdrahtung.
export { seedDemo, seedDemoForAdmin, type SeedResult, type DemoSeedServices } from "./seed-demo";

// CLI-Runner: mit DATABASE_URL gegen Postgres (persistent), sonst In-Memory (nur Smoke).
// In Produktion gesperrt, außer SEED_ALLOW_PROD=1 wird bewusst gesetzt.
export async function runSeed(): Promise<void> {
  if (process.env.NODE_ENV === "production" && process.env.SEED_ALLOW_PROD !== "1") {
    console.error("[seed:demo] In Produktion deaktiviert. Nur bewusst mit SEED_ALLOW_PROD=1.");
    process.exitCode = 1;
    return;
  }
  const databaseUrl = process.env.DATABASE_URL;
  let services: AppServices;
  if (databaseUrl) {
    const pool = createPool(databaseUrl);
    await migrate(pool);
    services = buildPgServices(pool);
  } else {
    console.warn(
      "[seed:demo] Kein DATABASE_URL — In-Memory-Lauf, Daten NICHT persistent. Für sichtbaren Review DATABASE_URL setzen.",
    );
    services = buildServices();
  }
  const result: SeedResult = await seedDemo(services);
  if (result.skipped) {
    console.warn("[seed:demo] Übersprungen: Instanz ist nicht leer (Bestand/Nutzer vorhanden).");
  } else {
    console.warn(`[seed:demo] Fertig: ${JSON.stringify(result)}`);
  }
}

// Nur ausführen, wenn die Datei direkt gestartet wird (nicht beim Import in Tests).
if (process.argv[1]?.endsWith("seed.ts")) {
  void runSeed();
}
