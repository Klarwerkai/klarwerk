import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "./build-app";
import { type FactoryReset, FirmenresetFehler } from "./factory-reset";

// SCRUM-181: admin-geschützte Demo-Seed-Route.
describe("SCRUM-181: POST /api/admin/demo-seed", () => {
  async function adminApp() {
    const app = buildApp(buildServices());
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "a@x.de", password: "secret123" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "a@x.de", password: "secret123" },
    });
    return { app, headers: { authorization: `Bearer ${login.json().token}` } };
  }

  it("anonym → kein 200 (Guard greift)", async () => {
    const app = buildApp(buildServices());
    const res = await app.inject({ method: "POST", url: "/api/admin/demo-seed" });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  it("Admin auf leerer Instanz → seeded; zweiter Lauf → skipped (idempotent)", async () => {
    const { app, headers } = await adminApp();

    const first = await app.inject({ method: "POST", url: "/api/admin/demo-seed", headers });
    expect(first.statusCode).toBe(200);
    const r1 = first.json();
    expect(r1.skipped).toBe(false);
    expect(r1.kos).toBeGreaterThanOrEqual(5);
    expect(r1.validated).toBeGreaterThanOrEqual(1);

    // Bestand ist jetzt sichtbar.
    const kos = await app.inject({ method: "GET", url: "/api/kos", headers });
    expect(kos.json().length).toBeGreaterThanOrEqual(5);

    // Zweiter Lauf: Wissensbasis nicht leer → ehrlich übersprungen, keine Duplikate.
    const before = kos.json().length;
    const second = await app.inject({ method: "POST", url: "/api/admin/demo-seed", headers });
    expect(second.json().skipped).toBe(true);
    const after = await app.inject({ method: "GET", url: "/api/kos", headers });
    expect(after.json().length).toBe(before);
  });

  // Pedi 05.07. (Beta): force lädt das Demo-Set auch bei bereits vorhandenen Daten.
  it("Pedi 05.07.: force lädt Demo-Set trotz vorhandener Daten (skipped=false)", async () => {
    const { app, headers } = await adminApp();
    // Erst regulär seeden (leere Instanz → geladen).
    const first = await app.inject({ method: "POST", url: "/api/admin/demo-seed", headers });
    expect(first.json().skipped).toBe(false);
    // Ohne force: übersprungen (Instanz nicht mehr leer).
    const skip = await app.inject({ method: "POST", url: "/api/admin/demo-seed", headers });
    expect(skip.json().skipped).toBe(true);
    // Mit force: erneut geladen — keine Verdopplung des Demo-Sets.
    const beforeForce = (await app.inject({ method: "GET", url: "/api/kos", headers })).json()
      .length;
    const forced = await app.inject({
      method: "POST",
      url: "/api/admin/demo-seed",
      headers,
      payload: { force: true },
    });
    expect(forced.json().skipped).toBe(false);
    const afterForce = (await app.inject({ method: "GET", url: "/api/kos", headers })).json()
      .length;
    expect(afterForce).toBe(beforeForce);
  });

  // SCRUM-217/218: nach dem Demo-Seed sind Lernpfade für die relevanten Rollen sichtbar (kein
  // 404 mehr) — inkl. der controller+-gesicherten Lifecycle-Seite (controller/admin).
  it("nach Demo-Seed: learning-paths für experte/controller/admin = 200 mit Schritten", async () => {
    const { app, headers } = await adminApp();
    await app.inject({ method: "POST", url: "/api/admin/demo-seed", headers });

    for (const role of ["experte", "controller", "admin"]) {
      const path = await app.inject({
        method: "GET",
        url: `/api/learning-paths/${role}`,
        headers,
      });
      expect(path.statusCode).toBe(200);
      const body = path.json();
      expect(body.role).toBe(role);
      expect(body.steps.length).toBeGreaterThanOrEqual(1);
    }

    // Rolle ohne Seed-Pfad bleibt bewusst 404 (FE zeigt dort die Leer-Karte).
    const viewer = await app.inject({
      method: "GET",
      url: "/api/learning-paths/viewer",
      headers,
    });
    expect(viewer.statusCode).toBe(404);
  });
});

