// @vitest-environment jsdom
// ================================================================================================
// JOB 3008 — DER ZUSTANDSWEG DER OFFICE-ERKENNUNG, AM LAUFENDEN FENSTER GEMESSEN.
// ================================================================================================
//
// WARUM DIESE DATEI EXISTIERT. P7 verspricht „Klara im Word-Panel — Office-Erkennung, Markierungs-
// Fragen und Einfuegen funktionieren" und traegt zugleich den Vermerk „in Bau, nie abgenommen".
// Die Office-Erkennung war bis hierher ueberwiegend ueber Quelltext-Zeichenfolgen abgesichert
// (`tests/app/word-addin.test.ts:639-653`, `word-addin-ask.test.ts:819`: `expect(html).toContain`).
// Solche Pins ueberleben einen Umbau der Seite entweder falsch-gruen (die Zeichenfolge bleibt, das
// Verhalten bricht) oder falsch-rot (die Zeichenfolge wandert, das Verhalten haelt). Sie bleiben
// stehen — diese Datei stellt VERHALTEN daneben.
//
// GEMESSEN WIRD, WAS EIN MENSCH SIEHT: Klasse und Text von `#office-hint`, `disabled` und `title`
// von `#send-btn`. Nichts sonst. Ausgefuehrt wird das AUSGELIEFERTE Inline-Skript aus
// `apps/web/public/word-addin/taskpane.html` (geschnitten mit `splitTaskpane` der Klara-Panel-
// Fixture — kein zweiter Quelltext, keine Kopie).
//
// WARUM EINE EIGENE OFFICE-ATTRAPPE UND NICHT `createKlaraPanel`. Die Fixture ruft `Office.onReady`
// SYNCHRON (`tests/app/klara-panel-fixture.ts:146-150`); die Lagen „onReady kommt spaet" und
// „onReady kommt nie" sind ueber sie nicht erreichbar. Die Attrappe hier haelt den Rueckruf zurueck
// — dieselbe Bauform wie `tests/app/w1-klara-lifecycle-taskpane.test.tsx:358-400`. Die Fixture
// bleibt dadurch unveraendert, und kein bestehender Nutzer muss angefasst werden.
//
// DIE GEGENPROBE IST TEIL DER MESSUNG (Abschnitt „Kalibrierung" unten): jeder der beiden Faelle,
// die an einer Zahl bzw. an einer Zuweisung im Panel haengen, wird einmal mit einem VERFAELSCHTEN
// Skript gefahren. Misst der Fall wirklich das Panel, muss sich das Ergebnis dabei aendern. Das
// Panel selbst wird nie veraendert — die Verfaelschung lebt nur im Speicher dieses Laufs.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { splitTaskpane } from "../app/klara-panel-fixture";

const TASKPANE = "apps/web/public/word-addin/taskpane.html";
const HTML = readFileSync(resolve(process.cwd(), TASKPANE), "utf8");
const { markup: MARKUP, script: SKRIPT } = splitTaskpane(HTML);

/**
 * Die Erkennungsfrist — GELESEN aus dem Aufgabenfenster, nicht hier abgeschrieben. Waere sie als
 * Zahl notiert, pruefte diese Datei ihre eigene Annahme statt die ausgelieferte Frist.
 */
const OFFICE_FRIST = (() => {
  const treffer = /var OFFICE_READY_TIMEOUT_MS = (\d+);/.exec(HTML);
  if (treffer === null) {
    throw new Error(`${TASKPANE}: OFFICE_READY_TIMEOUT_MS ist nicht auffindbar`);
  }
  return Number(treffer[1]);
})();

/**
 * Der ehrliche Satz, den das Panel im Nicht-Word-Zustand ZEIGT (DE). Er steht hier woertlich, weil
 * dieser Test misst, was ein MENSCH liest — nicht, ob eine Variable gesetzt ist. Alle uebrigen
 * Behauptungen dieser Datei kommen ohne Wortlaut aus.
 */
