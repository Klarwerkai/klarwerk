// ================================================================================================
// JOB 4232 · W — DER GANZE WEG AM ECHTEN DRAHT: VORSCHAU → ANNAHME → LESEN → NEUSTART → WIEDERHOLUNG.
// ================================================================================================
//
// DER SATZ, DEN DIESE DATEI MISST: „Ein Administrator sieht VOR der Annahme, dass seine Textdatei
// Inhalt bringt; nach der Annahme liest er IHREN TEXT am zurückgelesenen Wissensobjekt; nach einem
// APPNEUSTART steht er unverändert dort samt Herkunft und Stand; und derselbe Import ein zweites Mal
// legt keinen zweiten Eintrag an."
//
// ================================================================================================
// GEMESSEN WIRD AM ZURÜCKGELESENEN OBJEKT, NICHT AN DER ANTWORT DES IMPORTAUFRUFS.
// ================================================================================================
//
// Eine Antwort, die „importiert: 1" sagt, ist die Behauptung des Aufrufs über sich selbst; erst
// `GET /api/kos/:id` sagt, was im Bestand steht. Deshalb geht dieser Fall über die
// Prüf-Warteschlange und die echte menschliche Annahme — und nicht über einen Direktaufruf.
//
// ================================================================================================
// DER NEUSTART IST ECHT UND KEINE ATTRAPPE — UND ER BESTELLT KEINE NEUE MASCHINE.
// ================================================================================================
//
// Gebaut wird über die VORHANDENE Dev-Persistenz (`buildDevPersistServices`, SCRUM-387): jede
// Mutation geht in ein Journal, und eine zweite Komposition aus DERSELBEN Journaldatei ist genau
// das, was beim Start der Anwendung passiert — Replay über die öffentlichen Repo-Schnittstellen.
// Zwei Apps hintereinander aus einer Datei sind damit ein echter Neustart und keine Simulation, und
// es braucht dafür weder PostgreSQL noch Chromium noch eine neue Vorrichtung.
//
// WAS DIESER FALL NICHT BEHAUPTET: keinen Browserlauf (die Flächenhälfte liegt in
// `vorschau-und-ergebnis-montiert.test.tsx`), keinen Lauf gegen einen echten Microsoft-365-Mandanten.
// Pedis Grenze gilt unverändert: „Codeprüfung und simulierte Office-Tests ersetzen keine echte
// Microsoft-365-Abnahme."
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../services/app/src/build-app";
import { buildDevPersistServices } from "../../services/app/src/dev-persist";
import { makeGuards } from "../../services/app/src/http";
import { sharepointImportRoutes } from "../../services/app/src/routes/sharepoint-import-routes";
import {
  type SharePointInhaltsTransport,
  SharePointSourceAdapter,
} from "../../services/sharepoint";
import { SharePointGraphClient } from "../../services/sharepoint/src/graph-client";

const GRAPH = "https://graph.microsoft.test/v1.0";
// JOB 4232 R3: Hier steht wieder ein NAME — so, wie Graph ihn im Betrieb nennt. In Runde 2 musste
// eine Adresse stehen, weil dieser Fall die Auflösung nicht injizieren konnte und ein Name eine
// echte DNS-Anfrage ausgelöst hätte. Seit dieser Fall die Route selbst registriert (s. `appAus`),
// sind Auflösung UND Transport injiziert: der Name wird zur geprüften Adresse aufgelöst, und genau
// auf diese bindet der Verbindungsaufbau — das ist der interessante Fall, nicht der triviale.
const DOWNLOAD = "https://download.sharepoint.test/vorautorisiert/";

// Die Schalter stehen VOR dem ersten Dienstbau: der quellneutrale Import-Strang wird beim BAUEN
// gelesen, und ohne ihn schreibt der Import-Kern gar keinen Herkunfts-Anker (dieselbe Reihenfolge
// wie in `tests/sharepoint-onedrive-import/erster-weg-am-draht.test.ts`).
process.env.KLARWERK_SHAREPOINT_IMPORT = "1";
process.env.KLARWERK_SHAREPOINT_BASE_URL = GRAPH;
process.env.KLARWERK_SHAREPOINT_TOKEN = "vertragsdouble-nur-fuer-den-test-4232";
process.env.KLARWERK_SHAREPOINT_DRIVE = "b!testbibliothek";

