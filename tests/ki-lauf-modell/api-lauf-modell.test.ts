// ================================================================================================
// JOB 3036 RUNDE 2 — DIE AUSKUNFT AN DER ECHTEN ROUTE, NICHT NUR AM REPO.
// ================================================================================================
//
// BENS KORREKTURPFLICHT 3: „Einen API-Kettentest einchecken. Erwarteter Beleg: echter
// Env-Modelllauf liefert über `GET /api/model-runs` verschiedene Werte für `provider` und `model`;
// ein No-Call-Lauf liefert dort kein `model`."
//
// Das ist die Stelle, an der der Auftrag seine Sichtbarkeit behauptet (`GET /api/model-runs` ist die
// Quelle der KI-Übersicht). Gemessen wird deshalb der ganze Weg: gebauter Server → echte Route
// `POST /api/reasoner` → Provider-Kette → geschriebener Datensatz → Lese-Service → echte Route
// `GET /api/model-runs`. Der Modell-Client kommt aus der Umgebungsfabrik samt Chokepoint; nur das
// Netz ist ersetzt (kein Egress, kein Schlüsselbund).
//
// DIE ZWEI FÄLLE SIND EIN PAAR: derselbe Server, derselbe Client, dieselbe Route. Der eine Aufruf
// befragt das Modell wirklich (assist), der andere kehrt im Provider vor jedem Client-Aufruf zurück
// (interview, bereits abgeschlossen). Nur der erste darf ein Modell nennen.
import { describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { InMemoryModelRunRepo, ModelRunService } from "../../services/model-runs";
import { DeterministicProvider, ModelProvider, Reasoner } from "../../services/reasoner";
import { createCappedCloudClientFromEnv } from "../../services/reasoner/src/model-client";

const CLOUD_ENV = {
  ANTHROPIC_API_KEY: "test-schluessel-nur-hier",
  REASONER_MODEL: "claude-sonnet-4-6",
};

async function umgebung() {
  // Kein Netz: die Antwort des Anbieters ist gestellt, der Schlüsselbund wird nie befragt.
  vi.stubGlobal(
    "fetch",
    (async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({ content: [{ type: "text", text: "Geglätteter Satz." }] }),
      }) as unknown as Response) as unknown as typeof fetch,
  );
  const client = createCappedCloudClientFromEnv(
    CLOUD_ENV,
    () => undefined,
    () => false,
  );

  const services = buildServices();
  // EIN Repo für Schreiber (Reasoner) und Leser (ModelRunService) — die Route liest damit wirklich
  // den Bestand. Muster aus `tests/reasoner/model-run-context.test.ts`.
  const repo = new InMemoryModelRunRepo();
  const mutable = services as unknown as { reasoner: Reasoner; modelRuns: ModelRunService };
  mutable.reasoner = new Reasoner(new ModelProvider(client), new DeterministicProvider(), repo);
  mutable.modelRuns = new ModelRunService({ repo });
  const app = buildApp(services);

  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "admin@x.de", password: "secret123" },
  });
  const anmeldung = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "admin@x.de", password: "secret123" },
  });
  const admin = { authorization: `Bearer ${anmeldung.json().token}` };

  // Der Anker, über den die Route den Text als NICHT vertraulich einstuft (sonst nähme sie die
  // Cloud aus der Kette — dann liefe der Test am Gegenstand vorbei).
  const ko = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: admin,
    payload: {
      title: "Wartung Hauptschalter",
      statement: "Vor der Wartung verriegeln.",
      type: "best_practice",
      category: "Anlage 2",
      neededValidations: 1,
    },
  });
  return { app, admin, koId: ko.json().id as string };
}

async function laeufeAusDerRoute(
  env: Awaited<ReturnType<typeof umgebung>>,
): Promise<Record<string, unknown>[]> {
  const gelesen = await env.app.inject({
    method: "GET",
    url: "/api/model-runs",
    headers: env.admin,
  });
  expect(gelesen.statusCode).toBe(200);
  return gelesen.json() as Record<string, unknown>[];
}

describe("JOB 3036 R2: GET /api/model-runs nennt das echte Modell", () => {
  it("echter Modelllauf (assist): provider und model sind zwei verschiedene Angaben", async () => {
    const env = await umgebung();
    const lauf = await env.app.inject({
      method: "POST",
      url: "/api/reasoner",
      headers: env.admin,
      payload: {
        task: "assist",
        text: "Roher Satz, der geglättet werden soll.",
        source: "draft",
        confidentiality: "intern",
        koId: env.koId,
      },
    });
    expect(lauf.statusCode).toBe(200);

    const laeufe = await laeufeAusDerRoute(env);
    expect(laeufe).toHaveLength(1);
    const datensatz = laeufe[0] as Record<string, unknown>;
    expect(datensatz.task).toBe("assist");
    expect(datensatz.demo).toBe(false);
    expect(datensatz.provider).toBe("anthropic:claude-sonnet-4-6");
    expect(datensatz.model).toBe("claude-sonnet-4-6");
    expect(datensatz.model).not.toBe(datensatz.provider);
    expect(String(datensatz.model)).not.toMatch(/^(anthropic|local):/);
  });

  it("Lauf ohne Modellaufruf (abgeschlossenes interview): dieselbe Route liefert KEIN model", async () => {
    const env = await umgebung();
    const lauf = await env.app.inject({
      method: "POST",
      url: "/api/reasoner",
      headers: env.admin,
      payload: {
        task: "interview",
        answers: ["Die Kernaussage.", "Ab Inbetriebnahme.", "Hauptschalter verriegeln."],
        source: "draft",
        confidentiality: "intern",
        koId: env.koId,
      },
    });
    expect(lauf.statusCode).toBe(200);

    const laeufe = await laeufeAusDerRoute(env);
    expect(laeufe).toHaveLength(1);
    const datensatz = laeufe[0] as Record<string, unknown>;
    expect(datensatz.task).toBe("interview");
    // Der Modell-Provider hat den Lauf beendet — befragt hat er das Modell nicht.
    expect(datensatz.provider).toBe("anthropic:claude-sonnet-4-6");
    expect(Object.hasOwn(datensatz, "model")).toBe(false);
  });
});
