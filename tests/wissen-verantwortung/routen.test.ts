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

  it("V2 · die Eigentümerin gibt inhaltlich frei — getrennt von der Rückgabe, mit Freigabespur", async () => {
    const { app, admin, erik, carla } = await aufbau();
    const koId = await anlegen(app, admin.headers, "Hydraulikschlauch nur drucklos tauschen");
    const benenne = (owner: string) =>
      app.inject({
        method: "PUT",
        url: `/api/kos/${koId}`,
        headers: admin.headers,
        payload: { action: "ownership", ownership: { owner } },
      });
    const freigabe = (wer: { headers: Record<string, string> }) =>
      app.inject({
        method: "PUT",
        url: `/api/kos/${koId}`,
        headers: wer.headers,
        payload: { action: "owner-validate" },
      });
    expect((await lesen(app, admin.headers, koId)).json().status).toBe("offen");

    // Eigentum allein verleiht kein Freigaberecht: Erik (ohne `ko.validate`) wird am Tor abgewiesen.
    expect((await benenne(erik.id)).statusCode).toBe(200);
    const ohneRecht = await freigabe(erik);
    expect(ohneRecht.statusCode, ohneRecht.body).toBe(403);
    expect(ohneRecht.json().error).toBe("FORBIDDEN");

    // Freigabeberechtigt, aber nicht Eigentümer: auch der Admin bekommt NOT_OWNER.
    expect((await benenne(carla.id)).statusCode).toBe(200);
    const fremd = await freigabe(admin);
    expect(fremd.statusCode, fremd.body).toBe(403);
    expect(fremd.json().error).toBe("NOT_OWNER");
    expect((await lesen(app, admin.headers, koId)).json().status).toBe("offen");

    const ok = await freigabe(carla);
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json().status).toBe("validiert");
    const danach = (await lesen(app, admin.headers, koId)).json();
    expect(danach.status).toBe("validiert");
    // Freigabespur: Carla steht unter `validators`; sie bleibt Eigentümerin (keine Rückgabe).
    expect(danach.ownership).toEqual({ owner: carla.id, reviewers: [], validators: [carla.id] });

    const protokoll = await app.inject({
      method: "GET",
      url: "/api/audit",
      headers: admin.headers,
    });
    const eintraege = protokoll.json() as Array<{ action: string; actor: string; target: string }>;
    expect(
      eintraege.some(
        (e) => e.action === "ko.owner-validated" && e.actor === carla.id && e.target === koId,
      ),
    ).toBe(true);
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

  it("W4 · Auslöser aus der Verzeichnispflege: Konto entfernen mit Nachfolger übergibt zuerst", async () => {
    const { app, admin, carla } = await aufbau();
    // Ein eigenes, frisches Konto — unabhängig vom Demobestand.
    const angelegt = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin.headers,
      payload: {
        name: "Gerd Geht",
        email: "gerd@verantwortung.test",
        password: "secret123",
        role: "experte",
      },
    });
    expect(angelegt.statusCode, angelegt.body).toBe(201);
    const gerd = await login(app, "gerd@verantwortung.test", "secret123");
    const koId = await anlegen(app, gerd.headers, "Kettenspanner monatlich nachstellen");
    const konten = async (): Promise<string[]> => {
      const res = await app.inject({ method: "GET", url: "/api/users", headers: admin.headers });
      return (res.json() as { id: string }[]).map((u) => u.id);
    };

    // Unbekannter Nachfolger: nach der gemeinsamen Nachfolgeregel (`kannVerantworten`,
    // produkt:20261007:ownership-uebergabe) unzulässig — nichts übergeben, nichts entfernt.
    const unbekannt = await app.inject({
      method: "DELETE",
      url: `/api/users/${gerd.id}?nachfolger=gibt-es-nicht`,
      headers: admin.headers,
    });
    expect(unbekannt.statusCode, unbekannt.body).toBe(400);
    expect(unbekannt.json().error).toBe("NACHFOLGE_UNZULAESSIG");
    expect(await konten()).toContain(gerd.id);
    expect((await lesen(app, admin.headers, koId)).json().author).toBe(gerd.id);

    // Ohne Nachfolger bleibt die Sperre aus produkt:20261007:ownership-uebergabe unverändert.
    const gesperrt = await app.inject({
      method: "DELETE",
      url: `/api/users/${gerd.id}`,
      headers: admin.headers,
    });
    expect(gesperrt.statusCode, gesperrt.body).toBe(409);
    expect(gesperrt.json().error).toBe("BESTAND_OFFEN");

    // Ein Beitrag im Papierkorb: die Wissensübergabe (lebender Bestand) erreicht ihn nicht, die
    // Hauptverantwortung muss trotzdem vor dem Entfernen wandern (Wiederherstellen behält sie).
    const imPapierkorb = await anlegen(app, gerd.headers, "Alte Schmieranweisung Linie 2");
    const geloescht = await app.inject({
      method: "DELETE",
      url: `/api/kos/${imPapierkorb}`,
      headers: admin.headers,
    });
    expect(geloescht.statusCode, geloescht.body).toBeLessThan(300);

    // BEN (Nacharbeit 7): die Vorschau zeigt denselben Umfang wie die Ausführung — auch den
    // Papierkorb-Beitrag, dessen Verantwortung beim Entfernen wandert.
    const vorschau = await app.inject({
      method: "POST",
      url: "/api/lifecycle/handover/preview",
      headers: admin.headers,
      payload: { from: gerd.id, to: carla.id },
    });
    expect(vorschau.statusCode, vorschau.body).toBe(200);
    expect(vorschau.json().papierkorb).toEqual([
      { id: imPapierkorb, title: "Alte Schmieranweisung Linie 2" },
    ]);
    expect(vorschau.json().wissensobjekte.map((k: { id: string }) => k.id)).toEqual([koId]);

    const entfernt = await app.inject({
      method: "DELETE",
      url: `/api/users/${gerd.id}?nachfolger=${carla.id}`,
      headers: admin.headers,
    });
    expect(entfernt.statusCode, entfernt.body).toBe(200);
    expect(entfernt.json().uebergabe.fehlgeschlagen).toEqual([]);
    expect(entfernt.json().uebergabe.uebergeben.wissensobjekt).toBe(1);
    const angekuendigt = vorschau.json().papierkorb.length;
    expect(entfernt.json().uebergabe.uebergeben.papierkorb).toBe(angekuendigt);
    expect(await konten()).not.toContain(gerd.id);
    const ko = (await lesen(app, admin.headers, koId)).json();
    expect(ko.author).toBe(carla.id);
    expect(ko.originalAuthor).toBe(gerd.id);

    // Der wiederhergestellte Papierkorb-Beitrag trägt Carla als Hauptverantwortliche.
    const zurueck = await app.inject({
      method: "POST",
      url: `/api/kos/${imPapierkorb}/restore`,
      headers: admin.headers,
    });
    expect(zurueck.statusCode, zurueck.body).toBeLessThan(300);
    expect((await lesen(app, admin.headers, imPapierkorb)).json().ownership?.owner).toBe(carla.id);
  });
});
