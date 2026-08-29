// ================================================================================================
// W2-A / AUFTRAG 148 — DER APP-/ROUTENANSCHLUSS
// ================================================================================================
//
// STAND 10.08.2026: UMGESETZT. Diese Datei war als „rot vor Produktcode" geschrieben und blieb es
// tagelang, weil der Umsetzungsauftrag nie kam — die Laufdomaene war gebaut, die Tabelle migriert,
// und beides blieb ohne Anschluss. Der Anschluss steht jetzt:
// `services/app/src/routes/import-run-routes.ts` plus die Verdrahtung in der Kompositionswurzel.
// Alle vierzehn Faelle sind gruen.
//
// Der folgende Text beschreibt die LAGE BEI ABFASSUNG und bleibt als Begruendung stehen — er sagt,
// warum es diese Faelle gibt. Er beschreibt nicht mehr den heutigen Zustand.
//
// PRO 144 hat die Laufdomäne in `services/library-analytics` gebaut und ihre öffentlichen Verträge
// ausgeleitet. Was fehlt, ist der Anschluss: die Kompositionswurzel hält kein `ImportRunRepo`, und
// es gibt keine Route, über die ein Betreiber einen Lauf starten oder sein Ergebnis lesen könnte.
//
// GENAU DAS — und nur das — hält diese Datei fest. Jeder Fall hier war rot, WEIL die
// Verdrahtung beziehungsweise die Route fehlt, nicht weil er etwas Neues behauptet. Die
// Domänenregeln selbst sind bereits in `services/library-analytics/src/service.test.ts` grün;
// sie werden hier nicht wiederholt, sondern über die öffentliche Fassade AUFGERUFEN.
//
// WARUM DIE ROUTEN ÜBER `app.inject` GEPRÜFT WERDEN: der Vertrag aus KW-S4-26 §141-143 verlangt
// „exakt die serverseitig gelesenen Daten"; er ist damit ein Vertrag über die HTTP-Grenze und nicht
// über eine Servicemethode. Ein Test gegen ein injiziertes Doppel könnte grün sein, während die
// Anwendung nichts ausliefert — das ist genau der Zustand, in dem W2 vor Preflight 138 war.
//
// WAS DIESE DATEI SELBST NICHT TAT: sie schrieb keinen Produktcode, änderte keine bestehende
// Datei und aktiviert keine Oberfläche. Fall 5 bewacht ausdrücklich, dass das so bleibt.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import {
  IMPORT_ITEM_OUTCOMES,
  IMPORT_RUN_STATUSES,
  pruefeGapBindung,
  pruefeInhaltsreferenzBindung,
} from "../../services/library-analytics";

// ------------------------------------------------------------------------------------------------
// Aufbau: die ECHTE Komposition und ein angemeldeter Admin.
// ------------------------------------------------------------------------------------------------

// Der Import-Schalter ist an, damit die Rechteprüfung wirklich auf eine REGISTRIERTE Route trifft.
// Ohne ihn antwortete der Server mit 404 „Route nicht gefunden", und der 403-Fall unten prüfte
// nur, dass es die Route nicht gibt — nicht den Rechtepfad. Muster aus dem Bestand
// (`import-group-routes.test.ts:81`, `import-accept-aicheck-honesty.test.ts:38`).
const VORHER = process.env.KLARWERK_CONFLUENCE_IMPORT;
beforeAll(() => {
  process.env.KLARWERK_CONFLUENCE_IMPORT = "1";
});
afterAll(() => {
  if (VORHER === undefined) {
    delete process.env.KLARWERK_CONFLUENCE_IMPORT;
  } else {
    process.env.KLARWERK_CONFLUENCE_IMPORT = VORHER;
  }
});

const ADMIN = { name: "Pedi", email: "pedi148@example.com", password: "geheim-1234" };

/** Bootstrap-Admin über die echten Auth-Routen — dasselbe Muster wie die übrigen App-Tests. */
async function appMitAdmin() {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({ method: "POST", url: "/api/auth/register", payload: ADMIN });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: ADMIN.email, password: ADMIN.password },
  });
  const token = (login.json() as { token: string }).token;
  expect(token, "der Bootstrap-Admin muss ein Token bekommen").not.toBe("");
  return { app, services, headers: { authorization: `Bearer ${token}` } };
}

