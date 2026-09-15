// @vitest-environment jsdom
// ================================================================================================
// JOB 4085 · ABNAHME 1 — DER RÜCKWEG AUS WORD, GEGEN EINE ECHTE WORD-DATEI.
// ================================================================================================
//
// DER BEFUND, GEGEN DEN DIESE DATEI STEHT (Auftrag §1/§2b): wer in Word einen Absatz mit
// Formatierung und Bildern ändert, bekam zwei verschiedene Ergebnisse — je nachdem, ob er freigeben
// darf. Wer freigeben darf, schreibt die Fassung direkt, und sein Word-HTML reist mit
// (`rwLadung` → `revise-release`). Wer NICHT freigeben darf (Fall 2), reichte denselben Absatz als
// Vorschlag ein, und nur der nackte Text kam an: `rwEinreichen` baute seine Nutzlast von Hand, ohne
// `bodyHtml`. Derselbe Mensch, dieselbe Word-Auswahl, dasselbe Wissensobjekt, zwei Ergebnisse.
//
// WARUM DIE PRÜFLÜCKE DIESES JOBS HIER LIEGT UND NICHT IRGENDWO: der Prüfer zu JOB 3667 R9 führt
// im Abschnitt NICHT GEPRÜFT ausdrücklich „keine reale Office- oder PostgreSQL-Abnahme"
// (`LEHREN.md`, 2026-09-15T02:37:51). Diese Datei schliesst die erste Hälfte.
//
// WAS HIER GEMESSEN WIRD, und an welcher Stelle:
//   · die ECHTE `.docx` aus dem Bestand, durch den PRODUKTIVEN Extraktor (`echte-word-auswahl.ts`),
//   · untergeschoben als Word-Auswahl des AUSGELIEFERTEN Aufgabenfensters (`createKlaraPanel` —
//     dieselbe Vorrichtung wie `tests/word-rueckweg/panel-rueckweg-mounted.test.ts`, sie führt
//     `taskpane.html` UND `rueckweg.js` in der Reihenfolge der Auslieferung aus),
//   · abgesetzt an die ECHTE Route (`buildApp(buildServices())`, echtes Login, echte Rollen — die
//     Bauform von `tests/word-rueckweg/rumpf-erhalt.test.ts`),
//   · und gemessen am ZURÜCKGELESENEN Objekt nach der Übernahme, nicht am Aufruf. Ein Fall, der
//     „der Aufruf trug ein bodyHtml" prüfte, wäre auch dann grün, wenn der Dienst den Rumpf danach
//     verwürfe (Auftrag §8.1).
//
// DIE EINE STELLE, AN DER DIESE DATEI NICHT DAS ECHTE HAUS FÄHRT, und sie steht hier statt in einer
// Fussnote: `POST /api/check-text` (die Dublettenprüfung, aus der die Kandidatenliste des Rückwegs
// entsteht) wird vorbelegt. Sie ist nicht Gegenstand dieser Abnahme, und ob ein Ähnlichkeitsmass
// den Eintrag findet, entscheidet nichts über den Rückweg; die Kennung im Kandidaten ist die ECHTE
// Kennung des angelegten Objekts. Jeder Aufruf an `/api/kos/…` — Laden des Ziels UND das Einreichen
// — geht dagegen live an die echte Route (`anDieEchteRoute`), samt echtem Sitzungscookie.
//
// WAS DIESE DATEI AUSDRÜCKLICH NICHT BEHAUPTET: einen Lauf im echten Office-Web-Host. Der ist
// F-Aufgabe von Pedi/Codex (Auftrag §10); „echte Word-Datei" heisst hier eine echte `.docx` durch
// den produktiven Extraktor.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { type KlaraPanel, createKlaraPanel, reply } from "../app/klara-panel-fixture";
import {
  ECHTE_DATEI,
  MARKIERTER_ABSATZ,
  MARKIERTE_UEBERSCHRIFT,
  type WordAuswahl,
  bilderDerBestandsdatei,
  echteWordAuswahl,
} from "./echte-word-auswahl";

type App = ReturnType<typeof buildApp>;
type Kopf = Record<string, string>;

/** Der ausführliche Inhalt, den der Eintrag VOR dem Vorschlag trägt — das Vergleichsmass. */
const BESTAND_RUMPF = "<p>Der freigegebene ausführliche Inhalt des Eintrags.</p>";

// ------------------------------------------------------------------------------------------------
// DIE ZAHLEN DIESER ABNAHME WERDEN AUS DEN AUSGELIEFERTEN DATEIEN GELESEN, NICHT ABGESCHRIEBEN.
// ------------------------------------------------------------------------------------------------
//
// RUNDE 2, und das ist der Anlass: in Runde 1 stand hier `const BUDGET_BYTES = 3500000` als Zahl.
// Sie war die Zahl des ENTWURFSWEGS (`POST /api/drafts`, bodyLimit 5 MiB) und nicht die dieser
// Route — der Prüfer hat gemessen, dass eine Bildlast von 1.520.700 Bytes damit unbeschnitten
// hinausging und als `413 FST_ERR_CTP_BODY_TOO_LARGE` zurückkam. Eine abgeschriebene Zahl kann
// genau das: stimmen und trotzdem über etwas anderes reden. Deshalb wird ab hier gelesen, und die
// Grenze selbst wird an der ECHTEN Route gemessen (A0d).
function zahlAus(quelle: string, datei: string, name: string): number {
  const treffer = new RegExp(`var ${name} = (\\d+);`).exec(quelle);
  if (!treffer?.[1]) {
    throw new Error(`${datei}: ${name} steht dort nicht mehr als feste Zahl — diese Abnahme rechnet
      mit einem Wert, den sie nicht mehr lesen kann.`);
  }
  return Number(treffer[1]);
}

// Die Pfadliterale stehen hier ausgeschrieben und nicht als Import: das Verzeichnis der Mitfahrer
// (`tests/klara-zerlegung/schnitt-pins.test.ts`) erhebt seine Griffe am TEXT der Prüfstände. Eine
// Datei, die `taskpane.html` und `rueckweg.js` liest, sie aber nur über eine fremde Konstante
// benennt, käme dort als Nicht-Mitfahrer durch — und das Verzeichnis listete weniger, als wirklich
// an den zwei ausgelieferten Dateien hängt.
const TASKPANE_DATEI = "apps/web/public/word-addin/taskpane.html";
const RUECKWEG_DATEI = "apps/web/public/word-addin/rueckweg.js";

