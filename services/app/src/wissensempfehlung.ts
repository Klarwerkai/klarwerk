import type { Pool } from "pg";
import type { Conflict } from "../../conflicts";
import type { KnowledgeObject, KoStatus } from "../../knowledge-object";

// ================================================================================================
// R-1656 — EMPFEHLUNG „DU SOLLTEST AUCH WISSEN…".
// ================================================================================================
//
// Originalwortlaut (Funktions-Roadmap 9.2): „Wenn jemand ein Wissensobjekt liest, schlägt KLARWERK
// verwandte Objekte vor — basierend auf Co-Reading-Muster, Themen-Nähe und Konflikt-Verknüpfungen."
//
// DREI GRÜNDE, JEDER SICHTBAR. Eine Empfehlung ohne ihr Warum wäre eine Behauptung; jede Zeile trägt
// deshalb ALLE Gründe, aus denen sie entstand:
//   · `mitgelesen` — andere haben beide Einträge in einer Lesesitzung nacheinander geöffnet
//                    (Co-Reading). Gezählt wird nur das PAAR, nie die Person (s. u.).
//   · `thema`      — geteilte, nicht-ubiquitäre Schlagwörter. Das ist die vorhandene Auskunft
//                    `LibraryService.neighbors()` (mega68) — wiederverwendet, nicht nachgebaut.
//   · `konflikt`   — beide Einträge stehen in einem offenen oder entschiedenen Konflikt.
//
// CO-READING OHNE PERSONENBEZUG. KLARWERK ist ausdrücklich kein Werkzeug zur Leistungs- oder
// Verhaltenskontrolle (`docs/operations/monitoring-logging.md`). Gespeichert wird deshalb je
// ungeordnetem Paar (a, b) NUR eine Zahl — keine Kontokennung, kein Zeitpunkt, keine Reihenfolge.
// Aus der Tabelle lässt sich nicht ablesen, wer was wann gelesen hat. Die Lesespur selbst (welcher
// Eintrag zuletzt offen war) liegt allein im Browser der lesenden Person (`sessionStorage`).
// Gegen das Hochzählen durch eine einzige Person hält der Dienst je Konto und Paar eine Sperre im
// Prozessspeicher (`MITGELESEN_SPERRE_MS`); sie wird nie geschrieben und verfällt.
//
// SCHWELLE. Unter `MITGELESEN_MINDESTENS` ist ein Paar kein Muster, sondern der Weg einzelner
// Menschen — es erscheint nicht als Grund.
//
// SICHTBARKEIT. Jede empfohlene Gegenseite wird gegen dieselbe Entscheidung gehalten wie der
// Detailabruf (`sichtbar`, aus `sichtbarkeit.ts`). Ein unsichtbarer Eintrag fehlt in Liste und Zähler.

export const MITGELESEN_MINDESTENS = 3;
export const MITGELESEN_SPERRE_MS = 24 * 60 * 60 * 1000;
/** Obergrenze der Sperrliste im Prozessspeicher — Schutz gegen unbegrenztes Wachstum. */
export const MITGELESEN_SPERRE_MAX = 50_000;
/** Höchstzahl gezeigter Empfehlungen — ein Hinweis, keine zweite Bibliothek. */
export const EMPFEHLUNG_LIMIT = 5;
/** Wie viele Partner je Eintrag der Zähler höchstens liefert, bevor gefiltert wird. */
const MITGELESEN_PARTNER_MAX = 50;

export interface MitgelesenPartner {
  koId: string;
  anzahl: number;
}

export interface MitgelesenRepo {
  /** Zählt das ungeordnete Paar (a, b) um eins hoch. */
  zaehle(a: string, b: string): Promise<void>;
  /** Die Partner eines Eintrags ab `mindestens` Zählungen, häufigste zuerst. */
  partner(koId: string, mindestens: number, limit: number): Promise<MitgelesenPartner[]>;
}

