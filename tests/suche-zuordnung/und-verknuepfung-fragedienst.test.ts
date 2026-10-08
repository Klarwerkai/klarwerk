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

// Drei gebundene Begriffe: Temperatur, Ventil, F3. „gilt" gehört zum Fragegerüst.
const FRAGE = "Welche Temperatur gilt für das Ventil F3?";
const VOLL = { title: "Ventil F3", statement: "Die Temperatur am Ventil F3 liegt bei 80 Grad." };
const TEIL = { title: "Ventil F3 Wartung", statement: "Das Ventil F3 wird jährlich gewartet." };

// Nacharbeit 3 (ben): dieselben drei Begriffe klein geschrieben und mit dem fehlenden Begriff am
// Satzanfang. Die Regel aus Nacharbeit 1 band hier nur „f3" bzw. „ventil, f3".
const OHNE_SATZBAU = ["ventil f3 temperatur", "Temperatur Ventil F3"] as const;

describe("R-0473 · welche Fragebegriffe gebunden sind", () => {
  it("jedes Inhaltstoken — unabhängig von Schreibung und Satzposition", () => {
    const gebunden = undVerknuepfteFragebegriffe(FRAGE);
    expect(gebunden).toEqual(queryTokens("Temperatur Ventil F3"));
    expect(gebunden).not.toContain(queryTokens("gilt")[0]);
    for (const frage of OHNE_SATZBAU) {
      expect(undVerknuepfteFragebegriffe(frage), frage).toEqual(queryTokens(frage));
      expect(undVerknuepfteFragebegriffe(frage), frage).toContain(queryTokens("Temperatur")[0]);
    }
    expect(undVerknuepfteFragebegriffe("welche temperatur gilt für ventil f3?")).toEqual(
      queryTokens("Temperatur Ventil F3"),
    );
  });

  it("ausgenommen sind nur Fragegerüst und mehrdeutige Funktionsformen — benannt, nicht pauschal", () => {
    // Das Fragegerüst: „finde" steht nicht in der Quelle, die die Frage beantwortet (N2 Z1).
    const z1 = "Wo finde ich die Urlaubsregelungen im Handbuch?";
    expect(undVerknuepfteFragebegriffe(z1)).toEqual(queryTokens("Urlaubsregelungen Handbuch"));
    // Die mehrdeutige Funktionsform „würde" (mega57) ist im Tokenstrom, aber kein Begriff.
    const frage = "Was würde für das Ventil gelten?";
    expect(queryTokens(frage)).toContain(queryTokens("würde")[0]);
    expect(undVerknuepfteFragebegriffe(frage)).toEqual(queryTokens("Ventil"));
    // Ein Sachverb bleibt gebunden — auch klein und am Satzanfang.
    expect(undVerknuepfteFragebegriffe("hängt der Speiseplan aus?")).toEqual(
      queryTokens("hängt Speiseplan"),
    );
  });

  it("R-0278-Nacharbeit: „dient“, „hoch“, „many“ sind Fragegerüst — die Sachbegriffe bleiben gebunden", () => {
    const faelle: Array<[string, string, string[]]> = [
      ["Wozu dient der Schnellstartknopf NOTSTART-4?", "dient", ["Schnellstartknopf"]],
      ["Wie hoch ist das Nachspannmoment an der Presse?", "hoch", ["Nachspannmoment", "Presse"]],
      ["How many days does the customer have to report a defect?", "many", ["customer", "defect"]],
    ];
    for (const [frage, geruest, sache] of faelle) {
      const gebunden = undVerknuepfteFragebegriffe(frage);
      expect(gebunden, frage).not.toContain(queryTokens(geruest)[0]);
      for (const wort of sache) {
        expect(gebunden, frage).toContain(queryTokens(wort)[0]);
      }
    }
  });

  it("R-0278-Nacharbeit 3: gebunden ist die Sachfrage — nicht Anweisungssätze, nicht der Fundortrahmen", () => {
    // Pedis Freitagsfrage (P-ASK-C02), wörtlich.
    const lang =
      "In the fictional Advisor ICT demo data, what is the standard invoice payment period? Answer in English and cite the stored source. If the sources disagree, say so rather than choosing silently.";
    expect(undVerknuepfteFragebegriffe(lang)).toEqual(
      queryTokens("standard invoice payment period"),
    );
    // Anweisungssätze neben einem Fragesatz binden nicht — der Fragesatz bleibt voll gebunden.
    expect(undVerknuepfteFragebegriffe(`${FRAGE} Antworte kurz und nenne die Quelle.`)).toEqual(
      queryTokens("Temperatur Ventil F3"),
    );
    // Ein Rahmen, der den DATENBESTAND benennt, bindet nicht …
    expect(undVerknuepfteFragebegriffe("Im Wissensbestand, wo stehen die Urlaubszeiten?")).toEqual(
      queryTokens("Urlaubszeiten"),
    );
    // … ein Rahmen, der eine SACHE benennt, bleibt gebunden (Nacharbeit 5, ben) — gleich mit
    // welcher Präposition.
    expect(undVerknuepfteFragebegriffe("Bei Ventil F3, welche Temperatur gilt?")).toEqual(
      expect.arrayContaining(queryTokens("Ventil F3 Temperatur")),
    );
    expect(undVerknuepfteFragebegriffe("Im Kessel K7, welche maximale Temperatur gilt?")).toEqual(
      expect.arrayContaining(queryTokens("Kessel K7 maximale Temperatur")),
    );
    expect(undVerknuepfteFragebegriffe("Im Handbuch, wo stehen die Urlaubszeiten?")).toEqual(
      expect.arrayContaining(queryTokens("Handbuch Urlaubszeiten")),
    );
    // Ein Kontextsatz ohne „?" ist keine Antwortanweisung — seine Sache bleibt gebunden.
    expect(
      undVerknuepfteFragebegriffe("Es geht um Ventil F3. Welche maximale Temperatur gilt?"),
    ).toEqual(expect.arrayContaining(queryTokens("Ventil F3 maximale Temperatur")));
    // Nacharbeit 7 (ben): auch IN einem Anweisungssatz bleibt die Sache gebunden; nur das formale
    // Anweisungswort fällt („Nenne") — und „Werte" fragt nach dem Wert (Fragegerüst).
    const anweisungMitSache = "Nenne nur Werte für Ventil F3. Welche maximale Temperatur gilt?";
    expect(undVerknuepfteFragebegriffe(anweisungMitSache)).toEqual(
      queryTokens("Ventil F3 maximale Temperatur"),
    );
    // Nacharbeit 7 (ben): im Rahmen fällt nur das Bestandswort („Daten"), Kessel K7 bleibt.
    const rahmenMitSache = "In den Kessel K7 Daten, welche maximale Temperatur gilt?";
    expect(undVerknuepfteFragebegriffe(rahmenMitSache)).toEqual(
      queryTokens("Kessel K7 maximale Temperatur"),
    );
    // Ohne Fragesatz bleibt die ganze Eingabe gebunden (bens Fall, unverändert).
    expect(undVerknuepfteFragebegriffe("Ventil F3 Temperatur")).toEqual(
      queryTokens("Ventil F3 Temperatur"),
    );
  });

  it("R-0278-Nacharbeit 3: „payment period“ trifft „due date“ nur über die deklarierte Entsprechung", () => {
    const frage = "What is the standard invoice payment period?";
    const relevanz = zugeordneteSuchterme(queryTokens(frage));
    const c02 = "Standard invoice due date Standard invoices are due 30 calendar days.";
    expect(decktAlleFragebegriffe(frage, c02, relevanz)).toBe(true);
    // Gegenprobe: ohne Relevanztext fehlt die Zahlungsfrist — die Bindung bleibt scharf.
    expect(decktAlleFragebegriffe(frage, c02)).toBe(false);
    // Fachfremd bleibt fachfremd: eine Rechnungsvorlage ohne Frist trägt nicht.
    const vorlage = "Standard invoice template Use the standard invoice layout for all customers.";
    expect(decktAlleFragebegriffe(frage, vorlage, relevanz)).toBe(false);
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

describe("R-0278-Nacharbeit 5 · Kontext- und Rahmensätze binden ihre Sache (ben)", () => {
  const FAELLE = [
    {
      name: "Kontextsatz",
      frage: "Es geht um Ventil F3. Welche maximale Temperatur gilt?",
      passend: {
        title: "Ventil F3",
        statement: "Die maximale Temperatur am Ventil F3 ist 80 Grad.",
      },
      fremd: { title: "Ventil F4", statement: "Die maximale Temperatur am Ventil F4 ist 95 Grad." },
    },
    {
      name: "Im-Rahmen",
      frage: "Im Kessel K7, welche maximale Temperatur gilt?",
      passend: {
        title: "Kessel K7",
        statement: "Die maximale Temperatur im Kessel K7 ist 120 Grad.",
      },
      fremd: {
        title: "Kessel K8",
        statement: "Die maximale Temperatur im Kessel K8 ist 140 Grad.",
      },
    },
    // Nacharbeit 7 (ben): ein Anweisungssatz mit Sache — nur „Nenne" ist formal, F3 bleibt gebunden.
    {
      name: "Anweisungssatz mit Sache",
      frage: "Nenne nur Werte für Ventil F3. Welche maximale Temperatur gilt?",
      passend: {
        title: "Ventil F3",
        statement: "Die maximale Temperatur am Ventil F3 ist 80 Grad.",
      },
      fremd: { title: "Ventil F4", statement: "Die maximale Temperatur am Ventil F4 ist 95 Grad." },
    },
    // Nacharbeit 7 (ben): ein Rahmen, der auf ein Bestandswort endet, aber eine Sache trägt — nur
    // „Daten" ist Bestand, Kessel K7 bleibt gebunden.
    {
      name: "Bestandswort-Rahmen mit Sache",
      frage: "In den Kessel K7 Daten, welche maximale Temperatur gilt?",
      passend: {
        title: "Kessel K7",
        statement: "Die maximale Temperatur im Kessel K7 ist 120 Grad.",
      },
      fremd: {
        title: "Kessel K8",
        statement: "Die maximale Temperatur im Kessel K8 ist 140 Grad.",
      },
    },
  ] as const;

  for (const fall of FAELLE) {
    it(`NEGATIV ${fall.name}: eine Quelle zu einem ANDEREN Gegenstand trägt nicht`, async () => {
      const { ko, ask } = await stapel();
      const fremd = (await ko.create({ ...VORLAGE, ...fall.fremd })).id;
      for (const opts of [{ retrievalOnly: true }, {}]) {
        const out = await ask.ask(fall.frage, "nutzer-1", "de", opts);
        expect(out.result.answered, JSON.stringify(opts)).toBe(false);
        expect(out.result.sources, JSON.stringify(opts)).not.toContain(fremd);
      }
    });

    it(`POSITIV ${fall.name}: die Quelle zum genannten Gegenstand trägt — die fremde nicht`, async () => {
      const { ko, ask } = await stapel();
      const fremd = (await ko.create({ ...VORLAGE, ...fall.fremd })).id;
      const passend = (await ko.create({ ...VORLAGE, ...fall.passend })).id;
      for (const opts of [{ retrievalOnly: true }, {}]) {
        const out = await ask.ask(fall.frage, "nutzer-1", "de", opts);
        expect(out.result.answered, JSON.stringify(opts)).toBe(true);
        expect(out.result.sources, JSON.stringify(opts)).toEqual([passend]);
        expect(out.result.sources, JSON.stringify(opts)).not.toContain(fremd);
      }
    });
  }
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

  it("R-0278-Nacharbeit, NEGATIV: „Wie hoch …“ öffnet die Bindung nicht — „Temperatur“ fehlt weiter", async () => {
    const { ko, ask } = await stapel();
    const teil = (await ko.create({ ...VORLAGE, ...TEIL })).id;
    const frage = "Wie hoch ist die Temperatur am Ventil F3?";
    for (const opts of [{ retrievalOnly: true }, {}]) {
      const out = await ask.ask(frage, "nutzer-1", "de", opts);
      expect(out.result.answered, JSON.stringify(opts)).toBe(false);
      expect(out.result.sources, JSON.stringify(opts)).not.toContain(teil);
    }
  });

  // Nacharbeit 3 (ben, K8): klein geschrieben und mit dem fehlenden Begriff am Satzanfang, jeweils
  // auf BEIDEN Aufrufarten — dem Retrieval-Weg des Add-ins und dem regulären Weg ohne Option.
  for (const frage of OHNE_SATZBAU) {
    it(`NEGATIV „${frage}“: nur die unvollständige Quelle — keine Antwort, keine Quelle`, async () => {
      const { ko, ask } = await stapel();
      await ko.create({ ...VORLAGE, ...TEIL });
      for (const opts of [{ retrievalOnly: true }, {}]) {
        const out = await ask.ask(frage, "nutzer-1", "de", opts);
        expect(out.result.answered, JSON.stringify(opts)).toBe(false);
        expect(out.result.sources, JSON.stringify(opts)).toEqual([]);
      }
    });

    it(`POSITIV „${frage}“: vollständige und unvollständige Quelle — es trägt allein VOLL`, async () => {
      const { ko, ask } = await stapel();
      await ko.create({ ...VORLAGE, ...TEIL });
      const voll = (await ko.create({ ...VORLAGE, ...VOLL })).id;
      for (const opts of [{ retrievalOnly: true }, {}]) {
        const out = await ask.ask(frage, "nutzer-1", "de", opts);
        expect(out.result.answered, JSON.stringify(opts)).toBe(true);
        expect(out.result.sources, JSON.stringify(opts)).toEqual([voll]);
      }
    });
  }

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
