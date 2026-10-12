// ================================================================================================
// R-1631 (aufnahme:20260922:gesamt-anlagenzugang · Ben Nacharbeit 1) — BAUTEIL, MATERIAL UND
// GELTUNGSKONTEXT AM STÜCK: DIENST, ROUTEN, BIBLIOTHEKSSUCHE.
// ================================================================================================
// D1–D3 am echten `KoService` (InMemory-Ablage, echtes Audit): Normalform, Ersetzen, Entfernen,
// Protokoll. R1–R3 ohne Dienst-, Routen- oder Suchattrappen: `buildApp(buildServices())`, Konto über
// die echten Auth-Routen, Anlage über `POST /api/kos`, Pflege über `PUT /api/kos/:id`
// (`action: "anlagenkontext"`), gelesen über `GET /api/library/search`. Die TATSÄCHLICHEN
// Antwortobjekte laufen anschließend durch dieselbe Facettenableitung (`libraryFilterValues`),
// denselben Facettenfilter (`applyFacetSelection`) und denselben Kontextfilter (`passtZumKontext`),
// den die Bibliotheksfläche nach einem QR-Scan anwendet.
import { describe, expect, it } from "vitest";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import {
  BEZUG_ARTEN,
  anlagenPfad,
  kontextAusParams,
  passtZumKontext,
} from "../../apps/web/src/lib/anlagenzugang";
import { applyFacetSelection } from "../../apps/web/src/lib/facets";
import { libraryFilterValues } from "../../apps/web/src/lib/libraryFacets";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import { InMemoryKoRepo, InMemoryKoVersionRepo, KoService } from "../../services/knowledge-object";

const NOW = Date.parse("2026-10-07T00:00:00.000Z");

describe("R-1631 · Dienst: Bauteile, Materialien, Geltungskontext", () => {
  function stack() {
    const audit = new AuditService({ repo: new InMemoryAuditRepo() });
    const ko = new KoService({
      repo: new InMemoryKoRepo(),
      versions: new InMemoryKoVersionRepo(),
      audit,
    });
    return { ko, audit };
  }
  const EINGABE = {
    title: "Dichtung tauschen",
    statement: "Dichtung bei Leckage tauschen.",
    type: "best_practice" as const,
    category: "Instandhaltung",
    author: "anna",
    asset: "DP-4",
  };

  it("D1 · Anlegen speichert die Normalform; leere Listen und Doppelte fallen weg", async () => {
    const { ko } = stack();
    const erstellt = await ko.create({
      ...EINGABE,
      anlagenkontext: {
        bauteile: ["  BT-4711 ", "BT-4711", "BT 4712"],
        materialien: [],
        standorte: ["Werk  Nord"],
      },
    });
    expect(erstellt.anlagenkontext).toEqual({
      bauteile: ["BT-4711", "BT 4712"],
      standorte: ["Werk Nord"],
    });
    const ohne = await ko.create({ ...EINGABE, anlagenkontext: { bauteile: ["  "] } });
    expect("anlagenkontext" in ohne).toBe(false);
  });

  it("D2 · Setzen ersetzt den Stand, protokolliert vorher/nachher; leer entfernt das Feld", async () => {
    const { ko, audit } = stack();
    const erstellt = await ko.create({ ...EINGABE });
    await ko.setAnlagenkontext(
      erstellt.id,
      { materialien: ["1.4301"], schichten: ["Nacht"] },
      "bernd",
    );
    expect((await ko.get(erstellt.id))?.anlagenkontext).toEqual({
      materialien: ["1.4301"],
      schichten: ["Nacht"],
    });
    await ko.setAnlagenkontext(erstellt.id, {}, "bernd");
    const nachher = await ko.get(erstellt.id);
    expect(nachher && "anlagenkontext" in nachher).toBe(false);
    expect(nachher?.asset, "die Anlage bleibt unberührt").toBe("DP-4");
    const belege = await audit.list({ action: "ko.anlagenkontext-changed", target: erstellt.id });
    expect(belege.map((e) => e.payload)).toEqual(
      expect.arrayContaining([
        { vorher: null, nachher: { materialien: ["1.4301"], schichten: ["Nacht"] } },
        { vorher: { materialien: ["1.4301"], schichten: ["Nacht"] }, nachher: null },
      ]),
    );
    expect(belege).toHaveLength(2);
  });

  it("D3 · derselbe Stand (anders geschrieben) erzeugt keinen Beleg; eine Revision behält ihn", async () => {
    const { ko, audit } = stack();
    const erstellt = await ko.create({ ...EINGABE, anlagenkontext: { bauteile: ["BT-1"] } });
    await ko.setAnlagenkontext(erstellt.id, { bauteile: [" BT-1 "] }, "bernd");
    expect(
      await audit.list({ action: "ko.anlagenkontext-changed", target: erstellt.id }),
    ).toHaveLength(0);
    await ko.revise(erstellt.id, { title: "Dichtung sofort tauschen" }, "bernd");
    expect((await ko.get(erstellt.id))?.anlagenkontext).toEqual({ bauteile: ["BT-1"] });
  });
});

