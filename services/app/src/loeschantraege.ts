// ================================================================================================
// BETROFFENENRECHTE · DER LÖSCHANTRAG EINES MITARBEITERS (R-0661, DS14).
// ================================================================================================
//
// Ein Mitarbeiter stellt im Profil einen Antrag auf Löschung seines Kontos; daraus entsteht eine
// Aufgabe für den Verwalter MIT FRIST. Bis hierher konnte nur der Verwalter löschen, und ein
// Wunsch des Betroffenen lief ausserhalb des Systems.
//
// WAS DER ANTRAG IST — UND WAS NICHT:
//   · Er ist eine AUFGABE, keine Löschung. Gelöscht wird erst, wenn ein Verwalter den Antrag
//     erledigt — über GENAU den vorhandenen Löschweg (`AuthService.deleteUser`) mit seinem
//     Letzter-Admin-Schutz und seinem Beleg `user.delete`. Es gibt keinen zweiten Löschweg.
//   · Was dieser Löschweg heute entfernt, bleibt unverändert: Konto und Anmeldesitzungen. Beiträge,
//     Bewertungen, Kommentare und Protokollzeilen tragen die Kennung weiter. Das Umschreiben aller
//     Verweise auf „ehemaliger Nutzer" ist ein gesonderter, offener Auftrag (R-0642, Ownerfrage 2
//     in `docs/entscheidungen/loeschung-aufbewahrung.md`) und wird hier NICHT vorweggenommen.
//
// DIE FRIST: ein Monat ab Antragstellung — die Regelfrist für die Beantwortung eines Antrags der
// betroffenen Person (DSGVO Art. 12 Abs. 3 Satz 1). Die Verlängerung nach Satz 2 ist nicht
// abgebildet; ein Verwalter, der sie in Anspruch nimmt, begründet das beim Ablehnen bzw. ausserhalb.
//
// KEIN FREITEXT IM PRÜFPROTOKOLL: die optionale Begründung des Antragstellers und der
// Ablehnungsgrund stehen nur am Antrag. Das append-only Protokoll trägt Kennungen und Frist —
// es ist nicht löschbar, ein Freitext darin wäre es also auch nicht.
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";

export type LoeschantragStatus = "offen" | "erledigt" | "abgelehnt" | "zurueckgezogen";

export interface Loeschantrag {
  id: string;
  nutzerId: string;
  /** ISO-8601. */
  gestelltAm: string;
  /** ISO-8601 — ein Kalendermonat nach `gestelltAm` (Art. 12 Abs. 3 Satz 1). */
  fristBis: string;
  /** Optional, vom Antragsteller; höchstens `LOESCHANTRAG_GRENZEN.begruendung` Zeichen. */
  begruendung: string | null;
  status: LoeschantragStatus;
  /** Wer abschliessend entschieden hat (Verwalter) bzw. der Antragsteller beim Zurückziehen. */
  entschiedenVon: string | null;
  entschiedenAm: string | null;
  /** Pflicht beim Ablehnen; beim Erledigen optional (etwa „Konto war bereits gelöscht"). */
  entscheidungsgrund: string | null;
}

export const LOESCHANTRAG_GRENZEN = { begruendung: 2000, grund: 2000 } as const;

/** Ein Kalendermonat nach `gestelltAm`; fällt der Tag weg (31.01. → Februar), der Monatsletzte. */
export function loeschantragFrist(gestelltAm: Date): Date {
  const frist = new Date(gestelltAm.getTime());
  const tag = frist.getUTCDate();
  frist.setUTCDate(1);
  frist.setUTCMonth(frist.getUTCMonth() + 1);
  const monatsende = Date.UTC(frist.getUTCFullYear(), frist.getUTCMonth() + 1, 0);
  const letzter = new Date(monatsende).getUTCDate();
  frist.setUTCDate(Math.min(tag, letzter));
  return frist;
}

/** Ein offener Antrag ist überfällig, sobald seine Frist verstrichen ist. */
export function istUeberfaellig(antrag: Loeschantrag, jetzt: number): boolean {
  return antrag.status === "offen" && Date.parse(antrag.fristBis) < jetzt;
}

export type LoeschantragFehlerCode =
  | "BEREITS_OFFEN"
  | "NICHT_GEFUNDEN"
  | "NICHT_OFFEN"
  | "GRUND_FEHLT"
  | "ZU_LANG"
  | "NICHT_HALTBAR";

