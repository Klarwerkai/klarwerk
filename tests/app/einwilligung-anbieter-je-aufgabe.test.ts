// ================================================================================================
// AUFTRAG gesamt-ki-einwilligung · BENS B3 — DIE ZUSTIMMUNG GILT DEM ANBIETER, DER SIE BEKAM.
// ================================================================================================
//
// Bens Gegenbeleg (Runde 1): Zustimmung für Anthropic (Aufgabe `answer`), `assist` auf OpenAI
// eingestellt — `POST /api/reasoner` mit `task:"assist"` lief mit HTTP 200 und genau einem Aufruf des
// OpenAI-Adapters. Die Zustimmung wird an `answer` gebildet und protokolliert; der Reasoner wählt
// den Anbieter aber je Aufgabe.
//
// GEMESSEN WIRD AN DER ROUTE, mit echter App, echter Klara-Sitzung, echter Zustimmung und echtem
// Tor. Ersetzt sind nur zwei Dinge: die Statusauskunft des Reasoners (welcher Anbieter je Aufgabe
// wirksam ist — dieselbe Technik wie `job2666-…test.ts`, `cloudVerdrahten`) und `assistText` als
// Spion am `confidential`-Bit. Dieses Bit ist die Stelle, an der der Reasoner die Cloud aus der
// Kette nimmt (`chainForChoice`): `true` heisst, der Text erreicht keinen externen Anbieter.
//
// Die Kalibrierung (A) zeigt, dass derselbe Aufbau mit GLEICHEM Anbieter die Cloud erreicht — der
// Fall misst also den Anbieterunterschied und nicht eine pauschale Sperre.
import { describe, expect, it, vi } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import { buildApp, buildServices } from "../../services/app/src/build-app";
import { erteileKiFreigabe } from "../../services/reasoner/src/testhelfer-ki-freigabe";

type Dienste = ReturnType<typeof buildServices>;
type App = ReturnType<typeof buildApp>;

const INSTANZ = "instanz-b3";

/** Status mit verdrahteten Cloud-Anbietern: `answer` an Anthropic, die übrigen nach Vorgabe. */
function anbieterVerdrahten(services: Dienste, jeAufgabe: () => Record<string, string>): void {
  const r = services.reasoner as unknown as { configStatus: () => Record<string, unknown> };
  const echt = r.configStatus.bind(services.reasoner);
  r.configStatus = () => {
    const status = echt();
    const taskConfig = status.taskConfig as { global: string; perTask: Record<string, string> };
    const karte = jeAufgabe();
    return {
      ...status,
      provider: "Anthropic",
      model: "claude",
      cloudConfigured: true,
      taskConfig: { ...taskConfig, perTask: { ...taskConfig.perTask, answer: "cloud" } },
      effectiveProvider: {
        ...(status.effectiveProvider as Record<string, string>),
        answer: "cloud",
      },
      effectiveAnbieter: { ...(status.effectiveAnbieter as Record<string, string>), ...karte },
      effectiveAnbieterGlobal: karte.global ?? "anthropic",
      cloudProviders: {
        openai: { configured: true, name: "OpenAI", model: "gpt" },
        anthropic: { configured: true, name: "Anthropic", model: "claude" },
      },
    };
  };
}

async function anmelden(app: App): Promise<Record<string, string>> {
  const email = "pedi@b3.test";
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email, password: "geheim12345" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "geheim12345" },
  });
  return { authorization: `Bearer ${(login.json() as { token: string }).token}` };
}

async function klaraBindung(app: App, auth: Record<string, string>) {
  const mitInstanz = { ...auth, "x-klara-instance": INSTANZ };
  const res = await app.inject({
    method: "POST",
    url: "/api/klara/sessions",
    headers: mitInstanz,
    payload: {
      addinInstanceId: INSTANZ,
      documentDescriptor: { kind: "saved", hostDocumentId: "word-doc-b3" },
    },
  });
  const body = res.json() as { sessionId: string; documentContextId: string };
  return {
    ...mitInstanz,
    "x-klara-session": body.sessionId,
    "x-klara-document": body.documentContextId,
  };
}

async function aufbau(jeAufgabe: () => Record<string, string>) {
  const services = buildServices();
  const assistText = vi.fn(async () => ({ text: "geglättet", demo: false }));
  (services.reasoner as unknown as Record<string, unknown>).assistText = assistText;
  const app = buildApp(services);
  await erteileKiFreigabe(services.reasoner);
  anbieterVerdrahten(services, jeAufgabe);
  const auth = await anmelden(app);
  const gebunden = await klaraBindung(app, auth);
  const zustimmung = await app.inject({
    method: "POST",
    url: `/api/klara/sessions/${gebunden["x-klara-session"]}/consent`,
    headers: gebunden,
  });
  const entwurf = await services.capture.createDraft(
    { title: "Entwurf B3", statement: "Ein Satz.", confidentiality: "intern" },
    "autor-b3",
  );
  const assist = async () =>
    app.inject({
      method: "POST",
      url: "/api/reasoner",
      headers: gebunden,
      payload: {
        task: "assist",
        text: "Ein Satz aus dem Dokument.",
        source: "draft",
        confidentiality: "intern",
        draftId: entwurf.id,
      },
    });
  const status = async () =>
    (
      await app.inject({
        method: "GET",
        url: `/api/klara/sessions/${gebunden["x-klara-session"]}`,
        headers: gebunden,
      })
    ).json() as { consentState?: string };
  /** Das `confidential`-Argument (Index 3) des letzten `assistText`-Aufrufs. */
  const bit = () => (assistText.mock.calls.at(-1) as unknown[] | undefined)?.[3];
  return { app, zustimmung, assist, status, bit };
}

describe("Bens B3 · eine Zustimmung für Anthropic öffnet keine Aufgabe, die an OpenAI geht", () => {
  it("A · KALIBRIERUNG: `assist` am selben Anbieter wie die Zustimmung erreicht die Cloud", async () => {
    const k = await aufbau(() => ({ answer: "anthropic", assist: "anthropic" }));
    expect(k.zustimmung.statusCode).toBe(200);
    expect((await k.assist()).statusCode).toBe(200);
    expect(k.bit()).toBe(false);
    await k.app.close();
  });

  it("B · `assist` an OpenAI bei Zustimmung für Anthropic: der Text bleibt draussen", async () => {
    const k = await aufbau(() => ({ answer: "anthropic", assist: "openai" }));
    expect(k.zustimmung.statusCode).toBe(200);
    await k.assist();
    expect(k.bit(), "vertraulich ⇒ kein externer Anbieter in der Kette").toBe(true);
    await k.app.close();
  });

  it("C · Wechsel von `assist` auf OpenAI NACH der Zustimmung entwertet sie und sperrt", async () => {
    let assistAnbieter = "anthropic";
    const k = await aufbau(() => ({ answer: "anthropic", assist: assistAnbieter }));
    expect(k.zustimmung.statusCode).toBe(200);
    expect((await k.status()).consentState).toBe("granted");
    assistAnbieter = "openai";
    await k.assist();
    expect(k.bit()).toBe(true);
    // Nicht stillschweigend weiter gültig: die Zustimmung ist entwertet, auch für `answer`.
    expect((await k.status()).consentState).toBe("invalidated");
    await k.app.close();
  });
});
