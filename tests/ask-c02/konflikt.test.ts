// ================================================================================================
// JOB 3365 · ASK-C02-KONFLIKT — DER RÜCKFALL DARF NICHT STILL EINE FRIST WÄHLEN.
// ================================================================================================
//
// DER BEFUND, den JOB 3353 R4 gemessen und ausdrücklich NICHT festgeschrieben hat (Rückgabe R4,
// REST 2; Codex 8950be7a/b9949f58): im Bestand stehen zwei nachvollziehbar abweichende Fristen —
// der freigegebene Stand sagt 30 Kalendertage, die importierte Confluence-Kopie 45. Pedis Frage
// verlangt wörtlich „If the sources disagree, say so rather than choosing silently". Sagt das
// Modell daraufhin einen freien Satz ÜBER die Quellen („The sources disagree …"), verwirft ihn die
// Zitatprüfung zu Recht (ein Nachlauf ohne Marke ist von keiner Quelle gedeckt), der
// Deckungsrückfall greift — und gab bis zu diesem Auftrag NUR die 30 Tage aus, mit `answered:true`
// und EINER Quelle. Der belegte Widerspruch verschwand damit still auf der letzten Kante.
//
// WAS DIESER PRÜFSTAND MISST UND WAS NICHT:
//  · GEMESSEN: die ECHTE Kette (KoService mit aktiver Suchprojektion → AskService → Reasoner →
//    ModelProvider). Einziges Testdoppel ist der Modell-Client; er schreibt mit, was ihm vorlag.
//  · NICHT GEMESSEN: ein echter Modellaufruf und die Anzeige. Die Anzeige misst der gemountete
//    Fall (konflikt-flaeche-mounted.test.tsx), die Modell-Generalprobe fährt Codex.
//
// K1/K2 SIND DIE ROTEN FÄLLE dieses Auftrags (red-first, Akzeptanzkriterium 4): vor der Änderung
// an `provider-model.ts` schlagen sie fehl, weil `antwort.result.answer` genau
// „Standard invoices are due 30 calendar days after the invoice date." ist — eine scheinbar
// eindeutige Frist aus EINER Quelle. K3 ist der Gegenfall (gleiche Fristen, kein Widerspruch),
// K4 hält fest, dass eine GEDECKTE Modellantwort unangetastet bleibt.
//
// KEIN MODELLAUFRUF: `KLARWERK_SKIP_KEYCHAIN` schaltet zusätzlich die Schlüsselbund-Auflösung ab,
// damit auf einer Maschine mit hinterlegtem Schlüssel kein echter Aufruf über das Ergebnis
// entscheidet (dieselbe Vorsichtsmaßnahme wie in befund.test.ts).
//
// EIGENER AUFBAU, NICHT WIEDERVERWENDET: `befund.test.ts` ist der Prüfstand von JOB 3353 und bleibt
// für diesen Auftrag Zeichen für Zeichen unangetastet — sonst könnte niemand mehr nachlesen, was
// dort gemessen wurde. Der Bestand wird hier deshalb erneut aus derselben Paketquelle gebaut.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ADVISOR_FICTION_NOTICE,
  ADVISOR_ICT_EN_V1,
} from "../../services/app/src/example-packages/advisor-ict-en-v1";
import { InMemoryGapRepo } from "../../services/ask/src/repo";
import { AskService } from "../../services/ask/src/service";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import { type ModelClient, Reasoner } from "../../services/reasoner";
import { ModelProvider } from "../../services/reasoner/src/provider-model";
// JOB 3588: die GRUNDFREIGABE im Aufbau. Alle vier Fälle messen einen ECHTEN Modellweg (der
// `mitschreiber` zählt den Prompt und die Antwort geht durch); ohne die Adminfreigabe des Kerns von
// JOB 3549 liefe kein Modell, und „beide Quellen stehen in der Antwort" wäre eine Aussage über den
// deterministischen Ersatz. KEINE Freigabe für VERTRAULICHES: kein Fall stuft hier etwas so ein.
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

