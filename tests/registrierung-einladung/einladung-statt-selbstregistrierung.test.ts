// ================================================================================================
// AUFNAHME 20260922 · GESAMT-REGISTRIERUNG — EINLADUNG STATT SELBSTREGISTRIERUNG
// ================================================================================================
//
// R-0527 (jüngere Vorgabe, Ship 8 vom 23.07.2026): „Niemand kann sich selbst ein Konto anlegen. Wer
// keine Einladung hat, wird abgewiesen." Sie löst R-0567 / FR-AUTH-02 (Selbstregistrierung mit
// Freigabe) ab. Die historische Selbstregistrierung wird deshalb NICHT eingeschaltet; ihr Gehalt
// (Name, E-Mail, Passwort ≥ 8; ohne Freigabe kein Zugang) wird am heute erlaubten Weg gemessen.
//
// `tests/security/vip2-gate.test.ts` misst die Absage nur an einer LEEREN Instanz. Diese Datei misst
// sie an einer EINGERICHTETEN — dem Zustand, in dem eine fremde Person tatsächlich vor der Maske
// steht — und daneben den Einladungsweg selbst: der Admin legt das Konto persönlich an
// (`POST /api/users`), und genau dieses Konto kommt herein.
//
// `tests/setup-env.ts` schaltet die Selbstregistrierung für die Suite global EIN. Jeder Fall hier
// läuft deshalb mit LOKAL entferntem Schalter — also im Auslieferungszustand.
import type { FastifyInstance } from "fastify";
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import type { PublicUser } from "../../services/auth/src/types";

const ADMIN = { name: "Verwaltung", email: "admin@x.de", password: "secret123" };

async function ohneSchalter(run: () => Promise<void>): Promise<void> {
  const vorgefunden = process.env.KLARWERK_SELF_REGISTRATION;
  delete process.env.KLARWERK_SELF_REGISTRATION;
  try {
    await run();
  } finally {
    if (vorgefunden !== undefined) {
      process.env.KLARWERK_SELF_REGISTRATION = vorgefunden;
    }
  }
}

/** Eingerichtete Instanz: Ersteinrichtung gelaufen, Admin-Sitzung als Bearer-Kopf. */
async function eingerichtet(): Promise<{
  app: FastifyInstance;
  kopf: { authorization: string };
}> {
  const app = buildApp(buildServices());
  const setup = await app.inject({ method: "POST", url: "/api/auth/setup", payload: ADMIN });
  expect(setup.statusCode, setup.body).toBe(201);
  return { app, kopf: { authorization: `Bearer ${setup.json().token}` } };
}

async function nutzerliste(
  app: FastifyInstance,
  kopf: { authorization: string },
): Promise<PublicUser[]> {
  const antwort = await app.inject({ method: "GET", url: "/api/users", headers: kopf });
  expect(antwort.statusCode, antwort.body).toBe(200);
  return antwort.json() as PublicUser[];
}

function anmelden(app: FastifyInstance, email: string, password: string) {
  return app.inject({ method: "POST", url: "/api/auth/login", payload: { email, password } });
}

describe("R-0527 · ohne Einladung kein Konto — an einer eingerichteten Instanz", () => {
  it("Selbstregistrierung wird abgewiesen, es entsteht kein Konto, die Anmeldung scheitert", async () => {
    await ohneSchalter(async () => {
      const { app, kopf } = await eingerichtet();

      const status = await app.inject({ method: "GET", url: "/api/auth/status" });
      expect(status.json()).toMatchObject({ needsSetup: false, selfRegistrationEnabled: false });

      const versuch = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { name: "Fremd", email: "fremd@x.de", password: "secret123" },
      });
      expect(versuch.statusCode).toBe(403);
      expect(versuch.json()).toMatchObject({ error: "REGISTRATION_DISABLED" });
      expect((versuch.json() as { message: string }).message).toContain("Einladung");

      // Gemessen am Bestand, nicht an der Antwort: nur der Admin steht in der Liste.
      const liste = await nutzerliste(app, kopf);
      expect(liste.map((u) => u.email)).toEqual([ADMIN.email]);
      const anmeldung = await anmelden(app, "fremd@x.de", "secret123");
      expect(anmeldung.statusCode).toBe(401);
    });
  });
});

describe("Einladungsweg · der Admin legt das Konto persönlich an", () => {
  it("Name, E-Mail und Passwort ≥ 8 sind Pflicht; ein abgewiesener Anlageversuch hinterlässt nichts", async () => {
    await ohneSchalter(async () => {
      const { app, kopf } = await eingerichtet();
      const anlegen = (payload: Record<string, unknown>) =>
        app.inject({ method: "POST", url: "/api/users", headers: kopf, payload });

      const ohneName = await anlegen({ name: " ", email: "neu@x.de", password: "secret123" });
      expect(ohneName.statusCode).toBe(400);
      const ohneMail = await anlegen({ name: "Neu", email: "keine-mail", password: "secret123" });
      expect(ohneMail.statusCode).toBe(400);
      const kurz = await anlegen({ name: "Neu", email: "neu@x.de", password: "1234567" });
      expect(kurz.statusCode).toBe(400);
      expect(kurz.json()).toMatchObject({ error: "WEAK_PASSWORD" });

      expect((await nutzerliste(app, kopf)).map((u) => u.email)).toEqual([ADMIN.email]);
    });
  });

  it("das eingeladene Konto ist freigegeben und kommt herein", async () => {
    await ohneSchalter(async () => {
      const { app, kopf } = await eingerichtet();
      const anlage = await app.inject({
        method: "POST",
        url: "/api/users",
        headers: kopf,
        payload: { name: "Eingeladen", email: "eingeladen@x.de", password: "12345678" },
      });
      expect(anlage.statusCode, anlage.body).toBe(201);
      expect(anlage.json()).toMatchObject({ email: "eingeladen@x.de", approved: true });

      const anmeldung = await anmelden(app, "eingeladen@x.de", "12345678");
      expect(anmeldung.statusCode, anmeldung.body).toBe(200);
    });
  });

  it("die Anlage ist dem Admin vorbehalten — eine angemeldete Nicht-Admin-Person lädt niemanden ein", async () => {
    await ohneSchalter(async () => {
      const { app, kopf } = await eingerichtet();
      await app.inject({
        method: "POST",
        url: "/api/users",
        headers: kopf,
        payload: { name: "Kollegin", email: "kollegin@x.de", password: "secret123" },
      });
      const sitzung = (await anmelden(app, "kollegin@x.de", "secret123")).json().token as string;

      const fremdeAnlage = await app.inject({
        method: "POST",
        url: "/api/users",
        headers: { authorization: `Bearer ${sitzung}` },
        payload: { name: "Dritte", email: "dritte@x.de", password: "secret123" },
      });
      expect(fremdeAnlage.statusCode).toBe(403);
      expect((await nutzerliste(app, kopf)).map((u) => u.email).sort()).toEqual(
        [ADMIN.email, "kollegin@x.de"].sort(),
      );
    });
  });
});