/** Eine zweite, angemeldete Identität OHNE `users.manage` — für den Negativpfad. */
async function ohneRecht(
  app: Awaited<ReturnType<typeof appMitAdmin>>["app"],
  adminHeaders: Record<string, string>,
) {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: adminHeaders,
    payload: { name: "Bea", email: "bea148@example.com", password: "geheim-1234", role: "experte" },
  });
  expect(angelegt.statusCode, "die zweite Identität muss angelegt werden können").toBe(201);
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "bea148@example.com", password: "geheim-1234" },
  });
  const token = (login.json() as { token: string }).token;
  expect(token, "die Identität ohne Recht muss ein Token bekommen").not.toBe("");
  return { authorization: `Bearer ${token}` };
}

// Die Routenpfade aus BASIC-146 §4 — innerhalb der Bestandskonvention `/api/admin/import/…`.
const START = "/api/admin/import/confluence";
const LAUF = (id: string) => `/api/admin/import/runs/${id}`;
const ERGEBNIS = (id: string) => `/api/admin/import/runs/${id}/result`;
const QUELLE = (id: string) => `/api/admin/import/source-records/${id}`;

type App = Awaited<ReturnType<typeof appMitAdmin>>["app"];
type Kopf = Record<string, string>;

/** Ein Start über die echte Route — die Rohantwort, damit jeder Fall selbst urteilen kann. */
function starte(app: App, headers: Kopf) {
  return app.inject({ method: "POST", url: START, headers, payload: {} });
}

/** Ein Start, der eine Kennung liefern MUSS — für die Fälle, die darauf aufbauen. */
async function starteMitKennung(app: App, headers: Kopf): Promise<string> {
  const antwort = await starte(app, headers);
  // JOB 2691 D1: der Start antwortet SOFORT mit 202 QUEUED; der Lauf laeuft im Hintergrund weiter
  // und ist unter seiner Kennung lesbar. Bis 2691 stand hier 200 — die Antwort kam erst am Ende.
  expect(antwort.statusCode, "der Lauf muss startbar sein").toBe(202);
  return (antwort.json() as { importId: string }).importId;
}

// ================================================================================================
// 1 · POST STARTET EINEN ECHTEN LAUF
// ================================================================================================

describe("W2-A/148 · 1 · POST liefert kanonische importId und Status", () => {
  it("die Antwort trägt eine nicht-leere importId und einen Status aus der kanonischen Menge", async () => {
    const { app, headers } = await appMitAdmin();

    const antwort = await starte(app, headers);
    // Heute antwortet der Bestand hier 503 IMPORT_UNAVAILABLE, wenn kein Adapter konfiguriert ist —
    // und legt dabei NICHTS an. Genau das ändert der spätere Anschluss: KW-S4-26 §133 verlangt, den
    // `ImportRun` VOR dem ersten externen oder fachlichen Effekt persistent anzulegen. Ein Lauf ohne
    // erreichbare Quelle endet dann sichtbar auf FAILED, statt spurlos abgewiesen zu werden.
    // JOB 2691 D1: 202 statt 200 — der Lauf ist angelegt und laeuft, die Antwort wartet nicht auf ihn.
    expect(antwort.statusCode, "der Start muss einen persistenten Lauf anlegen").toBe(202);

    const koerper = antwort.json() as { importId?: unknown; status?: unknown };
    expect(typeof koerper.importId, "importId muss eine Zeichenkette sein").toBe("string");
    expect(String(koerper.importId ?? "").length).toBeGreaterThan(0);
    // Fail-closed: alles, was nicht wortgleich in der kanonischen Liste steht, ist kein Status.
    expect(IMPORT_RUN_STATUSES as readonly string[]).toContain(String(koerper.status));
  });

  it("die Antwort ist KEINE Zählerzusammenfassung — Zähler sind laut Kanon keine Resultatquelle", async () => {
    const { app, headers } = await appMitAdmin();
    const koerper = (await starte(app, headers)).json() as Record<string, unknown>;
    // KW-S4-26 §177-179: „Zaehler allein sind keine Resultatdatenquelle." Der heutige Bestand
    // antwortet { imported, updates, alreadyQueued, failed, notFound } — genau das darf es nicht
    // mehr sein, sobald der Lauf eine Identität hat.
    for (const zaehlerfeld of ["imported", "updates", "alreadyQueued", "notFound"]) {
      expect(
        Object.hasOwn(koerper, zaehlerfeld),
        `${zaehlerfeld} gehört nicht in die Startantwort`,
      ).toBe(false);
    }
  });
});

