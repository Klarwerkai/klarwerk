// @vitest-environment jsdom
// ================================================================================================
// JOB 1571 · D1 · KA2 — DER BESTANDSBLICK-VERTRAG, AM AUSGELIEFERTEN FENSTER AUSGEFUEHRT.
// ================================================================================================
//
// WARUM DIESE DATEI EXISTIERT. KA3 ist seit JOB 1151 gebaut und konsumiert
// `window.klaraBestandsblick(grund)`. Vor diesem Durchgang erzeugte den Vertrag NIEMAND im Baum —
// gemessen: zwei Vorkommen in `taskpane.html`, beide im KA3-Block, beide lesend. KA3 lief deshalb
// fail-closed ins Leere: kein Fehler, keine Karte, kein Hinweis. Genau diese Klasse von Schaden —
// zwei richtig gebaute Haelften, die sich nicht beruehren — faellt keinem Test auf, der die
// Haelften einzeln prueft.
//
// DESHALB MISST DIESE DATEI DIE NAHT, NICHT DIE HAELFTEN: sie laedt `taskpane.html` als Ganzes in
// jsdom, fuehrt das vollstaendige Inline-Skript aus (`new Function(skript)()` — derselbe Weg wie
// `tests/app/w1-klara-lifecycle-taskpane.test.tsx`) und ruft danach den Vertrag so, wie KA3 ihn
// ruft. Kein Block wird herausgeschnitten, keine Funktion einzeln gegriffen.
//
// DIE VIER FRAGEN, die hier beantwortet werden:
//   1. Steht der Vertrag ueberhaupt, und hat er GENAU die Form, die KA3 normalisiert?
//   2. Kommt die Frage aus dem KA1-Begriffsbild — und nicht aus einer zweiten, eigenen Suche?
//   3. Bleibt der Abruf im deterministischen Pfad, also ohne Modell und ohne neues Abrufziel?
//   4. Ist der Fehlerfall ein LEERER Bestand und nie eine Behauptung?
//
// WARUM DIE FENSTERTYPEN HIER VON HAND STEHEN. Der Wurzel-`tsconfig.json` haelt `tests` node-rein
// (`lib: ["ES2022"]`); die DOM-Typen haengen an `tsconfig.tests-tsx.json`, also an der Endung
// `.tsx`. Diese Datei montiert kein React-Bauteil und bleibt `.ts`. Ein
// `/// <reference lib="dom" />` waere der bequeme Weg — er ist AUSPROBIERT UND VERWORFEN: er
// schaltet die DOM-Bibliothek fuer den GANZEN Lauf zu und deutet damit `setTimeout` in
// `services/app/src/trash-sweep-scheduler.ts` von `Timeout` auf `number` um. Eine Testdatei darf
// den Typenstand des Produktcodes nicht verschieben. Deshalb: genau die Handvoll Fensterteile,
// die hier wirklich angefasst werden, lokal beschrieben — mehr nicht.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const TASKPANE = "apps/web/public/word-addin/taskpane.html";
const HTML = readFileSync(resolve(process.cwd(), TASKPANE), "utf8");

/** Die Form, auf die KA3 den Vertrag normalisiert (`ka3Normalisieren`). */
interface Treffer {
  id: string;
  title: string;
  status: string | null;
}

/** Nur das, was diese Datei am Element wirklich anfasst. */
interface TestElement {
  className: string;
  textContent: string | null;
  querySelectorAll(auswahl: string): { length: number };
}

interface TestDocument {
  body: { innerHTML: string };
  getElementById(id: string): TestElement | null;
}

interface TestWindow {
  fetch?: unknown;
  Word?: unknown;
  Office?: unknown;
  klaraBestandsblick?: unknown;
}

const fenster = globalThis as unknown as { window: TestWindow; document: TestDocument };

/** Ein abgesetzter Abruf, so wie das Fenster ihn wirklich gestellt hat. */
interface Aufruf {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
}

