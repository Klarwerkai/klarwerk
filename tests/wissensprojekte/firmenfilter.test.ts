// ================================================================================================
// FIRMENFILTER — eigene Firma, ausdrücklich erlaubte Partnerbereiche, öffentliche Quellen.
// ================================================================================================
//
// Auftrag `aufnahme:20260922:gesamt-wissensprojekte`, Kriterium „Firmen- und Projektfilter stimmen“.
// Pedis Entscheidung (Frage 51, 11.10.2026): „Firmenfilter als serverseitig berechtigter Firmen-/
// Partner-/öffentlicher Kontext.“ Gemessen an der ECHTEN App (`buildApp`, Speicherablage). Alle
// Namen und Inhalte sind erfundene Testdaten.
//
//   Lea    (experte)    — zuständig für „Werkstatt Nord“ und den Partnerbereich „Müller AG“
//   Erik   (experte)    — Mitglied von Werkstatt Nord und Müller AG (schreiben), Autor
//   Carla  (controller) — legt an; zuständig für „Hausweit“, „Beta GmbH“ und „Normen“
//   Fritz  (experte)    — nur im Partnerbereich „Beta GmbH“ ausdrücklich berechtigt
//   Admin  (admin)      — verwaltet Konten, in keinem Bereich Mitglied
//
// Konkrete Fälle:
//   F1 · eigene Inhalte: ohne Space, in einem offenen und einem geschlossenen Firmen-Space.
//   F2 · erlaubte Partnerinhalte erscheinen, nicht erlaubte nicht — auch nicht für die Rolle Admin,
//        auch nicht über den Detailabruf; die Partnerliste nennt nur Erlaubtes.
//   F3 · öffentliche Quellen für jeden mit Leserecht.
//   F4 · die Kontextregeln werden serverseitig erzwungen (Partner nie „alle“, öffentlich nie
//        „mitglieder“); Altbestand ohne Kontext zählt als eigene Firma.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
type Kopf = { authorization: string };

const KENNWORT = "geheim12345";

async function anmelden(app: App, email: string): Promise<Kopf> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: KENNWORT },
  });
  expect(res.statusCode, `Anmeldung ${email}: ${res.body}`).toBe(200);
  return { authorization: `Bearer ${res.json().token}` };
}

async function buehne() {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Admin", email: "admin@filter.test", password: KENNWORT },
  });
  const admin = await anmelden(app, "admin@filter.test");
  for (const [name, email, role] of [
    ["Lea Leitung", "lea@filter.test", "experte"],
    ["Erik Experte", "erik@filter.test", "experte"],
    ["Carla Controller", "carla@filter.test", "controller"],
    ["Fritz Fremd", "fritz@filter.test", "experte"],
  ] as const) {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin,
      payload: { name, email, password: KENNWORT, role },
    });
    expect(res.statusCode, `Konto ${email}: ${res.body}`).toBe(201);
  }
  const k = {
    admin,
    lea: await anmelden(app, "lea@filter.test"),
    erik: await anmelden(app, "erik@filter.test"),
    carla: await anmelden(app, "carla@filter.test"),
    fritz: await anmelden(app, "fritz@filter.test"),
  };
  const kontenRes = await app.inject({ method: "GET", url: "/api/spaces/konten", headers: k.erik });
  const konten = kontenRes.json().konten as { id: string; name: string }[];
  const id = (name: string): string => konten.find((x) => x.name === name)?.id ?? "";
  const ids = {
    lea: id("Lea Leitung"),
    erik: id("Erik Experte"),
    carla: id("Carla Controller"),
    fritz: id("Fritz Fremd"),
  };
  return { app, services, k, ids };
}

type Buehne = Awaited<ReturnType<typeof buehne>>;

async function anlegen(b: Buehne, payload: Record<string, unknown>) {
  return b.app.inject({ method: "POST", url: "/api/spaces", headers: b.k.carla, payload });
}

