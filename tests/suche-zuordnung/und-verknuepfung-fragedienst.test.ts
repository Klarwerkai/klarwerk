// ================================================================================================
// R-0473 (K8) — „MEHRERE WÖRTER MÜSSEN ALLE VORKOMMEN", AM ECHTEN FRAGEDIENST GEMESSEN.
// ================================================================================================
//
// ben, Nacharbeit 1, F1: „Ventil F3 Temperatur" gegen eine Quelle, die nur „Ventil F3" kennt, kam
// mit zwei tragenden Treffern durch. Verlangt: Positiv- und Negativfall über `AskService`.
//
// DER STAPEL IST DER ECHTE (Muster: n2-klara-versteht-zusammensetzungen.test.ts): In-Memory-Speicher
// mit aktivierter Suchprojektion, echter `KoService`, echter `AskService`, echter `Reasoner` ohne
// Modellclient (deterministischer Weg). Kein Doppelgänger entscheidet über `answered`.
import { describe, expect, it } from "vitest";
import { AskService, InMemoryGapRepo } from "../../services/ask";
import { zugeordneteSuchterme } from "../../services/ask/src/service";
import {
  InMemoryKoRepo,
  InMemoryKoSearchProjectionRepo,
  InMemoryKoVersionRepo,
  KoService,
} from "../../services/knowledge-object";
import type { CreateKoInput } from "../../services/knowledge-object/src/service";
import {
  Reasoner,
  decktAlleFragebegriffe,
  queryTokens,
  undVerknuepfteFragebegriffe,
} from "../../services/reasoner";

const VORLAGE: Omit<CreateKoInput, "title" | "statement"> = {
  type: "best_practice",
  category: "Technik",
  author: "anna",
};

async function stapel() {
  const repo = new InMemoryKoRepo();
  const ko = new KoService({
    repo,
    versions: new InMemoryKoVersionRepo(),
    searchProjections: new InMemoryKoSearchProjectionRepo(repo),
  });
  const { readiness } = await ko.activateSearchProjectionV2();
  expect(readiness.alle, readiness.befunde.join("; ")).toBe(true);
  const ask = new AskService({
    reasoner: new Reasoner(),
    koService: ko as never,
    gaps: new InMemoryGapRepo(),
  });
  return { ko, ask };
}

// Drei gebundene Begriffe: Temperatur, Ventil, F3. „gilt" ist ein Inhaltstoken, aber kein Begriff.
const FRAGE = "Welche Temperatur gilt für das Ventil F3?";
const VOLL = { title: "Ventil F3", statement: "Die Temperatur am Ventil F3 liegt bei 80 Grad." };
const TEIL = { title: "Ventil F3 Wartung", statement: "Das Ventil F3 wird jährlich gewartet." };

describe("R-0473 · welche Fragebegriffe gebunden sind", () => {
  it("Substantive im Satz und Kennungen — nicht Verben, nicht das Satzanfangswort", () => {
    const gebunden = undVerknuepfteFragebegriffe(FRAGE);
    expect(gebunden).toEqual(queryTokens("Temperatur Ventil F3"));
    expect(gebunden).not.toContain(queryTokens("gilt")[0]);
    // bens Fall wörtlich: „Ventil" steht am Satzanfang, F3 und Temperatur sind gebunden.
    expect(undVerknuepfteFragebegriffe("Ventil F3 Temperatur")).toEqual(
      queryTokens("F3 Temperatur"),
    );
  });

  it("die Begriffe kommen aus DER EINEN Zerlegung — Satzgrenzen, Bindestrich, Stoppwörter", () => {
    // Nacharbeit 2: kein eigenes Zerlegen mehr (mega54-eine-zerlegung-sammler). Die Wortstellen
    // müssen deshalb genau zu `tokenize` passen — gemessen an Fällen, bei denen eine Verschiebung
    // um eine Stelle sichtbar würde.
    const frage = "Gilt das? Wo hängt Sie die Firmenwagen-Bestellrichtlinie und der Filter F3 ab.";
    const gebunden = undVerknuepfteFragebegriffe(frage);
    // „Gilt" und „Wo" stehen am Satzanfang, „Sie" ist ein Stoppwort: alle drei sind nicht gebunden.
    expect(gebunden).toEqual(queryTokens("Firmenwagen Bestellrichtlinie Filter F3"));
    for (const begriff of gebunden) {
      expect(queryTokens(frage)).toContain(begriff);
    }
    // Ohne Großschreibung bleibt nur die Kennung gebunden.
    expect(undVerknuepfteFragebegriffe("welche temperatur gilt für ventil f3?")).toEqual(["f3"]);
  });

  it("eine deklarierte Entsprechung zählt als derselbe Begriff — sonst nicht", () => {
    const frage = "Wo finde ich die Urlaubsregelungen im Handbuch?";
    const text = "Abwesenheiten Die Urlaubszeiten stehen im Handbuch.";
    const relevanz = zugeordneteSuchterme(queryTokens(frage));
    expect(decktAlleFragebegriffe(frage, text, relevanz)).toBe(true);
    // Gegenprobe: ohne Relevanztext fehlt „Urlaubsregelung", die Quelle ist unvollständig.
    expect(decktAlleFragebegriffe(frage, text)).toBe(false);
  });
});

