// ================================================================================================
// W1 S4 R2 — DER HEUTIGE KLARA-WEG BLEIBT RETRIEVAL-ONLY (BEN ROT-8)
// ================================================================================================
//
// WAS BEN BEANSTANDET HAT. Die R1-Fassung erzeugte einen Spy auf `reasoner.answer`, WERTETE IHN
// ABER NIE AUS, und ein Embedder-Spy fehlte ganz. Der Testname behauptete „0 Aufrufe"; belegt war
// nur der Drahtvertrag. Ein Test, der eine Zahl behauptet, ohne sie zu messen, ist schlimmer als
// keiner — er beruhigt.
//
// DIE KORREKTUR HAT ZWEI TEILE, und der zweite ist der wichtigere:
//
//  1 ECHTE ZÄHLER. Der Modell-Spy sitzt auf `reasoner.answer` DER GETEILTEN Instanz — der einzigen
//    Synthesefläche des Ask-Pfads, die `AskService` wirklich hält. Der Embedder-Spy wrappt das
//    embedding-Modul, sodass jeder `embed()`-Aufruf im ganzen App-Graph zählt; der Prefilter wird
//    dafür ausdrücklich eingeschaltet, damit der Engpass real existiert.
//
//  2 EIN POSITIVER GEGENLAUF. Ohne ihn wäre „0 Aufrufe" auch dann grün, wenn der Spy an der
//    falschen Stelle sitzt oder das Modell gar nicht verdrahtet ist. Der Kontrolllauf zeigt am
//    SELBEN Spy einen Wert > 0. Erst dadurch bedeutet die 0 etwas.
//
// Das Muster ist nicht neu erfunden: `tests/app/word-ask-retrieval-only.test.ts` fährt es seit
// SCRUM-490 R2 für den Word-Pfad. Diese Datei überträgt es auf die S4-Strecke.
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
        embed: async (texte: readonly string[]) => {
          embedSpy.calls += 1;
          return provider.embed(texte);
        },
      };
    },
  };
});

const INSTANZ = "instanz-1";
const DESCRIPTOR = { kind: "saved" as const, hostDocumentId: "word-doc-1" };

let vorher: Record<string, string | undefined>;

beforeEach(() => {
  vorher = { ...process.env };
  // Der Embedder-Engpass muss real existieren, sonst zählt der Spy an einer toten Fläche.
  process.env.KLARWERK_DUP_PREFILTER = "1";
  embedSpy.calls = 0;
});

afterEach(() => {
  process.env = { ...vorher } as NodeJS.ProcessEnv;
});

async function aufbau(): Promise<{
  app: ReturnType<typeof buildApp>;
  services: AppServices;
  auth: Record<string, string>;
}> {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Anna", email: "a@x.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "a@x.de", password: "secret123" },
  });
  return { app, services, auth: { authorization: `Bearer ${login.json().token as string}` } };
}

async function wissenAnlegen(
  app: ReturnType<typeof buildApp>,
  auth: Record<string, string>,
): Promise<void> {
  await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: auth,
    payload: {
      title: "Überdruckventil prüfen",
      statement: "Bei Überdruck Ventil X schließen.",
      type: "best_practice",
      category: "Wartung",
    },
  });
}

async function registriert(app: ReturnType<typeof buildApp>, auth: Record<string, string>) {
  const res = await app.inject({
    method: "POST",
    url: "/api/klara/sessions",
    headers: auth,
    payload: { addinInstanceId: INSTANZ, documentDescriptor: DESCRIPTOR },
  });
  const body = res.json();
  return {
    sessionId: body.sessionId as string,
    headers: {
      ...auth,
      "x-klara-session": body.sessionId as string,
      "x-klara-instance": INSTANZ,
      "x-klara-document": body.documentContextId as string,
    },
  };
}

