// ================================================================================================
// R-0145 / R-0190 — EIN GANZER KUNDENORDNER, IN LOSEN, MIT HALT NACH JEDEM LOS, OHNE MODELL.
// ================================================================================================
//
// DIE SÄTZE, DIE DIESE DATEI MISST:
//
//   R-0145  „Grosse Bestaende werden in Losen geladen, mit Haltepunkten dazwischen und ohne dass
//            fuer jedes Objekt ein KI-Aufruf laeuft. […] macht nachvollziehbar, welche Lose
//            vollstaendig sind."
//   R-0190  „Ein allgemeiner Weg, ganze Ordner eines Kunden zu uebernehmen."
//
// GEMESSEN WIRD AM ZURÜCKGELESENEN BESTAND (Prüf-Warteschlange, Laufakte), nicht nur an der
// Antwort der Tür — dieselbe Regel wie in `wiederholimport-am-draht.test.ts`.
//
// DER GRAPH-VERTRAG ALS DOUBLE: `globalThis.fetch` wird für die Dauer dieser Datei ersetzt, wie in
// den Nachbardateien. Jeder Aufruf an eine andere Adresse wird abgelehnt UND festgehalten — ein
// Dokument, das an ein externes Modell ginge, stünde also in `fremdeAufrufe`.
//
// KEIN GEFAHRENER GRAPH-LAUF WIRD BEHAUPTET. Was hier läuft, ist der Vertrag, nicht Microsoft 365,
// und keine Bedienung durch einen Menschen: die Tür hat (noch) keine Fläche in der Oberfläche.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { SHAREPOINT_LOS_GROESSE } from "../../services/app/src/routes/sharepoint-import-routes";

// Vor dem ersten `buildServices()`: dort wird der quellneutrale Import-Strang beim BAUEN gelesen.
// Der Confluence-Schalter steht mit an, weil der Leseweg der Laufakte nur hinter ihm registriert ist
// (Befund in `wiederholimport-am-draht.test.ts`, W1b) — ohne ihn liesse sich kein Los nachlesen.
const SCHALTER: Record<string, string> = {
  KLARWERK_SHAREPOINT_IMPORT: "1",
  KLARWERK_SHAREPOINT_BASE_URL: "https://graph.microsoft.test/v1.0",
  KLARWERK_SHAREPOINT_TOKEN: "vertragsdouble-nur-fuer-den-test",
  KLARWERK_SHAREPOINT_DRIVE: "b!testbibliothek",
  KLARWERK_CONFLUENCE_IMPORT: "1",
};
const VORHER: Record<string, string | undefined> = {};
for (const [name, wert] of Object.entries(SCHALTER)) {
  VORHER[name] = process.env[name];
  process.env[name] = wert;
}

const ADMIN = {
  name: "Admin Lose",
  email: "admin-lose@example.com",
  password: "geheim-1234",
};

const TUER = "/api/admin/import/sharepoint/folder-apply";

/** 120 Dateien: zwei volle Lose zu 50 und ein Restlos zu 20. */
const ANZAHL_DATEIEN = 120;
const kennung = (n: number): string => `DOC-${String(n).padStart(3, "0")}`;
const ALLE_KENNUNGEN = Array.from({ length: ANZAHL_DATEIEN }, (_, i) => kennung(i + 1));

/** Dateien, die zwischen Ordnerliste und Abruf verschwunden sind (stellbar je Fall). */
const verschwunden = new Set<string>();

function driveItem(id: string) {
  return {
    id,
    name: `${id}.docx`,
    webUrl: `https://contoso.sharepoint.test/sites/kunde/Freigegeben/${id}.docx`,
    lastModifiedDateTime: "2026-09-10T08:30:00Z",
    size: 24_576,
    description: `Arbeitsanweisung ${id}`,
    file: { mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
    lastModifiedBy: { user: { displayName: "R. Schuster" } },
  };
}

const echtesFetch = globalThis.fetch;
const fremdeAufrufe: string[] = [];
const graphAufrufe: string[] = [];

function antwort(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
  } as unknown as Response;
}