describe("R-0473 · UND im regulären Fragedienst", () => {
  it("NEGATIV: eine Quelle mit nur zwei von drei Begriffen trägt keine Antwort", async () => {
    const { ko, ask } = await stapel();
    const teil = (await ko.create({ ...VORLAGE, ...TEIL })).id;

    const out = await ask.ask(FRAGE, "nutzer-1", "de", { retrievalOnly: true });
    expect(out.result.answered).toBe(false);
    expect(out.result.sources).not.toContain(teil);

    // KALIBRIERUNG — sonst wäre das von einem toten Prüfstand nicht zu unterscheiden: DIESELBE Quelle
    // direkt an den echten Reasoner gegeben (ohne die UND-Bindung des Fragedienstes) trägt mit zwei
    // Treffern („ventil", „f3"). Genau das war bens Befund; der Unterschied ist allein die Bindung.
    const direkt = await new Reasoner().answerRetrievalOnly(
      FRAGE,
      [{ id: teil, ...TEIL, status: "offen", trust: 0 }],
      "de",
    );
    expect(direkt.answered).toBe(true);
  });

  it("bens Fall wörtlich: „Ventil F3 Temperatur“ gegen eine Quelle mit nur „Ventil F3“", async () => {
    const { ko, ask } = await stapel();
    const teil = (await ko.create({ ...VORLAGE, ...TEIL })).id;
    const out = await ask.ask("Ventil F3 Temperatur", "nutzer-1", "de", { retrievalOnly: true });
    expect(out.result.answered).toBe(false);
    expect(out.result.sources).not.toContain(teil);
  });

  it("POSITIV: die Quelle mit allen drei Begriffen trägt — die unvollständige bleibt draußen", async () => {
    const { ko, ask } = await stapel();
    const voll = (await ko.create({ ...VORLAGE, ...VOLL })).id;
    const teil = (await ko.create({ ...VORLAGE, ...TEIL })).id;

    for (const opts of [{ retrievalOnly: true }, {}]) {
      const out = await ask.ask(FRAGE, "nutzer-1", "de", opts);
      expect(out.result.answered).toBe(true);
      expect(out.result.sources).toEqual([voll]);
      expect(out.result.sources).not.toContain(teil);
    }
  });

  it("die deklarierte Entsprechung trägt auch unter der UND-Bindung (Z1 bleibt gültig)", async () => {
    const { ko, ask } = await stapel();
    const urlaub = (
      await ko.create({
        ...VORLAGE,
        title: "Abwesenheiten",
        statement: "Die Urlaubszeiten stehen im Handbuch.",
      })
    ).id;
    const frage = "Wo finde ich die Urlaubsregelungen im Handbuch?";
    const out = await ask.ask(frage, "nutzer-1", "de", { retrievalOnly: true });
    expect(out.result.answered).toBe(true);
    expect(out.result.sources).toEqual([urlaub]);
  });
});
