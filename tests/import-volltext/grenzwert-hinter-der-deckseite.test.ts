// ================================================================================================
// AUFNAHME 20260922 · gesamt-import-volltext — DER GRENZWERT HINTER DER DECKSEITE ERREICHT DIE
// BELEGTE ANTWORT.
// ================================================================================================
//
// DIE ORIGINALPUNKTE, die diese Datei belegt:
//   R-0452/G27  Genau hinter der Deckseite liegen Grenzwerte, Ablaufschritte und Ausnahmen.
//   R-0434      Ein Treffer, der allein im übernommenen Fließtext steht, fällt nicht durch das
//               Relevanztor.
//   R-1848      Dokumentinhalt jenseits des alten 500-Zeichen-Ausschnitts in der vorgesehenen
//               Suche finden und daraus eine passende belegte Antwort liefern.
//   R-1582      … auch wenn der Bestand wächst (hier: 60 stärkere Objekte mit einem gemeinsamen
//               Fragebegriff).
//
// DER GEMESSENE VERTRAG (Quelleninspektion, kein Vorfall): `bodyText` kollabiert jeden Leerraum,
// eine Tabelle ohne Satzzeichen ist für `saetze` deshalb EIN Satz. War er länger als der
// Quelldeckel des Auszugs, ging nur sein ANFANG an das Modell — die Zeile mit dem Grenzwert nicht.
// A2 rechnet genau das nach. Ob dieser Weg den verlorenen Einzelfall aus dem Vortest erklärt, ist
// NICHT belegt und wird hier nicht behauptet (R-1816/R-2001).
//
// GEMESSEN AM PRODUKTWEG: KoService mit aktiver Suchprojektion → AskService → Reasoner →
// ModelProvider. Das einzige Testdoppel ist der Modell-Client; er schreibt mit, was ihm vorgelegt
// wird. Der Dokumentkörper wird als `bodyHtml` angelegt — dieselbe Form, in der der Import ihn
// ablegt; den `bodyText` leitet die Suchprojektion selbst ab.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { InMemoryGapRepo } from "../../services/ask/src/repo";
import { AskService } from "../../services/ask/src/service";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import { visibleTextFromBodyHtml } from "../../services/knowledge-object/src/search-projection";
import { type ModelClient, Reasoner, undVerknuepfteFragebegriffe } from "../../services/reasoner";
import {
  AUSZUG_MAX_ZEICHEN_JE_QUELLE,
  ModelProvider,
  dokumentAuszug,
  pruefeDeckung,
  saetze,
} from "../../services/reasoner/src/provider-model";
import { erteileKiFreigabe } from "../../services/reasoner/src/testhelfer-ki-freigabe";

const VORGEFUNDEN = process.env.KLARWERK_SKIP_KEYCHAIN;
beforeAll(() => {
  process.env.KLARWERK_SKIP_KEYCHAIN = "1";
});
afterAll(() => {
  if (VORGEFUNDEN === undefined) {
    delete process.env.KLARWERK_SKIP_KEYCHAIN;
  } else {
    process.env.KLARWERK_SKIP_KEYCHAIN = VORGEFUNDEN;
  }
});

const FRAGE = "Welcher Haltedruck gilt für das Nachspannventil?";
const ZIELZEILE = "Nachspannventil Haltedruck nach Stillstand maximal 185 bar";
const TITEL = "Wartungshandbuch Presse HP-400";
const AUSSAGE = "Deckblatt und Übersicht der Wartungsintervalle.";

const DECKSEITE = [
  "Dieses Handbuch beschreibt die regelmäßige Wartung der Presse HP-400 im Werk Nord.",
  "Es richtet sich an Schichtleitungen, Instandhaltung und eingewiesene Bedienpersonen.",
  "Vor jeder Arbeit ist die Anlage nach Betriebsanweisung freizuschalten und zu sichern.",
  "Die Kapitel folgen dem Ablauf einer Schicht vom Anfahren bis zur Übergabe.",
  "Änderungen an diesem Dokument gibt ausschließlich die Fertigungsleitung frei.",
];

