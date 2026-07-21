// WP-REST18 (bens Fix 3, ROT — Aktivierungsvoraussetzung der Folien-Route): Client-Abbrüche dürfen
// den EINEN Konvertierungs-Slot nie dauerhaft belegen. Getestet mit ECHTEN Socket-Abbrüchen gegen
// eine lauschende Instanz: (a) Abbruch mitten im Body NACH dem Claim → onRequestAbort gibt frei;
// (b) Abbruch WÄHREND des asynchronen Auth-Await → der tote Request claimt NICHT nachträglich;
// (c) WP-SHIP8-FIX (bens F5, ersetzt den früheren Freigabe-Test): der Lease-Watchdog löst bei
// Ablauf einen ECHTEN Abbruch aus (AbortSignal an den Konverter) und gibt den Slot ERST frei,
// nachdem das Job-Promise wirklich gesettelt ist — vorher bewies der Test die (falsche)
// Sofort-Freigabe, unter der ZWEI Konverter parallel laufen konnten.
import { connect } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { SLIDES_SLOT_LEASE_MS } from "../../services/app/src/routes/slides-routes";
import type { SlideConvertResult, SlideConverter } from "../../services/app/src/slide-converter";

beforeEach(() => {
  process.env.KLARWERK_SLIDES_ENABLED = "1";
});
afterEach(() => {
  delete process.env.KLARWERK_SLIDES_ENABLED;
});

function convertResult(): SlideConvertResult {
  return {
    pngs: [Buffer.from("folie-1")],
    truncated: false,
    droppedOversize: 0,
    droppedByBudget: 0,
    truncatedByBudget: false,
  };
}

function fakeConverter(overrides: Partial<SlideConverter> = {}): SlideConverter {
  return {
    available: async () => true,
    convert: async () => convertResult(),
    ...overrides,
  };
}

const SMALL_PPTX = Buffer.from("PK\x03\x04-fake").toString("base64");

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
  const token = (login.json() as { token: string }).token;
  return { app, services, token, headers: { authorization: `Bearer ${token}` } };
}

// Roher HTTP-Request über einen echten Socket, der nach destroyAfterMs HART abgebrochen wird —
// genau der Fall, den inject() nicht abbilden kann.
function abortingRequest(
  port: number,
  token: string,
  opts: { contentLength: number; bodyChunk: string; destroyAfterMs: number },
): Promise<void> {
  return new Promise((resolve) => {
    const socket = connect(port, "127.0.0.1", () => {
      const head = [
        "POST /api/capture/slides HTTP/1.1",
        "Host: 127.0.0.1",
        `Authorization: Bearer ${token}`,
        "Content-Type: application/json",
        `Content-Length: ${opts.contentLength}`,
        "",
        "",
      ].join("\r\n");
      socket.write(`${head}${opts.bodyChunk}`);
      setTimeout(() => {
        socket.destroy();
        // Dem Server einen Moment geben, den Abbruch zu verarbeiten.
        setTimeout(resolve, 150);
      }, opts.destroyAfterMs);
    });
    socket.on("error", () => resolve());
  });
}

