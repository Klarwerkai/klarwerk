// ================================================================================================
// AUFNAHME 20260922 · VORSCHAU-REICHWEITE — BEN RUNDE 1, BEFUND B1: GENAU 40, ALLE VERGLICHEN.
// ================================================================================================
//
// DER BEFUND. Der Bestand hat genau 40 passende Einträge, alle 40 werden verglichen, nichts bleibt
// ungesehen — und die Antwort meldet trotzdem korrekt `limitReached: true`, weil die Vorauswahl den
// Deckel gefüllt hat. Die Erklärung sagte in dieser Lage in DE/EN/NL, weitere passende Einträge
// seien „nicht angesehen" worden. Das war eine Behauptung ohne Beleg: eine erreichte Auswahlgrenze
// belegt nicht, dass es weitere Einträge gibt.
//
// GEMESSEN AM ECHTEN WEG: unveränderter `KoService` mit In-Memory-Ablagen und freigegebener
// Suchprojektion, `checkKnowledge` aus dem Produktpfad, die Erklärung aus derselben Funktion, die
// die Fläche benutzt (`umfangErklaerung`), in allen drei Katalogsprachen.
import { beforeAll, describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { umfangErklaerung } from "../../apps/web/src/lib/vorschauUmfang";
import { checkKnowledge } from "../../services/app/src/knowledge-check";
import { ConflictService, InMemoryConflictRepo } from "../../services/conflicts";
import {
  InMemoryKoRepo,
  InMemoryKoSearchProjectionRepo,
  InMemoryKoVersionRepo,
  KoService,
} from "../../services/knowledge-object";

const ENTWURF = "Kondensatableiter vor Schichtbeginn entleeren und Dampfsperre kontrollieren.";
const BESTAND = 40;

/** Was die Erklärung früher als Tatsache behauptete — je Sprache. */
const UNBELEGT = {
  de: "nicht angesehen",
  en: "not looked at",
  nl: "niet bekeken",
} as const;

let ko: KoService;

beforeAll(async () => {
  const repo = new InMemoryKoRepo();
  ko = new KoService({
    repo,
    versions: new InMemoryKoVersionRepo(),
    searchProjections: new InMemoryKoSearchProjectionRepo(repo),
  });
  const { readiness } = await ko.activateSearchProjectionV2();
  expect(readiness.alle, readiness.befunde.join("; ")).toBe(true);
  for (let i = 1; i <= BESTAND; i += 1) {
    await ko.create({
      type: "best_practice",
      category: "Werkstatt",
      author: "anna",
      title: `Kondensatableiter Merkblatt ${String(i).padStart(2, "0")}`,
      statement: "Ablage im Archivraum, Register gelb.",
    });
  }
}, 120_000);

describe("B1 · genau 40 Einträge, alle 40 verglichen", () => {
  it("die Antwort meldet 40 verglichen und die erreichte Grenze — und es gibt nichts Ungesehenes", async () => {
    const res = await checkKnowledge(ENTWURF, {
      ko,
      conflicts: new ConflictService({ repo: new InMemoryConflictRepo() }),
    });
    expect(res.similar).toEqual([]);
    expect(res.coverage).toEqual({
      kind: "candidates",
      checked: 40,
      limit: 40,
      limitReached: true,
    });
    // Die Lage des Befunds: der ganze passende Bestand IST die Vorauswahl.
    const alle = await ko.findCandidates({ terms: ["kondensatableiter"], limit: 1000 });
    expect(alle).toHaveLength(BESTAND);
  });

  it.each(["de", "en", "nl"] as const)(
    "%s · die Erklärung nennt Zahl und Grenze, behauptet aber keine weiteren Einträge",
    async (sprache) => {
      const res = await checkKnowledge(ENTWURF, {
        ko,
        conflicts: new ConflictService({ repo: new InMemoryConflictRepo() }),
      });
      if (res.coverage.kind !== "candidates") {
        throw new Error("die Antwort meldet keinen belegten Umfang");
      }
      const t = i18n.getFixedT(sprache);
      const satz = umfangErklaerung(t, res.coverage);
      expect(satz).toBe(t("vorschau.erklaerungGrenze", { count: 40, limit: 40 }));
      expect(satz).toContain("40");
      expect(satz).not.toContain(UNBELEGT[sprache]);
    },
  );
});
