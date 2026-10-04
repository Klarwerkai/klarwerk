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
// den Nachbardateien. Das Double führt ein VERÄNDERLICHES Laufwerk (Ordner, Unterordner, Dateien)
// und liefert Ordnerlisten in Seiten zu 50 mit `@odata.nextLink` — so, wie Graph es tut. Jeder
// Aufruf an eine andere Adresse wird abgelehnt UND festgehalten: ein Dokument, das an ein externes
// Modell ginge, stünde in `fremdeAufrufe`.
//
// Nachgearbeitet nach bens Befunden F1–F4 (L7–L10): Fortsetzung nach Änderung der Ordnerliste,
// mehr als zehn Listenseiten, Unterordner auf allen Ebenen, Laufakte allein mit SharePoint.
//
// KEIN GEFAHRENER GRAPH-LAUF WIRD BEHAUPTET. Was hier läuft, ist der Vertrag, nicht Microsoft 365,
// und keine Bedienung durch einen Menschen: die Tür hat (noch) keine Fläche in der Oberfläche.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { SHAREPOINT_LOS_GROESSE } from "../../services/app/src/routes/sharepoint-import-routes";

// Vor dem ersten `buildServices()`: dort wird der quellneutrale Import-Strang beim BAUEN gelesen.
// Confluence steht in den meisten Fällen MIT an, wie in jeder Installation mit beiden Quellen; L10
// schaltet es ausdrücklich ab und misst den Leseweg allein mit SharePoint.
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
const GRAPH = "https://graph.microsoft.test/";
const SEITE = 50;

const kennung = (n: number): string => `DOC-${String(n).padStart(3, "0")}`;
const kennungen = (von: number, bis: number): string[] =>
  Array.from({ length: bis - von + 1 }, (_, i) => kennung(von + i));

// ------------------------------------------------------------------------------------------------
// DAS VERÄNDERLICHE LAUFWERK DES DOUBLES.
// ------------------------------------------------------------------------------------------------
type Kind = { readonly id: string; readonly ordner?: true };
/** Ordnerschlüssel ("root" oder Ordnerkennung) → Kinder in Lieferfolge. */
const laufwerk = new Map<string, Kind[]>();
/** Dateien, die in der Liste stehen, deren gezielter Abruf aber 404 liefert (L4). */
const abrufFehlt = new Set<string>();

function dateien(ids: readonly string[]): Kind[] {
  return ids.map((id) => ({ id }));
}

/** Der Standardbestand: 120 Dateien im Wurzelordner, UMGEKEHRT geliefert, dazu ein leerer Ordner. */
function standardLaufwerk(): void {
  laufwerk.clear();
  const wurzel = dateien([...kennungen(1, 120)].reverse());
  wurzel.splice(7, 0, { id: "ARCHIV", ordner: true });
  laufwerk.set("root", wurzel);
  laufwerk.set("ARCHIV", []);
}

function entferne(id: string): void {
  for (const [schluessel, kinder] of laufwerk) {
    laufwerk.set(
      schluessel,
      kinder.filter((k) => k.id !== id),
    );
  }
}

function istVorhandeneDatei(id: string): boolean {
  for (const kinder of laufwerk.values()) {
    if (kinder.some((k) => k.id === id && !k.ordner)) {
      return true;
    }
  }
  return false;
}

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

function listenEintrag(kind: Kind) {
  if (kind.ordner) {
    return { id: kind.id, name: kind.id, folder: { childCount: 1 } };
  }
  return driveItem(kind.id);
}

const echtesFetch = globalThis.fetch;
const fremdeAufrufe: string[] = [];
const graphAufrufe: string[] = [];
const listenAufrufe: string[] = [];

function antwort(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
  } as unknown as Response;
}