export class LoeschantragFehler extends Error {
  readonly code: LoeschantragFehlerCode;

  constructor(code: LoeschantragFehlerCode, message: string) {
    super(message);
    this.code = code;
    this.name = "LoeschantragFehler";
  }
}

export function neuerLoeschantrag(
  nutzerId: string,
  begruendung: string | null,
  jetzt: Date,
): Loeschantrag {
  const text = begruendung?.trim() ?? "";
  if (text.length > LOESCHANTRAG_GRENZEN.begruendung) {
    throw new LoeschantragFehler(
      "ZU_LANG",
      `Die Begründung darf höchstens ${LOESCHANTRAG_GRENZEN.begruendung} Zeichen lang sein.`,
    );
  }
  return {
    id: randomUUID(),
    nutzerId,
    gestelltAm: jetzt.toISOString(),
    fristBis: loeschantragFrist(jetzt).toISOString(),
    begruendung: text.length > 0 ? text : null,
    status: "offen",
    entschiedenVon: null,
    entschiedenAm: null,
    entscheidungsgrund: null,
  };
}

/** Ein offener Antrag als Aufgabe in der Glocke der Verwaltung. */
export interface LoeschantragMeldung {
  antragId: string;
  /** Der Name des Antragstellers; die Kennung, falls das Konto nicht (mehr) besteht. */
  name: string;
  at: string;
  fristBis: string;
  ueberfaellig: boolean;
}

/** Die offenen Anträge als Verwalteraufgaben — älteste Frist zuerst. */
export async function offeneLoeschantragMeldungen(
  repo: Pick<LoeschantragRepo, "alle">,
  listUsers: () => Promise<ReadonlyArray<{ id: string; name: string }>>,
  jetzt: number,
): Promise<LoeschantragMeldung[]> {
  const [antraege, konten] = await Promise.all([repo.alle(), listUsers()]);
  return antraege
    .filter((a) => a.status === "offen")
    .sort((a, b) => a.fristBis.localeCompare(b.fristBis))
    .map((a) => ({
      antragId: a.id,
      name: konten.find((k) => k.id === a.nutzerId)?.name ?? a.nutzerId,
      at: a.gestelltAm,
      fristBis: a.fristBis,
      ueberfaellig: istUeberfaellig(a, jetzt),
    }));
}

/**
 * Die Ablage der Löschanträge.
 *
 * `lege` legt einen NEUEN offenen Antrag an und liefert `false`, wenn für dieses Konto bereits ein
 * offener Antrag besteht — Prüfen und Setzen sind unteilbar (Speicher: ohne `await` dazwischen;
 * PostgreSQL: partieller Unique-Index). `abschliessen` setzt den Endstand nur, wenn der Antrag noch
 * offen ist, und liefert sonst `false` — zwei Verwalter, die gleichzeitig entscheiden, schreiben
 * nicht übereinander.
 */
export interface LoeschantragRepo {
  lege(antrag: Loeschantrag): Promise<boolean>;
  abschliessen(antrag: Loeschantrag): Promise<boolean>;
  finde(id: string): Promise<Loeschantrag | undefined>;
  /** Alle Anträge, jüngste zuerst. */
  alle(): Promise<Loeschantrag[]>;
  /** Alle Anträge eines Kontos, jüngste zuerst. */
  vonNutzer(nutzerId: string): Promise<Loeschantrag[]>;
}

function nachZeitAbsteigend(a: Loeschantrag, b: Loeschantrag): number {
  return b.gestelltAm.localeCompare(a.gestelltAm) || b.id.localeCompare(a.id);
}

/**
 * Die Speicherfassung. `haltbarkeitZugesagt` ist gesetzt, wenn der Betrieb Haltbarkeit verspricht
 * (Desktop-Journal, `KLARWERK_DEV_PERSIST=1`) — dann lehnt sie Schreibvorgänge ab, statt einen
 * Antrag anzunehmen, der beim Neustart verschwände. Dieselbe Regel wie die Kenntnisnahme.
 */
export class InMemoryLoeschantragRepo implements LoeschantragRepo {
  private readonly zeilen = new Map<string, Loeschantrag>();

  constructor(private readonly haltbarkeitZugesagt = false) {}

  private schreibbar(): void {
    if (this.haltbarkeitZugesagt) {
      throw new LoeschantragFehler(
        "NICHT_HALTBAR",
        "Diese Instanz kann Löschanträge nicht dauerhaft speichern; deshalb wird nichts angenommen.",
      );
    }
  }