const RUECKWEG_QUELLE = readFileSync(join(process.cwd(), RUECKWEG_DATEI), "utf8");
const TASKPANE_QUELLE = readFileSync(join(process.cwd(), TASKPANE_DATEI), "utf8");

/** Das Budget des ENTWURFSWEGS. Für diesen Weg ist es eine Obergrenze, nicht das Mass. */
const FENSTER_BUDGET_BYTES = zahlAus(
  TASKPANE_QUELLE,
  TASKPANE_DATEI,
  "WORD_ADDIN_BODY_BUDGET_BYTES",
);
/** Die Annahmegrenze der Route, gegen die der Rückweg schreibt — A0d misst sie an ihr selbst nach. */
const ROUTE_LIMIT_BYTES = zahlAus(RUECKWEG_QUELLE, RUECKWEG_DATEI, "RW_ROUTE_BODY_LIMIT_BYTES");
const ROUTE_RESERVE_BYTES = zahlAus(RUECKWEG_QUELLE, RUECKWEG_DATEI, "RW_ROUTE_RESERVE_BYTES");

/** Das Budget, gegen das der Rückweg wirklich rechnet (`rwBudgetBytes`): der kleinere der beiden. */
const BUDGET_BYTES = Math.min(FENSTER_BUDGET_BYTES, ROUTE_LIMIT_BYTES - ROUTE_RESERVE_BYTES);

/**
 * Die AUSGELIEFERTE `rwBudgetBytes` selbst, mit wechselnden Konstanten fahrbar (JOB 4115, A0c).
 *
 * Nicht nachgebaut: der Funktionsrumpf wird aus `rueckweg.js` geholt und ausgeführt. Eine Kopie der
 * Min-Regel im Prüfstand könnte grün sein, während die ausgelieferte Datei etwas anderes rechnet —
 * genau der Fehler, den `rumpf-faelle.ts` in seinem Kopf beschreibt.
 */
function budgetRegelAus(
  quelle: string,
): (fenster: number, route: number, reserve: number) => number {
  const treffer = /function rwBudgetBytes\(\) \{[\s\S]*?\n {4}\}/.exec(quelle);
  if (!treffer) {
    throw new Error(
      `${RUECKWEG_DATEI}: rwBudgetBytes steht dort nicht mehr als Funktion — diese Abnahme prüft
      eine Regel, die sie nicht mehr lesen kann.`,
    );
  }
  return new Function(
    "WORD_ADDIN_BODY_BUDGET_BYTES",
    "RW_ROUTE_BODY_LIMIT_BYTES",
    "RW_ROUTE_RESERVE_BYTES",
    `${treffer[0]}\nreturn rwBudgetBytes();`,
  ) as (fenster: number, route: number, reserve: number) => number;
}

// ------------------------------------------------------------------------------------------------
// DIE BRÜCKE: DER FETCH DES FENSTERS GEHT AN DIE ECHTE ROUTE.
// ------------------------------------------------------------------------------------------------
//
// Das Aufgabenfenster ruft `fetch("/api/kos/…", { credentials: "include" })`. `app.inject` ist der
// Weg, auf dem dieses Haus seine Routen im Prüfstand fährt; die Sitzung reist als echtes
// Sitzungscookie mit, das ein echtes `POST /api/auth/login` ausgestellt hat — also genau der
// Anmeldeweg, den `credentials: "include"` im Browser nimmt.

interface BrueckenAntwort {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
}

type FetchFn = (url: string, init?: Record<string, unknown>) => Promise<BrueckenAntwort>;

interface PanelGlobals {
  fetch: FetchFn;
  window: { fetch: FetchFn };
}

/**
 * Was über die Brücke hinausging — die Fixture zählt es nicht mit, weil sie hier umgangen wird.
 *
 * RUNDE 2: `p.calls` führt nur, was die Fake-Route gesehen hat. Sobald ein Aufruf an die echte
 * Route geht, steht er dort nicht. Die Budgetfälle messen aber genau diesen Körper — deshalb
 * schreibt die Brücke selbst mit, und zwar den Körper, den `fetch` bekommen hat, nicht eine
 * Nachbildung davon.
 */
interface EchterRuf {
  method: string;
  url: string;
  body: string;
  status: number;
}

function anDieEchteRoute(app: App, cookie: string, weiter: FetchFn, buch: EchterRuf[]): FetchFn {
  return async (url, init) => {
    if (!url.startsWith("/api/kos/")) {
      return weiter(url, init);
    }
    const method = typeof init?.method === "string" ? init.method : "GET";
    const body = typeof init?.body === "string" ? init.body : undefined;
    const antwort = await app.inject({
      method: method as "GET" | "PUT",
      url,
      headers: {
        cookie,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { payload: body }),
    });
    buch.push({ method, url, body: body ?? "", status: antwort.statusCode });
    return {
      ok: antwort.statusCode >= 200 && antwort.statusCode < 300,
      status: antwort.statusCode,
      headers: {
        get(name: string): string | null {
          const wert = antwort.headers[name.toLowerCase()];
          return typeof wert === "string" ? wert : null;
        },
      },
      json: async (): Promise<unknown> => antwort.json() as unknown,
    };
  };
}

// ------------------------------------------------------------------------------------------------
// Das echte Haus: Anmeldung, Rollen, ein freigegebenes Objekt MIT ausführlichem Inhalt.
// ------------------------------------------------------------------------------------------------

async function flaeche(): Promise<{ app: App; admin: Kopf }> {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "pedi@klarwerk.test", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "pedi@klarwerk.test", password: "secret123" },
  });
  return { app, admin: { authorization: `Bearer ${(login.json() as { token: string }).token}` } };
}

/** Ein zweites Konto über den Weg des Produkts — mit dem SITZUNGSCOOKIE, das das Fenster braucht. */
async function kontoMitCookie(
  app: App,
  admin: Kopf,
  rolle: string,
  email: string,
): Promise<{ cookie: string }> {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: admin,
    payload: { name: `Konto ${rolle}`, email, password: "secret123", role: rolle },
  });
  expect(angelegt.statusCode).toBe(201);
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "secret123" },
  });
  expect(login.statusCode).toBe(200);
  const gesetzt = login.headers["set-cookie"];
  const kopf = Array.isArray(gesetzt) ? gesetzt[0] : gesetzt;
  const cookie = typeof kopf === "string" ? (kopf.split(";")[0] ?? "").trim() : "";
  // Ohne echtes Sitzungscookie wäre die Brücke eine Attrappe der Anmeldung — dann lieber laut.
  expect(cookie, "die Anmeldung hat kein Sitzungscookie gesetzt").toMatch(/^[^=;]+=[^;]+$/);
  return { cookie };
}

