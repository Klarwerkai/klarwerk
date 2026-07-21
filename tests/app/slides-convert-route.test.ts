// WP-D11: POST /api/capture/slides — Route-Verhalten KOMPLETT OHNE soffice (Konverter ist eine
// injizierbare Abhängigkeit; hier Fakes): Auth, 503 ohne Konverter, Grenzen (Base64/50 MB),
// Serialisierung (429 bei paralleler Konvertierung), Erfolgsform (data-URLs in Folienreihenfolge,
// truncated-Durchreichung), ehrlicher 500-Fehlerpfad.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import {
  SLIDES_RATE_LIMIT,
  SLIDES_RATE_MAX_ENTRIES,
  createSlidesRateLimiter,
} from "../../services/app/src/routes/slides-routes";
import type { SlideConvertResult, SlideConverter } from "../../services/app/src/slide-converter";

// WP-SHIP7-FIX (bens Fix 4): der Betriebsschalter ist jetzt DEFAULT AUS — diese Suite testet das
// Routen-Verhalten und schaltet ihn deshalb je Test EXPLIZIT ein; der Default-Fall (ohne ENV → 503)
// hat unten seinen eigenen Test.
beforeEach(() => {
  process.env.KLARWERK_SLIDES_ENABLED = "1";
});
afterEach(() => {
  delete process.env.KLARWERK_SLIDES_ENABLED;
});

// WP-D11b: Ergebnis-Form inkl. der ehrlichen Deckel-Zähler (Blocker 2).
function convertResult(overrides: Partial<SlideConvertResult> = {}): SlideConvertResult {
  return {
    pngs: [Buffer.from("png-eins"), Buffer.from("png-zwei")],
    truncated: false,
    droppedOversize: 0,
    droppedByBudget: 0,
    truncatedByBudget: false,
    ...overrides,
  };
}