const ADMIN = { name: "Admin 4232", email: "admin4232@example.com", password: "geheim-1234" };

const GEAENDERT_AM = "2026-09-12T09:15:00Z";
const QUELLSTAND = Math.floor(Date.parse(GEAENDERT_AM) / 1000);
const TEXT = "ZEILE EINS\nZEILE ZWEI";

const NOTIZ = {
  id: "01NOTIZTXT",
  name: "Wartungsnotiz.txt",
  webUrl: "https://contoso.sharepoint.test/sites/technik/Freigegeben/Wartungsnotiz.txt",
  lastModifiedDateTime: GEAENDERT_AM,
  size: Buffer.byteLength(TEXT, "utf8"),
  file: { mimeType: "text/plain" },
  lastModifiedBy: { user: { displayName: "R. Schuster" } },
};

/** Eine leere Textdatei — sie heisst „leer" und wird NICHT übernommen. */
const LEER = {
  id: "01LEERTXT",
  name: "Leer.txt",
  webUrl: "https://contoso.sharepoint.test/sites/technik/Freigegeben/Leer.txt",
  lastModifiedDateTime: "2026-09-12T10:00:00Z",
  size: 0,
  file: { mimeType: "text/plain" },
};

/** Als `text/plain` gemeldet, aber in Wahrheit kein UTF-8 — sie wird NICHT halb übernommen. */
const KAPUTT = {
  id: "01KAPUTTTXT",
  name: "Kaputt.txt",
  webUrl: "https://contoso.sharepoint.test/sites/technik/Freigegeben/Kaputt.txt",
  lastModifiedDateTime: "2026-09-12T10:05:00Z",
  size: 4,
  file: { mimeType: "text/plain" },
};

/** Über der Inhaltskante — der Befund steht schon an den Merkmalen fest, es geht kein Abruf hinaus. */
const RIESIG = {
  id: "01RIESIGTXT",
  name: "Riesig.txt",
  webUrl: "https://contoso.sharepoint.test/sites/technik/Freigegeben/Riesig.txt",
  lastModifiedDateTime: "2026-09-12T10:10:00Z",
  size: 900 * 1024,
  file: { mimeType: "text/plain" },
};