const KEIN_OFFICE_DE =
  "Diese Seite läuft als Klara-Panel in Microsoft Word. Im Browser kannst du nur den " +
  "Anmelde-Status sehen — Senden ist hier deaktiviert.";

// ---- Der Serverstand ---------------------------------------------------------------------------

let angemeldet = true;

// Keine `headers` — bewusst: der Fassungs-Abgleich (`kwVerfuegbareFassungLaden`) faellt dadurch auf
// seinen ehrlichen „unbekannt"-Zweig zurueck, statt dass dieser Pruefstand eine Fassung erfindet.
interface Antwort {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

function gut(koerper: unknown): Antwort {
  return { ok: true, status: 200, json: () => Promise.resolve(koerper) };
}

function absage(status: number): Antwort {
  return { ok: false, status, json: () => Promise.resolve({}) };
}

/**
 * Nur die Pfade, die das Fenster beim Laden von selbst ruft. Die Klara-Sitzungsrouten antworten
 * bewusst mit 503: diese Datei misst die Office-Erkennung, nicht die Sitzungssicht — und ein
 * erfundener Sitzungskoerper wuerde einen Zustand behaupten, den kein Fall hier gestellt hat.
 */
function bedienen(url: string): Antwort {
  if (url === "/api/auth/me") {
    return angemeldet ? gut({ id: "u1", name: "Prueferin" }) : absage(401);
  }
  if (url === "/api/reasoner/status") {
    return gut({ enabled: false, reachable: "none" });
  }
  if (url.startsWith("/api/klara/")) {
    return absage(503);
  }
  return absage(404);
}

// ---- Die Office-Attrappe -------------------------------------------------------------------

const EREIGNISSE = { DocumentSelectionChanged: "documentSelectionChanged" } as const;
const COERCION = { Text: "text", Html: "html" } as const;
const ASYNC_STATUS = { Succeeded: "succeeded", Failed: "failed" } as const;

interface OfficeKontext {
  document: {
    url: string;
    addHandlerAsync(typ: string, fn: () => void): void;
    getSelectedDataAsync(typ: string, fn: (r: { status: string; value: string }) => void): void;
  };
}

let officeHandler: Array<{ typ: string; fn: () => void }> = [];

/**
 * Der Dokumentkontext, wie der Host ihn liefert. Die Markierung ist LEER und wird als Erfolg
 * gemeldet: dieser Pruefstand stellt kein markiertes Dokument und behauptet auch keines. Die
 * beiden Methoden stehen hier, weil das Panel sie anfasst, sobald `officeUsable()` wahr wird
 * (`taskpane.html:4769`, `:4336`) — fehlten sie, wuerde Fall C an der Attrappe scheitern statt am
 * Fenster.
 */
function kontextBauen(): OfficeKontext {
  return {
    document: {
      url: "",
      addHandlerAsync(typ: string, fn: () => void): void {
        officeHandler.push({ typ, fn });
      },
      getSelectedDataAsync(_typ: string, fn: (r: { status: string; value: string }) => void): void {
        fn({ status: ASYNC_STATUS.Succeeded, value: "" });
      },
    },
  };
}

/**
 * Die vier Lagen, in denen sich der Host wirklich unterscheidet:
 *   "fehlt"           — kein `window.Office` (Seite im normalen Browser).
 *   "ohneOnReady"     — `Office` samt `context` da, aber KEIN `onReady`.
 *   "sofort"          — `onReady` feuert synchron (die Lage der Klara-Panel-Fixture).
 *   "zurueckgehalten" — `onReady` EXISTIERT, der Rueckruf wird festgehalten; `context` erscheint
 *                       erst mit ihm. Genau diese Lage konnte bisher keine Fixture stellen.
 */
type Hostlage = "fehlt" | "ohneOnReady" | "sofort" | "zurueckgehalten";

let onReadyRueckruf: (() => void) | null = null;

function officeStellen(lage: Hostlage): void {
  onReadyRueckruf = null;
  const fenster = window as unknown as { Office?: unknown };
  const grundlage = {
    EventType: EREIGNISSE,
    CoercionType: COERCION,
    AsyncResultStatus: ASYNC_STATUS,
  };
  if (lage === "fehlt") {
    fenster.Office = undefined;
    return;
  }
  if (lage === "ohneOnReady") {
    fenster.Office = { ...grundlage, context: kontextBauen() };
    return;
  }
  if (lage === "sofort") {
    fenster.Office = { ...grundlage, context: kontextBauen(), onReady: (cb: () => void) => cb() };
    return;
  }
  const office: { context?: OfficeKontext; onReady(cb: () => void): void } & typeof grundlage = {
    ...grundlage,
    onReady(cb: () => void): void {
      onReadyRueckruf = (): void => {
        office.context = kontextBauen();
        cb();
      };
    },
  };
  fenster.Office = office;
}

/** Loest den festgehaltenen Rueckruf aus — der Moment, in dem Word sich (verspaetet) meldet. */
async function officeMeldetSich(): Promise<void> {
  expect(onReadyRueckruf, "Kein zurueckgehaltener onReady-Rueckruf").not.toBeNull();
  onReadyRueckruf?.();
  await leerlauf();
}

// ---- Laden und Messen ---------------------------------------------------------------------

const zuhoerer: Array<{ ziel: EventTarget; typ: string; fn: EventListenerOrEventListenerObject }> =
  [];

/**
 * jsdom teilt EIN `window` ueber alle Faelle einer Datei. Ohne Abmelden haetten im sechsten Fall
 * sechs geladene Fensterinstanzen gleichzeitig auf `focus` und `pagehide` reagiert — ein
 * Messfehler des Pruefstands, kein Befund am Fenster.
 */
function zuhoererMitschreiben(ziel: EventTarget): void {
  const original = ziel.addEventListener.bind(ziel);
  (ziel as unknown as { addEventListener: typeof original }).addEventListener = (
    typ: string,
    fn: EventListenerOrEventListenerObject,
    opts?: boolean | AddEventListenerOptions,
  ) => {
    zuhoerer.push({ ziel, typ, fn });
    original(typ, fn, opts);
  };
}

/**
 * Eine Verfaelschung des ausgelieferten Skripts — NUR im Speicher dieses Laufs. Sie schlaegt fehl,
 * wenn die Fundstelle nicht genau einmal vorkommt: eine still ins Leere laufende Ersetzung wuerde
 * eine Gegenprobe vortaeuschen, die gar nichts verfaelscht hat.
 */
function verfaelschen(skript: string, suche: string, ersatz: string): string {
  const teile = skript.split(suche);
  expect(teile.length, `Fundstelle nicht genau einmal vorhanden: ${suche}`).toBe(2);
  return teile.join(ersatz);
}

interface Ladeoptionen {
  hostlage: Hostlage;
  /** Verfaelscht das Skript vor dem Ausfuehren (Kalibrierung). */
  mutieren?: (skript: string) => string;
}

/** Baut das Fenster auf und fuehrt das ausgelieferte Skript aus — SYNCHRON, ohne Leerlauf. */
function fensterLaden(opt: Ladeoptionen): void {
  expect(MARKUP.length, `${TASKPANE}: Markup ist leer`).toBeGreaterThan(2000);
  document.body.innerHTML = MARKUP;
  officeStellen(opt.hostlage);
  zuhoererMitschreiben(window);
  zuhoererMitschreiben(document);
  const skript = opt.mutieren ? opt.mutieren(SKRIPT) : SKRIPT;
  new Function(skript)();
}

/** Fenster laden und die Antworten des Servers ankommen lassen — ohne die Frist zu bewegen. */
async function fensterLadenUndWarten(opt: Ladeoptionen): Promise<void> {
  fensterLaden(opt);
  await leerlauf();
}

async function leerlauf(runden = 8): Promise<void> {
  for (let i = 0; i < runden; i += 1) {
    await Promise.resolve();
    await new Promise((weiter) => process.nextTick(weiter));
  }
}

function el(id: string): HTMLElement {
  const gefunden = document.getElementById(id);
  expect(gefunden, `#${id} fehlt im Aufgabenfenster`).not.toBeNull();
  return gefunden as HTMLElement;
}

/** GENAU DAS, WAS EIN MENSCH SIEHT — die einzige Messgroesse dieser Datei. */
interface Sicht {
  hinweisKlasse: string;
  hinweisText: string;
  knopfGesperrt: boolean;
  knopfGrund: string;
}

function sicht(): Sicht {
  const hinweis = el("office-hint");
  const knopf = el("send-btn") as HTMLButtonElement;
  return {
    hinweisKlasse: hinweis.className,
    hinweisText: hinweis.textContent ?? "",
    knopfGesperrt: knopf.disabled,
    knopfGrund: knopf.title,
  };
}

/** Der ehrliche Endzustand „kein Office": Hinweis sichtbar, Knopf gesperrt, Grund am Knopf. */
const KEIN_OFFICE_SICHT: Sicht = {
  hinweisKlasse: "status warn",
  hinweisText: KEIN_OFFICE_DE,
  knopfGesperrt: true,
  knopfGrund: KEIN_OFFICE_DE,
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  angemeldet = true;
  officeHandler = [];
  onReadyRueckruf = null;
  zuhoerer.length = 0;
  vi.stubGlobal("fetch", (url: string) => Promise.resolve(bedienen(url) as unknown as Response));
});

