// ================================================================================================
// JOB 3276 (KI-ASSIST-LEER) — DAS BUDGET EINES DENKMODELLS UND DIE ANWEISUNG IM REQUEST.
// ================================================================================================
//
// JOB 3222 hat belegt, dass `gpt-6-astra` sein Antwortbudget im Feld `max_completion_tokens`
// erwartet — und dass dieses Budget bei OpenAI REASONING UND sichtbare Ausgabe zusammen deckelt.
// Der assist-Aufruf fuhr danach weiter mit dem Bestandsbudget von 1024 Token für BEIDES. Ein
// Denkmodell verbraucht das im Denken; übrig bleibt eine 200er-Antwort ohne Antwortinhalt — genau
// der Zustand, den Codex am 08.09. live gemessen hat.
//
// Dieser Test misst am GESENDETEN REQUEST, nicht an einer Absicht: welches Feld, welche Zahl,
// welcher System-Prompt. Kein Netz — `fetch` ist gestubbt.
import { afterEach, describe, expect, it, vi } from "vitest";
import { ModelProvider, Reasoner, createCappedCloudClientFromEnv } from "../../services/reasoner";
import type { ModelClient } from "../../services/reasoner";
import { ModelEmptyResponseError } from "../../services/reasoner/src/model-errors";

const KEIN_SCHLUESSELBUND = (): undefined => undefined;
const KEIN_SPEICHERN = (): boolean => false;
const ENV = {
  OPENAI_API_KEY: "sk-test-nur-in-diesem-test",
  OPENAI_MODEL: "gpt-6-astra",
} as const;

type Request = {
  model?: unknown;
  max_tokens?: unknown;
  max_completion_tokens?: unknown;
  messages?: { role?: string; content?: string }[];
};

// Der gesendete Request wird mitgeschrieben; die Antwort ist frei wählbar.
function stubFetch(antwort: unknown): Request[] {
  const gesendet: Request[] = [];
  vi.stubGlobal("fetch", (async (_url: unknown, init?: { body?: unknown }) => {
    gesendet.push(JSON.parse(String(init?.body ?? "{}")) as Request);
    return { ok: true, json: async () => antwort } as unknown as Response;
  }) as unknown as typeof fetch);
  return gesendet;
}

function openAiClient(): ModelClient {
  const client = createCappedCloudClientFromEnv(ENV, KEIN_SCHLUESSELBUND, KEIN_SPEICHERN).openai;
  if (!client) {
    throw new Error("Der OpenAI-Weg ist in diesem Test nicht entstanden.");
  }
  return client;
}

const geglaettet = (text: string): unknown => ({
  choices: [{ finish_reason: "stop", message: { content: text } }],
});

// Die Erwartung, die der Auftrag setzt: Ausgabe ≥ Eingabelänge × 2 + Reserve. Der Test rechnet die
// Untergrenze SELBST aus der Eingabe (grob 4 Zeichen je Token) — er schreibt nicht die Zahl der
// Umsetzung ab, sondern prüft die Zusage.
const mindestBudget = (text: string): number => Math.ceil(text.length / 4) * 2;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("JOB 3276 E · der assist-Request trägt ein Budget, das für Denken UND Antwort reicht", () => {
  it("E1 gpt-6-astra: das Budget steht in max_completion_tokens — und `max_tokens` fehlt", async () => {
    const gesendet = stubFetch(geglaettet("Die Pumpe wurde am Montag notiert."));
    await new ModelProvider(openAiClient()).assistText("die pumpe wurde notirt", "de");

    const request = gesendet[0] as Request;
    expect(request.model).toBe("gpt-6-astra");
    expect(Object.hasOwn(request, "max_tokens")).toBe(false);
    expect(typeof request.max_completion_tokens).toBe("number");
  });

  it("E2 kurzer Text: das Budget bleibt mindestens beim Bestandswert 1024 (Denk-Reserve)", async () => {
    const gesendet = stubFetch(geglaettet("Kurz."));
    await new ModelProvider(openAiClient()).assistText("kurzer satz", "de");

    expect(gesendet[0]?.max_completion_tokens as number).toBeGreaterThanOrEqual(1024);
  });

  it("E3 langer Text: das Budget wächst mit der Eingabe (≥ Eingabe × 2 + Reserve)", async () => {
    const lang = "Bei Überdruck das Ventil X schließen und die Anlage entlasten. ".repeat(120);
    const gesendet = stubFetch(geglaettet("Überarbeitet."));
    await new ModelProvider(openAiClient()).assistText(lang, "de");

    const budget = gesendet[0]?.max_completion_tokens as number;
    expect(budget).toBeGreaterThan(mindestBudget(lang));
    // Die Reserve ist wirklich eine Reserve und nicht nur ein Aufrundungsrest.
    expect(budget - mindestBudget(lang)).toBeGreaterThanOrEqual(512);
  });

  it("E4 sehr langer Text: das Budget hat einen Deckel (der Anbieter rechnet je Token ab)", async () => {
    const sehrLang = "Ventil schließen. ".repeat(6000);
    const gesendet = stubFetch(geglaettet("Überarbeitet."));
    await new ModelProvider(openAiClient()).assistText(sehrLang, "de");

    const budget = gesendet[0]?.max_completion_tokens as number;
    expect(budget).toBeLessThanOrEqual(16384);
    expect(budget).toBeLessThan(mindestBudget(sehrLang));
  });
});