async function spaceAnlegen(b: Buehne, payload: Record<string, unknown>): Promise<string> {
  const res = await anlegen(b, { ansichten: [], ...payload });
  expect(res.statusCode, res.body).toBe(201);
  return res.json().id as string;
}

async function artikel(b: Buehne, kopf: Kopf, titel: string): Promise<string> {
  const res = await b.app.inject({
    method: "POST",
    url: "/api/kos",
    headers: kopf,
    payload: {
      confidentiality: "intern",
      title: titel,
      statement: `${titel} — Testaussage für den Firmenfilter.`,
      type: "best_practice",
      category: "Prüfmittel",
      tags: ["filterprobe"],
    },
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json().id as string;
}

async function hinein(b: Buehne, kopf: Kopf, koId: string, zielSpaceId: string): Promise<void> {
  const v = await b.app.inject({
    method: "POST",
    url: "/api/spaces/verschiebung/vorschau",
    headers: kopf,
    payload: { koId, zielSpaceId },
  });
  expect(v.statusCode, v.body).toBe(200);
  const vj = v.json();
  const res = await b.app.inject({
    method: "POST",
    url: "/api/spaces/verschiebung",
    headers: kopf,
    payload: {
      koId,
      zielSpaceId,
      basis: {
        quelleId: vj.quelle?.id ?? null,
        quelleVersion: vj.quelle?.version ?? null,
        zielId: vj.ziel?.id ?? null,
        zielVersion: vj.ziel?.version ?? null,
      },
    },
  });
  expect(res.statusCode, res.body).toBe(200);
}

/** Bestand mit je einem Artikel pro Fall. */
async function bestand(b: Buehne) {
  const { ids } = b;
  const werkstatt = await spaceAnlegen(b, {
    name: "Werkstatt Nord",
    zweck: "Eigene Prüfmittel.",
    verantwortlich: ids.lea,
    zugang: "mitglieder",
    mitglieder: [{ nutzer: ids.erik, recht: "schreiben" }],
    kontext: "firma",
  });
  const hausweit = await spaceAnlegen(b, {
    name: "Hausweit",
    zweck: "Für alle im Haus.",
    verantwortlich: ids.carla,
    zugang: "alle",
    mitglieder: [],
  });
  const mueller = await spaceAnlegen(b, {
    name: "Projekt mit Müller",
    zweck: "Gemeinsame Prüfpläne mit der Müller AG.",
    verantwortlich: ids.lea,
    zugang: "mitglieder",
    mitglieder: [{ nutzer: ids.erik, recht: "schreiben" }],
    kontext: "partner",
    partner: "Müller AG",
  });
  const beta = await spaceAnlegen(b, {
    name: "Projekt mit Beta",
    zweck: "Lieferantenabstimmung mit der Beta GmbH.",
    verantwortlich: ids.carla,
    zugang: "mitglieder",
    mitglieder: [{ nutzer: ids.fritz, recht: "schreiben" }],
    kontext: "partner",
    partner: "Beta GmbH",
  });
  const normen = await spaceAnlegen(b, {
    name: "Normen",
    zweck: "Öffentlich zugängliche Normen und Richtlinien.",
    verantwortlich: ids.carla,
    zugang: "alle",
    mitglieder: [],
    kontext: "oeffentlich",
  });

  const ohneSpace = await artikel(b, b.k.erik, "Eigene Notiz ohne Space");
  const eigenGeschlossen = await artikel(b, b.k.erik, "Werkstattanweisung");
  await hinein(b, b.k.erik, eigenGeschlossen, werkstatt);
  const eigenOffen = await artikel(b, b.k.erik, "Hausregel Messraum");
  await hinein(b, b.k.erik, eigenOffen, hausweit);
  const partnerErlaubt = await artikel(b, b.k.erik, "Prüfplan Müller");
  await hinein(b, b.k.erik, partnerErlaubt, mueller);
  const partnerFremd = await artikel(b, b.k.fritz, "Liefervereinbarung Beta");
  await hinein(b, b.k.fritz, partnerFremd, beta);
  const oeffentlich = await artikel(b, b.k.erik, "DIN-Hinweis Messmittel");
  await hinein(b, b.k.erik, oeffentlich, normen);
  return {
    spaces: { werkstatt, hausweit, mueller, beta, normen },
    ko: { ohneSpace, eigenGeschlossen, eigenOffen, partnerErlaubt, partnerFremd, oeffentlich },
  };
}

async function filter(b: Buehne, kopf: Kopf, query: string) {
  const res = await b.app.inject({
    method: "GET",
    url: `/api/spaces/artikel?${query}`,
    headers: kopf,
  });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as {
    artikel: { id: string; kontext: string; partner: string | null }[];
    partnerBereiche: string[];
  };
}

const ids = (liste: { id: string }[]): string[] => liste.map((x) => x.id).sort();

describe("F1 · eigene Firma", () => {
  it("zeigt eigene Inhalte — ohne Space, offen und geschlossen — und nichts aus Partner oder öffentlich", async () => {
    const b = await buehne();
    const { ko } = await bestand(b);
    const erik = await filter(b, b.k.erik, "kontext=firma");
    expect(ids(erik.artikel)).toEqual([ko.ohneSpace, ko.eigenGeschlossen, ko.eigenOffen].sort());
    expect(erik.artikel.every((a) => a.kontext === "firma")).toBe(true);
    // Fritz ist im geschlossenen Firmen-Space kein Mitglied: der Filter gibt nichts Verborgenes her.
    const fritz = await filter(b, b.k.fritz, "kontext=firma");
    expect(ids(fritz.artikel)).toEqual([ko.ohneSpace, ko.eigenOffen].sort());
  });
});

describe("F2 · Partnerbereiche nur ausdrücklich erlaubt", () => {
  it("erlaubte Partnerinhalte erscheinen, fremde nicht — auch nicht mit Partnername oder Detailabruf", async () => {
    const b = await buehne();
    const { ko } = await bestand(b);

    const erik = await filter(b, b.k.erik, "kontext=partner");
    expect(ids(erik.artikel)).toEqual([ko.partnerErlaubt]);
    expect(erik.artikel[0]).toMatchObject({ kontext: "partner", partner: "Müller AG" });
    expect(erik.partnerBereiche).toEqual(["Müller AG"]);
    const fremderPartner = `kontext=partner&partner=${encodeURIComponent("Beta GmbH")}`;
    const gezielt = await filter(b, b.k.erik, fremderPartner);
    expect(gezielt.artikel).toEqual([]);

    const fritz = await filter(b, b.k.fritz, "kontext=partner");
    expect(ids(fritz.artikel)).toEqual([ko.partnerFremd]);
    expect(fritz.partnerBereiche).toEqual(["Beta GmbH"]);
    const detail = await b.app.inject({
      method: "GET",
      url: `/api/kos/${ko.partnerErlaubt}`,
      headers: b.k.fritz,
    });
    expect(detail.statusCode).toBe(404);
    expect(detail.body).not.toContain("Prüfplan Müller");

    // Die Rolle öffnet keinen Partnerbereich: die Kontoverwaltung kennt die Bereiche, nicht die Inhalte.
    const admin = await filter(b, b.k.admin, "kontext=partner");
    expect(admin.artikel).toEqual([]);
    expect(admin.partnerBereiche).toEqual(["Beta GmbH", "Müller AG"]);

    // Die Spaceliste im Partnerkontext: nur die Bereiche, in denen Erik berechtigt ist.
    const liste = await b.app.inject({
      method: "GET",
      url: "/api/spaces?kontext=partner",
      headers: b.k.erik,
    });
    expect(liste.statusCode, liste.body).toBe(200);
    const namen = (liste.json().spaces as { name: string; partner: string }[]).map((s) => [
      s.name,
      s.partner,
    ]);
    expect(namen).toEqual([["Projekt mit Müller", "Müller AG"]]);
  });
});

describe("F3 · öffentliche Quellen", () => {
  it("erscheinen für jeden mit Leserecht und nur im öffentlichen Kontext", async () => {
    const b = await buehne();
    const { ko } = await bestand(b);
    for (const kopf of [b.k.erik, b.k.fritz, b.k.admin]) {
      const oeff = await filter(b, kopf, "kontext=oeffentlich");
      expect(ids(oeff.artikel)).toEqual([ko.oeffentlich]);
      expect(oeff.artikel[0]?.kontext).toBe("oeffentlich");
    }
    const firma = await filter(b, b.k.erik, "kontext=firma");
    expect(ids(firma.artikel)).not.toContain(ko.oeffentlich);
  });
});

describe("F4 · Kontextregeln serverseitig", () => {
  it("Partner nie für alle, öffentlich nie nur für Mitglieder, Partner nur mit Namen", async () => {
    const b = await buehne();
    const { ids: konto } = b;
    const basis = { zweck: "Probe.", verantwortlich: konto.carla, mitglieder: [], ansichten: [] };
    const partnerAlle = await anlegen(b, {
      ...basis,
      name: "Offen für alle?",
      zugang: "alle",
      kontext: "partner",
      partner: "Müller AG",
    });
    expect(partnerAlle.statusCode).toBe(400);
    expect(partnerAlle.json().error).toBe("SPACE_KONTEXT_ZUGANG");
    const oeffGeschlossen = await anlegen(b, {
      ...basis,
      name: "Geschlossen öffentlich?",
      zugang: "mitglieder",
      kontext: "oeffentlich",
    });
    expect(oeffGeschlossen.statusCode).toBe(400);
    expect(oeffGeschlossen.json().error).toBe("SPACE_KONTEXT_ZUGANG");
    const ohneName = await anlegen(b, {
      ...basis,
      name: "Partner ohne Namen",
      zugang: "mitglieder",
      kontext: "partner",
    });
    expect(ohneName.statusCode).toBe(400);
    const unbekannt = await anlegen(b, { ...basis, name: "X", zugang: "alle", kontext: "konzern" });
    expect(unbekannt.statusCode).toBe(400);

    // Ein bestehender Space lässt sich nicht still zu einem offenen Partnerbereich machen.
    const id = await spaceAnlegen(b, { ...basis, name: "Hausweit", zugang: "alle" });
    const aendern = await b.app.inject({
      method: "PUT",
      url: `/api/spaces/${id}`,
      headers: b.k.carla,
      payload: {
        ...basis,
        version: 1,
        name: "Hausweit",
        zugang: "alle",
        kontext: "partner",
        partner: "X",
      },
    });
    expect(aendern.statusCode).toBe(400);
    expect(aendern.json().error).toBe("SPACE_KONTEXT_ZUGANG");

    for (const query of ["", "kontext=konzern"]) {
      const res = await b.app.inject({
        method: "GET",
        url: `/api/spaces/artikel?${query}`,
        headers: b.k.erik,
      });
      expect(res.statusCode, query).toBe(400);
      expect(res.json().error).toBe("KONTEXT_UNGUELTIG");
    }
  });

  it("Altbestand ohne Kontext zählt als eigene Firma", async () => {
    const b = await buehne();
    await b.services.spaces.lege({
      id: "altbestand-1",
      version: 1,
      name: "Altbestand",
      zweck: "Vor dem Firmenfilter angelegt.",
      verantwortlich: b.ids.carla,
      zugang: "alle",
      mitglieder: [],
      ansichten: [],
      angelegtVon: b.ids.carla,
      angelegtAm: "2026-10-01T08:00:00.000Z",
      geaendertVon: b.ids.carla,
      geaendertAm: "2026-10-01T08:00:00.000Z",
    });
    const res = await b.app.inject({
      method: "GET",
      url: "/api/spaces?kontext=firma",
      headers: b.k.erik,
    });
    expect(res.statusCode, res.body).toBe(200);
    const liste = res.json().spaces as { id: string; kontext: string; partner: string | null }[];
    const alt = liste.find((s) => s.id === "altbestand-1");
    expect(alt).toMatchObject({ kontext: "firma", partner: null });
  });
});
