// @vitest-environment jsdom
// ================================================================================================
// KLARA-OFFICE-02 · DAS WORD-FENSTER ALS OFFICE-ADAPTER (`word-addin/begleiter.js`).
// ================================================================================================
//
// WAS HIER LÄUFT: die ausgelieferte Datei `apps/web/public/word-addin/begleiter.js`, unverändert,
// über der echten Einstellungszeile, gegen eine Office-/Word-Attrappe und einen aufgezeichneten
// Server. WAS NICHT LÄUFT: echtes Word. Die Attrappe bildet nur die Aufrufe nach, die der Block
// benutzt (`diagnostics`, `document.url`, `DocumentSelectionChanged`, `Word.run` mit
// `getSelection()`, `track`, `compareLocationWith` und `insertText(…, "After")` am bestätigten
// Bereich). Bereiche tragen eine STELLE, damit gleicher Text an anderer Stelle unterscheidbar ist.
// Die Hostabnahme in Word für Mac und Word im Web ist ein eigener, menschlicher Schritt
// (docs/operations/klara-office/) — ob echtes Word die Ereignisfolge so liefert, zeigt nur sie.
//
//   A1  Aus: ohne bewusstes Einschalten geht NICHTS an den Server.
//   A2  KO-02-05 · Ein: Anmeldung mit Host und Hostfassung aus Office, Dateiname, Prüfsumme der
//       Adresse — die Adresse selbst verlässt Word nicht.
//   A3  KO-02-05 · Auswahl: jede Änderung erhöht den Auswahlstand und geht hinaus.
//   A4  KO-02-05 · Rückweg Einfügen: nur bei unverändertem Auswahlstand, hinter die Markierung.
//   A5  KO-02-05 · Rückweg Frage: über das Fragefeld DIESES Fensters; die angezeigte Antwort geht
//       als Ergebnis zurück.
//   A6  KO-02-07 · Wiederverbindung nach 404 (Server vergessen) und ehrlicher Anmeldehinweis bei 401.
//   A7  Aus und Schliessen: abmelden, danach keine Meldung mehr.
import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { repoPfad } from "../support/repoPfad";

const g = globalThis as unknown as Record<string, unknown>;
const URL_DOKUMENT = "https://contoso-my.sharepoint.com/personal/erik/Documents/Angebot%20Q3.docx";
const VERBUNDEN = "Verbunden · Begleitapp sieht dieses Fenster.";

interface Aufruf {
  methode: string;
  pfad: string;
  rumpf: Record<string, unknown> | null;
  keepalive: boolean;
}

interface Ergebnis {
  id: string;
  stand: string;
  ergebnis: string | null;
  grund: string | null;
}

let aufrufe: Aufruf[] = [];
/** Was der aufgezeichnete Server auf die NÄCHSTEN Meldungen antwortet (Status, Aufträge). */
let naechsteMeldung: Array<{ status: number; aktionen?: unknown[] }> = [];
let anmeldeStatus = 201;
/**
 * Die Markierung in der Attrappe: POSITION (`ort`) und Text. Zwei Markierungen mit gleichem Text an
 * verschiedenen Stellen sind verschiedene Bereiche — genau das, was Ben am Einfügen geprüft hat.
 */
let markierung = { ort: "absatz-0", text: "" };
let auswahlHandler: (() => void) | null = null;
/** Was eingefügt wurde — samt der Stelle (`bereich`), an der es landete. */
const eingefuegt: Array<{ text: string; ort: string; bereich: string }> = [];
/**
 * Verfolgte Bereiche, wie Word sie hält. `track()` zählt sofort; `untrack()` ist erst mit dem
 * nächsten abgeschlossenen `context.sync()` wirksam — wie in Office.js, wo beides in die Warteschlange
 * des Kontexts geht. Eine Freigabe ohne `sync()` bliebe also sichtbar liegen.
 */
let verfolgt = 0;
let ausstehendeFreigaben = 0;
/** Hält jedes `context.sync()` an, bis der Fall es freigibt — für verspätete Leseergebnisse. */
let sperre: Promise<void> | null = null;

function sperren(): () => void {
  let freigeben = (): void => {};
  sperre = new Promise<void>((r) => {
    freigeben = r;
  });
  return () => {
    sperre = null;
    freigeben();
  };
}

async function sync(): Promise<void> {
  if (sperre) {
    await sperre;
  }
  verfolgt -= ausstehendeFreigaben;
  ausstehendeFreigaben = 0;
}