describe("JOB 3276 F · eine abgerissene Antwort ist ein Fehler mit Grund, kein Vorschlag", () => {
  it("F1 finish_reason=length ohne Inhalt → Fehler 'truncated', nicht das Original", async () => {
    stubFetch({ choices: [{ finish_reason: "length", message: { content: "" } }] });

    const fehler = await new ModelProvider(openAiClient())
      .assistText("die pumpe wurde notirt", "de")
      .catch((e: unknown) => e);

    expect(fehler).toBeInstanceOf(ModelEmptyResponseError);
    expect((fehler as ModelEmptyResponseError).reason).toBe("truncated");
    expect((fehler as ModelEmptyResponseError).message).toContain("finish_reason=length");
  });

  // JOB 3276 R3 (Codex-Vorprüfung, 08.09. 16:30): F1 prüfte nur den LEEREN Abbruch. Der Abbruch MIT
  // Inhalt lief bis dahin als vollständiger Vorschlag durch — der gefährlichere der beiden Fälle,
  // weil ein halber Satz aussieht wie ein ganzer. Die ausführliche Messung steht in
  // `assist-unveraendert-und-fragment.test.ts` (J1–J4); hier steht der Fall neben seinem Zwilling,
  // damit er nicht wieder übersehen wird.
  it("F1b finish_reason=length MIT Inhalt → derselbe Fehlerweg, kein halber Vorschlag", async () => {
    const fragment = "Die Pumpe wurde am Montag notiert und die Anzahl stimmt";
    stubFetch({ choices: [{ finish_reason: "length", message: { content: fragment } }] });

    const fehler = await new ModelProvider(openAiClient())
      .assistText("die pumpe wurde notirt", "de")
      .catch((e: unknown) => e);

    expect(fehler).toBeInstanceOf(ModelEmptyResponseError);
    expect((fehler as ModelEmptyResponseError).reason).toBe("truncated");
    expect((fehler as ModelEmptyResponseError).message).not.toContain(fragment);
  });

  it("F2 nur Denkphase, kein Inhalt → Fehler 'reasoning-only' (der teure Fall)", async () => {
    stubFetch({
      choices: [{ finish_reason: "stop", message: { content: "" } }],
      usage: { completion_tokens_details: { reasoning_tokens: 900 } },
    });

    const fehler = await new ModelProvider(openAiClient())
      .assistText("die pumpe wurde notirt", "de")
      .catch((e: unknown) => e);

    expect((fehler as ModelEmptyResponseError).reason).toBe("reasoning-only");
  });

  it("F3 durch die ganze Kette: der Nutzer bekommt die Meldung MIT diesem Grund", async () => {
    stubFetch({ choices: [{ finish_reason: "length", message: { content: "" } }] });
    const reasoner = new Reasoner(new ModelProvider(openAiClient()));

    const fehler = await reasoner.assistText("die pumpe wurde notirt", "de").catch((e) => e);

    const meldung = (fehler as Error).message;
    expect(meldung).toContain("Die KI hat keine Antwort geliefert");
    expect(meldung).toContain("finish_reason=length");
    expect(meldung).toContain("max_completion_tokens=");
  });
});

describe("JOB 3276 G · die Anweisung des Nutzers geht nachweislich mit", () => {
  it("G1 freie Anweisung steht im SYSTEM-Prompt des gesendeten Requests", async () => {
    const gesendet = stubFetch(geglaettet("Überarbeitet."));
    await new ModelProvider(openAiClient()).assistText(
      "die pumpe wurde notirt",
      "de",
      "Korrigiere Rechtschreibung und Grammatik",
    );

    const system = gesendet[0]?.messages?.[0];
    expect(system?.role).toBe("system");
    expect(system?.content).toContain("Korrigiere Rechtschreibung und Grammatik");
    // Der zu überarbeitende Text reist als Nutzer-Nachricht — nicht im System-Prompt.
    expect(gesendet[0]?.messages?.[1]?.content).toBe("die pumpe wurde notirt");
  });

  it("G2 ohne Anweisung trägt der System-Prompt keine Anweisungszeile", async () => {
    const gesendet = stubFetch(geglaettet("Überarbeitet."));
    await new ModelProvider(openAiClient()).assistText("die pumpe wurde notirt", "de");

    expect(gesendet[0]?.messages?.[0]?.content).not.toContain("Bearbeitungs-Anweisung");
  });

  it("G3 die Anweisung erreicht das Modell auch über den Dienst (Reasoner → Provider → Client)", async () => {
    const gesendet = stubFetch(geglaettet("Überarbeitet."));
    const reasoner = new Reasoner(new ModelProvider(openAiClient()));

    await reasoner.assistText("die pumpe wurde notirt", "de", "Fasse kürzer");

    expect(gesendet[0]?.messages?.[0]?.content).toContain("Fasse kürzer");
  });
});
