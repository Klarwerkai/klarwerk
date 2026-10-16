// ================================================================================================
// BPA-05-AC09 · DIE GEÄNDERTE FREIGEGEBENE DATEI WIRD OHNE GEÖFFNETES FENSTER ERKANNT.
// ================================================================================================
//
// Originalkriterium (produkt:20261011:assistenz-aktive-beobachtung, K9): „Langfristige Änderungen
// einer freigegebenen Datei werden über den Quellenänderungsdienst erkannt, auch ohne geöffnetes
// Fenster; Live-Begleitung ersetzt diesen Dienst nicht."
//
// Bens Befund (Nacharbeit 13): Probe 83 belegte nur den BEWUSSTEN Wiederholimport. Hier läuft
// nach der ersten Übernahme KEINE Anfrage eines Menschen mehr — kein Fenster, keine Fläche, kein
// Klick. Allein der Zeitgeber des bestehenden SharePoint-Dienstes
// (`KLARWERK_SHAREPOINT_QUELLENPRUEFUNG_MS`, `pruefeQuellenaenderungen`) prüft die freigegebenen
// Dateien erneut. Gelesen wird danach der ZURÜCKGELESENE Bestand der Prüf-Warteschlange.
//
// DAS GERÜST ist das von `wiederholimport-am-draht.test.ts` (W2): echte App, echter Adapter,
// echter Übernahmeweg; nur `fetch` ist das Graph-Vertragsdouble mit stellbarem
// `lastModifiedDateTime`. Gestellt ist allein die ZEIT: `setInterval` läuft über Vitests
// Zeitsteuerung, damit niemand eine Minute warten muss. KEIN Microsoft-365-Lauf wird behauptet.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

process.env.KLARWERK_SHAREPOINT_IMPORT = "1";
process.env.KLARWERK_SHAREPOINT_BASE_URL = "https://graph.microsoft.test/v1.0";
process.env.KLARWERK_SHAREPOINT_TOKEN = "vertragsdouble-nur-fuer-den-test";
process.env.KLARWERK_SHAREPOINT_DRIVE = "b!testbibliothek";

const SCHALTER = "KLARWERK_SHAREPOINT_QUELLENPRUEFUNG_MS";
const ABSTAND = 60_000;

const ADMIN = { name: "Admin AC09", email: "admin-ac09@example.com", password: "geheim-1234" };
const DATEI_ID = "01FREIGEGEBEN09";
const STAND_ERST = "2026-10-01T08:00:00Z";
const STAND_NEU = "2026-10-12T16:30:00Z";
const quellstand = (iso: string): number =>
  Math.max(1, Math.floor((Date.parse(iso) - Date.UTC(2025, 0, 1)) / 1000));

let geaendertAm = STAND_ERST;
let beschreibung = "Prüfanweisung Netzteil, Stand Oktober.";
const graphAufrufe: string[] = [];
const echtesFetch = globalThis.fetch;

function driveItem() {
  return {
    id: DATEI_ID,
    name: "Pruefanweisung-Netzteil.docx",
    webUrl: "https://contoso.sharepoint.test/sites/technik/Freigegeben/Pruefanweisung.docx",
    lastModifiedDateTime: geaendertAm,
    size: 20_480,
    description: beschreibung,
    file: { mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
    lastModifiedBy: { user: { displayName: "Synthetische Testperson" } },
  };
}

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
      throw new Error(`Unerlaubter Aufruf im Test: ${url}`);
    }
    graphAufrufe.push(url);
    if (url.includes(`/items/${DATEI_ID}`)) {
      return antwort(driveItem());
    }
    return antwort({ error: { code: "itemNotFound" } }, 404);
  }) as unknown as typeof fetch;
});

afterAll(() => {
  (globalThis as unknown as { fetch: unknown }).fetch = echtesFetch;
  delete process.env[SCHALTER];
});

beforeEach(() => {
  geaendertAm = STAND_ERST;
  beschreibung = "Prüfanweisung Netzteil, Stand Oktober.";
  graphAufrufe.length = 0;
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
});

afterEach(() => {
  vi.useRealTimers();
});

async function appMitAdmin(schalter: string | undefined) {
  if (schalter === undefined) {
    delete process.env[SCHALTER];
  } else {
    process.env[SCHALTER] = schalter;
  }
  const app = buildApp(buildServices());
  await app.inject({ method: "POST", url: "/api/auth/register", payload: ADMIN });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: ADMIN.email, password: ADMIN.password },
  });
  const token = (login.json() as { token?: string }).token ?? "";
  expect(token).not.toBe("");
  return { app, headers: { authorization: `Bearer ${token}` } };
}

type App = Awaited<ReturnType<typeof appMitAdmin>>["app"];

interface KandidatDto {
  id: string;
  status: string;
  koId: string | null;
  item: { statement: string; externalId?: string; sourceVersion?: number };
}

