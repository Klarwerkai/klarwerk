// ================================================================================================
// JOB 3276 (KI-ASSIST-LEER) — DIE NUTZENKETTE, GEMESSEN AN DER ECHTEN ROUTE.
// ================================================================================================
//
// Die Kette, um die es geht: Klick → /api/reasoner (task „assist") → Modell → Vorschlag ODER
// ehrliche Meldung. Dieser Test fährt sie über die ECHTE Kompositionswurzel (`buildApp`), weil
// genau dazwischen die Frage entschieden wird, die Pedi gestellt hat: kommt am Ende ein Vorschlag
// an oder eine Auskunft?
//
// Was die Fläche daraus macht, ist geprüft und nicht behauptet: `apps/web/src/api/client.ts` baut
// aus `message` des Fehlerkörpers den `ApiError`, und `AiAssistBox` zeigt genau diesen Satz rot
// über der Palette an (`boxErr`). Deshalb prüft dieser Test das Feld `message` — es ist der Text,
// den der Mensch liest.
import { afterEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { ModelProvider, Reasoner, cappedModelClient } from "../../services/reasoner";

const ROHTEXT = "die pumpe wurde am montag notirt und die anzahl stimmt nicht";
const apps: ReturnType<typeof buildApp>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function aufbauen(modellAntwort: string) {
  const services = buildServices();
  services.reasoner = new Reasoner(
    new ModelProvider(
      cappedModelClient(
        {
          name: "cloud:openai:gpt-6-astra",
          model: "gpt-6-astra",
          complete: async () => modellAntwort,
        },
        { rejectsConfidential: false },
      ),
    ),
  );
  const app = buildApp(services);
  apps.push(app);
  const email = `assist-leer-${Math.random().toString(36).slice(2)}@example.test`;
  const registrierung = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Assist", email, password: "test-password-3276" },
  });
  expect(registrierung.statusCode, registrierung.body).toBe(201);
  const anmeldung = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "test-password-3276" },
  });
  expect(anmeldung.statusCode).toBe(200);
  const headers = { authorization: `Bearer ${anmeldung.json().token as string}` };
  return { app, headers };
}

async function assist(
  aufbau: Awaited<ReturnType<typeof aufbauen>>,
  locale: "de" | "en" = "de",
): Promise<{ status: number; koerper: Record<string, unknown> }> {
  const antwort = await aufbau.app.inject({
    method: "POST",
    url: "/api/reasoner",
    headers: { ...aufbau.headers, "content-type": "application/json" },
    // Herkunft wie die Fläche sie schickt: ein eingestufter, NICHT vertraulicher Dokumenttext —
    // sonst nähme die Route (fail-closed, JOB 2692) die Cloud aus der Kette, und der Test prüfte
    // eine Lage, die mit dem Befund nichts zu tun hat.
    payload: {
      task: "assist",
      text: ROHTEXT,
      locale,
      instruction: "Korrigiere die Rechtschreibung",
      source: "transient-document",
      confidentiality: "intern",
    },
  });
  return { status: antwort.statusCode, koerper: antwort.json() as Record<string, unknown> };
}

describe("JOB 3276 H · über die echte Route kommt ein Vorschlag oder eine Meldung an", () => {
  it("H1 leere Modellantwort: KEIN 200 mit dem Originaltext", async () => {
    const aufbau = await aufbauen("");

    const { status, koerper } = await assist(aufbau);

    // GEMESSEN: 500 (Fastifys Standardweg, `modelBusyErrorHandler` reicht alles außer der
    // Kapazitätsgrenze formtreu durch) — und er reicht `message` mit, was H2 prüft. Festgenagelt
    // ist hier nur die Zusage, die zählt: KEIN 200 mit dem Originaltext.
    expect(status).not.toBe(200);
    expect(status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(koerper)).not.toContain("notirt und die anzahl");
  });

  it("H2 der Fehlerkörper trägt die Meldung, die die Fläche anzeigt (message, mit Grund)", async () => {
    const aufbau = await aufbauen("");

    const { koerper } = await assist(aufbau);

    expect(String(koerper.message)).toContain("Die KI hat keine Antwort geliefert");
    expect(String(koerper.message)).toContain("gpt-6-astra");
  });

  it("H3 englisch angefragt, englisch geantwortet (Vorführung am 11.09.)", async () => {
    const aufbau = await aufbauen("");

    const { koerper } = await assist(aufbau, "en");

    expect(String(koerper.message)).toContain("The AI returned no answer");
  });

  it("H4 GEGENPROBE: antwortet das Modell wirklich, kommt der Vorschlag mit 200 an", async () => {
    const vorschlag = "Die Pumpe wurde am Montag notiert; die Anzahl stimmt nicht.";
    const aufbau = await aufbauen(vorschlag);

    const { status, koerper } = await assist(aufbau);

    expect(status).toBe(200);
    expect(koerper.text).toBe(vorschlag);
    expect(koerper.demo).toBe(false);
  });
});
