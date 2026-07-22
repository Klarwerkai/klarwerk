// WP-KLARA-ASK-FIX (bens Fix 1 + Fix 5, P0-Kern): SERVER-erzwungener retrieval-only-Modus von
// POST /api/ask — der Word-Weg (markierter Dokumenttext ist potenziell vertraulich) darf NIE zur
// Cloud. ECHTE App-Integrationstests (build-app + InMemory-Repos + Spys an den echten Flaechen,
// bens Punkt 2 — keine Fake-Fetch-Ebene):
//  - Modell-Spy sitzt auf reasoner.answer der GETEILTEN Instanz (die einzige Synthese-Flaeche des
//    Ask-Pfads; AskService haelt exakt dieses Objekt) — der Konsolen-Gegenlauf beweist, dass der
//    Spy echt greift (1 Aufruf ohne mode), retrieval-only bleibt bei exakt 0.
//  - Embedder-Spy wrappt das embedding-Modul (jeder embed()-Aufruf im App-Graph zaehlt); der
//    Prefilter ist aktiv geschaltet, damit der Chokepoint real existiert.
//  - Offene KOs sind NIE Grundlage (validated-only); ein valides KO liefert seine Source-ID und
//    die Antwort ist die WOERTLICHE validierte Aussage (deterministisches Retrieval, keine Synthese).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type AppServices, buildApp, buildServices } from "../../services/app/src/build-app";

const embedSpy = vi.hoisted(() => ({ calls: 0 }));
vi.mock("../../services/embedding", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../services/embedding")>();
  return {
    ...original,
    createEmbeddingProviderFromEnv: (env: Record<string, string | undefined>) => {
      const provider = original.createEmbeddingProviderFromEnv(env);
      if (!provider) {
        return provider;
      }
      return {
        ...provider,
        embed: async (texts: readonly string[]) => {
          embedSpy.calls += 1;
          return provider.embed(texts);
        },
      };
    },
  };
});

const VALIDATED_STATEMENT = "Ventil vor der Wartung entlasten und den Druck pruefen.";

type ReasonerAnswer = AppServices["reasoner"]["answer"];

async function retrievalApp() {
  const services = buildServices();
  // Modell-Spy an der Synthese-Flaeche der GETEILTEN Reasoner-Instanz: AskService haelt genau
  // dieses Objekt — ein eigener Own-Property-Shadow zaehlt jeden Synthese-Aufruf und liefert eine
  // erkennbare Kunst-Antwort (beweist im Konsolen-Gegenlauf, dass der Spy wirklich greift).
  let modelCalls = 0;
  const spyAnswer: ReasonerAnswer = async (_question, context) => {
    modelCalls += 1;
    return {
      answered: true,
      answer: "SYNTHESE-ANTWORT (Modellpfad)",
      knowledgeClass: "gesichert",
      trust: 50,
      sources: context.map((c) => c.id),
      steps: [],
      demo: false,
    };
  };
  Object.assign(services.reasoner, { answer: spyAnswer });
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "p@x.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "p@x.de", password: "secret123" },
  });
  const headers = { authorization: `Bearer ${(login.json() as { token: string }).token}` };
  // Bestand: EIN validiertes KO + EIN offenes KO (mit eigenen, unterscheidbaren Termen).
  const validatedRes = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers,
    payload: {
      title: "Ventil entlasten vor Wartung",
      statement: VALIDATED_STATEMENT,
      type: "best_practice",
      category: "Wartung",
    },
  });
  const validatedId = (validatedRes.json() as { id: string }).id;
  await app.inject({
    method: "PUT",
    url: `/api/kos/${validatedId}`,
    headers,
    payload: { action: "admin-validate" },
  });
  const openRes = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers,
    payload: {
      title: "Kompressor Filterwechsel",
      statement: "Kompressor Filter woechentlich wechseln und dokumentieren.",
      type: "best_practice",
      category: "Wartung",
    },
  });
  const openId = (openRes.json() as { id: string }).id;
  // Hintergrund-Pruefjobs (SUBMIT-ASYNC) zu Ende laufen lassen, DANN die Spys nullen — die
  // Messung gilt AUSSCHLIESSLICH den Ask-Aufrufen.
  await services.aiCheckWorker?.idle();
  embedSpy.calls = 0;
  return { app, services, headers, validatedId, openId, modelCalls: () => modelCalls };
}

describe("WP-KLARA-ASK-FIX Fix 1+5: /api/ask mode=retrieval-only — server-garantiert, App-Level", () => {
  const savedPrefilter = process.env.KLARWERK_DUP_PREFILTER;

  beforeEach(() => {
    process.env.KLARWERK_DUP_PREFILTER = "1"; // der Embedder-Chokepoint existiert real im Graph
    embedSpy.calls = 0;
  });

  afterEach(() => {
    if (savedPrefilter === undefined) {
      delete process.env.KLARWERK_DUP_PREFILTER;
    } else {
      process.env.KLARWERK_DUP_PREFILTER = savedPrefilter;
    }
  });

  it("valides KO liefert Source-ID + WOERTLICHE Aussage; Modell- UND Embedder-Spy exakt 0", async () => {
    const { app, headers, validatedId, openId, modelCalls } = await retrievalApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers,
      payload: { question: "Ventil Wartung Druck entlasten", mode: "retrieval-only" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      result: { answered: boolean; answer: string | null; sources: string[] };
      gap: unknown;
    };
    expect(body.result.answered).toBe(true);
    expect(body.result.sources).toContain(validatedId);
    expect(body.result.sources).not.toContain(openId);
    // KEINE Synthese: die Antwort ist die WOERTLICHE validierte Aussage.
    expect(body.result.answer).toBe(VALIDATED_STATEMENT);
    expect(modelCalls()).toBe(0);
    expect(embedSpy.calls).toBe(0);
  });

  it("ein OFFENES KO ist NIE Grundlage: nur-offen-Treffer → ehrliche Wissensluecke, Spys bleiben 0", async () => {
    const { app, headers, modelCalls } = await retrievalApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers,
      payload: { question: "Kompressor Filter wechseln", mode: "retrieval-only" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      result: { answered: boolean; sources: string[] };
      gap: { id: string } | null;
    };
    expect(body.result.answered).toBe(false);
    expect(body.result.sources).toEqual([]);
    // Die Wissensluecke wird weiter vermerkt — darauf baut der Offene-Frage-Weg des Panels.
    expect(body.gap).not.toBeNull();
    expect(modelCalls()).toBe(0);
    expect(embedSpy.calls).toBe(0);
  });

  it("GEGENPROBE Konsole (ohne mode): der Synthese-Spy greift wirklich (1 Aufruf, Bestandsverhalten unveraendert)", async () => {
    const { app, headers, modelCalls } = await retrievalApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers,
      payload: { question: "Ventil Wartung Druck entlasten" },
    });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { result: { answer: string | null } }).result.answer).toBe(
      "SYNTHESE-ANTWORT (Modellpfad)",
    );
    expect(modelCalls()).toBe(1); // der Spy sitzt an der echten Flaeche — retrieval-only laesst ihn bei 0
  });

  it("Schema-Ehrlichkeit: ein unbekannter mode-Wert → 400 (kein stilles Umdeuten)", async () => {
    const { app, headers } = await retrievalApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers,
      payload: { question: "egal", mode: "cloud-bitte" },
    });
    expect(res.statusCode).toBe(400);
  });
});
