// ================================================================================================
// JOB 4125 · W — DIESELBE DATEI EIN ZWEITES MAL: DER NEUE STAND KOMMT AN, EIN ZWEITER BESTAND NICHT.
// ================================================================================================
//
// DER SATZ, DEN DIESE DATEI MISST: „Wer eine SharePoint-Datei schon einmal importiert hat, kann sie
// gefahrlos noch einmal auswählen. Hat sich an der Quelle nichts geändert, entsteht kein zweiter
// Bestand. Hat sie sich geändert, kommt der neue Stand als VORGANG an — und geprüftes Wissen wird
// dabei nie stillschweigend überschrieben."
//
// WARUM ES DIESE DATEI GIBT. Der Wiederholfall ist im Code ANGELEGT — die Übernahme zählt einen
// idempotenten No-op still unter `bereitsInQueue` (`sharepoint-import-routes.ts:285-287`), und der
// Kopfkommentar der zweiten Tür behauptet das auch (`:225-227`). An DIESER Tür hat es bis hierher
// niemand gemessen: der Bestand von Paket 1 (JOB 4086) ruft die Übernahme in keiner seiner drei
// Dateien zweimal. Eine unbelegte Zusage über Doppelbestände ist genau die Sorte Behauptung, die
// dieses Produkt nicht stehen lässt.
//
// GEMESSEN WIRD AM ZURÜCKGELESENEN BESTAND, nicht an der Antwort des Aufrufs — dieselbe Regel wie
// in `erster-weg-am-draht.test.ts`: `imported: 0` ist die Behauptung des Aufrufs über sich selbst,
// erst `GET /api/library/import/candidates` und `GET /api/kos/:id` sagen, was wirklich dasteht.
//
// ================================================================================================
// DER GRAPH-VERTRAG ALS DOUBLE — MIT EINEM STELLBAREN QUELLSTAND.
// ================================================================================================
//
// `globalThis.fetch` wird für die Dauer dieser Datei durch dasselbe Vertragsdouble ersetzt wie in
// `erster-weg-am-draht.test.ts` (kein zweites Gerüst), nur mit EINEM Unterschied: der Zeitpunkt
// `lastModifiedDateTime` ist stellbar. Genau daraus leitet der Mapper den Quellstand ab
// (`services/sharepoint/src/mapper.ts:64-74`: Sekunden seit 1970, „er wächst genau dann, wenn die
// Datei in SharePoint geändert wurde"). Eine geänderte Quelldatei ist in diesem Vertrag also nichts
// Ausgedachtes, sondern das eine Feld, das sie im echten Graph auch wäre.
//
// KEIN GEFAHRENER GRAPH-LAUF WIRD BEHAUPTET. Was hier läuft, ist der Vertrag, nicht Microsoft 365.
// Pedis Grenze gilt unverändert: „Codeprüfung und simulierte Office-Tests ersetzen keine echte
// Microsoft-365-Abnahme."
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

// Die Schalter stehen hier, VOR dem ersten `buildServices()`: dort wird der quellneutrale
// Import-Strang (`externalImportEnabled`, `build-app.ts:735`) beim BAUEN gelesen, und ohne ihn gibt
// es weder Herkunfts-Anker noch die idempotente Einreihung, um die es hier geht.
process.env.KLARWERK_SHAREPOINT_IMPORT = "1";
process.env.KLARWERK_SHAREPOINT_BASE_URL = "https://graph.microsoft.test/v1.0";
process.env.KLARWERK_SHAREPOINT_TOKEN = "vertragsdouble-nur-fuer-den-test";
process.env.KLARWERK_SHAREPOINT_DRIVE = "b!testbibliothek";

const ADMIN = {
  name: "Admin 4125",
  email: "admin4125@example.com",
  password: "geheim-1234",
};

const DATEI_ID = "01WARTUNG7XYZ";
const DATEI_URL =
  "https://contoso.sharepoint.test/sites/technik/Freigegeben/Wartungsanweisung.docx";

/** Der erste Stand der Quelldatei. */
const STAND_ERST = "2026-09-10T08:30:00Z";
/** Derselbe Weg, den der Mapper geht — hier zur ERWARTUNG, nicht als zweite Umrechnung im Produkt. */
const sekunden = (iso: string): number => Math.floor(Date.parse(iso) / 1000);

