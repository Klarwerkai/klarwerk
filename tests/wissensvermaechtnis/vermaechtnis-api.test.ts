// ================================================================================================
// WISSENS-VERMÄCHTNIS-BUCH · DER DRAHT — `GET /api/verantwortung/person/:id/vermaechtnis`.
// ================================================================================================
//
// Gemessen an der ECHTEN App (`buildApp`, Speicherablage). Alle Konten und Inhalte sind erfundene
// Testdaten dieses Falls:
//
//   Ada    (admin)   — Kontoverwaltung, erzeugt das Buch
//   Rita   (experte) — geht in Rente; Autorin von sechs Beiträgen:
//                        R1, R2 validiert (Kategorie „Prüfmittel"), R3 validiert („Wartung"),
//                        V1 validiert, aber vertraulich, O1 offen (nicht validiert), P1 validiert
//                        und im Papierkorb. R3 wird danach an Nora übergeben (`transfer-author`).
//   Nora   (experte) — Nachfolgerin; Autorin eines eigenen Beitrags N1, der NICHT ins Buch gehört
//
// Ordnung zu den Originalkriterien (AUFTRAG-B1.json):
//   K1 · R-1642 „Wissens-Vermächtnis-Export für ausscheidende Mitarbeiter": auf Knopfdruck ein
//        digitales (Markdown-Datei) bzw. druckbares Buch mit allen Beiträgen der Person.
//   K2 · R-2175 „Vermächtnis-Buch aus dem Wissen einer Person": thematischer (Kapitel je Thema) und
//        biografischer Weg (Zeitleiste), mit dem Namen der Person als Würdigung.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
type Kopf = { authorization: string };

const KENNWORT = "geheim12345";

interface Buch {
  person: { id: string; name: string | null };
  titel: string;
  dateiname: string;
  aufgenommen: number;
  zeitraum: { von: string; bis: string } | null;
  themen: { thema: string; anzahl: number }[];
  ausgelassen: {
    papierkorb: number;
    nichtEinsehbar: number;
    vertraulich: number;
    nichtValidiert: number;
  };
  markdown: string;
  provenance: { koId: string }[];
}

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
    payload: { name: "Ada Admin", email: "ada@vermaechtnis.test", password: KENNWORT },
  });
  const admin = await anmelden(app, "ada@vermaechtnis.test");
  for (const [name, email] of [
    ["Rita Ruhestand", "rita@vermaechtnis.test"],
    ["Nora Nachfolge", "nora@vermaechtnis.test"],
  ] as const) {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin,
      payload: { name, email, password: KENNWORT, role: "experte" },
    });
    expect(res.statusCode, `Konto ${email}: ${res.body}`).toBe(201);
  }
  const liste = await app.inject({ method: "GET", url: "/api/users", headers: admin });
  const id = (name: string): string =>
    (liste.json() as { id: string; name: string }[]).find((k) => k.name === name)?.id ?? "";
  const ids = { ada: id("Ada Admin"), rita: id("Rita Ruhestand"), nora: id("Nora Nachfolge") };
  const k = {
    admin,
    rita: await anmelden(app, "rita@vermaechtnis.test"),
    nora: await anmelden(app, "nora@vermaechtnis.test"),
  };

  const anlegen = async (
    kopf: Kopf,
    titel: string,
    category: string,
    stufe = "intern",
  ): Promise<string> => {
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers: kopf,
      payload: {
        confidentiality: stufe,
        title: titel,
        statement: `${titel}: so hat es sich in dreissig Jahren bewährt.`,
        type: "best_practice",
        category,
      },
    });
    expect(res.statusCode, res.body).toBe(201);
    return res.json().id as string;
  };
  const ko = {
    r1: await anlegen(k.rita, "Drehmoment an Linie 1 prüfen", "Prüfmittel"),
    r2: await anlegen(k.rita, "Messschieber vor Schichtbeginn nullen", "Prüfmittel"),
    r3: await anlegen(k.rita, "Lager der Presse 4 hören", "Wartung"),
    v1: await anlegen(k.rita, "Zugang zum Kalibrierlabor", "Prüfmittel", "vertraulich"),
    o1: await anlegen(k.rita, "Unfertige Notiz zur Kühlung", "Wartung"),
    p1: await anlegen(k.rita, "Alter Ablauf am Wareneingang", "Wareneingang"),
    n1: await anlegen(k.nora, "Noras eigener Beitrag", "Prüfmittel"),
  };
  for (const koId of [ko.r1, ko.r2, ko.r3, ko.v1, ko.p1, ko.n1]) {
    await services.validation.adminValidate(koId, ids.ada);
  }
  await services.ko.delete(ko.p1, ids.ada);
  // Die Autorschaft von R3 geht an Nora — Rita bleibt ursprüngliche Autorin.
  await services.lifecycle.transferAuthor(ko.r3, ids.nora, ids.ada);
  return { app, services, k, ids, ko };
}

type Buehne = Awaited<ReturnType<typeof buehne>>;

async function buchVon(b: Buehne, person: string, kopf: Kopf = b.k.admin) {
  return b.app.inject({
    method: "GET",
    url: `/api/verantwortung/person/${person}/vermaechtnis`,
    headers: kopf,
  });
}

