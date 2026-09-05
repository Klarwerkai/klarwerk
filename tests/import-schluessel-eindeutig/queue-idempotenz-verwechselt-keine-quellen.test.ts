// ================================================================================================
// JOB 3087 · Q2b — DER IDEMPOTENZ-SCHLUESSEL DER REVIEW-WARTESCHLANGE VERWECHSELT ZWEI QUELLEN NICHT.
// ================================================================================================
//
// WAS HIER GEMESSEN WIRD, und warum es ein eigener Prueffall ist:
//
// `InMemoryCandidateRepo.insertIfAbsent` beantwortet EINE Frage — „steht dieser offene Kandidat
// schon in der Warteschlange?". Ein `false` heisst „ja, schon da", und der Kandidat wird dann gar
// nicht erst eingereiht: der Reviewer sieht ihn nie, und niemand meldet einen Fehler. Diese Aussage
// darf deshalb NUR fallen, wenn die drei Felder wirklich uebereinstimmen — nie aufgrund einer
// zufaelligen Zeichengleichheit.
//
// BIS JOB 3087 fiel sie genau daran. Der Schluessel war die Verkettung
// `${importProviderKey(provider)}@${externalId}@${sourceVersion}` (`repo.ts:169` am Stand
// 492fd86). Sie ist NICHT injektiv, weil das Trennzeichen in BEIDEN Feldern vorkommen darf:
//
//     (provider "test@tenant", externalId "42")        → "test@tenant@42@1"
//     (provider "test",        externalId "tenant@42") → "test@tenant@42@1"
//
// Gemessen in JOB 3081 Runde 2 ueber die echte API: `expected [ { …(8) } ] to have a length of 2
// but got 1`. Ein ANDERES Trennzeichen haette nichts geheilt — jedes einzelne Zeichen darf in
// beiden Feldern stehen.
//
// DER MASSSTAB IST POSTGRES, UND ER WAR SCHON IMMER RICHTIG. Der partielle UNIQUE-Index steht auf
// einem SPALTEN-TUPEL, nicht auf einer Verkettung (`services/library-analytics/src/repo-pg.ts`
// :153-155):
//
//     CREATE UNIQUE INDEX … ON import_candidates (provider, external_id, source_version)
//       WHERE external_id IS NOT NULL AND review_status IN ('neu','in_bearbeitung')
//
// Ein Spalten-Tupel kennt keine Trennzeichen-Mehrdeutigkeit. Die Abweichung war also EINSEITIG:
// InMemory war STRENGER als die Datenbank und blockierte einen Kandidaten, den Postgres korrekt
// eingereiht haette. Deshalb misst F7 unten die Deckungsgleichheit als ausgeschriebene Regel:
// abgelehnt wird GENAU DANN, wenn `(importProviderKey(provider), externalId, sourceVersion ?? 1)`
// FELDWEISE gleich ist — dasselbe Tupel wie `repo-pg.ts:153-155`.
//
// GRENZE, ausdruecklich: hier laeuft KEIN Postgres. Die Deckungsgleichheit wird gegen die
// ausgeschriebene Index-Regel gemessen, nicht gegen eine echte Datenbank; der echte Indexlauf
// steht in `repo-pg.integration.test.ts` und wird von diesem Auftrag weder gefahren noch geaendert.
//
// Alle Faelle laufen ueber die OEFFENTLICHE Repo-Schnittstelle (`insertIfAbsent`, `findById`,
// `all`) — kein Mock der geprueften Stelle, kein Zugriff auf interne Felder.
import { describe, expect, it } from "vitest";
import {
  type ImportCandidate,
  type ImportItem,
  InMemoryCandidateRepo,
  type ReviewStatus,
  importProviderKey,
} from "../../services/library-analytics";

/**
 * Ein Kandidat mit genau den Feldern, die der Idempotenzraum kennt. Titel/Aussage sind bewusst
 * KONSTANT: sie spielen fuer diese Frage keine Rolle, und ein Unterschied dort duerfte das Urteil
 * nie beeinflussen.
 */
