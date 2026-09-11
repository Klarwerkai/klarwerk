// ================================================================================================
// JOB 1540 · D2 — AUFLAGE 2: DIE VERTRAULICHKEITSGRENZE IM ERLAUBTEN ZWEIG
// ================================================================================================
//
// BENS AUFLAGE 2 zu D1, woertlich: „Die Vertraulichkeitsgrenze im real erlaubten Zweig direkt
// absichern. Erwarteter Beleg: der Regressionstest aus Pruefluecke 2 mit ausgeschlossenem
// vertraulichem Kandidaten." — Pruefluecke 2: „In `services/ask/src/service.test.ts` den erlaubten
// Zweig mit einem vertraulich markierten Kandidaten pruefen und erwarten, dass `dropConfidential`
// ihn trotz aufgehobener Zwangsflags entfernt."
//
// WARUM DIESER FALL AUCH HEUTE SCHON TRAEGT, obwohl der Einwilligungsweg gesperrt ist (Auflage 1):
// Der „erlaubte Zweig" ist kein eigener Codepfad, sondern derselbe `ask.ask(...)` OHNE die beiden
// Zwangsflags — genau das, was `ask-routes.ts:293` bzw. `:330` nach erteilter Einwilligung tun
// wuerde. Er ist also direkt aufrufbar, und die Vertraulichkeitsgrenze laesst sich hier messen,
// bevor die Einwilligung ueberhaupt freigeschaltet wird. Fiele sie erst NACH der Freischaltung
// auf, waere es zu spaet.
//
// KEIN MOCK: echter `AskService`, echter `KoService`, echter `Reasoner`. Der mitschreibende
// Provider steht als PRIMAER in der Kette — an genau der Stelle, an der in Produktion die Cloud
// steht. Was hier ankommt, ist exakt das, was ein Cloud-Modell zu sehen bekaeme.
import { describe, expect, it } from "vitest";
import { AuditService, InMemoryAuditRepo } from "../../audit";
import { InMemoryKoRepo, KoService } from "../../knowledge-object";
import {
  type AnswerResult,
  type KnowledgeRef,
  Reasoner,
  type ReasonerLocale,
  type ReasonerProvider,
} from "../../reasoner";
import { InMemoryGapRepo } from "./repo";
import { AskService } from "./service";

const FRAGE = "Was gilt bei der Xylophon-Wartung?";

function mitschreiber(): {
  provider: ReasonerProvider;
  gesehen: { kontext: readonly KnowledgeRef[]; confidential: boolean | undefined }[];
} {
  const gesehen: { kontext: readonly KnowledgeRef[]; confidential: boolean | undefined }[] = [];
  const provider = {
    name: "mitschreiber",
    isAvailable: () => true,
    answer: async (
      _frage: string,
      kontext: readonly KnowledgeRef[],
      _locale?: ReasonerLocale,
      confidential?: boolean,
    ): Promise<AnswerResult> => {
      gesehen.push({ kontext, confidential });
      return {
        answered: false,
        answer: null,
        knowledgeClass: "unbekannt",
        trust: 0,
        sources: [],
        citedSources: [],
        steps: [],
        demo: false,
      };
    },
  } as unknown as ReasonerProvider;
  return { provider, gesehen };
}

async function aufbauen() {
  const koService = new KoService({ repo: new InMemoryKoRepo() });
  await koService.activateSearchProjectionV2();

  // Ein VERTRAULICHES Objekt, das die Frage deckt — der Kandidat, der fallen muss.
  const geheim = await koService.create({
    title: "Xylophon Wartung Sonderverfahren",
    statement: "Die Xylophon-Wartung folgt dem Sonderverfahren des Mandanten Mueller.",
    type: "best_practice",
    category: "Geheim",
    author: "anna",
    confidentiality: "vertraulich" as const,
  });
  // Ein offenes Objekt zur selben Frage — die Kalibrierung: ohne es waere jeder „ist nicht dabei"-
  // Fall auch dann gruen, wenn der Weg gar keinen Kandidaten mehr uebergaebe.
  const offen = await koService.create({
    title: "Xylophon Wartung Grundlagen",
    statement: "Die Xylophon-Wartung beginnt mit der Sichtpruefung.",
    type: "best_practice",
    category: "Betrieb",
    author: "anna",
  });

  const { provider, gesehen } = mitschreiber();
  const ask = new AskService({
    reasoner: new Reasoner(provider),
    koService,
    gaps: new InMemoryGapRepo(),
    audit: new AuditService({ repo: new InMemoryAuditRepo() }),
  });
  return { ask, geheim, offen, gesehen };
}