afterEach(() => {
  for (const z of zuhoerer) {
    z.ziel.removeEventListener(z.typ, z.fn);
  }
  zuhoerer.length = 0;
  officeHandler = [];
  onReadyRueckruf = null;
  vi.unstubAllGlobals();
  vi.useRealTimers();
  document.body.innerHTML = "";
  (window as unknown as { Office?: unknown }).Office = undefined;
  (window as unknown as { klaraBestandsblick?: unknown }).klaraBestandsblick = undefined;
});

// ================================================================================================
// FALL A — office.js fehlt (die Seite im normalen Browser)
// ================================================================================================
describe("JOB 3008 · Fall A — ohne office.js sagt das Fenster sofort, warum nichts geht", () => {
  it("Hinweis sichtbar, Knopf gesperrt, Grund am Knopf — ohne dass eine Frist ablaufen muss", async () => {
    await fensterLadenUndWarten({ hostlage: "fehlt" });
    expect(sicht()).toEqual(KEIN_OFFICE_SICHT);
  });

  it("A2 — `Office` da, aber ohne `onReady`: derselbe ehrliche Zustand, ebenfalls sofort", async () => {
    // Diese Lage ist im Bestand falsch beschrieben: `tests/app/ka3-fokusverhalten.test.tsx:105`
    // notiert „OHNE `onReady` ruft das Panel `markOfficeChecked` nie". Das Fenster hat fuer genau
    // diesen Fall einen else-Zweig (`taskpane.html:4880-4883`), der `markOfficeChecked(false)`
    // SOFORT ruft. Hier steht der gemessene Verlauf statt der Behauptung.
    await fensterLadenUndWarten({ hostlage: "ohneOnReady" });
    expect(sicht()).toEqual(KEIN_OFFICE_SICHT);
  });
});