/** Ein Typ ohne Inhaltsweg — er bleibt „nur Merkmale" und wird wie bisher übernommen. */
const ANWEISUNG = {
  id: "01ANWEISUNGDOCX",
  name: "Wartungsanweisung.docx",
  webUrl: "https://contoso.sharepoint.test/sites/technik/Freigegeben/Wartungsanweisung.docx",
  lastModifiedDateTime: "2026-09-10T08:30:00Z",
  size: 24_576,
  description: "Wartung der Abfüllanlage, Stand September.",
  file: {
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
};

const DATEIEN = [NOTIZ, LEER, KAPUTT, RIESIG, ANWEISUNG];

/** Die Bytes je Datei. `KAPUTT` trägt eine abgeschnittene UTF-8-Folge — echte, kaputte Bytes. */
const BYTES = new Map<string, Buffer>([
  [NOTIZ.id, Buffer.from(TEXT, "utf8")],
  [LEER.id, Buffer.alloc(0)],
  [KAPUTT.id, Buffer.from([0xc3, 0x28, 0xa0, 0xa1])],
]);

const echtesFetch = globalThis.fetch;
const fremdeAufrufe: string[] = [];
const graphAufrufe: string[] = [];
const downloadAufrufe: { url: string; adresse: string }[] = [];
/** Stellt der Inhaltsabruf sich tot? (403 — bens Gegenprobe zur Zusage ohne Deckung.) */
let downloadVerweigert = false;

/**
 * Das Double des INHALTSWEGS. Es ist kein `fetch` mehr, sondern der injizierte Transportvertrag —
 * und es sieht deshalb auch, auf welche Adresse gebunden wurde.
 */
const transportDouble: SharePointInhaltsTransport = async (url, optionen) => {
  downloadAufrufe.push({ url, adresse: optionen.adresse });
  if (!url.startsWith(DOWNLOAD)) {
    fremdeAufrufe.push(url);
    throw new Error(`Unerlaubter Aufruf im Test: ${url}`);
  }
  if (downloadVerweigert) {
    // JOB 4232 R2: der Fall, mit dem Ben die Zusage ohne Deckung vorgeführt hat — die Merkmale
    // versprechen Text, der Inhaltsabruf antwortet 403.
    return { status: 403, bytes: null };
  }
  const bytes = BYTES.get(decodeURIComponent(url.slice(DOWNLOAD.length)));
  return bytes === undefined ? { status: 404, bytes: null } : { status: 200, bytes };
};

beforeAll(() => {
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    const url = String(eingabe);
    void init;

    if (!url.startsWith(`${GRAPH}/`)) {
      fremdeAufrufe.push(url);
      throw new Error(`Unerlaubter Aufruf im Test: ${url}`);
    }
    graphAufrufe.push(url);

    const treffer = /\/items\/([^/?]+)/.exec(url);
    if (treffer) {
      const datei = DATEIEN.find((d) => d.id === decodeURIComponent(treffer[1] ?? ""));
      if (!datei) {
        return new Response(JSON.stringify({ error: { code: "itemNotFound" } }), { status: 404 });
      }
      return new Response(
        JSON.stringify({
          ...datei,
          // Die vorautorisierte Adresse kommt NUR beim gezielten Abruf mit — die Liste bekommt keine.
          ...(url.includes("downloadUrl")
            ? { "@microsoft.graph.downloadUrl": `${DOWNLOAD}${encodeURIComponent(datei.id)}` }
            : {}),
        }),
        { status: 200 },
      );
    }
    return new Response(JSON.stringify({ value: DATEIEN }), { status: 200 });
  }) as unknown as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = echtesFetch;
});

// ==================================================================================================
// JOB 4232 RUNDE 3 — WARUM DIESER FALL DIE ROUTE SELBST REGISTRIERT.
// ==================================================================================================
//
// Der Inhaltsweg baut seine Verbindung seit dieser Runde SELBST auf, um sie an die geprüfte Adresse
// zu binden (bens Korrekturpflicht 1). Er geht damit nicht mehr durch `globalThis.fetch` — ein
// global ersetztes `fetch` erreicht ihn nicht mehr, und ohne eine Vorrichtung ginge dieser Fall an
// ein ECHTES Netz. Das darf er nicht (Lieferung 10).
//
// Die Vorrichtung ist der injizierte `inhaltsTransport`, und sie muss bis zum Adapter durchgereicht
// werden. `build-app.ts` baut den Adapter aus der Umgebung und kennt keine Injektion — es ist
// ausserdem Zielpfad eines anderen Auftrags. Deshalb:
//
//   · Der Schalter steht beim BAU DER DIENSTE — nur so schreibt der Import-Kern den Herkunfts-Anker
//     (`build-app.ts:760`, `externalImportEnabled`).
//   · Beim BAU DER APP ist er aus — dann registriert `buildApp` die SharePoint-Route NICHT
//     (`build-app.ts:2764`: „Schalter aus, Route existiert nicht").
//   · Und dieser Fall registriert GENAU DIESELBE Route selbst, mit denselben echten Abhängigkeiten
//     (`services.library`, `makeGuards(services.auth)`, `services.importRuns`) — nur der Adapter
//     trägt die zwei Vorrichtungen.
//
// WAS DAMIT ECHT BLEIBT: die Fastify-App, die Route, die Rechteprüfung, der Import-Kern, die
// Persistenz und der Neustart. Attrappe sind ausschliesslich die zwei Netzgrenzen — genau das, was
// eine Attrappe sein soll.
async function appAus(journal: string) {
  process.env.KLARWERK_SHAREPOINT_IMPORT = "1";
  const services = await buildDevPersistServices(journal);
  process.env.KLARWERK_SHAREPOINT_IMPORT = "";
  const app = buildApp(services);
  app.register(
    sharepointImportRoutes({
      library: services.library,
      guards: makeGuards(services.auth),
      importRuns: services.importRuns,
      makeAdapter: () =>
        new SharePointSourceAdapter(
          new SharePointGraphClient({
            baseUrl: GRAPH,
            accessToken: "vertragsdouble-nur-fuer-den-test-4232",
            driveId: "b!testbibliothek",
            inhaltsTransport: transportDouble,
            // Injizierte Auflösung: aus diesem Fall geht keine DNS-Anfrage hinaus.
            aufloeseFn: async () => ["93.184.216.34"],
          }),
        ),
    }),
  );
  await app.inject({ method: "POST", url: "/api/auth/register", payload: ADMIN });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: ADMIN.email, password: ADMIN.password },
  });
  const token = (login.json() as { token?: string }).token ?? "";
  expect(token, "der Admin muss ein Token bekommen").not.toBe("");
  return { app, headers: { authorization: `Bearer ${token}` } };
}

