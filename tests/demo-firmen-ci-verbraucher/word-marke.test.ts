// @vitest-environment jsdom
//
// ================================================================================================
// JOB 3512 · KLARA IM WORD TRÄGT DIE FIRMEN-CI — GEMESSEN AM VOLLSTÄNDIGEN AUFGABENFENSTER.
// ================================================================================================
//
// Geladen wird das AUSGELIEFERTE `taskpane.html` (Markup + Inline-Skript), nicht ein Ausschnitt —
// dieselbe Bauform wie `tests/m5-bild-im-panel/bild-vorschlag-mounted.test.ts`. Gemessen wird, was
// die Fläche danach WIRKLICH trägt: die Wurzelvariablen und das Logo-Element.
//
// WARUM DIE WURZELVARIABLEN UND NICHT EIN BERECHNETER STIL: jsdom rechnet `var(...)` nicht auf.
// Die Zusage dieses Auftrags liegt aber genau eine Ebene darüber — „an denselben Stellen, an denen
// heute die Token aus themes.css stehen". Diese Stellen SIND die Variablen; jede Regel darunter
// greift ohnehin nur über `var(…)` (mega43 hält das fest). Wird eine Variable überschrieben, wirkt
// sie überall dort, wo sie heute wirkt — und wird sie WEGGENOMMEN, steht wieder exakt der Wert aus
// `:root` da. Genau das ist die Bauform, die „Ausschalten stellt den vorherigen Look wieder her"
// beweisbar macht, statt sie zu behaupten.
//
// ------------------------------------------------------------------------------------------------
// JOB 3845 · W14–W18: DIE ANLÄSSE, DIE NIEMAND ANFASST.
// ------------------------------------------------------------------------------------------------
// W1 bis W13 kommen ausnahmslos über `visibilitychange` zum zweiten Abruf (`sichtbarWerden`): der
// `focus`-Zuhörer und die selbst nachstellende Minutenfrist des Markenblocks waren von keinem Fall
// berührt — die Frist wurde hier nur AUFGEZEICHNET, um sie abzuräumen, und nie ausgelöst. Genau das
// hat der Prüfer in `archiv/3512/runde-2/ben.md` bestellt (Prüfpunkt 6 und PROMPTVERBESSERUNG:
// „simulierte Uhr ohne Ereignisse", „Sichere zeitgesteuertes Nachziehen ohne Fokuswechsel dauerhaft
// ab"). W14–W18 schließen die Lücke am SELBEN Prüfstand — dieselbe Uhr, dieselbe Antwortfolge,
// dieselbe Zählung; neu ist allein, dass die aufgezeichnete Frist jetzt auch `fn` und `ms` trägt und
// deshalb gezielt fällig gestellt werden kann.
//
// ------------------------------------------------------------------------------------------------
// EINE SCHREIBREGEL FÜR DIE KOMMENTARE DIESER DATEI — bitte beim Weiterschreiben beachten.
// ------------------------------------------------------------------------------------------------
// In der Prosa steht der Pfad des Aufgabenfensters NIE als Schrägstrich-Literal (Ordnername, `/`,
// Dateiname) und nie eine Schnittmarke wörtlich (Präfix KW, Zusatz START oder END). Der Grund ist
// kein Geschmack: `tests/klara-zerlegung/schnitt-pins.test.ts` leitet aus genau diesen beiden
// Textmustern ab, WIE eine Testdatei am Aufgabenfenster hängt, und hält das Ergebnis gegen ein
// gepinntes Verzeichnis. Dort steht für diese Datei `zusammengesetzt` — und das ist auch ihr
// wirklicher Griff: sie baut den Pfad aus Segmenten (`TASKPANE`, unten) und lädt Markup und
// Inline-Skript VOLLSTÄNDIG; sie schneidet keinen Markenblock heraus. In Runde 1 dieses Auftrags
// haben zwei Erwähnungen in Kommentaren zusätzlich die Griffe `pfad` und `marken` ausgelöst und A2
// dort rot gemacht — ein Griff, den es gar nicht gibt. Die Zeilenangaben sind seither dieselben
// geblieben, nur die Schreibweise nennt die Muster nicht mehr wörtlich.
//
// Der Gate-`tsc` läuft ohne DOM-lib; DOM-Zugriffe gehen über schmale Struktur-Typen.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const WURZEL = join(__dirname, "..", "..");
const TASKPANE = join(WURZEL, "apps", "web", "public", "word-addin", "taskpane.html");