describe("K1 · Wissens-Vermächtnis-Export für ausscheidende Mitarbeiter (R-1642)", () => {
  it("ein Aufruf liefert das ganze Buch: alle aufnehmbaren Beiträge der Person, als Datei benannt", async () => {
    const b = await buehne();
    const res = await buchVon(b, b.ids.rita);
    expect(res.statusCode, res.body).toBe(200);
    const buch = res.json() as Buch;

    expect(buch.person).toEqual({ id: b.ids.rita, name: "Rita Ruhestand" });
    expect(buch.titel).toBe("Wissens-Vermächtnis von Rita Ruhestand");
    expect(buch.dateiname).toMatch(/^klarwerk-vermaechtnis-rita-ruhestand-\d{4}-\d{2}-\d{2}\.md$/);
    // R1, R2 und R3 (R3 trotz Autorenübergabe — Rita bleibt ursprüngliche Autorin).
    expect(buch.aufgenommen).toBe(3);
    expect(buch.provenance.map((p) => p.koId).sort()).toEqual([b.ko.r1, b.ko.r2, b.ko.r3].sort());
    for (const titel of [
      "Drehmoment an Linie 1 prüfen",
      "Messschieber vor Schichtbeginn nullen",
      "Lager der Presse 4 hören",
    ]) {
      expect(buch.markdown).toContain(`### ${titel}`);
    }
    expect(buch.markdown).toContain("Rita Ruhestand (heute bei Nora Nachfolge)");
  });

  it("nicht Aufgenommenes steht mit Grund und Anzahl darin — ohne Titel, ohne Inhalt", async () => {
    const b = await buehne();
    const buch = (await buchVon(b, b.ids.rita)).json() as Buch;
    expect(buch.ausgelassen).toEqual({
      papierkorb: 1,
      nichtEinsehbar: 0,
      vertraulich: 1,
      nichtValidiert: 1,
    });
    expect(buch.markdown).toContain("## Nicht aufgenommen");
    for (const geheim of [
      "Zugang zum Kalibrierlabor",
      "Unfertige Notiz zur Kühlung",
      "Alter Ablauf am Wareneingang",
      "Noras eigener Beitrag",
    ]) {
      expect(buch.markdown, geheim).not.toContain(geheim);
    }
  });

  it("schreibt kein Wissen und protokolliert nur Zähler", async () => {
    const b = await buehne();
    const vorher = await b.services.ko.listEinschliesslichPapierkorb();
    const res = await buchVon(b, b.ids.rita);
    expect(res.statusCode, res.body).toBe(200);
    const nachher = await b.services.ko.listEinschliesslichPapierkorb();
    expect(nachher).toEqual(vorher);

    const eintraege = (await b.services.audit.list()).filter(
      (x) => x.action === "vermaechtnis.erzeugt",
    );
    expect(eintraege).toHaveLength(1);
    expect(eintraege[0]?.actor).toBe(b.ids.ada);
    expect(eintraege[0]?.target).toBe(b.ids.rita);
    expect(eintraege[0]?.payload).toEqual({
      aufgenommen: 3,
      ausgelassen: { papierkorb: 1, nichtEinsehbar: 0, vertraulich: 1, nichtValidiert: 1 },
    });
    expect(JSON.stringify(eintraege[0]?.payload)).not.toContain("Drehmoment");
  });

  it("nur die Kontoverwaltung — und eine unbekannte Kennung ist 404", async () => {
    const b = await buehne();
    expect((await buchVon(b, b.ids.rita, b.k.nora)).statusCode).toBe(403);
    expect((await buchVon(b, b.ids.rita, b.k.rita)).statusCode).toBe(403);
    expect((await buchVon(b, "gibt-es-nicht")).statusCode).toBe(404);
    // Ein Konto ohne Beitrag bekommt ein leeres, aber ehrliches Buch.
    const ada = (await buchVon(b, b.ids.ada)).json() as Buch;
    expect(ada.aufgenommen).toBe(0);
    expect(ada.zeitraum).toBeNull();
    expect(ada.markdown).toContain("## Noch keine aufgenommenen Beiträge");
  });
});

describe("K2 · Vermächtnis-Buch aus dem Wissen einer Person (R-2175)", () => {
  it("thematischer Weg: je Thema ein Kapitel; biografischer Weg: die Zeitleiste; Würdigung mit Namen", async () => {
    const b = await buehne();
    const buch = (await buchVon(b, b.ids.rita)).json() as Buch;
    expect(buch.themen).toEqual([
      { thema: "Prüfmittel", anzahl: 2 },
      { thema: "Wartung", anzahl: 1 },
    ]);
    expect(buch.markdown).toContain("## Kapitel 1: Prüfmittel");
    expect(buch.markdown).toContain("## Kapitel 2: Wartung");
    expect(buch.markdown.indexOf("## Kapitel 1: Prüfmittel")).toBeLessThan(
      buch.markdown.indexOf("## Kapitel 2: Wartung"),
    );
    expect(buch.markdown).toContain("## Zeitleiste");
    expect(buch.zeitraum).not.toBeNull();
    expect(buch.markdown).toContain(`- **${buch.zeitraum?.von.slice(0, 4)}** — 3:`);
    expect(buch.markdown).toContain("## Vorwort");
    expect(buch.markdown).toContain("das Rita Ruhestand in KLARWERK festgehalten hat");
    expect(buch.markdown).toContain("## Herkunft & Nachweis");
  });

  it("Noras Buch: ihr eigener Beitrag und der übernommene R3 — mit ehrlicher Autorenzeile", async () => {
    const b = await buehne();
    const buch = (await buchVon(b, b.ids.nora)).json() as Buch;
    // N1 (eigener Beitrag) und R3 (heute bei Nora, ursprünglich Rita) — beide mit ehrlicher Zeile.
    expect(buch.provenance.map((p) => p.koId).sort()).toEqual([b.ko.n1, b.ko.r3].sort());
    expect(buch.markdown).toContain("Rita Ruhestand (heute bei Nora Nachfolge)");
  });
});