beforeAll(() => {
  (globalThis as unknown as { fetch: unknown }).fetch = (async (eingabe: unknown) => {
    const url = String(eingabe);
    if (!url.startsWith("https://graph.microsoft.test/")) {
      fremdeAufrufe.push(url);
      throw new Error(`Unerlaubter Aufruf im Test: ${url}`);
    }
    graphAufrufe.push(url);
    if (url.includes("/root/children")) {
      // UMGEKEHRTE Reihenfolge und ein Unterordner dazwischen: die Lose dürfen weder an der
      // Lieferfolge von Graph hängen noch einen Ordner als Datei führen.
      const dateien = [...ALLE_KENNUNGEN].reverse().map(driveItem);
      const unterordner = { id: "UNTERORDNER-1", name: "Archiv", folder: { childCount: 3 } };
      return antwort({ value: [...dateien.slice(0, 7), unterordner, ...dateien.slice(7)] });
    }
    if (url.includes("/items/ORDNER-LEER/children")) {
      return antwort({ value: [] });
    }
    const treffer = /\/items\/([^/?]+)\?/.exec(url);
    const id = treffer ? decodeURIComponent(treffer[1] ?? "") : "";
    if (ALLE_KENNUNGEN.includes(id) && !verschwunden.has(id)) {
      return antwort(driveItem(id));
    }
    return antwort({ error: { code: "itemNotFound" } }, 404);
  }) as unknown as typeof fetch;
});

afterAll(() => {
  (globalThis as unknown as { fetch: unknown }).fetch = echtesFetch;
  for (const [name, wert] of Object.entries(VORHER)) {
    if (wert === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = wert;
    }
  }
});

beforeEach(() => {
  verschwunden.clear();
});

async function appMitAdmin() {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({ method: "POST", url: "/api/auth/register", payload: ADMIN });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: ADMIN.email, password: ADMIN.password },
  });
  const token = (login.json() as { token?: string }).token ?? "";
  expect(token, "der Bootstrap-Admin muss ein Token bekommen").not.toBe("");
  return { app, services, headers: { authorization: `Bearer ${token}` } };
}

type App = Awaited<ReturnType<typeof appMitAdmin>>["app"];
type Headers = Record<string, string>;

interface Losantwort {
  imported: number;
  alreadyQueued: number;
  failed: { id: string }[];
  notFound: string[];
  importId?: string;
  los: {
    index: number;
    anzahl: number;
    groesse: number;
    kennungen: string[];
    vollstaendig: boolean;
    naechstesLos: number | null;
    ordnerVollstaendigGelesen: boolean;
  };
}

async function holeLos(app: App, headers: Headers, payload: unknown) {
  return app.inject({ method: "POST", url: TUER, headers, payload: payload as object });
}

async function uebernimmLos(app: App, headers: Headers, los: number): Promise<Losantwort> {
  const res = await holeLos(app, headers, { los });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as Losantwort;
}

/** Die Kennungen der Vorgänge zu diesem Ordner, wie die Warteschlange sie zurückgibt. */
async function vorgaenge(app: App, headers: Headers): Promise<string[]> {
  const res = await app.inject({ method: "GET", url: "/api/library/import/candidates", headers });
  expect(res.statusCode, res.body).toBe(200);
  return (res.json() as { item: { externalId?: string } }[])
    .map((k) => k.item.externalId ?? "")
    .filter((id) => id.startsWith("DOC-"));
}

interface Laufakte {
  status: string;
  sourceScope: string | null;
  counters: Record<string, number>;
}

async function liesLauf(app: App, headers: Headers, importId: string | undefined) {
  expect(importId, "jedes Los braucht eine Kennung, unter der es nachlesbar ist").toBeTruthy();
  const res = await app.inject({
    method: "GET",
    url: `/api/admin/import/runs/${importId}`,
    headers,
  });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as Laufakte;
}

