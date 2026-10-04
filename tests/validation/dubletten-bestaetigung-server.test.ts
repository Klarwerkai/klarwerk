// ================================================================================================
// R-0247 — OFFENE DUBLETTE: DER SERVER VERLANGT DAS BESTÄTIGUNGSKENNZEICHEN.
// ================================================================================================
//
// Pedis Entscheidung 73b53301 (weiche Sperre). Gefahren wird über die ECHTEN Routen
// (`PUT /api/kos/:id`, KO-Dispatcher → `dublettenTor` aus validation-routes.ts), mit dem
// In-Memory-Aufbau aus `buildServices()`. Die Dublette wird über `overlaps.createAuto` angelegt —
// derselbe Weg, den die automatische Erkennung nimmt —, damit der Fall nicht vom Ähnlichkeitsmaß
// abhängt.
//
//   S1 (K1) ohne offene Dublette: `rate up` ohne Kennzeichen → 200, kein Bestätigungsbeleg.
//   S2 (K3) offene Dublette ohne Kennzeichen → 409 DUPLICATE_ACK_REQUIRED, nichts validiert.
//   S3 (K3) mit Kennzeichen → 200 validiert; Audit `ko.duplicate-acknowledged` mit Person und Zeit,
//           VOR der Bewertung; die Dublette bleibt offen (keine automatische Auflösung).
//   S4 (K3) `admin-validate`: dasselbe Tor.
//   S5 (K3) nur genau `true` gilt als Kennzeichen.
//   S6 (K4) eine entschiedene (geschlossene) Dublette verlangt nichts.
//   S7       Rückfrage/Ablehnung sind keine Validierung und fragen nichts.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;

async function aufbau() {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "r0247@example.test", password: "r0247-test-kennwort" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "r0247@example.test", password: "r0247-test-kennwort" },
  });
  expect(login.statusCode).toBe(200);
  const headers = { authorization: `Bearer ${login.json().token}` };
  const me = await app.inject({ method: "GET", url: "/api/auth/me", headers });
  const userId = me.json().id as string;
  return { services, app, headers, userId };
}

async function anlegen(
  app: App,
  headers: Record<string, string>,
  title: string,
  statement: string,
): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers,
    payload: {
      confidentiality: "intern",
      title,
      statement,
      type: "best_practice",
      category: "Instandhaltung",
      neededValidations: 1,
    },
  });
  expect(res.statusCode).toBe(201);
  return res.json().id as string;
}

/** Zwei Objekte mit verschiedenem Inhalt und EINE offene Dublette zwischen ihnen. */
async function mitOffenerDublette() {
  const basis = await aufbau();
  const a = await anlegen(
    basis.app,
    basis.headers,
    "Hydraulikpresse P4 entlüften",
    "Vor dem Wechsel des Filters an Presse P4 den Restdruck über Ventil V2 ablassen.",
  );
  const b = await anlegen(
    basis.app,
    basis.headers,
    "Kühlmittel Fräse F1 prüfen",
    "Die Konzentration des Kühlschmierstoffs an Fräse F1 wöchentlich mit dem Refraktometer messen.",
  );
  const dublette = await basis.services.overlaps.createAuto(
    {
      koA: a,
      koB: b,
      relation: "identisch",
      aspects: [{ beschreibung: "gleiche Anweisung", zitatA: "ablassen", zitatB: "messen" }],
      eigenanteilA: "",
      eigenanteilB: "",
      recommendation: "zusammenfuehren",
    },
    { trigger: "manual", method: "deterministic", lexicalScore: 0.95 },
    "system",
  );
  return { ...basis, a, b, dublette };
}

const put = (app: App, headers: Record<string, string>, id: string, payload: object) =>
  app.inject({ method: "PUT", url: `/api/kos/${id}`, headers, payload });

describe("R-0247 · S1 (K1): ohne offene Dublette ändert sich am Validieren nichts", () => {
  it("`rate up` ohne Kennzeichen → 200 validiert, kein Bestätigungsbeleg", async () => {
    const { app, headers, services } = await aufbau();
    const id = await anlegen(app, headers, "Einzelstück", "Ein Eintrag ohne jede Dublette.");
    expect(await services.overlaps.unresolved()).toEqual([]);

    const res = await put(app, headers, id, { action: "rate", verdict: "up" });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("validiert");
    expect(await services.audit.list({ action: "ko.duplicate-acknowledged" })).toEqual([]);
  });

  it("`admin-validate` ohne Kennzeichen → 200, kein Bestätigungsbeleg", async () => {
    const { app, headers, services } = await aufbau();
    const id = await anlegen(app, headers, "Einzelstück B", "Noch ein Eintrag ohne Dublette.");
    const res = await put(app, headers, id, { action: "admin-validate" });
    expect(res.statusCode).toBe(200);
    expect(await services.audit.list({ action: "ko.duplicate-acknowledged" })).toEqual([]);
  });
});