async function vorgaenge(app: App, headers: Record<string, string>): Promise<KandidatDto[]> {
  const res = await app.inject({ method: "GET", url: "/api/library/import/candidates", headers });
  expect(res.statusCode, res.body).toBe(200);
  return (res.json() as KandidatDto[]).filter((k) => k.item.externalId === DATEI_ID);
}

/** Die einmalige, bewusste Freigabe der Datei — danach fragt kein Mensch mehr. */
async function uebernimmEinmal(app: App, headers: Record<string, string>): Promise<void> {
  const res = await app.inject({
    method: "POST",
    url: "/api/admin/import/sharepoint/apply",
    headers,
    payload: { ids: [DATEI_ID] },
  });
  expect(res.statusCode, res.body).toBe(200);
}

/** Die Zeit vergeht — und die laufende Prüfung bekommt Gelegenheit, ihre Abrufe abzuschließen. */
async function zeitVergeht(ms: number): Promise<void> {
  vi.advanceTimersByTime(ms);
  for (let i = 0; i < 200; i += 1) {
    await new Promise((fertig) => setImmediate(fertig));
  }
}

describe("K9 · Quellenänderungsprüfung des bestehenden SharePoint-Dienstes, ohne Fenster", () => {
  it("eine geänderte freigegebene Datei kommt allein durch den Dienst als neuer Vorgang an", async () => {
    const { app, headers } = await appMitAdmin(String(ABSTAND));
    await uebernimmEinmal(app, headers);
    expect(await vorgaenge(app, headers)).toHaveLength(1);

    // Die Datei ändert sich an der Quelle. Ab hier: keine Anfrage eines Menschen.
    geaendertAm = STAND_NEU;
    beschreibung = "Prüfanweisung Netzteil, Stand nach der Revision.";
    const abrufeVorher = graphAufrufe.length;
    await zeitVergeht(ABSTAND);
    // Der Dienst hat die Quelle selbst erneut abgefragt.
    expect(graphAufrufe.length).toBeGreaterThan(abrufeVorher);

    // Rücklesen: der neue Stand steht als Vorgang in der Prüfung — mit dem neuen Inhalt.
    const nachher = await vorgaenge(app, headers);
    expect(nachher.map((k) => k.item.sourceVersion)).toEqual([
      quellstand(STAND_ERST),
      quellstand(STAND_NEU),
    ]);
    expect(nachher[1]?.item.statement).toBe(beschreibung);
    // Kein Modell, keine stille Übernahme: der neue Stand WARTET auf einen Menschen.
    expect(nachher[1]?.koId).toBeNull();
    await app.close();
  });

  it("auch nach Annahme ins Wissen: eine spätere Änderung wird erkannt — eine unveränderte nicht", async () => {
    const { app, headers } = await appMitAdmin(String(ABSTAND));
    await uebernimmEinmal(app, headers);
    const [erst] = await vorgaenge(app, headers);
    const annahme = await app.inject({
      method: "PUT",
      url: `/api/library/import/candidates/${erst?.id}`,
      headers,
      payload: { action: "accept" },
    });
    expect(annahme.statusCode, annahme.body).toBe(200);

    // Unverändert: die Prüfung läuft (Abruf an der Quelle), reiht aber NICHTS ein.
    const abrufe = graphAufrufe.length;
    await zeitVergeht(ABSTAND);
    expect(graphAufrufe.length).toBeGreaterThan(abrufe);
    expect(await vorgaenge(app, headers)).toHaveLength(1);

    // Geändert: der neue Stand kommt als Vorgang an.
    geaendertAm = STAND_NEU;
    await zeitVergeht(ABSTAND);
    const nachher = await vorgaenge(app, headers);
    expect(nachher).toHaveLength(2);
    expect(nachher.map((k) => k.item.sourceVersion)).toContain(quellstand(STAND_NEU));
    await app.close();
  });

  it("ohne Betreiberschalter gibt es keine Hintergrundprüfung", async () => {
    const { app, headers } = await appMitAdmin(undefined);
    await uebernimmEinmal(app, headers);
    geaendertAm = STAND_NEU;
    const abrufe = graphAufrufe.length;
    await zeitVergeht(10 * ABSTAND);
    expect(graphAufrufe.length).toBe(abrufe);
    expect(await vorgaenge(app, headers)).toHaveLength(1);
    await app.close();
  });

  it("ein zu kleiner oder unlesbarer Abstand schaltet die Prüfung nicht ein (fail-closed)", async () => {
    for (const wert of ["1000", "abc"]) {
      const { app, headers } = await appMitAdmin(wert);
      await uebernimmEinmal(app, headers);
      geaendertAm = STAND_NEU;
      const abrufe = graphAufrufe.length;
      await zeitVergeht(10 * ABSTAND);
      expect(graphAufrufe.length, `Abstand „${wert}“`).toBe(abrufe);
      await app.close();
      geaendertAm = STAND_ERST;
    }
  });
});
