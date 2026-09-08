// ================================================================================================
// JOB 3276 (KI-ASSIST-LEER) — EIN ORIGINAL IST KEIN VORSCHLAG.
// ================================================================================================
//
// GEMESSENE AUSGANGSLAGE (Codex-Nutzerprüfung review26-ki-editor, 08.09. 04:38–04:51 UTC, Live
// 1.185, Anbieter cloud:openai:gpt-6-astra): alle fünf KI-Funktionen — Klarer, Strukturieren,
// Erweitern, Rechtschreibung, Formatieren — gaben den Eingabetext EINSCHLIESSLICH seiner Fehler
// zurück. Im Haupteditor mit Fallback-Hinweis, im Expertenformular ohne jeden Hinweis.
//
// ZWEI CODESTELLEN ERKLÄREN DAS, und beide sind hier eingefangen:
//   1. `provider-model.ts` assistText: `improved || text.trim()` mit `demo: false`. Eine LEERE
//      Modellantwort wurde damit zum Original — ausgewiesen als Arbeit des Modells.
//   2. `service.ts` runTask: schlägt das Modell fehl, antwortet der deterministische Ersatz. Der
//      kann bei assist nur Leerraum glätten, groß schreiben und einen Punkt setzen; inhaltlich
//      gibt er den Eingabetext zurück. Als „Vorschlag" gereicht ist auch das ein verkleidetes
//      Original.
//
// DIE NEUE ZUSAGE: entweder ein echter Vorschlag des Modells — oder eine ehrliche, sichtbare
// Meldung mit Grund. Nie ein Original als Vorschlag.
import { describe, expect, it } from "vitest";
import { InMemoryModelRunRepo, type ModelRunRecord } from "../../services/model-runs";
import {
  DeterministicProvider,
  type ModelClient,
  ModelProvider,
  Reasoner,
  cappedModelClient,
} from "../../services/reasoner";
import { ModelEmptyResponseError, ModelHttpError } from "../../services/reasoner/src/model-errors";
import type { AssistResult, ReasonerLocale } from "../../services/reasoner/src/types";

const ROHTEXT = "die pumpe wurde am montag notirt und die anzahl stimmt nicht";

// Ein Client, der GENAU das antwortet, was der Fall verlangt — hinter dem ECHTEN Chokepoint
// (cappedModelClient). Ohne ihn trüge der Lauf keinen Modellnamen, und der Test prüfte eine
// Verdrahtung, die es im Produkt nicht gibt. Kein Netz, kein Zeitverhalten.
function client(antwort: string | (() => never)): ModelClient {
  return cappedModelClient(
    {
      name: "cloud:openai:gpt-6-astra",
      model: "gpt-6-astra",
      complete: async () => (typeof antwort === "string" ? antwort : antwort()),
    },
    { rejectsConfidential: false },
  );
}

const wirft400 = (): never => {
  throw new ModelHttpError(
    "ChatGPT (OpenAI) antwortete mit 400: Unsupported parameter (unsupported_parameter)",
    400,
  );
};

describe("JOB 3276 A · die leere Modellantwort wird nie zum Original", () => {
  it("A1 Modell antwortet leer → Fehler, NICHT der Eingabetext (vorher: improved || text)", async () => {
    const provider = new ModelProvider(client(""));

    await expect(provider.assistText(ROHTEXT, "de")).rejects.toThrow(ModelEmptyResponseError);
  });

  it("A2 Modell antwortet nur Leerraum → derselbe Fehlerweg, kein „Vorschlag“ aus Leerzeichen", async () => {
    const provider = new ModelProvider(client("   \n\t  "));

    await expect(provider.assistText(ROHTEXT, "de")).rejects.toThrow(ModelEmptyResponseError);
  });

  it("A3 der Fehler nennt Grund und Modell, aber NIE den Text des Nutzers (PII-frei)", async () => {
    const provider = new ModelProvider(client(""));

    const fehler = await provider.assistText(ROHTEXT, "de").catch((e: unknown) => e);
    expect(fehler).toBeInstanceOf(ModelEmptyResponseError);
    const leer = fehler as ModelEmptyResponseError;
    expect(leer.reason).toBe("empty");
    expect(leer.message).toContain("gpt-6-astra");
    expect(leer.message).not.toContain("notirt");
    expect(leer.message).not.toContain(ROHTEXT);
  });

  it("A4 echte Modellantwort → sie wird übernommen, demo bleibt false", async () => {
    const echt = "Die Pumpe wurde am Montag notiert; die Anzahl stimmt nicht.";
    const provider = new ModelProvider(client(echt));

    const ergebnis = await provider.assistText(ROHTEXT, "de");
    expect(ergebnis.demo).toBe(false);
    expect(ergebnis.text).toBe(echt);
  });
});