function paar(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

function sortiertePartner(liste: MitgelesenPartner[], limit: number): MitgelesenPartner[] {
  return liste.sort((x, y) => y.anzahl - x.anzahl || x.koId.localeCompare(y.koId)).slice(0, limit);
}

export class InMemoryMitgelesenRepo implements MitgelesenRepo {
  private readonly zaehler = new Map<string, number>();

  zaehle(a: string, b: string): Promise<void> {
    const schluessel = paar(a, b).join("\u0000");
    this.zaehler.set(schluessel, (this.zaehler.get(schluessel) ?? 0) + 1);
    return Promise.resolve();
  }

  partner(koId: string, mindestens: number, limit: number): Promise<MitgelesenPartner[]> {
    const treffer: MitgelesenPartner[] = [];
    for (const [schluessel, anzahl] of this.zaehler) {
      const [a, b] = schluessel.split("\u0000") as [string, string];
      if (anzahl >= mindestens && (a === koId || b === koId)) {
        treffer.push({ koId: a === koId ? b : a, anzahl });
      }
    }
    return Promise.resolve(sortiertePartner(treffer, limit));
  }
}

/**
 * Eine Zeile je Paar, nur die Zahl. REIN ADDITIV UND WIEDERHOLBAR: ein `CREATE TABLE IF NOT EXISTS`
 * und ein `CREATE INDEX IF NOT EXISTS`, kein DROP, kein Fremdschlüssel, keine Extension, kein Seed.
 */
export const MITGELESEN_SCHEMA = `
CREATE TABLE IF NOT EXISTS ko_mitgelesen (
  ko_a text NOT NULL,
  ko_b text NOT NULL,
  anzahl integer NOT NULL,
  PRIMARY KEY (ko_a, ko_b)
);
CREATE INDEX IF NOT EXISTS idx_ko_mitgelesen_b ON ko_mitgelesen (ko_b);
`;

export class PgMitgelesenRepo implements MitgelesenRepo {
  constructor(private readonly pool: Pool) {}

  async zaehle(a: string, b: string): Promise<void> {
    const [x, y] = paar(a, b);
    await this.pool.query(
      `INSERT INTO ko_mitgelesen (ko_a, ko_b, anzahl) VALUES ($1, $2, 1)
       ON CONFLICT (ko_a, ko_b) DO UPDATE SET anzahl = ko_mitgelesen.anzahl + 1`,
      [x, y],
    );
  }

  async partner(koId: string, mindestens: number, limit: number): Promise<MitgelesenPartner[]> {
    const res = await this.pool.query<{ ko_id: string; anzahl: number }>(
      `SELECT CASE WHEN ko_a = $1 THEN ko_b ELSE ko_a END AS ko_id, anzahl
         FROM ko_mitgelesen
        WHERE (ko_a = $1 OR ko_b = $1) AND anzahl >= $2
        ORDER BY anzahl DESC, ko_id
        LIMIT $3`,
      [koId, mindestens, limit],
    );
    return res.rows.map((z) => ({ koId: z.ko_id, anzahl: z.anzahl }));
  }
}

// ------------------------------------------------------------------------------------------------
// DIE EMPFEHLUNG
// ------------------------------------------------------------------------------------------------

export type EmpfehlungsGrund =
  | { art: "mitgelesen"; anzahl: number }
  | { art: "thema"; schlagwoerter: string[] }
  | { art: "konflikt"; stand: "offen" | "entschieden" };

export interface Wissensempfehlung {
  id: string;
  title: string;
  status: KoStatus;
  gruende: EmpfehlungsGrund[];
}

export interface Wissensempfehlungen {
  koId: string;
  empfehlungen: Wissensempfehlung[];
  /** Empfehlungen NACH dem Sichtbarkeitsfilter, VOR dem Deckel. */
  total: number;
  truncated: boolean;
}

export interface EmpfehlungsQuellen {
  /** Die geteilten Schlagwörter je Nachbar — aus `LibraryService.neighbors()`. */
  thema: ReadonlyArray<{ id: string; via: readonly string[] }>;
  /** Konflikte, an denen der Eintrag beteiligt ist; `geloest` zählt als „entschieden". */
  konflikte: ReadonlyArray<Pick<Conflict, "koA" | "koB" | "status">>;
  mitgelesen: readonly MitgelesenPartner[];
}

const RANG: Record<EmpfehlungsGrund["art"], number> = { konflikt: 0, mitgelesen: 1, thema: 2 };

function gewicht(gruende: readonly EmpfehlungsGrund[], art: EmpfehlungsGrund["art"]): number {
  const g = gruende.find((x) => x.art === art);
  if (!g) {
    return 0;
  }
  return g.art === "mitgelesen" ? g.anzahl : g.art === "thema" ? g.schlagwoerter.length : 1;
}

/**
 * Führt die drei Quellen je Gegenseite zusammen. Rein und deterministisch: Ein Konflikt steht vorn
 * (wer liest, sollte von einem Widerspruch wissen), dann mehr Gründe vor weniger, dann häufiger
 * gemeinsam gelesen, dann mehr geteilte Schlagwörter, dann Titel und Kennung.
 */
export function bildeEmpfehlungen(
  koId: string,
  quellen: EmpfehlungsQuellen,
  kos: ReadonlyMap<string, Pick<KnowledgeObject, "id" | "title" | "status">>,
  limit = EMPFEHLUNG_LIMIT,
): Wissensempfehlungen {
  const gruende = new Map<string, EmpfehlungsGrund[]>();
  const fuege = (id: string, grund: EmpfehlungsGrund) => {
    if (id === koId || !kos.has(id)) {
      return;
    }
    const liste = gruende.get(id) ?? [];
    if (!liste.some((g) => g.art === grund.art)) {
      liste.push(grund);
    }
    gruende.set(id, liste);
  };
  for (const k of quellen.konflikte) {
    const gegenseite = k.koA === koId ? k.koB : k.koB === koId ? k.koA : undefined;
    if (gegenseite !== undefined) {
      fuege(gegenseite, {
        art: "konflikt",
        stand: k.status === "geloest" ? "entschieden" : "offen",
      });
    }
  }
  for (const p of quellen.mitgelesen) {
    fuege(p.koId, { art: "mitgelesen", anzahl: p.anzahl });
  }
  for (const n of quellen.thema) {
    if (n.via.length > 0) {
      fuege(n.id, { art: "thema", schlagwoerter: [...n.via] });
    }
  }
  const alle = [...gruende.entries()].map(([id, g]) => {
    const ko = kos.get(id) as Pick<KnowledgeObject, "id" | "title" | "status">;
    return {
      id,
      title: ko.title,
      status: ko.status,
      gruende: [...g].sort((a, b) => RANG[a.art] - RANG[b.art]),
    };
  });
  alle.sort(
    (a, b) =>
      gewicht(b.gruende, "konflikt") - gewicht(a.gruende, "konflikt") ||
      b.gruende.length - a.gruende.length ||
      gewicht(b.gruende, "mitgelesen") - gewicht(a.gruende, "mitgelesen") ||
      gewicht(b.gruende, "thema") - gewicht(a.gruende, "thema") ||
      a.title.localeCompare(b.title) ||
      a.id.localeCompare(b.id),
  );
  const gezeigt = alle.slice(0, limit);
  return { koId, empfehlungen: gezeigt, total: alle.length, truncated: alle.length > limit };
}

// ------------------------------------------------------------------------------------------------
// DER DIENST
// ------------------------------------------------------------------------------------------------

export interface WissensempfehlungDeps {
  readonly repo: MitgelesenRepo;
  readonly ko: { get(id: string): Promise<KnowledgeObject | undefined> };
  /** Die Schlagwort-Nachbarschaft — `LibraryService.neighbors`, bereits sichtbarkeitsgefiltert. */
  readonly thema: (
    koId: string,
    sichtbar: (ko: KnowledgeObject) => boolean,
  ) => Promise<ReadonlyArray<{ id: string; via: readonly string[] }>>;
  readonly konflikte: {
    unresolved(): Promise<Conflict[]>;
    vorrangFuerKo(koId: string): Promise<Conflict[]>;
  };
  readonly jetzt?: () => number;
}

export class WissensempfehlungDienst {
  private readonly sperre = new Map<string, number>();
  private readonly jetzt: () => number;

  constructor(private readonly deps: WissensempfehlungDeps) {
    this.jetzt = deps.jetzt ?? Date.now;
  }

  /**
   * Vermerkt, dass `koId` in derselben Lesesitzung nach `zuvor` geöffnet wurde. Beide Einträge hat
   * die Route bereits gegen die Sichtbarkeit gehalten. `false`: dieses Konto hat das Paar innerhalb
   * der Sperrfrist schon gemeldet — nichts wird gezählt.
   */
  async mitgelesen(kontoId: string, koId: string, zuvor: string): Promise<boolean> {
    const jetzt = this.jetzt();
    const [a, b] = paar(koId, zuvor);
    const schluessel = `${kontoId}\u0000${a}\u0000${b}`;
    const bis = this.sperre.get(schluessel);
    if (bis !== undefined && bis > jetzt) {
      return false;
    }
    if (this.sperre.size >= MITGELESEN_SPERRE_MAX) {
      for (const [s, ablauf] of this.sperre) {
        if (ablauf <= jetzt) {
          this.sperre.delete(s);
        }
      }
      // Bleibt die Liste voll, wird nicht gezählt — lieber ein fehlendes Signal als ein unbegrenzt
      // wachsender Speicher oder eine Zählung ohne Sperre.
      if (this.sperre.size >= MITGELESEN_SPERRE_MAX) {
        return false;
      }
    }
    this.sperre.set(schluessel, jetzt + MITGELESEN_SPERRE_MS);
    await this.deps.repo.zaehle(a, b);
    return true;
  }

  /** Die Empfehlungen zu einem Eintrag, den der Aufrufer sehen darf. */
  async empfehlungen(
    center: KnowledgeObject,
    sichtbar: (ko: KnowledgeObject) => boolean,
  ): Promise<Wissensempfehlungen> {
    const [thema, offen, entschieden, mitgelesen] = await Promise.all([
      this.deps.thema(center.id, sichtbar),
      this.deps.konflikte.unresolved(),
      this.deps.konflikte.vorrangFuerKo(center.id),
      this.deps.repo.partner(center.id, MITGELESEN_MINDESTENS, MITGELESEN_PARTNER_MAX),
    ]);
    const konflikte = [...offen, ...entschieden].filter(
      (k) => k.koA === center.id || k.koB === center.id,
    );
    const kandidaten = new Set<string>([
      ...thema.map((n) => n.id),
      ...konflikte.map((k) => (k.koA === center.id ? k.koB : k.koA)),
      ...mitgelesen.map((p) => p.koId),
    ]);
    kandidaten.delete(center.id);
    const kos = new Map<string, KnowledgeObject>();
    for (const id of kandidaten) {
      const ko = await this.deps.ko.get(id);
      if (ko && sichtbar(ko)) {
        kos.set(id, ko);
      }
    }
    return bildeEmpfehlungen(center.id, { thema, konflikte, mitgelesen }, kos);
  }
}
