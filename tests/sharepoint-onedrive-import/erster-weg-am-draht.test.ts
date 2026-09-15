// ================================================================================================
// JOB 4086 · S1 — DER ERSTE WEG VON SHAREPOINT NACH KLARWERK, AM ECHTEN DRAHT.
// ================================================================================================
//
// DER SATZ, DEN DIESER FALL MISST: „Ein Administrator wählt aus der SharePoint-Bibliothek die
// berechtigte Datei `Wartungsanweisung.docx` aus, ruft sie ab und importiert sie; danach trägt das
// ZURÜCKGELESENE Wissensobjekt ihre Kennung, ihre Originaladresse und ihren Quellstand."
//
// GEMESSEN WIRD AM ZURÜCKGELESENEN OBJEKT, nicht an der Antwort des Importaufrufs. Eine Antwort,
// die „importiert: 1" sagt, ist die Behauptung des Aufrufs über sich selbst; erst `GET /api/kos/:id`
// sagt, was im Bestand steht. Genau diese Unterscheidung ist der Grund, warum der Fall über die
// Prüf-Warteschlange und die echte Annahme geht statt über einen Direktaufruf.
//
// ================================================================================================
// DER GRAPH-VERTRAG ALS DOUBLE — UND DIE NETZPROBE IN EINEM.
// ================================================================================================
//
// `globalThis.fetch` wird für die Dauer dieser Datei durch ein Vertragsdouble ersetzt, das NUR die
// gepinnte Graph-Origin bedient. Jede andere Adresse lässt es werfen und schreibt sie in
// `fremdeAufrufe` — der Fall prüft am Ende ausdrücklich, dass diese Liste leer ist. Es geht in
// dieser Datei also nicht nur „kein echter Netzaufruf hinaus"; ein Versuch WÜRDE auffallen.
//
// KEIN GEFAHRENER GRAPH-LAUF WIRD BEHAUPTET. Was hier läuft, ist der Vertrag, nicht Microsoft 365.
// Pedis Grenze gilt unverändert: „Codeprüfung und simulierte Office-Tests ersetzen keine echte
// Microsoft-365-Abnahme."
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

// Die Schalter stehen hier, VOR dem ersten `buildServices()`: dort wird der quellneutrale
// Import-Strang (`externalImportEnabled`) beim BAUEN gelesen, und ohne ihn schreibt der Import-Kern
// gar keinen Herkunfts-Anker. Dasselbe Muster wie `tests/app/confluence-import-rechtetor.test.ts`.
process.env.KLARWERK_SHAREPOINT_IMPORT = "1";
process.env.KLARWERK_SHAREPOINT_BASE_URL = "https://graph.microsoft.test/v1.0";
process.env.KLARWERK_SHAREPOINT_TOKEN = "vertragsdouble-nur-fuer-den-test";
process.env.KLARWERK_SHAREPOINT_DRIVE = "b!testbibliothek";

const ADMIN = {
  name: "Admin 4086",
  email: "admin4086@example.com",
  password: "geheim-1234",
};

/** Der Quellstand der Datei: `lastModifiedDateTime` in Sekunden seit 1970 (s. mapper.ts). */
const GEAENDERT_AM = "2026-09-10T08:30:00Z";
const QUELLSTAND = Math.floor(Date.parse(GEAENDERT_AM) / 1000);
const DATEI_ID = "01WARTUNG7XYZ";
const DATEI_URL =
  "https://contoso.sharepoint.test/sites/technik/Freigegeben/Wartungsanweisung.docx";

/** Ein DriveItem, wie Microsoft Graph es im `children`/`items`-Vertrag ausliefert. */
const WARTUNGSANWEISUNG = {
  id: DATEI_ID,
  name: "Wartungsanweisung.docx",
  webUrl: DATEI_URL,
  lastModifiedDateTime: GEAENDERT_AM,
  size: 24_576,
  description: "Wartung der Abfüllanlage, Stand September.",
  file: { mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  lastModifiedBy: { user: { displayName: "R. Schuster" } },
};

/** Ein Ordner in derselben Bibliothek — er darf NICHT als importierbare Datei erscheinen. */
const ORDNER = {
  id: "01ORDNERABC",
  name: "Archiv",
  webUrl: "https://contoso.sharepoint.test/sites/technik/Freigegeben/Archiv",
  lastModifiedDateTime: "2026-08-01T10:00:00Z",
  folder: { childCount: 3 },
};

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
      return antwort({ value: [WARTUNGSANWEISUNG, ORDNER] });
    }
    if (url.includes(`/items/${DATEI_ID}`)) {
      return antwort(WARTUNGSANWEISUNG);
    }
    return antwort({ error: { code: "itemNotFound" } }, 404);
  }) as unknown as typeof fetch;
});

afterAll(() => {
  (globalThis as unknown as { fetch: unknown }).fetch = echtesFetch;
});

async function appMitAdmin() {
  const app = buildApp(buildServices());
  await app.inject({ method: "POST", url: "/api/auth/register", payload: ADMIN });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: ADMIN.email, password: ADMIN.password },
  });
  const token = (login.json() as { token?: string }).token ?? "";
  expect(token, "der Bootstrap-Admin muss ein Token bekommen").not.toBe("");
  return { app, headers: { authorization: `Bearer ${token}` } };
}