describe("WP-REST18 Fix 3: Socket-Abbrüche geben den Folien-Slot frei", () => {
  it("(a) Abbruch MITTEN IM BODY nach dem Claim → onRequestAbort gibt frei, der Folge-Request konvertiert", async () => {
    const { app, token, headers } = await appWithLogin(fakeConverter());
    await app.listen({ port: 0, host: "127.0.0.1" });
    try {
      const { port } = app.server.address() as { port: number };
      // Headers komplett (Claim passiert), Body nur angefangen (Parser wartet) → dann Abbruch.
      await abortingRequest(port, token, {
        contentLength: 1_000_000,
        bodyChunk: `{"data":"${"A".repeat(500)}`,
        destroyAfterMs: 150,
      });
      // Ohne die onRequestAbort-Freigabe bliebe running=true → hier käme 429 CONVERSION_BUSY.
      const follow = await app.inject({
        method: "POST",
        url: "/api/capture/slides",
        headers,
        payload: { data: SMALL_PPTX },
      });
      expect(follow.statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });

  it("(b) Abbruch WÄHREND des Auth-Await → KEIN nachträglicher Claim, der Folge-Request kommt durch", async () => {
    const { app, services, token, headers } = await appWithLogin(fakeConverter());
    // Den NÄCHSTEN Auth-Check künstlich verzögern — der Abbruch passiert genau in diesem Fenster.
    const realAuthenticate = services.auth.authenticate.bind(services.auth);
    let delayNext = true;
    services.auth.authenticate = async (sessionToken: string) => {
      if (delayNext) {
        delayNext = false;
        await new Promise((r) => setTimeout(r, 300));
      }
      return realAuthenticate(sessionToken);
    };
    await app.listen({ port: 0, host: "127.0.0.1" });
    try {
      const { port } = app.server.address() as { port: number };
      // Voller kleiner Body, Abbruch nach 50 ms — mitten im 300-ms-Auth-Await, VOR jedem Claim.
      const body = JSON.stringify({ data: SMALL_PPTX });
      await abortingRequest(port, token, {
        contentLength: Buffer.byteLength(body),
        bodyChunk: body,
        destroyAfterMs: 50,
      });
      // Auth-Await zu Ende laufen lassen — der tote Request darf danach NICHT geclaimt haben.
      await new Promise((r) => setTimeout(r, 400));
      const follow = await app.inject({
        method: "POST",
        url: "/api/capture/slides",
        headers,
        payload: { data: SMALL_PPTX },
      });
      expect(follow.statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });

  // WP-SAMMEL21-FIX (bens Fix 2, ROT): der Client-90-s-Abort feuert onRequestAbort — vorher gab
  // der den Slot SOFORT frei, während LibreOffice weiterlief (zwei Konverter parallel möglich).
  // Jetzt läuft JEDER Freigabepfad durch die gemeinsame Release-Routine: erst Abbruch (Signal),
  // dann Settlement abwarten, DANN frei.
  it("(d) Socket-Abbruch WÄHREND eines aktiven convert() → Slot bleibt bis zum Settlement belegt (429), danach frei (200)", async () => {
    let calls = 0;
    let firstSignal: AbortSignal | undefined;
    let settleFirst: ((err: Error) => void) | null = null;
    const { app, token, headers } = await appWithLogin(
      fakeConverter({
        convert: (_pptx, opts) => {
          calls += 1;
          if (calls === 1) {
            firstSignal = opts?.signal;
            // Bleibt aktiv, bis der TEST das Settlement auslöst (simuliert den laufenden Konverter).
            return new Promise<SlideConvertResult>((_resolve, reject) => {
              settleFirst = reject;
            });
          }
          return Promise.resolve(convertResult());
        },
      }),
    );
    await app.listen({ port: 0, host: "127.0.0.1" });
    try {
      const { port } = app.server.address() as { port: number };
      // Vollständigen Request über einen ECHTEN Socket senden; zerstört wird er ERST, wenn der
      // Konverter nachweislich läuft (genau bens Fenster: Abort mitten im convert()).
      const body = JSON.stringify({ data: SMALL_PPTX });
      const socket = connect(port, "127.0.0.1", () => {
        const head = [
          "POST /api/capture/slides HTTP/1.1",
          "Host: 127.0.0.1",
          `Authorization: Bearer ${token}`,
          "Content-Type: application/json",
          `Content-Length: ${Buffer.byteLength(body)}`,
          "",
          "",
        ].join("\r\n");
        socket.write(`${head}${body}`);
      });
      for (let i = 0; i < 200 && calls === 0; i++) {
        await new Promise((r) => setTimeout(r, 10));
      }
      expect(calls).toBe(1);
      socket.destroy();
      await new Promise((r) => setTimeout(r, 200));
      // Der Socket-Close-Wächter (Fastifys onRequestAbort feuert bei komplettem Body nachweislich
      // NICHT) hat über die gemeinsame Release-Routine den ABBRUCH ausgelöst …
      expect(firstSignal?.aborted).toBe(true);
      // … gibt den Slot aber NICHT frei, solange der Konverter-Job nicht gesettelt ist.
      const blocked = await app.inject({
        method: "POST",
        url: "/api/capture/slides",
        headers,
        payload: { data: SMALL_PPTX },
      });
      expect(blocked.statusCode).toBe(429);
      // Settlement (der Kill wirkt) → ERST JETZT wird der Slot frei.
      (settleFirst as unknown as (err: Error) => void)(new Error("Prozessgruppe beendet"));
      await new Promise((r) => setTimeout(r, 100));
      const after = await app.inject({
        method: "POST",
        url: "/api/capture/slides",
        headers,
        payload: { data: SMALL_PPTX },
      });
      expect(after.statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });

  it("(c) Lease mit ECHTER Cancellation: WEITER 429 solange der Job nicht abgebrochen/gesettelt ist — erst danach 200", async () => {
    const warnSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    let calls = 0;
    let firstSignal: AbortSignal | undefined;
    let settleFirst: ((err: Error) => void) | null = null;
    // App-Aufbau + Login mit ECHTEN Timern (Fastify/avvio nutzen setImmediate/nextTick) — erst
    // danach werden GEZIELT nur setTimeout/Date gefaked (das reicht für Lease-Timer + Rate-Fenster).
    const { app, headers } = await appWithLogin(
      fakeConverter({
        convert: (_pptx, opts) => {
          calls += 1;
          if (calls === 1) {
            // Der ERSTE Lauf bleibt aktiv, bis der TEST das Settlement auslöst — das Abort-Signal
            // wird festgehalten, um den vom Watchdog ausgelösten Abbruch nachzuweisen.
            firstSignal = opts?.signal;
            return new Promise<SlideConvertResult>((_resolve, reject) => {
              settleFirst = reject;
            });
          }
          return Promise.resolve(convertResult());
        },
      }),
    );
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    try {
      const stuck = app.inject({
        method: "POST",
        url: "/api/capture/slides",
        headers,
        payload: { data: SMALL_PPTX },
      });
      // Claim + Konverter-Start abwarten (Mikro-/Makrotasks laufen mit echten setImmediate).
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setImmediate(r));
      }
      // Der Slot ist belegt — ein zweiter Request wird ehrlich abgewiesen.
      const blocked = await app.inject({
        method: "POST",
        url: "/api/capture/slides",
        headers,
        payload: { data: SMALL_PPTX },
      });
      expect(blocked.statusCode).toBe(429);
      // Lease abgelaufen → der Watchdog löst den ABBRUCH aus …
      await vi.advanceTimersByTimeAsync(SLIDES_SLOT_LEASE_MS + 1_000);
      expect(firstSignal?.aborted).toBe(true);
      // … gibt den Slot aber NICHT frei, solange der Konverter-Job nicht wirklich beendet ist:
      // ein weiterer Request bekommt WEITERHIN 429 (nie zwei Konverter parallel).
      const stillBlocked = await app.inject({
        method: "POST",
        url: "/api/capture/slides",
        headers,
        payload: { data: SMALL_PPTX },
      });
      expect(stillBlocked.statusCode).toBe(429);
      // Der Kill wirkt: das Job-Promise settelt → der hängende Request endet ehrlich mit 500 …
      (settleFirst as unknown as (err: Error) => void)(
        new Error("Prozessgruppe nach Abbruch beendet"),
      );
      const stuckRes = await stuck;
      expect(stuckRes.statusCode).toBe(500);
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setImmediate(r));
      }
      // … und ERST JETZT ist der Slot frei: der nächste Request konvertiert.
      const after = await app.inject({
        method: "POST",
        url: "/api/capture/slides",
        headers,
        payload: { data: SMALL_PPTX },
      });
      expect(after.statusCode).toBe(200);
    } finally {
      warnSpy.mockRestore();
      vi.useRealTimers();
    }
  });
});
