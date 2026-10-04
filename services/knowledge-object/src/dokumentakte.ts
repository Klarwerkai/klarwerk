// ================================================================================================
// R-0169 (aufnahme:20260922:gesamt-import-adoption:herkunft-identitaet) — DIE INTERNE DOKUMENTAKTE.
// ================================================================================================
//
// WAS SIE IST. Ein importiertes Dokument, das KEINE externe Quellenkennung mitbringt (Word-Zusatz,
// JSON-Eintrag ohne `externalId`), bekommt hier eine EIGENE, dauerhafte Identität (`dokumentId`) und
// eine lückenlose Folge UNVERÄNDERLICHER Fassungen (1, 2, 3, …). Ein Wissensobjekt, das aus einer
// Fassung entsteht, trägt deren Bezug (`KnowledgeObject.dokumentHerkunft`) — weil der Bezug im
// Versionsschnappschuss des Objekts mitreist, lässt sich später sagen, aus welcher Fassung eine
// Aussage stammt.
//
// INTERN UND EXTERN BLEIBEN GETRENNT. Externe Quellen (Confluence, SharePoint, JSON mit
// `externalId`) haben ihre Identität im Quellsystem und ihre Revisionen in `ExternalSourceRecord`
// (services/library-analytics). Diese Akte ist ein EIGENER Bestand mit eigener Tabelle; eine externe
// Kennung wird hier nie als Dokumentkennung übernommen, und eine Dokumentkennung ist nie eine
// externe Kennung.
//
// DIE IDENTITÄT WIRD NIE ABGELEITET. Die `dokumentId` vergibt ausschliesslich Klarwerk (`randomUUID`)
// beim ersten Festschreiben. Sie wird nicht aus Titel, Inhalt oder Dateiname gebildet — zwei
// verschiedene Dokumente mit gleichem Text sind zwei Akten, und ein überarbeitetes Dokument bleibt
// dieselbe Akte, wenn der Aufrufer die einmal vergebene Kennung wieder mitbringt (Word: im Dokument
// gespeichert; JSON: als `dokumentId` am Eintrag). Eine mitgebrachte, aber hier unbekannte Kennung
// wird ABGEWIESEN (`DOKUMENT_UNBEKANNT`) — sie wird weder still neu angelegt noch übernommen.
//
// UNVERÄNDERLICH heisst wörtlich: der Repo-Vertrag kennt kein Update und kein Löschen. Eine neue
// Fassung ist eine neue Zeile; der Unique-Schlüssel (dokument_id, fassung) verhindert, dass zwei
// gleichzeitige Schreiber dieselbe Nummer vergeben.
import { createHash, randomUUID } from "node:crypto";
import type { Pool } from "pg";

/** Über welchen Importweg eine Fassung festgeschrieben wurde. */
export type DokumentWeg = "word_addin" | "library_import" | "import_candidate";

/** Eine festgeschriebene, unveränderliche Fassung eines internen Dokuments. */
export interface DokumentFassung {
  /** Interne Kennung genau dieser Fassung. */
  readonly fassungId: string;
  /** Die interne, von Klarwerk vergebene Dokumentidentität. */
  readonly dokumentId: string;
  /** Lückenlos aufsteigend je Dokument, ab 1. */
  readonly fassung: number;
  /** Abdruck über das, was aus der Fassung ins Wissensobjekt geht (Titel, Kernaussage, Volltext). */
  readonly inhaltsAbdruck: string;
  readonly weg: DokumentWeg;
  /** Der authentifizierte Mensch, der die Fassung eingebracht hat — nie ein Name aus dem Inhalt. */
  readonly festgeschriebenVon: string;
  readonly festgeschriebenAm: string;
}

/** Der Bezug eines Wissensobjekts bzw. Entwurfs auf genau eine Fassung. */
export interface DokumentHerkunft {
  readonly dokumentId: string;
  readonly fassung: number;
  readonly fassungId: string;
}

export interface DokumentInhalt {
  readonly title?: string | undefined;
  readonly statement?: string | undefined;
  readonly bodyHtml?: string | null | undefined;
}

export class DokumentError extends Error {
  readonly code: "DOKUMENT_UNBEKANNT" | "DOKUMENT_KONFLIKT";