async function freigegebenesObjekt(app: App, admin: Kopf, bodyHtml: string): Promise<string> {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: admin,
    payload: {
      confidentiality: "intern",
      title: "Ventil X schließt bei Überdruck",
      statement: "Bei Überdruck Ventil X manuell schließen.",
      type: "best_practice",
      category: "Anlage 1",
      bodyHtml,
    },
  });
  expect(angelegt.statusCode).toBe(201);
  const id = (angelegt.json() as { id: string }).id;
  const frei = await app.inject({
    method: "PUT",
    url: `/api/kos/${id}`,
    headers: admin,
    payload: { action: "admin-validate" },
  });
  expect(frei.statusCode).toBe(200);
  return id;
}

interface Stand {
  version: number;
  bodyHtml?: string | null;
  proposals?: { id: string; status: string; bodyHtml?: string | null }[];
}

async function stand(app: App, headers: Kopf, id: string): Promise<Stand> {
  const antwort = await app.inject({ method: "GET", url: `/api/kos/${id}`, headers });
  expect(antwort.statusCode).toBe(200);
  return antwort.json() as Stand;
}

/** Die Kandidatenliste des Rückwegs entsteht aus dieser Antwort — mit der ECHTEN Kennung. */
function trefferAuf(id: string, titel: string): Record<string, unknown> {
  return {
    duplicates: [
      {
        koId: id,
        koTitle: titel,
        relation: "teilweise",
        koStatus: "validiert",
        koCategory: "Anlage 1",
      },
    ],
    conflicts: [],
    note: null,
  };
}

/**
 * Ein gültiger `propose`-Körper von GENAU der verlangten Byte-Zahl — das Mass für A0d.
 *
 * Die Füllung besteht aus Einbyte-Zeichen ohne JSON-Maskierung; nur so trifft die Zählung die
 * Kante der Route auf das Byte, statt sie zu schätzen.
 */
function proposeMitGenauBytes(version: number, bytes: number): string {
  const bauen = (fuellung: string): string =>
    JSON.stringify({
      action: "propose",
      proposal: {
        statement: fuellung,
        bodyHtml: "<p>x</p>",
        baseVersion: version,
        origin: "word_addin",
      },
    });
  const fehlt = bytes - new TextEncoder().encode(bauen("")).length;
  expect(fehlt, "die verlangte Zahl liegt unter dem leeren Rahmen").toBeGreaterThan(0);
  return bauen("a".repeat(fehlt));
}

/**
 * Das AUSGELIEFERTE Fenster über der ECHTEN Route, mit dem Ziel schon gewählt — Fall 2.
 *
 * Bis Runde 1 stand diese Vorrichtung nur unter A1; A2 fuhr gegen eine vorgegebene 200-Antwort.
 * Der Prüfer hat gezeigt, warum das zu wenig ist: eine gestellte Antwort beweist keine Annahme,
 * und genau an der Annahme scheiterte der Weg. Seit Runde 2 fahren ALLE Budgetfälle hier durch.
 */
async function fensterAnDerEchtenRoute(
  app: App,
  cookie: string,
  me: { status: number; body: unknown },
  id: string,
  titel: string,
  auswahlText: string,
  auswahlHtml: string,
): Promise<{ p: KlaraPanel; buch: EchterRuf[] }> {
  const buch: EchterRuf[] = [];
  const p = createKlaraPanel({
    selectionText: auswahlText,
    selectionHtml: `<html><body>${auswahlHtml}</body></html>`,
    routes: {
      "/api/auth/me": { status: me.status, body: me.body },
      "/api/check-text": reply(200, trefferAuf(id, titel)),
    } as never,
  });
  panel = p;
  const globals = globalThis as unknown as PanelGlobals;
  const bruecke = anDieEchteRoute(app, cookie, globals.fetch, buch);
  globals.fetch = bruecke;
  globals.window.fetch = bruecke;

  p.setTab("capture");
  await p.flush();
  expect(p.q("#rw-block")?.className).toBe("");
  p.q("#rw-liste button")?.click();
  await p.flush();
  expect(p.q("#rw-ziel")?.className).toBe("");
  // Fall 2: dieses Konto darf nicht freigeben — der Griff reicht ein.
  expect(p.text("#rw-btn")).toBe(p.t("rwCtaEinreichen"));
  return { p, buch };
}

/** Der eine offene Vorschlag am Eintrag — oder ein lauter Abbruch, wenn keiner angelegt wurde. */
async function offenerVorschlag(
  app: App,
  admin: Kopf,
  id: string,
): Promise<{ id: string; bodyHtml?: string | null }> {
  const jetzt = await stand(app, admin, id);
  const offen = (jetzt.proposals ?? []).filter((v) => v.status === "offen");
  expect(offen, "das Fenster hat an der echten Route KEINEN Vorschlag angelegt").toHaveLength(1);
  return offen[0] as { id: string; bodyHtml?: string | null };
}

/** Die fremde Prüfung — sie erst schreibt die Fassung. Gibt den zurückgelesenen Stand zurück. */
async function uebernehmen(app: App, admin: Kopf, id: string, vorschlagId: string): Promise<Stand> {
  const vorher = await stand(app, admin, id);
  const antwort = await app.inject({
    method: "PUT",
    url: `/api/kos/${id}`,
    headers: admin,
    payload: {
      action: "decide-proposal",
      proposalId: vorschlagId,
      decision: "uebernehmen",
      expectedVersion: vorher.version,
    },
  });
  expect(antwort.statusCode).toBe(200);
  return stand(app, admin, id);
}

let panel: KlaraPanel | null = null;
afterEach(() => {
  panel?.restore();
  panel = null;
});

// ================================================================================================
// A0 · KALIBRIERUNG — ohne sie wäre jeder Fall darunter still grün.
// ================================================================================================

