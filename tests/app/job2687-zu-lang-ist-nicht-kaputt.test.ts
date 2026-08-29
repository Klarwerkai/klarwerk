// ================================================================================================
// JOB 2687 · D1 — ZU LANG IST NICHT KAPUTT (Review EXT1 R2-26, Spiegel von Befund 14 / JOB 2671).
// ================================================================================================
//
// DER BEFUND: Jeder Konverterfehler wurde `500 SLIDES_FAILED`; der Client kannte nur 503/429/408 —
// „zu lang" und „kaputt" sahen gleich aus, und beide wie ein Serverfehler.
//
//   A · die Art des Fehlers, am echten Wortlaut des Konverters (`slidesFehlerArt`).
//   R · die Route mit Fake-Konverter: Zeitlimit → 422, Defekt → 415, Unbekanntes → 500 (bleibt).
//   C · der Client kennt beide (`slidesErrorKey`) — und die Texte sagen, was zu tun ist.
//   Die Erfassen-Fläche misst `job2687-zu-lang-mounted.test.tsx`.
import { afterEach, beforeEach, describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import { ApiError } from "../../apps/web/src/api/client";
import i18n from "../../apps/web/src/i18n";
import { SLIDE_IMAGES_TEXT, slidesErrorKey } from "../../apps/web/src/lib/slideImages";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import {
  SLIDES_INVALID_MESSAGE,
  SLIDES_TIMEOUT_MESSAGE,
  slidesFehlerArt,
} from "../../services/app/src/routes/slides-routes";
import { SlideConvertError, type SlideConverter } from "../../services/app/src/slide-converter";

describe("JOB 2687 · A — die Art, am echten Wortlaut des Konverters", () => {
  it("A1 · beide Zeitlimit-Formen und der Routen-Abbruch sind „timeout“", () => {
    expect(
      slidesFehlerArt(new SlideConvertError("Zeitlimit der Folien-Konvertierung überschritten.")),
    ).toBe("timeout");
    expect(
      slidesFehlerArt(
        new Error("Zeitlimit: soffice wurde nach 60000 ms samt Prozessgruppe beendet."),
      ),
    ).toBe("timeout");
    expect(
      slidesFehlerArt(
        new SlideConvertError("Folien-Konvertierung abgebrochen (Anforderung der Route)."),
      ),
    ).toBe("timeout");
    expect(
      slidesFehlerArt(
        new SlideConvertError("Abbruch: soffice wurde auf Anforderung samt Prozessgruppe beendet."),
      ),
    ).toBe("timeout");
  });

  it("A2 · nicht-null-Exit, keine Folienbilder, kein PDF sind „invalid“", () => {
    expect(slidesFehlerArt(new Error("soffice beendete mit Code 1 (Signal null)."))).toBe(
      "invalid",
    );
    expect(
      slidesFehlerArt(new SlideConvertError("Die Konvertierung lieferte keine Folienbilder.")),
    ).toBe("invalid");
    expect(slidesFehlerArt(new SlideConvertError("soffice hat kein PDF erzeugt."))).toBe("invalid");
  });

  it("A3 · ein unbekannter Fehler bleibt „unknown“ — ein Infrastrukturfehler ist keine kaputte Datei", () => {
    expect(slidesFehlerArt(new Error("EACCES: permission denied, mkdtemp"))).toBe("unknown");
    expect(slidesFehlerArt("irgendwas")).toBe("unknown");
  });
});

const SMALL_PPTX = Buffer.from("PK\x03\x04-fake").toString("base64");

function konverter(convert: SlideConverter["convert"]): SlideConverter {
  return { available: async () => true, convert } as unknown as SlideConverter;
}

async function angemeldet(app: ReturnType<typeof buildApp>): Promise<{ authorization: string }> {
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "pedi@job2687.test", password: "geheim12345" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "pedi@job2687.test", password: "geheim12345" },
  });
  expect(login.statusCode, login.body).toBe(200);
  return { authorization: `Bearer ${(login.json() as { token: string }).token}` };
}

async function antwort(convert: SlideConverter["convert"]) {
  const services = buildServices();
  services.slideConverter = konverter(convert);
  const app = buildApp(services);
  try {
    const headers = await angemeldet(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/capture/slides",
      headers,
      payload: { data: SMALL_PPTX },
    });
    return { status: res.statusCode, body: res.json() as { error: string; message: string } };
  } finally {
    await app.close();
  }
}

