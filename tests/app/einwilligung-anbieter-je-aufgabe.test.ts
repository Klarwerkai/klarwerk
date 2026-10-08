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
import { ModelProvider, Reasoner } from "../../services/reasoner";
import {
  erteileKiFreigabe,
  mitKiFreigabe,
} from "../../services/reasoner/src/testhelfer-ki-freigabe";

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

// ================================================================================================
// RUNDE 2 — ECHTER REASONER, ECHTE ANBIETERWAHL, WECHSEL WÄHREND DER LAUFENDEN ANFRAGE.
// ================================================================================================
//
// Bens Gegenbeleg zu Runde 1: die zweite `findConsent`-Lesung des Tors angehalten, währenddessen
// `assist` regulär auf OpenAI umgestellt — danach HTTP 200 und genau ein Aufruf des OpenAI-Adapters.
// Hier dasselbe mit dem ECHTEN Reasoner (zwei `ModelProvider`, nur der Transport `complete` ist
// ein Spion) hinter der echten App: gemessen wird, wer TATSÄCHLICH gerufen wird.
//
// Und Bens B4: die Sperre wegen abweichenden Anbieters nennt ihre wirkliche Ursache, nicht die
// Einstufung.

async function echterAufbau(assist: "openai" | "anthropic") {
  const services = buildServices();
  const openai = vi.fn(async () => '{"text":"von OpenAI"}');
  const anthropic = vi.fn(async () => '{"text":"von Anthropic"}');
  const reasoner = new Reasoner(undefined, undefined, undefined, undefined, undefined, undefined, {
    anbieter: {
      openai: new ModelProvider({ name: "cloud:openai:gpt", complete: openai }),
      anthropic: new ModelProvider({ name: "anthropic:claude", complete: anthropic }),
    },
  });
  await reasoner.setTaskConfig(
    mitKiFreigabe({ global: "anthropic", perTask: { answer: "anthropic", assist } }),
  );
  // Der Halt an der ZWEITEN `findConsent`-Lesung einer Anfrage — die des Ausführungstors, NACHDEM
  // es Policy und Anbieterkarte gelesen hat (die erste liest `laden`).
  const repo = services.klaraSessions as unknown as {
    findConsent: (id: string) => Promise<unknown>;
  };
  const echtFind = repo.findConsent.bind(repo);
  const halt = { aktiv: false, zaehler: 0, erreicht: () => {}, weiter: Promise.resolve() };
  repo.findConsent = async (id: string) => {
    const wert = await echtFind(id);
    if (halt.aktiv && ++halt.zaehler === 2) {
      halt.erreicht();
      await halt.weiter;
    }
    return wert;
  };
  const app = buildApp({ ...services, reasoner });
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
  const assistAnfrage = (confidentiality = "intern") =>
    app.inject({
      method: "POST",
      url: "/api/reasoner",
      headers: gebunden,
      payload: {
        task: "assist",
        text: "Ein Satz aus dem Dokument.",
        source: "draft",
        confidentiality,
        draftId: entwurf.id,
      },
    });
  return { app, reasoner, openai, anthropic, zustimmung, halt, assistAnfrage, gebunden };
}

describe("Bens B3 (Runde 2) · Anbieterwechsel WÄHREND die Anfrage am Tor steht", () => {
  it("KALIBRIERUNG: ohne Wechsel erreicht `assist` den zugestimmten Anbieter (Anthropic)", async () => {
    const k = await echterAufbau("anthropic");
    expect(k.zustimmung.statusCode).toBe(200);
    const res = await k.assistAnfrage();
    expect(res.statusCode).toBe(200);
    expect(k.anthropic).toHaveBeenCalledTimes(1);
    expect(k.openai).not.toHaveBeenCalled();
    await k.app.close();
  });

  it("Wechsel von `assist` auf OpenAI im Fenster zwischen Tor und Lauf: OpenAI bekommt nichts", async () => {
    const k = await echterAufbau("anthropic");
    expect(k.zustimmung.statusCode).toBe(200);
    let weiter: () => void = () => undefined;
    const erreicht = new Promise<void>((r) => {
      k.halt.erreicht = r;
    });
    k.halt.weiter = new Promise<void>((r) => {
      weiter = r;
    });
    k.halt.aktiv = true;
    const laufend = k.assistAnfrage();
    await erreicht;
    // Der reguläre Admin-Weg — mitten in die stehende Anfrage.
    await k.reasoner.setTaskConfig(
      mitKiFreigabe({ global: "anthropic", perTask: { answer: "anthropic", assist: "openai" } }),
    );
    weiter();
    await laufend;
    expect(k.halt.zaehler, "der Halt lag wirklich im Tor").toBeGreaterThanOrEqual(2);
    expect(k.openai, "der Text erreicht den neuen Anbieter nicht").not.toHaveBeenCalled();
    expect(k.anthropic).not.toHaveBeenCalled();
    await k.app.close();
  });
});