describe("JOB 4085 · A0 · die Vorrichtung misst wirklich eine echte Word-Datei", () => {
  it("A0a: der produktive Extraktor holt aus der BESTANDSDATEI zwei eingebettete Bilder", async () => {
    const bestand = await bilderDerBestandsdatei();
    // Ohne Bilder wäre A1 auch dann grün, wenn der Rückweg gar keine überträgt.
    expect(bestand.bildMarken, `${ECHTE_DATEI} trägt keine zwei Bilder mehr`).toHaveLength(2);
    for (const quelle of bestand.bildQuellen) {
      expect(quelle).toMatch(/^data:image\/(png|jpe?g|gif|webp);base64,/);
    }
    // DIE GEMESSENE ABWEICHUNG, hier festgehalten statt behauptet: der Klartext dieser Datei ist zu
    // kurz für die Dublettenprüfung (W6_MINDESTZEICHEN = 40, taskpane.html:8657) — deshalb reist die
    // Markierung dieser Abnahme in einem echten OOXML-Paket MIT DIESEN Bildern (s. `echte-word-auswahl.ts`).
    expect(bestand.text.trim().length).toBeLessThan(40);
  });

  it("A0b: die Word-Markierung dieser Abnahme trägt genau diese Bilder — und genug Text", async () => {
    const auswahl = await echteWordAuswahl();
    const bestand = await bilderDerBestandsdatei();
    expect(auswahl.bildQuellen, "die Bilder der Bestandsdatei sind nicht dieselben").toEqual(
      bestand.bildQuellen,
    );
    // Über der Schwelle — sonst gäbe es im Fenster keine Kandidaten und damit keinen Rückweg;
    // der Fall wäre nicht „grün", sondern gar nicht gefahren.
    expect(auswahl.text.trim().length).toBeGreaterThanOrEqual(40);
    // Und die Formatierung ist wirklich da: eine Überschrift, die reiner Text nicht überlebt.
    expect(auswahl.html).toContain(`<h2>${MARKIERTE_UEBERSCHRIFT}</h2>`);
  });

  it("A0c: der Rückweg nimmt IMMER den kleineren von Fensterbudget und Routengrenze — die Regel, nicht die Zahlen von heute", () => {
    // ==========================================================================================
    // UMGEBAUT IN JOB 4115, UND NICHT GELOCKERT — DER GRUND STEHT HIER.
    // ==========================================================================================
    // Bis hierher prüfte dieser Fall die KONSTELLATION von damals: `FENSTER_BUDGET_BYTES >
    // ROUTE_LIMIT_BYTES`, weil die Route keine eigene Annahmegrenze trug und Fastifys 1 MiB galt.
    // Seit die Route ihre eigene, breitere Grenze hat (`KOS_BODY_LIMIT`, 5 MiB), ist diese
    // Ungleichung UMGEKEHRT — der Fall wäre rot geworden, und zwar aus dem falschen Grund. Ihn zu
    // streichen hiesse, die Min-Regel ungeprüft zu lassen; sie an die neuen Tageswerte anzupassen
    // hiesse, denselben Fehler noch einmal zu machen. Geprüft wird deshalb ab jetzt die REGEL, in
    // BEIDEN Richtungen, gefahren an der AUSGELIEFERTEN Funktion selbst.
    const budget = budgetRegelAus(RUECKWEG_QUELLE);
    // Richtung 1 — das Fenster ist kleiner: das Fenster gewinnt. (Die Lage von heute.)
    expect(budget(1_000_000, 5_242_880, 16_384)).toBe(1_000_000);
    // Richtung 2 — die Route ist kleiner: die Route gewinnt, abzüglich der Reserve. (Die Lage vor
    // JOB 4115; sie bleibt gedeckt, damit ein Rückbau der Grenze nicht unbemerkt durchginge.)
    expect(budget(3_500_000, 1_048_576, 16_384)).toBe(1_048_576 - 16_384);
    // Gleichstand: kein Sonderweg, kein Aufschlag.
    expect(budget(1_000_000, 1_016_384, 16_384)).toBe(1_000_000);
    // Und mit den Zahlen von HEUTE liefert dieselbe Funktion genau das, womit diese Datei rechnet.
    expect(budget(FENSTER_BUDGET_BYTES, ROUTE_LIMIT_BYTES, ROUTE_RESERVE_BYTES)).toBe(BUDGET_BYTES);
    // Und die Ladung misst wirklich gegen dieses Budget — nicht gegen die Konstante des Fensters.
    expect(RUECKWEG_QUELLE).toContain("var budget = rwBudgetBytes();");
    expect(RUECKWEG_QUELLE).toContain("wordHtmlUtf8Bytes(bauen(kandidat)) <= budget");
  });

  it("A0c2: heute ist das FENSTERBUDGET die bindende Zahl — und das Fenster schneidet weiter selbst", () => {
    // Die Tatsache der Stunde, festgehalten statt behauptet: die Route nimmt mehr an, als das
    // Fenster schickt. Das ist gewollt — der Rückweg läuft nie in einen Serverfehler, sondern
    // schneidet vorher selbst und sagt, was fehlt (A2/A3).
    expect(FENSTER_BUDGET_BYTES).toBeLessThan(ROUTE_LIMIT_BYTES - ROUTE_RESERVE_BYTES);
    expect(BUDGET_BYTES).toBe(FENSTER_BUDGET_BYTES);
    // Der beschneidende Weg steht und wird weiter gerufen — die breitere Tür legt ihn nicht still.
    expect(RUECKWEG_QUELLE).toContain("trimWordImagesToBudget(inner, passt)");
  });

  it("A0d: diese Grenze ist die der ECHTEN Route — an ihr selbst gemessen, nicht behauptet", async () => {
    // ==========================================================================================
    // DIE KALIBRIERUNG, DIE IN RUNDE 1 FEHLTE (Korrekturpflicht 2 des Prüfers).
    // ==========================================================================================
    // Eine Nutzlastgrenze im Client ist nur so viel wert wie ihre Übereinstimmung mit der Route,
    // die sie empfängt. Deshalb wird hier nicht die Zahl aus `ko-routes.ts` abgeschrieben (dort
    // steht gar keine — es gilt Fastifys Vorgabe), sondern die Kante selbst abgefahren: ein
    // Körper von genau `RW_ROUTE_BODY_LIMIT_BYTES` Bytes kommt an, einer mit einem Byte mehr
    // nicht. Wandert die Grenze am Server, wird DIESER Fall rot — nicht erst der Anwender.
    const { app, admin } = await flaeche();
    const id = await freigegebenesObjekt(app, admin, BESTAND_RUMPF);
    const version = (await stand(app, admin, id)).version;

    const absetzen = async (bytes: number) => {
      const koerper = proposeMitGenauBytes(version, bytes);
      expect(new TextEncoder().encode(koerper).length).toBe(bytes);
      return app.inject({
        method: "PUT",
        url: `/api/kos/${id}`,
        headers: { ...admin, "content-type": "application/json" },
        payload: koerper,
      });
    };

    const anDerKante = await absetzen(ROUTE_LIMIT_BYTES);
    expect(
      anDerKante.statusCode,
      "die Route nimmt schon an ihrer eigenen Grenze nichts mehr an — die Konstante ist zu gross",
    ).not.toBe(413);

    const einBytesDrueber = await absetzen(ROUTE_LIMIT_BYTES + 1);
    expect(
      einBytesDrueber.statusCode,
      "die Route nimmt MEHR an als die Konstante sagt — dann ist sie nicht die gemessene Grenze",
    ).toBe(413);
    expect(einBytesDrueber.json()).toMatchObject({ code: "FST_ERR_CTP_BODY_TOO_LARGE" });

    // Und das Budget des Fensters bleibt innerhalb dessen, was die Route wirklich nimmt.
    expect(BUDGET_BYTES).toBeLessThanOrEqual(ROUTE_LIMIT_BYTES);
  });
});

