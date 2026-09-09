// ================================================================================================
// JOB 3326 · LESEVARIANTE — DIE ROUTEN AN DER ECHTEN APP.
// ================================================================================================
//
// Gemessen wird an `buildApp(buildServices())`, also an derselben Verdrahtung, die der Server
// fährt — nicht an einer eigens gebauten Fastify-Instanz mit drei Stubs. Nur so ist belegt, dass
// die Routen überhaupt REGISTRIERT sind und dass der Detailabruf dieselbe Ablage sieht wie der
// Ladeweg.
import { describe, expect, it } from "vitest";
import type { KoSource } from "../../../knowledge-object";
import { type AppServices, buildApp, buildServices } from "../build-app";
import { ADVISOR_ICT_EN_V1 } from "../example-packages/advisor-ict-en-v1";
import { lokalisierungsPaket } from "../lesevarianten";

const PAKET_ID = ADVISOR_ICT_EN_V1.id;
/** Die sechs Grundlagen-Bausteine — GELESEN, nicht abgeschrieben. */
const BAUSTEIN_SCHLUESSEL = ADVISOR_ICT_EN_V1.items.map((i) => i.key);
// S01 der Lieferung — die Confluence-Seite, deren Übersetzung „Kundenprofil: Harbor Field Services"
// heißt. Ihre Id steht in der Lieferung und ist der Anker der Zuordnung.
const S01_CONFLUENCE_ID = "25067523";
const S01_TITEL_EN = "Customer brief: Harbor Field Services";
const S01_TITEL_DE = "Kundenprofil: Harbor Field Services";

function quelle(externalId: string): KoSource {
  return {
    id: externalId,
    label: "Confluence-Seite",
    url: `https://example.invalid/${externalId}`,
    excerpt: null,
    kind: "external",
    peerValidated: false,
    provider: "Confluence",
    externalId,
    author: "importer",
    at: "2026-09-01T00:00:00.000Z",
  };
}

async function aufbau(): Promise<{
  app: ReturnType<typeof buildApp>;
  services: AppServices;
  headers: Record<string, string>;
  koId: string;
}> {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "a@x.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "a@x.de", password: "secret123" },
  });
  const headers = { authorization: `Bearer ${login.json().token}` };
  // Das importierte Original: englisch, mit dem Confluence-Anker in seiner Quelle.
  const ko = await services.ko.create({
    title: S01_TITEL_EN,
    statement:
      "Harbor Field Services is a fictional customer with 25 office users and one branch office.",
    bodyHtml: "<p>Harbor Field Services is a fictional customer.</p>",
    type: "best_practice",
    category: "Onboarding",
    author: "importer",
    tags: ["advisor"],
    sources: [quelle(S01_CONFLUENCE_ID)],
  });
  return { app, services, headers, koId: ko.id };
}

/**
 * Der Ladeknopf der Übersetzungen — als Kürzel, weil ihn fast jeder Fall braucht.
 */
async function ladeUebersetzungen(
  app: ReturnType<typeof buildApp>,
  headers: Record<string, string>,
) {
  return app.inject({
    method: "POST",
    url: "/api/admin/lesevarianten/laden",
    headers,
    payload: { package: PAKET_ID },
  });
}

describe("JOB 3326 · POST /api/admin/lesevarianten/laden", () => {
  it("R1 · ohne Anmeldung 401 (die Ladeaktion ist admin-gebunden)", async () => {
    const { app } = await aufbau();
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/lesevarianten/laden",
      payload: { package: PAKET_ID },
    });
    expect(res.statusCode).toBe(401);
  });

  it("R2 · unbekanntes Paket → 400 UNKNOWN_PACKAGE, nichts wird geschrieben", async () => {
    const { app, services, headers } = await aufbau();
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/lesevarianten/laden",
      headers,
      payload: { package: "gibt-es-nicht" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("UNKNOWN_PACKAGE");
    expect(await services.lesevarianten.inSprache("de")).toEqual([]);
  });

  it("R3 · Laden ordnet das vorhandene Objekt zu und benennt die 42 Datensätze ohne Objekt", async () => {
    const { app, headers } = await aufbau();
    const res = await ladeUebersetzungen(app, headers);
    expect(res.statusCode).toBe(200);
    const bilanz = res.json();
    expect(bilanz.records).toBe(43);
    expect(bilanz.zugeordnet).toBe(1);
    expect(bilanz.objekte).toBe(1);
    expect(bilanz.ueberConfluence).toBe(1);
    expect(bilanz.neu).toBe(1);
    expect(bilanz.aktualisiert).toBe(0);
    // BENANNT, nicht nur gezählt.
    expect(bilanz.nichtZugeordnet).toHaveLength(42);
    expect(bilanz.nichtZugeordnet).toContain("S02");
  });

  it("R4 · zweites Laden: 0 neu, 1 aktualisiert, kein Text geändert (idempotent)", async () => {
    const { app, headers } = await aufbau();
    await ladeUebersetzungen(app, headers);
    const zweite = (await ladeUebersetzungen(app, headers)).json();
    expect(zweite.neu).toBe(0);
    expect(zweite.aktualisiert).toBe(1);
    expect(zweite.textGeaendert).toEqual([]);
  });
});

