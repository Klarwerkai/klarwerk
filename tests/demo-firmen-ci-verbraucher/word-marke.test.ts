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
const fristen: unknown[] = [];

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
    fristen.push(id);
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
  try {
    new Function(quelle.slice(skriptStart + "<script>".length, skriptEnde))();
  } finally {
    for (const [ziel, original] of echt) {
      ziel.addEventListener = original;
    }
  }
  await leerlauf();
}

/** Ein Anlass, bei dem die Fläche nachsieht — genau der Weg, den ein offenes Fenster wirklich hat. */
async function sichtbarWerden(vorlaufMs = 61_000): Promise<void> {
  jetzt += vorlaufMs;
  umgebung.document.dispatchEvent(new umgebung.window.Event("visibilitychange"));
  await leerlauf();
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
});

afterEach(() => {
  for (const { ziel, typ, fn } of zuhoerer.splice(0)) {
    ziel.removeEventListener(typ, fn);
  }
  for (const id of fristen.splice(0)) {
    clearTimeout(id as ReturnType<typeof setTimeout>);
  }
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
});
