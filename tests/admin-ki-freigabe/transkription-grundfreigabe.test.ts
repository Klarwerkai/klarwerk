// ================================================================================================
// Auftrag gesamt-ki-freigaberegeln · DIE TRANSKRIPTION FOLGT DER ZENTRALEN ADMINFREIGABE.
// ================================================================================================
//
// DER BEFUND (am Code gelesen, 08.10.2026): `/api/media/analyze` schickte ein nicht vertrauliches
// Video an die Transkriptions-KI von OpenAI (`services/media/src/transcriber.ts`, Whisper), ohne die
// zentrale Freigabe für öffentliche KI je zu fragen. Pedis Entscheidung (10.09. 21:25, wörtlich an
// `ReasonerKiFreigabe` in `services/reasoner/src/types.ts`): „Keine Freigabe, kein Egress … Im
// Zweifel gilt: gesperrt." P-ADMIN-KI-FREIGABE verlangt die Anwendung in ALLEN KI-Wegen.
//
// WIE HIER GEMESSEN WIRD: durch die echte Kompositionswurzel (`buildApp(buildServices())`), mit dem
// Transkriber, den die Fabrik aus der Umgebung baut (`createCappedTranscriberFromEnv`). Mitgeschrieben
// wird HINTER dem Client am Transport (`fetch`, vor dem Bau gebunden) — was dort ankommt, hätte das
// Haus verlassen. Kein Netz, kein echter Schlüssel. Jede Sperre hat ihre Gegenprobe im selben Aufbau.
//
// WARUM DIESE DATEI HIER LIEGT: sie erteilt die Freigabe über den Testhelfer; das ist außerhalb von
// `tests/admin-ki-freigabe/` nur mit Registereintrag erlaubt (Freigabe-Wächter F1 in
// `tests/ki-anbieterwahl/routing-zwei-attrappen.test.ts`). Dieses Verzeichnis ist die Ausnahme.
import { Buffer } from "node:buffer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { erteileKiFreigabe } from "../../services/reasoner/src/testhelfer-ki-freigabe";

const TRANSKRIPTION_URL = "https://api.openai.com/v1/audio/transcriptions";
const TRANSKRIPT = "VON-WHISPER: Spindel nur im Stillstand schmieren.";

// Nur der dedizierte Transkriptionsschlüssel: der Reasoner bekommt so keinen Cloud-Anbieter, und der
// einzige Weg nach draußen ist die Transkription.
const UMGEBUNG: Record<string, string | undefined> = {
  MEDIA_TRANSCRIBE_API_KEY: "whisper-test-nur-hier",
  MEDIA_TRANSCRIBE_MODEL: undefined,
  OPENAI_API_KEY: undefined,
  OPENAI_BASE_URL: undefined,
  ANTHROPIC_API_KEY: undefined,
  REASONER_MODEL: undefined,
  KLARWERK_LOCAL_LLM_URL: undefined,
  KLARWERK_LOCAL_LLM_MODEL: undefined,
  KLARWERK_SKIP_KEYCHAIN: "1",
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

/** Der Transport hinter dem echten Whisper-Client — vor `buildServices` gebunden. */
function transportMitschreiben(): string[] {
  const urls: string[] = [];
  vi.stubGlobal("fetch", (async (url: unknown) => {
    urls.push(String(url));
    return {
      ok: true,
      status: 200,
      json: async () => ({ text: TRANSKRIPT }),
    } as unknown as Response;
  }) as unknown as typeof fetch);
  return urls;
}

async function aufbauen(stufe: "intern" | "vertraulich" = "intern") {
  const urls = transportMitschreiben();
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "admin@transkription-freigabe.test", password: "geheim12345" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "admin@transkription-freigabe.test", password: "geheim12345" },
  });
  const headers = { authorization: `Bearer ${(login.json() as { token: string }).token}` };
  const put = await app.inject({
    method: "POST",
    url: "/api/objects",
    headers,
    payload: {
      name: "uebergabe.mp4",
      mime: "video/mp4",
      data: `data:video/mp4;base64,${Buffer.from("clip").toString("base64")}`,
      confidentiality: stufe,
    },
  });
  expect(put.statusCode).toBe(201);
  const objectId = (put.json() as { id: string }).id;
  const analysieren = async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/media/analyze",
      headers,
      payload: { objectId, locale: "de" },
    });
    expect(res.statusCode).toBe(200);
    return res.json() as {
      transcript: string | null;
      engineActive: boolean;
      engine: string | null;
      note: string;
    };
  };
  return { app, services, urls, analysieren };
}

describe("gesamt-ki-freigaberegeln · Transkription über die echte Wurzel", () => {
  it("ohne zentrale Freigabe: NULL Abrufe beim Transkriptionsdienst — mit ihr geht derselbe Aufruf hinaus", async () => {
    const a = await aufbauen();
    // KALIBRIERUNG: die Fabrik hat WIRKLICH einen Transkriber gebaut — sonst prüfte die Sperre
    // unten nur „kein Schlüssel".
    expect(a.services.media.engineInfo()).toEqual({ active: true, engine: "openai:whisper-1" });
    expect(a.services.reasoner.configStatus().taskConfig.kiFreigabe).toBeUndefined();

    const gesperrt = await a.analysieren();
    expect(gesperrt.transcript).toBeNull();
    expect(gesperrt.engineActive).toBe(false);
    expect(gesperrt.engine).toBe("openai:whisper-1");
    expect(gesperrt.note).toContain("nicht freigegeben");
    expect(a.urls.filter((u) => u === TRANSKRIPTION_URL)).toEqual([]);

    // GEGENPROBE IM SELBEN AUFBAU: die Grundfreigabe über den Schreibweg des Kerns.
    await erteileKiFreigabe(a.services.reasoner);
    const frei = await a.analysieren();
    expect(frei.transcript).toBe(TRANSKRIPT);
    expect(frei.engineActive).toBe(true);
    expect(a.urls.filter((u) => u === TRANSKRIPTION_URL)).toHaveLength(1);
    await a.app.close();
  });

  // Ben Nacharbeit 2: die ZWEITE Freigabe öffnet auch ein vertrauliches Medium — durch den echten
  // gekapselten Transkriber (`cappedTranscriber`, `rejectsConfidential: true`), der dieselbe
  // Entscheidung des Reasoners fragt. Mit nur der Grundfreigabe bleibt es drinnen.
  it("vertrauliches Medium: nur Grundfreigabe → NULL Abrufe; beide Freigaben → derselbe Aufruf geht hinaus", async () => {
    const a = await aufbauen("vertraulich");
    await erteileKiFreigabe(a.services.reasoner);
    const gesperrt = await a.analysieren();
    expect(gesperrt.transcript).toBeNull();
    expect(gesperrt.note).toContain("Vertrauliche");
    expect(a.urls.filter((u) => u === TRANSKRIPTION_URL)).toEqual([]);

    await erteileKiFreigabe(a.services.reasoner, {
      oeffentlicheKi: true,
      vertraulicheInhalte: true,
    });
    const frei = await a.analysieren();
    expect(frei.transcript).toBe(TRANSKRIPT);
    expect(frei.engineActive).toBe(true);
    expect(a.urls.filter((u) => u === TRANSKRIPTION_URL)).toHaveLength(1);
    await a.app.close();
  });
});