describe("W1 S4 R2 · ROT-8 · echte Zähler statt behaupteter Nullen", () => {
  it("POSITIVER KONTROLLLAUF: ohne `retrieval-only` schlägt der Modell-Spy an", async () => {
    // DIESER FALL IST DER GRUND, WARUM DIE NULL UNTEN ETWAS BEDEUTET. Er belegt, dass der Spy an
    // einer echten Fläche sitzt: derselbe Zähler, derselbe Aufbau, nur ohne die Einschränkung.
    const { app, services, auth } = await aufbau();
    const modellSpy = vi.spyOn(services.reasoner, "answer");
    await wissenAnlegen(app, auth);

    await app.inject({
      method: "POST",
      url: "/api/ask",
      headers: auth,
      payload: { question: "Was tun bei Überdruck?" },
    });

    expect(modellSpy.mock.calls.length).toBeGreaterThan(0);
    modellSpy.mockRestore();
    await app.close();
  });

  it("RETRIEVAL-ONLY: 0 Modellaufrufe und 0 Embedderaufrufe — gemessen, nicht behauptet", async () => {
    const { app, services, auth } = await aufbau();
    const modellSpy = vi.spyOn(services.reasoner, "answer");
    await wissenAnlegen(app, auth);
    embedSpy.calls = 0;

    const { headers } = await registriert(app, auth);
    const frage = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers,
      payload: { question: "Was tun bei Überdruck?", mode: "retrieval-only" },
    });
    expect(frage.statusCode).toBe(200);

    // Die beiden Zahlen, die der Testname behauptet — jetzt wirklich geprüft.
    expect(modellSpy.mock.calls.length).toBe(0);
    expect(embedSpy.calls).toBe(0);

    modellSpy.mockRestore();
    await app.close();
  });

  it("auch das Anlegen und Lesen einer Klara-Sitzung ruft weder Modell noch Embedder", async () => {
    // Die S4-Strecke selbst ist die neue Fläche: Status, Sitzung und Consent dürfen keinen
    // Modellweg berühren.
    const { app, services, auth } = await aufbau();
    const modellSpy = vi.spyOn(services.reasoner, "answer");
    embedSpy.calls = 0;

    const { sessionId, headers } = await registriert(app, auth);
    await app.inject({ method: "GET", url: "/api/klara/ai-status", headers });
    await app.inject({ method: "GET", url: `/api/klara/sessions/${sessionId}`, headers });
    await app.inject({
      method: "DELETE",
      url: `/api/klara/sessions/${sessionId}/consent`,
      headers,
    });
    await app.inject({ method: "POST", url: `/api/klara/sessions/${sessionId}/close`, headers });

    expect(modellSpy.mock.calls.length).toBe(0);
    expect(embedSpy.calls).toBe(0);
    modellSpy.mockRestore();
    await app.close();
  });
});

describe("W1 S4 R2 · die Statusauflösung erlaubt keine externe Ausführung", () => {
  it("entweder deterministisch oder external UND blockiert — ein dritter Ausgang existiert nicht", async () => {
    const { app, auth } = await aufbau();
    const { headers } = await registriert(app, auth);
    const body = (await app.inject({ method: "GET", url: "/api/klara/ai-status", headers })).json();
    if (body.effectiveMode === "external") {
      expect(body.executionAllowed).toBe(false);
      expect(body.blockedReason).toBeTruthy();
    } else {
      expect(body.effectiveMode).not.toBe("external");
    }
    await app.close();
  });

  it("der bestehende Ask-Antwortvertrag ist unverändert (No-Go 6)", async () => {
    const { app, auth } = await aufbau();
    await wissenAnlegen(app, auth);
    const frage = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers: auth,
      payload: { question: "Was tun bei Überdruck?" },
    });
    expect(frage.statusCode).toBe(200);
    const body = frage.json();
    expect(body).toHaveProperty("result");
    expect(body).toHaveProperty("receipt");
    expect(body.result).toHaveProperty("sources");
    expect(body.result).toHaveProperty("evidence");
    // S4-Felder wandern NICHT in den Ask-Vertrag ein.
    for (const fremd of ["resolutionId", "consentState", "externalConsentRequired"]) {
      expect(body, `S4-Feld ${fremd} darf nicht im Ask-Vertrag stehen`).not.toHaveProperty(fremd);
    }
    await app.close();
  });
});
