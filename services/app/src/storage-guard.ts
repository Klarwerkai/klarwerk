// SCRUM (Betriebssicherheit, 06.07.): Verhindert die „Konten still verloren"-Fehlerklasse.
// In Produktion (NODE_ENV=production, so setzt es das Dockerfile) MUSS eine dauerhafte Datenhaltung
// gesetzt sein — sonst läuft die App In-Memory und verliert bei jedem Neustart/Deploy ALLE Daten
// (inkl. Admin- und Tester-Konten). Statt still weiterzulaufen, bricht der Start laut und mit
// klarer Begründung ab, sodass der Fehler sofort im Log sichtbar ist und behoben wird.
// Rein und testbar — keine Prozess-/Env-Nebenwirkungen hier.

export interface StorageEnv {
  databaseUrl: string | undefined;
  journal: string | undefined;
  nodeEnv: string | undefined;
}

export class StoragePersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoragePersistenceError";
  }
}

// Wirft in Produktion, wenn WEDER DATABASE_URL (Postgres) NOCH ein Dev-Persistenz-Journal gesetzt
// ist. In Nicht-Produktion (lokale Entwicklung/Tests) ist In-Memory bewusst erlaubt.
export function assertPersistentStore(env: StorageEnv): void {
  const hasPersistentStore = Boolean(env.databaseUrl?.trim()) || Boolean(env.journal?.trim());
  if (hasPersistentStore) {
    return;
  }
  if (env.nodeEnv === "production") {
    throw new StoragePersistenceError(
      "KLARWERK-Start abgebrochen: In Produktion (NODE_ENV=production) MUSS eine dauerhafte " +
        "Datenhaltung gesetzt sein. Ohne sie liefe die App In-Memory und verlöre bei jedem " +
        "Neustart/Deploy ALLE Daten (inklusive Konten). Setze DATABASE_URL (Postgres) — oder für " +
        "den Desktop-Betrieb KLARWERK_DEV_PERSIST=1.",
    );
  }
}