/** Der Baustein C02 des Demopakets — aus der Paketdefinition, nicht abgeschrieben. */
const C02 = ADVISOR_ICT_EN_V1.items.find((i) => i.key === "C02");
if (!C02) {
  throw new Error("Baustein C02 fehlt in ADVISOR_ICT_EN_V1 — dieser Prüfstand hängt an ihm.");
}
const ABSAETZE = C02.paragraphs;
const REGELSATZ_30 = ABSAETZE[0] as string;
/** Die abweichende Frist der importierten Seite — der einzige Unterschied zum freigegebenen Stand. */
const REGELSATZ_45 = "Standard invoices are due 45 calendar days after the invoice date.";
const ABSAETZE_45 = [REGELSATZ_45, ...ABSAETZE.slice(1)];

/** Pedis Frage in der Form, in der sie am Freitag gestellt wird (wörtlich, Codex d1710126). */
const FRAGE_LANG =
  "In the fictional Advisor ICT demo data, what is the standard invoice payment period? Answer in English and cite the stored source. If the sources disagree, say so rather than choosing silently.";
/** Dieselbe Sache, kurz gefragt (Codex-Gegenprobe a2c15bbf, wörtlich). */
const FRAGE_KURZ = "What is the standard invoice due date?";

/**
 * DIE MODELLANTWORT, DIE DEN FALL AUSLÖST — und sie ist nicht ausgedacht, sondern die Form, die
 * JOB 3353 R4 am 09.09. in diesem Arbeitsbaum gemessen hat: ein gedeckter Regelsatz mit Marke, und
 * DAHINTER ein freier Satz ÜBER die Quellen, den keine Quelle wörtlich trägt. Die Zitatprüfung
 * verwirft ihn (`pruefeDeckung`: der Nachlauf ist eine eigene Aussage ohne Quelle) — genau so soll
 * sie arbeiten, daran ändert dieser Auftrag nichts. Der Fall beginnt erst DANACH.
 */
const METASATZ_VERWORFEN = `${REGELSATZ_30} [1] The sources disagree about the payment period.`;

/** Ein Modell-Client, der mitschreibt, was ihm vorgelegt wurde, und eine feste Antwort gibt. */
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

/**
 * Der Bestand über die ECHTEN Dienste: das freigegebene Paketobjekt (30) und die offene
 * Confluence-Kopie derselben Seite (45 oder, im Gegenfall, ebenfalls 30). KEIN vorangelegter
 * Konfliktdatensatz — Akzeptanzkriterium 1: der Widerspruch muss auf dieser Kante sichtbar bleiben,
 * nicht über den gespeicherten Konfliktweg.
 */
async function aufbauen(antwort: string, kopieAbsaetze: readonly string[]) {
  const koService = new KoService({ repo: new InMemoryKoRepo() });
  await koService.activateSearchProjectionV2();
  const paket = await koService.create({
    title: "[Beispiel] Standard invoice due date",
    statement: ABSAETZE.join("\n\n"),
    bodyHtml: ABSAETZE.map((a) => `<p>${a}</p>`).join(""),
    type: "best_practice",
    category: "Commercial",
    author: "anna",
  });
  await koService.setValidationState(paket.id, { trust: 90, status: "validiert" });
  const kopie = await koService.create({
    title: "[DEMO C02] Standard invoice due date",
    statement: ADVISOR_FICTION_NOTICE,
    bodyHtml: kopieAbsaetze.map((a) => `<p>${a}</p>`).join(""),
    type: "best_practice",
    category: "Commercial",
    author: "bea",
  });
  const { client, prompts } = mitschreiber(antwort);
  const reasoner = new Reasoner(new ModelProvider(client));
  await erteileKiFreigabe(reasoner);
  const ask = new AskService({
    reasoner,
    koService,
    gaps: new InMemoryGapRepo(),
    audit: new AuditService({ repo: new InMemoryAuditRepo() }),
  });
  return { ask, paket, kopie, prompts };
}