// ================================================================================================
// A1 · DER FALL DES AUFTRAGS (§6 Red-first) — GEMESSEN AM ZURÜCKGELESENEN OBJEKT.
// ================================================================================================

describe("JOB 4085 · A1 · der Vorschlag aus Word trägt die Bilder der echten Datei", () => {
  it("A1: ein Absatz mit zwei Bildern, von einem Konto OHNE Freigaberecht eingereicht, steht nach der Übernahme mit seinen Bildern im Fließtext", async () => {
    const auswahl = await echteWordAuswahl();
    // Die Identitätsauskunft der Bühne ist die des echten Servers, im Wortlaut — sie entscheidet im
    // Fenster über die Accountregel (Fall 2: einreichen statt freigeben).
    const { app, admin, id, cookie, me } = await buehne();
    const vorher = await stand(app, admin, id);

    const { p } = await fensterAnDerEchtenRoute(
      app,
      cookie,
      me,
      id,
      "Ventil X schließt bei Überdruck",
      auswahl.text,
      auswahl.html,
    );

    p.q("#rw-btn")?.click();
    await p.flush();
    expect(p.text("#rw-status")).toBe(p.t("rwEingereicht"));

    // Eingereicht ist noch nicht übernommen: der Eintrag trägt weiter seinen Stand.
    const waehrend = await stand(app, admin, id);
    expect(waehrend.version).toBe(vorher.version);
    expect(waehrend.bodyHtml ?? "").toBe(vorher.bodyHtml ?? "");
    const offen = await offenerVorschlag(app, admin, id);

    // ==========================================================================================
    // DIE MESSUNG: WAS STEHT JETZT IM EINTRAG? Nicht, was der Aufruf trug.
    // ==========================================================================================
    const nachher = await uebernehmen(app, admin, id, offen.id);
    expect(nachher.version).toBe(vorher.version + 1);
    const rumpf = nachher.bodyHtml ?? "";
    for (const quelle of auswahl.bildQuellen) {
      expect(
        rumpf,
        "ein Bild der echten Word-Datei steht nach der Übernahme NICHT im Fließtext des Eintrags",
      ).toContain(quelle);
    }
    // Und der alte Inhalt ist wirklich ERSETZT, nicht danebengestellt — sonst wäre „übernommen"
    // ein Wort für „ergänzt".
    expect(rumpf).not.toContain("Der freigegebene ausführliche Inhalt des Eintrags.");
  });
});

// ================================================================================================
// A2–A4 · DIE BYTE-GRENZE, GEGEN DIE ECHTE ROUTE GEFAHREN (Runde 2, Korrekturpflicht 2).
// ================================================================================================
//
// WAS IN RUNDE 1 FALSCH WAR, und es steht hier, weil es die Bauart dieser drei Fälle erklärt: A2
// fuhr gegen eine vorgegebene 200-Antwort und maass danach die Bytes des Aufrufs. Das war eine
// Aussage über den Aufruf, nicht über die Annahme — und genau an der Annahme scheiterte der Weg
// (Prüfer, Runde 1: `bytes=1520700 status=413 code=FST_ERR_CTP_BODY_TOO_LARGE`, im Fenster als
// „Einreichen fehlgeschlagen — nichts wurde eingereicht"). Seit Runde 2 geht JEDER Budgetfall an
// die echte Route, und gemessen wird, was dort ankommt und was danach im Eintrag steht.
//
// DIE DREI BÄNDER, in denen sich eine Word-Auswahl bewegen kann:
//   · A4 knapp UNTER dem Budget → nichts wird beschnitten, die Bilder kommen an, kein Bilanzsatz.
//   · A2 knapp ÜBER dem Budget → erst fallen Bilder, der Rest kommt an, die Bilanz nennt sie.
//   · A3 weit darüber → auch die Bilder reichen nicht, der Klartext-Rückfall greift, und auch DAS
//     wird gesagt. Nie ein Serverfehler.
// Dazu seit JOB 4115 das Band, um das es dem Menschen wirklich geht:
//   · A5 über 1 MiB, aber unter dem Budget → alles kommt an, nichts fehlt, kein Bilanzsatz.

/**
 * Die Nutzlast, an der die Füllung bemessen wird — in DERSELBEN Form, die das Fenster absetzt.
 *
 * SIE IST HIER MASS UND NICHT ZUSICHERUNG: geprüft wird die Form in A1 (am echten Aufruf) und in
 * `tests/word-rueckweg/panel-rueckweg-mounted.test.ts` (R5, die vier Felder). Hier dient sie nur
 * dazu, die Auswahl so zu bemessen, dass die zwei echten Bilder sie über das Budget heben —
 * ohne eine Zahl zu raten.
 */
function nutzlastBytes(rumpf: string, aussage: string, version: number): number {
  return new TextEncoder().encode(
    JSON.stringify({
      action: "propose",
      proposal: {
        statement: aussage,
        bodyHtml: rumpf,
        baseVersion: version,
        origin: "word_addin",
      },
    }),
  ).length;
}

/**
 * Die Auswahl so füllen, dass sie OHNE ihre Bilder gerade noch ins Budget passt und MIT ihnen nicht.
 *
 * Genau das ist der Fall, für den `trimWordImagesToBudget` gebaut ist: erst Bilder weglassen, dann
 * erst den ganzen Rumpf aufgeben. Der Fülltext besteht aus Einbyte-Zeichen ohne JSON-Maskierung —
 * nur so ist die Grenze auf das Byte genau zu treffen statt zu schätzen.
 */