interface El {
  id: string;
  className: string;
  hidden: boolean;
  textContent: string | null;
  disabled: boolean;
  getAttribute(name: string): string | null;
  hasAttribute(name: string): boolean;
}
interface Stil {
  getPropertyValue(name: string): string;
}
type Hoerer = (ereignis: unknown) => void;
interface Ziel {
  addEventListener(typ: string, fn: Hoerer): void;
  removeEventListener(typ: string, fn: Hoerer): void;
}
interface Dok extends Ziel {
  getElementById(id: string): El | null;
  documentElement: { style: Stil };
  body: { innerHTML: string };
  dispatchEvent(ereignis: unknown): boolean;
}
interface Fenster extends Ziel {
  Office?: unknown;
  Word?: unknown;
  Event: new (typ: string, init?: { bubbles?: boolean }) => unknown;
  dispatchEvent(ereignis: unknown): boolean;
}
const umgebung = globalThis as unknown as { document: Dok; window: Fenster };

// ------------------------------------------------------------------------------------------------
// Der Drahtvertrag aus JOB 3510 (`services/app/src/branding-settings.ts`) — jedes Feld ein echtes.
// ------------------------------------------------------------------------------------------------
interface Stand {
  profil: "advisor" | null;
  aktiv: boolean;
  version: number;
  marke: { name: string; farben: { primaer: string; schrift: string }; logo: string } | null;
}

const ADVISOR = {
  name: "Advisor",
  farben: { primaer: "#0578b7", schrift: "#161417" },
  logo: "/marke/advisor/adv-logo.svg",
};

const AN = (version: number): Stand => ({
  profil: "advisor",
  aktiv: true,
  version,
  marke: ADVISOR,
});
const AUS = (version: number): Stand => ({ profil: null, aktiv: false, version, marke: null });

/** Die fünf Stellen, an denen die Firmen-CI im Aufgabenfenster wirkt — und sonst keine. */
const MARKEN_TOKEN = ["--brand", "--brand-deep", "--brand-text", "--ink", "--shadow-primary"];
/** Die Signalfarben. Sie sind KEINE Marke und dürfen nie überschrieben werden (Auftrag L2). */
const SIGNAL_TOKEN = ["--pos-bg", "--pos-text", "--warn-bg", "--warn-text"];
/**
 * Der eine Abstand, an dem Drosselung UND Frist hängen: `KW_MARKE_ABSTAND_MS = 60000`
 * (`taskpane.html:13284` — dieselbe Datei, die `TASKPANE` oben aus Segmenten zusammensetzt). Er steht
 * hier als eigener Wert und nicht aus dem Quelltext gelesen — sonst würde eine Änderung dort die
 * Messung stillschweigend mitziehen.
 */
const KW_MARKE_ABSTAND_MS = 60_000;

let brandingAbrufe: string[] = [];
/**
 * Was `GET /api/branding` nacheinander antwortet. Ein `null`-Eintrag heisst „Abruf scheitert",
 * `"haengt"` heisst „der Abruf bleibt offen" — die Antwort kommt in diesem Fall nie. Damit wird der
 * Augenblick messbar, in dem ein Abruf unterwegs ist (W8).
 */
let brandingFolge: (Stand | null | "haengt")[] = [];
let jetzt = 1_700_000_000_000;

function antwort(koerper: unknown, status = 200): unknown {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => "application/json" },
    json: () => Promise.resolve(koerper),
  };
}

function router(url: string): Promise<unknown> {
  if (url === "/api/branding") {
    brandingAbrufe.push(url);
    const naechste = brandingFolge.length > 1 ? brandingFolge.shift() : brandingFolge[0];
    if (naechste === "haengt") {
      // Nie erfüllt und nie verworfen: der Abruf ist ab jetzt dauerhaft „unterwegs".
      return new Promise(() => {});
    }
    if (naechste === null || naechste === undefined) {
      return Promise.reject(new TypeError("Failed to fetch"));
    }
    return Promise.resolve(antwort(naechste));
  }
  if (url === "/api/auth/me") {
    return Promise.resolve(antwort({ error: "UNAUTHORIZED" }, 401));
  }
  // Jede andere Adresse des Fensters wird bewusst abschlägig beantwortet: dieser Prüfstand misst
  // die Marke, nicht die Sitzung. Nichts davon darf die Marke beeinflussen — genau das ist L6.
  return Promise.resolve(antwort({ error: "UNAVAILABLE" }, 503));
}

