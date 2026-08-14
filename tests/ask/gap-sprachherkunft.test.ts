// ================================================================================================
// GAP-SPRACHHERKUNFT — WOHER DER GEMISCHTSPRACHIGE TITEL IN DER AUFGABENLISTE KOMMT
// ================================================================================================
//
// BEFUND (Design-Lead, 14.08.2026, bestätigt): In der deutschen Aufgabenliste steht ein Eintrag
// wie „Countersunk screws sind in Lebensmittel- und Spritzzonen verboten". Der Nutzer liest das
// als Fehler — es ist aber die ehrliche Spur einer Frage, die aus einem ENGLISCHEN Dokument kam:
// Das Word-Add-in schickt markierten Dokumenttext (`mode: "retrieval-only"`), und bleibt die
// Frage unbeantwortet, wird daraus eine Wissenslücke. Der Fragetext behält die Sprache des
// Dokuments, die Liste ringsherum ist deutsch.
//
// WARUM NICHT ÜBERSETZEN: Der Lückentitel ist der Beleg der ursprünglichen Frage. Wer ihn
// übersetzt, verfälscht den Beleg und verliert den Bezug zur markierten Stelle im Dokument.
// WARUM NICHT UNTERDRÜCKEN: `services/app/src/routes/ask-routes.ts:202-204` hält ausdrücklich
// fest, dass die Lücke vermerkt werden MUSS — „darauf baut der Offene-Frage-Weg des Panels".
//
// ENTSCHEIDUNG (Chef, 14.08.2026): Die Herkunftssprache wird an der Lücke MITGESPEICHERT und
// angezeigt. Damit erklärt die Oberfläche die Mischung, statt sie zu verstecken oder zu
// fälschen. Der Wert liegt beim Anlegen bereits vor (`AskService.ask(..., locale)`) und ging
// bisher schlicht verloren.
//
// Die Sprache ist KEIN Freitext: Sie verrät nichts über den Inhalt der Frage und wird deshalb
// auch in der redigierten Sicht mitgeliefert — sonst trüge ausgerechnet der Betrachter ohne
// Detailrecht einen unerklärten fremdsprachigen Titel.
import { describe, expect, it } from "vitest";
import { redactGapForViewer } from "../../services/ask/src/gap-visibility";
import { InMemoryGapRepo } from "../../services/ask/src/repo";
import { AskService } from "../../services/ask/src/service";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import {
  type AnswerResult,
  Reasoner,
  type ReasonerProvider,
} from "../../services/reasoner";

const ENGLISCHE_FRAGE = "Are countersunk screws allowed in food contact zones?";

/** Ein Reasoner, der nie antwortet — genau so entsteht eine Wissenslücke. */
function stummerProvider(): ReasonerProvider {
  return {
    name: "stumm",
    isAvailable: () => true,
    answer: async (): Promise<AnswerResult> => ({
      answered: false,
      answer: null,
      knowledgeClass: "unbekannt",
      trust: 0,
      sources: [],
      citedSources: [],
      steps: [],
      demo: false,
    }),
  } as unknown as ReasonerProvider;
}

async function aufbauen() {
  const koService = new KoService({ repo: new InMemoryKoRepo() });
  await koService.activateSearchProjectionV2();
  const ask = new AskService({
    reasoner: new Reasoner(stummerProvider()),
    koService,
    gaps: new InMemoryGapRepo(),
    audit: new AuditService({ repo: new InMemoryAuditRepo() }),
  });
  return ask;
}

describe("Wissenslücke trägt ihre Herkunftssprache", () => {
  it("KALIBRIERUNG: eine unbeantwortete Frage legt überhaupt eine Lücke an", async () => {
    // Ohne diesen Fall wären alle folgenden auch dann grün, wenn gar keine Lücke mehr entstünde.
    const ask = await aufbauen();
    const { gap } = await ask.ask(ENGLISCHE_FRAGE, "anna", "en");
    expect(gap).not.toBeNull();
    expect(gap?.question).toContain("countersunk screws");
  });

  it("eine englische Frage hinterlässt eine Lücke mit locale 'en'", async () => {
    const ask = await aufbauen();
    const { gap } = await ask.ask(ENGLISCHE_FRAGE, "anna", "en");
    expect(gap?.locale).toBe("en");
  });

  it("der deutsche Regelfall wird ebenso festgehalten, nicht bloß weggelassen", async () => {
    // Ein fehlendes Feld wäre mehrdeutig: alte Lücke oder deutsche Lücke? Deshalb immer setzen.
    const ask = await aufbauen();
    const { gap } = await ask.ask("Dürfen Senkschrauben in Lebensmittelzonen?", "anna", "de");
    expect(gap?.locale).toBe("de");
  });

  it("ohne ausdrückliche Sprache gilt der Standard 'de' — unverändertes Verhalten", async () => {
    const ask = await aufbauen();
    const { gap } = await ask.ask("Dürfen Senkschrauben in Lebensmittelzonen?", "anna");
    expect(gap?.locale).toBe("de");
  });

  it("die Sicht für Berechtigte trägt die Sprache", async () => {
    const ask = await aufbauen();
    const { gap } = await ask.ask(ENGLISCHE_FRAGE, "anna", "en");
    const sicht = redactGapForViewer(gap!, { viewerId: "anna", maySeeDetail: true });
    expect(sicht.locale).toBe("en");
    expect(sicht.question).toContain("countersunk screws");
  });

  it("auch die REDIGIERTE Sicht trägt die Sprache — sie ist kein Freitext", async () => {
    // Der Betrachter ohne Detailrecht sieht keinen Fragetext. Bekäme er zusätzlich keine
    // Sprachangabe, stünde bei ihm eine Neutralbezeichnung ohne jeden Hinweis auf die Herkunft.
    const ask = await aufbauen();
    const { gap } = await ask.ask(ENGLISCHE_FRAGE, "anna", "en");
    const sicht = redactGapForViewer(gap!, { viewerId: "fremd", maySeeDetail: false });
    expect(sicht.redacted).toBe(true);
    expect(sicht.question).toBe("");
    expect(sicht.locale).toBe("en");
  });

  it("die Sprachangabe verrät nichts über den Inhalt der Frage", async () => {
    // Gegenprobe zur Datensparsamkeit: in der redigierten Sicht darf kein Wort der Frage stehen.
    const ask = await aufbauen();
    const { gap } = await ask.ask(ENGLISCHE_FRAGE, "anna", "en");
    const sicht = redactGapForViewer(gap!, { viewerId: "fremd", maySeeDetail: false });
    const roh = JSON.stringify(sicht);
    expect(roh).not.toContain("countersunk");
    expect(roh).not.toContain("food contact");
  });
});
