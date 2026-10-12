// ================================================================================================
// RECHERCHE:pmo-fea-0004 — DAS WISSENSUPDATE ÜBER DIE ECHTE HTTP-TÜR.
// ================================================================================================
//
// Der Bestand entsteht über die Produktwege (anlegen, zwei Bewertungen) — keine Repo-Manipulation.
// Gemessen werden:
//   · die Tür `GET /api/output/wochenupdate` liefert das Update für den heutigen Zeitraum, mit dem
//     frisch validierten Objekt und ohne das vertrauliche und das noch offene;
//   · Kontoregel: ohne Anmeldung 401; ein unlesbares `bis` ist 400 BAD_REQUEST;
//   · KEIN VERSAND, KEINE SCHREIBWIRKUNG: das Prüfprotokoll und die Meldungen sind nach dem Abruf
//     dieselben wie davor — das Update löst nichts aus, es wird nur zurückgegeben.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { WOCHENUPDATE_KEIN_VERSAND, WOCHENUPDATE_TITEL } from "../../services/output";
import { demoKennwort } from "../support/demoZugang";

type App = ReturnType<typeof buildApp>;
type Kopf = Record<string, string>;

async function login(app: App, email: string, password: string): Promise<Kopf> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  return { authorization: `Bearer ${res.json().token}` };
}

async function buehne() {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "a@wochenupdate.example", password: "secret123" },
  });
  const admin = await login(app, "a@wochenupdate.example", "secret123");
  const seed = await app.inject({ method: "POST", url: "/api/admin/demo-seed", headers: admin });
  const carla = await login(app, "carla@demo.klarwerk", demoKennwort(seed, "carla@demo.klarwerk"));
  return { app, services, admin, carla };
}

async function anlegen(
  app: App,
  admin: Kopf,
  title: string,
  confidentiality = "intern",
): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: admin,
    payload: {
      confidentiality,
      title,
      statement: `Kernaussage zu ${title}`,
      type: "best_practice",
      category: "Teamgespräch",
      measures: ["Im Team besprechen"],
      neededValidations: 2,
    },
  });
  expect(res.statusCode, res.body).toBeLessThan(300);
  return res.json().id as string;
}

async function validieren(app: App, id: string, ...koepfe: Kopf[]): Promise<void> {
  for (const h of koepfe) {
    await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: h,
      payload: { action: "rate", verdict: "up" },
    });
  }
}

const abrufen = (app: App, h: Kopf | undefined, query = "") =>
  app.inject({
    method: "GET",
    url: `/api/output/wochenupdate${query}`,
    ...(h ? { headers: h } : {}),
  });

describe("RECHERCHE:pmo-fea-0004 · Wissensupdate über HTTP", () => {
  it("liefert das frisch validierte Wissen der Woche — ohne Vertrauliches und ohne Offenes", async () => {
    const { app, admin, carla } = await buehne();
    const frisch = await anlegen(app, admin, "Wochenupdate Frisch");
    await validieren(app, frisch, admin, carla);
    const geheim = await anlegen(app, admin, "Wochenupdate Geheim", "vertraulich");
    await validieren(app, geheim, admin, carla);
    const offen = await anlegen(app, admin, "Wochenupdate Offen");

    const antwort = await abrufen(app, carla);
    expect(antwort.statusCode, antwort.body).toBe(200);
    const u = antwort.json() as {
      title: string;
      von: string;
      bis: string;
      eintraege: { koId: string; art: string }[];
      markdown: string;
    };
    expect(u.title).toBe(WOCHENUPDATE_TITEL);
    expect(u.bis).toBe(new Date().toISOString().slice(0, 10));
    expect(u.eintraege).toContainEqual(expect.objectContaining({ koId: frisch, art: "neu" }));
    const ids = u.eintraege.map((e) => e.koId);
    expect(ids).not.toContain(geheim);
    expect(ids).not.toContain(offen);
    expect(u.markdown).toContain("Wochenupdate Frisch");
    expect(u.markdown).not.toContain("Wochenupdate Geheim");
    expect(u.markdown).not.toContain("Wochenupdate Offen");
    expect(u.markdown).toContain(WOCHENUPDATE_KEIN_VERSAND);
  });

  it("Kontoregel und Eingabe: ohne Anmeldung 401, unlesbares Datum 400", async () => {
    const { app, admin } = await buehne();
    expect((await abrufen(app, undefined)).statusCode).toBe(401);
    const kaputt = await abrufen(app, admin, "?bis=09.10.2026");
    expect(kaputt.statusCode).toBe(400);
    expect(kaputt.json().error).toBe("BAD_REQUEST");
    const vergangen = await abrufen(app, admin, "?bis=2026-01-07");
    expect(vergangen.statusCode).toBe(200);
    expect(vergangen.json()).toMatchObject({ von: "2026-01-01", bis: "2026-01-07" });
  });

  it("der Abruf verschickt nichts und schreibt nichts: Prüfprotokoll und Meldungen bleiben gleich", async () => {
    const { app, services, admin, carla } = await buehne();
    const id = await anlegen(app, admin, "Wochenupdate Ruhig");
    await validieren(app, id, admin, carla);
    const meldungen = () =>
      app.inject({ method: "GET", url: "/api/notifications", headers: carla });
    const protokollVorher = structuredClone(await services.audit.list({}));
    const meldungenVorher = (await meldungen()).body;

    expect((await abrufen(app, admin)).statusCode).toBe(200);
    expect((await abrufen(app, carla)).statusCode).toBe(200);

    expect(await services.audit.list({})).toEqual(protokollVorher);
    expect((await meldungen()).body).toBe(meldungenVorher);
  });
});