describe("JOB 3276 B · der deterministische Ersatz reicht kein Original als Vorschlag", () => {
  // Der Weg, den Pedi geklickt hat: Modell antwortet leer → die Kette fällt auf den
  // deterministischen Ersatz. Der kann bei assist nichts als glätten — also gibt es keinen
  // Vorschlag, sondern eine Meldung.
  it("B1 Modell leer + deterministischer Ersatz → ehrliche Meldung statt geglättetem Original", async () => {
    const reasoner = new Reasoner(new ModelProvider(client("")));

    const fehler = await reasoner.assistText(ROHTEXT, "de").catch((e: unknown) => e);
    expect(fehler).toBeInstanceOf(Error);
    const meldung = (fehler as Error).message;
    expect(meldung).toContain("Die KI hat keine Antwort geliefert");
    // Der GRUND reist mit — ohne ihn wäre die Meldung ehrlich, aber nutzlos.
    expect(meldung).toContain("gpt-6-astra");
    // Und der Eingabetext ist nirgends in der Meldung.
    expect(meldung).not.toContain("notirt");
  });

  it("B2 dieselbe Lage auf Englisch — die Vorführung am 11.09. läuft auf Englisch", async () => {
    const reasoner = new Reasoner(new ModelProvider(client("")));

    const fehler = await reasoner.assistText(ROHTEXT, "en").catch((e: unknown) => e);
    expect((fehler as Error).message).toContain("The AI returned no answer");
  });

  it("B3 ganz ohne Modell: kein geglättetes Original, sondern die ehrliche Meldung mit Grund", async () => {
    const reasoner = new Reasoner();

    const fehler = await reasoner.assistText(ROHTEXT, "de").catch((e: unknown) => e);
    expect(fehler).toBeInstanceOf(Error);
    expect((fehler as Error).message).toContain("Die KI hat keine Antwort geliefert");
    expect((fehler as Error).message).toContain("Kein KI-Modell");
  });

  it("B4 GEGENPROBE zur Regel: ein Ersatz, der WIRKLICH etwas ändert, wird geliefert", async () => {
    // Die Regel ist ein Vergleich, keine pauschale Verweigerung: liefert der Ersatz einen wirklich
    // anderen Inhalt, ist das ein Vorschlag — und er kommt beim Nutzer an (demo: true).
    const echterErsatz = new DeterministicProvider();
    const vorschlag = "Die Pumpe wurde am Montag notiert; die Anzahl stimmt nicht.";
    echterErsatz.assistText = async (): Promise<AssistResult> => ({ text: vorschlag, demo: true });
    const reasoner = new Reasoner(new ModelProvider(client("")), echterErsatz);

    const ergebnis = await reasoner.assistText(ROHTEXT, "de");
    expect(ergebnis.demo).toBe(true);
    expect(ergebnis.text).toBe(vorschlag);
  });

  it("B5 nur Groß-/Kleinschreibung, Leerraum und Schlusspunkt sind KEIN Vorschlag", async () => {
    // Genau das ist die Leistung des deterministischen Ersatzes — und genau das hat Pedi als
    // „unveränderten Text" gesehen. Der Vergleich prüft den INHALT, nicht die Zeichenkette.
    const kosmetischerErsatz = new DeterministicProvider();
    kosmetischerErsatz.assistText = async (text: string): Promise<AssistResult> => ({
      text: `${text
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^./, (c) => c.toUpperCase())}.`,
      demo: true,
    });
    const reasoner = new Reasoner(new ModelProvider(client("")), kosmetischerErsatz);

    await expect(reasoner.assistText(ROHTEXT, "de")).rejects.toThrow(
      /Die KI hat keine Antwort geliefert/,
    );
  });
});