function antwort(status: number, daten: unknown): Response {
  return new Response(JSON.stringify(daten), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function serverAttrappe(pfad: string, init?: RequestInit): Promise<Response> {
  const methode = (init?.method ?? "GET").toUpperCase();
  const roh = typeof init?.body === "string" ? init.body : null;
  const rumpf = roh === null ? null : (JSON.parse(roh) as Record<string, unknown>);
  aufrufe.push({ methode, pfad, rumpf, keepalive: init?.keepalive === true });
  if (methode === "POST" && pfad === "/api/me/klara/begleiter/adapter") {
    return antwort(anmeldeStatus, anmeldeStatus === 201 ? { aktivMs: 12000 } : { error: "x" });
  }
  if (methode === "PUT") {
    const naechste = naechsteMeldung.shift() ?? { status: 200 };
    return antwort(naechste.status, { aktionen: naechste.aktionen ?? [] });
  }
  return antwort(200, { abgemeldet: true });
}

function officeAttrappe(): void {
  g.Office = {
    context: {
      diagnostics: { platform: "Mac", version: "16.89" },
      document: {
        url: URL_DOKUMENT,
        getSelectedDataAsync: (_art: string, rueckruf: (e: unknown) => void) => {
          rueckruf({ status: "succeeded", value: markierung.text });
        },
        addHandlerAsync: (_ereignis: string, f: () => void) => {
          auswahlHandler = f;
        },
      },
    },
    CoercionType: { Text: "text" },
    AsyncResultStatus: { Succeeded: "succeeded" },
    EventType: { DocumentSelectionChanged: "documentSelectionChanged" },
  };
  g.Word = {
    // `Word.run(batch)` oder `Word.run(verfolgterBereich, batch)` — wie Office.js.
    run: async (a: unknown, b?: (ctx: unknown) => Promise<unknown>) => {
      const batch = (typeof a === "function" ? a : b) as (ctx: unknown) => Promise<unknown>;
      return batch({
        document: { getSelection: () => bereichVon(markierung) },
        sync,
      });
    },
  };
}

interface Bereich {
  ort: string;
  text: string;
  load: (felder: string) => void;
  track: () => void;
  untrack: () => void;
  compareLocationWith: (anderer: Bereich) => { value: string };
  insertText: (text: string, ort: string) => void;
}

/** Ein Office-Bereich der Attrappe: an EINE Stelle gebunden, sein Text wird beim Laden gelesen. */
function bereichVon(stelle: { ort: string; text: string }): Bereich {
  const bereich: Bereich = {
    ort: stelle.ort,
    text: stelle.text,
    load: () => {
      // Der Text eines Bereichs ist der an SEINER Stelle — die Attrappe kennt nur die markierte.
      if (markierung.ort === bereich.ort) {
        bereich.text = markierung.text;
      }
    },
    track: () => {
      verfolgt += 1;
    },
    untrack: () => {
      ausstehendeFreigaben += 1;
    },
    compareLocationWith: (anderer) => ({ value: anderer.ort === bereich.ort ? "Equal" : "Before" }),
    insertText: (text, ort) => {
      eingefuegt.push({ text, ort, bereich: bereich.ort });
    },
  };
  return bereich;
}

function markup(): string {
  return [
    '<div id="kw-einstellungen"><div class="einst-gruppe">',
    '<div class="einst-zeile"><span></span><button id="einst-absatzblick"></button></div>',
    "</div></div>",
    '<textarea id="ask-input"></textarea><button id="ask-btn"></button>',
    '<div id="ask-answer-block" class="hidden"><div id="ask-answer-text"></div></div>',
    '<p id="ask-status"></p><button id="tab-ask"></button>',
  ].join("");
}

function starten(): void {
  document.body.innerHTML = markup();
  g.lang = "de";
  const quelle = readFileSync(repoPfad("apps/web/public/word-addin/begleiter.js"), "utf8");
  // Wie ein klassisches Skript; seine Namen bleiben im Funktionsrumpf — jeder Fall startet frisch.
  new Function(quelle)();
}

const schalter = (): HTMLButtonElement =>
  document.getElementById("einst-begleiter") as HTMLButtonElement;
const lage = (): string => document.getElementById("einst-begleiter-lage")?.textContent ?? "";
const meldungen = (): Aufruf[] => aufrufe.filter((a) => a.methode === "PUT");
const anmeldungen = (): Aufruf[] => aufrufe.filter((a) => a.methode === "POST");
const ergebnisse = (): Ergebnis[] =>
  meldungen().flatMap((m) => (m.rumpf?.erledigt as Ergebnis[] | undefined) ?? []);
const mitAuswahl = (): Aufruf[] =>
  meldungen().filter((m) => m.rumpf?.auswahl !== null && m.rumpf?.auswahl !== undefined);

/** Echte Zeit für Antworten und Verzögerungen; der Takt (setInterval) ist gestellt. */
async function kurz(ms = 20): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

/** Ein Takt des Adapters: Antworten fertig verarbeiten lassen, dann zwei Sekunden vorstellen. */
async function takt(): Promise<void> {
  await kurz();
  vi.advanceTimersByTime(2000);
  await kurz();
}

/** Takte, bis die Bedingung gilt (höchstens 15). */
async function bis(bedingung: () => boolean): Promise<void> {
  for (let i = 0; i < 15 && !bedingung(); i += 1) {
    await takt();
  }
}

async function einschalten(): Promise<void> {
  schalter().click();
  await bis(() => meldungen().length > 0);
  expect(meldungen().length).toBeGreaterThan(0);
}

/** Der höchste Auswahlstand, den der Adapter bisher gemeldet hat (mit oder ohne Auswahl). */
function hoechsterStand(): number {
  return Math.max(
    0,
    ...meldungen().map((m) => {
      const a = m.rumpf?.auswahl as { stand: number } | null | undefined;
      return a ? a.stand : Number(m.rumpf?.auswahlStand ?? 0);
    }),
  );
}

function letzteAuswahl(): { text: string; laenge: number; stand: number } | undefined {
  return mitAuswahl().at(-1)?.rumpf?.auswahl as
    | { text: string; laenge: number; stand: number }
    | undefined;
}

/** Markiert `text` an der Stelle `ort`, löst das Office-Ereignis aus und gibt den Stand zurück. */
async function markieren(text: string, ort = "absatz-1"): Promise<number> {
  const vorher = hoechsterStand();
  markierung = { ort, text };
  auswahlHandler?.();
  // Die Markierung wird nach einer kurzen Ruhe (300 ms) gelesen.
  await kurz(350);
  // Gemeldet werden höchstens 4.000 Zeichen und die volle Länge (A3 prüft die Kürzung selbst) —
  // erkannt wird die neue Markierung deshalb an ihrem Anfang UND ihrer vollen Länge.
  const neu = (): boolean => {
    const a = letzteAuswahl();
    return (a?.stand ?? 0) > vorher && a?.text === text.slice(0, 4000) && a?.laenge === text.length;
  };
  await bis(neu);
  expect(neu()).toBe(true);
  return letzteAuswahl()?.stand ?? 0;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  aufrufe = [];
  naechsteMeldung = [];
  anmeldeStatus = 201;
  markierung = { ort: "absatz-0", text: "" };
  auswahlHandler = null;
  eingefuegt.length = 0;
  verfolgt = 0;
  ausstehendeFreigaben = 0;
  sperre = null;
  if (!(globalThis.crypto && "subtle" in globalThis.crypto)) {
    Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
  }
  officeAttrappe();
  const f = vi.fn((eingabe: RequestInfo | URL, init?: RequestInit) =>
    serverAttrappe(String(eingabe), init),
  );
  g.fetch = f;
  window.fetch = f as unknown as typeof window.fetch;
  starten();
});

afterEach(() => {
  // Jeder Fall trennt seine Verbindung, damit kein früheres Fenster in den nächsten hineinmeldet.
  window.dispatchEvent(new Event("pagehide"));
  vi.clearAllTimers();
  vi.useRealTimers();
  document.body.innerHTML = "";
  for (const name of ["Office", "Word", "lang"]) {
    delete g[name];
  }
});

describe("A1 · aus, bis die Person einschaltet", () => {
  it("ohne Einschalten geht nichts hinaus — auch nicht nach vielen Takten", () => {
    expect(schalter().getAttribute("role")).toBe("switch");
    expect(schalter().getAttribute("aria-checked")).toBe("false");
    expect(lage()).toBe("Nicht verbunden.");
    vi.advanceTimersByTime(30_000);
    expect(aufrufe).toEqual([]);
  });
});

describe("A2 · KO-02-05 — die Anmeldung trägt, was Office liefert", () => {
  it("Host, Fassung, Dateiname und Prüfsumme — die Adresse bleibt in Word", async () => {
    await einschalten();
    expect(schalter().getAttribute("aria-checked")).toBe("true");
    const anmeldung = anmeldungen()[0];
    expect(anmeldung?.pfad).toBe("/api/me/klara/begleiter/adapter");
    expect(anmeldung?.rumpf).toMatchObject({
      host: "word-mac",
      hostFassung: "16.89",
      dokument: { titel: "Angebot Q3.docx", gespeichert: true },
    });
    const instanz = String(anmeldung?.rumpf?.instanz);
    expect(instanz).toMatch(/^bgl-[0-9a-f]{32}$/);
    const dokument = anmeldung?.rumpf?.dokument as { kennung: string };
    const summe = await webcrypto.subtle.digest("SHA-256", new TextEncoder().encode(URL_DOKUMENT));
    const hex = Buffer.from(summe).toString("hex").slice(0, 32);
    expect(dokument.kennung).toBe(`url-${hex}`);
    // Weder Adresse noch Mandant noch Pfad gehen hinaus — an keiner Stelle.
    const alles = JSON.stringify(aufrufe);
    expect(alles).not.toContain("sharepoint");
    expect(alles).not.toContain("personal/erik");
    expect(meldungen()[0]?.pfad).toBe(`/api/me/klara/begleiter/adapter/${instanz}`);
    expect(lage()).toBe(VERBUNDEN);
  });

  it("ein ungespeichertes Dokument meldet sich mit einer Nonce, ohne Titel", async () => {
    (g.Office as { context: { document: { url: string } } }).context.document.url = "";
    await einschalten();
    expect(anmeldungen()[0]?.rumpf?.dokument).toMatchObject({ titel: "", gespeichert: false });
    const kennung = (anmeldungen()[0]?.rumpf?.dokument as { kennung: string }).kennung;
    expect(kennung).toMatch(/^neu-[0-9a-f]{32}$/);
  });
});

describe("A3 · KO-02-05 — die Auswahl geht mit steigendem Stand hinaus", () => {
  it("erst keine Auswahl, nach einer Markierung die Auswahl mit höherem Stand", async () => {
    await einschalten();
    expect(meldungen()[0]?.rumpf).toMatchObject({ seq: 1, auswahl: null });
    const anfang = hoechsterStand();

    const text = "Fiktiver Liefertermin: 3. Werktag.";
    const stand = await markieren(text);
    expect(stand).toBeGreaterThan(anfang);
    expect(letzteAuswahl()).toEqual({ text, laenge: text.length, stand });
    const folgen = meldungen().map((m) => Number(m.rumpf?.seq));
    expect(folgen).toEqual([...folgen].sort((a, b) => a - b));
    expect(new Set(folgen).size).toBe(folgen.length);
  });

  it("eine lange Auswahl wird auf 4.000 Zeichen gekürzt, die volle Länge reist mit", async () => {
    await einschalten();
    await markieren("z".repeat(5000));
    const a = mitAuswahl()[0]?.rumpf?.auswahl as { text: string; laenge: number };
    expect(a.text.length).toBe(4000);
    expect(a.laenge).toBe(5000);
  });
});

describe("A4 · KO-02-05 — Einfügen nur in die unveränderte Markierung", () => {
  it("passender Stand: hinter den bestätigten Bereich; veralteter Stand: abgelehnt", async () => {
    await einschalten();
    const stand = await markieren("Satz.", "absatz-1");
    naechsteMeldung.push({
      status: 200,
      aktionen: [
        { id: "alt", art: "einfuegen", text: "Falsch", auswahlStand: stand - 1 },
        { id: "neu", art: "einfuegen", text: " Ergänzung aus Klara.", auswahlStand: stand },
      ],
    });
    await bis(() => ergebnisse().length >= 2);
    expect(eingefuegt).toEqual([
      { text: " Ergänzung aus Klara.", ort: "After", bereich: "absatz-1" },
    ]);
    expect(ergebnisse()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "alt", stand: "abgelehnt", grund: "auswahl_geaendert" }),
        expect.objectContaining({ id: "neu", stand: "erledigt" }),
      ]),
    );
    // Der Bereich wird verfolgt, solange er gilt.
    expect(verfolgt).toBeGreaterThan(0);
  });

  it("Ben N2 · eine Auswahländerung macht SOFORT ungültig — vor dem verzögerten Lesen", async () => {
    await einschalten();
    const stand = await markieren("Satz.", "absatz-1");
    // Die Person markiert woanders; das Lesen der neuen Markierung steht noch aus (300 ms).
    markierung = { ort: "absatz-7", text: "Anderer Satz." };
    auswahlHandler?.();
    await takt();
    const naechste = meldungen().at(-1)?.rumpf;
    expect(naechste).toMatchObject({ auswahl: null, auswahlStand: stand + 1 });
  });

  it("Ben N2 · gleicher Text an anderer Stelle: der alte Auftrag wird abgelehnt", async () => {
    await einschalten();
    const stand = await markieren("Satz.", "absatz-1");
    // Dieselben Worte, aber eine andere Stelle — das Ereignis kommt, der Text bleibt gleich.
    const neuerStand = await markieren("Satz.", "absatz-9");
    expect(neuerStand).toBeGreaterThan(stand);
    naechsteMeldung.push({
      status: 200,
      aktionen: [
        { id: "alt-stelle", art: "einfuegen", text: " Falsch platziert.", auswahlStand: stand },
      ],
    });
    await bis(() => ergebnisse().length >= 1);
    expect(eingefuegt).toEqual([]);
    expect(ergebnisse()).toEqual([
      expect.objectContaining({ id: "alt-stelle", stand: "abgelehnt", grund: "auswahl_geaendert" }),
    ]);
  });

  it("Ben N2 · Auswahl verschoben, Ereignis noch nicht da: vor dem Schreiben abgelehnt", async () => {
    await einschalten();
    const stand = await markieren("Satz.", "absatz-1");
    // Word hat die Markierung schon bewegt, das Office-Ereignis ist aber noch nicht eingetroffen —
    // der Stand ist unverändert, nur der Lagevergleich mit dem bestätigten Bereich verrät es.
    markierung = { ort: "absatz-4", text: "Satz." };
    naechsteMeldung.push({
      status: 200,
      aktionen: [{ id: "verschoben", art: "einfuegen", text: " Falsch.", auswahlStand: stand }],
    });
    await bis(() => ergebnisse().length >= 1);
    expect(eingefuegt).toEqual([]);
    expect(ergebnisse()).toEqual([
      expect.objectContaining({ id: "verschoben", stand: "abgelehnt", grund: "auswahl_geaendert" }),
    ]);
  });
});