function journalDatei(): string {
  return join(mkdtempSync(join(tmpdir(), "kw-4232-")), "state.jsonl");
}

interface Uebernahmeantwort {
  imported: number;
  alreadyQueued: number;
  neuerStand: string[];
  failed: { id: string; reason: string }[];
  notFound: string[];
  ohneInhalt: { id: string; befund: string }[];
  dateien: { id: string; name: string; url: string | null; inhalt: string }[];
}

describe("JOB 4232 · W1 — Vorschau, Annahme, Lesen, Neustart, Wiederholimport", () => {
  it("der ganze Weg: der Text der Datei steht nach Annahme und Neustart im Bestand", async () => {
    const journal = journalDatei();
    const { app, headers } = await appAus(journal);

    // --- Schritt 1: die Vorschau sagt VOR der Annahme, was Inhalt bringt --------------------
    const liste = await app.inject({
      method: "POST",
      url: "/api/admin/import/sharepoint/files",
      headers,
      payload: {},
    });
    expect(liste.statusCode, liste.body).toBe(200);
    const zeilen = (liste.json() as { dateien: { id: string; inhaltstyp: string }[] }).dateien;
    const typVon = (id: string) => zeilen.find((z) => z.id === id)?.inhaltstyp;
    expect(typVon(NOTIZ.id)).toBe("text");
    expect(typVon(LEER.id)).toBe("leer");
    expect(typVon(RIESIG.id)).toBe("zu-gross");
    expect(typVon(ANWEISUNG.id)).toBe("nur-merkmale");
    // KEINE HALDE VON ZEITSCHLÜSSELN: die Liste fragt die vorautorisierte Adresse gar nicht an.
    expect(graphAufrufe.some((u) => u.includes("children") && u.includes("downloadUrl"))).toBe(
      false,
    );

    // --- Schritt 2: die bewusste Annahme der gewählten Datei --------------------------------
    const uebernahme = await app.inject({
      method: "POST",
      url: "/api/admin/import/sharepoint/apply",
      headers,
      payload: { ids: [NOTIZ.id] },
    });
    expect(uebernahme.statusCode, uebernahme.body).toBe(200);
    const bilanz = uebernahme.json() as Uebernahmeantwort;
    expect(bilanz.imported).toBe(1);
    expect(bilanz.failed).toEqual([]);
    expect(bilanz.ohneInhalt).toEqual([]);
    // Das Ergebnisbild sagt, was WIRKLICH ankam — gemessen an diesem Abruf.
    expect(bilanz.dateien).toEqual([
      {
        id: NOTIZ.id,
        name: NOTIZ.name,
        url: NOTIZ.webUrl,
        geaendertAm: GEAENDERT_AM,
        inhalt: "text",
      },
    ]);
    // DER SICHERHEITSFALL, an der echten Leitung: Der Inhaltsweg wurde WIRKLICH gegangen, und er
    // war an die GEPRÜFTE Adresse gebunden — nicht an den Namen, den die Gegenstelle genannt hat
    // (JOB 4232 R3). Ein Zugangsmerkmal kann dort strukturell nicht mitgehen: der Transportvertrag
    // hat kein Feld dafür.
    expect(downloadAufrufe.length).toBeGreaterThan(0);
    expect(downloadAufrufe.every((a) => a.adresse === "93.184.216.34")).toBe(true);

    // --- Schritt 3: DERSELBE IMPORT SOFORT NOCH EINMAL — „schon vorhanden", nicht „importiert" --
    // Lieferung 7 wörtlich: zweimal dieselbe Version → EIN Vorgang, und die Antwort sagt es.
    const gleichNochmal = await app.inject({
      method: "POST",
      url: "/api/admin/import/sharepoint/apply",
      headers,
      payload: { ids: [NOTIZ.id] },
    });
    expect(gleichNochmal.statusCode, gleichNochmal.body).toBe(200);
    const bilanzNochmal = gleichNochmal.json() as Uebernahmeantwort;
    expect(bilanzNochmal.imported).toBe(0);
    expect(bilanzNochmal.alreadyQueued).toBe(1);
    expect(bilanzNochmal.dateien).toEqual([]);
    expect(bilanzNochmal.ohneInhalt).toEqual([]);

    // --- Schritt 4: die menschliche Annahme in der Prüf-Warteschlange -----------------------
    const warteschlange = await app.inject({
      method: "GET",
      url: "/api/library/import/candidates",
      headers,
    });
    const kandidaten = warteschlange.json() as { id: string; item: { externalId?: string } }[];
    // EIN Vorgang, nicht zwei — der zweite Aufruf hat die Warteschlange nicht verdoppelt.
    expect(kandidaten.filter((k) => k.item.externalId === NOTIZ.id)).toHaveLength(1);
    const kandidat = kandidaten.find((k) => k.item.externalId === NOTIZ.id);
    expect(kandidat, "die übernommene Datei muss als Kandidat warten").toBeDefined();
    const angenommen = await app.inject({
      method: "PUT",
      url: `/api/library/import/candidates/${kandidat?.id}`,
      headers,
      payload: { action: "accept" },
    });
    expect(angenommen.statusCode, angenommen.body).toBe(200);
    const koId = (angenommen.json() as { koId?: string }).koId;
    expect(koId, "die Annahme muss ein Wissensobjekt erzeugen").toBeTruthy();

    // --- Schritt 4: ZURÜCKGELESEN — steht der TEXT der Datei da? ----------------------------
    const klartext = (html: string | null | undefined): string =>
      (html ?? "")
        .replace(/<[^>]+>/g, "\n")
        .replace(/\s+/g, " ")
        .trim();
    const gelesen = await app.inject({ method: "GET", url: `/api/kos/${koId}`, headers });
    expect(gelesen.statusCode, gelesen.body).toBe(200);
    const ko = gelesen.json() as {
      title: string;
      bodyHtml?: string | null;
      sources: {
        provider?: string | null;
        externalId?: string;
        url?: string | null;
        sourceVersion?: number;
      }[];
    };
    expect(ko.title).toBe(NOTIZ.name);
    expect(klartext(ko.bodyHtml)).toBe("ZEILE EINS ZEILE ZWEI");
    const anker = ko.sources.find((s) => s.externalId === NOTIZ.id);
    expect(anker?.provider).toBe("SharePoint");
    expect(anker?.url).toBe(NOTIZ.webUrl);
    expect(anker?.sourceVersion).toBe(QUELLSTAND);
    await app.close();

    // --- Schritt 5: APPNEUSTART — dieselbe Journaldatei, eine neue Komposition --------------
    const neu = await appAus(journal);
    const nachNeustart = await neu.app.inject({
      method: "GET",
      url: `/api/kos/${koId}`,
      headers: neu.headers,
    });
    expect(nachNeustart.statusCode, nachNeustart.body).toBe(200);
    const koNeu = nachNeustart.json() as {
      bodyHtml?: string | null;
      sources: { externalId?: string; url?: string | null; sourceVersion?: number }[];
    };
    // Text, Herkunft und Stand unverändert lesbar — das ist der Satz aus Lieferung 8.
    expect(klartext(koNeu.bodyHtml)).toBe("ZEILE EINS ZEILE ZWEI");
    const ankerNeu = koNeu.sources.find((s) => s.externalId === NOTIZ.id);
    expect(ankerNeu?.url).toBe(NOTIZ.webUrl);
    expect(ankerNeu?.sourceVersion).toBe(QUELLSTAND);

    // --- Schritt 6: WIEDERHOLIMPORT NACH ANNAHME UND NEUSTART -------------------------------
    //
    // BENS KORREKTURPFLICHT 3, wörtlich gemessen: „Beleg nach Neustart: `imported: 0`,
    // `alreadyQueued: 1`, kein weiterer offener Kandidat, unveränderter Bestand."
    //
    // In Runde 1 stand hier `{ imported: 1, alreadyQueued: 0 }`: die Idempotenz der Warteschlange
    // greift nur für OFFENE Vorgänge (`repo.ts`, `insertIfAbsent`), und nach der Annahme steht kein
    // offener mehr da. Derselbe unveränderte Quellstand wurde deshalb erneut eingereiht und als
    // Import gemeldet — für einen Menschen nicht von einer Erstanlage zu unterscheiden. Seit
    // Runde 2 erkennt die Route den bereits ANGENOMMENEN Stand an derselben Warteschlange, die sie
    // ohnehin liest (`leseStaende`), und sagt „schon vorhanden".
    const zweitesMal = await neu.app.inject({
      method: "POST",
      url: "/api/admin/import/sharepoint/apply",
      headers: neu.headers,
      payload: { ids: [NOTIZ.id] },
    });
    expect(zweitesMal.statusCode, zweitesMal.body).toBe(200);
    const bilanz2 = zweitesMal.json() as Uebernahmeantwort;
    expect(bilanz2.imported, "derselbe angenommene Stand ist kein Import").toBe(0);
    expect(bilanz2.alreadyQueued, "er ist schon vorhanden — und die Antwort sagt das").toBe(1);
    expect(bilanz2.dateien).toEqual([]);
    expect(bilanz2.ohneInhalt).toEqual([]);

    // KEIN WEITERER OFFENER VORGANG: die Prüfung bekommt nichts zu entscheiden, was schon
    // entschieden ist. Offen heisst „neu" oder „in_bearbeitung" (`repo.ts:24`).
    const warteschlange2 = await neu.app.inject({
      method: "GET",
      url: "/api/library/import/candidates",
      headers: neu.headers,
    });
    const offen = (
      warteschlange2.json() as { id: string; status: string; item: { externalId?: string } }[]
    ).filter(
      (k) =>
        k.item.externalId === NOTIZ.id && (k.status === "neu" || k.status === "in_bearbeitung"),
    );
    expect(offen, "kein weiterer offener Kandidat").toEqual([]);

    // Und im Bestand steht danach weiterhin GENAU EIN Objekt zu dieser Quelle — mit seinem Text.
    const bestand = await neu.app.inject({ method: "GET", url: "/api/kos", headers: neu.headers });
    const alle = bestand.json() as { id: string; title: string }[];
    expect(alle.filter((k) => k.title === NOTIZ.name)).toHaveLength(1);
    const wieder = await neu.app.inject({
      method: "GET",
      url: `/api/kos/${koId}`,
      headers: neu.headers,
    });
    expect(wieder.statusCode, wieder.body).toBe(200);
    expect(klartext((wieder.json() as { bodyHtml?: string | null }).bodyHtml)).toBe(
      "ZEILE EINS ZEILE ZWEI",
    );
    await neu.app.close();
  });
});