// Eine Prüftabelle, wie sie in Handbüchern steht: keine Satzzeichen, Wert hinter der Bezeichnung.
const ZEILEN: readonly (readonly [string, string, string])[] = [
  ["Hauptzylinder", "Dichtheit bei Nennlast", "keine sichtbare Leckage"],
  ["Pumpenaggregat", "Geräuschpegel im Leerlauf", "unter 72 dB"],
  ["Ölbehälter", "Füllstand bei kalter Anlage", "zwischen den Marken"],
  ["Rücklauffilter", "Differenzanzeige nach Schichtende", "grünes Feld"],
  ["Stößelführung", "Spiel quer zur Arbeitsrichtung", "höchstens 4 Zehntel"],
  ["Schutzgitter", "Abschaltung beim Öffnen", "sofortiger Halt"],
  ["Zweihandbedienung", "Gleichzeitigkeit beider Taster", "innerhalb 500 ms"],
  ["Kühlkreislauf", "Vorlauftemperatur im Betrieb", "unter 45 Grad"],
  ["Hydraulikschläuche", "Sichtprüfung auf Risse", "ohne Befund"],
  ["Werkzeugklemmung", "Spannkraft je Spanner", "mindestens 60 kN"],
  ["Not-Halt", "Wirkung an allen Stellen", "Stillstand ohne Nachlauf"],
  ["Schmieranlage", "Impulse je Stunde", "zwölf bis vierzehn"],
  ["Lichtvorhang", "Auflösung des Schutzfelds", "14 mm Finger"],
  ["Druckspeicher", "Vorfülldruck bei Stillstand", "laut Typschild"],
  ["Nachspannventil", "Haltedruck nach Stillstand", "maximal 185 bar"],
  ["Bodenanker", "Anzugskontrolle", "jährlich"],
  ["Typschilder", "Lesbarkeit", "vollständig"],
];

function handbuchHtml(): string {
  const absaetze: string[] = [];
  for (let i = 0; i < 36; i += 1) {
    absaetze.push(`<p>${DECKSEITE[i % DECKSEITE.length]}</p>`);
  }
  const deckseite = absaetze.join("");
  const tabelle = [
    "<h2>Prüfwerte</h2><table><tr><th>Bauteil</th><th>Prüfschritt</th><th>Grenzwert</th></tr>",
    ...ZEILEN.map(([a, b, c]) => `<tr><td>${a}</td><td>${b}</td><td>${c}</td></tr>`),
    "</table>",
  ].join("");
  return `${deckseite}${tabelle}<p>Abweichungen sind sofort der Instandhaltung zu melden.</p>`;
}

/** Der Tabellensatz, wie `saetze` ihn aus dem Dokumenttext schneidet. */
function tabellensatz(): string {
  const body = visibleTextFromBodyHtml(handbuchHtml()).replace(/\s+/g, " ").trim();
  return saetze(body).find((s) => s.includes(ZIELZEILE)) ?? "";
}

function mitschreiber(antwort: string): { client: ModelClient; prompts: () => string[] } {
  const prompts: string[] = [];
  return {
    client: {
      name: "mitschreiber",
      complete: async (_system: string, user: string) => {
        prompts.push(user);
        return antwort;
      },
    },
    prompts: () => prompts,
  };
}

describe("Kalibrierung · der Grenzwert steht nur im Dokumentkörper, weit hinter der Deckseite", () => {
  it("K0 · jeder gebundene Fragebegriff fehlt in Titel und Aussage und steht im Körper", () => {
    const begriffe = undVerknuepfteFragebegriffe(FRAGE);
    expect(begriffe.length).toBeGreaterThanOrEqual(2);
    const kern = `${TITEL} ${AUSSAGE}`.toLowerCase();
    const body = visibleTextFromBodyHtml(handbuchHtml()).toLowerCase();
    for (const begriff of begriffe) {
      expect(kern).not.toContain(begriff);
      expect(body).toContain(begriff);
    }
  });

  it("K1 · die Zielzeile liegt hinter Zeichen 2900 und in einem Satz, der den Quelldeckel sprengt", () => {
    const body = visibleTextFromBodyHtml(handbuchHtml()).replace(/\s+/g, " ").trim();
    expect(body.indexOf(ZIELZEILE)).toBeGreaterThan(2900);
    const satz = tabellensatz();
    expect(satz.length).toBeGreaterThan(AUSZUG_MAX_ZEICHEN_JE_QUELLE);
    expect(satz.indexOf(ZIELZEILE)).toBeGreaterThan(AUSZUG_MAX_ZEICHEN_JE_QUELLE);
  });
});

