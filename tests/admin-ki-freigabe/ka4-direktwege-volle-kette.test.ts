// ================================================================================================
// NACHARBEIT K6 (priority:V2) — DIE DOKUMENTFREIGABE AUF DEN DIREKTEN WEGEN, DURCH DIE ECHTE KETTE.
// ================================================================================================
//
// BENS BEFUND (Nacharbeit 1, K6): `tests/app/job2666-stufe-die-nur-der-client-behauptet.test.ts`
// belegt die positive Freigabe nur für `structure`, und zwar mit Spionen an `reasoner.structure`
// und `reasoner.describeImage`. Für `/api/reasoner/describe` gibt es dort nur den negativen
// gebundenen Fall. Die Spione belegen außerdem keine Anbieterantwort.
//
// WAS HIER ANDERS IST. Derselbe Aufbau wie in job2666 (`buildApp(buildServices())`, echte
// Anmeldung, echte Klara-Sitzung über `POST /api/klara/sessions`, Zustimmung über
// `POST …/consent`, gespeicherte Entwürfe über den Capture-Dienst) — aber OHNE Ersatz am Reasoner.
// Der Anbieter entsteht wie im Betrieb: `createCappedCloudClientFromEnv` baut aus der Umgebung den
// Anthropic-Client, umschließt ihn mit `cappedModelClient(…, { rejectsConfidential: true })`, und
// `buildServices` hängt ihn als `ModelProvider` in den Reasoner. Mitgeschrieben wird HINTER dem
// Client, am Transport (`fetch`, im Aufbau gebunden): was dort ankommt, hätte das Haus verlassen.
// Kein Netz, kein echter Schlüssel.
//
// ZWEI FREIGABESTUFEN, DIESELBEN FÄLLE:
//   · nur die GRUNDFREIGABE — ein vertraulicher Aufruf verliert die Cloud schon in der Kette des
//     Reasoners; die Ursache heißt dann `confidential`.
//   · BEIDE zentralen Freigaben — NACHGEFÜHRT im Auftrag gesamt-ki-freigaberegeln (Ben Nacharbeit 2,
//     Pedis Entscheidung vom 10.09.: die zweite Freigabe gilt bis zum Anbieter). Bis dahin hielt
//     hier allein der harte Wrapper am Client jeden vertraulichen Aufruf auf (`model-error`) — die
//     Freigabe war im Betrieb wirkungslos. Jetzt gilt getrennt:
//       – FEHLENDE Zustimmung oder FREMDE Dokumentbindung sperren weiter, und zwar schon im Kettenbau
//         (`bindeAnbieter(null)` → `anbieterZugelassen`): null Abrufe, Ursache `confidential`
//         (die Route stuft den ungedeckten Text ein, und die Cloud fiel aus der Kette).
//       – der gespeichert VERTRAULICHE Entwurf mit Zustimmung und richtiger Bindung geht hinaus —
//         durch den echten gekapselten Client, weil der Reasoner den Versuch freigegeben hat
//         (`ModellAufrufSpur.vertraulichFreigegeben`). Mit nur der Grundfreigabe bleibt er gesperrt.
//
// WARUM DIESE DATEI HIER LIEGT. Die zweite Freigabe darf außerhalb von `tests/admin-ki-freigabe/`
// in keiner Testquelle gesetzt werden (Freigabe-Wächter F2 in
// `tests/ki-anbieterwahl/routing-zwei-attrappen.test.ts`, Register `VERTRAULICH_ERLAUBT` leer).
// Dieses Verzeichnis ist die ausdrückliche Ausnahme des Wächters. Bens Korrektur verlangt die
// Sperrfälle ausdrücklich auch mit beiden Freigaben; der Wächter bleibt unverändert.
//
// Das Tor, das hier entscheidet, ist `KlaraSessionService.pruefeExterneAusfuehrung`, angewandt über
// `ka4Freigabe` in `services/app/src/routes/reasoner-routes.ts`.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type LogSenke, buildApp, buildServices } from "../../services/app/src/build-app";
import type { Confidentiality } from "../../services/knowledge-object";
import { erteileKiFreigabe } from "../../services/reasoner/src/testhelfer-ki-freigabe";

type Dienste = ReturnType<typeof buildServices>;
type App = ReturnType<typeof buildApp>;

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const INSTANZ = "instanz-k6";
const STRUKTURTEXT = "Rohtext K6: Pumpe P2 alle 200 Betriebsstunden schmieren.";
const KONTEXT = "Kontext K6: Typenschild der Pumpe P2 im Wartungsplan.";
/** Ein gültiges PNG (1×1 Pixel) — Magic-Bytes, IHDR, IDAT, IEND. */
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const PNG_URL = `data:image/png;base64,${PNG_BASE64}`;

