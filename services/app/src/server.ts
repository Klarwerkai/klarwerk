import { existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import fastifyHelmet from "@fastify/helmet";
import type { FastifyInstance } from "fastify";
import { buildApp, buildPgServices, buildServices } from "./build-app";
import { createPool, migrate } from "./db";
import { buildDevPersistServices } from "./dev-persist";
import { type FactoryReset, factoryResetUnavailable } from "./factory-reset";
import { assertPersistentStore } from "./storage-guard";
import { registerWebStatic } from "./web-static";

// Kanonische Domain (klarwerk.ai). app.<domain> wird dauerhaft hierher umgeleitet.
const CANONICAL_HOST = process.env.CANONICAL_HOST ?? "klarwerk.ai";

// Laufzeit-Einstiegspunkt. Mit DATABASE_URL → Postgres (Migration + echte DB);
// ohne → In-Memory (lokaler Schnellstart). Läuft identisch auf Hetzner/On-Prem/Cloud.
async function pgServices(databaseUrl: string) {
  const pool = createPool(databaseUrl);
  await migrate(pool);
  return buildPgServices(pool);
}

// State-of-the-Art Single-Origin-Auslieferung: Security-Header (HSTS/CSP/…),
// Kanonik-Redirect, noindex (Vorab-Phase) und die gebaute SPA als Fallback
// neben der API. Bleibt aus den Tests heraus (buildApp ist rein API).
async function configureWebDelivery(app: FastifyInstance): Promise<void> {
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    hsts: { maxAge: 31_536_000, includeSubDomains: true, preload: true },
  });

  // Kanonik: app.<domain> → 301 auf <domain> (pfaderhaltend).
  app.addHook("onRequest", async (request, reply) => {
    if (request.hostname === `app.${CANONICAL_HOST}`) {
      return reply.redirect(`https://${CANONICAL_HOST}${request.url}`, 301);
    }
  });

  // Vorab-Phase: nicht indexieren (zusätzlich zu robots.txt/Meta im Frontend).
  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("X-Robots-Tag", "noindex, nofollow");
    return payload;
  });

  // Gebaute SPA (Single-Origin). Fehlt das Verzeichnis (reiner API-Betrieb), bleibt es aus.
  const dist = join(dirname(fileURLToPath(import.meta.url)), "../../../apps/web/dist");
  if (!existsSync(dist)) {
    return;
  }
  // Statische Auslieferung + SPA-Fallback (Stale-Static-Fix, siehe web-static.ts).
  await registerWebStatic(app, dist);
}

// SCRUM-387: Dev-Persistenz-Journal der Desktop-App. Nur aktiv mit KLARWERK_DEV_PERSIST=1
// und OHNE DATABASE_URL (Postgres hat immer Vorrang — Produktion bleibt unberührt).
// Ablage: <repo>/.localdb/state.jsonl (gitignored), überschreibbar via KLARWERK_DEV_PERSIST_FILE.
function devPersistFile(): string | undefined {
  if (process.env.KLARWERK_DEV_PERSIST !== "1") {
    return undefined;
  }
  const override = process.env.KLARWERK_DEV_PERSIST_FILE;
  if (override) {
    return override;
  }
  return join(dirname(fileURLToPath(import.meta.url)), "../../..", ".localdb/state.jsonl");
}

// Pedi 05.07. (Beta): Werksreset NUR im Desktop/Dev-Journal-Modus. Löscht das lokale Journal
// (nächster Start = leere Instanz → Ersteinrichtung) und beendet danach den Prozess. In Produktion
// (Postgres) oder reinem In-Memory-Betrieb bleibt der Reset bewusst unverfügbar.
function makeFactoryReset(journal: string | undefined): FactoryReset {
  if (!journal) {
    return factoryResetUnavailable;
  }
  return {
    available: true,
    run: async () => {
      // Journal leeren → beim Neustart greift needsSetup() (erster Anwender wird wieder Admin).
      writeFileSync(journal, "", "utf8");
      // Kurzer Aufschub, damit die HTTP-Antwort noch flusht, dann den Prozess beenden.
      setTimeout(() => process.exit(0), 250);
    },
  };
}

async function start(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  const journal = devPersistFile();
  // Betriebssicherheit (SCRUM-498 B3): in Produktion NIE still auf InMemory/Journal starten. Ohne
  // DATABASE_URL (→ PgKoRepo) bricht der Start FAIL-CLOSED ab — außer KLARWERK_ALLOW_INMEMORY_PROD=1
  // ist bewusst gesetzt, dann nur eine laute Warnung.
  const storageDecision = assertPersistentStore({
    databaseUrl,
    nodeEnv: process.env.NODE_ENV,
    allowInMemoryProd: process.env.KLARWERK_ALLOW_INMEMORY_PROD,
  });
  if (storageDecision.warning) {
    process.stderr.write(`${storageDecision.warning}\n`);
  }
  const services = databaseUrl
    ? await pgServices(databaseUrl)
    : journal
      ? await buildDevPersistServices(journal)
      : buildServices();
  // Werksreset nur im Desktop/Dev-Journal-Modus (nie mit DATABASE_URL).
  const factoryReset = databaseUrl ? factoryResetUnavailable : makeFactoryReset(journal);
  const app = buildApp(services, { factoryReset });
  await configureWebDelivery(app);
  const port = Number(process.env.PORT ?? "3001");
  await app.listen({ port, host: "0.0.0.0" });
  // Ehrlicher Betriebsmodus im Log — hilft bei „warum sind meine Daten weg?"-Diagnosen.
  const mode = databaseUrl ? "Postgres" : journal ? "Dev-Persistenz (Journal)" : "In-Memory";
  app.log.info(`KLARWERK läuft auf :${port} — Datenhaltung: ${mode}`);
}

start().catch((error) => {
  process.stderr.write(`Serverstart fehlgeschlagen: ${String(error)}\n`);
  process.exit(1);
});
