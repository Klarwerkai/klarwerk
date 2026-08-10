// ================================================================================================
// AUFTRAG-mega61 BLOCK G — DIE ZUSAGE, DIE IN DER DATENSCHUTZERKLÄRUNG STEHT.
// ================================================================================================
//
// DIESER TEST IST DIE BEDINGUNG DAFÜR, DASS EIN SATZ ÜBERHAUPT DASTEHEN DARF. Abschnitt 8 der
// Datenschutzerklärung (`legal.privacy.s8.p3`) sagt: „Wissensobjekte, die als vertraulich oder
// streng vertraulich eingestuft sind, werden aus dem Zusammenhang entfernt, bevor eine Frage an
// ein Modell geht — sie erreichen das Modell nicht." Ohne einen Fall, der rot werden kann, wäre
// das eine Behauptung gegenüber Kunden und Aufsichtsbehörden.
//
// ------------------------------------------------------------------------------------------------
// DER BEFUND, DER ZU DIESEM TEST GEFÜHRT HAT (Register T5), damit er nachvollziehbar bleibt:
//
// Der Weg war ZU, aber nur durch EINE Barriere und ohne zweites Netz.
//   · `services/ask/src/service.ts:139` entfernt vertrauliche Objekte (`dropConfidential`), bevor
//     der Reasoner sie sieht. Das wirkt, und `G1` unten hält es fest.
//   · `services/reasoner/src/service.ts` gab `answer` als EINZIGER der acht Aufgaben keinen
//     `confidential`-Parameter weiter; er blieb auf `false`. Damit entfernte `providerChain` die
//     Cloud-Kante auf dem Antwortweg NIE, und der Wächter am Engpass
//     (`ConfidentialEgressError`, model-concurrency.ts:174-178) — der ausschließlich dieses
//     Boolean prüft und nie einen Prompt scannt — konnte dort gar nicht auslösen.
//   · `services/reasoner/src/provider-model.ts` reichte zusätzlich hart `false` an den Engpass.
//
// mega61 hat das Netz gespannt: der Wert wird aus dem Kontext abgeleitet, den der Ask-Dienst
// WIRKLICH übergibt, und bis zum Engpass durchgereicht. Heute ist er immer `false` (der Filter
// greift ja) — G3 hält genau das fest, und G4 belegt, dass das Netz bei `true` auch wirklich fängt.
// ------------------------------------------------------------------------------------------------
import { describe, expect, it } from "vitest";
import { InMemoryGapRepo } from "../../services/ask/src/repo";
import { AskService } from "../../services/ask/src/service";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import {
  type AnswerResult,
  type KnowledgeRef,
  Reasoner,
  type ReasonerLocale,
  type ReasonerProvider,
} from "../../services/reasoner";

const FRAGE = "Was tun bei Störung der Xylophon-Anlage?";

/**
 * Ein Provider, der NICHTS kann außer mitschreiben, was ihm vorgelegt wurde. Er steht als PRIMÄR
 * in der Kette — also genau an der Stelle, an der in Produktion die Cloud steht. Was hier ankommt,
 * ist damit exakt das, was ein Cloud-Modell zu sehen bekäme.
 */