/** Was der Anbieter antwortet — es muss bis in das HTTP-Ergebnis durchkommen. */
const STRUKTUR_TITEL = "VON-ANTHROPIC-STRUKTUR";
const STRUKTUR_ANTWORT = JSON.stringify({
  title: STRUKTUR_TITEL,
  statement: "Strukturiert vom Anbieter.",
  conditions: [],
  measures: [],
  tags: [],
  confidence: 0.8,
});
const BILD_ANTWORT = "VON-ANTHROPIC-BILD: Typenschild einer Pumpe.";

// ------------------------------------------------------------------------------------------------
// Die Umgebung des Aufbaus — gesetzt vor `buildServices`, danach exakt wiederhergestellt.
// ------------------------------------------------------------------------------------------------
const UMGEBUNG: Record<string, string | undefined> = {
  ANTHROPIC_API_KEY: "ant-test-nur-hier",
  ANTHROPIC_MODEL: "claude-sonnet-4-6",
  KLARWERK_SKIP_KEYCHAIN: "1",
  // Kein zweiter Anbieter und kein lokales Modell: der einzige Weg nach draußen ist Anthropic.
  REASONER_MODEL: undefined,
  OPENAI_API_KEY: undefined,
  OPENAI_MODEL: undefined,
  OPENAI_BASE_URL: undefined,
  KLARWERK_LOCAL_LLM_URL: undefined,
  KLARWERK_LOCAL_LLM_MODEL: undefined,
  REASONER_TIMEOUT_MS: undefined,
};
const GESICHERT: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const [name, wert] of Object.entries(UMGEBUNG)) {
    GESICHERT[name] = process.env[name];
    if (wert === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = wert;
    }
  }
});

afterEach(() => {
  for (const name of Object.keys(UMGEBUNG)) {
    const alt = GESICHERT[name];
    if (alt === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = alt;
    }
  }
  vi.unstubAllGlobals();
});

interface Abruf {
  url: string;
  koerper: {
    system?: string;
    messages?: { content: unknown }[];
  };
}

/**
 * Der Transport hinter dem echten Anthropic-Client. Er wird VOR `buildServices` gebunden, weil der
 * Client `fetch` beim Bau festhält. Jede Anfrage wird aufgezeichnet; die Antwort hat die Form der
 * Messages-API.
 */
function transportMitschreiben(): Abruf[] {
  const abrufe: Abruf[] = [];
  vi.stubGlobal("fetch", (async (url: unknown, init: unknown) => {
    const opts = (init ?? {}) as { body?: string };
    const koerper = (opts.body ? JSON.parse(opts.body) : {}) as Abruf["koerper"];
    abrufe.push({ url: String(url), koerper });
    const inhalt = koerper.messages?.[0]?.content;
    const text = Array.isArray(inhalt) ? BILD_ANTWORT : STRUKTUR_ANTWORT;
    return {
      ok: true,
      status: 200,
      json: async () => ({ content: [{ type: "text", text }] }),
    } as unknown as Response;
  }) as unknown as typeof fetch);
  return abrufe;
}

function logsenke(): { senke: LogSenke; zeilen: string[] } {
  const zeilen: string[] = [];
  return { senke: { write: (z) => void zeilen.push(z) }, zeilen };
}

/** Die Entscheidungen des KA4-Tors auf den Reasoner-Wegen. */
function ka4Zeilen(zeilen: string[]): { entscheidung: string; grund?: string }[] {
  return zeilen
    .filter((z) => z.includes("reasoner.ka4.dokument-consent"))
    .map((z) => (JSON.parse(z) as { ka4: { entscheidung: string; grund?: string } }).ka4);
}

async function anmelden(app: App): Promise<Record<string, string>> {
  const email = "pedi@k6-direktwege.test";
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
  if (login.statusCode !== 200) {
    throw new Error(`Anmeldung fehlgeschlagen: ${login.statusCode} ${login.body}`);
  }
  return { authorization: `Bearer ${(login.json() as { token: string }).token}` };
}

async function entwurf(services: Dienste, stufe: Confidentiality): Promise<string> {
  const d = await services.capture.createDraft(
    { title: "Entwurf K6", statement: "Ein Satz, der im Entwurf steht.", confidentiality: stufe },
    "autor-k6",
  );
  return d.id;
}