describe("R-0247 · S2 (K3): offene Dublette ohne Kennzeichen wird abgelehnt", () => {
  it("`rate up` → 409 mit verständlicher Meldung; das Objekt bleibt offen und ohne Stimme", async () => {
    const { app, headers, services, a } = await mitOffenerDublette();
    const res = await put(app, headers, a, { action: "rate", verdict: "up" });

    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("DUPLICATE_ACK_REQUIRED");
    expect(res.json().message).toContain("offene Dublette");
    expect(res.json().message).toContain("nichts validiert");

    const ko = await app.inject({ method: "GET", url: `/api/kos/${a}`, headers });
    expect(ko.json().status).toBe("offen");
    expect(await services.audit.list({ action: "ko.rated", target: a })).toEqual([]);
    expect(await services.audit.list({ action: "ko.duplicate-acknowledged" })).toEqual([]);
  });

  it("gilt für BEIDE Seiten der Dublette", async () => {
    const { app, headers, b } = await mitOffenerDublette();
    const res = await put(app, headers, b, { action: "rate", verdict: "up" });
    expect(res.statusCode).toBe(409);
  });
});

describe("R-0247 · S3 (K3): mit Kennzeichen wird validiert und im Audit festgehalten", () => {
  it("200 validiert; Beleg mit Person und Zeit VOR der Bewertung; Dublette bleibt offen", async () => {
    const { app, headers, services, userId, a, dublette } = await mitOffenerDublette();
    const res = await put(app, headers, a, {
      action: "rate",
      verdict: "up",
      duplicateAcknowledged: true,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("validiert");

    const belege = await services.audit.list({ action: "ko.duplicate-acknowledged" });
    expect(belege).toHaveLength(1);
    const beleg = belege[0];
    expect(beleg?.actor).toBe(userId);
    expect(beleg?.target).toBe(a);
    expect(Number.isNaN(Date.parse(String(beleg?.at)))).toBe(false);
    expect(beleg?.payload).toMatchObject({ overlapIds: [dublette.id], weg: "rate" });

    const bewertung = (await services.audit.list({ action: "ko.rated", target: a }))[0];
    expect(bewertung, "die Bewertung fehlt im Audit").toBeDefined();
    expect((beleg?.seq ?? 0) < (bewertung?.seq ?? 0)).toBe(true);

    // Keine automatische Auflösung der Dublette.
    expect((await services.overlaps.unresolved()).map((e) => e.id)).toContain(dublette.id);
  });
});

describe("R-0247 · S4 (K3): der Administratorweg trägt dasselbe Tor", () => {
  it("`admin-validate` ohne Kennzeichen → 409; mit Kennzeichen → 200 und Beleg", async () => {
    const { app, headers, services, userId, a } = await mitOffenerDublette();
    const ohne = await put(app, headers, a, { action: "admin-validate" });
    expect(ohne.statusCode).toBe(409);
    expect(ohne.json().error).toBe("DUPLICATE_ACK_REQUIRED");

    const mit = await put(app, headers, a, {
      action: "admin-validate",
      duplicateAcknowledged: true,
    });
    expect(mit.statusCode).toBe(200);
    const belege = await services.audit.list({ action: "ko.duplicate-acknowledged" });
    expect(belege).toHaveLength(1);
    expect(belege[0]?.actor).toBe(userId);
    expect(belege[0]?.payload).toMatchObject({ weg: "admin-validate" });
  });
});

describe("R-0247 · S5 (K3): nur genau `true` ist ein Kennzeichen", () => {
  for (const wert of ["true", 1, "ja", null]) {
    it(`duplicateAcknowledged: ${JSON.stringify(wert)} → 409`, async () => {
      const { app, headers, a } = await mitOffenerDublette();
      const res = await put(app, headers, a, {
        action: "rate",
        verdict: "up",
        duplicateAcknowledged: wert,
      });
      expect(res.statusCode).toBe(409);
    });
  }
});

describe("R-0247 · S6 (K4): eine entschiedene Dublette verlangt keine Bestätigung", () => {
  it("nach „Fehlalarm“ (geschlossen) → `rate up` ohne Kennzeichen 200, kein Beleg", async () => {
    const { app, headers, services, a, dublette, userId } = await mitOffenerDublette();
    await services.overlaps.dismiss(dublette.id, userId, "kein Duplikat");
    expect((await services.overlaps.get(dublette.id))?.status).toBe("geschlossen");

    const res = await put(app, headers, a, { action: "rate", verdict: "up" });
    expect(res.statusCode).toBe(200);
    expect(await services.audit.list({ action: "ko.duplicate-acknowledged" })).toEqual([]);
  });
});

describe("R-0247 · S7: Rückfrage und Ablehnung sind keine Validierung", () => {
  for (const verdict of ["warn", "down"] as const) {
    it(`\`rate ${verdict}\` mit offener Dublette → kein 409`, async () => {
      const { app, headers, a } = await mitOffenerDublette();
      const res = await put(app, headers, a, { action: "rate", verdict });
      expect(res.statusCode).toBe(200);
    });
  }
});
