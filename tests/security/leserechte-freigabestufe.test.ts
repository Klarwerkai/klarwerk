// ================================================================================================
// aufnahme:20260922:gesamt-leserechte · Ben, Nacharbeit 19 — VARIANTE B UND UNGEKLÄRTE STUFEN.
// ================================================================================================
//
// Entscheidungen vom 11.10.2026 (QUELLEN-FACHHILFE-PETER-ENTSCHEIDUNGEN-20261011.json):
//   15 — „persönliches Freigabeniveau plus Objekt-/Gruppenrechte": `vertraulich` und
//        `streng_vertraulich` öffnen sich verschieden; die Rolle allein öffnet keine Stufe mehr.
//   16 — eine fehlende, NULL- oder unbekannte Stufe ist ungeklärt und bleibt geschützt.
//
// GEMESSEN an zwei Stellen: an der Regel selbst (`darfSehen`, `freigaberang`, `schutzrang`, das
// SQL-Prädikat) und über die echten Routen (Verwaltung setzt das Niveau, der nächste Abruf folgt).
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import type { SessionUser } from "../../services/app/src/http";
import {
  darfSehen,
  freigaberang,
  schutzrang,
  sqlSichtbarkeitFuer,
} from "../../services/app/src/sichtbarkeit";

const STUFEN = ["intern", "vertraulich", "streng_vertraulich", undefined, null, "geheim"] as const;

function objekt(stufe: (typeof STUFEN)[number], author = "jemand-anders") {
  return { confidentiality: stufe as never, author };
}

describe("die Regel — Schutzrang gegen Freigaberang (Variante B)", () => {
  it("ungeklärte Stufen (fehlend, null, unbekannt) zählen wie vertraulich", () => {
    expect(schutzrang("intern")).toBe(0);
    expect(schutzrang("vertraulich")).toBe(1);
    expect(schutzrang("streng_vertraulich")).toBe(2);
    expect(schutzrang(undefined)).toBe(1);
    expect(schutzrang(null)).toBe(1);
    expect(schutzrang("geheim")).toBe(1);
  });

  it("Übergangsregel ohne gesetztes Niveau: ko.validate → 1, sonst 0 — nie 2", () => {
    expect(freigaberang({ id: "v", role: "viewer" })).toBe(0);
    expect(freigaberang({ id: "e", role: "experte" })).toBe(0);
    expect(freigaberang({ id: "c", role: "controller" })).toBe(1);
    expect(freigaberang({ id: "a", role: "admin" })).toBe(1);
  });

  it("das persönliche Niveau geht der Rolle vor — nach oben wie nach unten", () => {
    expect(freigaberang({ id: "e", role: "experte", freigabe: "streng_vertraulich" })).toBe(2);
    expect(freigaberang({ id: "a", role: "admin", freigabe: "intern" })).toBe(0);
  });

  it("vertraulich und streng vertraulich öffnen sich tatsächlich verschieden", () => {
    const controller: SessionUser = { id: "c", role: "controller" };
    expect(darfSehen(controller, objekt("vertraulich"))).toBe(true);
    // GEGENPROBE zur abgelösten Variante A: ko.validate allein öffnet „streng" nicht mehr.
    expect(darfSehen(controller, objekt("streng_vertraulich"))).toBe(false);
    const freigegeben: SessionUser = { ...controller, freigabe: "streng_vertraulich" };
    expect(darfSehen(freigegeben, objekt("streng_vertraulich"))).toBe(true);
    // Ein persönliches Niveau öffnet unabhängig von der Rolle.
    const experte: SessionUser = { id: "e", role: "experte", freigabe: "vertraulich" };
    expect(darfSehen(experte, objekt("vertraulich"))).toBe(true);
    expect(darfSehen(experte, objekt("streng_vertraulich"))).toBe(false);
  });

  it("ungeklärt ist für Leser ohne Freigabe verborgen, für den Autor nicht", () => {
    const leser: SessionUser = { id: "v", role: "viewer" };
    for (const stufe of [undefined, null, "geheim"] as const) {
      expect(darfSehen(leser, objekt(stufe)), String(stufe)).toBe(false);
      expect(darfSehen(leser, objekt(stufe, "v")), `eigen ${String(stufe)}`).toBe(true);
    }
    expect(darfSehen(leser, objekt("intern"))).toBe(true);
  });

  it("Gruppenrecht bleibt eine zweite Bedingung: auch „streng“ öffnet keinen fremden Space", () => {
    const user: SessionUser = {
      id: "s",
      role: "admin",
      freigabe: "streng_vertraulich",
      spaceLesbar: new Set(["offen"]),
    };
    expect(darfSehen(user, { ...objekt("intern"), spaceId: "zu" })).toBe(false);
    expect(darfSehen(user, { ...objekt("streng_vertraulich"), spaceId: "offen" })).toBe(true);
  });

  it("das SQL-Prädikat trägt den Rang, nicht die Rolle — und urteilt wie darfSehen", () => {
    const betrachter: SessionUser[] = [
      { id: "v", role: "viewer" },
      { id: "c", role: "controller" },
      { id: "c2", role: "controller", freigabe: "streng_vertraulich" },
      { id: "a", role: "admin", freigabe: "intern" },
    ];
    for (const user of betrachter) {
      const trim = sqlSichtbarkeitFuer(user);
      expect(trim.params[0]).toBe(freigaberang(user));
      // Das Prädikat liest die rohe Stufe, nicht die normalisierende generierte Spalte.
      const sql = trim.sql("k", 1);
      expect(sql).toContain("k.data->>'confidentiality'");
      expect(sql).not.toContain("confidentiality_key");
      for (const stufe of STUFEN) {
        for (const autor of ["jemand-anders", user.id]) {
          const fakten = objekt(stufe, autor);
          expect(trim.trifftZu(fakten), `${user.id} ${String(stufe)} ${autor}`).toBe(
            darfSehen(user, fakten),
          );
        }
      }
    }
  });
});

