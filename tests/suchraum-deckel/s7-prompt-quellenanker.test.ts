// ================================================================================================
// AUFNAHME 20260922 · priority:S7 — DIE TITELQUELLE ERREICHT DEN PROMPT, UND IHRE MARKE TRÄGT.
// ================================================================================================
//
// Der Kandidatenweg allein belegt S7 nicht: eine Quelle kann Kandidat sein und trotzdem nie im
// Prompt stehen, oder im Prompt stehen und ihre Marke an eine andere Quelle verlieren. Gemessen wird
// deshalb der ganze Weg, mit ECHTEN Diensten: `KoService` (Suche, Deckel, Güteauswahl),
// `AskService.ask` ohne `retrievalOnly`, `Reasoner` und `ModelProvider` (Auswahl, Prompt, Marken,
// Deckungsprüfung). Ersetzt ist ausschliesslich der `ModelClient`: ein mitschreibender Client, der
// den vorgelegten Prompt aufzeichnet und eine feste, wörtlich gedeckte Antwort zurückgibt. Kein
// Netz, kein Schlüssel, kein externes Modell.
//
// DER BESTAND (S7, Reihe 2 E mit dem Trust aus dem Aufnahmepunkt): die Topasfenster-Zielquelle mit
// Trust 83 trägt die Frage in Titel und Aussage; 60 validierte Objekte mit Trust 99 tragen ALLE
// Fragewörter, aber ausschliesslich im Fließtext.
//
// GEGENPROBE: das Modell nennt eine Marke, die es im Prompt nicht gibt. Daraus darf keine Zuordnung
// zur Zielquelle entstehen — weder in `citedSources` noch in `sources`.
//
// NICHT GEMESSEN: die Darstellung an der Oberfläche (Web/Word) und ein echtes Modell.
import { describe, expect, it } from "vitest";
import { InMemoryGapRepo } from "../../services/ask/src/repo";
import { AskService } from "../../services/ask/src/service";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import { type ModelClient, Reasoner, queryTokens } from "../../services/reasoner";
import { ModelProvider } from "../../services/reasoner/src/provider-model";
// JOB 3588: die Grundfreigabe — ohne sie ruft der Fragedienst kein Modell, und „die Quelle steht im
// Prompt" wäre eine Aussage über einen Prompt, den es nicht gibt. Nichts ist vertraulich eingestuft.
import { erteileKiFreigabe } from "../../services/reasoner/src/testhelfer-ki-freigabe";

// Dieselbe Frage und dieselbe Zielquelle wie `tests/ask-titelquelle/s7-titelquelle-messung.test.ts`.
const FRAGE = "Womit werden Topasfenster gereinigt und welche Freigabemarke gilt?";
const TERME = queryTokens(FRAGE);
const ZIELTITEL = "Topasfenster reinigen und Freigabemarke";
const ZIELSATZ = "Topasfenster werden mit Zitrusseife gereinigt; es gilt die Freigabemarke K7.";
const ZIELAUSSAGE = `${ZIELSATZ} ${TERME.join(" ")}.`;
const ZIEL_TRUST = 83;
const KOERPER_TRUST = 99;
const KOERPERTREFFER = 60;

/** Die Marke, unter der der Prompt die Zielquelle führt — gelesen, nicht angenommen. */
function zielmarke(prompt: string): number | undefined {
  const zeile = new RegExp(`^\\[(\\d+)\\] ${ZIELTITEL}: `, "m").exec(prompt);
  return zeile ? Number(zeile[1]) : undefined;
}

/** Alle Marken des Prompts — für die Gegenprobe „diese Marke gibt es nicht". */
function markenImPrompt(prompt: string): number[] {
  return [...prompt.matchAll(/^\[(\d+)\] /gm)].map((m) => Number(m[1]));
}

/** Der aufzeichnende Testclient: schreibt jeden Prompt mit, die Antwort bildet `antwort`. */
function mitschreiber(antwort: (prompt: string) => string): {
  client: ModelClient;
  prompts: () => string[];
} {
  const prompts: string[] = [];
  return {
    client: {
      name: "mitschreiber",
      complete: async (_system: string, user: string) => {
        prompts.push(user);
        return antwort(user);
      },
    },
    prompts: () => prompts,
  };
}