function kand(
  id: string,
  quelle: Partial<ImportItem>,
  status: ReviewStatus = "neu",
): ImportCandidate {
  const item: ImportItem = {
    title: "Pumpe entlueften",
    statement: "Pumpe alle 200h entlueften.",
    type: "best_practice",
    category: "Wartung",
    ...quelle,
  };
  return {
    id,
    item,
    status,
    duplicate: false,
    note: null,
    koId: null,
    createdAt: "2026-09-05T00:00:00.000Z",
  };
}

const ANKER_A: Partial<ImportItem> = {
  provider: "test@tenant",
  externalId: "42",
  sourceVersion: 1,
};
const ANKER_B: Partial<ImportItem> = {
  provider: "test",
  externalId: "tenant@42",
  sourceVersion: 1,
};

describe("JOB 3087 · F1-F6 — die Warteschlange trennt Quellen und bleibt idempotent", () => {
  it("F1 · zwei VERSCHIEDENE Quellen mit zufaellig gleicher Verkettung werden BEIDE eingereiht", async () => {
    const repo = new InMemoryCandidateRepo();

    expect(await repo.insertIfAbsent(kand("a", ANKER_A))).toBe(true);
    expect(
      await repo.insertIfAbsent(kand("b", ANKER_B)),
      "Anker B ist ein EIGENES Quellobjekt — ein stilles Verschlucken waere die schaerfste Form " +
        "der Unehrlichkeit: es fehlt etwas, und niemand sagt es.",
    ).toBe(true);

    expect(await repo.findById("a")).toBeDefined();
    expect(await repo.findById("b")).toBeDefined();
    expect(
      (await repo.all()).map((c) => c.id),
      "Der Reviewer bekommt ZWEI Kandidaten zu sehen.",
    ).toEqual(["a", "b"]);
  });

  it("F1r · dieselbe Verwechslung in umgekehrter Reihenfolge", async () => {
    const repo = new InMemoryCandidateRepo();

    expect(await repo.insertIfAbsent(kand("b", ANKER_B))).toBe(true);
    expect(await repo.insertIfAbsent(kand("a", ANKER_A))).toBe(true);
    expect((await repo.all()).map((c) => c.id)).toEqual(["b", "a"]);
  });

  it("F2 · dieselbe Quelle zweimal bleibt EINE Vormerkung (die Idempotenz haelt)", async () => {
    const repo = new InMemoryCandidateRepo();
    const quelle: Partial<ImportItem> = { provider: "test", externalId: "42", sourceVersion: 1 };

    expect(await repo.insertIfAbsent(kand("erst", quelle))).toBe(true);
    expect(
      await repo.insertIfAbsent(kand("zweit", quelle)),
      "Die echte Wiederholung desselben Quellobjekts bleibt blockiert.",
    ).toBe(false);
    expect((await repo.all()).map((c) => c.id)).toEqual(["erst"]);
    expect(await repo.findById("zweit")).toBeUndefined();
  });

  it("F3 · dieselbe Quelle in zwei VERSIONEN sind zwei Kandidaten", async () => {
    const repo = new InMemoryCandidateRepo();

    expect(
      await repo.insertIfAbsent(
        kand("v1", { provider: "test", externalId: "42", sourceVersion: 1 }),
      ),
    ).toBe(true);
    expect(
      await repo.insertIfAbsent(
        kand("v2", { provider: "test", externalId: "42", sourceVersion: 2 }),
      ),
    ).toBe(true);
    expect((await repo.all()).map((c) => c.id)).toEqual(["v1", "v2"]);
  });

  it("F4 · ohne externalId gibt es keinen Anker — und darum nie eine Blockade", async () => {
    const repo = new InMemoryCandidateRepo();

    expect(await repo.insertIfAbsent(kand("o1", { provider: "test" }))).toBe(true);
    expect(await repo.insertIfAbsent(kand("o2", { provider: "test" }))).toBe(true);
    expect(await repo.insertIfAbsent(kand("o3", { provider: "test" }))).toBe(true);
    expect(
      (await repo.all()).map((c) => c.id),
      "Deckungsgleich mit der Index-Bedingung `external_id IS NOT NULL` (repo-pg.ts:155).",
    ).toEqual(["o1", "o2", "o3"]);
  });

  it("F5 · 'in_bearbeitung' haelt den Platz, ein Endstatus gibt ihn frei", async () => {
    const quelle: Partial<ImportItem> = { provider: "test", externalId: "42", sourceVersion: 1 };

    // WP-SHIP8-CLOSE-3 (bens ROT-2): ein geclaimter Kandidat ist WEITERHIN offen — sonst koennte
    // ein paralleler Importlauf waehrend der Review-Aktion einen zweiten offenen Kandidaten
    // derselben Quelle einreihen.
    const gehalten = new InMemoryCandidateRepo();
    expect(await gehalten.insertIfAbsent(kand("claim", quelle, "in_bearbeitung"))).toBe(true);
    expect(
      await gehalten.insertIfAbsent(kand("parallel", quelle)),
      "Der geclaimte Kandidat gibt seinen Platz NICHT frei.",
    ).toBe(false);

    // Ein Endstatus ist nicht mehr offen (`review_status IN ('neu','in_bearbeitung')` trifft nicht):
    // dieselbe Quelle darf erneut vorgemerkt werden.
    const frei = new InMemoryCandidateRepo();
    expect(await frei.insertIfAbsent(kand("beschieden", quelle, "angenommen"))).toBe(true);
    expect(
      await frei.insertIfAbsent(kand("neu", quelle)),
      "Ein abgeschlossener Kandidat belegt keinen offenen Platz mehr.",
    ).toBe(true);
    expect((await frei.all()).map((c) => c.id)).toEqual(["beschieden", "neu"]);
  });

  it("F6 · der Provider wird NORMALISIERT verglichen, nicht roh", async () => {
    const getrimmt = new InMemoryCandidateRepo();
    expect(
      await getrimmt.insertIfAbsent(kand("gross", { provider: " Test ", externalId: "42" })),
    ).toBe(true);
    expect(
      await getrimmt.insertIfAbsent(kand("klein", { provider: "test", externalId: "42" })),
      "` Test ` und `test` sind dieselbe Quelle (importProviderKey: trim + lowercase).",
    ).toBe(false);

    const ohneProvider = new InMemoryCandidateRepo();
    expect(await ohneProvider.insertIfAbsent(kand("leer", { externalId: "42" }))).toBe(true);
    expect(
      await ohneProvider.insertIfAbsent(kand("conf", { provider: "confluence", externalId: "42" })),
      "Ein Item OHNE Provider zaehlt als 'confluence' — deckungsgleich mit dem Pg-Backfill.",
    ).toBe(false);
  });
});