// ==================================================================================================
// L1 — EIN LOS, DANN HALT.
// ==================================================================================================
describe("R-0145 · L1 — ein Aufruf übernimmt genau ein Los und hält dann an", () => {
  it("L1 · Los 0 bringt die ersten 50 Dateien nach Kennung — und keine einzige mehr", async () => {
    const { app, headers } = await appMitAdmin();

    const erstes = await uebernimmLos(app, headers, 0);
    expect(SHAREPOINT_LOS_GROESSE).toBe(50);
    expect(erstes.los.anzahl, "120 Dateien sind drei Lose").toBe(3);
    expect(erstes.los.kennungen, "sortiert nach Kennung, nicht nach Lieferfolge").toEqual(
      ALLE_KENNUNGEN.slice(0, 50),
    );
    expect(erstes.los.kennungen, "der Unterordner ist keine Datei").not.toContain("UNTERORDNER-1");
    expect(erstes.imported).toBe(50);
    expect(erstes.los.vollstaendig).toBe(true);
    expect(erstes.los.naechstesLos, "das nächste Los wird angeboten, nicht gefahren").toBe(1);
    expect(erstes.los.ordnerVollstaendigGelesen).toBe(true);

    // DER HALT, am Bestand gemessen: nach dem ersten Aufruf stehen 50 Vorgänge da, nicht 120.
    const nachErstem = await vorgaenge(app, headers);
    expect(nachErstem.sort()).toEqual(ALLE_KENNUNGEN.slice(0, 50));

    // DER NACHWEIS: das Los ist ein eigener Lauf, und seine Akte sagt, welches Los es war.
    const lauf = await liesLauf(app, headers, erstes.importId);
    expect(lauf.status).toBe("COMPLETED");
    expect(lauf.sourceScope).toBe("drive:b!testbibliothek/folder:root/los:1-von-3");
    expect(lauf.counters).toEqual({
      itemsTotal: 50,
      itemsCreated: 50,
      itemsBound: 0,
      itemsSkipped: 0,
      itemsFailed: 0,
    });
  });
});

// ==================================================================================================
// L2 — DER GANZE ORDNER, LOS FÜR LOS.
// ==================================================================================================
describe("R-0190 · L2 — ein ganzer Ordner kommt über die Lose vollständig an", () => {
  it("L2 · wer `naechstesLos` folgt, hat am Ende jede Datei genau einmal in der Prüfung", async () => {
    const { app, headers } = await appMitAdmin();

    const akten: Laufakte[] = [];
    const groessen: number[] = [];
    let los: number | null = 0;
    while (los !== null) {
      const ergebnis: Losantwort = await uebernimmLos(app, headers, los);
      groessen.push(ergebnis.los.kennungen.length);
      akten.push(await liesLauf(app, headers, ergebnis.importId));
      los = ergebnis.los.naechstesLos;
    }

    expect(groessen, "zwei volle Lose und ein Restlos").toEqual([50, 50, 20]);
    expect(akten.map((a) => a.status)).toEqual(["COMPLETED", "COMPLETED", "COMPLETED"]);
    expect(akten.map((a) => a.sourceScope)).toEqual([
      "drive:b!testbibliothek/folder:root/los:1-von-3",
      "drive:b!testbibliothek/folder:root/los:2-von-3",
      "drive:b!testbibliothek/folder:root/los:3-von-3",
    ]);
    const bestand = await vorgaenge(app, headers);
    expect(bestand.sort(), "jede Datei des Ordners, keine doppelt").toEqual(ALLE_KENNUNGEN);
  });
});

// ==================================================================================================
// L3 — WIEDERANLAUF NACH DEM HALT.
// ==================================================================================================
describe("R-0145 · L3 — dasselbe Los noch einmal ist gefahrlos", () => {
  it("L3 · Los 1 ein zweites Mal reiht nichts neu ein und bleibt vollständig", async () => {
    const { app, headers } = await appMitAdmin();
    await uebernimmLos(app, headers, 0);
    await uebernimmLos(app, headers, 1);
    const vorher = (await vorgaenge(app, headers)).length;
    expect(vorher).toBe(100);

    const nochmal = await uebernimmLos(app, headers, 1);
    expect(nochmal.imported, "dieselben Dateien, derselbe Stand: nichts Neues").toBe(0);
    expect(nochmal.alreadyQueued).toBe(50);
    expect(nochmal.los.kennungen, "dasselbe Los trifft dieselben Dateien").toEqual(
      ALLE_KENNUNGEN.slice(50, 100),
    );
    expect(nochmal.los.vollstaendig).toBe(true);
    expect((await vorgaenge(app, headers)).length, "kein Doppelbestand").toBe(vorher);
  });
});

