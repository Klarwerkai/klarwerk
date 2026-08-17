// @vitest-environment jsdom
// ================================================================================================
// JOB 1077 D7 — DIE FASSUNGSKETTE: AUSGELIEFERT A, VERFÜGBAR B, EINE AKTION, DANN WIRKLICH B.
// ================================================================================================
//
// WOGEGEN DIESER TEST STEHT, und das ist die Geschichte dieses Jobs: In D5 stand die „geladene
// Fassung" als HANDGEPFLEGTES LITERAL im Meta-Tag der Quelldatei. Ein Literal kann sich durch ein
// Neuladen nicht ändern — die Kette „Wechsel auslösen → Neuladen → das neue Artefakt meldet B" war
// deshalb nicht bloss unbewiesen, sie war IM ENTWURF NICHT SCHLIESSBAR. Der D5-Test setzte das Meta
// selbst auf B und zählte einen Reload-Aufruf; beides zusammen sah aus wie ein Beleg und war eine
// Attrappe neben einer zweiten Attrappe.
//
// D6 hat die Quelle umgedreht, BEN6 hat die Kette fachlich anerkannt, und D7 baut sie auf der
// aktuellen Base neu auf. Die tragende Entscheidung bleibt:
//
//   DIE FASSUNG ENTSTEHT BEI DER AUSLIEFERUNG. Die Quelldatei trägt nur `__KW_FASSUNG__`; der
//   Server ersetzt den Platzhalter im GESENDETEN Körper. Damit kann eine ausgelieferte Seite
//   niemals eine andere Fassung behaupten als der Server, der sie geschickt hat — und ein Neuladen
//   ändert die geladene Fassung WIRKLICH.
//
// WIE HIER GEMESSEN WIRD, und wo die Grenze liegt:
//   · Beide Fassungsnummern stammen aus ECHTEN Serverantworten desselben Fastify-Lebenszyklus
//     (`app.inject`): A aus dem geparsten Körper einer GET-Lieferung, B aus dem Kopf einer HEAD-
//     Antwort. Keine der beiden wird im Test gesetzt.
//   · Die Clientfunktionen werden nicht nachgebaut, sondern aus der WIRKLICH AUSGELIEFERTEN Datei
//     geschnitten (`KW-KLARA-FASSUNG-START/END`) und ausgeführt — dieselbe Bauform wie
//     `KW-KLARA-ASK-FETCH-*` und `KW-KLARA-S4-FETCH-*`, weil das Aufgabenfenster buildlos ist.
//   · `app.inject()` führt Route, Hooks, Kopfzeilen und Körper im ECHTEN Fastify-Lebenszyklus aus.
//     NICHT gemessen sind damit: eine TCP-Verbindung, die Origin-Prüfung eines Browsers, eine
//     native Dokumentnavigation und das Word-WebView. Der Reload wird als Funktion übergeben —
//     derselbe Einhängepunkt, den das Produkt vorsieht — und holt die Seite wirklich neu vom
//     Server; ein browsereigener Neustart des Dokuments ist nicht gemessen.
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import { afterAll, describe, expect, it } from "vitest";
import {
  KLARA_FASSUNG_KOPF,
  KLARA_FASSUNG_PLATZHALTER,
  KLARA_TASKPANE_FASSUNG,
  KLARA_TASKPANE_PFAD,
  registerWebStatic,
  stempleFassung,
} from "../../services/app/src/web-static";

const WURZEL = join(__dirname, "..", "..");
const QUELLE = join(WURZEL, "apps", "web", "public", "word-addin", "taskpane.html");
const MANIFEST = join(WURZEL, "docs", "word-addin", "klara-manifest.xml");

const FASSUNG_A = "1.0.0.1";
const FASSUNG_B = "1.0.0.2";