// ================================================================================================
// FALL B — Office da, `onReady` feuert nie: die Frist entscheidet
// ================================================================================================
describe("JOB 3008 · Fall B — bleibt `onReady` aus, kippt die Frist auf den ehrlichen Zustand", () => {
  it("nach OFFICE_READY_TIMEOUT_MS steht derselbe Zustand wie ohne office.js", async () => {
    await fensterLadenUndWarten({ hostlage: "zurueckgehalten" });
    expect(onReadyRueckruf, "Der Rueckruf wurde nicht festgehalten").not.toBeNull();

    await vi.advanceTimersByTimeAsync(OFFICE_FRIST + 1_000);
    await leerlauf();

    expect(sicht()).toEqual(KEIN_OFFICE_SICHT);
  });
});

// ================================================================================================
// FALL C — ein SPAETES `onReady` nach der Frist
// ================================================================================================
describe("JOB 3008 · Fall C — meldet Word sich verspaetet, erholt sich das Fenster", () => {
  it("nach dem Kippen macht der spaete Rueckruf den Hinweis wieder weg und den Knopf frei", async () => {
    await fensterLadenUndWarten({ hostlage: "zurueckgehalten" });
    await vi.advanceTimersByTimeAsync(OFFICE_FRIST + 1_000);
    await leerlauf();
    expect(sicht(), "Vor dem spaeten Rueckruf muss der ehrliche Zustand stehen").toEqual(
      KEIN_OFFICE_SICHT,
    );

    await officeMeldetSich();

    // Keine Dauer-Sperre: der Hinweis ist weg, der Grund am Knopf ist weg, und der Knopf ist frei —
    // angemeldet UND Office bereit.
    expect(sicht()).toEqual({
      hinweisKlasse: "hidden",
      hinweisText: "",
      knopfGesperrt: false,
      knopfGrund: "",
    });
  });

  it("die Erholung schaltet NICHT blind frei: unangemeldet bleibt der Knopf gesperrt", async () => {
    angemeldet = false;
    await fensterLadenUndWarten({ hostlage: "zurueckgehalten" });
    await vi.advanceTimersByTimeAsync(OFFICE_FRIST + 1_000);
    await leerlauf();

    await officeMeldetSich();

    // Der Office-Grund ist zu Recht verschwunden — gesperrt ist der Knopf jetzt wegen der
    // fehlenden Anmeldung, und die traegt ihren eigenen sichtbaren Weg (`#login-block`).
    expect(sicht()).toEqual({
      hinweisKlasse: "hidden",
      hinweisText: "",
      knopfGesperrt: true,
      knopfGrund: "",
    });
    expect(el("login-block").className).not.toContain("hidden");
  });
});