// ================================================================================================
// F7 — DIE DECKUNGSGLEICHHEIT MIT DEM POSTGRES-INDEX, ALS TABELLE
// ================================================================================================
//
// DIE REGEL, AUSGESCHRIEBEN: `insertIfAbsent` lehnt den zweiten Kandidaten GENAU DANN ab, wenn
//
//     (importProviderKey(provider), externalId, sourceVersion ?? 1)
//
// FELDWEISE gleich ist — dasselbe Tupel, das der partielle UNIQUE-Index in `repo-pg.ts:153-155`
// fuehrt (`ON import_candidates (provider, external_id, source_version)`), und dieselbe
// Normalisierung, die die drei GENERATED-Spalten dort vornehmen (`repo-pg.ts:78-120`).
//
// Die Tabelle nennt das erwartete Urteil NICHT frei Hand: `erwartet` unten wird aus genau dieser
// Regel BERECHNET und zusaetzlich als Selbstkontrolle gegen den erwarteten Wert gehalten. Waere die
// Regel im Test falsch abgeschrieben, faellt es an der Selbstkontrolle auf.
interface Paar {
  readonly name: string;
  readonly links: Partial<ImportItem>;
  readonly rechts: Partial<ImportItem>;
  /** Wird der ZWEITE Kandidat abgelehnt? */
  readonly abgelehnt: boolean;
}