// Pedi 05.07. (Beta): Werksreset — nur im Desktop/Dev-Modus verfügbar, doppelt geschützt (Guard +
// Verfügbarkeitsflag). Der eigentliche Prozess-Abbruch wird über die injizierte Fähigkeit getestet
// (kein echtes process.exit im Test).
describe("Pedi 05.07.: /api/admin/factory-reset", () => {
  // P08: die Fähigkeit trägt eine Vorschau mit Kennung; die Ausführung verlangt sie zurück.
  const KENNUNG = "k-p08";
  function faehigkeit(onRun: () => void): FactoryReset {
    return {
      available: true,
      vorschau: async () => ({
        kennung: KENNUNG,
        entfernt: { drafts: 1 },
        erhalten: { users: 1 },
      }),
      run: async () => {
        onRun();
      },
    };
  }
  const vollstaendig = {
    kennung: KENNUNG,
    bestaetigt: true,
    passwort1: "secret123",
    passwort2: "secret123",
  };

  async function adminApp(factoryReset?: FactoryReset) {
    const app = buildApp(buildServices(), factoryReset ? { factoryReset } : {});
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "a@x.de", password: "secret123" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "a@x.de", password: "secret123" },
    });
    return { app, headers: { authorization: `Bearer ${login.json().token}` } };
  }

  it("anonym → Guard greift (kein 200)", async () => {
    const app = buildApp(buildServices());
    const res = await app.inject({ method: "POST", url: "/api/admin/factory-reset" });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  it("ohne Fähigkeit (Produktion/In-Memory) → nicht verfügbar, POST = 403", async () => {
    const { app, headers } = await adminApp();
    const status = await app.inject({
      method: "GET",
      url: "/api/admin/factory-reset",
      headers,
    });
    expect(status.statusCode).toBe(200);
    expect(status.json().available).toBe(false);

    const post = await app.inject({ method: "POST", url: "/api/admin/factory-reset", headers });
    expect(post.statusCode).toBe(403);
  });

  it("mit Fähigkeit + vollständiger Bestätigung → verfügbar mit Vorschau, POST löst den Reset aus", async () => {
    let ran = false;
    const { app, headers } = await adminApp(
      faehigkeit(() => {
        ran = true;
      }),
    );
    const status = await app.inject({
      method: "GET",
      url: "/api/admin/factory-reset",
      headers,
    });
    expect(status.json().available).toBe(true);
    expect(status.json().vorschau.kennung).toBe(KENNUNG);
    expect(status.json().vorschau.erhalten.benutzerkonten).toBe(1);

    const post = await app.inject({
      method: "POST",
      url: "/api/admin/factory-reset",
      headers,
      payload: vollstaendig,
    });
    expect(post.statusCode).toBe(200);
    expect(post.json().ok).toBe(true);
    // Die Fähigkeit wurde angestoßen (der echte Prozess-Abbruch ist bewusst nicht Teil des Tests).
    expect(ran).toBe(true);
  });

  // SCRUM-450 / P08-AC05: Re-Authentifizierung, zweimal. Ein falsches Passwort — gleich an welcher
  // Stelle — darf den unwiderruflichen Reset NIE auslösen.
  it("mit Fähigkeit, aber falschem erstem oder zweitem Passwort → 401 und Reset NICHT ausgelöst", async () => {
    let ran = false;
    const { app, headers } = await adminApp(
      faehigkeit(() => {
        ran = true;
      }),
    );
    for (const payload of [
      { ...vollstaendig, passwort1: "voellig-falsch" },
      { ...vollstaendig, passwort2: "voellig-falsch" },
    ]) {
      const post = await app.inject({
        method: "POST",
        url: "/api/admin/factory-reset",
        headers,
        payload,
      });
      expect(post.statusCode).toBe(401);
    }
    expect(ran).toBe(false);
  });

  // SCRUM-450: fehlendes Passwort wird ebenso abgelehnt (kein „nur angemeldet reicht").
  it("mit Fähigkeit, aber ohne Passwort → 401 und Reset NICHT ausgelöst", async () => {
    let ran = false;
    const { app, headers } = await adminApp(
      faehigkeit(() => {
        ran = true;
      }),
    );
    const post = await app.inject({
      method: "POST",
      url: "/api/admin/factory-reset",
      headers,
      payload: { kennung: KENNUNG, bestaetigt: true },
    });
    expect(post.statusCode).toBe(401);
    expect(ran).toBe(false);
  });

  // P08-AC04: ohne bewusst gesetzte Checkbox kein Reset — auch mit richtigen Passwörtern.
  it("mit Fähigkeit, aber ohne Bestätigung der Folgen → 400 und Reset NICHT ausgelöst", async () => {
    let ran = false;
    const { app, headers } = await adminApp(
      faehigkeit(() => {
        ran = true;
      }),
    );
    const post = await app.inject({
      method: "POST",
      url: "/api/admin/factory-reset",
      headers,
      payload: { ...vollstaendig, bestaetigt: "ja" },
    });
    expect(post.statusCode).toBe(400);
    expect(post.json().error).toBe("BESTAETIGUNG_FEHLT");
    expect(ran).toBe(false);
  });

  // P08-AC07: meldet die Fähigkeit eine veraltete Vorschau, antwortet die Route 409 mit dem Code.
  it("veraltete Vorschau → 409 VORSCHAU_VERALTET", async () => {
    const reset = faehigkeit(() => undefined);
    const { app, headers } = await adminApp({
      ...reset,
      run: async () => {
        throw new FirmenresetFehler("VORSCHAU_VERALTET", "Der Bestand hat sich geändert.");
      },
    });
    const post = await app.inject({
      method: "POST",
      url: "/api/admin/factory-reset",
      headers,
      payload: vollstaendig,
    });
    expect(post.statusCode).toBe(409);
    expect(post.json().error).toBe("VORSCHAU_VERALTET");
  });
});