describe("JOB 4232 · W2 — was nicht trägt, wird nicht als Erfolg gemeldet", () => {
  it("leer, unlesbar und zu gross: kein Eintrag, je ein eigener Grund, Bilanz stimmt", async () => {
    const { app, headers } = await appAus(journalDatei());

    const uebernahme = await app.inject({
      method: "POST",
      url: "/api/admin/import/sharepoint/apply",
      headers,
      payload: { ids: [LEER.id, KAPUTT.id, RIESIG.id, ANWEISUNG.id] },
    });
    expect(uebernahme.statusCode, uebernahme.body).toBe(200);
    const bilanz = uebernahme.json() as Uebernahmeantwort;

    // Die drei Inhaltsbefunde stehen EINZELN da — kein Sammelsatz, kein „gescheitert".
    expect([...bilanz.ohneInhalt].sort((a, b) => a.id.localeCompare(b.id))).toEqual(
      [
        { id: KAPUTT.id, befund: "unlesbar" },
        { id: LEER.id, befund: "leer" },
        { id: RIESIG.id, befund: "zu-gross" },
      ].sort((a, b) => a.id.localeCompare(b.id)),
    );
    expect(bilanz.failed).toEqual([]);
    expect(bilanz.notFound).toEqual([]);
    // Übernommen wurde GENAU die Datei, für die nie Inhalt versprochen war — mit ihrer ehrlichen
    // Kennzeichnung. Die drei anderen sind NICHT als Erfolg gemeldet.
    expect(bilanz.imported).toBe(1);
    expect(bilanz.dateien.map((d) => [d.id, d.inhalt])).toEqual([[ANWEISUNG.id, "nur-merkmale"]]);

    // Und in der Warteschlange steht auch wirklich nur dieser eine Vorgang.
    const warteschlange = await app.inject({
      method: "GET",
      url: "/api/library/import/candidates",
      headers,
    });
    const kandidaten = warteschlange.json() as { item: { externalId?: string } }[];
    expect(kandidaten.map((k) => k.item.externalId).sort()).toEqual([ANWEISUNG.id]);
    await app.close();
  });

  it("NETZPROBE: kein Aufruf ging an eine fremde Adresse, und es lief wirklich etwas", () => {
    expect(fremdeAufrufe).toEqual([]);
    expect(graphAufrufe.length).toBeGreaterThanOrEqual(2);
    expect(downloadAufrufe.length).toBeGreaterThanOrEqual(1);
    expect(downloadAufrufe.every((a) => a.url.startsWith(DOWNLOAD))).toBe(true);
  });
});