let aufrufe: Aufruf[] = [];

/** Der Dokumenttext, aus dem KA1 sein Begriffsbild gewinnt. */
const DOKUMENT =
  "Die Homeoffice-Regelung des Unternehmens beschreibt die Anwesenheitspflicht " +
  "und die Erstattung der Reisekosten fuer Aussendienstmitarbeiter.";

/**
 * Was der Server auf `/api/ask` antworten soll. `null` heisst: harter Fehlschlag (HTTP 500) —
 * der Fall, in dem KA2 nichts behaupten darf.
 */
let askAntwort: { sources: string[] } | null = { sources: ["ko-1", "ko-2"] };

/** Was `/api/kos/:id` liefert. Ein hier fehlender Schluessel ist ein nicht ladbares KO. */
let kos: Record<string, { title?: string; status?: string }> = {};

function antwort(koerper: unknown, status = 200): unknown {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: () => Promise.resolve(koerper),
  };
}

function fetchAttrappe(url: string, init?: Record<string, unknown>): Promise<unknown> {
  const kopf = (init?.headers ?? {}) as Record<string, string>;
  aufrufe.push({
    url,
    method: String(init?.method ?? "GET"),
    headers: kopf,
    body: typeof init?.body === "string" ? init.body : null,
  });

  if (url === "/api/ask") {
    if (askAntwort === null) {
      return Promise.resolve(antwort({ error: "BOOM" }, 500));
    }
    return Promise.resolve(
      antwort({
        result: {
          answered: true,
          answer: "Dazu liegt bereits eine Betriebsvereinbarung vor.",
          sources: askAntwort.sources,
          trust: 0.9,
        },
      }),
    );
  }

  if (url.startsWith("/api/kos/")) {
    const id = decodeURIComponent(url.slice("/api/kos/".length));
    const ko = kos[id];
    if (!ko) {
      return Promise.resolve(antwort({ error: "NOT_FOUND" }, 404));
    }
    return Promise.resolve(antwort({ id, ...ko }));
  }

  // Alle uebrigen Anlaufstellen des Fensters (Anmeldung, Sitzung, KI-Lage) sind fuer diesen
  // Durchgang ohne Belang — sie antworten neutral, damit der Ladevorgang nicht an ihnen haengt.
  return Promise.resolve(antwort({}));
}

/** Alle anstehenden Mikrotasks abarbeiten lassen. */
async function leerlauf(runden = 12): Promise<void> {
  for (let i = 0; i < runden; i += 1) {
    await Promise.resolve();
    await new Promise((r) => process.nextTick(r));
  }
}

/**
 * Die Word-Attrappe fuer den Ganzes-Dokument-Weg (`readWholeDocument`: body.load("text") +
 * body.getHtml() in EINEM context.sync-Batch). Sie zaehlt mit, wie oft das Dokument gelesen wurde
 * — die Groesse, an der sich „kein zweiter Office-Schnappschuss" messen laesst.
 */
let dokumentLesungen = 0;

function wordEinbauen(text: string): void {
  fenster.window.Word = {
    run: (fn: (ctx: unknown) => unknown) => {
      dokumentLesungen += 1;
      const body = {
        text,
        load: () => undefined,
        getHtml: () => ({ value: `<p>${text}</p>` }),
      };
      const context = { document: { body }, sync: () => Promise.resolve() };
      return Promise.resolve(fn(context));
    },
  };
}

/**
 * Das Fenster laden und das vollstaendige Inline-Skript ausfuehren. Genau der Weg, den der
 * bestehende KA3-Pruefstand nimmt — es wird nichts herausgeschnitten.
 */