describe("A4b · Ben N4 — kein verfolgter Office-Bereich bleibt ohne Freigabe liegen", () => {
  it("leere Auswahl (beim Verbinden und danach): verfolgt und mit sync() wieder freigegeben", async () => {
    await einschalten();
    // Beim Verbinden ist nichts markiert: gelesen, nicht gebunden, freigegeben.
    await kurz(50);
    expect(verfolgt).toBe(0);
    markierung = { ort: "absatz-3", text: "" };
    auswahlHandler?.();
    await kurz(400);
    expect(verfolgt).toBe(0);
    expect(ausstehendeFreigaben).toBe(0);
  });

  it("viele Cursorwechsel sammeln nichts an — gehalten wird nur die geltende Bindung", async () => {
    await einschalten();
    for (let i = 1; i <= 5; i += 1) {
      await markieren(`Satz ${i}.`, `absatz-${i}`);
      await kurz(50);
      expect(verfolgt).toBe(1);
    }
    markierung = { ort: "absatz-9", text: "" };
    auswahlHandler?.();
    await kurz(400);
    expect(verfolgt).toBe(0);
  });

  it("verspätetes Ergebnis nach Auswahlwechsel: der veraltete Bereich wird freigegeben", async () => {
    await einschalten();
    await markieren("Satz.", "absatz-1");
    const loesen = sperren();
    markierung = { ort: "absatz-2", text: "Zwei." };
    auswahlHandler?.();
    await kurz(350); // Lesen A läuft und hängt in sync()
    markierung = { ort: "absatz-3", text: "Drei." };
    auswahlHandler?.();
    await kurz(350); // Lesen B läuft und hängt ebenfalls
    expect(verfolgt).toBeGreaterThan(1);
    loesen();
    await kurz(50);
    // A ist veraltet und freigegeben, B gilt — genau EINE Bindung bleibt.
    expect(verfolgt).toBe(1);
    expect(ausstehendeFreigaben).toBe(0);
    await bis(() => letzteAuswahl()?.text === "Drei.");
    expect(letzteAuswahl()?.text).toBe("Drei.");
  });

  it("verspätetes Ergebnis nach Ausschalten und Rundenwechsel: freigegeben, nicht übernommen", async () => {
    await einschalten();
    const loesen = sperren();
    markierung = { ort: "absatz-5", text: "Spät." };
    auswahlHandler?.();
    await kurz(350); // das Lesen hängt in sync()
    schalter().click(); // ausschalten …
    schalter().click(); // … und gleich wieder einschalten: neue Runde
    loesen();
    await kurz(100);
    // Das verspätete Ergebnis der alten Runde ist freigegeben; die neue Runde hält nichts, solange
    // ihre eigene Markierung nicht gelesen ist (die Attrappe liefert „Spät." an absatz-5 — das
    // Lesen der neuen Runde bindet es höchstens EINMAL).
    expect(verfolgt).toBeLessThanOrEqual(1);
    expect(ausstehendeFreigaben).toBe(0);
    schalter().click(); // aus: auch eine Bindung der neuen Runde wird freigegeben
    await kurz(50);
    expect(verfolgt).toBe(0);
  });
});