function knappUeberBudget(html: string, aussage: string, version: number): string {
  const ohneBilder = html.replace(/<img\b[^>]*>/gi, "");
  const grundlast = nutzlastBytes(`<p></p>${ohneBilder}`, aussage, version);
  const luecke = BUDGET_BYTES - 64 - grundlast;
  expect(luecke, "die echte Datei ist allein schon über dem Budget").toBeGreaterThan(0);
  return `<p>${"a".repeat(luecke)}</p>${html}`;
}

/** Dieselbe Rechnung von der anderen Seite: MIT Bildern gerade noch drin — nichts darf fallen. */
function knappUnterBudget(html: string, aussage: string, version: number): string {
  const grundlast = nutzlastBytes(`<p></p>${html}`, aussage, version);
  const luecke = BUDGET_BYTES - 2048 - grundlast;
  expect(luecke, "die echte Datei ist allein schon über dem Budget").toBeGreaterThan(0);
  return `<p>${"a".repeat(luecke)}</p>${html}`;
}

/**
 * DAS BAND, IN DEM AUCH DAS WEGLASSEN ALLER BILDER NICHT REICHT — über dem Budget UND über der
 * Annahmegrenze der Route.
 *
 * JOB 4115: bis hierher hiess diese Funktion `imBandDesServerfehlers` und zielte zwischen
 * Routengrenze (damals 1 MiB) und Fensterbudget. Dieses Band gibt es nicht mehr — die Route ist
 * jetzt die breitere der beiden Zahlen. Der Fall bleibt aber der wichtigste des Weges, und deshalb
 * zielt er ab jetzt über BEIDE: eine Last, die auch die Route mit 413 abweisen würde, wenn das
 * Fenster sie hinausliesse. Genau das tut es nicht — es schneidet erst die Bilder und fällt dann
 * auf den Klartext zurück. Der Mensch bekommt einen Satz, nie einen Serverfehler.
 */
function weitUeberDemBudget(html: string, aussage: string, version: number): string {
  const ziel = ROUTE_LIMIT_BYTES + 400_000;
  const grundlast = nutzlastBytes(`<p></p>${html}`, aussage, version);
  const luecke = ziel - grundlast;
  expect(luecke, "die echte Datei liegt allein schon über der Zielgrösse").toBeGreaterThan(0);
  return `<p>${"a".repeat(luecke)}</p>${html}`;
}

/**
 * Der eine PUT, den ein Einreichen auslöst — wie er an der ECHTEN Route ankam.
 *
 * Er trägt seinen Status mit: ohne ihn wäre „die Nutzlast lag im Budget" eine Aussage über einen
 * Körper, von dem niemand weiss, ob die Route ihn genommen hat. Genau das war der Befund.
 */
function derEinePut(buch: EchterRuf[]): { bytes: number; bodyHtml: string; status: number } {
  const geschrieben = buch.filter((c) => c.method === "PUT");
  expect(geschrieben).toHaveLength(1);
  const ruf = geschrieben[0] as EchterRuf;
  const nutzlast = (JSON.parse(ruf.body) as { proposal: { bodyHtml?: string } }).proposal;
  return {
    bytes: new TextEncoder().encode(ruf.body).length,
    bodyHtml: nutzlast.bodyHtml ?? "",
    status: ruf.status,
  };
}

/** Die Bühne der drei Bandfälle: echtes Haus, echtes Konto ohne Freigaberecht, echtes Objekt. */
async function buehne(): Promise<{
  app: App;
  admin: Kopf;
  id: string;
  cookie: string;
  me: { status: number; body: unknown };
}> {
  const { app, admin } = await flaeche();
  const id = await freigegebenesObjekt(app, admin, BESTAND_RUMPF);
  const experte = await kontoMitCookie(app, admin, "experte", "experte@klarwerk.test");
  const me = await app.inject({ method: "GET", url: "/api/auth/me", headers: experte });
  expect(me.statusCode).toBe(200);
  return { app, admin, id, cookie: experte.cookie, me: { status: me.statusCode, body: me.json() } };
}

describe("JOB 4085 · A2 · was nicht mitkonnte, steht auch am Einreichweg da", () => {
  it("A2: über dem Budget fallen erst die Bilder — die echte Route nimmt an, der Satz nennt den Verlust", async () => {
    const auswahl = await echteWordAuswahl();
    const { app, admin, id, cookie, me } = await buehne();
    const version = (await stand(app, admin, id)).version;
    const gefuellt = knappUeberBudget(auswahl.html, auswahl.text.trim(), version);

    const { p, buch } = await fensterAnDerEchtenRoute(
      app,
      cookie,
      me,
      id,
      "Ventil X schließt bei Überdruck",
      auswahl.text,
      gefuellt,
    );
    p.q("#rw-btn")?.click();
    await p.flush();

    // DER PUNKT: der Erfolgssatz steht da UND die Bilanz hängt dran — mit denselben Worten wie am
    // Schreibweg (`bilderText(bilderBilanz(...))`), nicht mit einem zweiten Wortlaut.
    expect(p.text("#rw-status")).toBe(
      `${p.t("rwEingereicht")} ${p.t("sendImagesDropped", { n: "2" })}`,
    );
    expect(p.q("#rw-status")?.className).toBe("");

    const put = derEinePut(buch);
    expect(put.bytes).toBeLessThanOrEqual(BUDGET_BYTES);
    expect(put.status, "die ECHTE Route hat die beschnittene Nutzlast nicht angenommen").toBe(200);
    expect(put.bodyHtml).not.toContain("<img");

    // UND DIE ANNAHME, nicht nur der Aufruf: der Vorschlag steht an der echten Route, und was von
    // der Auswahl übrig blieb, steht nach der Übernahme im Eintrag.
    const vorschlag = await offenerVorschlag(app, admin, id);
    const nachher = await uebernehmen(app, admin, id, vorschlag.id);
    const rumpf = nachher.bodyHtml ?? "";
    expect(rumpf).toContain(MARKIERTER_ABSATZ);
    expect(rumpf).not.toContain("Der freigegebene ausführliche Inhalt des Eintrags.");
  });
});

// ================================================================================================
// A3 · DER BEFUND DES PRÜFERS, ALS FALL — 1,4 MB GEHEN DURCH, NICHT ZURÜCK.
// ================================================================================================