describe("Auszug · der überlange Satz wird um den Treffer geschnitten", () => {
  const ref = {
    id: "hp400",
    title: TITEL,
    statement: AUSSAGE,
    status: "validiert" as const,
    trust: 60,
    bodyText: visibleTextFromBodyHtml(handbuchHtml()).replace(/\s+/g, " ").trim(),
  };

  it("A1 · der Auszug trägt die Zielzeile vollständig und bleibt unter dem Quelldeckel", () => {
    const auszug = dokumentAuszug(FRAGE, ref);
    expect(auszug).toHaveLength(1);
    const text = auszug[0] as string;
    expect(text).toContain(ZIELZEILE);
    expect(text.length).toBeLessThanOrEqual(AUSZUG_MAX_ZEICHEN_JE_QUELLE);
    // Ganze Wörter, wörtlich aus dem Tabellensatz — ein zusammenhängender Ausschnitt.
    expect(tabellensatz()).toContain(text);
  });

  it("A2 · GEGENPROBE: der bisherige Anfangsschnitt desselben Satzes enthielt den Grenzwert nicht", () => {
    expect(tabellensatz().slice(0, AUSZUG_MAX_ZEICHEN_JE_QUELLE)).not.toContain("185 bar");
  });

  it("A3 · ein Zitat aus dem Auszug besteht die unveränderte Deckungsprüfung", () => {
    expect(pruefeDeckung(`${ZIELZEILE} [1]`, [ref]).gedeckt).toBe(true);
    // Eine erfundene Zahl fällt weiterhin durch.
    const erfunden = ZIELZEILE.replace("185", "250");
    expect(pruefeDeckung(`${erfunden} [1]`, [ref]).gedeckt).toBe(false);
  });
});

