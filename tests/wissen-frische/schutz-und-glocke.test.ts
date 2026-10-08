// ================================================================================================
// aufnahme:20260922:gesamt-wissen-frische · Nacharbeit 2 — AM ECHTEN SERVER (In-Memory-Aufbau).
// ================================================================================================
//
//   R-0652 / FR-EXT-06: der Schutzbedarf „öffentlich" wird gespeichert, angezeigt, führt zur
//            eigenen Betriebsmodell-Empfehlung und bleibt mit der Vertraulichkeit konsistent.
//   R-1635 / R-0266: die Glocke (`GET /api/notifications`) stellt dem Autor die Prüfanforderung
//            nach einer Anlagenänderung zu, und die Wochenvorlage seiner geprüften Beiträge.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
type Kopf = Record<string, string>;

interface Objekt {
  id: string;
  oeffentlich?: true;
  confidentiality?: string;
  frische?: { schutz: string | null; betriebsmodell: string };
}

interface Meldung {
  kind: string;
  koId?: string;
  frischeArt?: string;
}

async function login(app: App, email: string): Promise<Kopf> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "geheim12345" },
  });
  expect(res.statusCode, res.body).toBe(200);
  return { authorization: `Bearer ${(res.json() as { token: string }).token}` };
}

async function aufbau(marke: string) {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: `admin@${marke}.test`, password: "geheim12345" },
  });
  const admin = await login(app, `admin@${marke}.test`);
  const res = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: admin,
    payload: {
      name: "Experte",
      email: `experte@${marke}.test`,
      password: "geheim12345",
      role: "experte",
    },
  });
  expect(res.statusCode, res.body).toBe(201);
  const experte = await login(app, `experte@${marke}.test`);
  return { app, admin, experte };
}

async function anlegen(app: App, headers: Kopf, titel: string, aussage: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers,
    payload: {
      confidentiality: "intern",
      title: titel,
      statement: aussage,
      type: "best_practice",
      category: "Anlage 7",
    },
  });
  expect(res.statusCode, res.body).toBe(201);
  return (res.json() as { id: string }).id;
}

function put(app: App, headers: Kopf, id: string, payload: Record<string, unknown>) {
  return app.inject({ method: "PUT", url: `/api/kos/${id}`, headers, payload });
}

async function lesen(app: App, headers: Kopf, id: string): Promise<Objekt> {
  const res = await app.inject({ method: "GET", url: `/api/kos/${id}`, headers });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as Objekt;
}

async function glocke(app: App, headers: Kopf): Promise<Meldung[]> {
  const res = await app.inject({ method: "GET", url: "/api/notifications", headers });
  expect(res.statusCode, res.body).toBe(200);
  return (res.json() as Meldung[]).filter((m) => m.kind === "frische");
}

describe("R-0652 / FR-EXT-06 · Schutzbedarf „öffentlich“", () => {
  it("wird gespeichert, angezeigt und führt zur eigenen Empfehlung", async () => {
    const { app, admin } = await aufbau("s1");
    const id = await anlegen(app, admin, "Öffnungszeiten Werkstor", "Das Tor öffnet um sechs.");
    expect((await lesen(app, admin, id)).frische?.schutz).toBe("intern");

    const res = await put(app, admin, id, { action: "schutz-oeffentlich", oeffentlich: true });
    expect(res.statusCode, res.body).toBe(200);
    const nachher = await lesen(app, admin, id);
    expect(nachher.oeffentlich).toBe(true);
    expect(nachher.frische?.schutz).toBe("oeffentlich");
    expect(nachher.frische?.betriebsmodell).toBe("oeffentliche_ki");

    const zurueck = await put(app, admin, id, { action: "schutz-oeffentlich", oeffentlich: false });
    expect(zurueck.statusCode, zurueck.body).toBe(200);
    expect((await lesen(app, admin, id)).frische?.schutz).toBe("intern");
  });

  it("eine Höherstufung nimmt die Marke mit; an Vertraulichem ist sie nicht setzbar", async () => {
    const { app, admin } = await aufbau("s2");
    const id = await anlegen(app, admin, "Lieferantenliste", "Drei Lieferanten sind gelistet.");
    await put(app, admin, id, { action: "schutz-oeffentlich", oeffentlich: true });

    const hoch = await put(app, admin, id, { action: "confidentiality", level: "vertraulich" });
    expect(hoch.statusCode, hoch.body).toBe(200);
    const vertraulich = await lesen(app, admin, id);
    expect(vertraulich.oeffentlich).toBeUndefined();
    expect(vertraulich.frische?.schutz).toBe("vertraulich");

    const wieder = await put(app, admin, id, { action: "schutz-oeffentlich", oeffentlich: true });
    expect(wieder.statusCode, wieder.body).toBe(400);
  });

  it("GEGENPROBE: ein Experte darf den Schutz nicht auf „öffentlich“ senken (ko.validate)", async () => {
    const { app, experte, admin } = await aufbau("s3");
    const id = await anlegen(app, experte, "Eigene Notiz", "Die Notiz gehört dem Experten.");
    const res = await put(app, experte, id, { action: "schutz-oeffentlich", oeffentlich: true });
    expect(res.statusCode, res.body).toBe(403);
    expect((await lesen(app, admin, id)).oeffentlich).toBeUndefined();
  });
});

describe("R-1635 / R-0266 · die Glocke stellt dem Autor zu", () => {
  it("nach der Anlagenänderung erhält der Autor die Prüfanforderung, der Meldende nicht", async () => {
    const { app, admin, experte } = await aufbau("g1");
    const id = await anlegen(app, experte, "Kesseldruck prüfen", "Den Kessel monatlich prüfen.");
    const frei = await put(app, admin, id, { action: "admin-validate" });
    expect(frei.statusCode, frei.body).toBe(200);
    const kopplung = await app.inject({
      method: "POST",
      url: "/api/lifecycle/couple",
      headers: admin,
      payload: { assetRef: "kessel-7", koId: id },
    });
    expect([200, 204], kopplung.body).toContain(kopplung.statusCode);
    expect((await glocke(app, experte)).filter((m) => m.frischeArt === "anlage")).toEqual([]);

    const meldung = await app.inject({
      method: "POST",
      url: "/api/lifecycle/asset-changed",
      headers: admin,
      payload: { assetRef: "kessel-7" },
    });
    expect(meldung.statusCode, meldung.body).toBe(200);

    const fuerAutor = (await glocke(app, experte)).filter((m) => m.frischeArt === "anlage");
    expect(fuerAutor.map((m) => m.koId)).toEqual([id]);
    const fuerMeldenden = (await glocke(app, admin)).filter((m) => m.frischeArt === "anlage");
    expect(fuerMeldenden).toEqual([]);
  });

  it("die Wochenvorlage nennt die geprüften Beiträge des Autors — nur seine", async () => {
    const { app, admin, experte } = await aufbau("g2");
    const id = await anlegen(app, experte, "Filter tauschen", "Den Filter quartalsweise tauschen.");
    expect((await glocke(app, experte)).filter((m) => m.frischeArt === "vorlage")).toEqual([]);
    const frei = await put(app, admin, id, { action: "admin-validate" });
    expect(frei.statusCode, frei.body).toBe(200);

    const vorlage = (await glocke(app, experte)).filter((m) => m.frischeArt === "vorlage");
    expect(vorlage.map((m) => m.koId)).toEqual([id]);
    expect((await glocke(app, admin)).filter((m) => m.frischeArt === "vorlage")).toEqual([]);
  });
});
