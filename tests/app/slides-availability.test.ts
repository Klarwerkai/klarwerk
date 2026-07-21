// WP-RETEST7 R8 (Pedis Befund: endloser Spinner bei dark-shipped/abgeschalteter Folien-Route):
// (1) leichter Verfügbarkeits-GET vor dem großen Upload (auth, ehrlich enabled/disabled),
// (2) abgesicherter Client-Lauf: disabled → KEIN Konvertierungs-POST + sofortige Meldung; jeder
// Fehlerausgang (503/429/Timeout/Netz) endet als Outcome, (3) harter Client-Timeout im API-Client.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, api } from "../../apps/web/src/api/client";
import {
  SLIDES_CONVERT_TIMEOUT_MS,
  SLIDE_IMAGES_TEXT,
  type SlidesApi,
  convertSlidesWithGuard,
  slidesErrorKey,
} from "../../apps/web/src/lib/slideImages";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import type { SlideConverter } from "../../services/app/src/slide-converter";

beforeEach(() => {
  process.env.KLARWERK_SLIDES_ENABLED = "1";
});
afterEach(() => {
  delete process.env.KLARWERK_SLIDES_ENABLED;
  vi.unstubAllGlobals();
});

function fakeConverter(available: boolean): SlideConverter {
  return {
    available: async () => available,
    convert: async () => {
      throw new Error("nicht erwartet");
    },
  };
}

async function appWithLogin(converter: SlideConverter) {
  const services = buildServices();
  services.slideConverter = converter;
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Nutzer", email: "n@x.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "n@x.de", password: "secret123" },
  });
  return { app, headers: { authorization: `Bearer ${(login.json() as { token: string }).token}` } };
}

describe("WP-RETEST7 R8: GET /api/capture/slides/availability", () => {
  it("auth-geschützt (401 anonym); enabled + Konverter → true", async () => {
    const { app, headers } = await appWithLogin(fakeConverter(true));
    const anon = await app.inject({ method: "GET", url: "/api/capture/slides/availability" });
    expect(anon.statusCode).toBe(401);
    const res = await app.inject({
      method: "GET",
      url: "/api/capture/slides/availability",
      headers,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ available: true });
  });

  it("Route abgeschaltet (Default AUS) ODER kein Konverter → ehrlich false", async () => {
    delete process.env.KLARWERK_SLIDES_ENABLED;
    const disabled = await appWithLogin(fakeConverter(true));
    const res1 = await disabled.app.inject({
      method: "GET",
      url: "/api/capture/slides/availability",
      headers: disabled.headers,
    });
    expect(res1.json()).toEqual({ available: false });

    process.env.KLARWERK_SLIDES_ENABLED = "1";
    const noConverter = await appWithLogin(fakeConverter(false));
    const res2 = await noConverter.app.inject({
      method: "GET",
      url: "/api/capture/slides/availability",
      headers: noConverter.headers,
    });
    expect(res2.json()).toEqual({ available: false });
  });
});

describe("WP-RETEST7 R8: convertSlidesWithGuard (Client-Absicherung)", () => {
  it("disabled → SOFORT die ehrliche Meldung, der große Konvertierungs-POST wird NIE gesendet", async () => {
    let converts = 0;
    const apiFake: SlidesApi = {
      availability: async () => ({ available: false }),
      convert: async () => {
        converts += 1;
        throw new Error("nie");
      },
    };
    const outcome = await convertSlidesWithGuard(apiFake, "QUJD");
    expect(outcome).toEqual({ ok: false, messageKey: SLIDE_IMAGES_TEXT.unavailable });
    expect(converts).toBe(0);
  });

  it("JEDER Fehlerausgang endet als Outcome: 503 → unavailable, 429 → busy, Timeout → timeout, Netz → failed", async () => {
    const withError = (error: unknown): SlidesApi => ({
      availability: async () => ({ available: true }),
      convert: async () => {
        throw error;
      },
    });
    const cases: [unknown, string][] = [
      [new ApiError(503, "SLIDES_UNAVAILABLE", "aus"), SLIDE_IMAGES_TEXT.unavailable],
      [new ApiError(429, "CONVERSION_BUSY", "belegt"), SLIDE_IMAGES_TEXT.busy],
      [new ApiError(408, "TIMEOUT", "zu lang"), SLIDE_IMAGES_TEXT.timeout],
      [new TypeError("Failed to fetch"), SLIDE_IMAGES_TEXT.failed],
    ];
    for (const [error, key] of cases) {
      const outcome = await convertSlidesWithGuard(withError(error), "QUJD");
      expect(outcome).toEqual({ ok: false, messageKey: key });
      expect(slidesErrorKey(error)).toBe(key);
    }
    // Scheitert schon der Verfügbarkeits-Check (Netz), wird NICHT ins Blaue hochgeladen.
    let converts = 0;
    const brokenCheck: SlidesApi = {
      availability: async () => {
        throw new TypeError("Failed to fetch");
      },
      convert: async () => {
        converts += 1;
        throw new Error("nie");
      },
    };
    const outcome = await convertSlidesWithGuard(brokenCheck, "QUJD");
    expect(outcome).toEqual({ ok: false, messageKey: SLIDE_IMAGES_TEXT.failed });
    expect(converts).toBe(0);
  });
});

describe("WP-RETEST7 R8: api.postWithTimeout (harter Client-Timeout)", () => {
  it("hängende Anfrage → Abbruch nach der Frist + ehrlicher ApiError(408, TIMEOUT)", async () => {
    expect(SLIDES_CONVERT_TIMEOUT_MS).toBe(90_000);
    vi.stubGlobal("fetch", (_input: unknown, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        );
      });
    });
    const started = Date.now();
    await expect(api.postWithTimeout("/capture/slides", { data: "x" }, 30)).rejects.toMatchObject({
      status: 408,
      code: "TIMEOUT",
    });
    expect(Date.now() - started).toBeLessThan(5_000); // bricht wirklich ab, hängt nicht
  });
});
