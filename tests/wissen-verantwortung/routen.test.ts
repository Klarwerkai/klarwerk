// ================================================================================================
// aufnahme:20260922:gesamt-wissen-verantwortung — DIE WEGE AM DRAHT (buildApp, Speicherbetrieb).
// ================================================================================================
//
// R-0507: am Objekt steht die Verantwortung (`ownership`), und NUR der benannte Eigentümer gibt sie
//         zurück (`PUT /api/kos/:id` `ownership-release`, sonst 403 `NOT_OWNER`).
// R-0554 / R-2128: Vorschau und Übergabe (`POST /api/lifecycle/handover[/preview]`) nur mit
//         `users.manage`; danach ist der Nachfolger Autor, die Urheberschaft bleibt.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { demoKennwort } from "../support/demoZugang";

type App = ReturnType<typeof buildApp>;

async function login(app: App, email: string, password: string) {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  const headers = { authorization: `Bearer ${res.json().token}` };
  const me = await app.inject({ method: "GET", url: "/api/auth/me", headers });
  return { headers, id: me.json().id as string };
}

async function aufbau() {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "a@x.de", password: "secret123" },
  });
  const admin = await login(app, "a@x.de", "secret123");
  const seed = await app.inject({
    method: "POST",
    url: "/api/admin/demo-seed",
    headers: admin.headers,
  });
  const erik = await login(app, "erik@demo.klarwerk", demoKennwort(seed, "erik@demo.klarwerk"));
  const carla = await login(app, "carla@demo.klarwerk", demoKennwort(seed, "carla@demo.klarwerk"));
  return { app, admin, erik, carla };
}

const lesen = (app: App, headers: Record<string, string>, koId: string) =>
  app.inject({ method: "GET", url: `/api/kos/${koId}`, headers });

async function anlegen(app: App, headers: Record<string, string>, title: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers,
    payload: {
      confidentiality: "intern",
      title,
      statement: `${title} — Aussage.`,
      type: "best_practice",
    },
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json().id as string;
}

describe("R-0507 · Verantwortung am Draht", () => {
  it("V1 · die Verantwortung steht am Objekt, und nur die Eigentümerin gibt sie zurück", async () => {
    const { app, admin, erik, carla } = await aufbau();
    const koId = await anlegen(app, admin.headers, "Druckluftnetz vor Wartung entlüften");

    const benannt = await app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers: admin.headers,
      payload: { action: "ownership", ownership: { owner: carla.id, reviewers: [erik.id] } },
    });
    expect(benannt.statusCode, benannt.body).toBe(200);
    const gelesen = await lesen(app, erik.headers, koId);
    expect(gelesen.json().ownership).toEqual({
      owner: carla.id,
      reviewers: [erik.id],
      validators: [],
    });

    // Fremde — auch der Admin — können die Verantwortung einer anderen Person nicht zurückgeben.
    for (const fremd of [erik, admin]) {
      const abgewiesen = await app.inject({
        method: "PUT",
        url: `/api/kos/${koId}`,
        headers: fremd.headers,
        payload: { action: "ownership-release" },
      });
      expect(abgewiesen.statusCode, abgewiesen.body).toBe(403);
      expect(abgewiesen.json().error).toBe("NOT_OWNER");
    }

    const zurueck = await app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers: carla.headers,
      payload: { action: "ownership-release" },
    });
    expect(zurueck.statusCode, zurueck.body).toBe(200);
    const danach = await lesen(app, carla.headers, koId);
    expect(danach.json().ownership).toEqual({ reviewers: [erik.id], validators: [] });
    expect(danach.json().author).toBe(admin.id);
  });
});

describe("R-0554 / R-2128 · Wissensübergabe am Draht", () => {
  it("W1 · nur die Verwaltung sieht die Vorschau und übergibt", async () => {
    const { app, erik, carla } = await aufbau();
    for (const url of ["/api/lifecycle/handover/preview", "/api/lifecycle/handover"]) {
      const res = await app.inject({
        method: "POST",
        url,
        headers: carla.headers,
        payload: { from: erik.id, to: carla.id },
      });
      expect(res.statusCode, `${url}: ${res.body}`).toBe(403);
    }
  });

  it("W2 · Vorschau, dann Übergabe: Nachfolger ist Autor, die Urheberschaft bleibt", async () => {
    const { app, admin, erik, carla } = await aufbau();
    const koId = await anlegen(app, erik.headers, "Kühlwasserfilter wöchentlich spülen");

    const vorschau = await app.inject({
      method: "POST",
      url: "/api/lifecycle/handover/preview",
      headers: admin.headers,
      payload: { from: erik.id, to: carla.id },
    });
    expect(vorschau.statusCode, vorschau.body).toBe(200);
    expect(vorschau.json().wissensobjekte).toContainEqual({
      id: koId,
      title: "Kühlwasserfilter wöchentlich spülen",
    });
    // Die Vorschau schreibt nichts.
    expect((await lesen(app, admin.headers, koId)).json().author).toBe(erik.id);

    const zug = await app.inject({
      method: "POST",
      url: "/api/lifecycle/handover",
      headers: admin.headers,
      payload: { from: erik.id, to: carla.id },
    });
    expect(zug.statusCode, zug.body).toBe(200);
    expect(zug.json().fehlgeschlagen).toEqual([]);
    expect(zug.json().uebergeben.wissensobjekt).toBe(vorschau.json().wissensobjekte.length);

    const ko = await lesen(app, admin.headers, koId);
    expect(ko.json().author).toBe(carla.id);
    expect(ko.json().originalAuthor).toBe(erik.id);

    // Ein zweiter Blick findet bei Erik nichts mehr.
    const nochmal = await app.inject({
      method: "POST",
      url: "/api/lifecycle/handover/preview",
      headers: admin.headers,
      payload: { from: erik.id, to: carla.id },
    });
    expect(nochmal.json().wissensobjekte).toEqual([]);
  });

  it("W3 · ungültige Paare werden abgelehnt", async () => {
    const { app, admin, erik } = await aufbau();
    const gleich = await app.inject({
      method: "POST",
      url: "/api/lifecycle/handover/preview",
      headers: admin.headers,
      payload: { from: erik.id, to: erik.id },
    });
    expect(gleich.statusCode).toBe(400);
    const unbekannt = await app.inject({
      method: "POST",
      url: "/api/lifecycle/handover",
      headers: admin.headers,
      payload: { from: erik.id, to: "gibt-es-nicht" },
    });
    expect(unbekannt.statusCode).toBe(404);
  });
});