  constructor(code: "DOKUMENT_UNBEKANNT" | "DOKUMENT_KONFLIKT", message: string) {
    super(message);
    this.code = code;
    this.name = "DokumentError";
  }
}

/** Die Ablage der Fassungen. Kein Update, kein Löschen — siehe Kopf. */
export interface DokumentaktenRepo {
  /** `true` = angelegt; `false` = diese (dokumentId, fassung) war schon vergeben. */
  insertFassung(fassung: DokumentFassung): Promise<boolean>;
  /** Alle Fassungen eines Dokuments, aufsteigend nach `fassung`. */
  fassungen(dokumentId: string): Promise<DokumentFassung[]>;
  fassungById(fassungId: string): Promise<DokumentFassung | undefined>;
}

function kopie(fassung: DokumentFassung): DokumentFassung {
  return JSON.parse(JSON.stringify(fassung)) as DokumentFassung;
}

export class InMemoryDokumentaktenRepo implements DokumentaktenRepo {
  private readonly zeilen = new Map<string, DokumentFassung>();

  async insertFassung(fassung: DokumentFassung): Promise<boolean> {
    for (const vorhanden of this.zeilen.values()) {
      if (vorhanden.dokumentId === fassung.dokumentId && vorhanden.fassung === fassung.fassung) {
        return false;
      }
    }
    if (this.zeilen.has(fassung.fassungId)) {
      return false;
    }
    this.zeilen.set(fassung.fassungId, kopie(fassung));
    return true;
  }

  async fassungen(dokumentId: string): Promise<DokumentFassung[]> {
    return [...this.zeilen.values()]
      .filter((f) => f.dokumentId === dokumentId)
      .sort((a, b) => a.fassung - b.fassung)
      .map(kopie);
  }

  async fassungById(fassungId: string): Promise<DokumentFassung | undefined> {
    const treffer = this.zeilen.get(fassungId);
    return treffer === undefined ? undefined : kopie(treffer);
  }
}

// R-0169: die Tabelle der Fassungen. Additiv und wiederholbar (CREATE TABLE/INDEX IF NOT EXISTS),
// ohne Fremdschlüssel und ohne Extension. Der Unique-Schlüssel ist die Fassungsidentität.
export const DOKUMENTAKTE_SCHEMA = `
CREATE TABLE IF NOT EXISTS dokument_fassungen (
  fassung_id text PRIMARY KEY,
  dokument_id text NOT NULL,
  fassung int NOT NULL,
  data jsonb NOT NULL,
  UNIQUE (dokument_id, fassung)
);
CREATE INDEX IF NOT EXISTS idx_dokument_fassungen_dokument ON dokument_fassungen(dokument_id);
`;

export class PgDokumentaktenRepo implements DokumentaktenRepo {
  constructor(private readonly pool: Pool) {}