// ==================================================================================================
// L4 — EIN UNVOLLSTÄNDIGES LOS SAGT ES.
// ==================================================================================================
describe("R-0145 · L4 — welche Lose vollständig sind, ist nachvollziehbar", () => {
  it("L4 · fehlt eine Datei beim Abruf, ist genau dieses Los PARTIAL — die anderen nicht", async () => {
    const { app, headers } = await appMitAdmin();
    verschwunden.add(kennung(75));

    const erstes = await uebernimmLos(app, headers, 0);
    const zweites = await uebernimmLos(app, headers, 1);

    expect(erstes.los.vollstaendig).toBe(true);
    expect(zweites.los.vollstaendig, "eine verschwundene Datei macht das Los unvollständig").toBe(
      false,
    );
    expect(zweites.notFound).toEqual([kennung(75)]);
    expect(zweites.imported).toBe(49);
    expect((await liesLauf(app, headers, erstes.importId)).status).toBe("COMPLETED");
    const akte = await liesLauf(app, headers, zweites.importId);
    expect(akte.status, "die Laufakte sagt dasselbe wie die Antwort").toBe("PARTIAL");
    expect(akte.counters.itemsFailed).toBe(1);
  });
});

// ==================================================================================================
// L5 — KEIN MODELL, KEIN FREMDER EMPFÄNGER.
// ==================================================================================================
describe("R-0145 · L5 — kein KI-Aufruf je Objekt, kein Dokument an ein externes Modell", () => {
  it("L5 · der ganze Ordner läuft ohne einen einzigen protokollierten Modelllauf", async () => {
    const { app, headers, services } = await appMitAdmin();
    let los: number | null = 0;
    while (los !== null) {
      los = (await uebernimmLos(app, headers, los)).los.naechstesLos;
    }
    expect((await vorgaenge(app, headers)).length, "ohne Übernahme prüfte der Fall nichts").toBe(
      ANZAHL_DATEIEN,
    );
    // Jeder Reasoner-Aufruf läuft über das Laufprotokoll (`build-app.ts`, ProtokollModelRunRepo).
    expect(await services.modelRuns.recent(1000), "ein Modelllauf wurde protokolliert").toEqual([]);
  });

  it("NETZPROBE · in dieser Datei ging kein Aufruf an eine fremde Adresse", () => {
    expect(fremdeAufrufe).toEqual([]);
    // Und sie ist nicht deshalb leer, weil nichts lief.
    expect(graphAufrufe.length).toBeGreaterThan(ANZAHL_DATEIEN);
  });
});

// ==================================================================================================
// L6 — EHRLICHE RÄNDER.
// ==================================================================================================
describe("R-0190 · L6 — Ränder der Ordnerübernahme", () => {
  it("L6a · ein Los jenseits des Ordners ist ein 400 und schreibt nichts", async () => {
    const { app, headers } = await appMitAdmin();
    const res = await holeLos(app, headers, { los: 3 });
    expect(res.statusCode, res.body).toBe(400);
    expect((res.json() as { error: string }).error).toBe("LOS_OUT_OF_RANGE");
    expect(await vorgaenge(app, headers)).toEqual([]);
  });

  it("L6b · eine Losnummer, die keine ist, ist ein 400", async () => {
    const { app, headers } = await appMitAdmin();
    for (const los of [-1, 1.5, "1"]) {
      const res = await holeLos(app, headers, { los });
      expect(res.statusCode, `los=${JSON.stringify(los)}: ${res.body}`).toBe(400);
      expect((res.json() as { error: string }).error).toBe("LOS_INVALID");
    }
    expect(await vorgaenge(app, headers)).toEqual([]);
  });

  it("L6c · ein leerer Ordner ist eine Auskunft ohne Lauf", async () => {
    const { app, headers } = await appMitAdmin();
    const res = await holeLos(app, headers, { folderId: "ORDNER-LEER" });
    expect(res.statusCode, res.body).toBe(200);
    const leer = res.json() as Losantwort;
    expect(leer.los.anzahl).toBe(0);
    expect(leer.los.naechstesLos).toBeNull();
    expect(leer.importId, "nichts zu tun heisst: kein Lauf").toBeUndefined();
    expect(await vorgaenge(app, headers)).toEqual([]);
  });

  it("L6d · Tür 2 (Auswahl) behält ihren Scope — der gemeinsame Übernahmeweg ändert ihn nicht", async () => {
    const { app, headers } = await appMitAdmin();
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/import/sharepoint/apply",
      headers,
      payload: { ids: [kennung(1)] },
    });
    expect(res.statusCode, res.body).toBe(200);
    const akte = await liesLauf(app, headers, (res.json() as { importId?: string }).importId);
    expect(akte.sourceScope).toBe("drive:b!testbibliothek");
    expect(akte.status).toBe("COMPLETED");
  });
});