describe("JOB 4085 · A3 · eine Bildlast über der Annahmegrenze endet nicht im Serverfehler", () => {
  it("A3: eine Auswahl über Fensterbudget UND Routengrenze wird eingereicht — kein 413, und der Satz sagt warum sie nicht ganz mitkonnte", async () => {
    const auswahl = await echteWordAuswahl();
    const { app, admin, id, cookie, me } = await buehne();
    const version = (await stand(app, admin, id)).version;
    const aussage = auswahl.text.trim();
    const gefuellt = weitUeberDemBudget(auswahl.html, aussage, version);

    // DAS BAND, in Zahlen festgehalten statt behauptet: die ungeschnittene Nutzlast liegt über dem
    // Budget des Fensters UND über dem, was die Route annimmt. Ginge sie ungeschnitten hinaus,
    // käme sie als 413 zurück — das ist die Lage, gegen die dieser Fall steht.
    const roh = nutzlastBytes(gefuellt, aussage, version);
    expect(roh).toBeGreaterThan(BUDGET_BYTES);
    expect(roh).toBeGreaterThan(ROUTE_LIMIT_BYTES);

    const { p, buch } = await fensterAnDerEchtenRoute(
      app,
      cookie,
      me,
      id,
      "Ventil X schließt bei Überdruck",
      auswahl.text,
      gefuellt,
    );
    p.q("#rw-btn")?.click();
    await p.flush();

    // KEIN SERVERFEHLER. Bis Runde 1 stand hier `rwEinreichFehler` — „Einreichen fehlgeschlagen,
    // nichts wurde eingereicht", obwohl der Mensch nichts falsch gemacht hatte.
    expect(p.text("#rw-status")).not.toBe(p.t("rwEinreichFehler"));
    // Auch die Bilder allein reichen hier nicht: der Klartext-Rückfall greift, und er wird gesagt.
    expect(p.text("#rw-status")).toBe(`${p.t("rwEingereicht")} ${p.t("sendOverBudget")}`);

    const put = derEinePut(buch);
    expect(put.bytes).toBeLessThanOrEqual(BUDGET_BYTES);
    // DER BEFUND DES PRÜFERS, an der Stelle gemessen, an der er auftrat: die Route hat angenommen.
    expect(put.status, "die echte Route hat mit 413 abgewiesen — der Befund steht noch").toBe(200);
    // Kein `clearBody`, auch hier nicht: der Rückfall trägt den Klartext, nicht die Leere.
    expect(put.bodyHtml.length).toBeGreaterThan(0);
    expect(buch.filter((c) => c.method === "PUT")[0]?.body ?? "").not.toContain("clearBody");

    // Und angekommen ist er wirklich — gemessen am Eintrag, nicht am Aufruf.
    const vorschlag = await offenerVorschlag(app, admin, id);
    const nachher = await uebernehmen(app, admin, id, vorschlag.id);
    expect(nachher.bodyHtml ?? "").toContain(MARKIERTER_ABSATZ);
  });
});

// ================================================================================================
// A4 · UNTER DEM BUDGET WIRD NICHTS BESCHNITTEN — UND NICHTS BEHAUPTET.
// ================================================================================================

describe("JOB 4085 · A4 · eine grosse, aber tragbare Auswahl kommt vollständig an", () => {
  it("A4: knapp unter dem Budget reisen die Bilder mit, der Satz trägt keine Bilanz", async () => {
    const auswahl = await echteWordAuswahl();
    const { app, admin, id, cookie, me } = await buehne();
    const version = (await stand(app, admin, id)).version;
    const gefuellt = knappUnterBudget(auswahl.html, auswahl.text.trim(), version);

    const { p, buch } = await fensterAnDerEchtenRoute(
      app,
      cookie,
      me,
      id,
      "Ventil X schließt bei Überdruck",
      auswahl.text,
      gefuellt,
    );
    p.q("#rw-btn")?.click();
    await p.flush();

    // Nichts ging verloren — also steht auch kein Satz darüber da. `bilderText` liefert "".
    expect(p.text("#rw-status")).toBe(p.t("rwEingereicht"));

    const put = derEinePut(buch);
    // Wirklich gross: sonst wäre das hier nur A1 mit anderem Namen.
    expect(put.bytes).toBeGreaterThan(BUDGET_BYTES - 8192);
    expect(put.bytes).toBeLessThanOrEqual(BUDGET_BYTES);
    expect(put.status, "eine Nutzlast knapp unter dem Budget muss die Route nehmen").toBe(200);
    expect(put.bodyHtml).toContain("<img");

    const vorschlag = await offenerVorschlag(app, admin, id);
    const nachher = await uebernehmen(app, admin, id, vorschlag.id);
    const rumpf = nachher.bodyHtml ?? "";
    for (const quelle of auswahl.bildQuellen) {
      expect(rumpf, "ein Bild der echten Word-Datei fehlt im Fließtext des Eintrags").toContain(
        quelle,
      );
    }
  });
});

// ================================================================================================
// A5 · DIE ZAHL DES BEFUNDS — 1.520.700 BYTES BILDLAST GEHEN DURCH (JOB 4115).
// ================================================================================================
//
// WARUM DIESER FALL DAZUKOMMT, obwohl A1–A4 grün waren: sie alle messen gegen ein Budget, das der
// Rückweg SELBST errechnet. Genau deshalb waren sie auch mit der 1-MiB-Vorgabe der Route grün — das
// Fenster schnitt eben vorher weg. Der Mensch bekam trotzdem nicht, was er markiert hatte. Der
// Prüfer zu JOB 4085 hat das wörtlich bestellt (`LEHREN.md:5236`): „Fahre mindestens einen
// Bildkörper oberhalb 1 MiB, aber unterhalb des Add-in-Budgets, sowie einen beschneidungs-
// bedürftigen Körper. Miss Erfolg, Persistenz und Bilanz gemeinsam; eine gemockte 200-Antwort
// genügt nicht." Der beschneidungsbedürftige Körper ist A2/A3; hier steht der andere.
//
// DIE ZAHL IST NICHT GEWÄHLT, SIE IST GEMESSEN: 1.520.700 Bytes ist der Körper, den der Prüfer zu
// JOB 4085 Runde 1 abgesetzt hat und der als `413 FST_ERR_CTP_BODY_TOO_LARGE` zurückkam
// (`rueckweg.js`, Kopf über `RW_ROUTE_BODY_LIMIT_BYTES`). Sie liegt über 1 MiB (der alten
// Routengrenze) und unter dem Fensterbudget — also in genau dem Band, in dem nichts beschnitten
// wird und der Server trotzdem ablehnte.
//
// UND ES IST WIRKLICH BILDLAST: die zwei echten Bilder der Bestandsdatei reisen so oft mit, bis die
// reine Bildmenge 1 MiB übersteigt — so sieht ein Word-Absatz mit mehreren Fotos aus. Der Rest bis
// zur Zahl des Befunds ist Fülltext, und das steht hier, statt „ein Absatz mit einem Handyfoto" zu
// behaupten: die Bestandsdatei trägt kleine PNG, ein einzelnes Foto wäre eine erfundene Vorlage.