// ================================================================================================
// 2 · LESEN PERSISTIERTER TATSACHEN · UNBEKANNTE IDs SIND 404
// ================================================================================================

describe("W2-A/148 · 2 · GET liest serverseitige Tatsachen", () => {
  it("der gestartete Lauf ist unter seiner importId lesbar", async () => {
    const { app, headers } = await appMitAdmin();
    const importId = await starteMitKennung(app, headers);

    const lauf = await app.inject({ method: "GET", url: LAUF(importId), headers });
    expect(lauf.statusCode).toBe(200);
    const gelesen = lauf.json() as { importId?: unknown; status?: unknown };
    expect(gelesen.importId, "der gelesene Lauf muss derselbe sein").toBe(importId);
    expect(IMPORT_RUN_STATUSES as readonly string[]).toContain(String(gelesen.status));
  });

  it("das Ergebnis trägt run, source und geordnete items — nur kanonische Kennungen", async () => {
    const { app, headers } = await appMitAdmin();
    const importId = await starteMitKennung(app, headers);

    const ergebnis = await app.inject({ method: "GET", url: ERGEBNIS(importId), headers });
    expect(ergebnis.statusCode).toBe(200);
    const koerper = ergebnis.json() as {
      run?: unknown;
      source?: unknown;
      items?: { ordinal?: unknown; itemOutcome?: unknown }[];
    };
    expect(koerper.run, "das Ergebnis muss den Lauf tragen").toBeDefined();
    expect(Object.hasOwn(koerper, "source"), "das Ergebnis muss ein source-Feld führen").toBe(true);
    expect(Array.isArray(koerper.items), "items muss eine Liste sein").toBe(true);

    // Die Reihenfolge ist Vertrag, nicht Zufall: streng aufsteigend nach ordinal.
    const ordinale = (koerper.items ?? []).map((i) => Number(i.ordinal));
    expect(ordinale).toEqual([...ordinale].sort((a, b) => a - b));
    for (const item of koerper.items ?? []) {
      expect(IMPORT_ITEM_OUTCOMES as readonly string[]).toContain(String(item.itemOutcome));
    }
  });

  it("eine unbekannte importId ist 404 — nie ein erfundener Leer-Lauf", async () => {
    const { app, headers } = await appMitAdmin();

    const lauf = await app.inject({ method: "GET", url: LAUF("gibt-es-nicht"), headers });
    expect(lauf.statusCode).toBe(404);
    const ergebnis = await app.inject({ method: "GET", url: ERGEBNIS("gibt-es-nicht"), headers });
    expect(ergebnis.statusCode).toBe(404);
    const quelle = await app.inject({ method: "GET", url: QUELLE("gibt-es-nicht"), headers });
    expect(quelle.statusCode).toBe(404);

    // Der Körper darf die angefragte Kennung nicht zurückspiegeln — sonst wäre die Antwort eine
    // Auskunft darüber, wonach gefragt wurde.
    expect(lauf.body).not.toContain("gibt-es-nicht");
  });
});

// ================================================================================================
// 3 · users.manage VOR DER OBJEKTAUFLÖSUNG
// ================================================================================================

