// WP-D11: POST /api/capture/slides — Route-Verhalten KOMPLETT OHNE soffice (Konverter ist eine
// injizierbare Abhängigkeit; hier Fakes): Auth, 503 ohne Konverter, Grenzen (Base64/50 MB),
// Serialisierung (429 bei paralleler Konvertierung), Erfolgsform (data-URLs in Folienreihenfolge,
// truncated-Durchreichung), ehrlicher 500-Fehlerpfad.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import type { SlideConvertResult, SlideConverter } from "../../services/app/src/slide-converter";

function fakeConverter(overrides: Partial<SlideConverter> = {}): SlideConverter {
  return {
    available: async () => true,
    convert: async () => ({
      pngs: [Buffer.from("png-eins"), Buffer.from("png-zwei")],
      truncated: false,
    }),
    ...overrides,
  };
}

async function loginHeaders(app: ReturnType<typeof buildApp>): Promise<{ authorization: string }> {
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
  return { authorization: `Bearer ${(login.json() as { token: string }).token}` };
}

function appWith(converter: SlideConverter): ReturnType<typeof buildApp> {
  const services = buildServices();
  services.slideConverter = converter;
  return buildApp(services);
}

const SMALL_PPTX = Buffer.from("PK\x03\x04-fake").toString("base64");

describe("WP-D11: /api/capture/slides", () => {
  it("bleibt hinter dem Import-Guard (401 ohne Anmeldung — Auth VOR dem großen Parse)", async () => {
    const app = appWith(fakeConverter());
    const res = await app.inject({
      method: "POST",
      url: "/api/capture/slides",
      payload: { data: SMALL_PPTX },
    });
    expect(res.statusCode).toBe(401);
  });

  it("ohne soffice (lokale Dev-Umgebung): ehrlicher 503 — Folien-Ansicht derzeit nicht verfügbar", async () => {
    const app = appWith(fakeConverter({ available: async () => false }));
    const headers = await loginHeaders(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/capture/slides",
      headers,
      payload: { data: SMALL_PPTX },
    });
    expect(res.statusCode).toBe(503);
    expect((res.json() as { error: string }).error).toBe("SLIDES_UNAVAILABLE");
  });

  it("Erfolg: eine PNG-data-URL je Folie, in Folienreihenfolge; truncated wird durchgereicht", async () => {
    const app = appWith(
      fakeConverter({
        convert: async () => ({
          pngs: [Buffer.from("folie-1"), Buffer.from("folie-2"), Buffer.from("folie-3")],
          truncated: true, // Deck hatte mehr als MAX_SLIDES (z. B. 31) → ehrliche Kappung
        }),
      }),
    );
    const headers = await loginHeaders(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/capture/slides",
      headers,
      payload: { data: SMALL_PPTX },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      slides: string[];
      slideCount: number;
      truncated: boolean;
      maxSlides: number;
    };
    expect(body.slideCount).toBe(3);
    expect(body.truncated).toBe(true);
    expect(body.maxSlides).toBe(30);
    expect(body.slides).toEqual([
      `data:image/png;base64,${Buffer.from("folie-1").toString("base64")}`,
      `data:image/png;base64,${Buffer.from("folie-2").toString("base64")}`,
      `data:image/png;base64,${Buffer.from("folie-3").toString("base64")}`,
    ]);
  });

  it("kaputte Base64 → 400; Eingabe über 50 MB → 413 (arithmetisch, vor jeder Materialisierung)", async () => {
    const app = appWith(fakeConverter());
    const headers = await loginHeaders(app);
    const bad = await app.inject({
      method: "POST",
      url: "/api/capture/slides",
      headers,
      payload: { data: "nicht base64!" },
    });
    expect(bad.statusCode).toBe(400);
    // 70.000.000 Zeichen dekodieren zu 52,5 MB > 50-MiB-Deckel (Body bleibt unter dem Routen-Limit).
    const huge = await app.inject({
      method: "POST",
      url: "/api/capture/slides",
      headers,
      payload: { data: "A".repeat(70_000_000) },
    });
    expect(huge.statusCode).toBe(413);
  });

  it("SERIALISIERUNG: während einer laufenden Konvertierung wird die zweite ehrlich mit 429 abgelehnt", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const app = appWith(
      fakeConverter({
        convert: async (): Promise<SlideConvertResult> => {
          await gate;
          return { pngs: [Buffer.from("folie-1")], truncated: false };
        },
      }),
    );
    const headers = await loginHeaders(app);
    const first = app.inject({
      method: "POST",
      url: "/api/capture/slides",
      headers,
      payload: { data: SMALL_PPTX },
    });
    // Warten, bis die erste Konvertierung wirklich läuft (Mikrotask-Runden).
    await new Promise((r) => setTimeout(r, 20));
    const second = await app.inject({
      method: "POST",
      url: "/api/capture/slides",
      headers,
      payload: { data: SMALL_PPTX },
    });
    expect(second.statusCode).toBe(429);
    expect(second.headers["retry-after"]).toBe("30");
    expect((second.json() as { error: string }).error).toBe("CONVERSION_BUSY");
    release();
    expect((await first).statusCode).toBe(200);
    // Nach Abschluss ist der Platz wieder frei.
    const third = await app.inject({
      method: "POST",
      url: "/api/capture/slides",
      headers,
      payload: { data: SMALL_PPTX },
    });
    expect(third.statusCode).toBe(200);
  });

  it("Konverter-Fehler (z. B. Timeout) → ehrlicher 500 SLIDES_FAILED; der Platz wird wieder frei", async () => {
    let fail = true;
    const app = appWith(
      fakeConverter({
        convert: async () => {
          if (fail) {
            throw new Error("Zeitlimit der Folien-Konvertierung überschritten.");
          }
          return { pngs: [Buffer.from("folie-1")], truncated: false };
        },
      }),
    );
    const headers = await loginHeaders(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/capture/slides",
      headers,
      payload: { data: SMALL_PPTX },
    });
    expect(res.statusCode).toBe(500);
    expect((res.json() as { error: string }).error).toBe("SLIDES_FAILED");
    fail = false;
    const retry = await app.inject({
      method: "POST",
      url: "/api/capture/slides",
      headers,
      payload: { data: SMALL_PPTX },
    });
    expect(retry.statusCode).toBe(200);
  });
});
