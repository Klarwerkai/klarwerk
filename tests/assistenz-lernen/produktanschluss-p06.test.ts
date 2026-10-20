// Ergänzende Server-Gegenprobe zum BPA06-G03-Anschluss an den bestehenden P06-Lern-/Routinenweg.
// /api/me/vormachen stammt aus P06/baba0bbba51c; kein neu erfundener Endpunkt.
// Nur fiktive Konten und In-Memory-Dienste; kein Modell oder tatsächlicher Word-/Finderhost.
//
// ERWARTUNG BIS ZUR ZUSAMMENFÜHRUNG: P06 (baba0bbba51c bzw. d680a62f) liegt nur auf dem Zweig
// codex/auftrag-656fd83e41028856f8ff und ist weder in diesem Auftragszweig noch im Hauptstand.
// Der zweite Fall ist deshalb hier ROT (404 statt 201) — das ist der belegte offene Anschluss,
// kein Testfehler. Der Sollwert bleibt 201.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

let app: ReturnType<typeof buildApp>;
let headers: { authorization: string };

beforeEach(async () => {
  const services = buildServices();
  app = buildApp(services);
  await app.ready();
  await services.auth.register({
    name: "Fiktive Lernprobe",
    email: "bpa06-integration@fiction.test",
    password: "FiktivPass12345",
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "bpa06-integration@fiction.test", password: "FiktivPass12345" },
  });
  expect(login.statusCode, login.body).toBe(200);
  headers = { authorization: `Bearer ${login.json().token as string}` };
});

afterEach(async () => {
  await app.close();
});

describe("BPA06 · bestehender persönlicher Produktweg statt unverbundener Kernlogik", () => {
  it("Kalibrierung: fiktives eigenes Konto ist im bestehenden Produkt angemeldet", async () => {
    const me = await app.inject({ method: "GET", url: "/api/auth/me", headers });
    expect(me.statusCode, me.body).toBe(200);
  });

  it("P06-Anschluss: der bestehende Lernauftrag wird am Server begonnen und als eigener Stand wieder gelesen", async () => {
    const start = await app.inject({
      method: "POST",
      url: "/api/me/vormachen",
      headers,
      payload: {
        host: "klarwerk_web",
        vorgaenge: ["entwurf_anlegen", "zur_pruefung_einreichen"],
        zweck: "Fiktiven Wochenbericht vorbereiten",
      },
    });
    expect(start.statusCode, `Der vorhandene P06-Produktanschluss fehlt: ${start.body}`).toBe(201);
    const id = start.json().sitzung.id as string;
    expect(id).toBeTypeOf("string");
    const rueck = await app.inject({ method: "GET", url: "/api/me/vormachen", headers });
    expect(rueck.statusCode, rueck.body).toBe(200);
    expect((rueck.json().sitzungen as { id: string }[]).some((s) => s.id === id)).toBe(true);
  });
});
