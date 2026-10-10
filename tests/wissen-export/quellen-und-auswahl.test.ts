// ================================================================================================
// aufnahme:20260922:gesamt-wissen-export — QUELLEN IM EXPORT, EXPORT DER AUSWAHL.
// ================================================================================================
//
//   R-0706          Markdown, MediaWiki und HTML nennen die Quellen der übernommenen Aussage.
//                   Bis hierher warfen alle drei `sources` weg; nur JSON trug sie am Objekt.
//   R-0681 /        `GET /api/library/export?ids=…` exportiert die Auswahl. Die Auswahl GRENZT NUR
//   FR-LIB-02       EIN: nicht validierte und (ohne Prüfrecht) vertrauliche Einträge bleiben draussen,
//                   genau wie im Gesamtexport derselben Rolle.
//
// Gemessen über die echte Route (`library-routes.ts`) auf dem Speicheraufbau, dieselbe Rollenbildung
// wie `tests/vertraulichkeit-export/admin-controller-exportieren-alle-stufen.test.ts`.
//
// NICHT HIER: ein nativer PDF-Erzeuger (R-0772: bewusst keiner; PDF ist Browserdruck aus HTML) und
// ein Feld-Merge beim JSON-Import (FR-LIB-02-Einordnung: Dubletten werden übersprungen).
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import type { KoSource } from "../../services/knowledge-object/src/types";

const QUELLE: KoSource = {
  id: "q-pb12",
  label: "Prüfbericht 12",
  url: "https://intranet.example/pruefbericht-12",
  excerpt: "Dichtung nach 500 h tauschen.",
  kind: "external",
  peerValidated: false,
  provider: "Confluence",
  author: "admin",
  at: "2026-09-01T08:00:00.000Z",
};

async function aufbau() {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "wx-admin@x.de", password: "secret123" },
  });
  const anmelden = async (email: string) => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: "secret123" },
    });
    return { authorization: `Bearer ${res.json().token}` };
  };
  const admin = await anmelden("wx-admin@x.de");
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: admin,
    payload: { name: "experte", email: "wx-experte@x.de", password: "secret123", role: "experte" },
  });
  expect(angelegt.statusCode, angelegt.body).toBe(201);

  const ko = services.ko;
  const anlegen = async (title: string, extra: { sources?: KoSource[] } = {}) =>
    ko.create({
      title,
      statement: `${title} — Kerntext.`,
      type: "best_practice",
      category: "Anlage 1",
      author: "admin",
      tags: [],
      ...extra,
    });
  const mitQuelle = await anlegen("Dichtung tauschen", { sources: [QUELLE] });
  await ko.setValidationState(mitQuelle.id, { trust: 80, status: "validiert" });
  const ohneQuelle = await anlegen("Ventil entlasten");
  await ko.setValidationState(ohneQuelle.id, { trust: 80, status: "validiert" });
  const dritter = await anlegen("Pumpe spülen");
  await ko.setValidationState(dritter.id, { trust: 80, status: "validiert" });
  const offen = await anlegen("Offener Entwurf");
  const vertraulich = await anlegen("Schichtplan Leitwarte");
  await ko.setValidationState(vertraulich.id, { trust: 80, status: "validiert" });
  await ko.setConfidentiality(vertraulich.id, "vertraulich", "admin");

  return {
    app,
    services,
    admin,
    experte: await anmelden("wx-experte@x.de"),
    ids: {
      mitQuelle: mitQuelle.id,
      ohneQuelle: ohneQuelle.id,
      dritter: dritter.id,
      offen: offen.id,
      vertraulich: vertraulich.id,
    },
  };
}

type Aufbau = Awaited<ReturnType<typeof aufbau>>;

async function holen(ctx: Aufbau, url: string, headers = ctx.admin): Promise<string> {
  const res = await ctx.app.inject({ method: "GET", url, headers });
  expect(res.statusCode, res.body).toBe(200);
  return res.body;
}

async function titel(ctx: Aufbau, url: string, headers = ctx.admin): Promise<string[]> {
  return (JSON.parse(await holen(ctx, url, headers)) as { title: string }[])
    .map((k) => k.title)
    .sort();
}