// ================================================================================================
// JOB 3326 · RUNDE 2 — DIE ECHTEN PAKETOBJEKTE, ÜBER DIE ECHTEN ROUTEN.
// ================================================================================================
//
// Codex 071152c5: Runde 1 hat die sechs Grundlagen-Bausteine erfunden (OD01–OD05/WORD-NEW statt
// S02/S04/C01/C02/T01/T03) und `ordneZu` brach beim ersten Anker ab — die Bausteine wären in der
// Vorführung ohne Übersetzung geblieben. Diese Fälle messen deshalb NICHT gegen ein Fixture,
// sondern gegen den Bestand, den der ECHTE Demopaket-Ladeweg anlegt:
// `POST /api/admin/demo-packages/advisor-ict-en-v1/load`.
describe("JOB 3326 · das Demopaket und die Lieferung treffen sich am echten Anker", () => {
  it("P1 · nach dem Demopaket-Laden tragen ALLE sechs Bausteine eine deutsche Lesevariante", async () => {
    const { app, services, headers } = await aufbau();
    const geladen = await app.inject({
      method: "POST",
      url: `/api/admin/demo-packages/${PAKET_ID}/load`,
      headers,
    });
    expect(geladen.statusCode).toBe(200);
    expect(geladen.json().created).toBe(6);

    // ==========================================================================================
    // DIE LAGE, AN DER RUNDE 1 GESCHEITERT IST, ÜBER DIE ECHTEN ROUTEN.
    // ==========================================================================================
    // S02 ist ein Grundlagen-Baustein UND eine importierte Confluence-Seite. Ohne diese Kopie
    // fände der Paketanker sein Objekt auch dann, wenn die Suche nach dem ersten Treffer abbräche
    // — der Fall wäre bauartbedingt grün. Mit ihr trägt der Datensatz ZWEI Objekte, und genau die
    // müssen beide bedient werden.
    const s02 = lokalisierungsPaket(PAKET_ID)?.records.find((r) => r.key === "S02");
    expect(s02?.confluence_id, "S02 ohne Seiten-Id").toBeTruthy();
    const kopie = await services.ko.create({
      title: "Named customer contact",
      statement: "Every new customer receives a named service contact before handover.",
      type: "best_practice",
      category: "Sales",
      author: "importer",
      tags: ["advisor"],
      sources: [quelle(String(s02?.confluence_id))],
    });

    const bilanz = (await ladeUebersetzungen(app, headers)).json();
    // S01 und S02 als Confluence-Kopien, sechs Bausteine: 7 Datensätze, 8 Objekte — und S02 zählt
    // in BEIDEN Wegen.
    expect(bilanz.zugeordnet).toBe(7);
    expect(bilanz.objekte).toBe(8);
    expect(bilanz.ueberConfluence).toBe(2);
    expect(bilanz.ueberPaketschluessel).toBe(6);
    expect(bilanz.neu).toBe(8);
    // Die Kopie UND der Baustein haben je eine eigene Variante — dieselbe Übersetzung, zwei Objekte.
    const anKopie = await app.inject({
      method: "GET",
      url: `/api/kos/${kopie.id}/lesevariante/de`,
      headers,
    });
    expect(anKopie.statusCode).toBe(200);
    expect(anKopie.json().title).toBe(s02?.de?.title);

    // Und jetzt der Punkt, an dem Runde 1 fiel: jeder Baustein hat SEINE eigene Variante.
    const uebersicht = await app.inject({
      method: "GET",
      url: "/api/lesevarianten?lang=de",
      headers,
    });
    const titel = (uebersicht.json().eintraege as { title: string }[]).map((e) => e.title);
    const lieferung = lokalisierungsPaket(PAKET_ID);
    for (const key of BAUSTEIN_SCHLUESSEL) {
      // Der DEUTSCHE Titel der Lieferung zu diesem Schlüssel muss in der Übersicht stehen — sonst
      // hat der Baustein keine Variante bekommen, und genau das war der Befund aus Runde 1.
      const erwartet = lieferung?.records.find((r) => r.key === key)?.de?.title;
      expect(erwartet, `${key} ohne deutschen Titel in der Lieferung`).toBeTruthy();
      expect(titel, `Baustein ${key} fehlt in der Übersicht`).toContain(erwartet);
    }
    expect(uebersicht.json().eintraege).toHaveLength(8);
    // Der deutsche Titel von S02 steht ZWEIMAL da — einmal am Baustein, einmal an der Kopie.
    expect(titel.filter((t) => t === s02?.de?.title)).toHaveLength(2);
  });

  it("P2 · der Quellabgleich der Bausteine ist BELEGT — gemessen, nicht behauptet", async () => {
    const { app, headers } = await aufbau();
    await app.inject({
      method: "POST",
      url: `/api/admin/demo-packages/${PAKET_ID}/load`,
      headers,
    });
    const bilanz = (await ladeUebersetzungen(app, headers)).json();
    // Die sechs Bausteine speichern die Absätze der Lieferung wörtlich als Kernaussage — ihr
    // Abdruck trifft den gelieferten `source_body_sha256`. Die Confluence-Kopie tut das nicht.
    expect(bilanz.quellabgleichBestaetigt).toBe(6);
    expect(bilanz.quellabgleichUnbestaetigt).toBe(1);

    const uebersicht = (
      await app.inject({ method: "GET", url: "/api/lesevarianten?lang=de", headers })
    ).json().eintraege as { quellabgleich: string }[];
    expect(uebersicht.filter((e) => e.quellabgleich === "bestaetigt")).toHaveLength(6);
    expect(uebersicht.filter((e) => e.quellabgleich === "unbestaetigt")).toHaveLength(1);
  });

  it("P3 · zweimaliges Demopaket-Laden und zweimaliges Übersetzungsladen erzeugen keine Kopie", async () => {
    const { app, headers } = await aufbau();
    for (let i = 0; i < 2; i++) {
      await app.inject({
        method: "POST",
        url: `/api/admin/demo-packages/${PAKET_ID}/load`,
        headers,
      });
    }
    await ladeUebersetzungen(app, headers);
    const zweite = (await ladeUebersetzungen(app, headers)).json();
    expect(zweite.neu).toBe(0);
    expect(zweite.aktualisiert).toBe(7);
    expect(zweite.textGeaendert).toEqual([]);
    const uebersicht = await app.inject({
      method: "GET",
      url: "/api/lesevarianten?lang=de",
      headers,
    });
    expect(uebersicht.json().eintraege).toHaveLength(7);
  });
});