type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };

async function setup(): Promise<{ app: App; auth: Auth }> {
  const app = buildApp(buildServices());
  const reg = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "admin@anlagenzugang.test", password: "geheim12345" },
  });
  expect([200, 201], `Registrierung: ${reg.body}`).toContain(reg.statusCode);
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "admin@anlagenzugang.test", password: "geheim12345" },
  });
  expect(login.statusCode, `Anmeldung: ${login.body}`).toBe(200);
  return { app, auth: { authorization: `Bearer ${login.json().token}` } };
}

async function anlegen(
  app: App,
  auth: Auth,
  titel: string,
  asset: string,
  anlagenkontext?: unknown,
): Promise<{ statusCode: number; id: string; body: string }> {
  const res = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: auth,
    payload: {
      confidentiality: "intern",
      title: titel,
      type: "best_practice",
      category: "Anlagenzugang",
      statement: `${titel} — Aussage.`,
      asset,
      ...(anlagenkontext === undefined ? {} : { anlagenkontext }),
    },
  });
  return {
    statusCode: res.statusCode,
    id: res.statusCode === 201 ? res.json().id : "",
    body: res.body,
  };
}

async function suche(app: App, auth: Auth): Promise<KnowledgeObject[]> {
  const res = await app.inject({ method: "GET", url: "/api/library/search", headers: auth });
  expect(res.statusCode, `Suche: ${res.body}`).toBe(200);
  return res.json() as KnowledgeObject[];
}

/** Genau das, was die Bibliothek mit der Adresse eines QR-Codes tut: Facette UND Kontext. */
function qrTreffer(liste: readonly KnowledgeObject[], adresse: string): string[] {
  const params = new URL(adresse, "https://klarwerk.example").searchParams;
  const auswahl: Record<string, string[]> = {};
  for (const art of BEZUG_ARTEN) {
    const wert = params.get(art);
    if (wert) {
      auswahl[art] = [wert];
    }
  }
  const kontext = kontextAusParams(params);
  return applyFacetSelection(liste, (k) => libraryFilterValues(k, NOW), auswahl)
    .filter((k) => passtZumKontext(k, kontext))
    .map((k) => k.id)
    .sort();
}