async function leerlauf(runden = 20): Promise<void> {
  for (let i = 0; i < runden; i += 1) {
    await Promise.resolve();
    await new Promise((r) => process.nextTick(r));
  }
}

/**
 * ================================================================================================
 * DIE AUFRÄUMPFLICHT DIESES PRÜFSTANDS — sie ist kein Beiwerk, sie ist die Messung.
 * ================================================================================================
 *
 * Die Vitest-jsdom-Umgebung hat EIN Fenster für die ganze Datei; jeder Fall lädt das Aufgabenfenster
 * aber erneut (`new Function(skript)()`). Jede Fassung hängt dabei ihre eigenen Zuhörer an
 * `document`/`window` und stellt ihre eigene Frist. Ohne Aufräumen antworten beim vierten Fall
 * VIER Fassungen auf ein `visibilitychange` — die Zählung der Abrufe misst dann die Zahl der
 * geladenen Fenster statt der Drosselung. Genau das ist in der ersten Messung passiert (5 statt 2).
 * Aufgezeichnet wird deshalb, WAS die geladene Fassung anhängt, und nach jedem Fall wieder gelöst.
 */
const zuhoerer: { ziel: Ziel; typ: string; fn: Hoerer }[] = [];
/**
 * JOB 3845: DIESELBE Liste, nur reicher. Bis hierher stand in ihr allein die `id`, weil sie nur zum
 * Abräumen gebraucht wurde; jetzt trägt jeder Eintrag zusätzlich den Rückruf und die Verzögerung —
 * und damit kann eine Frist gezielt FÄLLIG gestellt werden, statt nur gelöscht zu werden. Es
 * entsteht kein zweiter Rekorder und kein `vi.useFakeTimers()`: der Aufräumvertrag unten räumt
 * unverändert über `id` ab, und die dreizehn Bestandsfälle merken davon nichts.
 */
interface Frist {
  id: unknown;
  fn: () => void;
  ms: number;
}
const fristen: Frist[] = [];
/**
 * Die Frist des Markenblocks aus dem zuletzt geladenen Fenster — oder `null`, wenn das Laden keine
 * gestellt hat. Sie wird NICHT geraten: der Markenblock ist der letzte Code im Inline-Skript
 * (`taskpane.html:13454` steht unmittelbar vor der Endmarke des Markenblocks `:13457` und vor
 * `</script>` `:13458`), also ist `kwMarkeFristStellen()` die letzte Frist, die das Laden synchron
 * stellt.
 */
let markenFrist: Frist | null = null;

async function ladeFenster(folge: (Stand | null | "haengt")[]): Promise<void> {
  brandingFolge = [...folge];
  vi.stubGlobal("fetch", (url: string) => router(String(url)));
  vi.spyOn(Date, "now").mockImplementation(() => jetzt);
  // Das Aufgabenfenster hält FRISTEN, keinen Takt (`setInterval` ist dort verboten und wird von
  // `tests/app/word-addin.test.ts` und `ka3-fokusverhalten` gemessen). Aufgezeichnet wird deshalb
  // `setTimeout`: die Markenfrist stellt sich nach jedem Blick neu, und ohne Abräumen liefe die
  // Kette jeder geladenen Fassung weiter in die folgenden Fälle hinein.
  const echterTimer = globalThis.setTimeout.bind(globalThis);
  vi.stubGlobal("setTimeout", (fn: () => void, ms: number) => {
    const id = echterTimer(fn, ms);
    fristen.push({ id, fn, ms });
    return id;
  });
  const quelle = readFileSync(TASKPANE, "utf8");
  const skriptStart = quelle.lastIndexOf("<script>");
  const skriptEnde = quelle.lastIndexOf("</script>");
  expect(skriptStart, "Inline-Skript nicht gefunden").toBeGreaterThan(0);
  const bodyStart = quelle.indexOf("<body>");
  const markup = quelle.slice(bodyStart + "<body>".length, skriptStart);
  expect(markup.length).toBeGreaterThan(2000);
  umgebung.document.body.innerHTML = markup;
  umgebung.window.Office = {
    context: { document: { url: "", addHandlerAsync() {}, getSelectedDataAsync() {} } },
    EventType: {},
    CoercionType: { Text: "text", Html: "html" },
    AsyncResultStatus: { Succeeded: "succeeded", Failed: "failed" },
    onReady: (cb: () => void) => cb(),
  };
  // Ab hier wird mitgeschrieben, wer sich anhängt — und NUR für die Dauer des Ladens.
  const echt = new Map<Ziel, (typ: string, fn: Hoerer) => void>();
  for (const ziel of [umgebung.document, umgebung.window] as Ziel[]) {
    const original = ziel.addEventListener.bind(ziel);
    echt.set(ziel, original);
    ziel.addEventListener = (typ: string, fn: Hoerer) => {
      zuhoerer.push({ ziel, typ, fn });
      original(typ, fn);
    };
  }
  const vorDemLaden = fristen.length;
  try {
    new Function(quelle.slice(skriptStart + "<script>".length, skriptEnde))();
  } finally {
    for (const [ziel, original] of echt) {
      ziel.addEventListener = original;
    }
  }
  // Gemerkt wird die ZULETZT beim Laden gestellte Frist — und zwar hier, vor `leerlauf()`: was der
  // erzwungene erste Abruf danach noch anhängt, gehört nicht mehr zum Laden.
  const beimLaden = fristen.slice(vorDemLaden);
  markenFrist = beimLaden[beimLaden.length - 1] ?? null;
  await leerlauf();
}