describe("JOB 3326 · die Leserouten", () => {
  it("R5 · GET /api/kos/:id/lesevariante/de liefert die deutsche Fassung mit Originalsprache", async () => {
    const { app, headers, koId } = await aufbau();
    await app.inject({
      method: "POST",
      url: "/api/admin/lesevarianten/laden",
      headers,
      payload: { package: PAKET_ID },
    });
    const res = await app.inject({
      method: "GET",
      url: `/api/kos/${koId}/lesevariante/de`,
      headers,
    });
    expect(res.statusCode).toBe(200);
    const variante = res.json();
    expect(variante.title).toBe(S01_TITEL_DE);
    expect(variante.originalLanguage).toBe("en");
    expect(variante.status).toBe("draft_translation_not_business_approval");
    expect(variante.originalGeaendert).toBe(false);
  });

  it("R6 · für eine Sprache ohne Variante gibt es keine erfundene Antwort (404)", async () => {
    const { app, headers, koId } = await aufbau();
    await app.inject({
      method: "POST",
      url: "/api/admin/lesevarianten/laden",
      headers,
      payload: { package: PAKET_ID },
    });
    const res = await app.inject({
      method: "GET",
      url: `/api/kos/${koId}/lesevariante/nl`,
      headers,
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("NO_LESEVARIANTE");
  });

  it("R7 · GET /api/lesevarianten?lang=de ist die schmale Übersicht (Titel/Kernaussage, KEIN Fließtext)", async () => {
    const { app, headers, koId } = await aufbau();
    await app.inject({
      method: "POST",
      url: "/api/admin/lesevarianten/laden",
      headers,
      payload: { package: PAKET_ID },
    });
    const res = await app.inject({ method: "GET", url: "/api/lesevarianten?lang=de", headers });
    expect(res.statusCode).toBe(200);
    const { lang, eintraege } = res.json();
    expect(lang).toBe("de");
    expect(eintraege).toHaveLength(1);
    expect(eintraege[0].koId).toBe(koId);
    expect(eintraege[0].title).toBe(S01_TITEL_DE);
    expect(eintraege[0].bodyHtml).toBeUndefined();
  });

  it("R8 · ohne Sprache 400 statt einer stillen Vorgabe", async () => {
    const { app, headers } = await aufbau();
    const res = await app.inject({ method: "GET", url: "/api/lesevarianten", headers });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("MISSING_LANG");
  });

  it("R9 · ein unbekanntes Objekt bleibt 404 — auch über den Variantenweg", async () => {
    const { app, headers } = await aufbau();
    const res = await app.inject({
      method: "GET",
      url: "/api/kos/gibt-es-nicht/lesevariante/de",
      headers,
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("NOT_FOUND");
  });
});

describe("JOB 3326 · das Original bleibt die Wahrheit", () => {
  it("R10 · GET /api/kos/:id liefert die Variante NEBEN dem unveränderten Original", async () => {
    const { app, headers, koId } = await aufbau();
    await app.inject({
      method: "POST",
      url: "/api/admin/lesevarianten/laden",
      headers,
      payload: { package: PAKET_ID },
    });
    const res = await app.inject({ method: "GET", url: `/api/kos/${koId}`, headers });
    expect(res.statusCode).toBe(200);
    const ko = res.json();
    // Das Objekt selbst ist WÖRTLICH unverändert englisch.
    expect(ko.title).toBe(S01_TITEL_EN);
    expect(ko.statement.startsWith("Harbor Field Services is a fictional customer")).toBe(true);
    // Die Übersetzung steht daneben.
    expect(ko.lesevarianten.de.title).toBe(S01_TITEL_DE);
    expect(ko.lesevarianten.de.originalLanguage).toBe("en");
  });

  it("R11 · ohne geladene Übersetzung trägt das Objekt gar kein Variantenfeld", async () => {
    const { app, headers, koId } = await aufbau();
    const res = await app.inject({ method: "GET", url: `/api/kos/${koId}`, headers });
    expect(res.json().lesevarianten).toBeUndefined();
  });

  it("R12 · die SUCHE arbeitet auf dem Original: deutsches Wort der Variante findet nichts, englisches findet das Objekt", async () => {
    const { app, headers, koId } = await aufbau();
    await app.inject({
      method: "POST",
      url: "/api/admin/lesevarianten/laden",
      headers,
      payload: { package: PAKET_ID },
    });
    const deutsch = await app.inject({
      method: "GET",
      url: "/api/library/search?q=Kundenprofil",
      headers,
    });
    expect(deutsch.statusCode).toBe(200);
    expect(deutsch.json().map((k: { id: string }) => k.id)).toEqual([]);
    const englisch = await app.inject({
      method: "GET",
      url: "/api/library/search?q=Customer%20brief",
      headers,
    });
    expect(englisch.statusCode).toBe(200);
    expect(englisch.json().map((k: { id: string }) => k.id)).toEqual([koId]);
  });

  it("R13 · die Liste GET /api/kos zeigt weiterhin das Original (kein Übersetzungsdurchgriff)", async () => {
    const { app, headers } = await aufbau();
    await app.inject({
      method: "POST",
      url: "/api/admin/lesevarianten/laden",
      headers,
      payload: { package: PAKET_ID },
    });
    const res = await app.inject({ method: "GET", url: "/api/kos", headers });
    expect(res.json().map((k: { title: string }) => k.title)).toEqual([S01_TITEL_EN]);
  });

  it("R14 · eine Originaländerung nach dem Laden macht die Variante nicht unsichtbar, sondern gekennzeichnet", async () => {
    const { app, services, headers, koId } = await aufbau();
    await app.inject({
      method: "POST",
      url: "/api/admin/lesevarianten/laden",
      headers,
      payload: { package: PAKET_ID },
    });
    await services.ko.revise(
      koId,
      { statement: "Harbor Field Services now has 40 office users and two branch offices." },
      "admin",
    );
    const res = await app.inject({
      method: "GET",
      url: `/api/kos/${koId}/lesevariante/de`,
      headers,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().originalGeaendert).toBe(true);
    expect(res.json().title).toBe(S01_TITEL_DE);
  });
});