describe("R-1631 · über die öffentlichen Routen bis in die Bibliothekssuche", () => {
  it("R1 · Bauteil-Nummer und Material-Code öffnen genau das gekoppelte Wissen", async () => {
    const { app, auth } = await setup();
    try {
      const a = await anlegen(app, auth, "Lager wechseln", "DP-4", { bauteile: ["BT-4711"] });
      const b = await anlegen(app, auth, "Schweißnaht prüfen", "DP-5", { materialien: ["1.4301"] });
      const c = await anlegen(app, auth, "Spindel schmieren", "DP-5");
      for (const x of [a, b, c]) {
        expect(x.statusCode, x.body).toBe(201);
      }
      const liste = await suche(app, auth);
      expect(qrTreffer(liste, "/bibliothek?bauteil=BT-4711")).toEqual([a.id]);
      expect(qrTreffer(liste, "/bibliothek?material=1.4301")).toEqual([b.id]);
      expect(qrTreffer(liste, "/bibliothek?asset=DP-5").sort()).toEqual([b.id, c.id].sort());

      // Nachträglich koppeln: dasselbe Wissen ist danach auch über das Material erreichbar.
      const gesetzt = await app.inject({
        method: "PUT",
        url: `/api/kos/${c.id}`,
        headers: auth,
        payload: { action: "anlagenkontext", anlagenkontext: { materialien: ["1.4301"] } },
      });
      expect(gesetzt.statusCode, gesetzt.body).toBe(200);
      expect(qrTreffer(await suche(app, auth), "/bibliothek?material=1.4301")).toEqual(
        [b.id, c.id].sort(),
      );
    } finally {
      await app.close();
    }
  });

  it("R2 · Version, Standort, Schicht: unterschiedlich geltendes Wissen derselben Anlage", async () => {
    const { app, auth } = await setup();
    try {
      const allgemein = await anlegen(app, auth, "Not-Aus prüfen", "PR-9");
      const nord = await anlegen(app, auth, "Hydraulik Nord", "PR-9", { standorte: ["Werk Nord"] });
      const sued = await anlegen(app, auth, "Hydraulik Süd", "PR-9", { standorte: ["Werk Süd"] });
      const nacht = await anlegen(app, auth, "Nachtreinigung", "PR-9", { schichten: ["Nacht"] });
      const revB = await anlegen(app, auth, "Steuerung Rev B", "PR-9", { versionen: ["Rev B"] });
      const revA = await anlegen(app, auth, "Steuerung Rev A", "PR-9", { versionen: ["Rev A"] });
      for (const x of [allgemein, nord, sued, nacht, revB, revA]) {
        expect(x.statusCode, x.body).toBe(201);
      }
      const liste = await suche(app, auth);
      const alle = [allgemein, nord, sued, nacht, revB, revA].map((x) => x.id).sort();
      expect(qrTreffer(liste, "/bibliothek?asset=PR-9"), "ohne Kontext: alles zur Anlage").toEqual(
        alle,
      );
      expect(
        qrTreffer(
          liste,
          "/bibliothek?asset=PR-9&standort=Werk+Nord&schicht=Fr%C3%BCh&anlagenversion=Rev+B",
        ),
        "Werk Nord, Frühschicht, Rev B: allgemeines und dafür geltendes Wissen",
      ).toEqual([allgemein.id, nord.id, revB.id].sort());
      expect(
        qrTreffer(liste, "/bibliothek?asset=PR-9&standort=Werk+S%C3%BCd&schicht=Nacht"),
        "Werk Süd, Nachtschicht",
      ).toEqual([allgemein.id, sued.id, nacht.id, revB.id, revA.id].sort());
    } finally {
      await app.close();
    }
  });

  it("R4 · mehrere Anlagen (R-0082): der QR-Code JEDER Anlage öffnet das Objekt", async () => {
    // Integration nacharbeit-26: main führt `assets` (Liste) ein, `asset` spiegelt die erste. Der
    // Anlagenzugang liest über `anlagenVon` — ein Objekt an zwei Anlagen ist über beide erreichbar,
    // und der Geltungskontext wirkt dabei unverändert.
    const { app, auth } = await setup();
    try {
      const res = await app.inject({
        method: "POST",
        url: "/api/kos",
        headers: auth,
        payload: {
          confidentiality: "intern",
          title: "Kupplung prüfen",
          type: "best_practice",
          category: "Anlagenzugang",
          statement: "Kupplung prüfen — Aussage.",
          assets: ["MA-1", "MA-2"],
          anlagenkontext: { standorte: ["Werk Nord"] },
        },
      });
      expect(res.statusCode, res.body).toBe(201);
      const id = res.json().id as string;
      const andere = await anlegen(app, auth, "Riemen spannen", "MA-2");
      expect(andere.statusCode, andere.body).toBe(201);
      const liste = await suche(app, auth);
      expect(qrTreffer(liste, anlagenPfad("MA-1"))).toEqual([id]);
      expect(qrTreffer(liste, anlagenPfad("MA-2"))).toEqual([id, andere.id].sort());
      expect(
        qrTreffer(liste, anlagenPfad("MA-2", "asset", { standort: "Werk Süd" })),
        "Werk Süd: das nur in Werk Nord geltende Objekt fällt heraus",
      ).toEqual([andere.id]);
    } finally {
      await app.close();
    }
  });

  it("R3 · Unförmiges wird abgewiesen (400) und ändert nichts", async () => {
    const { app, auth } = await setup();
    try {
      const keineListe = await anlegen(app, auth, "Falsch", "X-1", { bauteile: "BT-1" });
      expect(keineListe.statusCode, keineListe.body).toBe(400);
      const ok = await anlegen(app, auth, "Richtig", "X-1", { bauteile: ["BT-1"] });
      expect(ok.statusCode, ok.body).toBe(201);
      for (const anlagenkontext of [
        { standorte: ["x".repeat(121)] },
        { schichten: Array.from({ length: 51 }, (_, i) => `S${i}`) },
        { materialien: [42] },
        "BT-2",
      ]) {
        const res = await app.inject({
          method: "PUT",
          url: `/api/kos/${ok.id}`,
          headers: auth,
          payload: { action: "anlagenkontext", anlagenkontext },
        });
        expect(res.statusCode, `${JSON.stringify(anlagenkontext)}: ${res.body}`).toBe(400);
      }
      const objekt = (await suche(app, auth)).find((k) => k.id === ok.id);
      expect(objekt?.anlagenkontext).toEqual({ bauteile: ["BT-1"] });
    } finally {
      await app.close();
    }
  });
});