const PAARE: readonly Paar[] = [
  {
    name: "Trennzeichen im Provider gegen Trennzeichen in der Kennung",
    links: ANKER_A,
    rechts: ANKER_B,
    abgelehnt: false,
  },
  {
    name: "dieselben beiden in umgekehrter Reihenfolge",
    links: ANKER_B,
    rechts: ANKER_A,
    abgelehnt: false,
  },
  {
    name: "Trennzeichen am RAND: 'test@' + 'tenant@42' gegen 'test' + '@tenant@42'",
    links: { provider: "test@", externalId: "tenant@42", sourceVersion: 1 },
    rechts: { provider: "test", externalId: "@tenant@42", sourceVersion: 1 },
    abgelehnt: false,
  },
  {
    name: "leeres Feld am Rand: 'test@' + '42' gegen 'test' + '@42'",
    links: { provider: "test@", externalId: "42", sourceVersion: 1 },
    rechts: { provider: "test", externalId: "@42", sourceVersion: 1 },
    abgelehnt: false,
  },
  {
    name: "dieselbe Quelle, buchstabengleich",
    links: { provider: "test", externalId: "42", sourceVersion: 1 },
    rechts: { provider: "test", externalId: "42", sourceVersion: 1 },
    abgelehnt: true,
  },
  {
    name: "dieselbe Quelle, fehlende Version zaehlt als 1",
    links: { provider: "test", externalId: "42" },
    rechts: { provider: "test", externalId: "42", sourceVersion: 1 },
    abgelehnt: true,
  },
  {
    name: "dieselbe Quelle, Provider nur anders geschrieben",
    links: { provider: " TEST ", externalId: "tenant@42", sourceVersion: 1 },
    rechts: { provider: "test", externalId: "tenant@42", sourceVersion: 1 },
    abgelehnt: true,
  },
  {
    name: "gleiche Kennung, anderer Provider",
    links: { provider: "confluence", externalId: "42", sourceVersion: 1 },
    rechts: { provider: "jira", externalId: "42", sourceVersion: 1 },
    abgelehnt: false,
  },
  {
    name: "gleiche Quelle, andere Version",
    links: { provider: "test", externalId: "42", sourceVersion: 1 },
    rechts: { provider: "test", externalId: "42", sourceVersion: 7 },
    abgelehnt: false,
  },
];

/** Die Regel des Postgres-Index, Feld fuer Feld — hier einmal ausgeschrieben. */
function tupelGleich(links: Partial<ImportItem>, rechts: Partial<ImportItem>): boolean {
  return (
    importProviderKey(links.provider) === importProviderKey(rechts.provider) &&
    links.externalId === rechts.externalId &&
    (links.sourceVersion ?? 1) === (rechts.sourceVersion ?? 1)
  );
}

describe("JOB 3087 · F7 — deckungsgleich mit dem partiellen UNIQUE-Index (repo-pg.ts:153-155)", () => {
  for (const paar of PAARE) {
    it(`F7 · ${paar.name} → ${paar.abgelehnt ? "abgelehnt" : "eingereiht"}`, async () => {
      expect(
        tupelGleich(paar.links, paar.rechts),
        "Selbstkontrolle: das erwartete Urteil folgt aus der Index-Regel, nicht aus Erinnerung.",
      ).toBe(paar.abgelehnt);

      const repo = new InMemoryCandidateRepo();
      expect(await repo.insertIfAbsent(kand("links", paar.links))).toBe(true);
      expect(await repo.insertIfAbsent(kand("rechts", paar.rechts))).toBe(!paar.abgelehnt);
      expect((await repo.all()).map((c) => c.id)).toEqual(
        paar.abgelehnt ? ["links"] : ["links", "rechts"],
      );
    });
  }
});