function fakeConverter(overrides: Partial<SlideConverter> = {}): SlideConverter {
  return {
    available: async () => true,
    convert: async () => convertResult(),
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
        convert: async () =>
          convertResult({
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
          return convertResult({ pngs: [Buffer.from("folie-1")] });
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
          return convertResult({ pngs: [Buffer.from("folie-1")] });
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

// Ein Body, der beim JSON-Parsen SICHER scheitern würde (kein JSON): antwortet die Route mit dem
// Guard-Status statt 400, hat der Parser NIE gearbeitet — das ist der Vor-dem-Parse-Marker.
const UNPARSEABLE_BODY = "x".repeat(2_000_000);

describe("WP-D11b Blocker 3: Guard + Busy + Rate-Limit VOR dem großen Parse", () => {
  it("anonym mit großem, kaputtem Body → 401 und der Body-Parser lief NIE (sonst käme 400)", async () => {
    const app = appWith(fakeConverter());
    const res = await app.inject({
      method: "POST",
      url: "/api/capture/slides",
      headers: { "content-type": "application/json" },
      payload: UNPARSEABLE_BODY,
    });
    expect(res.statusCode).toBe(401);
  });

  it("busy → 429 aus dem Hook VOR dem Parse (kaputter Body kommt trotzdem als CONVERSION_BUSY zurück)", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const app = appWith(
      fakeConverter({
        convert: async (): Promise<SlideConvertResult> => {
          await gate;
          return convertResult({ pngs: [Buffer.from("folie-1")] });
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
    await new Promise((r) => setTimeout(r, 20));
    const second = await app.inject({
      method: "POST",
      url: "/api/capture/slides",
      headers: { ...headers, "content-type": "application/json" },
      payload: UNPARSEABLE_BODY, // wäre der Parser gelaufen → 400; der Hook weist mit 429 ab
    });
    expect(second.statusCode).toBe(429);
    expect((second.json() as { error: string }).error).toBe("CONVERSION_BUSY");
    release();
    expect((await first).statusCode).toBe(200);
  });

  it("Principal-Rate-Limit: der sechste Aufruf derselben Nutzerin im Fenster → ehrlicher 429", async () => {
    const app = appWith(fakeConverter());
    const headers = await loginHeaders(app);
    for (let i = 0; i < SLIDES_RATE_LIMIT; i++) {
      const ok = await app.inject({
        method: "POST",
        url: "/api/capture/slides",
        headers,
        payload: { data: SMALL_PPTX },
      });
      expect(ok.statusCode).toBe(200);
    }
    const blocked = await app.inject({
      method: "POST",
      url: "/api/capture/slides",
      headers,
      payload: { data: SMALL_PPTX },
    });
    expect(blocked.statusCode).toBe(429);
    expect((blocked.json() as { error: string }).error).toBe("RATE_LIMITED");
    expect(blocked.headers["retry-after"]).toBe("60");
  });
});

describe("WP-D11b Blocker 1: Betriebsschalter KLARWERK_SLIDES_ENABLED", () => {
  it("abgeschaltet (=0) → ehrlicher 503 auf dem gleichen Pfad wie ohne soffice — vor dem Parse", async () => {
    process.env.KLARWERK_SLIDES_ENABLED = "0";
    try {
      const app = appWith(fakeConverter());
      const headers = await loginHeaders(app);
      const res = await app.inject({
        method: "POST",
        url: "/api/capture/slides",
        headers: { ...headers, "content-type": "application/json" },
        payload: UNPARSEABLE_BODY, // Parser lief nie — der Hook antwortet direkt mit 503
      });
      expect(res.statusCode).toBe(503);
      expect((res.json() as { error: string }).error).toBe("SLIDES_UNAVAILABLE");
    } finally {
      delete process.env.KLARWERK_SLIDES_ENABLED;
    }
  });

  it("WP-SHIP7-FIX (Fix 4): DEFAULT IST AUS — ohne ENV antwortet die Route 503 (Konverter-Fläche nach normalem Deploy inaktiv)", async () => {
    delete process.env.KLARWERK_SLIDES_ENABLED;
    const app = appWith(fakeConverter());
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

  it("nur ein EXPLIZITES =1/true schaltet ein (beliebige andere Werte bleiben aus)", async () => {
    process.env.KLARWERK_SLIDES_ENABLED = "yes"; // kein gültiges Enable
    const app = appWith(fakeConverter());
    const headers = await loginHeaders(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/capture/slides",
      headers,
      payload: { data: SMALL_PPTX },
    });
    expect(res.statusCode).toBe(503);
  });
});

describe("WP-SHIP7-FIX (Fix 5): Slot-Reservierung VOR dem Parse + gedeckelte Rate-Map", () => {
  it("GATE: simultane Erstrequests → genau EIN Body-Parse, Rest 429 ohne Parse; danach ist der Slot frei", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const app = appWith(
      fakeConverter({
        convert: async (): Promise<SlideConvertResult> => {
          await gate;
          return convertResult({ pngs: [Buffer.from("folie-1")] });
        },
      }),
    );
    // Parse-Zähler: preParsing läuft NUR, wenn der onRequest-Hook den Request nicht abgewiesen hat.
    let parses = 0;
    app.addHook("preParsing", async (request) => {
      if (request.url === "/api/capture/slides") {
        parses += 1;
      }
    });
    const headers = await loginHeaders(app);
    // Drei Requests GLEICHZEITIG starten, BEVOR irgendein Handler läuft.
    const requests = [0, 1, 2].map(() =>
      app.inject({
        method: "POST",
        url: "/api/capture/slides",
        headers,
        payload: { data: SMALL_PPTX },
      }),
    );
    await new Promise((r) => setTimeout(r, 30));
    expect(parses).toBe(1); // genau EINER parst — die anderen wurden VOR dem Parse abgewiesen
    release();
    const responses = await Promise.all(requests);
    expect(responses.map((r) => r.statusCode).sort()).toEqual([200, 429, 429]);
    // Freigabe nach Abschluss: der Folge-Request bekommt den Slot (und parst als zweiter).
    const after = await app.inject({
      method: "POST",
      url: "/api/capture/slides",
      headers,
      payload: { data: SMALL_PPTX },
    });
    expect(after.statusCode).toBe(200);
    expect(parses).toBe(2);
  });

  it("Rate-Map wächst nicht unbegrenzt: harte Kardinalitätsgrenze mit TTL/LRU-Verdrängung", () => {
    const limiter = createSlidesRateLimiter();
    for (let i = 0; i < SLIDES_RATE_MAX_ENTRIES + 200; i++) {
      limiter.hit(`user-${i}`, 1_000_000 + i);
    }
    expect(limiter.size()).toBeLessThanOrEqual(SLIDES_RATE_MAX_ENTRIES);
    // Ein frischer Nutzer passt trotz voller Map immer hinein (Verdrängung, kein Fehler).
    expect(limiter.hit("frische-nutzerin", 2_000_000)).toBe(false);
    expect(limiter.size()).toBeLessThanOrEqual(SLIDES_RATE_MAX_ENTRIES);
  });
});

describe("WP-D11b GELB b: PPTX-/ZIP-Signatur VOR dem Konverter", () => {
  it("JPEG-Bytes als pptx → 400, der Konverter wird NIE aufgerufen", async () => {
    let convertCalls = 0;
    const app = appWith(
      fakeConverter({
        convert: async () => {
          convertCalls += 1;
          return convertResult();
        },
      }),
    );
    const headers = await loginHeaders(app);
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]).toString("base64");
    const res = await app.inject({
      method: "POST",
      url: "/api/capture/slides",
      headers,
      payload: { data: jpeg },
    });
    expect(res.statusCode).toBe(400);
    expect((res.json() as { message: string }).message).toContain("ZIP-Signatur");
    expect(convertCalls).toBe(0);
  });
});

describe("WP-D11b Blocker 2: die ehrlichen Deckel-Zähler reisen in der Antwort mit", () => {
  it("converted/droppedOversize/droppedByBudget/truncatedByBudget werden durchgereicht", async () => {
    const app = appWith(
      fakeConverter({
        convert: async () =>
          convertResult({
            pngs: [Buffer.from("folie-1")],
            droppedOversize: 2,
            droppedByBudget: 1,
            truncatedByBudget: true,
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
      converted: number;
      droppedOversize: number;
      droppedByBudget: number;
      truncatedByBudget: boolean;
      slideCount: number;
    };
    expect(body.converted).toBe(1);
    expect(body.slideCount).toBe(1);
    expect(body.droppedOversize).toBe(2);
    expect(body.droppedByBudget).toBe(1);
    expect(body.truncatedByBudget).toBe(true);
  });
});