async function ladePanel(): Promise<void> {
  const skriptStart = HTML.lastIndexOf("<script>");
  const skriptEnde = HTML.lastIndexOf("</script>");
  expect(skriptStart, `${TASKPANE}: Inline-Skript nicht gefunden`).toBeGreaterThan(0);
  const skript = HTML.slice(skriptStart + "<script>".length, skriptEnde);

  const bodyStart = HTML.indexOf("<body>");
  expect(bodyStart, `${TASKPANE}: <body> nicht gefunden`).toBeGreaterThan(0);
  const markup = HTML.slice(bodyStart + "<body>".length, skriptStart);
  // Fail-closed: waere das Markup leer, pruefte diese Datei ein leeres Dokument.
  expect(markup.length, `${TASKPANE}: Markup ist leer`).toBeGreaterThan(2000);
  fenster.document.body.innerHTML = markup;

  new Function(skript)();
  await leerlauf();
}

/** Den Vertrag so rufen, wie KA3 ihn ruft. */
function vertrag(): (grund: string) => Promise<{ treffer: Treffer[] }> {
  const gestellt = fenster.window.klaraBestandsblick;
  expect(
    typeof gestellt,
    "window.klaraBestandsblick ist nicht gestellt — KA3 greift ins Leere",
  ).toBe("function");
  return gestellt as (grund: string) => Promise<{ treffer: Treffer[] }>;
}

/** Die Abrufe, die seit dem letzten Zuruecksetzen hinausgegangen sind. */
function seitdem(praefix: string): Aufruf[] {
  return aufrufe.filter((a) => a.url === praefix || a.url.startsWith(praefix));
}

beforeEach(() => {
  aufrufe = [];
  dokumentLesungen = 0;
  askAntwort = { sources: ["ko-1", "ko-2"] };
  kos = {
    "ko-1": { title: "Betriebsvereinbarung Homeoffice", status: "validiert" },
    "ko-2": { title: "Reisekostenrichtlinie", status: "offen" },
  };
  fenster.window.fetch = fetchAttrappe;
  fenster.window.klaraBestandsblick = undefined;
  fenster.window.Word = undefined;
  fenster.window.Office = undefined;
});

afterEach(() => {
  fenster.document.body.innerHTML = "";
  fenster.window.Word = undefined;
  fenster.window.klaraBestandsblick = undefined;
});

// ================================================================================================
// FRAGE 1 — STEHT DER VERTRAG, UND HAT ER DIE FORM, DIE KA3 ERWARTET?
// ================================================================================================
describe("JOB 1571 KA2: der Vertrag steht und hat die vereinbarte Form", () => {
  it("nach dem Laden ist window.klaraBestandsblick eine Funktion", async () => {
    await ladePanel();
    expect(
      typeof fenster.window.klaraBestandsblick,
      "Der Vertrag fehlt — genau der Zustand, in dem KA3 seit JOB 1151 wirkungslos war",
    ).toBe("function");
  });

  it("er liefert ein Versprechen auf { treffer: [...] } mit id, title und status", async () => {
    wordEinbauen(DOKUMENT);
    await ladePanel();

    const ergebnis = await vertrag()("oeffnen");

    expect(Array.isArray(ergebnis.treffer), "treffer ist keine Liste").toBe(true);
    expect(ergebnis.treffer.length, "Der Bestand kam leer zurueck").toBeGreaterThan(0);

    for (const t of ergebnis.treffer) {
      // GENAU die drei Felder, die `ka3Normalisieren` liest — nicht mehr, nicht weniger.
      expect(Object.keys(t).sort(), "Die Trefferform weicht vom Vertrag ab").toEqual([
        "id",
        "status",
        "title",
      ]);
      expect(typeof t.id).toBe("string");
      expect(t.id.length).toBeGreaterThan(0);
      expect(typeof t.title).toBe("string");
    }
  });

  it("der Status kommt aus dem VORHANDENEN Vokabular der Quellen-Ampel", async () => {
    wordEinbauen(DOKUMENT);
    await ladePanel();

    const ergebnis = await vertrag()("oeffnen");
    const erlaubt = ["validiert", "pruefung", "offen", "unknown"];
    for (const t of ergebnis.treffer) {
      expect(
        t.status === null || erlaubt.indexOf(String(t.status)) !== -1,
        `Unbekanntes Statuswort ${String(t.status)} — KA3 zeichnet dafuer keine Pille`,
      ).toBe(true);
    }
    // Das validierte KO traegt seinen Status wirklich, nicht nur formal ein Feld.
    const eins = ergebnis.treffer.filter((t) => t.id === "ko-1")[0];
    expect(eins?.status, "Der validierte Bestand wird nicht als validiert gemeldet").toBe(
      "validiert",
    );
  });

  it("ein KO ohne ladbaren Titel zeigt ehrlich seine Id statt eines erfundenen Namens", async () => {
    kos = { "ko-1": { title: "Betriebsvereinbarung Homeoffice", status: "validiert" } };
    wordEinbauen(DOKUMENT);
    await ladePanel();

    const ergebnis = await vertrag()("oeffnen");
    const zwei = ergebnis.treffer.filter((t) => t.id === "ko-2")[0];
    expect(zwei, "Das nicht ladbare KO fiel ganz weg statt ehrlich dazustehen").toBeTruthy();
    expect(zwei?.title, "Fuer ein nicht ladbares KO wurde ein Titel behauptet").toBe("ko-2");
  });
});