describe("JOB 3276 C · der Fehlschlag steht im Laufprotokoll (Anbieter, Modell, Grund)", () => {
  it("C1 der assist-Lauf wird als Fehler mit Anbieter, Modell und Grund geschrieben", async () => {
    const repo = new InMemoryModelRunRepo();
    const reasoner = new Reasoner(new ModelProvider(client("")), new DeterministicProvider(), repo);

    await reasoner.assistText(ROHTEXT, "de").catch(() => undefined);

    const laeufe: ModelRunRecord[] = await repo.recent(10);
    expect(laeufe).toHaveLength(1);
    const lauf = laeufe[0] as ModelRunRecord;
    expect(lauf.task).toBe("assist");
    expect(lauf.status).toBe("error");
    expect(lauf.model).toBe("gpt-6-astra");
    // Der Grund ist die Metadaten-Auskunft des Clients — nie der Text des Nutzers.
    expect(lauf.error ?? "").toContain("gpt-6-astra");
    expect(lauf.error ?? "").not.toContain("notirt");
  });

  it("C2 fällt ein Glied aus und ein späteres antwortet, nennt der ERFOLGS-Datensatz die Ursache", async () => {
    // Der Befund, den Codex am 08.09. für das Interview gemeldet hat: die Fläche sagte
    // „Deterministischer Fallback", und das Protokoll schwieg dazu, WARUM. Ein zweiter Datensatz je
    // Versuch wäre eine zweite Zählung desselben Laufs — die Ursache steht deshalb IM Datensatz des
    // Laufs, mit Anbieter und Modell.
    const repo = new InMemoryModelRunRepo();
    const reasoner = new Reasoner(
      new ModelProvider(client(wirft400)),
      new DeterministicProvider(),
      repo,
    );

    const ergebnis = await reasoner.interview(["Bei Überdruck Ventil X schließen."], "de");
    expect(ergebnis.demo).toBe(true);

    const laeufe: ModelRunRecord[] = await repo.recent(10);
    expect(laeufe).toHaveLength(1);
    const lauf = laeufe[0] as ModelRunRecord;
    expect(lauf.task).toBe("interview");
    expect(lauf.status).toBe("success");
    expect(lauf.demo).toBe(true);
    expect(lauf.error ?? "").toContain("cloud:openai:gpt-6-astra");
    expect(lauf.error ?? "").toContain("gpt-6-astra");
    expect(lauf.error ?? "").toContain("antwortete mit 400");
    expect(lauf.error ?? "").not.toContain("Ventil X");
  });

  it("C3 ein Lauf ohne gescheiterten Versuch trägt weiterhin KEINE Fehlerauskunft", async () => {
    const repo = new InMemoryModelRunRepo();
    const reasoner = new Reasoner(
      new ModelProvider(client("Die Pumpe wurde am Montag notiert.")),
      new DeterministicProvider(),
      repo,
    );

    await reasoner.assistText(ROHTEXT, "de");

    const lauf = (await repo.recent(10))[0] as ModelRunRecord;
    expect(lauf.status).toBe("success");
    expect(Object.hasOwn(lauf, "error")).toBe(false);
  });
});

describe("JOB 3276 D · die Meldung ist lokalisiert und sagt, was gilt", () => {
  const faelle: ReadonlyArray<[ReasonerLocale, RegExp]> = [
    ["de", /^Die KI hat keine Antwort geliefert\. Grund: /],
    ["en", /^The AI returned no answer\. Reason: /],
  ];
  for (const [locale, muster] of faelle) {
    it(`D-${locale} die Meldung beginnt mit dem festen Satz und nennt danach den Grund`, async () => {
      const reasoner = new Reasoner(new ModelProvider(client("")));

      const fehler = await reasoner.assistText(ROHTEXT, locale).catch((e: unknown) => e);
      expect((fehler as Error).message).toMatch(muster);
    });
  }
});