/** Ein Anlass, bei dem die Fläche nachsieht — genau der Weg, den ein offenes Fenster wirklich hat. */
async function sichtbarWerden(vorlaufMs = 61_000): Promise<void> {
  jetzt += vorlaufMs;
  umgebung.document.dispatchEvent(new umgebung.window.Event("visibilitychange"));
  await leerlauf();
}

/**
 * Der dritte Anlass: die Minutenfrist wird fällig — OHNE dass irgendein Ereignis stattfindet.
 *
 * Ausgelöst wird ausschliesslich die gemerkte Markenfrist, und nur, wenn sie wirklich auf
 * `KW_MARKE_ABSTAND_MS` steht. Eine fremde Frist wird NIE gefeuert. Die Uhr geht dabei genau um
 * denselben Betrag vor, um den die Frist gestellt war — mehr wäre geschenkte Zeit und würde die
 * Drosselung nicht mehr messen.
 */
async function markenFristFaellig(): Promise<void> {
  expect(
    markenFrist,
    "keine Markenfrist gemerkt — die Fristenkette des Markenblocks ist abgerissen",
  ).not.toBeNull();
  const faellig = markenFrist as Frist;
  expect(
    faellig.ms,
    `die gemerkte Frist steht auf ${faellig.ms} ms statt auf ${KW_MARKE_ABSTAND_MS} ms — das ist nicht die Markenfrist`,
  ).toBe(KW_MARKE_ABSTAND_MS);
  jetzt += KW_MARKE_ABSTAND_MS;
  const vorher = fristen.length;
  faellig.fn();
  // Die Frist stellt sich im Rückruf selbst neu (`taskpane.html:13441`); genau dieser Neuzugang ist
  // ab jetzt die Markenfrist. Kam keiner dazu, ist die Kette hier zu Ende — und der nächste Aufruf
  // sagt das laut, statt still nichts zu tun.
  const neu = fristen.slice(vorher);
  markenFrist = neu[neu.length - 1] ?? null;
  await leerlauf();
}

/**
 * `document.hidden` stellen. jsdom leitet es aus `visibilityState` ab; überschrieben wird deshalb
 * als eigene Eigenschaft am Dokument, und `hiddenFreigeben()` nimmt genau diese wieder weg.
 */
function hiddenStellen(wert: boolean): void {
  Object.defineProperty(umgebung.document, "hidden", {
    configurable: true,
    get: () => wert,
  });
}

function hiddenFreigeben(): void {
  delete (umgebung.document as unknown as { hidden?: boolean }).hidden;
}

function wurzel(name: string): string {
  return umgebung.document.documentElement.style.getPropertyValue(name).trim();
}

function logo(): El {
  const el = umgebung.document.getElementById("kw-marke-logo");
  expect(el, "#kw-marke-logo fehlt im Aufgabenfenster").not.toBeNull();
  return el as El;
}

function logoSichtbar(): boolean {
  return !logo().className.split(/\s+/).includes("hidden");
}

beforeEach(() => {
  brandingAbrufe = [];
  jetzt = 1_700_000_000_000;
  markenFrist = null;
});