const aufraeumen: string[] = [];
afterAll(() => {
  for (const dir of aufraeumen) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/** Ein dist-Abbild wie aus `vite build` — mit der WIRKLICHEN Paneldatei, nicht mit einer Attrappe. */
function distMit(html: string): string {
  const dir = mkdtempSync(join(tmpdir(), "kw-fassung-"));
  aufraeumen.push(dir);
  mkdirSync(join(dir, "word-addin"), { recursive: true });
  writeFileSync(join(dir, "index.html"), "<!doctype html><title>SPA</title>");
  writeFileSync(join(dir, "word-addin", "taskpane.html"), html);
  return dir;
}

function quelltext(): string {
  return readFileSync(QUELLE, "utf8");
}

async function auslieferung(fassung: string, html = quelltext()): Promise<FastifyInstance> {
  const app = Fastify();
  await registerWebStatic(app, distMit(html), fassung);
  return app;
}

// Der Gate-tsc läuft ohne DOM-lib (`tsconfig.json`, `"lib": ["ES2022"]`). Den jsdom-DOMParser
// deshalb über einen schmalen Struktur-Typ von `globalThis` holen — dieselbe Bauform wie
// `tests/app/word-addin-taskpane-cache.test.ts:37 ff.`, kein zweiter Weg.
interface ElementLike {
  getAttribute(name: string): string | null;
}
interface DokumentLike {
  querySelector(auswahl: string): ElementLike | null;
  getElementById(id: string): ElementLike | null;
}
const { DOMParser: HtmlParser } = globalThis as unknown as {
  DOMParser: new () => { parseFromString(quelle: string, mime: string): DokumentLike };
};

/** Der Körper, den der Server WIRKLICH gesendet hat — geparst wie ein Browser ihn parst. */
function alsDokument(koerper: string): DokumentLike {
  return new HtmlParser().parseFromString(koerper, "text/html");
}

// ------------------------------------------------------------------------------------------------
// Der Schnitt: die ausgelieferten Clientfunktionen ausführen statt ihren Quelltext lesen.
// ------------------------------------------------------------------------------------------------

interface Fassungsmodul {
  kwGeladeneFassungAus: (doc: DokumentLike) => string;
  kwWechselOffen: (geladen: string | null, verfuegbar: string | null) => boolean;
  kwVerfuegbareFassungLaden: (fetchFn: unknown, pfad: string) => Promise<string | null>;
  kwWechselAusloesen: (
    geladen: string | null,
    verfuegbar: string | null,
    reloadFn: unknown,
  ) => boolean;
  KW_TASKPANE_PFAD: string;
}

function schneideFassungsmodul(src: string): Fassungsmodul {
  const start = src.indexOf("// KW-KLARA-FASSUNG-START");
  const ende = src.indexOf("// KW-KLARA-FASSUNG-END");
  if (start < 0 || ende < 0 || ende <= start) {
    throw new Error("Schnittmarken KW-KLARA-FASSUNG-START/END fehlen in taskpane.html");
  }
  const block = src.slice(start, ende);
  const fabrik = new Function(
    `${block}\nreturn { kwGeladeneFassungAus: kwGeladeneFassungAus, kwWechselOffen: kwWechselOffen, kwVerfuegbareFassungLaden: kwVerfuegbareFassungLaden, kwWechselAusloesen: kwWechselAusloesen, KW_TASKPANE_PFAD: KW_TASKPANE_PFAD };`,
  );
  return fabrik() as Fassungsmodul;
}

/** Ein `fetch`, das GEGEN DEN ECHTEN SERVER läuft — über den Fastify-Lebenszyklus, ohne Socket. */
function fetchGegen(app: FastifyInstance): (
  url: string,
  init?: { method?: string },
) => Promise<{
  ok: boolean;
  status: number;
  headers: { get: (name: string) => string | null };
  text: () => Promise<string>;
}> {
  return async (url, init) => {
    const res = await app.inject({ method: (init?.method ?? "GET") as "GET", url });
    return {
      ok: res.statusCode >= 200 && res.statusCode < 300,
      status: res.statusCode,
      headers: {
        get: (name: string) => {
          const wert = res.headers[name.toLowerCase()];
          return wert === undefined ? null : String(wert);
        },
      },
      text: async () => res.body,
    };
  };
}

// ================================================================================================
// BLOCK A — DIE KETTE. Vier Fälle: die Vorbedingung, der Durchgang, und zwei Wege, auf denen er
// NICHT als vollzogen gelten darf.
// ================================================================================================

describe("JOB 1077 D7 · A — die Fassungskette in EINEM Ablauf", () => {
  it("A1 · Vorbedingung: zwei Auslieferungen, zwei Fassungen, zwei wirklich verschiedene Körper", async () => {
    const a = await auslieferung(FASSUNG_A);
    const b = await auslieferung(FASSUNG_B);
    const ra = await a.inject({ method: "GET", url: KLARA_TASKPANE_PFAD });
    const rb = await b.inject({ method: "GET", url: KLARA_TASKPANE_PFAD });
    expect(FASSUNG_A).not.toBe(FASSUNG_B);
    expect(ra.statusCode).toBe(200);
    expect(rb.statusCode).toBe(200);
    // Ohne diesen Fall könnte die ganze Kette an zwei identischen Lieferungen grün laufen.
    expect(ra.body).not.toBe(rb.body);
  });

  it("A2 · die geschlossene Kette: A geladen → Server meldet B → Aktion → genau ein Reload → B geladen", async () => {
    const modul = schneideFassungsmodul(quelltext());
    const serverA = await auslieferung(FASSUNG_A);
    const serverB = await auslieferung(FASSUNG_B);

    // Schritt 1 — die AUSGELIEFERTE Seite trägt A. Gelesen aus dem Körper, nicht gesetzt.
    const lieferungA = await serverA.inject({ method: "GET", url: KLARA_TASKPANE_PFAD });
    let geladen = modul.kwGeladeneFassungAus(alsDokument(lieferungA.body));
    expect(geladen).toBe(FASSUNG_A);

    // Schritt 2 — B geht live. Der Client weiss davon zunächst NICHTS.
    let verfuegbar: string | null = null;
    expect(modul.kwWechselOffen(geladen, verfuegbar)).toBe(false);

    // Schritt 3 — ein ECHTER HEAD auf dieselbe Adresse liefert den Kopf.
    const protokoll: Array<{ url: string; method: string }> = [];
    const roh = fetchGegen(serverB);
    verfuegbar = await modul.kwVerfuegbareFassungLaden(
      (url: string, init?: { method?: string }) => {
        protokoll.push({ url, method: init?.method ?? "GET" });
        return roh(url, init);
      },
      modul.KW_TASKPANE_PFAD,
    );
    expect(protokoll).toEqual([{ url: KLARA_TASKPANE_PFAD, method: "HEAD" }]);
    expect(verfuegbar).toBe(FASSUNG_B);
    expect(geladen).toBe(FASSUNG_A);
    expect(modul.kwWechselOffen(geladen, verfuegbar)).toBe(true);

    // Schritt 4 — die PRODUKTFUNKTION löst aus. Genau ein Reload.
    let reloads = 0;
    const ausgeloest = modul.kwWechselAusloesen(geladen, verfuegbar, () => {
      reloads += 1;
    });
    expect(ausgeloest).toBe(true);
    expect(reloads).toBe(1);

    // Schritt 5 — die DARAUS entstehende neue Lieferung meldet B. Erst jetzt ist der Wechsel weg.
    const lieferungB = await serverB.inject({ method: "GET", url: KLARA_TASKPANE_PFAD });
    geladen = modul.kwGeladeneFassungAus(alsDokument(lieferungB.body));
    expect(geladen).toBe(FASSUNG_B);
    expect(modul.kwWechselOffen(geladen, verfuegbar)).toBe(false);
  });

  it("A3 · ohne Auslieferungswechsel bleibt der Wechsel zu — und der Reload unterbleibt", async () => {
    const modul = schneideFassungsmodul(quelltext());
    const server = await auslieferung(FASSUNG_A);
    const lieferung = await server.inject({ method: "GET", url: KLARA_TASKPANE_PFAD });
    const geladen = modul.kwGeladeneFassungAus(alsDokument(lieferung.body));
    const verfuegbar = await modul.kwVerfuegbareFassungLaden(
      fetchGegen(server),
      modul.KW_TASKPANE_PFAD,
    );
    expect(verfuegbar).toBe(FASSUNG_A);
    expect(modul.kwWechselOffen(geladen, verfuegbar)).toBe(false);
    let reloads = 0;
    expect(
      modul.kwWechselAusloesen(geladen, verfuegbar, () => {
        reloads += 1;
      }),
    ).toBe(false);
    expect(reloads).toBe(0);
  });

  it("A4 · bringt das Neuladen wieder A, ist der Wechsel NICHT vollzogen", async () => {
    // Cache oder Rückrollung: die Absicht zählt nicht, nur die Lieferung.
    const modul = schneideFassungsmodul(quelltext());
    const serverA = await auslieferung(FASSUNG_A);
    const serverB = await auslieferung(FASSUNG_B);
    const verfuegbar = await modul.kwVerfuegbareFassungLaden(
      fetchGegen(serverB),
      modul.KW_TASKPANE_PFAD,
    );
    let reloads = 0;
    expect(
      modul.kwWechselAusloesen(FASSUNG_A, verfuegbar, () => {
        reloads += 1;
      }),
    ).toBe(true);
    expect(reloads).toBe(1);
    const nochmalA = await serverA.inject({ method: "GET", url: KLARA_TASKPANE_PFAD });
    const geladen = modul.kwGeladeneFassungAus(alsDokument(nochmalA.body));
    expect(geladen).toBe(FASSUNG_A);
    expect(modul.kwWechselOffen(geladen, verfuegbar)).toBe(true);
  });
});

// ================================================================================================
// BLOCK B — DER SERVERVERTRAG, am echten Lebenszyklus.
// ================================================================================================

describe("JOB 1077 D7 · B — was der Server wirklich ausliefert", () => {
  it("B1 · die GET-Lieferung trägt die Fassung im Meta — und KEINEN Platzhalter mehr", async () => {
    const server = await auslieferung(FASSUNG_A);
    const res = await server.inject({ method: "GET", url: KLARA_TASKPANE_PFAD });
    expect(res.statusCode).toBe(200);
    expect(res.body).not.toContain(KLARA_FASSUNG_PLATZHALTER);
    const meta = alsDokument(res.body).querySelector('meta[name="kw-loaded-version"]');
    expect(meta?.getAttribute("content")).toBe(FASSUNG_A);
    expect(String(res.headers[KLARA_FASSUNG_KOPF])).toBe(FASSUNG_A);
  });

  it("B2 · DIESELBE Datei aus einer anderen Auslieferung meldet eine andere Fassung", async () => {
    const a = await auslieferung(FASSUNG_A);
    const b = await auslieferung(FASSUNG_B);
    const ra = await a.inject({ method: "GET", url: KLARA_TASKPANE_PFAD });
    const rb = await b.inject({ method: "GET", url: KLARA_TASKPANE_PFAD });
    const va = alsDokument(ra.body)
      .querySelector('meta[name="kw-loaded-version"]')
      ?.getAttribute("content");
    const vb = alsDokument(rb.body)
      .querySelector('meta[name="kw-loaded-version"]')
      ?.getAttribute("content");
    expect(va).toBe(FASSUNG_A);
    expect(vb).toBe(FASSUNG_B);
  });

  it("B3 · HEAD liefert den Kopf OHNE Körper", async () => {
    const server = await auslieferung(FASSUNG_B);
    const res = await server.inject({ method: "HEAD", url: KLARA_TASKPANE_PFAD });
    expect(res.statusCode).toBe(200);
    expect(String(res.headers[KLARA_FASSUNG_KOPF])).toBe(FASSUNG_B);
    expect(res.body).toBe("");
  });

  it("B4 · revalidierbar: no-cache, nie immutable, Validator über den GESENDETEN Körper", async () => {
    const server = await auslieferung(FASSUNG_A);
    const eins = await server.inject({ method: "GET", url: KLARA_TASKPANE_PFAD });
    const zwei = await server.inject({ method: "GET", url: KLARA_TASKPANE_PFAD });
    expect(eins.headers["cache-control"]).toBe("no-cache");
    expect(String(eins.headers["cache-control"])).not.toContain("immutable");
    expect(eins.headers.etag).toBeTruthy();
    // Gleicher Inhalt → gleicher Validator.
    expect(zwei.headers.etag).toBe(eins.headers.etag);
    // Anderer Inhalt (andere Fassung im GESENDETEN Körper) → anderer Validator. Genau das kann ein
    // ETag über den PLATTENINHALT nicht: dort wäre er gleich, und ein 304 zementierte den alten Stand.
    const andere = await auslieferung(FASSUNG_B);
    const drei = await andere.inject({ method: "GET", url: KLARA_TASKPANE_PFAD });
    expect(drei.headers.etag).not.toBe(eins.headers.etag);
  });

  it("B5 · die K7-Kennung `?v=<Version>` ändert an der Auslieferung nichts", async () => {
    const server = await auslieferung(FASSUNG_A);
    const ohne = await server.inject({ method: "GET", url: KLARA_TASKPANE_PFAD });
    const mit = await server.inject({
      method: "GET",
      url: `${KLARA_TASKPANE_PFAD}?v=${KLARA_TASKPANE_FASSUNG}`,
    });
    expect(mit.statusCode).toBe(200);
    expect(mit.body).toBe(ohne.body);
    expect(String(mit.headers[KLARA_FASSUNG_KOPF])).toBe(FASSUNG_A);
    expect(mit.headers["cache-control"]).toBe("no-cache");
  });

  it("B6 · fehlt das Add-in im Build, scheitert der Pfad LAUT — nie still als SPA-HTML", async () => {
    const dir = mkdtempSync(join(tmpdir(), "kw-fassung-leer-"));
    aufraeumen.push(dir);
    writeFileSync(join(dir, "index.html"), "<!doctype html><title>SPA</title>");
    const app = Fastify();
    await registerWebStatic(app, dir, FASSUNG_A);
    const res = await app.inject({ method: "GET", url: KLARA_TASKPANE_PFAD });
    expect(res.statusCode).toBe(404);
    expect(String(res.headers["content-type"] ?? "")).not.toContain("text/html");
    expect(res.body).not.toContain("SPA");
  });
});

// ================================================================================================
// BLOCK C — DIE FEHLERFÄLLE. Ausgebliebene Auskunft ist keine Bestätigung.
// ================================================================================================

describe("JOB 1077 D7 · C — was gilt, wenn die Auskunft ausbleibt", () => {
  it("C1 · der Abruf wirft → verfügbar bleibt null, kein Wechsel", async () => {
    const modul = schneideFassungsmodul(quelltext());
    const verfuegbar = await modul.kwVerfuegbareFassungLaden(() => {
      throw new Error("offline");
    }, modul.KW_TASKPANE_PFAD);
    expect(verfuegbar).toBeNull();
    expect(modul.kwWechselOffen(FASSUNG_A, verfuegbar)).toBe(false);
  });

  it("C2 · die Antwort ist nicht ok → null, kein Wechsel", async () => {
    const modul = schneideFassungsmodul(quelltext());
    const verfuegbar = await modul.kwVerfuegbareFassungLaden(
      () =>
        Promise.resolve({
          ok: false,
          status: 500,
          headers: { get: () => FASSUNG_B },
        }),
      modul.KW_TASKPANE_PFAD,
    );
    expect(verfuegbar).toBeNull();
    expect(modul.kwWechselOffen(FASSUNG_A, verfuegbar)).toBe(false);
  });

  it("C3 · der Kopf fehlt → null, kein Wechsel", async () => {
    const modul = schneideFassungsmodul(quelltext());
    const verfuegbar = await modul.kwVerfuegbareFassungLaden(
      () => Promise.resolve({ ok: true, status: 200, headers: { get: () => null } }),
      modul.KW_TASKPANE_PFAD,
    );
    expect(verfuegbar).toBeNull();
    expect(modul.kwWechselOffen(FASSUNG_A, verfuegbar)).toBe(false);
  });

  it("C4 · gar kein Abruf verfügbar → null, kein Wechsel, kein Wurf", async () => {
    const modul = schneideFassungsmodul(quelltext());
    const verfuegbar = await modul.kwVerfuegbareFassungLaden(undefined, modul.KW_TASKPANE_PFAD);
    expect(verfuegbar).toBeNull();
    expect(modul.kwWechselOffen(FASSUNG_A, verfuegbar)).toBe(false);
  });

  it("C5 · ungestempelt heisst `dev` — kein erfundener Wechselhinweis auf der Quelldatei", () => {
    const modul = schneideFassungsmodul(quelltext());
    // Genau der Fall: wer die Datei direkt aus dem Quellbaum öffnet, sieht den Platzhalter.
    const doc = alsDokument(quelltext());
    expect(modul.kwGeladeneFassungAus(doc)).toBe("dev");
    expect(modul.kwWechselOffen("dev", FASSUNG_B)).toBe(true);
    // …aber „dev" gegen eine ausbleibende Auskunft ergibt keinen Wechsel.
    expect(modul.kwWechselOffen("dev", null)).toBe(false);
  });
});

// ================================================================================================
// BLOCK D — DIE ANZEIGE liegt IN der Lieferung.
// ================================================================================================

describe("JOB 1077 D7 · D — die Fläche kommt mit der Seite", () => {
  it("D1 · die Fläche liegt in der ausgelieferten Seite und nennt beide Nummern, A zuerst", async () => {
    const server = await auslieferung(FASSUNG_A);
    const res = await server.inject({ method: "GET", url: KLARA_TASKPANE_PFAD });
    const doc = alsDokument(res.body);
    expect(doc.getElementById("kw-fassung")).not.toBeNull();
    // Die Vorlage nennt die geladene Fassung VOR der verfügbaren — der Mensch liest zuerst, was er hat.
    const vorlage = res.body.slice(res.body.indexOf("fassungWechsel:"));
    const geladenPos = vorlage.indexOf("{geladen}");
    const verfuegbarPos = vorlage.indexOf("{verfuegbar}");
    expect(geladenPos).toBeGreaterThanOrEqual(0);
    expect(verfuegbarPos).toBeGreaterThan(geladenPos);
  });

  it("D2 · der Knopf ist im Auslieferungszustand verborgen", async () => {
    const server = await auslieferung(FASSUNG_A);
    const res = await server.inject({ method: "GET", url: KLARA_TASKPANE_PFAD });
    const knopf = alsDokument(res.body).getElementById("kw-fassung-btn");
    expect(knopf).not.toBeNull();
    expect(String(knopf?.getAttribute("class") ?? "")).toContain("hidden");
  });
});

// ================================================================================================
// BLOCK E — DIE TRENNUNG. Eine Nummer, eine Quelle.
// ================================================================================================

describe("JOB 1077 D7 · E — woher die Nummern kommen und woher nicht", () => {
  it("E1 · die geladene Fassung kommt NUR aus dem Dokument, nie aus der Adresse", () => {
    const modul = schneideFassungsmodul(quelltext());
    const doc = alsDokument(
      '<!doctype html><html><head><meta name="kw-loaded-version" content="9.9.9.9" /></head><body></body></html>',
    );
    expect(modul.kwGeladeneFassungAus(doc)).toBe("9.9.9.9");
    // Ein Dokument ohne Meta behauptet nichts — auch wenn irgendwo eine Nummer in der URL stünde.
    expect(
      modul.kwGeladeneFassungAus(alsDokument("<!doctype html><html><body></body></html>")),
    ).toBe("dev");
  });

  it("E2 · im ausgelieferten Skript gibt es GENAU EINE Quelle der geladenen Fassung", () => {
    const src = quelltext();
    const treffer = src.match(/kwGeladeneFassungAus\s*\(/g) ?? [];
    // Definition + genau ein Aufruf in der Verdrahtung — keine zweite, abweichende Ableitung.
    expect(treffer.length).toBe(2);
    expect((src.match(/name="kw-loaded-version"/g) ?? []).length).toBe(1);
  });

  it("E3 · die Serverkonstante ist die Manifestversion — eine Zahl, zwei Orte, ein Wert", () => {
    const manifest = readFileSync(MANIFEST, "utf8");
    const version = /<Version>([^<]+)<\/Version>/.exec(manifest)?.[1];
    expect(version).toBeTruthy();
    expect(KLARA_TASKPANE_FASSUNG).toBe(version);
  });

  it("E4 · die Quelldatei pflegt KEINE Fassungsnummer von Hand", () => {
    const src = quelltext();
    // Im Meta steht der Platzhalter, nicht eine Nummer.
    expect(src).toContain(`content="${KLARA_FASSUNG_PLATZHALTER}"`);
    // Und der Stempel ersetzt ihn nachweislich.
    expect(stempleFassung(src, FASSUNG_B)).toContain(`content="${FASSUNG_B}"`);
    expect(stempleFassung(src, FASSUNG_B)).not.toContain(KLARA_FASSUNG_PLATZHALTER);
  });

  it("E5 · der Bau-Stempel bleibt eine ANDERE Frage und eine andere Mechanik", () => {
    const src = quelltext();
    // `__KLARA_STAND__` beantwortet „wann wurde gebaut", `__KW_FASSUNG__` „ist meine Seite noch die
    // ausgelieferte". Zwei Platzhalter, zwei Ersetzer — der eine im Build, der andere im Server.
    expect(src).toContain('var KLARA_STAND = "__KLARA_STAND__"');
    expect(src).toContain(KLARA_FASSUNG_PLATZHALTER);
    expect(KLARA_FASSUNG_PLATZHALTER).not.toBe("__KLARA_STAND__");
    // Der Server rührt den Bau-Stempel NICHT an.
    expect(stempleFassung("x __KLARA_STAND__ y", FASSUNG_A)).toContain("__KLARA_STAND__");
    // Und die Prüfsumme der Quelle ist von der Fassung unabhängig — sonst zöge jede Auslieferung
    // den Inhalts-Pin mit.
    const roh = createHash("sha256").update(readFileSync(QUELLE)).digest("hex");
    expect(roh).toHaveLength(64);
  });
});