describe("JOB 3365 K · zwei abweichende Fristen, verworfener Metasatz", () => {
  for (const [name, frage] of [
    ["lang", FRAGE_LANG],
    ["kurz", FRAGE_KURZ],
  ] as const) {
    it(`K1/${name} · der Rückfall gibt NICHT still nur die 30 Tage aus — beide Quellen stehen in der Antwort`, async () => {
      const { ask, paket, kopie, prompts } = await aufbauen(METASATZ_VERWORFEN, ABSAETZE_45);
      const antwort = await ask.ask(frage, "anna", "en");

      // 0. VORBEDINGUNG: beide Fristen lagen dem Modell wirklich vor — sonst misst alles Weitere
      //    die Auswahl und nicht den Rückfall.
      const prompt = prompts()[0] ?? "";
      expect(prompt).toContain("30 calendar days");
      expect(prompt).toContain("45 calendar days");

      // 1. DER KERN: die Antwort ist nicht die scheinbar eindeutige Frist aus EINER Quelle.
      const text = antwort.result.answer ?? "";
      expect(text, "der stille 30-Tage-Rückfall steht unverändert da").not.toBe(REGELSATZ_30);
      // 2. Beide belegten Fristen sind sichtbar — der Widerspruch bleibt lesbar.
      expect(text).toContain("30 calendar days");
      expect(text).toContain("45 calendar days");
      // 3. Beide Quellen sind als Beleg genannt, nicht nur die eine, die das Modell markiert hat.
      expect(antwort.result.citedSources).toEqual(expect.arrayContaining([paket.id, kopie.id]));
      // 4. Der freie Modellsatz geht weiterhin NICHT hinaus (die Zitatprüfung bleibt scharf).
      expect(text).not.toContain("The sources disagree about the payment period");
      // 5. Die Einstufung ist ehrlich: eine offene Quelle trägt mit, also nichts „Gesichertes".
      expect(antwort.result.knowledgeClass).toBe("ungeprueft");
      expect(antwort.result.trust).toBe(0);
    });
  }

  it("K3 · GEGENFALL: gleiche Frist in beiden Quellen — keine Konfliktaussage, keine Fehlmeldung", async () => {
    // Derselbe Aufbau, ein Unterschied: die Kopie trägt DENSELBEN Regelsatz. Dann gibt es nichts
    // abzuwägen, und der Rückfall bleibt Zeichen für Zeichen der Bestandsrückfall aus JOB 3353.
    const { ask, paket, kopie } = await aufbauen(METASATZ_VERWORFEN, ABSAETZE);
    const antwort = await ask.ask(FRAGE_LANG, "anna", "en");
    expect(antwort.result.answered).toBe(true);
    expect(antwort.result.answer).toBe(REGELSATZ_30);
    expect(antwort.result.citedSources).toEqual([paket.id]);
    // Kein Hinweis auf abweichende Quellen — weder in der einen noch in der anderen Sprache.
    expect(antwort.result.answer ?? "").not.toMatch(/different|unterschiedlich|disagree/i);
    // Die Kopie bleibt Transparenzquelle, wird aber nicht zum Beleg erhoben.
    expect(antwort.result.sources).toEqual(expect.arrayContaining([paket.id, kopie.id]));
    // Der freigegebene Stand trägt die Antwort allein — die Einstufung bleibt die alte.
    expect(antwort.result.knowledgeClass).toBe("gesichert");
    expect(antwort.result.trust).toBe(90);
  });

  it("K4 · GEGENFALL: hält die Deckung, geht der Modelltext unverändert hinaus", async () => {
    // Der Rückfall ist ein RÜCKFALL. Markiert das Modell beide Fristen und trägt jede Aussage ihre
    // Quelle, ändert dieser Auftrag am Ergebnis nichts.
    const gedeckt = `${REGELSATZ_30} [1] ${REGELSATZ_45} [2]`;
    const { ask, paket, kopie } = await aufbauen(gedeckt, ABSAETZE_45);
    const antwort = await ask.ask(FRAGE_LANG, "anna", "en");
    expect(antwort.result.answer).toBe(gedeckt);
    expect(antwort.result.citedSources).toEqual(expect.arrayContaining([paket.id, kopie.id]));
  });
});