afterEach(() => {
  for (const { ziel, typ, fn } of zuhoerer.splice(0)) {
    ziel.removeEventListener(typ, fn);
  }
  for (const { id } of fristen.splice(0)) {
    clearTimeout(id as ReturnType<typeof setTimeout>);
  }
  markenFrist = null;
  // Ein stehen gebliebenes `hidden` würde jeden FOLGENDEN Fall falsch messen (W18).
  hiddenFreigeben();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  umgebung.document.body.innerHTML = "";
  for (const t of [...MARKEN_TOKEN, ...SIGNAL_TOKEN]) {
    (
      umgebung.document.documentElement.style as unknown as { removeProperty(n: string): void }
    ).removeProperty(t);
  }
});

describe("JOB 3512 W · Klara im Word übernimmt die Firmen-CI", () => {
  it("W1 · aus: keine einzige Markenvariable ist überschrieben, kein Logo", async () => {
    await ladeFenster([AUS(3)]);
    expect(brandingAbrufe, "das Fenster hat gar nicht nachgesehen").toHaveLength(1);
    for (const token of MARKEN_TOKEN) {
      expect(wurzel(token), `${token} ist überschrieben, obwohl die Firmen-CI aus ist`).toBe("");
    }
    expect(logoSichtbar()).toBe(false);
    expect(logo().hasAttribute("src"), "ein leeres src wäre ein Abruf ins Leere").toBe(false);
  });

  it("W2 · an: Logo und die beiden belegten Farben stehen an ihren Stellen", async () => {
    await ladeFenster([AN(4)]);
    expect(wurzel("--brand")).toBe("#0578b7");
    // Der texttragende Ton und die Knopffläche: 0,8 × #0578b7, wie in `styles/marke.css`.
    expect(wurzel("--brand-text")).toBe("#046092");
    expect(wurzel("--brand-deep")).toBe("#046092");
    // Die zweite belegte Farbe — der dunkle Schriftzug des Logos — trägt die Überschriften.
    expect(wurzel("--ink")).toBe("#161417");
    // Der Knopfschein ist der Funke gewesen; er wird die Marke, nicht ein zurückgebliebenes Orange.
    expect(wurzel("--shadow-primary")).toBe("0 2px 10px -2px rgba(5, 120, 183, 0.45)");
    expect(logoSichtbar()).toBe(true);
    expect(logo().getAttribute("src")).toBe("/marke/advisor/adv-logo.svg");
    expect(logo().getAttribute("alt")).toBe("Advisor ICT solutions logo");
  });

  it("W3 · die Signalfarben bleiben unberührt", async () => {
    await ladeFenster([AN(4)]);
    for (const token of SIGNAL_TOKEN) {
      expect(wurzel(token), `${token} ist eine Signalfarbe und keine Marke`).toBe("");
    }
  });

  it("W4 · ausschalten stellt zeichengleich den vorherigen Zustand wieder her", async () => {
    await ladeFenster([AN(4), AUS(5)]);
    expect(wurzel("--brand")).toBe("#0578b7");
    await sichtbarWerden();
    expect(brandingAbrufe.length, "das offene Fenster hat nicht nachgesehen").toBe(2);
    for (const token of MARKEN_TOKEN) {
      expect(wurzel(token), `${token} blieb nach dem Ausschalten stehen`).toBe("");
    }
    expect(logoSichtbar()).toBe(false);
    expect(logo().hasAttribute("src")).toBe(false);
  });

  it("W5 · ein Abruffehler leert nichts und die Fläche bleibt bedienbar", async () => {
    await ladeFenster([AN(4), null]);
    await sichtbarWerden();
    expect(brandingAbrufe.length).toBe(2);
    // LEHREN §7: eine gescheiterte Hintergrund-Auffrischung lässt den zuletzt bekannten Stand
    // SICHTBAR. Sie leert weder Farbe noch Logo.
    expect(wurzel("--brand")).toBe("#0578b7");
    expect(logoSichtbar()).toBe(true);
    // Und die Fläche selbst arbeitet weiter: das Frage-Feld ist da und nicht gesperrt.
    const feld = umgebung.document.getElementById("ask-input");
    expect(feld, "#ask-input fehlt — die Fläche ist beschädigt").not.toBeNull();
    expect((feld as El).disabled).toBe(false);
  });

  it("W6 · scheitert schon der ERSTE Abruf, bleibt der normale Look", async () => {
    await ladeFenster([null]);
    expect(brandingAbrufe.length).toBe(1);
    for (const token of MARKEN_TOKEN) {
      expect(wurzel(token)).toBe("");
    }
    expect(logoSichtbar()).toBe(false);
    expect(umgebung.document.getElementById("ask-input")).not.toBeNull();
  });

  it("W7 · höchstens ein Abruf je Minute, über alle Anlässe zusammen", async () => {
    await ladeFenster([AN(4)]);
    expect(brandingAbrufe.length).toBe(1);
    await sichtbarWerden(1_000);
    await sichtbarWerden(1_000);
    expect(brandingAbrufe.length, "die Drosselung greift nicht").toBe(1);
    await sichtbarWerden(60_000);
    expect(brandingAbrufe.length).toBe(2);
  });

  it("W8 · es ist immer nur EIN Abruf offen — keine Antwort kann eine andere überholen", async () => {
    // ================================================================================================
    // DAS IST DIE ABWEHR GEGEN ÜBERHOLENDE ANTWORTEN — und sie sitzt hier, nicht am Zähler.
    // ================================================================================================
    // Bis Runde 1 stand an dieser Stelle „eine ÄLTERE Version dreht nicht zurück": `version <= meine`
    // wurde verworfen. Dieser Fall hat den Fehler festgeschrieben statt ihn zu finden — er hat nie
    // ein Überholen nachgestellt, sondern zwei NACHEINANDER eintreffende Antworten, von denen die
    // zweite die neuere Wahrheit war. Genau daran blieb das Fenster nach einem Serverneustart blau
    // (BENs Befund, Runde 1).
    //
    // Überholen kann hier baulich gar nicht stattfinden: `kwMarkeLaeuft` lässt keinen zweiten Abruf
    // neben einen offenen. Das wird jetzt gemessen — der erste Abruf bleibt unterwegs, und kein
    // Anlass stellt einen zweiten daneben.
    await ladeFenster(["haengt"]);
    expect(brandingAbrufe.length).toBe(1);
    await sichtbarWerden(120_000);
    await sichtbarWerden(120_000);
    expect(brandingAbrufe.length, "ein zweiter Abruf lief neben dem offenen").toBe(1);
    // Und die Fläche hängt nicht an ihm: sie ist währenddessen normal bedienbar.
    expect((umgebung.document.getElementById("ask-input") as El).disabled).toBe(false);
  });

  it("W9 · ein Stand ohne Marke färbt nicht — auch wenn `aktiv` gesetzt ist", async () => {
    // Die Marke hängt an BEIDEN Voraussetzungen (Profil UND Schalter); der Server löst das schon
    // auf (`brandingAntwort`), die Fläche verlässt sich aber nicht darauf.
    await ladeFenster([{ profil: "advisor", aktiv: true, version: 4, marke: null }]);
    expect(wurzel("--brand")).toBe("");
    expect(logoSichtbar()).toBe(false);
  });

  it("W10 · KALIBRIERUNG: der Prüfstand sieht eine Überschreibung wirklich", async () => {
    // Ohne diesen Fall wäre jedes „ist leer" oben auch dann grün, wenn der Prüfstand die
    // Wurzelvariablen gar nicht lesen könnte.
    await ladeFenster([AN(4)]);
    expect(wurzel("--brand")).not.toBe("");
    expect(MARKEN_TOKEN.filter((t) => wurzel(t) !== "")).toEqual(MARKEN_TOKEN);
  });

  it("W11 · nach einem SERVERNEUSTART wirkt jede weitere Schaltung — der Zähler fängt bei 0 an", async () => {
    // ================================================================================================
    // DER FALL, DEN RUNDE 1 NICHT HATTE (BENs Korrekturpflicht 1).
    // ================================================================================================
    // `version` gilt laut Vertrag (JOB 3510, Rückgabe Runde 3) nur INNERHALB eines Prozesslaufs: die
    // Wahl liegt im Speicher, nach jedem Neustart und jedem Deploy beginnt der Zähler wieder bei 0.
    // Für die Vorführung ist genau das der Normalfall — Coolify deployt, Pedi schaltet danach.
    // Ein Fenster, das währenddessen offen steht, muss trotzdem jeder Schaltung folgen.
    await ladeFenster([AN(9), AUS(0), AN(1), AUS(2)]);
    expect(wurzel("--brand"), "der erste Stand kam nicht an").toBe("#0578b7");

    await sichtbarWerden(); // ── Serverneustart, Wahl weg: AUS(0), KLEINER als die gesehene 9
    expect(wurzel("--brand"), "nach dem Neustart blieb die Marke stehen").toBe("");
    expect(logoSichtbar()).toBe(false);

    await sichtbarWerden(); // ── AN(1), immer noch kleiner als 9
    expect(wurzel("--brand"), "das Einschalten nach dem Neustart wirkte nicht").toBe("#0578b7");
    expect(logoSichtbar()).toBe(true);

    await sichtbarWerden(); // ── AUS(2)
    expect(wurzel("--brand"), "das Ausschalten nach dem Neustart wirkte nicht").toBe("");
    for (const token of MARKEN_TOKEN) {
      expect(wurzel(token), `${token} blieb nach dem Ausschalten stehen`).toBe("");
    }
    expect(brandingAbrufe.length).toBe(4);
  });

  it("W12 · derselbe Zählerstand mit ANDEREM Inhalt wird nicht verwechselt", async () => {
    // Die schärfere Kante desselben Befunds: „Version ungleich meiner" allein trägt nach einem
    // Neustart NICHT. Vor dem Neustart bedeutete `version 2` „an", danach bedeutet dieselbe 2
    // „aus" — ein Vergleich am Zähler sähe zweimal 2 und bliebe blau. Verglichen wird deshalb das
    // AUSSEHEN (`kwMarkeKennung`), und das kann sich nicht verwechseln.
    await ladeFenster([AN(2), AUS(2)]);
    expect(wurzel("--brand")).toBe("#0578b7");
    await sichtbarWerden();
    expect(wurzel("--brand"), "gleiche Version, anderer Inhalt — die Marke blieb stehen").toBe("");
    expect(logoSichtbar()).toBe(false);
  });

  it("W13 · ein Abruf, der nichts Neues bringt, fasst die Fläche nicht an", async () => {
    // Die Kehrseite von W11/W12: der Minutenblick soll unsichtbar bleiben, solange sich nichts
    // ändert. Ohne diesen Fall wäre „am Aussehen vergleichen" eine Behauptung — gemessen wird, dass
    // bei unverändertem Stand KEIN einziger Schreibzugriff auf die Wurzel mehr stattfindet.
    await ladeFenster([AN(4)]);
    expect(wurzel("--brand")).toBe("#0578b7");
    const stil = umgebung.document.documentElement.style as unknown as {
      setProperty(name: string, wert: string): void;
      removeProperty(name: string): void;
    };
    const schreibt = vi.spyOn(stil, "setProperty");
    const loescht = vi.spyOn(stil, "removeProperty");
    await sichtbarWerden();
    expect(brandingAbrufe.length, "das Fenster hat gar nicht nachgesehen").toBe(2);
    expect(
      schreibt.mock.calls.length + loescht.mock.calls.length,
      "derselbe Stand wurde ein zweites Mal aufgetragen",
    ).toBe(0);
    expect(wurzel("--brand"), "und stehen bleibt er trotzdem").toBe("#0578b7");
  });

  it("W14 · KALIBRIERUNG: das Laden stellt wirklich eine Minutenfrist", async () => {
    // Ohne diesen Fall wären W15 und W16 auch dann grün, wenn der Prüfstand gar keine Frist zu
    // fassen bekäme — er behauptet deshalb beides: dass es sie gibt UND welche Verzögerung sie hat.
    await ladeFenster([AN(4)]);
    expect(markenFrist, "das Laden hat keine einzige Frist gestellt").not.toBeNull();
    expect(
      (markenFrist as Frist).ms,
      "die zuletzt beim Laden gestellte Frist ist nicht die Minutenfrist des Markenblocks",
    ).toBe(KW_MARKE_ABSTAND_MS);
  });

  it("W15 · die Marke kommt an, ohne dass irgendjemand das Fenster anfasst", async () => {
    // ================================================================================================
    // DER KERN DER BESTELLUNG (`archiv/3512/runde-2/ben.md`, Prüfpunkt 6).
    // ================================================================================================
    // Kein `sichtbarWerden`, kein `focus`, kein einziges Ereignis — nur die Uhr und die Frist, die
    // sich das Fenster selbst gestellt hat. Genau so steht ein Aufgabenfenster in der Vorführung
    // daneben, während Pedi im Browser umschaltet.
    //
    // Und diese Kante ist knapp: die Frist steht auf exakt `KW_MARKE_ABSTAND_MS`, die Drosselung
    // vergleicht mit `<` (`taskpane.html:13428`, `jetzt - kwMarkeLetzterAbruf < KW_MARKE_ABSTAND_MS`).
    // 60000 < 60000 ist falsch, der Abruf geht also GERADE NOCH durch. Stünde dort `<=`, käme die
    // Marke ohne Ereignis nie an — und dieser Fall würde es melden.
    await ladeFenster([AN(4), AUS(5)]);
    expect(brandingAbrufe.length).toBe(1);
    expect(wurzel("--brand")).toBe("#0578b7");
    expect(logoSichtbar()).toBe(true);

    await markenFristFaellig();

    expect(brandingAbrufe.length, "die Frist hat keinen zweiten Abruf ausgelöst").toBe(2);
    for (const token of MARKEN_TOKEN) {
      expect(wurzel(token), `${token} blieb stehen, obwohl die Firmen-CI aus ist`).toBe("");
    }
    expect(logoSichtbar()).toBe(false);
    expect(logo().hasAttribute("src")).toBe(false);
  });

  it("W16 · die Fristenkette reißt nicht ab — auch der zweite Blick kommt", async () => {
    // Eine Frist, die nur EINMAL feuert, ist für ein Fenster, das stundenlang offen steht, so gut
    // wie keine. Gemessen wird deshalb die Wiederstellung in `taskpane.html:13441`: zweimal fällig
    // hintereinander, ohne jedes Ereignis.
    await ladeFenster([AN(4), AUS(5), AN(6)]);
    expect(wurzel("--brand")).toBe("#0578b7");

    await markenFristFaellig();
    expect(brandingAbrufe.length).toBe(2);
    expect(wurzel("--brand"), "der erste Fristblick wirkte nicht").toBe("");
    expect(logoSichtbar()).toBe(false);

    await markenFristFaellig();
    expect(brandingAbrufe.length, "nach dem ersten Blick kam kein zweiter mehr").toBe(3);
    expect(wurzel("--brand"), "das erneute Einschalten kam nicht an").toBe("#0578b7");
    expect(logoSichtbar()).toBe(true);
  });

  it("W17 · `focus` ist der dritte Anlass — und unterliegt derselben Drosselung", async () => {
    // Das Ereignis geht an `window` (`taskpane.html:13452`), nicht an `document`; der bestehende
    // Zuhörer-Mitschnitt räumt es hinterher wieder ab. Kein `visibilitychange` in diesem Fall.
    await ladeFenster([AN(4), AUS(5)]);
    expect(brandingAbrufe.length).toBe(1);

    jetzt += 1_000;
    umgebung.window.dispatchEvent(new umgebung.window.Event("focus"));
    await leerlauf();
    expect(brandingAbrufe.length, "die Drosselung greift beim Fokus nicht").toBe(1);
    expect(wurzel("--brand")).toBe("#0578b7");

    jetzt += 60_000;
    umgebung.window.dispatchEvent(new umgebung.window.Event("focus"));
    await leerlauf();
    expect(brandingAbrufe.length, "der Fokus hat gar nicht nachgesehen").toBe(2);
    expect(wurzel("--brand"), "das Ausschalten kam über den Fokus nicht an").toBe("");
    expect(logoSichtbar()).toBe(false);
  });

  it("W18 · WEGschalten sieht nicht nach — ein Abruf ohne Adressaten wäre verschenkt", async () => {
    // `taskpane.html:13449`: nur das SICHTBARwerden zählt. Ein weggeschaltetes Aufgabenfenster
    // fragt nicht, und es leert auch nichts — der zuletzt bekannte Stand bleibt stehen.
    await ladeFenster([AN(4), AUS(5)]);
    expect(brandingAbrufe.length).toBe(1);

    hiddenStellen(true);
    jetzt += 61_000;
    umgebung.document.dispatchEvent(new umgebung.window.Event("visibilitychange"));
    await leerlauf();
    expect(brandingAbrufe.length, "das weggeschaltete Fenster hat nachgesehen").toBe(1);
    expect(wurzel("--brand"), "beim Wegschalten hat sich die Fläche verändert").toBe("#0578b7");
    expect(logoSichtbar()).toBe(true);

    // Dieselbe Uhr, dasselbe Ereignis — nur eben sichtbar. Jetzt und erst jetzt wird abgerufen.
    hiddenStellen(false);
    await sichtbarWerden(0);
    expect(brandingAbrufe.length, "das zurückgeholte Fenster hat nicht nachgesehen").toBe(2);
    expect(wurzel("--brand")).toBe("");
    expect(logoSichtbar()).toBe(false);
  });
});