// ================================================================================================
// FRAGE 2 — KOMMT DIE FRAGE AUS DEM KA1-BEGRIFFSBILD?
// ================================================================================================
describe("JOB 1571 KA2: gefragt wird mit den KA1-Begriffen, nicht mit einer zweiten Suche", () => {
  it("die abgesetzte Frage traegt Begriffe des Dokuments", async () => {
    wordEinbauen(DOKUMENT);
    await ladePanel();
    aufrufe = [];

    await vertrag()("tastenruhe");

    const ask = seitdem("/api/ask");
    expect(ask.length, "Es ging keine Frage hinaus").toBe(1);
    const koerper = JSON.parse(String(ask[0]?.body ?? "{}")) as { question?: string };
    const frage = String(koerper.question ?? "").toLowerCase();
    expect(frage.length, "Die Frage war leer").toBeGreaterThan(0);

    // KA1 bildet GRUNDFORMEN, keine Wortformen: aus „Homeoffice-Regelung" wird `homeoffic regel`,
    // aus „Reisekosten" wird `reiseko`. Diese Datei baut die Tokenisierung ausdruecklich NICHT
    // nach — sonst pruefte sie ihre eigene Kopie statt der ausgelieferten. Geprueft wird die
    // Eigenschaft, auf die es ankommt: jeder Begriff der Frage ist der ANFANG eines Wortes, das
    // im Dokument wirklich steht. Damit ist ausgeschlossen, dass die Frage etwas mitbringt, was
    // nicht aus dem Dokument stammt.
    const woerter = DOKUMENT.toLowerCase()
      .split(/[^a-zäöüß]+/)
      .filter((w) => w.length > 0);
    const begriffe = frage.split(" ").filter((b) => b.length > 0);
    expect(begriffe.length, "Die Frage besteht aus keinem einzigen Begriff").toBeGreaterThan(2);
    for (const b of begriffe) {
      expect(
        woerter.some((w) => w.indexOf(b) === 0),
        `Der Begriff ${b} steht so in keinem Wort des Dokuments — Frage: ${frage}`,
      ).toBe(true);
    }
    // Und der Anker, an dem Pedis Homeoffice-Beispiel haengt, ist wirklich dabei.
    expect(
      begriffe.some((b) => "homeoffice".indexOf(b) === 0),
      `Der Leitbegriff des Dokuments fehlt in der Frage: ${frage}`,
    ).toBe(true);
  });

  it("ohne offenes Dokument wird GAR NICHT gefragt — kein Abruf ins Blaue", async () => {
    // Kein Word: KA1 hat kein Begriffsbild, also hat KA2 nichts zu fragen.
    await ladePanel();
    aufrufe = [];

    const ergebnis = await vertrag()("oeffnen");

    expect(ergebnis.treffer, "Ohne Begriffe wurde ein Bestand behauptet").toEqual([]);
    expect(seitdem("/api/ask").length, "Ohne Begriffe ging trotzdem eine Frage hinaus").toBe(0);
  });

  it("der Bestandsblick liest das Dokument NICHT ein zweites Mal", async () => {
    wordEinbauen(DOKUMENT);
    await ladePanel();
    const nachLaden = dokumentLesungen;

    await vertrag()("tastenruhe");
    await vertrag()("tastenruhe");

    expect(
      dokumentLesungen,
      "KA2 hat einen eigenen Office-Schnappschuss geholt statt KA1s Begriffsbild zu lesen",
    ).toBe(nachLaden);
  });
});