// ================================================================================================
// FALL D — das Fenster VOR der Erkennung (der Kern dieses Auftrags)
// ================================================================================================
//
// `taskpane.html:2573-2574` sagt zu: „Der Senden-Knopf ist NUR bei angemeldet UND Office-bereit
// aktiv — VORHER/im Browser ist er mit ehrlichem Grund deaktiviert (kein toter/crashender Klick)."
// Die Faelle A/B/C oben belegen das „im Browser". Hier steht das „vorher". Die Erwartungen unten
// sind das GEMESSENE, nicht das Erhoffte — der Befund gehoert in die Rueckgabe, nicht in eine
// Aenderung am Panel (JOB 3004 arbeitet an dieser Datei).
describe("JOB 3008 · Fall D — die Zeitspanne zwischen Laden und Erkennung", () => {
  it("unmittelbar nach dem Skriptlauf: Knopf gesperrt, Hinweis versteckt, KEIN Grund", async () => {
    fensterLaden({ hostlage: "zurueckgehalten" });

    // Noch hat weder die Frist gegriffen noch `onReady` gefeuert noch `/api/auth/me` geantwortet.
    expect(sicht()).toEqual({
      hinweisKlasse: "hidden",
      hinweisText: "",
      knopfGesperrt: true,
      knopfGrund: "",
    });
    await leerlauf();
  });

  it("angemeldet, vor der Frist: der Knopf ist tot und nennt keinen Grund", async () => {
    await fensterLadenUndWarten({ hostlage: "zurueckgehalten" });
    // Die Anmeldung IST belegt — die Sperre kann also nur an der offenen Office-Erkennung liegen.
    expect(el("session-status").className).toBe("status ok");
    expect(onReadyRueckruf, "Der Rueckruf wurde nicht festgehalten").not.toBeNull();

    // DAS GEMESSENE, woertlich: `updateSendState` laeuft in dieser Spanne in den else-Zweig
    // (`taskpane.html:2592-2596`), weil `officeChecked` noch false ist. Der Hinweis bleibt
    // versteckt, `title` wird aktiv auf "" gesetzt — der Knopf ist gesperrt OHNE sichtbaren Grund.
    expect(sicht()).toEqual({
      hinweisKlasse: "hidden",
      hinweisText: "",
      knopfGesperrt: true,
      knopfGrund: "",
    });
  });

  it("die Spanne ist begrenzt: mit dem Ablauf der Frist kommt der Grund", async () => {
    await fensterLadenUndWarten({ hostlage: "zurueckgehalten" });
    expect(sicht().knopfGrund, "Vor der Frist stand schon ein Grund am Knopf").toBe("");

    await vi.advanceTimersByTimeAsync(OFFICE_FRIST + 1_000);
    await leerlauf();

    expect(sicht().knopfGrund).toBe(KEIN_OFFICE_DE);
  });
});