async function aufbauen(antwort: (prompt: string) => string) {
  const koService = new KoService({ repo: new InMemoryKoRepo() });
  // Die Suche ist fail-closed; die Projektion wird über den Produktpfad freigegeben.
  await koService.activateSearchProjectionV2();
  const ziel = await koService.create({
    title: ZIELTITEL,
    statement: ZIELAUSSAGE,
    type: "best_practice",
    category: "Wartung",
    author: "anna",
  });
  await koService.setValidationState(ziel.id, { trust: ZIEL_TRUST, status: "validiert" });
  const koerper: string[] = [];
  for (let i = 0; i < KOERPERTREFFER; i += 1) {
    const ko = await koService.create({
      title: `Sammelvermerk ${i}`,
      statement: `Allgemeine Ablaufnotiz ${i} ohne eigene Auskunft.`,
      type: "best_practice",
      category: "Wartung",
      author: "anna",
      bodyHtml:
        `<p>${"Ablaufnotiz ohne eigenen Bezug zur Anfrage. ".repeat(6)}</p>` +
        `<p>Vermerk ${i}: ${TERME.join(" ")}.</p>`,
    });
    await koService.setValidationState(ko.id, { trust: KOERPER_TRUST, status: "validiert" });
    koerper.push(ko.id);
  }
  const { client, prompts } = mitschreiber(antwort);
  const reasoner = new Reasoner(new ModelProvider(client));
  await erteileKiFreigabe(reasoner);
  const ask = new AskService({
    reasoner,
    koService,
    gaps: new InMemoryGapRepo(),
    audit: new AuditService({ repo: new InMemoryAuditRepo() }),
  });
  return { ask, koService, zielId: ziel.id, koerper, prompts };
}

describe("S7 · Prompt und Quellenanker — Trust 83 gegen 60 Körpertreffer mit 99", () => {
  it("K0 · Kalibrierung: Mehrwortfrage, und die Störer tragen jedes Fragewort nur im Fließtext", async () => {
    expect(TERME.length).toBeGreaterThanOrEqual(3);
    const { koService, koerper } = await aufbauen(() => "");
    const projektion = await koService.searchProjectionOf(koerper[0] ?? "");
    const stoerer = await koService.get(koerper[0] ?? "");
    for (const term of TERME) {
      expect(projektion?.bodyText.toLowerCase(), `Störer trägt „${term}" im Körper`).toContain(
        term,
      );
      expect(`${stoerer?.title} ${stoerer?.statement}`.toLowerCase()).not.toContain(term);
    }
  }, 120_000);

  it("P1 · der Produktprompt trägt Zielinhalt und Zielmarke; die Marke führt bis sources und citedSources", async () => {
    const { ask, zielId, koerper, prompts } = await aufbauen((prompt) => {
      const marke = zielmarke(prompt);
      return marke === undefined ? "" : `${ZIELSATZ} [${marke}]`;
    });

    const { result } = await ask.ask(FRAGE, "anna", "de");

    expect(prompts(), "das Modell wurde genau einmal gefragt").toHaveLength(1);
    const prompt = prompts()[0] ?? "";
    const marke = zielmarke(prompt);
    expect(marke, "die Zielquelle steht mit nummerierter Marke im Prompt").toBeDefined();
    expect(prompt).toContain(`[${marke}] ${ZIELTITEL}: ${ZIELSATZ}`);
    // Die 60 Körpertreffer standen wirklich im Wettbewerb um den Prompt.
    expect(markenImPrompt(prompt).length).toBeGreaterThan(1);
    console.info(
      `[S7 · P1] Marken im Prompt: ${markenImPrompt(prompt).length} · Zielmarke: [${marke}] · sources: ${result.sources.length} · citedSources: ${JSON.stringify(result.citedSources)}`,
    );

    expect(result.answered).toBe(true);
    expect(result.answer).toContain("Zitrusseife");
    expect(result.sources).toContain(zielId);
    expect(result.citedSources).toEqual([zielId]);
    // Keine Körperquelle erbt die Marke der Zielquelle.
    for (const id of koerper) {
      expect(result.citedSources).not.toContain(id);
    }
  }, 120_000);

  it("P2 · Gegenprobe: eine Marke, die es im Prompt nicht gibt, wird keiner Quelle zugeordnet", async () => {
    let falscheMarke = 0;
    const { ask, zielId, prompts } = await aufbauen((prompt) => {
      falscheMarke = Math.max(0, ...markenImPrompt(prompt)) + 90;
      return `${ZIELSATZ} [${falscheMarke}]`;
    });

    const { result } = await ask.ask(FRAGE, "anna", "de");

    // Der Prompt existiert und trägt die Zielquelle — sonst wäre die Gegenprobe leer.
    expect(prompts()).toHaveLength(1);
    const prompt = prompts()[0] ?? "";
    expect(zielmarke(prompt)).toBeDefined();
    expect(markenImPrompt(prompt)).not.toContain(falscheMarke);

    expect(result.citedSources).not.toContain(zielId);
    expect(result.sources).not.toContain(zielId);
    expect(result.answered).toBe(false);
  }, 120_000);
});