function mitschreibenderProvider(): {
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

async function aufbauen(vertraulich: boolean) {
  const koService = new KoService({ repo: new InMemoryKoRepo() });
  // G27 R1 / Entscheidung 06 §4: mechanische Initialisierung über den PRODUKTPFAD. Die Suche ist
  // seit R1 fail-closed; ein direkter Testaufbau ist eine nicht in Betrieb genommene Instanz.
  // In der echten App tut das die Startorchestrierung in build-app.ts.
  await koService.activateSearchProjectionV2();
  const ko = await koService.create({
    title: "Xylophon Notfall",
    statement: "Xylophon-Anlage bei Störung sofort abschalten.",
    type: "best_practice",
    category: vertraulich ? "Geheim" : "Betrieb",
    author: "anna",
    ...(vertraulich ? { confidentiality: "vertraulich" as const } : {}),
  });
  const { provider, gesehen } = mitschreibenderProvider();
  const ask = new AskService({
    reasoner: new Reasoner(provider),
    koService,
    gaps: new InMemoryGapRepo(),
    audit: new AuditService({ repo: new InMemoryAuditRepo() }),
  });
  return { ask, ko, gesehen };
}

describe("mega61 G · vertrauliche Inhalte erreichen den Antwortweg nicht", () => {
  it("KALIBRIERUNG: ein NICHT-vertrauliches Objekt kommt beim Modell an", async () => {
    // Ohne diesen Fall wäre jeder „ist nicht dabei"-Fall unten auch dann grün, wenn der
    // Antwortweg gar kein Objekt mehr übergäbe. Er ist die Messlatte, nicht die Zusage.
    const { ask, ko, gesehen } = await aufbauen(false);
    await ask.ask(FRAGE, "anna");
    expect(gesehen.length).toBe(1);
    expect(gesehen[0]?.kontext.map((k) => k.id)).toContain(ko.id);
  });

  it("G1 · ein VERTRAULICHES Objekt ist im Modellkontext NICHT enthalten", async () => {
    const { ask, ko, gesehen } = await aufbauen(true);
    await ask.ask(FRAGE, "anna");
    expect(gesehen.length).toBe(1);
    const kontext = gesehen[0]?.kontext ?? [];
    expect(kontext.map((k) => k.id)).not.toContain(ko.id);
    // Und zwar nicht nur die Kennung: auch kein Titel und keine Aussage des Objekts.
    const roh = JSON.stringify(kontext);
    expect(roh).not.toContain("Xylophon");
    expect(roh).not.toContain("sofort abschalten");
  });

  it("G2 · das Objekt taucht auch nicht in Quellen, Zitaten oder Schritten auf", async () => {
    // Derselbe Filter deckt alle drei Egress-Wege — das ist die Zusage aus SCRUM-502, und sie
    // bleibt hier festgenagelt, weil Abschnitt 8 der Datenschutzerklärung darauf aufbaut.
    const { ask, ko } = await aufbauen(true);
    const { result } = await ask.ask(FRAGE, "anna");
    expect(result.sources).not.toContain(ko.id);
    expect(result.citedSources).not.toContain(ko.id);
    expect(result.steps.every((s) => s.sourceId !== ko.id)).toBe(true);
  });

  it("G3 · der Vertraulichkeits-Parameter wird ÜBERHAUPT durchgereicht — er ist nicht mehr tot", async () => {
    // Der Kern des Befunds: bis mega60 kam bei `answer` gar kein Wert an (der Vorgabewert `false`
    // stand still im Reasoner). Jetzt kommt einer an, und er ist aus dem tatsächlich übergebenen
    // Kontext abgeleitet — also `false`, weil der Filter davor greift. Wäre er `undefined`, hätte
    // die Kette den Wert wieder verschluckt.
    const { ask, gesehen } = await aufbauen(true);
    await ask.ask(FRAGE, "anna");
    expect(gesehen[0]?.confidential).toBe(false);
  });

  it("G4 · DAS NETZ FÄNGT: bei vertraulichem Kontext fällt die Cloud aus der Kette", async () => {
    // Die Gegenprobe zum Befund. Ein Provider, der sich wie die Cloud verhält (er lehnt
    // vertraulichen Egress am Engpass ab), darf bei `confidential=true` gar nicht erst gefragt
    // werden. Vor mega61 wäre er auf dem Antwortweg IMMER gefragt worden.
    let gefragt = 0;
    const cloud = {
      name: "cloud",
      isAvailable: () => true,
      rejectsConfidential: () => true,
      answer: async (): Promise<AnswerResult> => {
        gefragt += 1;
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
    const reasoner = new Reasoner(cloud);

    // Nicht vertraulich → die Cloud wird gefragt (Kalibrierung).
    await reasoner.answer(FRAGE, [], "de", false);
    expect(gefragt).toBe(1);

    // Vertraulich → sie wird NICHT gefragt; der deterministische Rückfall antwortet.
    const vertraulich = await reasoner.answer(FRAGE, [], "de", true);
    expect(gefragt).toBe(1);
    expect(vertraulich.demo).toBe(true);
  });

  it("G5 · der Protokolleintrag der Antwort trägt jetzt den Handelnden", async () => {
    // Vierter Punkt des Blocks: bis mega60 war der Beleg der HÄUFIGSTEN KI-Handlung des Produkts
    // niemandem zuzuordnen. Der Gegenstand bleibt bewusst leer — bei einer Antwort ist er eine
    // Trefferliste, kein einzelnes Objekt.
    const koService = new KoService({ repo: new InMemoryKoRepo() });
    // G27 R1 / Entscheidung 06 §4: mechanische Initialisierung über den PRODUKTPFAD. Die Suche ist
    // seit R1 fail-closed; ein direkter Testaufbau ist eine nicht in Betrieb genommene Instanz.
    // In der echten App tut das die Startorchestrierung in build-app.ts.
    await koService.activateSearchProjectionV2();
    await koService.create({
      title: "Xylophon Notfall",
      statement: "Xylophon-Anlage bei Störung sofort abschalten.",
      type: "best_practice",
      category: "Betrieb",
      author: "anna",
    });
    const laeufe: { actor?: string }[] = [];
    const modelRuns = {
      append: async (record: { actor?: string }) => {
        laeufe.push(record);
      },
      list: async () => [],
    };
    const ask = new AskService({
      reasoner: new Reasoner(undefined, undefined, modelRuns as never),
      koService,
      gaps: new InMemoryGapRepo(),
      audit: new AuditService({ repo: new InMemoryAuditRepo() }),
    });
    await ask.ask(FRAGE, "anna");
    expect(laeufe.length).toBeGreaterThan(0);
    expect(laeufe[0]?.actor).toBe("anna");
  });
});