describe("JOB 4086 · S1 — SharePoint-Datei wählen, abrufen, importieren", () => {
  it("der ganze Weg: Liste → Übernahme → Prüfung → das zurückgelesene Objekt trägt seine Herkunft", async () => {
    const { app, headers } = await appMitAdmin();

    // --- Schritt 1: die berechtigte Dateiliste der Bibliothek -------------------------------
    const liste = await app.inject({
      method: "POST",
      url: "/api/admin/import/sharepoint/files",
      headers,
      payload: {},
    });
    expect(liste.statusCode, liste.body).toBe(200);
    const listenkoerper = liste.json() as {
      dateien: { id: string; name: string; url: string | null; geaendertAm: string | null }[];
      truncated: boolean;
    };
    // Der ORDNER steht nicht darin: diese Liste ist die Auswahl eines Imports, und was man nicht
    // wählen kann, gehört nicht hinein.
    expect(listenkoerper.dateien.map((d) => d.name)).toEqual(["Wartungsanweisung.docx"]);
    const gewaehlt = listenkoerper.dateien[0];
    expect(gewaehlt?.id).toBe(DATEI_ID);
    expect(gewaehlt?.url).toBe(DATEI_URL);
    expect(listenkoerper.truncated).toBe(false);

    // --- Schritt 2: die gewählte Datei abrufen und übernehmen -------------------------------
    const uebernahme = await app.inject({
      method: "POST",
      url: "/api/admin/import/sharepoint/apply",
      headers,
      payload: { ids: [DATEI_ID] },
    });
    expect(uebernahme.statusCode, uebernahme.body).toBe(200);
    const bilanz = uebernahme.json() as {
      imported: number;
      alreadyQueued: number;
      failed: { id: string }[];
      notFound: string[];
      dateien: { id: string; name: string; url: string | null; geaendertAm: string | null }[];
    };
    expect(bilanz.imported).toBe(1);
    expect(bilanz.failed).toEqual([]);
    expect(bilanz.notFound).toEqual([]);
    // Das Ergebnisbild bekommt Name, Originaladresse und Stand — genau die drei Angaben, die der
    // Mensch nach dem Import lesen soll.
    expect(bilanz.dateien).toEqual([
      {
        id: DATEI_ID,
        name: "Wartungsanweisung.docx",
        url: DATEI_URL,
        geaendertAm: GEAENDERT_AM,
      },
    ]);

    // --- Schritt 3: der Kandidat in der Prüf-Warteschlange ----------------------------------
    const warteschlange = await app.inject({
      method: "GET",
      url: "/api/library/import/candidates",
      headers,
    });
    expect(warteschlange.statusCode, warteschlange.body).toBe(200);
    const kandidaten = warteschlange.json() as {
      id: string;
      item: { title: string; provider?: string; externalId?: string };
    }[];
    const kandidat = kandidaten.find((k) => k.item.externalId === DATEI_ID);
    expect(
      kandidat,
      "die übernommene Datei muss als Kandidat in der Warteschlange stehen",
    ).toBeDefined();
    expect(kandidat?.item.provider).toBe("SharePoint");

    // --- Schritt 4: die Annahme durch den Menschen (REVIEW-INVARIANTE) ----------------------
    const angenommen = await app.inject({
      method: "PUT",
      url: `/api/library/import/candidates/${kandidat?.id}`,
      headers,
      payload: { action: "accept" },
    });
    expect(angenommen.statusCode, angenommen.body).toBe(200);
    const koId = (angenommen.json() as { koId?: string }).koId;
    expect(koId, "die Annahme muss ein Wissensobjekt erzeugen").toBeTruthy();

    // --- Schritt 5: ZURÜCKGELESEN — trägt das Objekt seine Herkunft? ------------------------
    const gelesen = await app.inject({ method: "GET", url: `/api/kos/${koId}`, headers });
    expect(gelesen.statusCode, gelesen.body).toBe(200);
    const ko = gelesen.json() as {
      title: string;
      sources: {
        provider?: string | null;
        externalId?: string;
        url?: string | null;
        sourceVersion?: number;
        spaceKey?: string;
      }[];
    };
    expect(ko.title).toBe("Wartungsanweisung.docx");
    const anker = ko.sources.find((s) => s.externalId === DATEI_ID);
    expect(
      anker,
      "das zurückgelesene Objekt muss den Herkunfts-Anker der Quelldatei tragen",
    ).toBeDefined();
    expect(anker?.provider).toBe("SharePoint");
    expect(anker?.url).toBe(DATEI_URL);
    expect(anker?.sourceVersion).toBe(QUELLSTAND);
    expect(anker?.spaceKey).toBe("b!testbibliothek");

    await app.close();
  });

  it("NETZPROBE: in dieser Datei ging kein einziger Aufruf an eine fremde Adresse", () => {
    expect(fremdeAufrufe).toEqual([]);
    // Und die Abriegelung ist nicht deshalb leer, weil gar nichts lief: der Graph-Vertrag wurde
    // wirklich angesprochen (Liste und Einzelabruf).
    expect(graphAufrufe.length).toBeGreaterThanOrEqual(2);
    expect(graphAufrufe.every((u) => u.startsWith("https://graph.microsoft.test/"))).toBe(true);
  });
});