describe("A5 · KO-02-05 — eine Frage läuft über das Fragefeld dieses Fensters", () => {
  it("füllt das Feld, drückt den Knopf und meldet die angezeigte Antwort zurück", async () => {
    const knopf = document.getElementById("ask-btn") as HTMLButtonElement;
    knopf.addEventListener("click", () => {
      // So, wie das Fenster seine Antwort zeigt: Text setzen, Block sichtbar.
      const text = document.getElementById("ask-answer-text") as HTMLElement;
      text.textContent = "Der 3. Werktag (fiktiv).";
      (document.getElementById("ask-answer-block") as HTMLElement).className = "";
    });
    await einschalten();
    naechsteMeldung.push({
      status: 200,
      aktionen: [{ id: "f1", art: "frage", text: "Welcher Termin gilt?", auswahlStand: 0 }],
    });
    await bis(() => ergebnisse().length > 0);
    const feld = document.getElementById("ask-input") as HTMLTextAreaElement;
    expect(feld.value).toBe("Welcher Termin gilt?");
    expect(ergebnisse()).toEqual([
      { id: "f1", stand: "erledigt", ergebnis: "Der 3. Werktag (fiktiv).", grund: null },
    ]);
  });

  it("ist der Knopf des Fensters gesperrt, wird mit dessen Grund abgelehnt", async () => {
    const knopf = document.getElementById("ask-btn") as HTMLButtonElement;
    knopf.disabled = true;
    (document.getElementById("ask-status") as HTMLElement).textContent = "Bitte zuerst anmelden.";
    await einschalten();
    naechsteMeldung.push({
      status: 200,
      aktionen: [{ id: "f2", art: "frage", text: "Was gilt?", auswahlStand: 0 }],
    });
    await bis(() => ergebnisse().length > 0);
    expect(ergebnisse()).toEqual([
      { id: "f2", stand: "abgelehnt", ergebnis: null, grund: "Bitte zuerst anmelden." },
    ]);
  });
});