// ------------------------------------------------------------------------------------------------
// Über die echten Routen.
// ------------------------------------------------------------------------------------------------
const KENNWORT = "geheim12345";

async function anmelden(app: ReturnType<typeof buildApp>, email: string) {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: KENNWORT },
  });
  expect(res.statusCode, res.body).toBe(200);
  return { authorization: `Bearer ${res.json().token}` };
}

async function buehne() {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Admin", email: "ada@freigabe.test", password: KENNWORT },
  });
  const ada = await anmelden(app, "ada@freigabe.test");
  const ids: Record<string, string> = {};
  for (const [name, email, role] of [
    ["Carla Controller", "carla@freigabe.test", "controller"],
    ["Vera Viewer", "vera@freigabe.test", "viewer"],
  ] as const) {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: ada,
      payload: { name, email, password: KENNWORT, role },
    });
    expect(res.statusCode, res.body).toBe(201);
    ids[role] = (res.json() as { id: string }).id;
  }
  return {
    app,
    services,
    ada,
    ids,
    carla: await anmelden(app, "carla@freigabe.test"),
    vera: await anmelden(app, "vera@freigabe.test"),
  };
}

const lies = (b: Awaited<ReturnType<typeof buehne>>, kopf: Record<string, string>, id: string) =>
  b.app.inject({ method: "GET", url: `/api/kos/${id}`, headers: kopf });

