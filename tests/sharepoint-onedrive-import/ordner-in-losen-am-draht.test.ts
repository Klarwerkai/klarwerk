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
// und liefert Ordnerlisten seitenweise mit `@odata.nextLink`. Der Cursor darin zeigt — wie der
// `$skiptoken` von Graph — HINTER den zuletzt gelieferten Eintrag, nicht auf einen Versatz. Jeder
// Aufruf an eine andere Adresse wird abgelehnt UND festgehalten: ein Dokument, das an ein externes
// Modell ginge, stünde in `fremdeAufrufe`.
//
// Nachgearbeitet nach bens Befunden: F1–F4 (L7–L10) und die fortsetzbare Inventur ohne
// Gesamtkante (L11: 1.001 Listenseiten in einem Ordner, L12: 1.001 Ordner, L13: gescheitertes Los).
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
const LOSFOLGE_SCOPE = /^drive:b!testbibliothek\/folder:root\/losfolge:[0-9a-f-]{36}\/los:(\d+)$/;

const kennung = (n: number): string => `DOC-${String(n).padStart(3, "0")}`;
const kennungen = (von: number, bis: number): string[] =>
  Array.from({ length: bis - von + 1 }, (_, i) => kennung(von + i));

// ------------------------------------------------------------------------------------------------
// DAS VERÄNDERLICHE LAUFWERK DES DOUBLES.
// ------------------------------------------------------------------------------------------------
type Kind = { readonly id: string; readonly ordner?: true };
/** Ordnerschlüssel ("root" oder Ordnerkennung) → Kinder in Lieferfolge. */
const laufwerk = new Map<string, Kind[]>();
/** Einträge je Listenseite (Graph: `$top`); L11 stellt ihn auf 1. */
let seitenGroesse = 50;
/** Dateien, die in der Liste stehen, deren gezielter Abruf aber 404 liefert (L4). */
const abrufFehlt = new Set<string>();
/** Dateien, deren gezielter Abruf mit 401 scheitert — eine Lage, die das ganze Los abbricht (L13). */
const abrufGestoert = new Set<string>();

function dateien(ids: readonly string[]): Kind[] {
  return ids.map((id) => ({ id }));
}