// Ben, Nacharbeit 2: der Wert steht VOR seiner Bezeichnung, und hinter ihr folgt mehr Tabelle, als
// der Quelldeckel fasst. Ein Fenster, das am ersten Fragebegriff beginnt und vorwärts wächst,
// verliert genau „185 bar maximal zulässiger" — Wert und Bedingung.
describe("Auszug · der Wert VOR seiner Bezeichnung bleibt erhalten", () => {
  const VORANGESTELLT = "185 bar maximal zulässiger Haltedruck Nachspannventil";
  const andere = ZEILEN.filter(([bauteil]) => bauteil !== "Nachspannventil");
  const zeilen = [
    ...andere.slice(0, 8),
    ["185 bar", "maximal zulässiger Haltedruck", "Nachspannventil"] as const,
    ...andere,
  ];
  const html = [
    "<p>Dieses Handbuch beschreibt die Prüfwerte der Presse HP-400.</p>",
    "<table><tr><th>Grenzwert</th><th>Prüfschritt</th><th>Bauteil</th></tr>",
    ...zeilen.map(([a, b, c]) => `<tr><td>${a}</td><td>${b}</td><td>${c}</td></tr>`),
    "</table><p>Abweichungen sind sofort der Instandhaltung zu melden.</p>",
  ].join("");
  const body = visibleTextFromBodyHtml(html).replace(/\s+/g, " ").trim();
  const satz = saetze(body).find((s) => s.includes(VORANGESTELLT)) ?? "";
  const ref = {
    id: "hp400-vorangestellt",
    title: TITEL,
    statement: AUSSAGE,
    status: "validiert" as const,
    trust: 60,
    bodyText: body,
  };

  it("B0 · KALIBRIERUNG: hinter dem ersten Fragebegriff folgt mehr Tabelle, als der Deckel fasst", () => {
    expect(satz.length).toBeGreaterThan(AUSZUG_MAX_ZEICHEN_JE_QUELLE);
    const abBegriff = satz.slice(satz.indexOf("Haltedruck Nachspannventil"));
    expect(abBegriff.length).toBeGreaterThan(AUSZUG_MAX_ZEICHEN_JE_QUELLE);
    // Ein reines Vorwärtsfenster ab dem Begriff enthielte den Wert nicht.
    expect(abBegriff.slice(0, AUSZUG_MAX_ZEICHEN_JE_QUELLE)).not.toContain("185 bar");
  });

  it("B1 · der Auszug trägt Wert, Bedingung und Bezeichnung und bleibt unter dem Quelldeckel", () => {
    const auszug = dokumentAuszug(FRAGE, ref);
    expect(auszug).toHaveLength(1);
    const text = auszug[0] as string;
    expect(text).toContain(VORANGESTELLT);
    expect(text.length).toBeLessThanOrEqual(AUSZUG_MAX_ZEICHEN_JE_QUELLE);
    expect(satz).toContain(text);
  });

  it("B2 · das Zitat der vorangestellten Zeile ist gedeckt, eine erfundene Zahl nicht", () => {
    expect(pruefeDeckung(`${VORANGESTELLT} [1]`, [ref]).gedeckt).toBe(true);
    const erfunden = VORANGESTELLT.replace("185", "250");
    expect(pruefeDeckung(`${erfunden} [1]`, [ref]).gedeckt).toBe(false);
  });
});

describe("Nutzerweg · Import-Körper → Suche → Relevanztor → Auszug → belegte Antwort", () => {
  it("V1 · bei 60 stärkeren Konkurrenten trägt der Prompt den Grenzwert und die Antwort die Quelle", async () => {
    const koService = new KoService({ repo: new InMemoryKoRepo() });
    await koService.activateSearchProjectionV2();
    const ko = await koService.create({
      title: TITEL,
      statement: AUSSAGE,
      type: "best_practice",
      category: "Wartung",
      author: "anna",
      bodyHtml: handbuchHtml(),
    });
    await koService.setValidationState(ko.id, { trust: 60, status: "validiert" });
    // Der Bestand wächst: 60 validierte Objekte mit höherem Vertrauen teilen EINEN Fragebegriff.
    for (let i = 1; i <= 60; i += 1) {
      const konkurrent = await koService.create({
        title: `Tauschplan Linie ${i}`,
        statement: `Tauschintervalle der Linie ${i}.`,
        type: "best_practice",
        category: "Wartung",
        author: "bea",
        bodyHtml: `<p>Das Nachspannventil der Linie ${i} wird jährlich getauscht.</p>`,
      });
      await koService.setValidationState(konkurrent.id, { trust: 99, status: "validiert" });
    }

    const { client, prompts } = mitschreiber(`${ZIELZEILE} [1]`);
    const reasoner = new Reasoner(new ModelProvider(client));
    await erteileKiFreigabe(reasoner);
    const ask = new AskService({
      reasoner,
      koService,
      gaps: new InMemoryGapRepo(),
      audit: new AuditService({ repo: new InMemoryAuditRepo() }),
    });

    const antwort = await ask.ask(FRAGE, "anna", "de");

    expect(prompts()).toHaveLength(1);
    const prompt = prompts()[0] ?? "";
    expect(prompt).toContain("Dokumenttext (Auszug)");
    expect(prompt).toContain("maximal 185 bar");
    expect(antwort.result.answered).toBe(true);
    expect(antwort.result.answer).toContain("185 bar");
    expect(antwort.result.citedSources).toEqual([ko.id]);
    expect(antwort.gap).toBeNull();
  });
});