describe("R-0706 · die Textformate nennen die Quellen der Aussage", () => {
  it("Markdown: Abschnitt „Quellen“ mit Bezeichnung, Anbieter und Adresse", async () => {
    const ctx = await aufbau();
    const md = await holen(ctx, "/api/library/export?format=markdown");
    expect(md).toContain("**Quellen**");
    const zeile = "- Prüfbericht 12 (Confluence) — https://intranet.example/pruefbericht-12";
    expect(md).toContain(zeile);
    // Die Quelle steht beim Objekt, dem sie gehört — vor dem nächsten Trenner.
    const abschnitt = md.slice(md.indexOf("# Dichtung tauschen"));
    const ende = abschnitt.indexOf("\n---");
    expect(abschnitt.indexOf(zeile)).toBeGreaterThan(0);
    expect(abschnitt.indexOf(zeile)).toBeLessThan(ende);
  });

  it("MediaWiki: Unterabschnitt mit externem Verweis", async () => {
    const ctx = await aufbau();
    const wiki = await holen(ctx, "/api/library/export?format=mediawiki");
    expect(wiki).toContain("=== Quellen ===");
    const zeile = "* [https://intranet.example/pruefbericht-12 Prüfbericht 12 (Confluence)]";
    expect(wiki).toContain(zeile);
  });

  it("HTML (Druckweg): Liste mit Verweis UND ausgeschriebener Adresse für das Papier", async () => {
    const ctx = await aufbau();
    const html = await holen(ctx, "/api/library/export?format=html");
    expect(html).toContain('<ul class="quellen">');
    const adresse = "https://intranet.example/pruefbericht-12";
    expect(html).toContain(`<a href="${adresse}">Prüfbericht 12 (Confluence)</a> — ${adresse}`);
  });

  it("KALIBRIERUNG: ein Objekt ohne Quellen bekommt keinen leeren Quellenabschnitt", async () => {
    const ctx = await aufbau();
    const md = await holen(ctx, `/api/library/export?format=markdown&ids=${ctx.ids.ohneQuelle}`);
    expect(md).toContain("# Ventil entlasten");
    expect(md).not.toContain("**Quellen**");
  });

  it("JSON trägt die Quellen weiterhin am Objekt", async () => {
    const ctx = await aufbau();
    const liste = JSON.parse(await holen(ctx, "/api/library/export")) as {
      title: string;
      sources: KoSource[];
    }[];
    const eintrag = liste.find((k) => k.title === "Dichtung tauschen");
    expect(eintrag?.sources.map((s) => s.label)).toEqual(["Prüfbericht 12"]);
  });
});

describe("R-0681 / FR-LIB-02 · Export der Auswahl", () => {
  it("ohne `ids`: validierter Gesamtbestand wie bisher (Kalibrierung)", async () => {
    const ctx = await aufbau();
    expect(await titel(ctx, "/api/library/export")).toEqual([
      "Dichtung tauschen",
      "Pumpe spülen",
      "Schichtplan Leitwarte",
      "Ventil entlasten",
    ]);
  });

  it("mit `ids`: genau die gewählten validierten Einträge — in allen vier Formaten", async () => {
    const ctx = await aufbau();
    const ids = `${ctx.ids.mitQuelle},${ctx.ids.dritter}`;
    expect(await titel(ctx, `/api/library/export?ids=${ids}`)).toEqual([
      "Dichtung tauschen",
      "Pumpe spülen",
    ]);
    for (const format of ["markdown", "mediawiki", "html"]) {
      const text = await holen(ctx, `/api/library/export?format=${format}&ids=${ids}`);
      expect(text, format).toContain("Dichtung tauschen");
      expect(text, format).toContain("Pumpe spülen");
      expect(text, format).not.toContain("Ventil entlasten");
    }
  });

  it("die Auswahl grenzt nur ein: ein nicht validierter Eintrag geht auch gewählt nicht mit", async () => {
    const ctx = await aufbau();
    const url = `/api/library/export?ids=${ctx.ids.offen},${ctx.ids.ohneQuelle}`;
    expect(await titel(ctx, url)).toEqual(["Ventil entlasten"]);
  });

  it("ohne Prüfrecht bleibt ein gewählter vertraulicher Eintrag draussen; mit Prüfrecht nicht", async () => {
    const ctx = await aufbau();
    const url = `/api/library/export?ids=${ctx.ids.vertraulich},${ctx.ids.dritter}`;
    expect(await titel(ctx, url, ctx.experte)).toEqual(["Pumpe spülen"]);
    expect(await titel(ctx, url, ctx.admin)).toEqual(["Pumpe spülen", "Schichtplan Leitwarte"]);
  });

  it("ein leerer `ids`-Parameter ist eine leere Auswahl, nicht der Gesamtbestand", async () => {
    const ctx = await aufbau();
    expect(await titel(ctx, "/api/library/export?ids=")).toEqual([]);
  });

  // §12.3 „Export": auch ein Export der Auswahl hinterlässt `library.export` — mit GENAU den
  // ausgelieferten Objekten, nicht mit der angefragten Liste. (Der Gesamtfall steht in
  // `tests/audit-gesamt/aktionsmatrix-12-3.test.ts`; dort bricht der Lauf derzeit vorher im
  // unveränderten Fragenweg ab, deshalb steht die Auswahl-Gegenprobe hier.)
  it("Audit: der Beleg nennt die ausgelieferten Objekte der Auswahl", async () => {
    const ctx = await aufbau();
    const url = `/api/library/export?format=markdown&ids=${ctx.ids.dritter},${ctx.ids.offen}`;
    await holen(ctx, url, ctx.experte);
    const beleg = (await ctx.services.audit.list({ action: "library.export" })).at(-1);
    expect(beleg?.payload.format).toBe("markdown");
    expect(beleg?.payload.koIds).toEqual([ctx.ids.dritter]);
    expect(beleg?.payload.count).toBe(1);
    expect(beleg?.payload.includeConfidential).toBe(false);
  });

  it("der wiederholte Parameter wird wie die Kommaliste gelesen", async () => {
    const ctx = await aufbau();
    const url = `/api/library/export?ids=${ctx.ids.mitQuelle}&ids=${ctx.ids.ohneQuelle}`;
    expect(await titel(ctx, url)).toEqual(["Dichtung tauschen", "Ventil entlasten"]);
  });
});