  // `async`, damit die Ablehnung wie bei PostgreSQL als abgelehnte Zusage ankommt; Prüfen und
  // Setzen bleiben unteilbar, weil dazwischen kein `await` steht.
  async lege(antrag: Loeschantrag): Promise<boolean> {
    this.schreibbar();
    for (const z of this.zeilen.values()) {
      if (z.nutzerId === antrag.nutzerId && z.status === "offen") {
        return false;
      }
    }
    this.zeilen.set(antrag.id, structuredClone(antrag));
    return true;
  }

  async abschliessen(antrag: Loeschantrag): Promise<boolean> {
    this.schreibbar();
    const bisher = this.zeilen.get(antrag.id);
    if (!bisher || bisher.status !== "offen") {
      return false;
    }
    this.zeilen.set(antrag.id, structuredClone(antrag));
    return true;
  }

  finde(id: string): Promise<Loeschantrag | undefined> {
    const z = this.zeilen.get(id);
    return Promise.resolve(z ? structuredClone(z) : undefined);
  }

  alle(): Promise<Loeschantrag[]> {
    return Promise.resolve(
      [...this.zeilen.values()].map((z) => structuredClone(z)).sort(nachZeitAbsteigend),
    );
  }

  async vonNutzer(nutzerId: string): Promise<Loeschantrag[]> {
    return (await this.alle()).filter((z) => z.nutzerId === nutzerId);
  }
}

/**
 * Die Tabelle der Löschanträge. REIN ADDITIV UND WIEDERHOLBAR: `CREATE TABLE IF NOT EXISTS` und
 * `CREATE (UNIQUE) INDEX IF NOT EXISTS`, kein DROP, kein TRUNCATE, kein Seed, kein Fremdschlüssel
 * (ein Antrag überlebt die Löschung des Kontos, das er betrifft — er ist ihr Nachweis).
 */
export const LOESCHANTRAG_SCHEMA = `
CREATE TABLE IF NOT EXISTS loeschantraege (
  id text PRIMARY KEY,
  nutzer_id text NOT NULL,
  status text NOT NULL,
  gestellt_am timestamptz NOT NULL,
  data jsonb NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS loeschantraege_ein_offener_je_nutzer
  ON loeschantraege(nutzer_id) WHERE status = 'offen';
CREATE INDEX IF NOT EXISTS idx_loeschantraege_gestellt ON loeschantraege(gestellt_am);
`;

interface AntragsZeile {
  data: Loeschantrag;
}

export class PgLoeschantragRepo implements LoeschantragRepo {
  constructor(private readonly pool: Pool) {}

  async lege(antrag: Loeschantrag): Promise<boolean> {
    const res = await this.pool.query(
      `INSERT INTO loeschantraege(id, nutzer_id, status, gestellt_am, data)
       VALUES($1,$2,$3,$4,$5)
       ON CONFLICT DO NOTHING`,
      [antrag.id, antrag.nutzerId, antrag.status, antrag.gestelltAm, JSON.stringify(antrag)],
    );
    return (res.rowCount ?? 0) === 1;
  }

  async abschliessen(antrag: Loeschantrag): Promise<boolean> {
    const res = await this.pool.query(
      `UPDATE loeschantraege SET status = $2, data = $3
        WHERE id = $1 AND status = 'offen'`,
      [antrag.id, antrag.status, JSON.stringify(antrag)],
    );
    return (res.rowCount ?? 0) === 1;
  }

  async finde(id: string): Promise<Loeschantrag | undefined> {
    const res = await this.pool.query<AntragsZeile>(
      "SELECT data FROM loeschantraege WHERE id = $1",
      [id],
    );
    return res.rows[0]?.data;
  }

  async alle(): Promise<Loeschantrag[]> {
    const res = await this.pool.query<AntragsZeile>(
      "SELECT data FROM loeschantraege ORDER BY gestellt_am DESC, id DESC",
    );
    return res.rows.map((z) => z.data);
  }

  async vonNutzer(nutzerId: string): Promise<Loeschantrag[]> {
    const res = await this.pool.query<AntragsZeile>(
      "SELECT data FROM loeschantraege WHERE nutzer_id = $1 ORDER BY gestellt_am DESC, id DESC",
      [nutzerId],
    );
    return res.rows.map((z) => z.data);
  }
}