// ================================================================================================
// FRAGE 3 — BLEIBT DER ABRUF IM DETERMINISTISCHEN PFAD?
// ================================================================================================
describe("JOB 1571 KA2: die Enge des Abrufs ist erzwungen, nicht beabsichtigt", () => {
  it("der Rumpf traegt mode: retrieval-only", async () => {
    wordEinbauen(DOKUMENT);
    await ladePanel();
    aufrufe = [];

    await vertrag()("oeffnen");

    const koerper = JSON.parse(String(seitdem("/api/ask")[0]?.body ?? "{}")) as { mode?: string };
    expect(koerper.mode, "Der Bestandsblick bittet nicht um den engen Pfad").toBe("retrieval-only");
  });

  it("er schickt KEINE Bindungs-Kopfzeilen — sonst koennte eine KA4-Einwilligung greifen", async () => {
    // DAS IST DER RIEGEL. `ask-routes.ts` hebt `validatedOnly`/`retrievalOnly` auf, wenn zu
    // Sitzung UND Dokument eine Einwilligung vorliegt — gefunden wird sie ausschliesslich ueber
    // diese drei Kopfzeilen. Der Bestandsblick laeuft ungefragt und wiederholt; was der Anwender
    // fuer seine eigene Frage erlaubt hat, hat er fuer diesen Hintergrundvorgang nicht erlaubt.
    wordEinbauen(DOKUMENT);
    await ladePanel();
    aufrufe = [];

    await vertrag()("tastenruhe");

    const ask = seitdem("/api/ask")[0];
    expect(ask, "Es ging keine Frage hinaus").toBeTruthy();
    const namen = Object.keys(ask?.headers ?? {}).map((n) => n.toLowerCase());
    for (const gesperrt of ["x-klara-session", "x-klara-instance", "x-klara-document"]) {
      expect(
        namen.indexOf(gesperrt),
        `Der Bestandsblick traegt ${gesperrt} — damit ist der Modellweg wieder erreichbar`,
      ).toBe(-1);
    }
  });

  it("er benutzt KEIN neues Abrufziel — nur die beiden bestehenden", async () => {
    wordEinbauen(DOKUMENT);
    await ladePanel();
    aufrufe = [];

    await vertrag()("oeffnen");

    for (const a of aufrufe) {
      expect(
        a.url === "/api/ask" || a.url.startsWith("/api/kos/"),
        `Neues Abrufziel aus dem Bestandsblick: ${a.url}`,
      ).toBe(true);
    }
    expect(aufrufe.length, "Der Bestandsblick hat gar nichts abgerufen").toBeGreaterThan(0);
  });
});