describe("Bens B4 · die Sperre wegen abweichenden Anbieters nennt ihre Ursache", () => {
  it("intern eingestufter Text, Zustimmung für Anthropic, `assist` auf OpenAI: 409 `provider_mismatch`", async () => {
    const k = await echterAufbau("openai");
    expect(k.zustimmung.statusCode).toBe(200);
    const res = await k.assistAnfrage();
    expect(res.statusCode).toBe(409);
    const body = res.json() as { error: string; reason: string; message: string };
    expect(body.error).toBe("CONFIDENTIAL_CLOUD_BLOCKED");
    expect(body.reason).toBe("provider_mismatch");
    expect(body.message).toContain("Zustimmung für dieses Dokument gilt einem anderen");
    // Kein Rat zum Umstufen: an der Einstufung liegt es nicht.
    expect(body.message).not.toContain("Einstufung ändern");
    expect(k.openai).not.toHaveBeenCalled();
    await k.app.close();
  });

  it("GEGENPROBE: ist der Text selbst vertraulich eingestuft, bleibt es bei `declared`", async () => {
    const k = await echterAufbau("openai");
    expect(k.zustimmung.statusCode).toBe(200);
    const res = await k.assistAnfrage("vertraulich");
    expect(res.statusCode).toBe(409);
    expect((res.json() as { reason: string }).reason).toBe("declared");
    expect(k.openai).not.toHaveBeenCalled();
    await k.app.close();
  });
});

// ================================================================================================
// LAUF 2 · BENS B5 — WIDERRUF, WÄHREND DIE ANFRAGE AM TOR STEHT.
// ================================================================================================
//
// Bens Gegenbeleg (r3-provider-review.test.ts, Fall B5): zweite `findConsent`-Lesung des Tors
// angehalten, währenddessen `DELETE …/consent` mit HTTP 200 abgeschlossen — danach lief `assist`
// mit genau einem Aufruf des Anthropic-Adapters. Derselbe Aufbau hier, mit echtem Widerrufsweg.

describe("Bens B5 · ein abgeschlossener Widerruf sperrt die schon am Tor stehende Anfrage", () => {
  it("DELETE …/consent im Fenster des Tors: HTTP 200, danach erreicht der Text keinen Anbieter", async () => {
    const k = await echterAufbau("anthropic");
    expect(k.zustimmung.statusCode).toBe(200);
    let weiter: () => void = () => undefined;
    const erreicht = new Promise<void>((r) => {
      k.halt.erreicht = r;
    });
    k.halt.weiter = new Promise<void>((r) => {
      weiter = r;
    });
    k.halt.aktiv = true;
    const laufend = k.assistAnfrage();
    await erreicht;
    const widerruf = await k.app.inject({
      method: "DELETE",
      url: `/api/klara/sessions/${k.gebunden["x-klara-session"]}/consent`,
      headers: k.gebunden,
    });
    expect(widerruf.statusCode).toBe(200);
    expect(k.anthropic).not.toHaveBeenCalled();
    weiter();
    const res = await laufend;
    expect(k.halt.zaehler, "der Halt lag wirklich im Tor").toBeGreaterThanOrEqual(2);
    expect(k.anthropic, "nach dem Widerruf geht nichts mehr hinaus").not.toHaveBeenCalled();
    expect(k.openai).not.toHaveBeenCalled();
    expect(res.statusCode, "keine Antwort, die eine Modellantwort behauptet").not.toBe(200);
    const status = await k.app.inject({
      method: "GET",
      url: `/api/klara/sessions/${k.gebunden["x-klara-session"]}`,
      headers: k.gebunden,
    });
    expect((status.json() as { consentState?: string }).consentState).toBe("revoked");
    await k.app.close();
  });
});

// ================================================================================================
// R-0590 · BEN NACHARBEIT-1 — DER GRUND DES GESPERRTEN AUSWEICHWEGS ERREICHT DIE FLÄCHE.
// ================================================================================================
//
// Echte App, echte Klara-Sitzung und Zustimmung, echtes Tor, echter Reasoner mit Anthropic als
// einzigem externen Anbieter. Ersetzt ist nur Anthropics Antwort (scheitert oder antwortet); der
// deterministische Ersatz ist der echte, mit einem Spion daneben. Gemessen am Draht von
// `POST /api/ask` — dem Weg, den das Word-Panel fährt.
//
// WARUM ANTHROPIC IN DEN VORHANDENEN REASONER GEHÄNGT WIRD und kein neuer übergeben: der Fragedienst
// entsteht schon in `buildServices` mit DIESEM Reasoner. Ein ausgetauschter Reasoner erreichte die
// Route `/api/ask` nicht — der Test mäße dann den Ersatzweg einer anderen Instanz.