describe("JOB 2687 · R — die Route unterscheidet", () => {
  beforeEach(() => {
    process.env.KLARWERK_SLIDES_ENABLED = "1";
  });
  afterEach(() => {
    delete process.env.KLARWERK_SLIDES_ENABLED;
  });

  it("R1 · Zeitlimit → 422 SLIDES_TIMEOUT mit „zu lange … kleineres Deck“", async () => {
    const { status, body } = await antwort(async () => {
      throw new SlideConvertError("Zeitlimit der Folien-Konvertierung überschritten.");
    });
    expect(status).toBe(422);
    expect(body.error).toBe("SLIDES_TIMEOUT");
    expect(body.message).toBe(SLIDES_TIMEOUT_MESSAGE);
    expect(body.message).toContain("zu lange");
    expect(body.message).toContain("kleineres Deck");
  });

  it("R2 · defektes Archiv (soffice-Exit ≠ 0) → 415 SLIDES_INVALID mit „beschädigt … andere Datei“", async () => {
    const { status, body } = await antwort(async () => {
      throw new Error("soffice beendete mit Code 1 (Signal null).");
    });
    expect(status).toBe(415);
    expect(body.error).toBe("SLIDES_INVALID");
    expect(body.message).toBe(SLIDES_INVALID_MESSAGE);
    expect(body.message).toContain("andere Datei");
  });

  it("R3 · GEGENPROBE: ein unbekannter Fehler bleibt ehrlich 500 SLIDES_FAILED", async () => {
    const { status, body } = await antwort(async () => {
      throw new Error("EACCES: permission denied, mkdtemp");
    });
    expect(status).toBe(500);
    expect(body.error).toBe("SLIDES_FAILED");
  });
});

describe("JOB 2687 · C — der Client kennt beide", () => {
  it("C1 · 422 → serverTimeout, 415 → invalid; die bisherigen Zuordnungen bleiben", () => {
    expect(slidesErrorKey(new ApiError(422, "SLIDES_TIMEOUT", "…"))).toBe(
      SLIDE_IMAGES_TEXT.serverTimeout,
    );
    expect(slidesErrorKey(new ApiError(415, "SLIDES_INVALID", "…"))).toBe(
      SLIDE_IMAGES_TEXT.invalid,
    );
    expect(slidesErrorKey(new ApiError(503, "UNAVAILABLE", "…"))).toBe(
      SLIDE_IMAGES_TEXT.unavailable,
    );
    expect(slidesErrorKey(new ApiError(429, "CONVERSION_BUSY", "…"))).toBe(SLIDE_IMAGES_TEXT.busy);
    expect(slidesErrorKey(new ApiError(408, "TIMEOUT", "…"))).toBe(SLIDE_IMAGES_TEXT.timeout);
    // VORHER: 500 und alles Unbekannte → failed. Das bleibt für den echten Serverfehler.
    expect(slidesErrorKey(new ApiError(500, "SLIDES_FAILED", "…"))).toBe(SLIDE_IMAGES_TEXT.failed);
    expect(slidesErrorKey(new Error("netz"))).toBe(SLIDE_IMAGES_TEXT.failed);
  });

  it("C2 · die Texte sagen, was der Mensch tun kann — in allen drei Sprachen", async () => {
    for (const lng of ["de", "en", "nl"]) {
      await i18n.changeLanguage(lng);
      const zuLang = i18n.t(SLIDE_IMAGES_TEXT.serverTimeout);
      const kaputt = i18n.t(SLIDE_IMAGES_TEXT.invalid);
      expect(zuLang, lng).not.toBe(SLIDE_IMAGES_TEXT.serverTimeout);
      expect(kaputt, lng).not.toBe(SLIDE_IMAGES_TEXT.invalid);
      expect(zuLang, lng).not.toBe(kaputt);
      expect(zuLang.length, lng).toBeGreaterThan(40);
      expect(kaputt.length, lng).toBeGreaterThan(40);
    }
    await i18n.changeLanguage("de");
    expect(i18n.t(SLIDE_IMAGES_TEXT.serverTimeout)).toContain("kleineres Deck");
    expect(i18n.t(SLIDE_IMAGES_TEXT.invalid)).toContain("andere Datei");
  });
});