describe("KA4 · D2 · der erlaubte Zweig laesst Vertrauliches NICHT durch", () => {
  // ==============================================================================================
  // UMGEZOGEN (JOB 3549 R5): KA4-V0 und KA4-V1
  // ==============================================================================================
  //
  // Beide Fälle stehen jetzt in `tests/admin-ki-freigabe/verlagerte-modellwege.test.ts`, Block 3 —
  // mit demselben Aufbau (`mitschreiber`, dasselbe vertrauliche und dasselbe offene Objekt) und
  // denselben Erwartungen (`gesehen.length === 1`; die Kennung, „Sonderverfahren" und „Mueller"
  // kommen im Kontext NICHT vor), ergänzt um die Grundfreigabe.
  //
  // WARUM SIE NICHT HIER BLEIBEN KONNTEN: beide verlangen `gesehen.length === 1`, also einen
  // TATSÄCHLICHEN Aufruf des als Cloud verdrahteten Mitschreibers. Unter dem Kern von JOB 3549
  // setzt das die Adminfreigabe voraus; ohne sie bleibt `gesehen` leer („expected +0 to be 1") und
  // „das vertrauliche Objekt ist nicht dabei" wäre die Aussage über eine nie gestellte Frage. Von
  // HIER aus ist die Freigabe auf keinem erlaubten Weg zu setzen: der Testhelfer liegt hinter der
  // Modulgrenze (`.dependency-cruiser.cjs:16-27` — diese Datei liegt im Modul `services/ask`), und
  // die Freigabefelder von Hand zu schreiben verbietet der Freigabe-Wächter F2
  // (`tests/ki-anbieterwahl/routing-zwei-attrappen.test.ts`) ausnahmslos. Unter `tests/` fallen
  // beide Sperren weg. Entschieden von Codex am 11.09. 21:55 („Weg (b)").
  //
  // AM NEUEN ORT WIRD NUR DIE GRUNDFREIGABE GESETZT, NIEMALS `vertraulicheInhalte` — das ist der
  // Gegenstand von KA4-V1: die zweite Freigabe hätte genau die Sperre aufgehoben, die der Fall
  // belegt. Mit der blossen Grundfreigabe findet der Aufruf statt UND das vertrauliche Objekt
  // bleibt draussen.
  //
  // KA4-V2 und KA4-V3 bleiben hier: sie lesen `result.sources` und brauchen keinen Modellaufruf.
  it("KA4-V2 · es taucht auch nicht in Quellen, Zitaten oder Schritten auf", async () => {
    const { ask, geheim } = await aufbauen();
    const { result } = await ask.ask(FRAGE, "anna");
    expect(result.sources).not.toContain(geheim.id);
    expect(result.citedSources).not.toContain(geheim.id);
    expect(result.steps.every((s) => s.sourceId !== geheim.id)).toBe(true);
  });

  it("KA4-V3 · und im ENGEN Zweig ebenso — die Grenze haengt nicht an den Zwangsflags", async () => {
    // Der Gegenbeweis zur naheliegenden Sorge: `dropConfidential` sitzt VOR der Optionsauswertung
    // (`services/ask/src/service.ts:317`), gilt also in beiden Zweigen gleich. Faellt das Flag
    // eines Tages weg, aendert sich an dieser Grenze nichts.
    const { ask, geheim } = await aufbauen();
    const { result } = await ask.ask(FRAGE, "anna", "de", {
      validatedOnly: true,
      retrievalOnly: true,
    });
    expect(result.sources).not.toContain(geheim.id);
  });
});
