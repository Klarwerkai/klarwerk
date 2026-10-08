// ================================================================================================
// Aufnahme gesamt-sprachassistent · R-0104 — DIE SPRACHAUFNAHME GEHT DENSELBEN WEG WIE DIE DATEI.
// ================================================================================================
//
// `POST /api/media/transcribe` verschriftlicht eine Aufnahme aus Erfassen oder Fragen, ohne sie zu
// speichern. Die Zusage dieser Datei: es ist KEIN zweiter Weg nach draussen, sondern derselbe —
// derselbe Transkriber aus der Fabrik, dieselbe zentrale Freigabe, dieselbe Vertraulichkeitsregel
// wie `POST /api/media/analyze` (Bauform von `transkription-grundfreigabe.test.ts` nebenan).
//
// Gemessen wird durch die echte Kompositionswurzel, mitgeschrieben am Transport HINTER dem
// Whisper-Client. Kein Netz, kein echter Schlüssel. Jede Sperre hat ihre Gegenprobe im selben Aufbau.
//
// Diese Datei liegt in `tests/admin-ki-freigabe/`, weil sie die Freigabe über den Testhelfer erteilt
// (Freigabe-Wächter F1 in `tests/ki-anbieterwahl/routing-zwei-attrappen.test.ts`).
import { Buffer } from "node:buffer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { SPRACHAUFNAHME_BODY_LIMIT } from "../../services/app/src/routes/media-routes";
import { SPRACHAUFNAHME_MAX_BYTES } from "../../services/media";
import { erteileKiFreigabe } from "../../services/reasoner/src/testhelfer-ki-freigabe";

const TRANSKRIPTION_URL = "https://api.openai.com/v1/audio/transcriptions";
const TRANSKRIPT = "VON-WHISPER: Wie oft wird das Ventil V3 entlueftet?";
const AUFNAHME = `data:audio/webm;base64,${Buffer.from("gesprochen").toString("base64")}`;

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

interface Gesendet {
  url: string;
  dateiname: string | null;
}

/** Der Transport hinter dem echten Whisper-Client — vor `buildServices` gebunden. */
function transportMitschreiben(): Gesendet[] {
  const gesendet: Gesendet[] = [];
  vi.stubGlobal("fetch", (async (url: unknown, init?: { body?: unknown }) => {
    const body = init?.body as { get?: (k: string) => unknown } | undefined;
    const datei = body?.get?.("file") as { name?: string } | null | undefined;
    gesendet.push({ url: String(url), dateiname: datei?.name ?? null });
    return {
      ok: true,
      status: 200,
      json: async () => ({ text: TRANSKRIPT }),
    } as unknown as Response;
  }) as unknown as typeof fetch);
  return gesendet;
}

async function aufbauen() {
  const gesendet = transportMitschreiben();
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "admin@sprachaufnahme.test", password: "geheim12345" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "admin@sprachaufnahme.test", password: "geheim12345" },
  });
  const headers = { authorization: `Bearer ${(login.json() as { token: string }).token}` };
  const senden = (payload: Record<string, unknown>, mitAnmeldung = true) =>
    app.inject({
      method: "POST",
      url: "/api/media/transcribe",
      ...(mitAnmeldung ? { headers } : {}),
      payload,
    });
  const hinaus = () => gesendet.filter((g) => g.url === TRANSKRIPTION_URL);
  return { app, services, gesendet, hinaus, senden };
}

