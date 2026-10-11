// ================================================================================================
// R-1863 · ANTWORTEN 18/19 (Ben, Nacharbeit 9) — DIE KONTOGEBUNDENE WEISUNGSBEFUGNIS AM ECHTEN
// HTTP-WEG.
// ================================================================================================
//
// Antwort 18: „Weisungsbefugnis ausdrücklich im Benutzerkonto und Zuständigkeitsbereich; technische
// Administration genügt nicht." Antwort 19: „Unmittelbar gültige befugte Weisung mit nachfolgender
// zuständiger Sichtung" (Verantwortlicher und Frist).
//
//   B1 · Die Rolle `admin` allein gibt keine Weisungsbefugnis (403, nichts geschrieben).
//   B2 · Vergabe am Konto durch die Verwaltung (Vermerk), danach gilt die eigene Weisung sofort:
//        Status validiert, Annahme mit Kontoregel `weisung`, Sichtung mit Person und Frist.
//   B3 · Ausserhalb des Bereichs: 403. Fremdes Objekt: 403 (NOT_OWNER).
//   B4 · Sichtung: Frist in der Vergangenheit, Sichtung durch sich selbst oder durch ein Konto
//        ohne Freigaberecht/Befugnis → 400, nichts geschrieben.
//   B5 · Nur die benannte Person sichtet; Widerruf öffnet das Objekt wieder, die Annahme entfällt.
//   B6 · Bestätigen lässt die Weisung gelten; eine zweite Sichtung gibt es nicht.
//   B7 · Entzug der Befugnis wirkt sofort; ungültige Form wird abgewiesen.
//   B8 · `*` (ganzes Unternehmen) deckt jeden Bereich.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
type Kopf = Record<string, string>;

interface Stand {
  version: number;
  status: string;
  annahme?: { person: string; kontoregel: string | null; fassung: number };
  weisungsSichtung?: {
    verantwortlich: string;
    frist: string;
    bereich: string;
    erteiltVon: string;
    koVersion: number;
    ergebnis?: { art: string; von: string };
  };
}

const HEUTE = new Date().toISOString().slice(0, 10);
const GESTERN = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

async function anmelden(app: App, email: string): Promise<Kopf> {
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "secret123" },
  });
  expect(login.statusCode).toBe(200);
  return { authorization: `Bearer ${(login.json() as { token: string }).token}` };
}

async function konto(app: App, admin: Kopf, rolle: string, email: string) {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: admin,
    payload: { name: `Konto ${email}`, email, password: "secret123", role: rolle },
  });
  expect(angelegt.statusCode).toBe(201);
  return { kopf: await anmelden(app, email), id: (angelegt.json() as { id: string }).id };
}

async function buehne() {
  const services = buildServices();
  const app = buildApp(services);
  const erst = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "pedi@wb.test", password: "secret123" },
  });
  const admin = {
    kopf: await anmelden(app, "pedi@wb.test"),
    id: (erst.json() as { id: string }).id,
  };
  return {
    app,
    services,
    admin,
    controller: await konto(app, admin.kopf, "controller", "carl@wb.test"),
    leitung: await konto(app, admin.kopf, "experte", "lea@wb.test"),
    leser: await konto(app, admin.kopf, "viewer", "vic@wb.test"),
  };
}

// Je Objekt ein eigener Inhalt: zwei gleichlautende Objekte wären eine offene Dublette, und das
// Dublettentor (409) stünde vor der Prüfung, um die es hier geht.
const INHALTE = [
  ["Urlaubsantrag drei Wochen vorher", "Urlaub wird spätestens drei Wochen vorher beantragt."],
  ["Schutzbrille an Drehbank 4", "An Drehbank 4 gilt ständige Schutzbrillenpflicht."],
  ["Schichtübergabe schriftlich", "Jede Schichtübergabe wird im Schichtbuch festgehalten."],
] as const;
let naechsterInhalt = 0;

async function anlegen(app: App, kopf: Kopf, category = "Anlage 1"): Promise<string> {
  const [title, statement] = INHALTE[naechsterInhalt++ % INHALTE.length] ?? INHALTE[0];
  const res = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: kopf,
    payload: { confidentiality: "intern", title, statement, type: "best_practice", category },
  });
  expect(res.statusCode, res.body).toBe(201);
  return (res.json() as { id: string }).id;
}