// ================================================================================================
// KALIBRIERUNG — die Gegenprobe zu Fall B und Fall D
// ================================================================================================
//
// Ein Messauftrag hat keinen Ausgangsfehler, den ein Test rot zeigen koennte. Der Ersatz ist die
// Gegenprobe: wird die gemessene Stelle im Skript verfaelscht, MUSS sich das Ergebnis aendern.
// Tut es das nicht, misst der Fall daneben nichts. Verfaelscht wird ausschliesslich der
// Skripttext im Speicher — `taskpane.html` bleibt unangetastet.
describe("JOB 3008 · Kalibrierung — die Faelle haengen wirklich am ausgelieferten Skript", () => {
  it("Fall B haengt an der ausgelieferten Frist: mit erhoehter Frist kippt nichts", async () => {
    await fensterLadenUndWarten({
      hostlage: "zurueckgehalten",
      mutieren: (skript) =>
        verfaelschen(
          skript,
          `var OFFICE_READY_TIMEOUT_MS = ${OFFICE_FRIST};`,
          `var OFFICE_READY_TIMEOUT_MS = ${OFFICE_FRIST * 100};`,
        ),
    });

    await vi.advanceTimersByTimeAsync(OFFICE_FRIST + 1_000);
    await leerlauf();

    // Waere Fall B nur eine Behauptung ueber den Ablauf der Zeit, staende hier derselbe Zustand
    // wie dort. Er steht nicht — die Frist des Panels entscheidet.
    expect(sicht()).not.toEqual(KEIN_OFFICE_SICHT);
    expect(sicht().knopfGrund).toBe("");
  });

  it('Fall D haengt an der Zuweisung `sendBtn.title = ""`: ersetzt man sie, misst Fall D anders', async () => {
    await fensterLadenUndWarten({
      hostlage: "zurueckgehalten",
      mutieren: (skript) =>
        verfaelschen(skript, 'sendBtn.title = "";', 'sendBtn.title = t("noOffice");'),
    });

    // Dieselbe Spanne wie in Fall D — nur die verfaelschte Zuweisung ist anders. Steht hier ein
    // Grund, dann liest Fall D wirklich diese Stelle und nicht einen Rest aus dem Markup.
    expect(sicht().knopfGrund).toBe(KEIN_OFFICE_DE);
    expect(sicht().knopfGesperrt).toBe(true);
  });
});

// ================================================================================================
// DER PRUEFSTAND SELBST — damit ein gruener Lauf nicht aus einem toten Fenster kommen kann
// ================================================================================================
describe("JOB 3008 · der Pruefstand misst ein LEBENDES Fenster", () => {
  it("das Skript stammt aus der ausgelieferten Seite und wird nicht nachgebaut", () => {
    expect(SKRIPT.length).toBeGreaterThan(10_000);
    expect(HTML).toContain(SKRIPT);
    expect(OFFICE_FRIST).toBeGreaterThan(0);
  });

  it("bei sofortigem `onReady` ist der Knopf frei — sonst waere jeder Fall oben trivial gruen", async () => {
    await fensterLadenUndWarten({ hostlage: "sofort" });
    expect(sicht()).toEqual({
      hinweisKlasse: "hidden",
      hinweisText: "",
      knopfGesperrt: false,
      knopfGrund: "",
    });
    // Und das Fenster hat sich beim Host wirklich angemeldet — die Attrappe wurde benutzt.
    expect(officeHandler.length).toBeGreaterThan(0);
  });
});