  async insertFassung(fassung: DokumentFassung): Promise<boolean> {
    const res = await this.pool.query(
      `INSERT INTO dokument_fassungen(fassung_id, dokument_id, fassung, data)
       VALUES($1, $2, $3, $4::jsonb) ON CONFLICT DO NOTHING`,
      [fassung.fassungId, fassung.dokumentId, fassung.fassung, JSON.stringify(fassung)],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async fassungen(dokumentId: string): Promise<DokumentFassung[]> {
    const res = await this.pool.query<{ data: DokumentFassung }>(
      "SELECT data FROM dokument_fassungen WHERE dokument_id = $1 ORDER BY fassung",
      [dokumentId],
    );
    return res.rows.map((r) => r.data);
  }

  async fassungById(fassungId: string): Promise<DokumentFassung | undefined> {
    const res = await this.pool.query<{ data: DokumentFassung }>(
      "SELECT data FROM dokument_fassungen WHERE fassung_id = $1",
      [fassungId],
    );
    return res.rows[0]?.data;
  }
}

/** Abdruck über GENAU das, was aus einer Fassung ins Wissensobjekt geht. */
export function dokumentInhaltsAbdruck(inhalt: DokumentInhalt): string {
  const teile = [inhalt.title ?? null, inhalt.statement ?? null, inhalt.bodyHtml ?? null];
  return createHash("sha256").update(JSON.stringify(teile)).digest("hex");
}

/** Die Form einer mitgebrachten Kennung — eine UUID, wie `randomUUID` sie vergibt. */
const DOKUMENT_ID_FORM = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Liest eine fremd gelieferte Kennung; alles, was keine Kennung sein kann, ist „nicht geliefert". */
export function gelieferteDokumentId(wert: unknown): string | undefined {
  return typeof wert === "string" && wert.trim().length > 0 ? wert.trim() : undefined;
}

const SCHREIBVERSUCHE = 3;

export class DokumentaktenService {
  private readonly repo: DokumentaktenRepo;
  private readonly genId: () => string;
  private readonly now: () => number;

  constructor(deps: { repo: DokumentaktenRepo; genId?: () => string; now?: () => number }) {
    this.repo = deps.repo;
    this.genId = deps.genId ?? (() => randomUUID());
    this.now = deps.now ?? (() => Date.now());
  }

  /**
   * Ist diese mitgebrachte Kennung eine hier vergebene Dokumentidentität? Ohne Schreibwirkung —
   * die Importwege prüfen damit ALLE Einträge einer Anfrage, bevor einer geschrieben wird.
   */
  async bekannt(dokumentId: string): Promise<boolean> {
    if (!DOKUMENT_ID_FORM.test(dokumentId)) {
      return false;
    }
    return (await this.repo.fassungen(dokumentId)).length > 0;
  }

  /**
   * Schreibt die Fassung eines Dokuments fest und liefert den Bezug darauf.
   *
   * - OHNE `dokumentId`: neue Akte, von Klarwerk vergebene Kennung, Fassung 1.
   * - MIT `dokumentId`: die Kennung muss hier vergeben worden sein, sonst `DOKUMENT_UNBEKANNT`.
   *   Gleicht der Inhalt der jüngsten Fassung, ist das KEINE neue Fassung (Wiederholung desselben
   *   Stands) — der Bezug zeigt auf die vorhandene. Sonst die nächste Fassung.
   */
  async festschreiben(eingabe: {
    dokumentId?: string | undefined;
    inhalt: DokumentInhalt;
    weg: DokumentWeg;
    actor: string;
  }): Promise<DokumentHerkunft> {
    const abdruck = dokumentInhaltsAbdruck(eingabe.inhalt);
    const dokumentId = eingabe.dokumentId ?? this.genId();
    for (let versuch = 1; versuch <= SCHREIBVERSUCHE; versuch += 1) {
      const bisher = eingabe.dokumentId === undefined ? [] : await this.repo.fassungen(dokumentId);
      if (eingabe.dokumentId !== undefined) {
        if (!DOKUMENT_ID_FORM.test(dokumentId) || bisher.length === 0) {
          throw new DokumentError(
            "DOKUMENT_UNBEKANNT",
            "Diese Dokumentkennung wurde hier nicht vergeben — sie wird weder übernommen noch neu angelegt.",
          );
        }
      }
      const juengste = bisher[bisher.length - 1];
      if (juengste && juengste.inhaltsAbdruck === abdruck) {
        return { dokumentId, fassung: juengste.fassung, fassungId: juengste.fassungId };
      }
      const fassung: DokumentFassung = {
        fassungId: this.genId(),
        dokumentId,
        fassung: (juengste?.fassung ?? 0) + 1,
        inhaltsAbdruck: abdruck,
        weg: eingabe.weg,
        festgeschriebenVon: eingabe.actor,
        festgeschriebenAm: new Date(this.now()).toISOString(),
      };
      if (await this.repo.insertFassung(fassung)) {
        return { dokumentId, fassung: fassung.fassung, fassungId: fassung.fassungId };
      }
    }
    throw new DokumentError(
      "DOKUMENT_KONFLIKT",
      "Die Fassung konnte wegen gleichzeitiger Schreiber nicht festgeschrieben werden — bitte erneut senden.",
    );
  }

  fassungen(dokumentId: string): Promise<DokumentFassung[]> {
    return this.repo.fassungen(dokumentId);
  }

  fassungById(fassungId: string): Promise<DokumentFassung | undefined> {
    return this.repo.fassungById(fassungId);
  }
}