// ================================================================================================
// FRAGE 4 — IST DER FEHLERFALL EIN LEERER BESTAND?
// ================================================================================================
describe("JOB 1571 KA2: ein Fehlschlag ist ein leerer Bestand, nie eine Behauptung", () => {
  it("ein Serverfehler loest zu { treffer: [] } auf und wirft nicht", async () => {
    askAntwort = null;
    wordEinbauen(DOKUMENT);
    await ladePanel();

    // KA3 faengt zwar ab — aber ein Vertrag, der wirft, ist trotzdem der falsche Vertrag.
    const ergebnis = await vertrag()("oeffnen");
    expect(ergebnis.treffer, "Aus einem Serverfehler wurde ein Bestand").toEqual([]);
  });

  it("eine Antwort ohne Quellen ist kein Bestand", async () => {
    askAntwort = { sources: [] };
    wordEinbauen(DOKUMENT);
    await ladePanel();

    const ergebnis = await vertrag()("tastenruhe");
    expect(ergebnis.treffer, "Eine unbelegte Antwort wurde als Bestand ausgegeben").toEqual([]);
  });
});

// ================================================================================================
// DIE NAHT — KA3 BEKOMMT DURCH DIESEN VERTRAG WIRKLICH SEINE KARTE
// ================================================================================================
describe("JOB 1571 KA2: die Naht zu KA3 traegt", () => {
  // ==============================================================================================
  // JOB 1571 D3 — REGEL A: DAS PANEL BESITZT DEN NAMEN. AUCH GEGEN EINEN VORHANDENEN HALTER.
  // ==============================================================================================
  //
  // Dieser Fall stand hier als sein GEGENTEIL: „ein bereits gestellter Vertrag wird NICHT
  // verdraengt". Er sicherte damit Regel B zu — und BASIC2 hat seine Schwaeche selbst notiert:
  // „durch die Rot-Gegenprobe NICHT geeicht … Nimmt man den KA2-Block weg, bleibt er gruen".
  //
  // Der Chef hat am 21.08. um 15:00 Regel A entschieden
  // (`00_CONTROL/ENTSCHEIDUNGEN/JOB-1571-KA2-EIGENTUEMERREGEL.md`):
  //   „Ein Vertrag, der unter Umstaenden nicht gilt, ist kein Vertrag."
  //
  // Der Fall ist deshalb umgedreht, nicht entfernt — und er ist jetzt EICHBAR: nimmt man die
  // Zuweisung im Panel weg, bleibt der fremde Halter stehen und dieser Fall wird ROT. Damit
  // beweist er die Eigenschaft gegen ihre eigene Abwesenheit, was die Vorfassung ausdruecklich
  // nicht konnte.
  it("ein bereits gestellter Vertrag WIRD verdraengt — das Panel besitzt den Namen", async () => {
    const fremder = () => Promise.resolve({ treffer: [] as Treffer[] });
    fenster.window.klaraBestandsblick = fremder;

    await ladePanel();

    expect(
      fenster.window.klaraBestandsblick,
      "Regel A verlangt die unbedingte Zuweisung — der fremde Halter steht noch",
    ).not.toBe(fremder);
    expect(
      typeof fenster.window.klaraBestandsblick,
      "nach dem Laden muss der Vertrag eine Funktion sein",
    ).toBe("function");
  });

  it("KA3 zeichnet aus diesem Vertrag eine Karte mit Status", async () => {
    wordEinbauen(DOKUMENT);
    await ladePanel();
    // KA3 ruft beim Oeffnen selbst; ihm Zeit geben, das Ergebnis zu zeichnen.
    await leerlauf(20);

    const karte = fenster.document.getElementById("ka3-karten");
    expect(karte, "KA3 hat trotz gestelltem Vertrag keine Karte angelegt").not.toBeNull();
    expect(
      karte?.className.indexOf("hidden"),
      "Die Karte blieb verborgen — die Naht traegt nicht",
    ).toBe(-1);
    const text = karte?.textContent ?? "";
    expect(text, "Der Bestand steht nicht in der Karte").toContain(
      "Betriebsvereinbarung Homeoffice",
    );
    const pillen = karte?.querySelectorAll(".src-badge") ?? { length: 0 };
    expect(pillen.length, "Die Karte zeigt keinen Status").toBeGreaterThan(0);
  });
});