async function antwortAufbau(anthropicScheitert: boolean) {
  const services = buildServices();
  const anthropic = new ModelProvider({ name: "anthropic:claude", complete: vi.fn() });
  const anthropicAntwort = vi.fn(async () => {
    if (anthropicScheitert) {
      throw new Error("Anthropic: HTTP 503");
    }
    return {
      answered: true,
      answer: "von Anthropic",
      knowledgeClass: "gesichert",
      trust: 60,
      sources: [],
      citedSources: [],
      steps: [],
      demo: false,
    };
  });
  (anthropic as unknown as { answer: unknown }).answer = anthropicAntwort;
  const intern = services.reasoner as unknown as {
    cloud: Record<string, unknown>;
    fallback: { answer: () => unknown };
  };
  intern.cloud.anthropic = anthropic;
  await services.reasoner.setTaskConfig(
    mitKiFreigabe({ global: "anthropic", perTask: { answer: "anthropic" } }),
  );
  const ersatzAntwort = vi.spyOn(intern.fallback, "answer");
  const app = buildApp(services);
  const auth = await anmelden(app);
  const gebunden = await klaraBindung(app, auth);
  const zustimmung = await app.inject({
    method: "POST",
    url: `/api/klara/sessions/${gebunden["x-klara-session"]}/consent`,
    headers: gebunden,
  });
  // R-0700: MIT Klara-Bindung fragt Klara über ihren eigenen Zugang; OHNE (Konsole) über den
  // allgemeinen Frageweg — dort ohne `questionSource`, das allein der Klara-Zugang kennt.
  const fragen = (headers: Record<string, string>) => {
    const sitzung = headers["x-klara-session"];
    return sitzung
      ? app.inject({
          method: "POST",
          url: `/api/klara/sessions/${sitzung}/execute`,
          headers,
          payload: { question: "Wie wird die Pumpe geschmiert?", questionSource: "manual" },
        })
      : app.inject({
          method: "POST",
          url: "/api/ask",
          headers,
          payload: { question: "Wie wird die Pumpe geschmiert?" },
        });
  };
  return { app, auth, gebunden, zustimmung, fragen, anthropicAntwort, ersatzAntwort };
}

describe("R-0590 · Klara-Antwort unter Zustimmung: kein Ausweichweg, und der Grund kommt an", () => {
  it("GEGENPROBE: Anthropic antwortet — HTTP 200 mit seiner Antwort, der Ersatz läuft nicht", async () => {
    const k = await antwortAufbau(false);
    expect(k.zustimmung.statusCode).toBe(200);
    const res = await k.fragen(k.gebunden);
    expect(res.statusCode).toBe(200);
    expect(k.anthropicAntwort).toHaveBeenCalledTimes(1);
    expect(k.ersatzAntwort).not.toHaveBeenCalled();
    await k.app.close();
  });

  it("Anthropic scheitert: kein Ersatz — 409 `KLARA_AUSWEICHWEG_GESPERRT` mit Grund an der Fläche", async () => {
    const k = await antwortAufbau(true);
    expect(k.zustimmung.statusCode).toBe(200);
    const res = await k.fragen(k.gebunden);
    expect(k.anthropicAntwort).toHaveBeenCalledTimes(1);
    expect(k.ersatzAntwort, "der deterministische Ersatz springt nicht ein").not.toHaveBeenCalled();
    expect(res.statusCode).toBe(409);
    const body = res.json() as { error: string; reason: string; message: string };
    expect(body.error).toBe("KLARA_AUSWEICHWEG_GESPERRT");
    expect(body.reason).toBe("fallback_not_equivalent");
    expect(body.message).toContain("anthropic");
    expect(body.message).not.toContain("Pumpe");
    await k.app.close();
  });

  it("GRENZE: dieselbe Frage OHNE Klara-Bindung (Konsole) behält den bisherigen Ersatzweg", async () => {
    const k = await antwortAufbau(true);
    const res = await k.fragen(k.auth);
    expect(res.statusCode).toBe(200);
    expect(k.ersatzAntwort).toHaveBeenCalledTimes(1);
    await k.app.close();
  });
});