describe("R-0104 · POST /api/media/transcribe folgt der zentralen Freigabe", () => {
  it("T1 · ohne Freigabe NULL Abrufe — mit ihr geht die Aufnahme hinaus und kommt als Text zurück", async () => {
    const a = await aufbauen();
    // KALIBRIERUNG: es gibt WIRKLICH einen Transkriber — sonst prüfte die Sperre nur „kein Schlüssel".
    expect(a.services.media.engineInfo()).toEqual({ active: true, engine: "openai:whisper-1" });

    const gesperrt = await a.senden({ data: AUFNAHME, locale: "de", confidentiality: "intern" });
    expect(gesperrt.statusCode).toBe(200);
    const gesperrtRumpf = gesperrt.json() as { transcript: string | null; note: string };
    expect(gesperrtRumpf.transcript).toBeNull();
    expect(gesperrtRumpf.note).toContain("nicht freigegeben");
    expect(a.hinaus()).toEqual([]);

    await erteileKiFreigabe(a.services.reasoner);
    const frei = await a.senden({ data: AUFNAHME, locale: "de", confidentiality: "intern" });
    expect(frei.statusCode).toBe(200);
    const rumpf = frei.json() as Record<string, unknown>;
    expect(rumpf.transcript).toBe(TRANSKRIPT);
    expect(rumpf.engineActive).toBe(true);
    expect(rumpf.engine).toBe("openai:whisper-1");
    // Nichts gespeichert: die Antwort nennt kein Objekt.
    expect(Object.hasOwn(rumpf, "objectId")).toBe(false);
    expect(a.hinaus()).toHaveLength(1);
    // Derselbe Client wie beim Dateiweg: der Dateiname folgt dem Medientyp (F-0121).
    expect(a.hinaus()[0]?.dateiname).toMatch(/\.webm$/);
    await a.app.close();
  });

  it("T2 · ohne genannte Stufe gilt die Aufnahme als vertraulich — erst die zweite Freigabe öffnet", async () => {
    const a = await aufbauen();
    await erteileKiFreigabe(a.services.reasoner);
    const ohneStufe = await a.senden({ data: AUFNAHME, locale: "de" });
    expect(ohneStufe.statusCode).toBe(200);
    expect((ohneStufe.json() as { note: string }).note).toContain("Vertrauliche");
    const unbekannt = await a.senden({ data: AUFNAHME, confidentiality: "oeffentlich-ish" });
    expect((unbekannt.json() as { transcript: string | null }).transcript).toBeNull();
    expect(a.hinaus()).toEqual([]);

    await erteileKiFreigabe(a.services.reasoner, {
      oeffentlicheKi: true,
      vertraulicheInhalte: true,
    });
    const frei = await a.senden({ data: AUFNAHME, locale: "de" });
    expect((frei.json() as { transcript: string | null }).transcript).toBe(TRANSKRIPT);
    expect(a.hinaus()).toHaveLength(1);
    await a.app.close();
  });

  it("T3 · Unbrauchbares wird abgewiesen, bevor etwas hinausgeht", async () => {
    const a = await aufbauen();
    await erteileKiFreigabe(a.services.reasoner);
    const leer = await a.senden({ locale: "de", confidentiality: "intern" });
    expect(leer.statusCode).toBe(400);
    expect((leer.json() as { error: string }).error).toBe("BAD_REQUEST");
    const text = await a.senden({
      data: `data:text/plain;base64,${Buffer.from("kein ton").toString("base64")}`,
      confidentiality: "intern",
    });
    expect(text.statusCode).toBe(400);
    expect((text.json() as { error: string }).error).toBe("UNSUPPORTED_KIND");
    const keineDataUrl = await a.senden({ data: "gesprochen", confidentiality: "intern" });
    expect(keineDataUrl.statusCode).toBe(400);
    const nullBytes = await a.senden({
      data: "data:audio/webm;base64,",
      confidentiality: "intern",
    });
    expect(nullBytes.statusCode).toBe(400);
    expect(a.hinaus()).toEqual([]);
    await a.app.close();
  });

  it("T4 · unangemeldet: 401 und kein Abruf", async () => {
    const a = await aufbauen();
    await erteileKiFreigabe(a.services.reasoner);
    const anonym = await a.senden({ data: AUFNAHME, confidentiality: "intern" }, false);
    expect(anonym.statusCode).toBe(401);
    expect(a.hinaus()).toEqual([]);
    await a.app.close();
  });

  it("T5 · die Rumpfgrenze trägt die grösste Aufnahme, die der Dienst annimmt (Base64)", () => {
    expect(SPRACHAUFNAHME_BODY_LIMIT).toBeGreaterThanOrEqual(
      Math.ceil((SPRACHAUFNAHME_MAX_BYTES * 4) / 3) + 1024,
    );
    // Und sie liegt unter der Grenze des allgemeinen Objekt-Uploads — keine neue Riesentür.
    expect(SPRACHAUFNAHME_BODY_LIMIT).toBeLessThanOrEqual(30 * 1024 * 1024);
  });
});