/** Eine Ordnerliste in Seiten zu 50 — die Folgeseite kommt über `@odata.nextLink`. */
function ordnerSeite(url: string, schluessel: string): Response {
  const kinder = laufwerk.get(schluessel);
  if (!kinder) {
    return antwort({ error: { code: "itemNotFound" } }, 404);
  }
  listenAufrufe.push(url);
  const adresse = new URL(url);
  const seite = Number(adresse.searchParams.get("seite") ?? "0");
  const value = kinder.slice(seite * SEITE, (seite + 1) * SEITE).map(listenEintrag);
  const weiter = (seite + 1) * SEITE < kinder.length;
  adresse.searchParams.set("seite", String(seite + 1));
  return antwort(weiter ? { value, "@odata.nextLink": adresse.toString() } : { value });
}

beforeAll(() => {
  (globalThis as unknown as { fetch: unknown }).fetch = (async (eingabe: unknown) => {
    const url = String(eingabe);
    if (!url.startsWith(GRAPH)) {
      fremdeAufrufe.push(url);
      throw new Error(`Unerlaubter Aufruf im Test: ${url}`);
    }
    graphAufrufe.push(url);
    if (url.includes("/root/children")) {
      return ordnerSeite(url, "root");
    }
    const ordner = /\/items\/([^/?]+)\/children/.exec(url);
    if (ordner) {
      return ordnerSeite(url, decodeURIComponent(ordner[1] ?? ""));
    }
    const treffer = /\/items\/([^/?]+)\?/.exec(url);
    const id = treffer ? decodeURIComponent(treffer[1] ?? "") : "";
    if (istVorhandeneDatei(id) && !abrufFehlt.has(id)) {
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
  standardLaufwerk();
  abrufFehlt.clear();
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
    kennungen: string[];
    vollstaendig: boolean;
    fortsetzungAb: string | null;
    verbleibend: number;
    inventar: { dateien: number; unterordner: number; vollstaendig: boolean };
    ordnerAbgeschlossen: boolean;
  };
}

async function holeLos(app: App, headers: Headers, payload: unknown) {
  return app.inject({ method: "POST", url: TUER, headers, payload: payload as object });
}

async function uebernimmLos(
  app: App,
  headers: Headers,
  payload: { folderId?: string; fortsetzungAb?: string },
): Promise<Losantwort> {
  const res = await holeLos(app, headers, payload);
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as Losantwort;
}

/** Alle Quellkennungen der Vorgänge, wie die Warteschlange sie zurückgibt (frische App je Fall). */
async function vorgaenge(app: App, headers: Headers): Promise<string[]> {
  const res = await app.inject({ method: "GET", url: "/api/library/import/candidates", headers });
  expect(res.statusCode, res.body).toBe(200);
  return (res.json() as { item: { externalId?: string } }[])
    .map((k) => k.item.externalId ?? "")
    .filter((id) => id.length > 0);
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

/**
 * Die angebotene Fortsetzung bis zum Ende bedienen — und nach JEDEM Aufruf am Bestand messen, dass
 * ohne Folgeaufruf nichts weiter entstanden ist (der Halt).
 */
async function bisZumEnde(
  app: App,
  headers: Headers,
  folderId?: string,
  vorJedemFolgeaufruf?: (schritt: number) => void,
): Promise<Losantwort[]> {
  const antworten: Losantwort[] = [];
  let fortsetzungAb: string | null | undefined;
  let bisher = (await vorgaenge(app, headers)).length;
  for (let schritt = 0; fortsetzungAb !== null; schritt++) {
    expect(schritt, "die Losfolge endet").toBeLessThan(100);
    if (schritt > 0) {
      vorJedemFolgeaufruf?.(schritt);
    }
    const ergebnis: Losantwort = await uebernimmLos(app, headers, {
      ...(folderId ? { folderId } : {}),
      ...(fortsetzungAb ? { fortsetzungAb } : {}),
    });
    antworten.push(ergebnis);
    const jetzt = (await vorgaenge(app, headers)).length;
    expect(jetzt - bisher, "ein Aufruf reiht höchstens sein eigenes Los ein").toBe(
      ergebnis.imported,
    );
    expect(ergebnis.los.kennungen.length).toBeLessThanOrEqual(SHAREPOINT_LOS_GROESSE);
    bisher = jetzt;
    fortsetzungAb = ergebnis.los.fortsetzungAb;
  }
  return antworten;
}

/** Jede Kennung genau einmal: sortiert verglichen, Dubletten fielen dabei auf. */
function genauEinmal(ist: string[], soll: string[]): void {
  expect(ist.length, "keine Datei doppelt").toBe(new Set(ist).size);
  expect([...ist].sort()).toEqual([...soll].sort());
}

// ==================================================================================================
// L1 — EIN LOS, DANN HALT.
// ==================================================================================================
describe("R-0145 · L1 — ein Aufruf übernimmt genau ein Los und hält dann an", () => {
  it("L1 · der erste Aufruf bringt die ersten 50 Dateien nach Kennung — und keine einzige mehr", async () => {
    const { app, headers } = await appMitAdmin();

    const erstes = await uebernimmLos(app, headers, {});
    expect(SHAREPOINT_LOS_GROESSE).toBe(50);
    expect(erstes.los.kennungen, "sortiert nach Kennung, nicht nach Lieferfolge").toEqual(
      kennungen(1, 50),
    );
    expect(erstes.los.kennungen, "ein Ordner ist keine Datei").not.toContain("ARCHIV");
    expect(erstes.imported).toBe(50);
    expect(erstes.los.vollstaendig).toBe(true);
    expect(erstes.los.fortsetzungAb, "die Fortsetzung wird angeboten, nicht gefahren").toBe(
      kennung(50),
    );
    expect(erstes.los.verbleibend).toBe(70);
    expect(erstes.los.inventar).toEqual({ dateien: 120, unterordner: 1, vollstaendig: true });
    expect(erstes.los.ordnerAbgeschlossen).toBe(false);

    // DER HALT, am Bestand gemessen: nach dem ersten Aufruf stehen 50 Vorgänge da, nicht 120.
    genauEinmal(await vorgaenge(app, headers), kennungen(1, 50));

    const lauf = await liesLauf(app, headers, erstes.importId);
    expect(lauf.status).toBe("COMPLETED");
    expect(lauf.sourceScope).toBe("drive:b!testbibliothek/folder:root/ab:anfang");
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
  it("L2 · wer der angebotenen Fortsetzung folgt, hat am Ende jede Datei genau einmal", async () => {
    const { app, headers } = await appMitAdmin();

    const antworten = await bisZumEnde(app, headers);
    const akten = await Promise.all(antworten.map((a) => liesLauf(app, headers, a.importId)));

    expect(antworten.map((a) => a.los.kennungen.length)).toEqual([50, 50, 20]);
    expect(antworten.map((a) => a.los.ordnerAbgeschlossen)).toEqual([false, false, true]);
    expect(akten.map((a) => a.status)).toEqual(["COMPLETED", "COMPLETED", "COMPLETED"]);
    expect(akten.map((a) => a.sourceScope)).toEqual([
      "drive:b!testbibliothek/folder:root/ab:anfang",
      `drive:b!testbibliothek/folder:root/ab:${kennung(50)}`,
      `drive:b!testbibliothek/folder:root/ab:${kennung(100)}`,
    ]);
    genauEinmal(await vorgaenge(app, headers), kennungen(1, 120));
  });
});

// ==================================================================================================
// L3 — WIEDERANLAUF NACH DEM HALT.
// ==================================================================================================
describe("R-0145 · L3 — dasselbe Los noch einmal ist gefahrlos", () => {
  it("L3 · dieselbe Fortsetzung ein zweites Mal reiht nichts neu ein und bleibt vollständig", async () => {
    const { app, headers } = await appMitAdmin();
    await uebernimmLos(app, headers, {});
    await uebernimmLos(app, headers, { fortsetzungAb: kennung(50) });
    expect((await vorgaenge(app, headers)).length).toBe(100);

    const nochmal = await uebernimmLos(app, headers, { fortsetzungAb: kennung(50) });
    expect(nochmal.imported, "dieselben Dateien, derselbe Stand: nichts Neues").toBe(0);
    expect(nochmal.alreadyQueued).toBe(50);
    expect(nochmal.los.kennungen, "dieselbe Fortsetzung trifft dieselben Dateien").toEqual(
      kennungen(51, 100),
    );
    expect(nochmal.los.vollstaendig).toBe(true);
    genauEinmal(await vorgaenge(app, headers), kennungen(1, 100));
  });
});

// ==================================================================================================
// L4 — EIN UNVOLLSTÄNDIGES LOS SAGT ES.
// ==================================================================================================
describe("R-0145 · L4 — welche Lose vollständig sind, ist nachvollziehbar", () => {
  it("L4 · scheitert der Abruf einer Datei, ist genau dieses Los PARTIAL — die anderen nicht", async () => {
    const { app, headers } = await appMitAdmin();
    abrufFehlt.add(kennung(75));

    const antworten = await bisZumEnde(app, headers);
    expect(antworten.map((a) => a.los.vollstaendig)).toEqual([true, false, true]);
    expect(antworten[1]?.notFound).toEqual([kennung(75)]);
    expect(antworten[1]?.imported).toBe(49);
    const akten = await Promise.all(antworten.map((a) => liesLauf(app, headers, a.importId)));
    expect(
      akten.map((a) => a.status),
      "die Laufakten sagen dasselbe wie die Antworten",
    ).toEqual(["COMPLETED", "PARTIAL", "COMPLETED"]);
    expect(akten[1]?.counters.itemsFailed).toBe(1);
  });
});

// ==================================================================================================
// L5 — KEIN MODELL, KEIN FREMDER EMPFÄNGER.
// ==================================================================================================
describe("R-0145 · L5 — kein KI-Aufruf je Objekt, kein Dokument an ein externes Modell", () => {
  it("L5 · der ganze Ordner läuft ohne einen einzigen protokollierten Modelllauf", async () => {
    const { app, headers, services } = await appMitAdmin();
    await bisZumEnde(app, headers);
    expect((await vorgaenge(app, headers)).length, "ohne Übernahme prüfte der Fall nichts").toBe(
      120,
    );
    // Jeder Reasoner-Aufruf läuft über das Laufprotokoll (`build-app.ts`, ProtokollModelRunRepo).
    expect(await services.modelRuns.recent(1000), "ein Modelllauf wurde protokolliert").toEqual([]);
  });
});

// ==================================================================================================
// L6 — EHRLICHE RÄNDER.
// ==================================================================================================
describe("R-0190 · L6 — Ränder der Ordnerübernahme", () => {
  it("L6a · eine Fortsetzung hinter der letzten Datei ist eine Auskunft ohne Lauf", async () => {
    const { app, headers } = await appMitAdmin();
    const ende = await uebernimmLos(app, headers, { fortsetzungAb: "DOC-999" });
    expect(ende.los.kennungen).toEqual([]);
    expect(ende.los.ordnerAbgeschlossen).toBe(true);
    expect(ende.importId, "nichts zu tun heisst: kein Lauf").toBeUndefined();
    expect(await vorgaenge(app, headers)).toEqual([]);
  });

  it("L6b · eine Fortsetzung, die keine Kennung ist, ist ein 400 und schreibt nichts", async () => {
    const { app, headers } = await appMitAdmin();
    for (const fortsetzungAb of [1, "", "x".repeat(513)]) {
      const res = await holeLos(app, headers, { fortsetzungAb });
      expect(res.statusCode, res.body).toBe(400);
      expect((res.json() as { error: string }).error).toBe("FORTSETZUNG_INVALID");
    }
    expect(await vorgaenge(app, headers)).toEqual([]);
  });

  it("L6c · ein wirklich leerer Ordner ist eine Auskunft ohne Lauf", async () => {
    const { app, headers } = await appMitAdmin();
    const leer = await uebernimmLos(app, headers, { folderId: "ARCHIV" });
    expect(leer.los.inventar).toEqual({ dateien: 0, unterordner: 0, vollstaendig: true });
    expect(leer.los.ordnerAbgeschlossen).toBe(true);
    expect(leer.importId).toBeUndefined();
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

// ==================================================================================================
// L7 — bens F2: DIE ORDNERLISTE ÄNDERT SICH ZWISCHEN DEN LOSEN.
// ==================================================================================================
describe("R-0145 · L7 — Fortsetzung nach Änderung der Ordnerliste überspringt nichts", () => {
  it("L7 · DOC-001 verschwindet nach Los 1 — DOC-051 und jede weiterhin vorhandene Datei kommen genau einmal an", async () => {
    const { app, headers } = await appMitAdmin();

    const antworten = await bisZumEnde(app, headers, undefined, (schritt) => {
      if (schritt === 1) {
        entferne(kennung(1));
      }
    });

    expect(antworten[0]?.los.kennungen).toEqual(kennungen(1, 50));
    expect(
      antworten[1]?.los.kennungen[0],
      "das zweite Los beginnt bei DOC-051, nicht bei DOC-052",
    ).toBe(kennung(51));
    expect(antworten.map((a) => a.los.kennungen.length)).toEqual([50, 50, 20]);
    expect(antworten[2]?.los.inventar.dateien, "die Inventur sieht den neuen Stand").toBe(119);

    const bestand = await vorgaenge(app, headers);
    expect(bestand).toContain(kennung(51));
    // DOC-001 wurde VOR seinem Verschwinden übernommen; alle übrigen sind weiterhin vorhanden.
    genauEinmal(bestand, kennungen(1, 120));
    const akten = await Promise.all(antworten.map((a) => liesLauf(app, headers, a.importId)));
    expect(akten.map((a) => a.status)).toEqual(["COMPLETED", "COMPLETED", "COMPLETED"]);
  });
});

// ==================================================================================================
// L8 — bens F1: MEHR ALS ZEHN LISTENSEITEN.
// ==================================================================================================
describe("R-0190 · L8 — ein Ordner über elf Listenseiten kommt vollständig an", () => {
  it("L8 · 550 Dateien auf elf verketteten Seiten: alle genau einmal, Abschluss erst ganz am Ende", async () => {
    standardLaufwerk();
    laufwerk.set("root", dateien(kennungen(1, 550)));
    const { app, headers } = await appMitAdmin();

    listenAufrufe.length = 0;
    const erstes = await uebernimmLos(app, headers, {});
    expect(listenAufrufe.length, "die Inventur folgt allen elf Seiten").toBe(11);
    expect(erstes.los.inventar).toEqual({ dateien: 550, unterordner: 0, vollstaendig: true });

    const rest = await bisZumEnde(app, headers, undefined);
    // `bisZumEnde` beginnt von vorn; das erste Los ist dann ein Wiederholaufruf.
    expect(rest[0]?.imported).toBe(0);
    expect(rest).toHaveLength(11);
    expect(rest.map((a) => a.los.ordnerAbgeschlossen)).toEqual([
      ...Array.from({ length: 10 }, () => false),
      true,
    ]);
    expect(rest[10]?.los.kennungen, "die Dateien der elften Seite").toEqual(kennungen(501, 550));
    genauEinmal(await vorgaenge(app, headers), kennungen(1, 550));
  });
});

// ==================================================================================================
// L9 — bens F3: UNTERORDNER AUF ALLEN EBENEN.
// ==================================================================================================
describe("R-0190 · L9 — ein Kundenordner samt verschachtelter Unterordner", () => {
  it("L9a · direkte Dateien, Unterordner und Unter-Unterordner: jede Datei genau einmal, kein Ordner", async () => {
    laufwerk.set("KUNDE", [{ id: "K-A1" }, { id: "KUNDE-SUB", ordner: true }, { id: "K-A2" }]);
    laufwerk.set("KUNDE-SUB", [{ id: "K-B1" }, { id: "KUNDE-SUB-SUB", ordner: true }]);
    laufwerk.set("KUNDE-SUB-SUB", [{ id: "K-C1" }, { id: "K-C2" }]);
    const { app, headers } = await appMitAdmin();

    const antworten = await bisZumEnde(app, headers, "KUNDE");
    expect(antworten).toHaveLength(1);
    expect(antworten[0]?.los.inventar).toEqual({ dateien: 5, unterordner: 2, vollstaendig: true });
    expect(antworten[0]?.los.ordnerAbgeschlossen).toBe(true);

    const bestand = await vorgaenge(app, headers);
    genauEinmal(bestand, ["K-A1", "K-A2", "K-B1", "K-C1", "K-C2"]);
    expect(bestand, "Ordner werden keine Vorgänge").not.toContain("KUNDE-SUB");
    expect(bestand).not.toContain("KUNDE-SUB-SUB");
    expect(bestand, "der Wurzelordner gehört nicht zum gewählten Kundenordner").not.toContain(
      kennung(1),
    );
  });

  it("L9b · ein Kundenordner nur mit einem befüllten Unterordner ist NICHT leer", async () => {
    laufwerk.set("NUR-UNTER", [{ id: "NUR-UNTER-SUB", ordner: true }]);
    laufwerk.set("NUR-UNTER-SUB", [{ id: "N-1" }, { id: "N-2" }]);
    const { app, headers } = await appMitAdmin();

    const ergebnis = await uebernimmLos(app, headers, { folderId: "NUR-UNTER" });
    expect(ergebnis.los.kennungen).toEqual(["N-1", "N-2"]);
    expect(ergebnis.imported).toBe(2);
    expect(ergebnis.importId, "hier gab es etwas zu tun — also einen Lauf").toBeTruthy();
    genauEinmal(await vorgaenge(app, headers), ["N-1", "N-2"]);
  });
});

// ==================================================================================================
// L10 — bens F4: DIE LAUFAKTE ALLEIN MIT SHAREPOINT.
// ==================================================================================================
describe("R-0145 · L10 — die Laufakte ist auch ohne Confluence-Schalter lesbar", () => {
  it("L10 · SharePoint=1, Confluence=0: runs/:id und /result liefern Scope, Status und Zähler", async () => {
    const vorher = process.env.KLARWERK_CONFLUENCE_IMPORT;
    process.env.KLARWERK_CONFLUENCE_IMPORT = "0";
    try {
      const { app, headers } = await appMitAdmin();
      const confluence = await app.inject({
        method: "POST",
        url: "/api/admin/import/confluence",
        headers,
        payload: { dryRun: true },
      });
      expect(confluence.statusCode, "Vorbedingung: Confluence ist wirklich aus").toBe(404);

      const erstes = await uebernimmLos(app, headers, {});
      const akte = await liesLauf(app, headers, erstes.importId);
      expect(akte.sourceScope).toBe("drive:b!testbibliothek/folder:root/ab:anfang");
      expect(akte.status).toBe("COMPLETED");
      expect(akte.counters.itemsCreated).toBe(50);

      const ergebnis = await app.inject({
        method: "GET",
        url: `/api/admin/import/runs/${erstes.importId}/result`,
        headers,
      });
      expect(ergebnis.statusCode, ergebnis.body).toBe(200);
      const run = (ergebnis.json() as { run: Laufakte }).run;
      expect(run.sourceScope).toBe(akte.sourceScope);
      expect(run.status).toBe("COMPLETED");
      expect(run.counters).toEqual(akte.counters);
      await app.close();
    } finally {
      process.env.KLARWERK_CONFLUENCE_IMPORT = vorher ?? "1";
    }
  });
});

describe("R-0145 · NETZPROBE", () => {
  it("in dieser Datei ging kein Aufruf an eine fremde Adresse", () => {
    expect(fremdeAufrufe).toEqual([]);
    // Und sie ist nicht deshalb leer, weil nichts lief.
    expect(graphAufrufe.length).toBeGreaterThan(550);
  });
});