async function klaraBindung(
  app: App,
  auth: Record<string, string>,
): Promise<Record<string, string>> {
  const mitInstanz = { ...auth, "x-klara-instance": INSTANZ };
  const res = await app.inject({
    method: "POST",
    url: "/api/klara/sessions",
    headers: mitInstanz,
    payload: {
      addinInstanceId: INSTANZ,
      documentDescriptor: { kind: "saved", hostDocumentId: "word-doc-k6" },
    },
  });
  if (res.statusCode !== 201) {
    throw new Error(`Klara-Sitzung nicht angelegt: ${res.statusCode} ${res.body}`);
  }
  const body = res.json() as { sessionId: string; documentContextId: string };
  return {
    ...mitInstanz,
    "x-klara-session": body.sessionId,
    "x-klara-document": body.documentContextId,
  };
}

/** Die Zustimmung über den vorhandenen HTTP-Endpunkt — derselbe, den das Panel ruft. */
async function zustimmen(app: App, gebunden: Record<string, string>): Promise<number> {
  const res = await app.inject({
    method: "POST",
    url: `/api/klara/sessions/${gebunden["x-klara-session"]}/consent`,
    headers: gebunden,
  });
  return res.statusCode;
}

async function structure(
  app: App,
  headers: Record<string, string>,
  draftId: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await app.inject({
    method: "POST",
    url: "/api/reasoner",
    headers,
    payload: {
      task: "structure",
      text: STRUKTURTEXT,
      locale: "de",
      source: "draft",
      confidentiality: "intern",
      draftId,
    },
  });
  return { status: res.statusCode, body: res.json() as Record<string, unknown> };
}

async function describeBild(
  app: App,
  headers: Record<string, string>,
  draftId: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await app.inject({
    method: "POST",
    url: "/api/reasoner/describe",
    headers,
    payload: {
      dataUrl: PNG_URL,
      locale: "de",
      source: "draft",
      confidentiality: "intern",
      draftId,
      context: KONTEXT,
    },
  });
  return { status: res.statusCode, body: res.json() as Record<string, unknown> };
}

type Freigabestufe = "grund" | "beide";

interface Aufbau {
  app: App;
  abrufe: Abruf[];
  zeilen: string[];
  gebunden: Record<string, string>;
  intern: string;
  vertraulich: string;
}

async function aufbauen(stufe: Freigabestufe): Promise<Aufbau> {
  const abrufe = transportMitschreiben();
  const services = buildServices();
  const { senke, zeilen } = logsenke();
  const app = buildApp(services, { log: { senke, stufe: "info" } });
  // KALIBRIERUNG: die Fabrik hat aus der Umgebung WIRKLICH einen Anbieter gebaut — sonst prüften
  // die Sperrfälle unten nur „kein Modell".
  expect(services.reasoner.configStatus().cloudProviders.anthropic.configured).toBe(true);
  const auth = await anmelden(app);
  const intern = await entwurf(services, "intern");
  const vertraulich = await entwurf(services, "vertraulich");
  if (stufe === "grund") {
    await erteileKiFreigabe(services.reasoner);
  } else {
    await erteileKiFreigabe(services.reasoner, { oeffentlicheKi: true, vertraulicheInhalte: true });
  }
  const gebunden = await klaraBindung(app, auth);
  // Nichts aus dem Aufbau selbst hat das Haus verlassen.
  expect(abrufe).toEqual([]);
  return { app, abrufe, zeilen, gebunden, intern, vertraulich };
}

/** Was nach einer Sperre an Ursache erwartet wird — der Unterschied der beiden Stufen. */
const SPERRURSACHE: Record<Freigabestufe, string> = {
  grund: "confidential",
  beide: "confidential",
};

/** Beide direkten Wege mit denselben Kopfzeilen und demselben Entwurf: NULL Abrufe. */
async function beideWegeGesperrt(
  a: Aufbau,
  stufe: Freigabestufe,
  headers: Record<string, string>,
  draftId: string,
): Promise<void> {
  const vorher = a.abrufe.length;
  const s = await structure(a.app, headers, draftId);
  expect(s.status).toBe(200);
  expect(s.body.demo).toBe(true);
  expect(s.body.title).not.toBe(STRUKTUR_TITEL);
  expect(s.body.fallbackReason).toBe(SPERRURSACHE[stufe]);
  const d = await describeBild(a.app, headers, draftId);
  expect(d.status).toBe(200);
  expect(d.body.demo).toBe(true);
  expect(d.body.text).toBeNull();
  expect(d.body.fallbackReason).toBe(SPERRURSACHE[stufe]);
  expect(a.abrufe.slice(vorher)).toEqual([]);
}

