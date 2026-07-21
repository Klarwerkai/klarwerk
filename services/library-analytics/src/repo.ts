import type { ImportCandidate } from "./types";

// SCRUM-157: Persistenz-Schnittstelle der Import-/Source-Review-Queue. Einziger Unterschied
// zwischen In-Memory (Dev/Test) und Postgres. Insertionsreihenfolge bleibt erhalten.
export interface CandidateRepo {
  insert(candidate: ImportCandidate): Promise<void>;
  // SCRUM-510 (WP3): ATOMAR idempotenter Insert für den externalId-Upsert-Strang. Legt den Kandidaten NUR
  // an, wenn noch KEIN OFFENER (status "neu") Kandidat mit derselben (externalId, sourceVersion) existiert.
  // Gibt true zurück, wenn tatsächlich eingefügt wurde, false bei Kollision. Auf Postgres über einen
  // partiellen UNIQUE-Index + ON CONFLICT DO NOTHING — so legen selbst NEBENLÄUFIGE Läufe/Retries keine
  // Doppel-Kandidaten an (der app-seitige seen/pending-Check ist TOCTOU-anfällig, dieser Insert nicht).
  insertIfAbsent(candidate: ImportCandidate): Promise<boolean>;
  findById(id: string): Promise<ImportCandidate | undefined>;
  update(candidate: ImportCandidate): Promise<void>;
  all(): Promise<ImportCandidate[]>;
  // WP-D-CLEAN (Pedis Testdaten-Aufräumen): entfernt ALLE Kandidaten (jeden Status) aus der Queue
  // und gibt die Anzahl zurück. Kandidaten sind Queue-Einträge, keine Wissensobjekte — für sie ist
  // die harte Entfernung der vorgesehene Weg (kein Papierkorb-Vertrag wie bei KOs).
  removeAll(): Promise<number>;
}

// WP-SHIP8-FIX (bens F3): kanonischer Provider-Anteil ALLER Import-Schlüssel (Queue-Idempotenz,
// Orchestrator-Dedupe, acceptToKo-Anker-Suche). Getrimmt + kleingeschrieben (Adapter schreiben
// "Confluence"/"Jira"). EHRLICHER Fallback: ein Item OHNE Provider zählt als "confluence" — der
// EINZIGE Adapter, der vor Einführung des Provider-Schlüssels externalId-Items erzeugte
// (deckungsgleich mit dem Pg-Backfill der Bestandszeilen in IMPORT_CANDIDATES_SCHEMA).
export function importProviderKey(provider: string | null | undefined): string {
  const p = provider?.trim().toLowerCase();
  return p && p.length > 0 ? p : "confluence";
}

// SCRUM-510 (WP3): der Idempotenz-Schlüssel eines OFFENEN externalId-Kandidaten.
// WP-SHIP8-FIX (bens F3): DURCHGÄNGIG provider+externalId — (provider, externalId, sourceVersion).
// Vorher kollidierte eine Jira-externalId mit einer zufällig gleichen Confluence-pageId (ein
// offener Confluence-Kandidat blockierte den Jira-Kandidaten als vermeintliche Dublette).
// Fehlende sourceVersion zählt als 1 (deckungsgleich mit dem Orchestrator und dem pg-Generated-Column-COALESCE).
// Items ohne externalId haben KEINEN Schlüssel (kein Anker → keine externalId-Idempotenz).
export function openCandidateKey(candidate: ImportCandidate): string | null {
  const ext = candidate.item.externalId;
  if (!ext || candidate.status !== "neu") {
    return null;
  }
  return `${importProviderKey(candidate.item.provider)}@${ext}@${candidate.item.sourceVersion ?? 1}`;
}

export class InMemoryCandidateRepo implements CandidateRepo {
  // Map bewahrt die Einfügereihenfolge (wie die bisherige Array-Queue).
  private readonly items = new Map<string, ImportCandidate>();

  insert(candidate: ImportCandidate): Promise<void> {
    this.items.set(candidate.id, candidate);
    return Promise.resolve();
  }

  // Spiegelt den partiellen UNIQUE-Index von Postgres: kollidiert der offene (externalId@version)-Schlüssel
  // mit einem bereits offenen Kandidaten, wird NICHT eingefügt (false). Ohne Schlüssel (kein externalId) →
  // immer einfügen (true), wie der plain insert.
  insertIfAbsent(candidate: ImportCandidate): Promise<boolean> {
    const key = openCandidateKey(candidate);
    if (key) {
      for (const existing of this.items.values()) {
        if (openCandidateKey(existing) === key) {
          return Promise.resolve(false);
        }
      }
    }
    this.items.set(candidate.id, candidate);
    return Promise.resolve(true);
  }

  findById(id: string): Promise<ImportCandidate | undefined> {
    return Promise.resolve(this.items.get(id));
  }

  update(candidate: ImportCandidate): Promise<void> {
    this.items.set(candidate.id, candidate);
    return Promise.resolve();
  }

  all(): Promise<ImportCandidate[]> {
    return Promise.resolve([...this.items.values()]);
  }

  removeAll(): Promise<number> {
    const removed = this.items.size;
    this.items.clear();
    return Promise.resolve(removed);
  }
}