function put(app: App, kopf: Kopf, id: string, payload: Record<string, unknown>) {
  return app.inject({ method: "PUT", url: `/api/kos/${id}`, headers: kopf, payload });
}

function befugnis(app: App, admin: Kopf, userId: string, bereiche: unknown) {
  return app.inject({
    method: "PUT",
    url: `/api/users/${userId}`,
    headers: admin,
    payload: { weisungsbefugnis: bereiche },
  });
}

async function stand(app: App, kopf: Kopf, id: string): Promise<Stand> {
  const res = await app.inject({ method: "GET", url: `/api/kos/${id}`, headers: kopf });
  expect(res.statusCode).toBe(200);
  return res.json() as Stand;
}

describe("R-1863 · Antworten 18/19 — Weisungsbefugnis am Konto", () => {
  it("B1 · die Admin-Rolle allein ist keine Weisungsbefugnis", async () => {
    const b = await buehne();
    const id = await anlegen(b.app, b.admin.kopf);
    const res = await put(b.app, b.admin.kopf, id, {
      action: "weisung-validate",
      sichtung: { verantwortlich: b.controller.id, frist: HEUTE },
    });
    expect(res.statusCode, res.body).toBe(403);
    const s = await stand(b.app, b.admin.kopf, id);
    expect(s.status).toBe("offen");
    expect(s.weisungsSichtung).toBeUndefined();
    const belege = await b.services.audit.list({ target: id });
    expect(belege.some((e) => e.action === "ko.weisung-validated")).toBe(false);
  });

  it("B2 · vergeben am Konto, danach gilt die eigene Weisung sofort — mit Sichtung", async () => {
    const b = await buehne();
    const vergabe = await befugnis(b.app, b.admin.kopf, b.leitung.id, ["Anlage 1"]);
    expect(vergabe.statusCode, vergabe.body).toBe(200);
    expect(vergabe.json()).toMatchObject({
      weisungsbefugnis: { bereiche: ["Anlage 1"], erteiltVon: b.admin.id },
    });
    const vermerk = (await b.services.audit.list({ target: b.leitung.id })).find(
      (e) => e.action === "user.weisungsbefugnis-set",
    );
    expect(vermerk?.actor).toBe(b.admin.id);
    expect(vermerk?.payload).toEqual({ bereiche: ["Anlage 1"] });

    const id = await anlegen(b.app, b.leitung.kopf);
    const res = await put(b.app, b.leitung.kopf, id, {
      action: "weisung-validate",
      sichtung: { verantwortlich: b.controller.id, frist: HEUTE },
    });
    expect(res.statusCode, res.body).toBe(200);
    const s = await stand(b.app, b.controller.kopf, id);
    expect(s.status).toBe("validiert");
    expect(s.annahme).toMatchObject({
      fassung: s.version,
      person: b.leitung.id,
      kontoregel: "weisung",
    });
    expect(s.weisungsSichtung).toMatchObject({
      verantwortlich: b.controller.id,
      frist: HEUTE,
      bereich: "Anlage 1",
      erteiltVon: b.leitung.id,
      koVersion: s.version,
    });
    expect(s.weisungsSichtung?.ergebnis).toBeUndefined();
    const beleg = (await b.services.audit.list({ target: id })).find(
      (e) => e.action === "ko.weisung-validated",
    );
    expect(beleg?.payload).toMatchObject({
      koVersion: s.version,
      kontoregel: "weisung",
      bereich: "Anlage 1",
      sichtung: { verantwortlich: b.controller.id, frist: HEUTE },
    });
  });

  it("B3 · ausserhalb des Bereichs 403, am fremden Objekt 403 — beide ohne Wirkung", async () => {
    const b = await buehne();
    await befugnis(b.app, b.admin.kopf, b.leitung.id, ["Anlage 1"]);
    const anderer = await anlegen(b.app, b.leitung.kopf, "Personal");
    const r1 = await put(b.app, b.leitung.kopf, anderer, {
      action: "weisung-validate",
      sichtung: { verantwortlich: b.controller.id, frist: HEUTE },
    });
    expect(r1.statusCode, r1.body).toBe(403);
    expect((await stand(b.app, b.leitung.kopf, anderer)).status).toBe("offen");

    const fremd = await anlegen(b.app, b.controller.kopf);
    const r2 = await put(b.app, b.leitung.kopf, fremd, {
      action: "weisung-validate",
      sichtung: { verantwortlich: b.controller.id, frist: HEUTE },
    });
    expect(r2.statusCode, r2.body).toBe(403);
    expect((r2.json() as { error: string }).error).toBe("NOT_OWNER");
    expect((await stand(b.app, b.leitung.kopf, fremd)).status).toBe("offen");
  });

  it("B4 · ungültige Sichtung: Frist gestern, sich selbst, Konto ohne Recht — je 400", async () => {
    const b = await buehne();
    await befugnis(b.app, b.admin.kopf, b.leitung.id, ["Anlage 1"]);
    const id = await anlegen(b.app, b.leitung.kopf);
    for (const sichtung of [
      { verantwortlich: b.controller.id, frist: GESTERN },
      { verantwortlich: b.controller.id, frist: "2026-02-30" },
      { verantwortlich: b.leitung.id, frist: HEUTE },
      { verantwortlich: b.leser.id, frist: HEUTE },
      { verantwortlich: "gibt-es-nicht", frist: HEUTE },
    ]) {
      const res = await put(b.app, b.leitung.kopf, id, { action: "weisung-validate", sichtung });
      expect(res.statusCode, `${JSON.stringify(sichtung)} · ${res.body}`).toBe(400);
    }
    expect((await stand(b.app, b.leitung.kopf, id)).status).toBe("offen");
  });

  it("B5 · nur die benannte Person sichtet; ihr Widerruf öffnet das Objekt, die Annahme entfällt", async () => {
    const b = await buehne();
    await befugnis(b.app, b.admin.kopf, b.leitung.id, ["Anlage 1"]);
    const id = await anlegen(b.app, b.leitung.kopf);
    await put(b.app, b.leitung.kopf, id, {
      action: "weisung-validate",
      sichtung: { verantwortlich: b.controller.id, frist: HEUTE },
    });
    // Weder die Weisungsgeberin noch der Admin sichten an Stelle der benannten Person.
    for (const kopf of [b.leitung.kopf, b.admin.kopf]) {
      const res = await put(b.app, kopf, id, {
        action: "weisung-sichten",
        sichtung: { ergebnis: "widerrufen" },
      });
      expect(res.statusCode, res.body).toBe(403);
    }
    expect((await stand(b.app, b.controller.kopf, id)).status).toBe("validiert");

    const res = await put(b.app, b.controller.kopf, id, {
      action: "weisung-sichten",
      sichtung: { ergebnis: "widerrufen" },
    });
    expect(res.statusCode, res.body).toBe(200);
    const s = await stand(b.app, b.controller.kopf, id);
    expect(s.status).toBe("offen");
    expect(s.annahme).toBeUndefined();
    expect(s.weisungsSichtung?.ergebnis).toMatchObject({ art: "widerrufen", von: b.controller.id });
    const beleg = (await b.services.audit.list({ target: id })).find(
      (e) => e.action === "ko.weisung-gesichtet",
    );
    expect(beleg?.payload).toMatchObject({ ergebnis: "widerrufen", koVersion: s.version });
  });

  it("B6 · Bestätigen lässt die Weisung gelten; eine zweite Sichtung gibt es nicht", async () => {
    const b = await buehne();
    await befugnis(b.app, b.admin.kopf, b.leitung.id, ["Anlage 1"]);
    const id = await anlegen(b.app, b.leitung.kopf);
    await put(b.app, b.leitung.kopf, id, {
      action: "weisung-validate",
      sichtung: { verantwortlich: b.controller.id, frist: HEUTE },
    });
    const vorher = await stand(b.app, b.controller.kopf, id);
    const ok = await put(b.app, b.controller.kopf, id, {
      action: "weisung-sichten",
      sichtung: { ergebnis: "bestaetigt" },
    });
    expect(ok.statusCode, ok.body).toBe(200);
    const s = await stand(b.app, b.controller.kopf, id);
    expect(s.status).toBe("validiert");
    // Die Annahme bleibt die der Weisung — die Sichtung ist keine zweite Annahme.
    expect(s.annahme).toEqual(vorher.annahme);
    expect(s.weisungsSichtung?.ergebnis).toMatchObject({ art: "bestaetigt" });
    const nochmal = await put(b.app, b.controller.kopf, id, {
      action: "weisung-sichten",
      sichtung: { ergebnis: "widerrufen" },
    });
    expect(nochmal.statusCode, nochmal.body).toBe(400);
    expect((await stand(b.app, b.controller.kopf, id)).status).toBe("validiert");
  });

  it("B7 · Entzug wirkt sofort; eine ungültige Form wird abgewiesen", async () => {
    const b = await buehne();
    await befugnis(b.app, b.admin.kopf, b.leitung.id, ["Anlage 1"]);
    const falsch = await befugnis(b.app, b.admin.kopf, b.leitung.id, "Anlage 1");
    expect(falsch.statusCode).toBe(403);
    // Nicht-Admins vergeben keine Befugnis — auch nicht sich selbst.
    const selbst = await befugnis(b.app, b.leitung.kopf, b.leitung.id, ["*"]);
    expect(selbst.statusCode).toBe(403);
    const entzug = await befugnis(b.app, b.admin.kopf, b.leitung.id, null);
    expect(entzug.statusCode, entzug.body).toBe(200);
    expect((entzug.json() as { weisungsbefugnis?: unknown }).weisungsbefugnis).toBeUndefined();
    const id = await anlegen(b.app, b.leitung.kopf);
    const res = await put(b.app, b.leitung.kopf, id, {
      action: "weisung-validate",
      sichtung: { verantwortlich: b.controller.id, frist: HEUTE },
    });
    expect(res.statusCode, res.body).toBe(403);
  });

  it("B9 · die Sichtung gehört zur gültig gesetzten Fassung — nach einer Inhaltsänderung nicht mehr", async () => {
    const b = await buehne();
    await befugnis(b.app, b.admin.kopf, b.leitung.id, ["Anlage 1"]);
    const id = await anlegen(b.app, b.leitung.kopf);
    await put(b.app, b.leitung.kopf, id, {
      action: "weisung-validate",
      sichtung: { verantwortlich: b.controller.id, frist: HEUTE },
    });
    const vorher = await stand(b.app, b.controller.kopf, id);
    // Überarbeitet wie in `annahme-kontoregel.test.ts` A6 (Admin, gebundene Fassung).
    const revidiert = await put(b.app, b.admin.kopf, id, {
      action: "revise",
      changes: { statement: "Urlaub wird spätestens vier Wochen vorher beantragt." },
      expectedVersion: vorher.version,
    });
    expect(revidiert.statusCode, revidiert.body).toBe(200);
    const nachher = await stand(b.app, b.controller.kopf, id);
    expect(nachher.version).toBe(vorher.version + 1);
    expect(nachher.status).toBe("offen");
    expect(nachher.annahme).toBeUndefined();
    const res = await put(b.app, b.controller.kopf, id, {
      action: "weisung-sichten",
      sichtung: { ergebnis: "bestaetigt" },
    });
    expect(res.statusCode, res.body).toBe(400);
  });

  it("B8 · `*` (ganzes Unternehmen) deckt jeden Bereich", async () => {
    const b = await buehne();
    await befugnis(b.app, b.admin.kopf, b.leitung.id, ["*"]);
    const id = await anlegen(b.app, b.leitung.kopf, "Personal");
    const res = await put(b.app, b.leitung.kopf, id, {
      action: "weisung-validate",
      sichtung: { verantwortlich: b.controller.id, frist: HEUTE },
    });
    expect(res.statusCode, res.body).toBe(200);
    expect((await stand(b.app, b.controller.kopf, id)).weisungsSichtung?.bereich).toBe("Personal");
  });
});