for (const stufe of ["grund", "beide"] as const) {
  const name = stufe === "grund" ? "nur die Grundfreigabe" : "beide zentralen Freigaben";

  describe(`K6 · direkte Wege mit Dokumentfreigabe — ${name}`, () => {
    it(`K6 · POSITIV (${stufe}): Zustimmung über HTTP → structure und describe erreichen den Anbieter, seine Antwort steht im Ergebnis`, async () => {
      const a = await aufbauen(stufe);
      expect(await zustimmen(a.app, a.gebunden)).toBe(200);

      const s = await structure(a.app, a.gebunden, a.intern);
      expect(s.status).toBe(200);
      expect(s.body.demo).toBe(false);
      expect(s.body.title).toBe(STRUKTUR_TITEL);
      expect(a.abrufe).toHaveLength(1);
      expect(a.abrufe[0]?.url).toBe(ANTHROPIC_URL);
      // Der Eingang ist genau der Text des Aufrufs — nichts dazu, nichts weg.
      expect(a.abrufe[0]?.koerper.messages?.[0]?.content).toBe(STRUKTURTEXT);

      const d = await describeBild(a.app, a.gebunden, a.intern);
      expect(d.status).toBe(200);
      expect(d.body.demo).toBe(false);
      expect(d.body.text).toBe(BILD_ANTWORT);
      expect(d.body.withContext).toBe(true);
      expect(a.abrufe).toHaveLength(2);
      expect(a.abrufe[1]?.url).toBe(ANTHROPIC_URL);
      const bloecke = a.abrufe[1]?.koerper.messages?.[0]?.content as {
        type: string;
        text?: string;
        source?: { type: string; media_type: string; data: string };
      }[];
      expect(bloecke[0]?.type).toBe("image");
      expect(bloecke[0]?.source).toEqual({
        type: "base64",
        media_type: "image/png",
        data: PNG_BASE64,
      });
      expect(bloecke[1]?.type).toBe("text");
      expect(bloecke[1]?.text).toContain(KONTEXT);

      // Das ECHTE Tor hat beide Male freigegeben.
      const entscheidungen = ka4Zeilen(a.zeilen);
      expect(entscheidungen).toHaveLength(2);
      for (const e of entscheidungen) {
        expect(e.entscheidung).toBe("freigegeben");
      }
      await a.app.close();
    });

    it(`K6 · SPERRE (${stufe}): ohne Zustimmung — null Abrufe auf beiden Wegen`, async () => {
      const a = await aufbauen(stufe);
      await beideWegeGesperrt(a, stufe, a.gebunden, a.intern);
      const entscheidungen = ka4Zeilen(a.zeilen);
      expect(entscheidungen).toHaveLength(2);
      for (const e of entscheidungen) {
        expect(e.entscheidung).toBe("blockiert");
      }
      // GEGENPROBE IM SELBEN AUFBAU: mit Zustimmung geht derselbe Aufruf hinaus.
      expect(await zustimmen(a.app, a.gebunden)).toBe(200);
      expect((await structure(a.app, a.gebunden, a.intern)).body.title).toBe(STRUKTUR_TITEL);
      expect(a.abrufe).toHaveLength(1);
      await a.app.close();
    });

    it(`K6 · SPERRE (${stufe}): fremde Dokumentbindung trotz Zustimmung — null Abrufe auf beiden Wegen`, async () => {
      const a = await aufbauen(stufe);
      expect(await zustimmen(a.app, a.gebunden)).toBe(200);
      const fremd = { ...a.gebunden, "x-klara-document": "ein-anderes-dokument" };
      await beideWegeGesperrt(a, stufe, fremd, a.intern);
      expect(ka4Zeilen(a.zeilen)).toHaveLength(2);
      for (const e of ka4Zeilen(a.zeilen)) {
        expect(e).toEqual({ entscheidung: "blockiert", grund: "bindung_ungueltig" });
      }
      // GEGENPROBE: dieselbe Zustimmung mit der richtigen Bindung lässt den Aufruf hinaus.
      expect((await structure(a.app, a.gebunden, a.intern)).body.title).toBe(STRUKTUR_TITEL);
      expect(a.abrufe).toHaveLength(1);
      await a.app.close();
    });

    // gesamt-ki-freigaberegeln: nur MIT der zweiten Freigabe öffnet sich dieser Fall (s. Kopf).
    it(`K6 · ${stufe === "beide" ? "POSITIV" : "SPERRE"} (${stufe}): gespeichert vertraulicher Entwurf mit Zustimmung und richtiger Bindung`, async () => {
      const a = await aufbauen(stufe);
      expect(await zustimmen(a.app, a.gebunden)).toBe(200);
      if (stufe === "beide") {
        // Durch den ECHTEN gekapselten Client (`rejectsConfidential: true`) bis zum Transport.
        const s = await structure(a.app, a.gebunden, a.vertraulich);
        expect(s.status).toBe(200);
        expect(s.body.demo).toBe(false);
        expect(s.body.title).toBe(STRUKTUR_TITEL);
        expect(a.abrufe).toHaveLength(1);
        expect(a.abrufe[0]?.url).toBe(ANTHROPIC_URL);
        expect(a.abrufe[0]?.koerper.messages?.[0]?.content).toBe(STRUKTURTEXT);
        const d = await describeBild(a.app, a.gebunden, a.vertraulich);
        expect(d.status).toBe(200);
        expect(d.body.demo).toBe(false);
        expect(d.body.text).toBe(BILD_ANTWORT);
        expect(a.abrufe).toHaveLength(2);
        const freigaben = ka4Zeilen(a.zeilen);
        expect(freigaben).toHaveLength(2);
        for (const e of freigaben) {
          expect(e.entscheidung).toBe("freigegeben");
        }
        await a.app.close();
        return;
      }
      await beideWegeGesperrt(a, stufe, a.gebunden, a.vertraulich);
      // Das Tor hat FREIGEGEBEN — gesperrt hat die gespeicherte Stufe, nicht die Einwilligung.
      const entscheidungen = ka4Zeilen(a.zeilen);
      expect(entscheidungen).toHaveLength(2);
      for (const e of entscheidungen) {
        expect(e.entscheidung).toBe("freigegeben");
      }
      // GEGENPROBE: derselbe Aufbau mit dem internen Entwurf geht hinaus.
      expect((await structure(a.app, a.gebunden, a.intern)).body.title).toBe(STRUKTUR_TITEL);
      expect(a.abrufe).toHaveLength(1);
      await a.app.close();
    });
  });
}

