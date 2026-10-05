// ================================================================================================
// R-0143 (bens F1, K1) — AUCH DER DIREKTE IMPORTEINGANG ERZEUGT KEIN WISSENSOBJEKT OHNE ANNAHME.
// ================================================================================================
//
// `POST /api/library/import` legte bis zu dieser Lieferung jeden nicht doppelten Eintrag sofort als
// Wissensobjekt an (`importJson`). Seit `library-routes.ts` (`direktimportAntwort`) reiht er
// Kandidaten in die Prüfwarteschlange ein. Diese Datei misst das über die echte Anwendung
// (`buildServices`/`buildApp`, `app.inject`, Anmeldung über die Produktrouten — Muster
// `tests/app/import-cleanup.test.ts`) und liest den Bestand am echten Dienst nach, nicht aus der
// Antwort des Schreibwegs.
//
// WAS SIE NICHT DECKT: echte Ports, Postgres, Browser und die Bedienung durch einen Menschen.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

const ZUGANG = { name: "Admin", email: "direktimport@x.de", password: "secret123" };

const EINTRAG = {
  title: "Notstromaggregat monatlich probelaufen lassen",
  statement:
    "Das Notstromaggregat einmal im Monat fuenfzehn Minuten unter Last laufen lassen und das Ergebnis im Betriebsbuch vermerken.",
  type: "best_practice",
  category: "Betrieb",
  url: "https://wiki.example.test/pages/notstrom",
};

async function angemeldeteApp() {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({ method: "POST", url: "/api/auth/register", payload: ZUGANG });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: ZUGANG.email, password: ZUGANG.password },
  });
  const headers = { authorization: `Bearer ${(login.json() as { token: string }).token}` };
  return { app, services, headers };
}

interface Direktantwort {
  imported: number;
  skipped: number;
  eingereiht: number;
  kandidaten: { id: string; status: string; koId: string | null; item: { title: string } }[];
}

describe("R-0143 · POST /api/library/import führt in die Prüfwarteschlange", () => {
  it("D1: ein neuer gültiger Eintrag erzeugt KEIN Wissensobjekt, sondern genau einen Kandidaten", async () => {
    const { app, services, headers } = await angemeldeteApp();
    const vorher = (await services.ko.list()).length;

    const res = await app.inject({
      method: "POST",
      url: "/api/library/import",
      headers,
      payload: { items: [EINTRAG] },
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json() as Direktantwort;
    expect(body.imported, "der direkte Eingang meldet ein direkt angelegtes Objekt").toBe(0);
    expect(body.eingereiht).toBe(1);
    expect(body.kandidaten.map((k) => [k.item.title, k.status, k.koId])).toEqual([
      [EINTRAG.title, "neu", null],
    ]);

    // Der Bestand am echten Dienst — nicht die Antwort — ist der Beleg.
    expect(
      (await services.ko.list()).length,
      "der direkte Importeingang hat ohne Annahme ein Wissensobjekt angelegt",
    ).toBe(vorher);
    const queue = await app.inject({
      method: "GET",
      url: "/api/library/import/candidates",
      headers,
    });
    expect(queue.statusCode, queue.body).toBe(200);
    expect(
      (queue.json() as { id: string; status: string }[]).map((k) => [k.id, k.status]),
      "der eingereihte Kandidat steht nicht in der Warteschlange",
    ).toEqual([[body.kandidaten[0]?.id, "neu"]]);
  });

  it("D2: erst die berechtigte Annahme erzeugt genau EIN Objekt — als importiert gekennzeichnet, mit Quelle", async () => {
    const { app, services, headers } = await angemeldeteApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/library/import",
      headers,
      payload: { items: [EINTRAG] },
    });
    const kandidatId = (res.json() as Direktantwort).kandidaten[0]?.id ?? "";
    const vorher = (await services.ko.list()).length;

    const annahme = await app.inject({
      method: "PUT",
      url: `/api/library/import/candidates/${kandidatId}`,
      headers,
      payload: { action: "accept" },
    });
    expect(annahme.statusCode, annahme.body).toBe(200);
    const koId = (annahme.json() as { koId: string | null }).koId;
    expect(koId, "die Annahme hat kein Objekt vermerkt").toEqual(expect.any(String));

    const nachher = await services.ko.list();
    expect(nachher.length, "die Annahme hat nicht genau ein Objekt angelegt").toBe(vorher + 1);
    const objekt = await services.ko.get(koId ?? "");
    expect({
      titel: objekt?.title,
      status: objekt?.status,
      trust: objekt?.trust,
      origin: objekt?.origin,
      importCandidateId: objekt?.importCandidateId,
      quellen: objekt?.sources.map((s) => s.url),
    }).toEqual({
      titel: EINTRAG.title,
      status: "offen",
      trust: 0,
      origin: "import",
      importCandidateId: kandidatId,
      quellen: [EINTRAG.url],
    });
  });

  it("D3: ablehnen über die Warteschlange lässt den Bestand unverändert", async () => {
    const { app, services, headers } = await angemeldeteApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/library/import",
      headers,
      payload: { items: [EINTRAG] },
    });
    const kandidatId = (res.json() as Direktantwort).kandidaten[0]?.id ?? "";
    const vorher = (await services.ko.list()).length;
    const abgelehnt = await app.inject({
      method: "PUT",
      url: `/api/library/import/candidates/${kandidatId}`,
      headers,
      payload: { action: "reject" },
    });
    expect(abgelehnt.statusCode, abgelehnt.body).toBe(200);
    expect((await services.ko.list()).length).toBe(vorher);
  });
});