// Nacharbeit 1: Dieselbe Rechte- und Statusgegenprobe wie `tests/ask-volltext/vollkette-und-rechte`
// R1–R3, aber mit einer Frage, die die Und-Verknüpfung (R-0473) erfüllt. Dort scheitern die Fälle
// unverändert VOR dem Modellaufruf („How many …" bindet „many"), also bevor ein Auszug entsteht —
// sie belegen damit nichts über den Dokumenttext. Hier steht der Auszug wirklich zur Wahl.
describe("Rechte · Vertraulichkeit und Prüfstand gelten vor dem Auszug", () => {
  async function aufbauen(opts: { vertraulich?: boolean; validiert: boolean }) {
    const koService = new KoService({ repo: new InMemoryKoRepo() });
    await koService.activateSearchProjectionV2();
    const ko = await koService.create({
      title: TITEL,
      statement: AUSSAGE,
      type: "best_practice",
      category: "Wartung",
      author: "anna",
      bodyHtml: handbuchHtml(),
      ...(opts.vertraulich ? { confidentiality: "vertraulich" as const } : {}),
    });
    if (opts.validiert) {
      await koService.setValidationState(ko.id, { trust: 60, status: "validiert" });
    }
    // Ein unbedenkliches, validiertes Objekt mit beiden Fragebegriffen und OHNE den Grenzwert:
    // so findet in jedem Fall ein Modellaufruf statt, und „der Wert steht nicht im Prompt" ist eine
    // Aussage über einen echten Prompt.
    const harmlos = await koService.create({
      title: "Nachspannventil Haltedruck Übersicht",
      statement: "Der Haltedruck am Nachspannventil wird je Anlage im Handbuch festgelegt.",
      type: "best_practice",
      category: "Wartung",
      author: "bea",
    });
    await koService.setValidationState(harmlos.id, { trust: 90, status: "validiert" });
    const { client, prompts } = mitschreiber(`${ZIELZEILE} [1]`);
    const reasoner = new Reasoner(new ModelProvider(client));
    await erteileKiFreigabe(reasoner);
    const ask = new AskService({
      reasoner,
      koService,
      gaps: new InMemoryGapRepo(),
      audit: new AuditService({ repo: new InMemoryAuditRepo() }),
    });
    return { ask, ko, harmlos, prompts };
  }

  it("R1 · ein VERTRAULICHES Objekt gibt seinen Grenzwert nicht an das Modell", async () => {
    const { ask, ko, harmlos, prompts } = await aufbauen({ vertraulich: true, validiert: true });
    const antwort = await ask.ask(FRAGE, "anna", "de");
    expect(prompts()).toHaveLength(1);
    const prompt = prompts()[0] ?? "";
    expect(prompt).toContain(harmlos.title);
    expect(prompt).not.toContain("185 bar");
    expect(prompt).not.toContain(TITEL);
    expect(prompt).not.toContain(ko.id);
    expect(antwort.result.sources).not.toContain(ko.id);
  });

  it("R2 · `validatedOnly`: ein UNVALIDIERTES Objekt gibt seinen Grenzwert nicht an das Modell", async () => {
    const { ask, ko, harmlos, prompts } = await aufbauen({ validiert: false });
    const antwort = await ask.ask(FRAGE, "anna", "de", { validatedOnly: true });
    expect(prompts()).toHaveLength(1);
    const prompt = prompts()[0] ?? "";
    expect(prompt).toContain(harmlos.title);
    expect(prompt).not.toContain("185 bar");
    expect(antwort.result.sources).not.toContain(ko.id);
  });

  it("R3 · KALIBRIERUNG: validiert und nicht vertraulich kommt der Grenzwert an", async () => {
    // Ohne diesen Fall wären R1 und R2 auch dann grün, wenn der Auszug gar nicht mehr liefe.
    const { ask, ko, prompts } = await aufbauen({ validiert: true });
    const antwort = await ask.ask(FRAGE, "anna", "de", { validatedOnly: true });
    expect(prompts()).toHaveLength(1);
    expect(prompts()[0] ?? "").toContain("maximal 185 bar");
    expect(antwort.result.sources).toContain(ko.id);
  });
});