describe("W2-A/148 · 3 · der Rechtepfad", () => {
  // BEWUSST OHNE vorherigen Start: der Rechtepfad muss unabhängig davon greifen, ob es den Lauf
  // gibt. Genau das ist die Zusage „Recht VOR Objektauflösung" — hinge der Test an einer echten
  // Kennung, prüfte er die Reihenfolge nicht, sondern setzte sie voraus.
  const IRGENDEINE = "irgendeine-kennung";

  it("ohne users.manage: exakt 403/FORBIDDEN, ohne Kennung, ohne Inhalt", async () => {
    const { app, headers } = await appMitAdmin();
    const fremd = await ohneRecht(app, headers);

    for (const url of [START, LAUF(IRGENDEINE), ERGEBNIS(IRGENDEINE), QUELLE(IRGENDEINE)]) {
      const methode = url === START ? "POST" : "GET";
      const antwort = await app.inject({ method: methode, url, headers: fremd, payload: {} });

      expect(antwort.statusCode, `${methode} ${url}`).toBe(403);
      const koerper = antwort.json() as { error?: unknown; message?: unknown };
      expect(koerper.error).toBe("FORBIDDEN");
      expect(koerper.message).toBe("Recht fehlt: users.manage");
      // Kein Datenleck: die Antwort spiegelt weder die angefragte Kennung noch Fachinhalt.
      expect(antwort.body).not.toContain(IRGENDEINE);
      expect(antwort.body).not.toContain("status");
    }
  });

  it("das Recht wird VOR der Objektauflösung geprüft — existierend und nicht existierend sind ununterscheidbar", async () => {
    const { app, headers } = await appMitAdmin();
    const fremd = await ohneRecht(app, headers);

    // Ein echter Lauf, sofern der Start heute schon eine Kennung liefert; sonst dieselbe feste
    // Kennung. Beide Wege müssen für die fremde Identität IDENTISCH aussehen.
    const start = await starte(app, headers);
    const echt =
      start.statusCode === 202 ? (start.json() as { importId: string }).importId : IRGENDEINE;

    const vorhanden = await app.inject({ method: "GET", url: LAUF(echt), headers: fremd });
    const erfunden = await app.inject({
      method: "GET",
      url: LAUF("gibt-es-nicht"),
      headers: fremd,
    });

    // Stünde die Rechteprüfung HINTER der Auflösung, wäre einer der beiden 404 und der andere 403 —
    // und damit die Existenz des Laufs verraten.
    expect(vorhanden.statusCode).toBe(403);
    expect(erfunden.statusCode).toBe(403);
    expect(vorhanden.body).toBe(erfunden.body);
  });

  it("der Negativpfad ist seiteneffektfrei — ein abgelehnter POST legt keinen Lauf an", async () => {
    const { app, headers } = await appMitAdmin();
    const fremd = await ohneRecht(app, headers);

    const abgelehnt = await app.inject({ method: "POST", url: START, headers: fremd, payload: {} });
    expect(abgelehnt.statusCode).toBe(403);

    // Die abgelehnte Anfrage darf keine Kennung erzeugt haben, unter der irgendetwas lesbar wäre.
    const koerper = abgelehnt.json() as { importId?: unknown };
    expect(koerper.importId, "ein abgelehnter Start vergibt keine importId").toBeUndefined();
  });
});

// ================================================================================================
// 4 · DIE ZWEI ZUSTANDSPAARE, FAIL-CLOSED ÜBER DIE HTTP-GRENZE
// ================================================================================================

describe("W2-A/148 · 4 · Gap- und Inhaltsbindung im Lesevertrag", () => {
  /**
   * Das Ergebnis eines echten Laufs — mit hartem Statusanspruch.
   *
   * OHNE diese Zusicherung wären die Fälle unten VAKUUM-GRÜN: bei fehlender Route ist `items`
   * undefined, jede Schleife liefe leer, und der Test meldete Erfolg, ohne je ein Paar gesehen zu
   * haben. Die Zusicherung macht sie kausal rot, solange es die Route nicht gibt.
   */
  async function ergebnisEinesLaufs() {
    const { app, headers } = await appMitAdmin();
    const importId = await starteMitKennung(app, headers);

    const antwort = await app.inject({ method: "GET", url: ERGEBNIS(importId), headers });
    expect(antwort.statusCode, "das Ergebnis muss lesbar sein").toBe(200);
    return { roh: antwort.body, koerper: antwort.json() as Record<string, unknown> };
  }

  it("jedes item trägt ein widerspruchsfreies Gap-Paar — geprüft mit der kanonischen Modulregel", async () => {
    const { koerper } = await ergebnisEinesLaufs();
    const items = (koerper.items ?? []) as {
      knowledgeGapIds?: string[] | null;
      knowledgeGapRelationState?: string;
    }[];

    for (const item of items) {
      // Nicht nachgebaut, sondern AUFGERUFEN: dieselbe Regel, die das Modul selbst durchsetzt.
      // Eine Abweichung an der HTTP-Grenze fällt damit auf, ohne dass hier eine zweite Wahrheit
      // über Gap-Bindungen entstünde.
      expect(() =>
        pruefeGapBindung({
          knowledgeGapIds: item.knowledgeGapIds ?? null,
          knowledgeGapRelationState: item.knowledgeGapRelationState as never,
        }),
      ).not.toThrow();
    }
  });

  it("RELATION_NOT_AVAILABLE liefert null — der Server deutet nichts in [] um", async () => {
    // Am ROHEN Körper, nicht am gemappten Objekt: so fällt eine Serialisierung auf, die `null`
    // unterwegs zu `[]` normalisiert.
    const { roh } = await ergebnisEinesLaufs();
    const koerper = JSON.parse(roh) as {
      items?: { knowledgeGapIds?: unknown; knowledgeGapRelationState?: string }[];
    };

    for (const item of koerper.items ?? []) {
      if (item.knowledgeGapRelationState === "RELATION_NOT_AVAILABLE") {
        expect(item.knowledgeGapIds).toBeNull();
      }
      if (item.knowledgeGapRelationState === "AVAILABLE") {
        expect(Array.isArray(item.knowledgeGapIds)).toBe(true);
      }
    }
  });

  it("die Quellrevision trägt ein widerspruchsfreies Inhaltspaar; NOT_CAPTURED heißt null", async () => {
    const { koerper } = await ergebnisEinesLaufs();
    const quelle = koerper.source as {
      rawOrRenderedContentReference?: string | null;
      contentReferenceState?: string;
    } | null;
    if (quelle) {
      expect(() =>
        pruefeInhaltsreferenzBindung({
          rawOrRenderedContentReference: quelle.rawOrRenderedContentReference ?? null,
          contentReferenceState: quelle.contentReferenceState as never,
        }),
      ).not.toThrow();
      if (quelle.contentReferenceState === "NOT_CAPTURED") {
        expect(quelle.rawOrRenderedContentReference).toBeNull();
        // Die leere Zeichenkette ist ausdrücklich KEIN Ersatz für eine fehlende Referenz.
        expect(quelle.rawOrRenderedContentReference).not.toBe("");
      }
    }
  });
});