describe("über die Routen — Niveau setzen, Folgeabruf, Entzug, ungeklärte Altobjekte", () => {
  it("streng vertraulich: verborgen, nach persönlicher Freigabe sichtbar, nach Entzug wieder verborgen", async () => {
    const b = await buehne();
    const angelegt = await b.app.inject({
      method: "POST",
      url: "/api/kos",
      headers: b.ada,
      payload: {
        confidentiality: "streng_vertraulich",
        title: "Rezeptur Linie 7",
        statement: "Die Rezeptur der Linie 7 ist streng vertraulich.",
        type: "best_practice",
        category: "Produktion",
      },
    });
    expect(angelegt.statusCode, angelegt.body).toBe(201);
    const koId = (angelegt.json() as { id: string }).id;

    // Die Controllerin hat ko.validate, aber kein persönliches Niveau: verborgen wie unbekannt.
    const vorher = await lies(b, b.carla, koId);
    expect(vorher.statusCode).toBe(404);
    expect(vorher.body).not.toContain("Rezeptur");

    const setzen = await b.app.inject({
      method: "PUT",
      url: `/api/users/${b.ids.controller}`,
      headers: b.ada,
      payload: { freigabe: "streng_vertraulich" },
    });
    expect(setzen.statusCode, setzen.body).toBe(200);
    expect((setzen.json() as { freigabe?: string }).freigabe).toBe("streng_vertraulich");
    // Derselbe Sitzungstoken — der nächste Abruf folgt dem Konto.
    expect((await lies(b, b.carla, koId)).statusCode).toBe(200);

    const entzug = await b.app.inject({
      method: "PUT",
      url: `/api/users/${b.ids.controller}`,
      headers: b.ada,
      payload: { freigabe: null },
    });
    expect(entzug.statusCode, entzug.body).toBe(200);
    expect((entzug.json() as { freigabe?: string }).freigabe).toBeUndefined();
    expect((await lies(b, b.carla, koId)).statusCode).toBe(404);

    // Beide Änderungen stehen im Protokoll, mit altem und neuem Niveau.
    const belege = await b.services.audit.list({ action: "user.freigabe-set" });
    expect(belege.map((e) => e.payload)).toEqual([
      { vorher: null, nachher: "streng_vertraulich" },
      { vorher: "streng_vertraulich", nachher: null },
    ]);
    await b.app.close();
  });

  it("die Formwache: ein unbekanntes Niveau wird abgewiesen und ändert nichts", async () => {
    const b = await buehne();
    const res = await b.app.inject({
      method: "PUT",
      url: `/api/users/${b.ids.viewer}`,
      headers: b.ada,
      payload: { freigabe: "alles" },
    });
    expect(res.statusCode).not.toBe(200);
    expect(res.statusCode).not.toBe(204);
    const konten = await b.services.auth.listUsers();
    expect(konten.find((u) => u.id === b.ids.viewer)?.freigabe).toBeUndefined();
    // Nur die Verwaltung setzt Niveaus — die Controllerin nicht (auch nicht für sich selbst).
    const selbst = await b.app.inject({
      method: "PUT",
      url: `/api/users/${b.ids.controller}`,
      headers: b.carla,
      payload: { freigabe: "streng_vertraulich" },
    });
    expect([401, 403]).toContain(selbst.statusCode);
    await b.app.close();
  });

  it("ungeklärte Stufe (Altobjekt ohne Einstufung): Leser verborgen, Kuratorin sichtbar, nach Einstufung frei", async () => {
    const b = await buehne();
    // Ein Objekt ohne Stufe — die Form des Altbestands und jedes Imports ohne Einstufung.
    const alt = await b.services.ko.create({
      title: "Altbestand Kühlkreislauf",
      statement: "Der Kühlkreislauf wird quartalsweise gespült.",
      type: "best_practice",
      category: "Instandhaltung",
      author: b.ids.controller,
    });
    expect(alt.confidentiality).toBeUndefined();

    const vera = await lies(b, b.vera, alt.id);
    expect(vera.statusCode).toBe(404);
    expect(vera.body).not.toContain("Kühlkreislauf");
    // Die Liste verrät es ebensowenig.
    const liste = await b.app.inject({ method: "GET", url: "/api/kos", headers: b.vera });
    expect(liste.statusCode).toBe(200);
    expect(liste.body).not.toContain(alt.id);
    // Wer einstufen soll, sieht es (Übergangsregel: ko.validate → Rang 1).
    expect((await lies(b, b.ada, alt.id)).statusCode).toBe(200);

    // Ausdrücklich „intern" eingestuft → für alle berechtigten Firmenmitglieder frei.
    const einstufen = await b.app.inject({
      method: "PUT",
      url: `/api/kos/${alt.id}`,
      headers: b.ada,
      payload: { action: "confidentiality", level: "intern" },
    });
    expect(einstufen.statusCode, einstufen.body).toBe(200);
    expect((await lies(b, b.vera, alt.id)).statusCode).toBe(200);
    await b.app.close();
  });
});
