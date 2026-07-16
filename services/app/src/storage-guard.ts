// SCRUM (Betriebssicherheit, 06.07. / SCRUM-498 B3): Verhindert, dass ein FEHLKONFIGURIERTES
// Prod-Deployment still auf nicht-dauerhaftem, nicht quell-gebundenem In-Memory-/Journal-Speicher läuft.
// In Produktion (NODE_ENV=production, so setzt es das Dockerfile) MUSS DATABASE_URL gesetzt sein →
// PgKoRepo (dauerhaft + quell-gebundenes SQL LIMIT). Fehlt sie, fiele der Code auf InMemory/Journal
// zurück (Datenverlust bei jedem Neustart/Deploy, KO-Bestand nicht quell-gebunden) — der Start bricht
// dann FAIL-CLOSED laut ab. Ein expliziter Override (KLARWERK_ALLOW_INMEMORY_PROD=1) erlaubt den
// In-Memory-Pfad bewusst (z. B. für einen künftigen, noch NICHT implementierten Insel-/sqlite-vec-Modus),
// dann nur mit lauter Warnung. Rein und testbar — keine Prozess-/Env-Nebenwirkungen hier.

export interface StorageEnv {
  databaseUrl: string | undefined;
  nodeEnv: string | undefined;
  // KLARWERK_ALLOW_INMEMORY_PROD=1: bewusster Override, um in Produktion OHNE DATABASE_URL zu starten.
  allowInMemoryProd: string | undefined;
}

export class StoragePersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoragePersistenceError";
  }
}

// Ergebnis der Prüfung: Start erlaubt (leer) — oder erlaubt, aber mit lauter Warnung (Override in
// Produktion). Fail-closed → Wurf (StoragePersistenceError), kein Rückgabewert.
export interface StorageGuardDecision {
  warning?: string;
}

// Wirft in Produktion, wenn DATABASE_URL fehlt und der Override nicht gesetzt ist. Das Journal
// (KLARWERK_DEV_PERSIST) zählt bewusst NICHT als prod-tauglich: es persistiert zwar den InMemory-Stand,
// die Datenhaltung bleibt aber InMemoryKoRepo (nicht quell-gebunden). In Nicht-Produktion (lokale
// Entwicklung/Tests) ist In-Memory/Journal unverändert erlaubt.
export function assertPersistentStore(env: StorageEnv): StorageGuardDecision {
  // Nicht-Produktion: In-Memory/Journal bewusst erlaubt (Verhalten unverändert).
  if (env.nodeEnv !== "production") {
    return {};
  }
  // Produktion MIT DATABASE_URL → PgKoRepo (dauerhaft, quell-gebunden). Live-Pfad, unverändert.
  if (env.databaseUrl?.trim()) {
    return {};
  }
  // Produktion OHNE DATABASE_URL: der Code fiele auf InMemory/Journal zurück.
  if (env.allowInMemoryProd?.trim() === "1") {
    // Bewusster Override → Start erlaubt, aber laut warnen.
    return {
      warning:
        "KLARWERK WARN: NODE_ENV=production OHNE DATABASE_URL — Start mit nicht-dauerhaftem " +
        "In-Memory-Speicher, weil KLARWERK_ALLOW_INMEMORY_PROD=1 gesetzt ist. Daten gehen bei jedem " +
        "Neustart/Deploy verloren und der KO-Bestand ist NICHT quell-gebunden (kein PgKoRepo).",
    };
  }
  // Default: fail-closed.
  throw new StoragePersistenceError(
    "KLARWERK-Start abgebrochen: NODE_ENV=production OHNE DATABASE_URL würde nicht-dauerhaften, " +
      "nicht quell-gebundenen In-Memory-Speicher verwenden (Datenverlust bei jedem Neustart/Deploy, " +
      "inklusive Konten). Setze DATABASE_URL (PgKoRepo) — oder setze KLARWERK_ALLOW_INMEMORY_PROD=1, " +
      "um dies bewusst zu überstimmen (z. B. für einen künftigen, noch nicht implementierten " +
      "Insel-/sqlite-vec-Modus).",
  );
}