/**
 * Der stellbare Zustand der Quelle. `beforeEach` setzt ihn zurück; nur W2 hebt ihn an — und zwar
 * über das EINE Feld, das eine echte Änderung in SharePoint auch anheben würde.
 */
let geaendertAm = STAND_ERST;
/** Die Beschreibung wird zur Kernaussage des Items (Mapper `:99`) — sie zeigt den Inhaltswechsel. */
let beschreibung = "Wartung der Abfüllanlage, Stand September.";

function driveItem() {
  return {
    id: DATEI_ID,
    name: "Wartungsanweisung.docx",
    webUrl: DATEI_URL,
    lastModifiedDateTime: geaendertAm,
    size: 24_576,
    description: beschreibung,
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
      return antwort({ value: [driveItem()] });
    }
    if (url.includes(`/items/${DATEI_ID}`)) {
      return antwort(driveItem());
    }
    return antwort({ error: { code: "itemNotFound" } }, 404);
  }) as unknown as typeof fetch;
});

afterAll(() => {
  (globalThis as unknown as { fetch: unknown }).fetch = echtesFetch;
});

beforeEach(() => {
  geaendertAm = STAND_ERST;
  beschreibung = "Wartung der Abfüllanlage, Stand September.";
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

type App = Awaited<ReturnType<typeof appMitAdmin>>["app"];
type Headers = Record<string, string>;

/** Die Antwort der zweiten Tür, so weit diese Datei sie liest. */
interface Uebernahmeantwort {
  imported: number;
  alreadyQueued: number;
  neuerStand: string[];
  failed: { id: string }[];
  notFound: string[];
  dateien: { id: string; name: string; geaendertAm: string | null }[];
  importId?: string;
}

async function uebernimm(app: App, headers: Headers): Promise<Uebernahmeantwort> {
  const res = await app.inject({
    method: "POST",
    url: "/api/admin/import/sharepoint/apply",
    headers,
    payload: { ids: [DATEI_ID] },
  });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as Uebernahmeantwort;
}

interface KandidatDto {
  id: string;
  status: string;
  duplicate: boolean;
  koId: string | null;
  dublettenbefund?: { ergebnis: string; treffer?: { art: string; koId?: string } };
  item: { title: string; statement: string; externalId?: string; sourceVersion?: number };
}

/** Der ZURÜCKGELESENE Bestand der Prüf-Warteschlange zu genau dieser Quelldatei. */
async function vorgaenge(app: App, headers: Headers): Promise<KandidatDto[]> {
  const res = await app.inject({
    method: "GET",
    url: "/api/library/import/candidates",
    headers,
  });
  expect(res.statusCode, res.body).toBe(200);
  return (res.json() as KandidatDto[]).filter((k) => k.item.externalId === DATEI_ID);
}

async function nimmAn(app: App, headers: Headers, kandidatId: string): Promise<string | null> {
  const res = await app.inject({
    method: "PUT",
    url: `/api/library/import/candidates/${kandidatId}`,
    headers,
    payload: { action: "accept" },
  });
  expect(res.statusCode, res.body).toBe(200);
  return (res.json() as { koId: string | null }).koId;
}

interface KoDto {
  id: string;
  title: string;
  statement: string;
  version: number;
  sources: { provider?: string | null; externalId?: string; sourceVersion?: number }[];
}

async function liesKo(app: App, headers: Headers, koId: string): Promise<KoDto> {
  const res = await app.inject({ method: "GET", url: `/api/kos/${koId}`, headers });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as KoDto;
}

/** Alle Wissensobjekte, die den Herkunfts-Anker DIESER Quelldatei tragen. */
async function objekteMitAnker(app: App, headers: Headers): Promise<KoDto[]> {
  const res = await app.inject({ method: "GET", url: "/api/kos", headers });
  expect(res.statusCode, res.body).toBe(200);
  return (res.json() as KoDto[]).filter((ko) =>
    (ko.sources ?? []).some((q) => q.externalId === DATEI_ID),
  );
}

// ==================================================================================================
// W1 — DIE UNVERÄNDERTE DATEI, ZWEIMAL.
// ==================================================================================================
describe("JOB 4125 · W1 — dieselbe unveränderte Datei ein zweites Mal übernehmen", () => {
  it("W1 · der zweite Aufruf reiht NICHTS ein, und die Warteschlange trägt genau einen Vorgang", async () => {
    const { app, headers } = await appMitAdmin();

    const erst = await uebernimm(app, headers);
    expect(erst.imported, "der erste Aufruf reiht die Datei wirklich ein").toBe(1);
    expect(erst.alreadyQueued).toBe(0);
    expect(erst.neuerStand, "beim ersten Mal gibt es keinen älteren Vorgang").toEqual([]);

    const zweit = await uebernimm(app, headers);
    expect(zweit.imported, "unverändert heisst: NICHTS Neues eingereiht").toBe(0);
    expect(zweit.alreadyQueued, "die Datei steht bereits in derselben Fassung in der Prüfung").toBe(
      1,
    );
    expect(zweit.failed).toEqual([]);
    expect(zweit.notFound).toEqual([]);
    expect(zweit.dateien, "ein nicht eingereihter Vorgang steht NICHT im Ergebnisbild").toEqual([]);
    expect(zweit.neuerStand, "unverändert ist kein neuer Stand").toEqual([]);

    // DER ZURÜCKGELESENE BESTAND — hier entscheidet sich die Zusage, nicht an den Zählern oben.
    const offen = await vorgaenge(app, headers);
    expect(offen, "genau EIN Vorgang zu dieser Quelldatei, kein Doppelbestand").toHaveLength(1);
    expect(offen[0]?.item.sourceVersion).toBe(sekunden(STAND_ERST));
  });

  // ------------------------------------------------------------------------------------------------
  // W1b — DERSELBE AUSGANG AM LAUF: `itemsSkipped`, NICHT `itemsCreated`.
  // ------------------------------------------------------------------------------------------------
  //
  // BEFUND, DER DIESEN FALL SO AUSSEHEN LÄSST (s. RUECKGABE): der LESEWEG der Laufdomäne
  // (`GET /api/admin/import/runs/:importId`, `routes/import-run-routes.ts:117`) ist in der
  // Kompositionswurzel NUR hinter dem Confluence-Schalter registriert
  // (`services/app/src/build-app.ts:2674-2695`). Eine Instanz, die ALLEIN den SharePoint-Import
  // anhat, schreibt also Läufe, die sie selbst nicht lesen kann — die Übernahme gibt eine
  // `importId` heraus, hinter der eine 404 steht. `build-app.ts` liegt ausserhalb der Zielpfade
  // dieses Auftrags (§4); der Befund wird deshalb GEMESSEN und benannt, nicht stillschweigend
  // umgangen. Die Zählung selbst wird an einer Instanz gemessen, in der beide Schalter anstehen —
  // wie in jeder Installation, die auch Confluence angebunden hat.
  it("W1b · der Lauf des zweiten Aufrufs zählt die Kennung als übersprungen — und der Leseweg hängt am Confluence-Schalter", async () => {
    const vorher = process.env.KLARWERK_CONFLUENCE_IMPORT;

    // (a) DER BEFUND: allein mit dem SharePoint-Schalter gibt es den Leseweg nicht.
    process.env.KLARWERK_CONFLUENCE_IMPORT = "0";
    const nurSharePoint = await appMitAdmin();
    const ohneLeseweg = await uebernimm(nurSharePoint.app, nurSharePoint.headers);
    expect(ohneLeseweg.importId, "der Lauf bekommt eine Kennung").toBeTruthy();
    const verwehrt = await nurSharePoint.app.inject({
      method: "GET",
      url: `/api/admin/import/runs/${ohneLeseweg.importId}`,
      headers: nurSharePoint.headers,
    });
    expect(
      verwehrt.statusCode,
      "Ist-Zustand: der Leseweg der Laufdomäne ist hier nicht registriert (Befund, s. RUECKGABE)",
    ).toBe(404);
    await nurSharePoint.app.close();

    // (b) DIE ZÄHLUNG, an einer Instanz mit beiden Schaltern.
    process.env.KLARWERK_CONFLUENCE_IMPORT = "1";
    try {
      const { app, headers } = await appMitAdmin();
      await uebernimm(app, headers);
      const zweit = await uebernimm(app, headers);
      expect(zweit.imported).toBe(0);
      const lauf = await app.inject({
        method: "GET",
        url: `/api/admin/import/runs/${zweit.importId}`,
        headers,
      });
      expect(lauf.statusCode, lauf.body).toBe(200);
      expect(
        (lauf.json() as { counters: Record<string, number> }).counters,
        "die vier Ausgänge bleiben disjunkt: übersprungen ist nicht angelegt",
      ).toEqual({
        itemsTotal: 1,
        itemsCreated: 0,
        itemsBound: 0,
        itemsSkipped: 1,
        itemsFailed: 0,
      });
      await app.close();
    } finally {
      if (vorher === undefined) {
        delete process.env.KLARWERK_CONFLUENCE_IMPORT;
      } else {
        process.env.KLARWERK_CONFLUENCE_IMPORT = vorher;
      }
    }
  });
});

// ==================================================================================================
// W2 — DIE GEÄNDERTE QUELLDATEI.
// ==================================================================================================
//
// Der bequeme Fall wäre, nur W1 zu messen und den Änderungsfall als „geht schon" zu behaupten. Er
// ist deshalb ein eigener Fall mit eigener Gegenprobe: ohne den angehobenen Zeitpunkt im Double
// fällt W2 auf W1 zurück und wird rot.
describe("JOB 4125 · W2 — die Quelldatei hat sich geändert", () => {
  it("W2 · der neue Stand kommt als Vorgang an — und am Ende steht trotzdem EIN Bestand", async () => {
    const { app, headers } = await appMitAdmin();

    const erst = await uebernimm(app, headers);
    expect(erst.imported).toBe(1);
    const vorher = await vorgaenge(app, headers);
    expect(vorher).toHaveLength(1);
    expect(vorher[0]?.item.sourceVersion).toBe(sekunden(STAND_ERST));

    // Die Quelle ändert sich — genau so, wie SharePoint es täte: späterer Zeitpunkt, neuer Inhalt.
    geaendertAm = "2026-09-14T17:05:00Z";
    beschreibung = "Wartung der Abfüllanlage, Stand nach der Revision.";

    const zweit = await uebernimm(app, headers);
    expect(
      zweit.imported,
      "eine geänderte Quelldatei darf NICHT als bereits vorhanden abgetan werden",
    ).toBe(1);
    expect(zweit.alreadyQueued).toBe(0);
    expect(
      zweit.neuerStand,
      "die Antwort sagt AUSDRÜCKLICH, dass hier ein neuerer Stand einer schon wartenden Quelle kam",
    ).toEqual([DATEI_ID]);
    expect(zweit.dateien[0]?.geaendertAm).toBe(geaendertAm);

    // DER ZURÜCKGELESENE VORGANG trägt den späteren Quellstand — nicht nur die Antwort von eben.
    const nachher = await vorgaenge(app, headers);
    const staende = nachher.map((k) => k.item.sourceVersion);
    expect(staende, "der neue Stand steht wirklich in der Warteschlange").toContain(
      sekunden(geaendertAm),
    );
    expect(sekunden(geaendertAm)).toBeGreaterThan(sekunden(STAND_ERST));
    const neuster = nachher.find((k) => k.item.sourceVersion === sekunden(geaendertAm));
    expect(neuster?.item.statement, "und er trägt den NEUEN Inhalt").toBe(beschreibung);

    // KEIN ZWEITER BESTAND: Beide Vorgänge angenommen ergeben GENAU EIN Wissensobjekt zu dieser
    // Quelle — der Herkunfts-Anker führt den zweiten Vorgang in denselben Datensatz (Re-Sync), und
    // am Ende steht der spätere Stand da.
    //
    // DIE REIHENFOLGE IST HIER DIE DER WARTESCHLANGE: ÄLTERER Vorgang zuerst. Sie wird GEMESSEN und
    // nicht angenommen — die umgekehrte Reihenfolge ist ein EIGENER Fall (W2b), weil nur sie den
    // gefährlichen Weg geht (erst der neue Stand im Bestand, dann der alte hinterher).
    expect(
      nachher.map((k) => k.item.sourceVersion),
      "Vorbedingung dieses Falls: der ältere Vorgang steht vorn",
    ).toEqual([sekunden(STAND_ERST), sekunden(geaendertAm)]);
    for (const vorgang of nachher) {
      await nimmAn(app, headers, vorgang.id);
    }
    const objekte = await objekteMitAnker(app, headers);
    expect(
      objekte,
      "zwei Vorgänge derselben Quelle sind EIN Wissensobjekt, keine zwei",
    ).toHaveLength(1);
    const anker = objekte[0]?.sources.find((q) => q.externalId === DATEI_ID);
    expect(anker?.sourceVersion, "und der Bestand trägt den SPÄTEREN Quellstand").toBe(
      sekunden(geaendertAm),
    );
    expect(objekte[0]?.statement).toBe(beschreibung);
  });

  // ------------------------------------------------------------------------------------------------
  // W2b — DIE UMGEKEHRTE ANNAHMEREIHENFOLGE. DER GEFÄHRLICHE WEG.
  // ------------------------------------------------------------------------------------------------
  //
  // Codex hat die Behauptung „in beiden Annahmereihenfolgen" in Runde 1 zu Recht zurückgewiesen: W2
  // fährt nur EINE (ältester Vorgang zuerst), und das ist die harmlose. Die gefährliche ist diese:
  // der Mensch nimmt den NEUEN Stand zuerst an — der Bestand steht auf der späteren Fassung — und
  // greift danach den alten Vorgang auf, der noch in der Liste steht. Ein Re-Sync, der hier
  // schriebe, wäre ein DOWNGRADE geprüften Wissens durch einen veralteten Import.
  //
  // Der Kern hält dagegen (`service.test.ts`, „Re-Sync mit gleicher/niedrigerer Version → No-op");
  // dieser Fall misst es am echten Weg über beide Türen.
  it("W2b · erst den NEUEN Stand annehmen, dann den alten Vorgang: kein Downgrade, weiterhin EIN Bestand", async () => {
    const { app, headers } = await appMitAdmin();

    await uebernimm(app, headers);
    geaendertAm = "2026-09-14T17:05:00Z";
    beschreibung = "Wartung der Abfüllanlage, Stand nach der Revision.";
    await uebernimm(app, headers);

    const offen = await vorgaenge(app, headers);
    const neuster = offen.find((k) => k.item.sourceVersion === sekunden(geaendertAm));
    const aelterer = offen.find((k) => k.item.sourceVersion === sekunden(STAND_ERST));
    if (!neuster || !aelterer) {
      throw new Error("Vorbedingung verletzt: es stehen nicht beide Stände in der Warteschlange.");
    }

    // (1) DER NEUE STAND ZUERST.
    const koId = await nimmAn(app, headers, neuster.id);
    expect(koId, "die Annahme erzeugt das Wissensobjekt").toBeTruthy();
    const nachNeu = await liesKo(app, headers, koId as string);
    expect(nachNeu.statement, "der Bestand steht auf der späteren Fassung").toBe(beschreibung);

    // (2) UND DANACH DER ALTE VORGANG, der noch in der Liste steht.
    expect(await nimmAn(app, headers, aelterer.id), "derselbe Datensatz, kein zweiter").toBe(koId);
    const amEnde = await liesKo(app, headers, koId as string);
    expect(amEnde.statement, "ein veralteter Import darf geprüftes Wissen nicht zurückdrehen").toBe(
      beschreibung,
    );
    expect(amEnde.version, "und er löst auch keine Revision aus").toBe(nachNeu.version);
    const objekte = await objekteMitAnker(app, headers);
    expect(objekte, "auch in dieser Reihenfolge: EIN Wissensobjekt").toHaveLength(1);
    expect(
      objekte[0]?.sources.find((q) => q.externalId === DATEI_ID)?.sourceVersion,
      "und der Anker trägt weiterhin den SPÄTEREN Quellstand",
    ).toBe(sekunden(geaendertAm));
  });

  // ------------------------------------------------------------------------------------------------
  // W2-REST — DER IST-ZUSTAND, DEN DIESER AUFTRAG NICHT ABLÖSEN DARF (BEFUND, s. RUECKGABE).
  // ------------------------------------------------------------------------------------------------
  //
  // Solange der ÄLTERE Vorgang noch offen in der Prüfung steht, reiht der Import-Kern den neueren
  // Stand DANEBEN ein: der offene Idempotenzraum ist (provider, externalId, sourceVersion)
  // — die Version gehört zum Schlüssel (`services/library-analytics/src/repo.ts:222-251`,
  // `openCandidateSource`/`sameOpenCandidateSource`, deckungsgleich mit dem partiellen UNIQUE-Index
  // `repo-pg.ts:153-155`). Ein neuerer Stand verdrängt den älteren dort NICHT.
  //
  // Für den BESTAND ist das folgenlos, und zwar in BEIDEN Annahmereihenfolgen — W2 misst die der
  // Warteschlange (ältester zuerst), W2b die umgekehrte (neuer Stand zuerst, alter Vorgang
  // hinterher). Für den PRÜFENDEN MENSCHEN ist es eine zweite Zeile zu derselben Datei —
  // und weil dieser Auftrag den Kern ausdrücklich nicht anfassen darf (§4, §10), sagt die Fläche es
  // ihm, statt es zu verstecken (`neuerStand`, s. W2). Dieser Fall hält den Ist-Zustand fest: wird
  // er im Kern abgelöst, wird er rot und ist hier UMZUDREHEN, nicht zu löschen.
  it("W2-REST · der ältere offene Vorgang bleibt stehen (Ist-Zustand des Kerns, benannt statt verschwiegen)", async () => {
    const { app, headers } = await appMitAdmin();
    await uebernimm(app, headers);
    geaendertAm = "2026-09-14T17:05:00Z";
    await uebernimm(app, headers);

    const offen = await vorgaenge(app, headers);
    expect(
      offen.map((k) => k.item.sourceVersion).sort((a, b) => (a ?? 0) - (b ?? 0)),
      "Ist-Zustand: alter und neuer Stand stehen beide offen in der Prüfung",
    ).toEqual([sekunden(STAND_ERST), sekunden(geaendertAm)]);
  });
});

// ==================================================================================================
// W3 — DIE BEREITS ANGENOMMENE QUELLE: GEPRÜFTES WISSEN WIRD NIE STILLSCHWEIGEND ÜBERSCHRIEBEN.
// ==================================================================================================
//
// Die REVIEW-INVARIANTE (`sharepoint-import-routes.ts:36-38`) sagt: „es entsteht ein KANDIDAT, nie
// ein Wissensobjekt. Erst ein Mensch nimmt an." Der gefährliche Fall dafür ist nicht der leere
// Bestand, sondern der GEPRÜFTE: eine Quelle, die schon einmal angenommen wurde. Ein Import, der
// sie still in das bestehende Objekt schriebe, änderte geprüftes Wissen ohne Entscheidung.
describe("JOB 4125 · W3 — Wiederholimport an einer bereits angenommenen Quelle", () => {
  it("W3 · der zweite Import ändert das angenommene Objekt NICHT, er legt einen Vorgang an", async () => {
    const { app, headers } = await appMitAdmin();

    await uebernimm(app, headers);
    const [erster] = await vorgaenge(app, headers);
    if (!erster) {
      throw new Error("Vorbedingung verletzt: kein erster Vorgang in der Warteschlange.");
    }
    const koId = await nimmAn(app, headers, erster.id);
    expect(koId, "die Annahme durch den Menschen erzeugt das Wissensobjekt").toBeTruthy();
    const vorher = await liesKo(app, headers, koId as string);
    expect(vorher.version).toBe(1);

    // Derselbe Import ein zweites Mal — die Quelle ist unverändert, das Objekt ist angenommen.
    const zweit = await uebernimm(app, headers);

    const nachher = await liesKo(app, headers, koId as string);
    expect(nachher.version, "das angenommene Objekt wurde NICHT revidiert").toBe(vorher.version);
    expect(nachher.statement, "und sein Inhalt ist unverändert").toBe(vorher.statement);
    expect(
      (await objekteMitAnker(app, headers)).length,
      "und es ist kein zweites Objekt zu derselben Quelle entstanden",
    ).toBe(1);

    // Was WIRKLICH entstanden ist: ein Vorgang, über den ein Mensch entscheidet — und er sagt am
    // Kandidaten, in welches bestehende Objekt er zurückflösse (`wiederverwendet`, service.ts:620).
    expect(zweit.imported + zweit.alreadyQueued, "die Kennung hat genau EINEN Ausgang").toBe(1);
    const offen = (await vorgaenge(app, headers)).filter((k) => k.status === "neu");
    expect(offen, "der Wiederholimport endet in der Prüfung, nicht im Bestand").toHaveLength(
      zweit.imported,
    );
    if (offen.length === 1) {
      expect(offen[0]?.dublettenbefund?.treffer).toEqual({ art: "wissensobjekt", koId });
    }

    // Und auch die ANNAHME dieses zweiten Vorgangs überschreibt nichts: gleicher Stand heisst
    // No-op (`service.test.ts`, „Re-Sync mit gleicher/niedrigerer Version → No-op").
    for (const vorgang of offen) {
      expect(await nimmAn(app, headers, vorgang.id)).toBe(koId);
    }
    const amEnde = await liesKo(app, headers, koId as string);
    expect(amEnde.version, "kein Revisionslauf ohne neuen Quellstand").toBe(vorher.version);
    expect(amEnde.statement).toBe(vorher.statement);
    expect(await objekteMitAnker(app, headers)).toHaveLength(1);
  });

  // ------------------------------------------------------------------------------------------------
  // W3b — DIE GEÄNDERTE QUELLE AN EINEM BEREITS ANGENOMMENEN OBJEKT (Codex' Prüflücke 6, Runde 1).
  // ------------------------------------------------------------------------------------------------
  //
  // W3 misst den unveränderten Fall — dort ändert sich erwartungsgemäß nichts, und genau deshalb
  // beweist er die REVIEW-INVARIANTE nur halb: ein Import, der gar nichts zu schreiben HAT, kann
  // auch nichts stillschweigend überschreiben. Der harte Fall ist der ÄNDERUNGSFALL an geprüftem
  // Wissen, und er hat zwei Hälften, die beide gelten müssen:
  //
  //   VOR der menschlichen Entscheidung → das angenommene Objekt bleibt Zeichen für Zeichen, wie es
  //                                       war. Der Import legt einen VORGANG an, sonst nichts.
  //   NACH der Annahme                  → das Objekt wird gezielt aktualisiert (Re-Sync auf den
  //                                       höheren Quellstand), und es entsteht kein zweites.
  it("W3b · geänderte Quelle an angenommenem Wissen: vorher unverändert, erst die Annahme aktualisiert", async () => {
    const { app, headers } = await appMitAdmin();

    await uebernimm(app, headers);
    const [erster] = await vorgaenge(app, headers);
    if (!erster) {
      throw new Error("Vorbedingung verletzt: kein erster Vorgang in der Warteschlange.");
    }
    const koId = await nimmAn(app, headers, erster.id);
    const vorher = await liesKo(app, headers, koId as string);
    expect(vorher.version).toBe(1);

    // Die Quelle ändert sich WIRKLICH — späterer Zeitpunkt, anderer Inhalt.
    geaendertAm = "2026-09-14T17:05:00Z";
    beschreibung = "Wartung der Abfüllanlage, Stand nach der Revision.";
    const zweit = await uebernimm(app, headers);
    expect(zweit.imported, "der neue Stand wird eingereiht").toBe(1);

    // (1) VOR DER ENTSCHEIDUNG: das geprüfte Objekt ist unangetastet.
    const zwischen = await liesKo(app, headers, koId as string);
    expect(zwischen.version, "kein stiller Schreibzugriff auf geprüftes Wissen").toBe(
      vorher.version,
    );
    expect(zwischen.statement, "und kein stiller Inhaltswechsel").toBe(vorher.statement);
    const offen = (await vorgaenge(app, headers)).filter((k) => k.status === "neu");
    expect(offen, "was entstanden ist, ist ein Vorgang").toHaveLength(1);
    expect(offen[0]?.item.sourceVersion).toBe(sekunden(geaendertAm));

    // (2) ERST DIE ANNAHME DURCH DEN MENSCHEN aktualisiert — gezielt, in dasselbe Objekt.
    expect(await nimmAn(app, headers, offen[0]?.id as string)).toBe(koId);
    const danach = await liesKo(app, headers, koId as string);
    expect(danach.statement, "jetzt trägt das Objekt den neuen Stand").toBe(beschreibung);
    expect(danach.version, "und es ist eine echte Revision, kein stiller Überschreiber").toBe(
      vorher.version + 1,
    );
    const objekte = await objekteMitAnker(app, headers);
    expect(objekte, "und es ist kein zweites Objekt entstanden").toHaveLength(1);
    expect(objekte[0]?.sources.find((q) => q.externalId === DATEI_ID)?.sourceVersion).toBe(
      sekunden(geaendertAm),
    );
  });
});

describe("JOB 4125 · W — die Abriegelung", () => {
  it("NETZPROBE: in dieser Datei ging kein einziger Aufruf an eine fremde Adresse", () => {
    expect(fremdeAufrufe).toEqual([]);
    // Und sie ist nicht deshalb leer, weil gar nichts lief.
    expect(graphAufrufe.length).toBeGreaterThanOrEqual(6);
    expect(graphAufrufe.every((u) => u.startsWith("https://graph.microsoft.test/"))).toBe(true);
  });
});