describe("A6 · KO-02-07 — Fehler und Wiederverbindung", () => {
  it("vergisst der Server das Fenster (404), meldet es sich neu an", async () => {
    await einschalten();
    expect(anmeldungen()).toHaveLength(1);
    naechsteMeldung.push({ status: 404 });
    await bis(() => anmeldungen().length === 2);
    expect(anmeldungen()).toHaveLength(2);
    await bis(() => lage() === VERBUNDEN);
    expect(lage()).toBe(VERBUNDEN);
  });

  it("ohne Klarwerk-Anmeldung sagt die Zeile genau das", async () => {
    anmeldeStatus = 401;
    schalter().click();
    await kurz(50);
    expect(lage()).toBe("Bitte zuerst bei Klarwerk anmelden.");
    expect(meldungen()).toEqual([]);
  });
});

describe("A7 · Ausschalten und Schliessen melden ab", () => {
  it("Ausschalten: Abmeldung, danach keine Meldung mehr", async () => {
    await einschalten();
    const instanz = String(anmeldungen()[0]?.rumpf?.instanz);
    schalter().click();
    const abmeldung = aufrufe.find((a) => a.methode === "DELETE");
    expect(abmeldung?.pfad).toBe(`/api/me/klara/begleiter/adapter/${instanz}`);
    expect(abmeldung?.keepalive).toBe(true);
    const vorher = meldungen().length;
    vi.advanceTimersByTime(20_000);
    await kurz();
    expect(meldungen().length).toBe(vorher);
    expect(lage()).toBe("Nicht verbunden.");
  });

  it("Schliessen des Fensters (pagehide) meldet ab", async () => {
    await einschalten();
    window.dispatchEvent(new Event("pagehide"));
    expect(aufrufe.filter((a) => a.methode === "DELETE")).toHaveLength(1);
  });
});