// ==================================================================================================
// JOB 4232 RUNDE 2 · W3 — DIE GEMESSENE VORSCHAU AM DRAHT (bens Korrekturpflicht 2, Serverhälfte).
// ==================================================================================================
//
// DER BEFUND: „Download antwortet 403; Vorschau meldet trotzdem `text`, ohne zuvor Inhalt
// abzurufen." Genau diese zwei Hälften stehen hier nebeneinander — die ANKÜNDIGUNG aus den
// Merkmalen und der MESSWERT aus dem wirklich gefahrenen Abruf. Sie müssen auseinanderfallen, wenn
// die Quelle den Inhalt verweigert; täten sie es nicht, wäre die Zusage wieder ungedeckt.
//
// Die Flächenhälfte derselben Pflicht liegt in `vorschau-und-ergebnis-montiert.test.tsx`; beide
// Hälften hängen an demselben Fehlercode (`SHAREPOINT_FORBIDDEN`), den dieser Fall hier misst.
describe("JOB 4232 · W3 — die Vorschau misst, statt zu versprechen", () => {
  it("die Ankündigung sagt `text`, die Messung sagt, was wirklich drin ist", async () => {
    const { app, headers } = await appAus(journalDatei());

    // (1) Die ANKÜNDIGUNG: aus Medientyp und Grösse, ohne einen einzigen Inhaltsabruf.
    const vorAbruf = downloadAufrufe.length;
    const liste = await app.inject({
      method: "POST",
      url: "/api/admin/import/sharepoint/files",
      headers,
      payload: {},
    });
    expect(liste.statusCode, liste.body).toBe(200);
    const listenkoerper = liste.json() as {
      dateien: { id: string; inhaltstyp: string }[];
      nurBefunde: boolean;
      befunde: unknown[];
    };
    expect(listenkoerper.dateien.find((z) => z.id === NOTIZ.id)?.inhaltstyp).toBe("text");
    expect(listenkoerper.nurBefunde, "das war die Frage nach der Liste").toBe(false);
    expect(listenkoerper.befunde, "und sie misst ausdrücklich nichts").toEqual([]);
    expect(downloadAufrufe.length, "die Liste holt KEINEN Inhalt").toBe(vorAbruf);

    // (2) Die MESSUNG derselben Dateien — sie holt den Inhalt wirklich.
    const gemessen = await app.inject({
      method: "POST",
      url: "/api/admin/import/sharepoint/files",
      headers,
      payload: { ids: [NOTIZ.id, KAPUTT.id, ANWEISUNG.id] },
    });
    expect(gemessen.statusCode, gemessen.body).toBe(200);
    const probe = gemessen.json() as {
      nurBefunde: boolean;
      befunde: { id: string; befund: string }[];
    };
    expect(probe.nurBefunde).toBe(true);
    expect([...probe.befunde].sort((a, b) => a.id.localeCompare(b.id))).toEqual(
      [
        { id: ANWEISUNG.id, befund: "nur-merkmale" },
        { id: KAPUTT.id, befund: "unlesbar" },
        { id: NOTIZ.id, befund: "text" },
      ].sort((a, b) => a.id.localeCompare(b.id)),
    );
    expect(downloadAufrufe.length, "die Messung holt WIRKLICH Inhalt").toBeGreaterThan(vorAbruf);
    // Auch auf diesem Weg ist die Verbindung an die geprüfte Adresse gebunden.
    expect(downloadAufrufe.every((a) => a.adresse === "93.184.216.34")).toBe(true);
    await app.close();
  });

  it("verweigert die Quelle den Inhalt (403), gibt es KEINE positive Zusage", async () => {
    const { app, headers } = await appAus(journalDatei());
    downloadVerweigert = true;
    try {
      // Die Merkmale versprechen weiterhin Text — das ist ja gerade der Fall, den Ben vorgeführt
      // hat. Die Ankündigung darf also `text` sagen …
      const liste = await app.inject({
        method: "POST",
        url: "/api/admin/import/sharepoint/files",
        headers,
        payload: {},
      });
      const zeilen = (liste.json() as { dateien: { id: string; inhaltstyp: string }[] }).dateien;
      expect(zeilen.find((z) => z.id === NOTIZ.id)?.inhaltstyp).toBe("text");

      // … die MESSUNG aber sagt nichts Positives mehr, sondern scheitert als Rechtefrage — mit dem
      // Code, den die Fläche in ihren Satz übersetzt. KEIN `text`, kein Befund, keine Zusage.
      const gemessen = await app.inject({
        method: "POST",
        url: "/api/admin/import/sharepoint/files",
        headers,
        payload: { ids: [NOTIZ.id] },
      });
      expect(gemessen.statusCode, gemessen.body).toBe(403);
      const fehler = gemessen.json() as { error: string; message: string };
      expect(fehler.error).toBe("SHAREPOINT_FORBIDDEN");
      expect(JSON.stringify(fehler), "kein Statuscode und keine Adresse nach aussen").not.toContain(
        DOWNLOAD,
      );

      // Und die ÜBERNAHME derselben Datei legt in diesem Zustand nichts an — der Weg ist
      // durchgehend ehrlich, nicht nur an der Vorschau.
      const uebernahme = await app.inject({
        method: "POST",
        url: "/api/admin/import/sharepoint/apply",
        headers,
        payload: { ids: [NOTIZ.id] },
      });
      expect(uebernahme.statusCode, uebernahme.body).toBe(403);
      const warteschlange = await app.inject({
        method: "GET",
        url: "/api/library/import/candidates",
        headers,
      });
      expect(
        (warteschlange.json() as { item: { externalId?: string } }[]).filter(
          (k) => k.item.externalId === NOTIZ.id,
        ),
        "ein verweigerter Inhalt erzeugt keinen Vorgang",
      ).toEqual([]);
    } finally {
      downloadVerweigert = false;
      await app.close();
    }
  });
});