/** Der Standardbestand: 120 Dateien im Wurzelordner, dazwischen ein leerer Unterordner. */
function standardLaufwerk(): void {
  laufwerk.clear();
  seitenGroesse = 50;
  const wurzel = dateien(kennungen(1, 120));
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

/**
 * Eine Ordnerliste, seitenweise. Der Cursor `nach` nennt den zuletzt gelieferten Eintrag; die
 * Folgeseite beginnt dahinter. Ist er inzwischen verschwunden, beginnt sie von vorn — doppelt
 * Geliefertes muss die Inventur dann selbst erkennen.
 */
function ordnerSeite(url: string, schluessel: string): Response {
  const kinder = laufwerk.get(schluessel);
  if (!kinder) {
    return antwort({ error: { code: "itemNotFound" } }, 404);
  }
  listenAufrufe.push(url);
  const adresse = new URL(url);
  const nach = adresse.searchParams.get("nach");
  const start = nach === null ? 0 : kinder.findIndex((k) => k.id === nach) + 1;
  const seite = kinder.slice(start, start + seitenGroesse);
  const value = seite.map(listenEintrag);
  const letzte = seite[seite.length - 1];
  if (!letzte || start + seitenGroesse >= kinder.length) {
    return antwort({ value });
  }
  adresse.searchParams.set("nach", letzte.id);
  return antwort({ value, "@odata.nextLink": adresse.toString() });
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
    if (abrufGestoert.has(id)) {
      return antwort({ error: { code: "InvalidAuthenticationToken" } }, 401);
    }
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
  abrufGestoert.clear();
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
    losfolge: string;
    nummer: number | null;
    kennungen: string[];
    vollstaendig: boolean;
    fortsetzung: string | null;
    wartend: number;
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
  payload: { folderId?: string; fortsetzung?: string },
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
 * NUR die angebotene Fortsetzung bis zum Ende bedienen — und nach JEDEM Aufruf am Bestand messen,
 * dass ohne Folgeaufruf nichts weiter entstanden ist (der Halt) und kein Aufruf mehr als ein Los
 * eingereiht hat. Ein Abschluss vor dem letzten Aufruf wäre ein Ende ohne nutzbare Fortsetzung.
 */
async function bisZumEnde(
  app: App,
  headers: Headers,
  folderId?: string,
  vorJedemFolgeaufruf?: (schritt: number) => void,
): Promise<Losantwort[]> {
  const antworten: Losantwort[] = [];
  let fortsetzung: string | null | undefined;
  let bisher = (await vorgaenge(app, headers)).length;
  for (let schritt = 0; fortsetzung !== null; schritt++) {
    expect(schritt, "die Losfolge endet").toBeLessThan(200);
    if (schritt > 0) {
      vorJedemFolgeaufruf?.(schritt);
    }
    const ergebnis: Losantwort = await uebernimmLos(app, headers, {
      ...(folderId ? { folderId } : {}),
      ...(fortsetzung ? { fortsetzung } : {}),
    });
    antworten.push(ergebnis);
    const jetzt = (await vorgaenge(app, headers)).length;
    expect(jetzt - bisher, "ein Aufruf reiht höchstens sein eigenes Los ein").toBe(
      ergebnis.imported,
    );
    expect(ergebnis.los.kennungen.length).toBeLessThanOrEqual(SHAREPOINT_LOS_GROESSE);
    expect(
      ergebnis.los.ordnerAbgeschlossen,
      "abgeschlossen heisst: keine Fortsetzung mehr — und umgekehrt",
    ).toBe(ergebnis.los.fortsetzung === null);
    if (ergebnis.los.ordnerAbgeschlossen) {
      expect(ergebnis.los.inventar.vollstaendig, "kein Abschluss vor vollständiger Inventur").toBe(
        true,
      );
    }
    bisher = jetzt;
    fortsetzung = ergebnis.los.fortsetzung;
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
  it("L1 · der erste Aufruf bringt die ersten 50 Dateien — und keine einzige mehr", async () => {
    const { app, headers } = await appMitAdmin();

    const erstes = await uebernimmLos(app, headers, {});
    expect(SHAREPOINT_LOS_GROESSE).toBe(50);
    expect(erstes.los.kennungen, "in der Folge, in der Graph sie geliefert hat").toEqual(
      kennungen(1, 50),
    );
    expect(erstes.los.kennungen, "ein Ordner ist keine Datei").not.toContain("ARCHIV");
    expect(erstes.imported).toBe(50);
    expect(erstes.los.nummer).toBe(1);
    expect(erstes.los.vollstaendig).toBe(true);
    expect(erstes.los.fortsetzung, "die Fortsetzung wird angeboten, nicht gefahren").toBe(
      erstes.los.losfolge,
    );
    expect(erstes.los.inventar.vollstaendig, "nur gelesen, was das Los brauchte").toBe(false);
    expect(erstes.los.ordnerAbgeschlossen).toBe(false);

    // DER HALT, am Bestand gemessen: nach dem ersten Aufruf stehen 50 Vorgänge da, nicht 120.
    genauEinmal(await vorgaenge(app, headers), kennungen(1, 50));

    const lauf = await liesLauf(app, headers, erstes.importId);
    expect(lauf.status).toBe("COMPLETED");
    expect(lauf.sourceScope).toMatch(LOSFOLGE_SCOPE);
    expect(lauf.sourceScope).toContain(`losfolge:${erstes.los.losfolge}/los:1`);
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
    expect(antworten.at(-1)?.los.inventar).toEqual({
      dateien: 120,
      unterordner: 1,
      vollstaendig: true,
    });
    expect(akten.map((a) => a.status)).toEqual(["COMPLETED", "COMPLETED", "COMPLETED"]);
    const losfolge = antworten[0]?.los.losfolge;
    expect(akten.map((a) => a.sourceScope)).toEqual(
      [1, 2, 3].map((n) => expect.stringContaining(`losfolge:${losfolge}/los:${n}`)),
    );
    genauEinmal(await vorgaenge(app, headers), kennungen(1, 120));
  });
});

// ==================================================================================================
// L3 — WIEDERANLAUF.
// ==================================================================================================
describe("R-0145 · L3 — ein Neubeginn nach dem Halt ist gefahrlos", () => {
  it("L3 · eine neue Losfolge ab Anfang reiht nichts doppelt ein; eine beendete ist nicht fortsetzbar", async () => {
    const { app, headers } = await appMitAdmin();
    const erstes = await uebernimmLos(app, headers, {});
    await uebernimmLos(app, headers, { fortsetzung: erstes.los.losfolge });
    expect((await vorgaenge(app, headers)).length).toBe(100);

    const neu = await uebernimmLos(app, headers, {});
    expect(neu.los.losfolge, "eine neue Losfolge").not.toBe(erstes.los.losfolge);
    expect(neu.imported, "dieselben Dateien, derselbe Stand: nichts Neues").toBe(0);
    expect(neu.alreadyQueued).toBe(50);
    expect(neu.los.vollstaendig).toBe(true);
    genauEinmal(await vorgaenge(app, headers), kennungen(1, 100));

    const beendet = await bisZumEnde(app, headers);
    const ende = await holeLos(app, headers, { fortsetzung: beendet.at(-1)?.los.losfolge });
    expect(ende.statusCode, ende.body).toBe(409);
    expect((ende.json() as { error: string }).error).toBe("FORTSETZUNG_UNBEKANNT");
    genauEinmal(await vorgaenge(app, headers), kennungen(1, 120));
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
  it("L6a · eine unbekannte Fortsetzung ist ein 409 und schreibt nichts", async () => {
    const { app, headers } = await appMitAdmin();
    const res = await holeLos(app, headers, {
      fortsetzung: "00000000-0000-4000-8000-000000000000",
    });
    expect(res.statusCode, res.body).toBe(409);
    expect((res.json() as { error: string }).error).toBe("FORTSETZUNG_UNBEKANNT");
    expect(await vorgaenge(app, headers)).toEqual([]);
  });

  it("L6b · eine Fortsetzung, die keine Kennung ist, ist ein 400 und schreibt nichts", async () => {
    const { app, headers } = await appMitAdmin();
    for (const fortsetzung of [1, "", "x".repeat(65)]) {
      const res = await holeLos(app, headers, { fortsetzung });
      expect(res.statusCode, res.body).toBe(400);
      expect((res.json() as { error: string }).error).toBe("FORTSETZUNG_INVALID");
    }
    expect(await vorgaenge(app, headers)).toEqual([]);
  });

  it("L6c · ein wirklich leerer Ordner ist eine Auskunft ohne Lauf", async () => {
    const { app, headers } = await appMitAdmin();
    const leer = await uebernimmLos(app, headers, { folderId: "ARCHIV" });
    expect(leer.los.kennungen).toEqual([]);
    expect(leer.los.inventar).toEqual({ dateien: 0, unterordner: 0, vollstaendig: true });
    expect(leer.los.ordnerAbgeschlossen).toBe(true);
    expect(leer.los.fortsetzung).toBeNull();
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

  it("L6e · eine Fortsetzung mit fremdem Ordner ist ein 400", async () => {
    const { app, headers } = await appMitAdmin();
    const erstes = await uebernimmLos(app, headers, {});
    const res = await holeLos(app, headers, {
      folderId: "ARCHIV",
      fortsetzung: erstes.los.losfolge,
    });
    expect(res.statusCode, res.body).toBe(400);
    expect((res.json() as { error: string }).error).toBe("FORTSETZUNG_ORDNER");
    expect((await vorgaenge(app, headers)).length).toBe(50);
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
    laufwerk.set("root", dateien(kennungen(1, 550)));
    const { app, headers } = await appMitAdmin();

    listenAufrufe.length = 0;
    const antworten = await bisZumEnde(app, headers);
    expect(listenAufrufe.length, "jede der elf Seiten wird genau einmal gelesen").toBe(11);
    expect(antworten).toHaveLength(11);
    expect(antworten.map((a) => a.los.ordnerAbgeschlossen)).toEqual([
      ...Array.from({ length: 10 }, () => false),
      true,
    ]);
    expect(antworten[10]?.los.kennungen, "die Dateien der elften Seite").toEqual(
      kennungen(501, 550),
    );
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
      expect(akte.sourceScope).toMatch(LOSFOLGE_SCOPE);
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

// ==================================================================================================
// L11 — KEINE SEITENKANTE: 1.001 LISTENSEITEN IN EINEM ORDNER.
// ==================================================================================================
describe("R-0190 · L11 — die Inventur geht über 1.000 Listenseiten eines Ordners hinaus", () => {
  it("L11 · 1.001 Seiten zu je einer Datei: alle 1.001 Dateien genau einmal, auch die der letzten Seite", async () => {
    seitenGroesse = 1;
    const alle = Array.from({ length: 1001 }, (_, i) => `SEITE-${String(i + 1).padStart(4, "0")}`);
    laufwerk.set("root", dateien(alle));
    const { app, headers } = await appMitAdmin();

    listenAufrufe.length = 0;
    const antworten = await bisZumEnde(app, headers);
    expect(listenAufrufe.length, "jede der 1.001 Seiten wird genau einmal gelesen").toBe(1001);
    expect(antworten.at(-1)?.los.kennungen, "die Datei der letzten Seite").toContain("SEITE-1001");
    expect(antworten.at(-1)?.los.inventar).toEqual({
      dateien: 1001,
      unterordner: 0,
      vollstaendig: true,
    });
    expect(
      antworten.slice(0, -1).every((a) => !a.los.ordnerAbgeschlossen),
      "vor der letzten Seite meldet kein Aufruf den Abschluss",
    ).toBe(true);
    genauEinmal(await vorgaenge(app, headers), alle);
  }, 120_000);
});

// ==================================================================================================
// L12 — KEINE ORDNERKANTE: 1.001 ORDNER.
// ==================================================================================================
describe("R-0190 · L12 — die Inventur geht über 1.000 Ordner hinaus", () => {
  it("L12 · ein Kundenordner mit 1.000 Unterordnern: die eine Datei im letzten kommt genau einmal an", async () => {
    const unter = Array.from({ length: 1000 }, (_, i) => `U-${String(i + 1).padStart(4, "0")}`);
    laufwerk.set(
      "RIESE",
      unter.map((id) => ({ id, ordner: true as const })),
    );
    for (const id of unter) {
      laufwerk.set(id, []);
    }
    laufwerk.set("U-1000", [{ id: "R-LETZTE" }]);
    const { app, headers } = await appMitAdmin();

    const antworten = await bisZumEnde(app, headers, "RIESE");
    expect(
      antworten.some((a) => a.los.kennungen.length === 0 && a.los.fortsetzung !== null),
      "unterwegs gibt es Aufrufe ohne Datei — sie enden mit nutzbarer Fortsetzung",
    ).toBe(true);
    expect(antworten.at(-1)?.los.inventar).toEqual({
      dateien: 1,
      unterordner: 1000,
      vollstaendig: true,
    });
    const bestand = await vorgaenge(app, headers);
    genauEinmal(bestand, ["R-LETZTE"]);
    expect(bestand, "Ordner werden keine Vorgänge").not.toContain("U-1000");
  }, 120_000);
});

// ==================================================================================================
// L13 — EIN GANZES LOS SCHEITERT: SEINE DATEIEN GEHEN NICHT VERLOREN.
// ==================================================================================================
describe("R-0145 · L13 — nach einem gescheiterten Los kommt dasselbe Los mit der Fortsetzung wieder", () => {
  it("L13 · der Zugang fällt mitten im zweiten Los aus — die Fortsetzung holt es nach, ohne Doppelbestand", async () => {
    const { app, headers } = await appMitAdmin();
    const erstes = await uebernimmLos(app, headers, {});

    abrufGestoert.add(kennung(60));
    const gestoert = await holeLos(app, headers, { fortsetzung: erstes.los.losfolge });
    expect(gestoert.statusCode, gestoert.body).toBe(502);
    expect((gestoert.json() as { fortsetzung?: string }).fortsetzung).toBe(erstes.los.losfolge);
    expect(
      (await vorgaenge(app, headers)).length,
      "was vor dem Ausfall eingereiht war, steht da",
    ).toBe(59);

    abrufGestoert.clear();
    const nachgeholt = await uebernimmLos(app, headers, { fortsetzung: erstes.los.losfolge });
    expect(nachgeholt.los.kennungen, "dasselbe Los, nicht das nächste").toEqual(kennungen(51, 100));
    expect(nachgeholt.imported + nachgeholt.alreadyQueued).toBe(50);
    expect(nachgeholt.los.vollstaendig).toBe(true);

    const rest = await uebernimmLos(app, headers, { fortsetzung: erstes.los.losfolge });
    expect(rest.los.kennungen).toEqual(kennungen(101, 120));
    expect(rest.los.ordnerAbgeschlossen).toBe(true);
    genauEinmal(await vorgaenge(app, headers), kennungen(1, 120));
  });
});

describe("R-0145 · NETZPROBE", () => {
  it("in dieser Datei ging kein Aufruf an eine fremde Adresse", () => {
    expect(fremdeAufrufe).toEqual([]);
    // Und sie ist nicht deshalb leer, weil nichts lief.
    expect(graphAufrufe.length).toBeGreaterThan(1001);
  });
});