// ================================================================================================
// 5 · DIE OBERFLÄCHE BLEIBT GESPERRT
// ================================================================================================
//
// Dieser Block ist HEUTE GRÜN und muss es bleiben. Er ist der einzige Schutz dagegen, dass die
// Voraussetzungstranche still zur Sichtbarkeit durchrutscht (KW-S4-26 §186-200). Er prüft die
// Bauform am Dateibestand, nicht an einer Momentaufnahme des DOM.

describe("W2-A/148 · 5 · keine vorgezogene Sichtbarkeit", () => {
  it("kein Feature-Schalter für eine W2-Resultatfläche", async () => {
    const { SCHALTER_NAMEN } = await import("../../services/app/src/feature-flags");
    for (const name of SCHALTER_NAMEN) {
      expect(name.toLowerCase()).not.toContain("resultat");
      expect(name.toLowerCase()).not.toContain("importresult");
    }
  });

  it("das Navigationselement `import` bleibt hinter Stufe 2 und Admin", async () => {
    const { ALL_ITEMS } = await import("../../apps/web/src/app/navigation");
    const eintrag = ALL_ITEMS.find((i) => i.id === "import");
    expect(eintrag, "das Import-Element muss es weiterhin geben").toBeDefined();
    expect(eintrag?.stufe2, "es bleibt Stufe-2-gebunden").toBe(true);
    expect(eintrag?.minRole).toBe("admin");
  });

  it("ImportResultView hat weiterhin keinen Aufrufer in der Oberfläche", async () => {
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const wurzel = join(__dirname, "..", "..", "apps", "web", "src");
    const eigenerOrdner = join("components", "confluence-import");

    const treffer: string[] = [];
    const lauf = (verzeichnis: string): void => {
      for (const eintrag of readdirSync(verzeichnis)) {
        const pfad = join(verzeichnis, eintrag);
        if (statSync(pfad).isDirectory()) {
          lauf(pfad);
          continue;
        }
        if (!/\.tsx?$/.test(eintrag) || pfad.includes(eigenerOrdner)) {
          continue;
        }
        if (/\bImportResultView\b/.test(readFileSync(pfad, "utf8"))) {
          treffer.push(pfad.slice(wurzel.length + 1));
        }
      }
    };
    lauf(wurzel);

    // `lib/importResultView.ts` trägt den Typnamen selbst — das ist die Definition, kein Aufrufer.
    const aufrufer = treffer.filter((p) => !p.endsWith(join("lib", "importResultView.ts")));
    expect(aufrufer, "keine Seite darf die Resultatfläche rendern").toEqual([]);
  });
});