// ================================================================================================
// Auftrag gesamt-ki-freigaberegeln · BEN NACHARBEIT 3 — DIE HERKUNFTSSPERRE GILT AUCH MIT BEIDEN
// FREIGABEN.
// ================================================================================================
//
// Die zweite Adminfreigabe hebt nur die KLASSENSPERRE auf. Ein Entwurfstext OHNE auflösbaren Anker
// und ein frei gelieferter Text mit Herkunft „ko" bleiben draussen (`sperreAusleitung` in
// `reasoner-routes.ts`). Ohne Klara-Bindung, damit allein die Herkunft entscheidet. Gegenprobe im
// selben Aufbau: derselbe VERTRAULICHE Text mit aufgelöstem Anker geht hinaus.
describe("Ben Nacharbeit 3 · Herkunftssperre mit beiden zentralen Freigaben", () => {
  async function strukturieren(
    a: Aufbau,
    payload: Record<string, unknown>,
  ): Promise<{ status: number; body: Record<string, unknown> }> {
    const res = await a.app.inject({
      method: "POST",
      url: "/api/reasoner",
      headers: { authorization: a.gebunden.authorization ?? "" },
      payload: { task: "structure", text: STRUKTURTEXT, locale: "de", ...payload },
    });
    return { status: res.statusCode, body: res.json() as Record<string, unknown> };
  }

  it("ohne auflösbaren Anker oder mit Herkunft „ko“: null Abrufe — mit Anker geht derselbe vertrauliche Text hinaus", async () => {
    const a = await aufbauen("beide");
    for (const payload of [
      { source: "draft", confidentiality: "vertraulich" },
      { source: "draft", confidentiality: "vertraulich", draftId: "gibt-es-nicht" },
      { source: "ko", confidentiality: "intern" },
    ]) {
      const s = await strukturieren(a, payload);
      expect([payload, s.status]).toEqual([payload, 200]);
      expect([payload, s.body.demo]).toEqual([payload, true]);
      expect([payload, a.abrufe.length]).toEqual([payload, 0]);
    }
    // GEGENPROBE: aufgelöster Anker eines vertraulichen Entwurfs — die Klassensperre hebt die Freigabe.
    const frei = await strukturieren(a, {
      source: "draft",
      confidentiality: "vertraulich",
      draftId: a.vertraulich,
    });
    expect(frei.status).toBe(200);
    expect(frei.body.title).toBe(STRUKTUR_TITEL);
    expect(a.abrufe).toHaveLength(1);
    await a.app.close();
  });
});