/** Die gemessene Nutzlast aus dem Befund zu JOB 4085 Runde 1 — auf das Byte. */
const BEFUND_BYTES = 1_520_700;

/** Die zwei echten Bildmarken, wiederholt, bis die reine Bildlast über 1 MiB liegt. */
function bildlastUeberEinemMiB(auswahl: WordAuswahl): string {
  expect(auswahl.bildMarken.length, "die echte Auswahl trägt keine Bilder").toBeGreaterThan(0);
  const eineRunde = auswahl.bildMarken.join("");
  let html = "";
  while (new TextEncoder().encode(html).length <= 1024 * 1024) {
    html += eineRunde;
  }
  return html;
}

/** Ein `propose`-Rumpf von GENAU `BEFUND_BYTES` Nutzlast, dessen Bildanteil über 1 MiB liegt. */
function rumpfMitDerBildlastDesBefunds(
  auswahl: WordAuswahl,
  aussage: string,
  version: number,
): string {
  const bilder = bildlastUeberEinemMiB(auswahl);
  const fest = `<p>${MARKIERTER_ABSATZ}</p>${bilder}`;
  const grundlast = nutzlastBytes(`<p></p>${fest}`, aussage, version);
  const luecke = BEFUND_BYTES - grundlast;
  expect(luecke, "die Bildlast allein sprengt schon die Zahl des Befunds").toBeGreaterThan(0);
  return `<p>${"a".repeat(luecke)}</p>${fest}`;
}

describe("JOB 4115 · A5 · eine Bildlast über 1 MiB kommt vollständig an", () => {
  it("A5a: der Körper des Befunds (1.520.700 Bytes, Bildanteil über 1 MiB) wird von der ECHTEN Route angenommen und steht danach vollständig im Eintrag", async () => {
    const auswahl = await echteWordAuswahl();
    // Dieselbe Bühne wie A2–A4: das einreichende Konto ist NICHT der Autor — ein Vorschlag auf das
    // eigene Objekt wäre `PROPOSAL_OWN` (403) und damit ein Fall über etwas anderes.
    const { app, admin, id, cookie } = await buehne();
    const version = (await stand(app, admin, id)).version;
    const aussage = auswahl.text.trim();
    const koerper = JSON.stringify({
      action: "propose",
      proposal: {
        statement: aussage,
        bodyHtml: rumpfMitDerBildlastDesBefunds(auswahl, aussage, version),
        baseVersion: version,
        origin: "word_addin",
      },
    });
    // Die Zahl des Befunds, auf das Byte — sonst redet dieser Fall über eine andere Last.
    expect(new TextEncoder().encode(koerper).length).toBe(BEFUND_BYTES);
    expect(BEFUND_BYTES).toBeGreaterThan(1024 * 1024);

    const antwort = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: { cookie, "content-type": "application/json" },
      payload: koerper,
    });
    // BIS JOB 4115: `413 FST_ERR_CTP_BODY_TOO_LARGE`. Der Mensch las „Einreichen fehlgeschlagen".
    expect(
      antwort.statusCode,
      "die Route nimmt die gemessene Bildlast des Befunds nicht an — die Annahmegrenze ist zu schmal",
    ).toBe(200);

    // GESPEICHERT und VOLLSTÄNDIG, am zurückgelesenen Objekt gemessen — nicht am Aufruf.
    const vorschlag = await offenerVorschlag(app, admin, id);
    const nachher = await uebernehmen(app, admin, id, vorschlag.id);
    const rumpf = nachher.bodyHtml ?? "";
    for (const quelle of auswahl.bildQuellen) {
      expect(rumpf, "ein Bild der echten Word-Datei fehlt nach der Übernahme im Eintrag").toContain(
        quelle,
      );
    }
    expect(rumpf).toContain(MARKIERTER_ABSATZ);
  });

  it("A5b: dieselbe Last durch das AUSGELIEFERTE Fenster — nichts wird beschnitten, und der Satz trägt keine Bilanz", async () => {
    const auswahl = await echteWordAuswahl();
    const { app, admin, id, cookie, me } = await buehne();
    const version = (await stand(app, admin, id)).version;
    const aussage = auswahl.text.trim();
    const gefuellt = rumpfMitDerBildlastDesBefunds(auswahl, aussage, version);

    const { p, buch } = await fensterAnDerEchtenRoute(
      app,
      cookie,
      me,
      id,
      "Ventil X schließt bei Überdruck",
      auswahl.text,
      gefuellt,
    );
    p.q("#rw-btn")?.click();
    await p.flush();

    // DER SICHTBARE BEWEIS DER REPARATUR: kein Bilanzsatz. Bis JOB 4115 stand hier „2 von … Bildern
    // konnten nicht übernommen werden" — ehrlich, aber unnötig: die Last passt.
    expect(p.text("#rw-status")).toBe(p.t("rwEingereicht"));

    const put = derEinePut(buch);
    expect(put.bytes, "das Fenster hat die Last beschnitten — sie passt aber").toBeGreaterThan(
      1024 * 1024,
    );
    expect(put.bytes).toBeLessThanOrEqual(BUDGET_BYTES);
    expect(put.status, "die echte Route hat die Bildlast nicht angenommen").toBe(200);
    expect(put.bodyHtml).toContain("<img");

    const vorschlag = await offenerVorschlag(app, admin, id);
    const nachher = await uebernehmen(app, admin, id, vorschlag.id);
    const rumpf = nachher.bodyHtml ?? "";
    for (const quelle of auswahl.bildQuellen) {
      expect(rumpf, "ein Bild der echten Word-Datei fehlt im Fließtext des Eintrags").toContain(
        quelle,
      );
    }
  });
});
