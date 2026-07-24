import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { signAnswerReceipt } from "../../services/ask";

// FUNKE-FIX2 P0 (bens Blocker 2): HTTP-Negativbelege für den Answer-Receipt am ECHTEN Endpunkt
// (POST /api/ask/helpful). Bisher waren nur „kein Receipt" und „fremdes KO" am HTTP gepinnt, der
// fremde Actor nur im Service-Unit-Test. Hier werden manipulierter, abgelaufener UND an einen fremden
// Actor weitergereichter Receipt je auf 403 festgeschrieben. Ein festes, validiertes ENV-Secret macht
// den Beleg reproduzierbar (der Server nimmt exakt dieses Secret) — so lassen sich abgelaufene/gültige
// Belege deterministisch signieren, ohne die Systemuhr zu manipulieren.

// 64 Hex-Ziffern = 32 Bytes → erfüllt parseConfiguredReceiptSecret (≥ 32 Bytes). FUNKE-FIX3: der
// Wert muss zudem NICHT-repetitiv sein (32 verschiedene Bytes 00…1f) — triviale Wiederholung wird
// vom gehärteten Parser bewusst abgewiesen.
const SECRET_HEX = Buffer.from(Array.from({ length: 32 }, (_, i) => i)).toString("hex");
const SECRET = Buffer.from(SECRET_HEX, "hex");

describe("FUNKE-FIX2 P0 (bens Blocker 2): Receipt-Negativbelege am echten HTTP-Endpunkt → 403", () => {
  let prevSecret: string | undefined;

  beforeAll(() => {
    prevSecret = process.env.KLARWERK_ASK_RECEIPT_SECRET;
    process.env.KLARWERK_ASK_RECEIPT_SECRET = SECRET_HEX;
  });

  afterAll(() => {
    if (prevSecret === undefined) {
      process.env.KLARWERK_ASK_RECEIPT_SECRET = undefined;
      delete process.env.KLARWERK_ASK_RECEIPT_SECRET;
    } else {
      process.env.KLARWERK_ASK_RECEIPT_SECRET = prevSecret;
    }
  });

  async function setup() {
    const services = buildServices();
    const app = buildApp(services);
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Anna", email: "anna@x.de", password: "secret123" },
    });
    const annaLogin = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "anna@x.de", password: "secret123" },
    });
    const anna = {
      headers: { authorization: `Bearer ${annaLogin.json().token}` },
      id: annaLogin.json().user.id as string,
    };
    await app.inject({
      method: "POST",
      url: "/api/users",
      headers: anna.headers,
      payload: { name: "Vera", email: "vera@x.de", password: "secret123", role: "viewer" },
    });
    const veraLogin = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "vera@x.de", password: "secret123" },
    });
    const vera = {
      headers: { authorization: `Bearer ${veraLogin.json().token}` },
      id: veraLogin.json().user.id as string,
    };
    const ko = await services.ko.create({
      title: "Pumpe entlüften",
      statement: "Vor dem Start entlüften.",
      type: "best_practice",
      category: "Pumpen",
      author: anna.id,
      tags: [],
    });
    return { app, anna, vera, koId: ko.id };
  }

  const helpful = (
    app: Awaited<ReturnType<typeof setup>>["app"],
    headers: Record<string, string>,
    koId: string,
    receipt: string,
  ) => app.inject({ method: "POST", url: "/api/ask/helpful", headers, payload: { koId, receipt } });

  it("manipulierter Receipt (Signatur verfälscht) → 403", async () => {
    const { app, vera, koId } = await setup();
    const valid = signAnswerReceipt(SECRET, vera.id, [koId], Date.now());
    // Letztes Zeichen der Signatur kippen → Signatur passt nicht mehr (timingSafeEqual schlägt fehl).
    const tampered = `${valid.slice(0, -1)}${valid.at(-1) === "A" ? "B" : "A"}`;
    expect(tampered).not.toBe(valid);
    expect((await helpful(app, vera.headers, koId, tampered)).statusCode).toBe(403);
  });

  it("abgelaufener Receipt (gültige Signatur, x in der Vergangenheit) → 403", async () => {
    const { app, vera, koId } = await setup();
    // In der Vergangenheit signiert mit TTL 0 → x liegt vor jetzt → abgelaufen (aber Signatur gültig).
    const expired = signAnswerReceipt(SECRET, vera.id, [koId], Date.now() - 60 * 60 * 1000, 0);
    expect((await helpful(app, vera.headers, koId, expired)).statusCode).toBe(403);
  });

  it("an fremden Actor weitergereichter Receipt (für vera, benutzt von anna) → 403", async () => {
    const { app, anna, vera, koId } = await setup();
    // Gültiger, aktueller Beleg für vera — aber von anna (fremder, authentifizierter Actor) benutzt.
    const veraReceipt = signAnswerReceipt(SECRET, vera.id, [koId], Date.now());
    expect((await helpful(app, anna.headers, koId, veraReceipt)).statusCode).toBe(403);
  });

  it("Gegenprobe: gültiger, aktueller Receipt desselben Actors für dieses KO → 204", async () => {
    const { app, vera, koId } = await setup();
    const valid = signAnswerReceipt(SECRET, vera.id, [koId], Date.now());
    expect((await helpful(app, vera.headers, koId, valid)).statusCode).toBe(204);
  });
});
