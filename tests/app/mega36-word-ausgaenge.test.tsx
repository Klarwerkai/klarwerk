// @vitest-environment jsdom
// ================================================================================================
// AUFTRAG-mega36 — ALLE TEXTAUSGAENGE DES PANELS GEHEN DURCH DIESELBE ABLEITUNG.
// ================================================================================================
//
// bens ROT-Befund zu mega35: Der Umbau „der Text entsteht im Moment der Ausgabe" gilt nur fuer die
// beiden PROGRAMMATISCHEN Schaltflaechen. Das Antwortfeld ist ein gewoehnliches `textarea` mit nur
// dem Antwortkoerper darin — ein natives Cmd+C, ein Kontextmenue-Kopieren oder ein Ausschneiden
// nimmt deshalb NUR den Koerper: ohne Einstufung, ohne Quellen-Zeile, ohne Kappungshinweis. Und
// ausgerechnet der Fehler-Rueckfall der Zwischenablage schickte die Nutzerin ausdruecklich auf
// genau diesen Weg („Text im Feld markieren und manuell kopieren").
//
// Dieser Test treibt die ECHTE Taskpane-Laufzeit (dasselbe Lademuster wie mega35) und dispatcht
// ECHTE `copy`-/`cut`-/`dragstart`-Ereignisse am Antwortfeld. Geprueft wird, was in der
// Ereignis-Zwischenablage LANDET — nicht der Zustand einer Variablen.
//
// WAS HIER NICHT GEPRUEFT WIRD (und warum):
//   - Die Systemzwischenablage und das Kontextmenue des echten Word-Hosts. jsdom hat weder das eine
//     noch das andere. Kontextmenue-Kopieren und Cmd+C loesen im Browser DASSELBE `copy`-Ereignis
//     aus — dieser Test faehrt das Ereignis, der Mensch faehrt am Mittwoch das Menue (Block E).
//   - Ziehen und Ablegen ueber die Panel-Grenze hinaus. jsdom kennt keine echte Drag-Session; der
//     Test belegt nur, dass `dragstart` dieselbe Ableitung schreibt.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

const TASKPANE = "apps/web/public/word-addin/taskpane.html";

const ANTWORT = "Ventil V4 wird jaehrlich geprueft und vor der Wartung entlastet.";
const GEKUERZT = "Ventil V4 wird jaehrlich geprueft.";

interface LaufOptionen {
  // Zwischenablage-Schnittstelle scheitert (Rueckfall-Weg, Block B3).
  clipboardFehler?: boolean;
}

interface Laufzeit {
  eingefuegt: string[];
  kopiert: string[];
  quellenAufloesen: () => void;
}

function taskpaneStarten(evidence: unknown, optionen: LaufOptionen = {}): Laufzeit {
  const html = readFileSync(resolve(process.cwd(), TASKPANE), "utf8");
  const bodyStart = html.indexOf("<body>") + "<body>".length;
  const bodyEnd = html.indexOf("</body>");
  const body = html.slice(bodyStart, bodyEnd);
  const skriptStart = body.indexOf("<script>") + "<script>".length;
  const skriptEnd = body.lastIndexOf("</script>");
  const skript = body.slice(skriptStart, skriptEnd);
  document.body.innerHTML = body.slice(0, body.indexOf("<script>"));

  const eingefuegt: string[] = [];
  const kopiert: string[] = [];
  let quellenAufloesen: () => void = () => undefined;
  const quellenTor = new Promise<void>((res) => {
    quellenAufloesen = res;
  });

  const w = window as unknown as Record<string, unknown>;
  w.fetch = (url: string, _init?: unknown): Promise<unknown> => {
    const ok = (payload: unknown): unknown => ({
      ok: true,
      status: 200,
      json: async () => payload,
    });
    if (url === "/api/auth/me") {
      return Promise.resolve(ok({ name: "Testerin" }));
    }
    if (url === "/api/ask") {
      return Promise.resolve(
        ok({
          result: {
            answered: true,
            answer: ANTWORT,
            trust: 90,
            sources: ["k1"],
            steps: [],
            demo: false,
            evidence,
          },
          gap: null,
          receipt: "r",
        }),
      );
    }
    if (url.startsWith("/api/kos/")) {
      return quellenTor.then(() =>
        ok({
          id: "k1",
          title: "Wartungsplan Ventil V4",
          status: "validiert",
          trust: 90,
          createdAt: "2026-07-01T00:00:00.000Z",
        }),
      );
    }
    return Promise.reject(new Error(`unerwartete URL ${url}`));
  };

  w.Office = {
    onReady: (cb: () => void) => cb(),
    CoercionType: { Text: "text" },
    AsyncResultStatus: { Succeeded: "succeeded" },
    context: {
      document: {
        getSelectedDataAsync: (_c: unknown, cb: (r: unknown) => void) =>
          cb({ status: "succeeded", value: "" }),
        setSelectedDataAsync: (text: string, _o: unknown, cb: (r: unknown) => void) => {
          eingefuegt.push(text);
          cb({ status: "succeeded" });
        },
      },
    },
  };

  Object.defineProperty(window.navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: async (text: string) => {
        if (optionen.clipboardFehler) {
          throw new Error("NotAllowedError");
        }
        kopiert.push(text);
      },
    },
  });

  new Function(skript)();
  return { eingefuegt, kopiert, quellenAufloesen };
}

async function ruhe(runden = 12): Promise<void> {
  for (let i = 0; i < runden; i++) {
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
  }
}

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) {
    throw new Error(`Element ${id} fehlt`);
  }
  return node as T;
}

// jsdom kennt weder ClipboardEvent noch DataTransfer — der Ereignis-Datenbehaelter wird mit dem
// echten setData/getData-Vertrag nachgebildet und am Ereignis befestigt.
interface Behaelter {
  store: Record<string, string>;
  setData(typ: string, wert: string): void;
  getData(typ: string): string;
}

function behaelter(vorbelegt: string): Behaelter {
  const store: Record<string, string> = { "text/plain": vorbelegt };
  return {
    store,
    setData(typ, wert) {
      store[typ] = wert;
    },
    getData(typ) {
      return store[typ] ?? "";
    },
  };
}

function ereignisFeuern(
  ziel: HTMLElement,
  typ: "copy" | "cut" | "dragstart",
  daten: Behaelter,
): Event {
  const ev = new Event(typ, { bubbles: true, cancelable: true });
  Object.defineProperty(ev, typ === "dragstart" ? "dataTransfer" : "clipboardData", {
    value: daten,
  });
  ziel.dispatchEvent(ev);
  return ev;
}

// Der immer gleiche Vorlauf: fragen, antworten lassen, Quellen aufloesen, Koerper kuerzen.
async function bisZurAntwort(evidence: unknown, optionen: LaufOptionen = {}): Promise<Laufzeit> {
  const lauf = taskpaneStarten(evidence, optionen);
  await ruhe();
  el<HTMLTextAreaElement>("ask-input").value = "Wie oft wird Ventil V4 geprueft?";
  el("ask-btn").click();
  await ruhe();
  lauf.quellenAufloesen();
  await ruhe();
  return lauf;
}

describe("mega36 B1/B2 · der native Ausgang geht durch dieselbe Ableitung", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("GANZE Auswahl + Cmd+C (bzw. Kontextmenue-Kopieren): die Ereignis-Zwischenablage traegt Einstufung und Quelle", async () => {
    await bisZurAntwort({ grade: "unverified" });
    const feld = el<HTMLTextAreaElement>("ask-answer-edit");
    feld.value = GEKUERZT;
    feld.setSelectionRange(0, feld.value.length);

    const daten = behaelter(GEKUERZT);
    const ev = ereignisFeuern(feld, "copy", daten);

    // Der native Weg wurde abgefangen — sonst schriebe der Host den rohen Feldwert.
    expect(ev.defaultPrevented).toBe(true);
    const text = daten.getData("text/plain");
    expect(text).toContain(GEKUERZT);
    expect(text).toContain("Einstufung: ungeprueft");
    expect(text).toContain("Wartungsplan Ventil V4");
    expect(text).toContain("KLARWERK-Wissen");
    // Genau EINMAL — der abgefangene Weg baut denselben Text wie die Schaltflaeche, nicht mehr.
    expect(text.split("Einstufung:").length).toBe(2);
    expect(text.split("Quelle:").length).toBe(2);
  });

  it("der abgefangene Text ist ZEICHENGLEICH mit dem der Schaltflaeche — ein Bauer, alle Wege", async () => {
    const lauf = await bisZurAntwort({ grade: "verified" });
    const feld = el<HTMLTextAreaElement>("ask-answer-edit");
    feld.value = GEKUERZT;
    feld.setSelectionRange(0, feld.value.length);
    const daten = behaelter(GEKUERZT);
    ereignisFeuern(feld, "copy", daten);

    el("ask-copy-btn").click();
    await ruhe();

    expect(lauf.kopiert).toHaveLength(1);
    expect(daten.getData("text/plain")).toBe(lauf.kopiert[0]);
  });

  it("TEILAUSWAHL bleibt roh — ein Bruchstueck ist keine Antwort und traegt deshalb keine Einstufung", async () => {
    await bisZurAntwort({ grade: "unverified" });
    const feld = el<HTMLTextAreaElement>("ask-answer-edit");
    feld.value = GEKUERZT;
    feld.setSelectionRange(0, 10); // „Ventil V4 " — drei Woerter, kein Antwortkoerper

    const daten = behaelter("Ventil V4 ");
    const ev = ereignisFeuern(feld, "copy", daten);

    expect(ev.defaultPrevented).toBe(false);
    expect(daten.getData("text/plain")).toBe("Ventil V4 ");
    expect(daten.getData("text/plain")).not.toContain("Einstufung");
    // ...aber die Oberflaeche SCHWEIGT dazu nicht: die Teilauswahl wird ehrlich benannt.
    expect(el("ask-status").textContent || "").toContain("Teilauswahl");
  });

  it("ganze Auswahl trotz umgebender Leerzeichen zaehlt als ganzer Koerper", async () => {
    await bisZurAntwort({ grade: "unverified" });
    const feld = el<HTMLTextAreaElement>("ask-answer-edit");
    feld.value = `\n${GEKUERZT}\n\n`;
    // Die Nutzerin markiert nur die Textzeile, nicht die leeren Zeilen davor/danach.
    feld.setSelectionRange(1, 1 + GEKUERZT.length);
    const daten = behaelter(GEKUERZT);
    const ev = ereignisFeuern(feld, "copy", daten);

    expect(ev.defaultPrevented).toBe(true);
    expect(daten.getData("text/plain")).toContain("Einstufung: ungeprueft");
  });

  it("AUSSCHNEIDEN geht denselben Weg — und entfernt den Koerper wie ein natives Ausschneiden", async () => {
    await bisZurAntwort({ grade: "unverified" });
    const feld = el<HTMLTextAreaElement>("ask-answer-edit");
    feld.value = GEKUERZT;
    feld.setSelectionRange(0, feld.value.length);

    const daten = behaelter(GEKUERZT);
    const ev = ereignisFeuern(feld, "cut", daten);

    expect(ev.defaultPrevented).toBe(true);
    expect(daten.getData("text/plain")).toContain("Einstufung: ungeprueft");
    expect(daten.getData("text/plain")).toContain("Wartungsplan Ventil V4");
    // Ausschneiden schneidet: der markierte Bereich ist danach weg (kein Kopieren mit Nebenwirkung).
    expect(feld.value).toBe("");
  });

  it("ZIEHEN einer ganzen Auswahl legt ebenfalls den abgeleiteten Text an", async () => {
    await bisZurAntwort({ grade: "unverified" });
    const feld = el<HTMLTextAreaElement>("ask-answer-edit");
    feld.value = GEKUERZT;
    feld.setSelectionRange(0, feld.value.length);

    const daten = behaelter(GEKUERZT);
    ereignisFeuern(feld, "dragstart", daten);
    expect(daten.getData("text/plain")).toContain("Einstufung: ungeprueft");
    expect(daten.getData("text/plain")).toContain("Wartungsplan Ventil V4");
  });

  it("ohne belegte Antwort wird NICHTS abgefangen — das Fragefeld bleibt ein normales Feld", async () => {
    taskpaneStarten({ grade: "unverified" });
    await ruhe();
    const frage = el<HTMLTextAreaElement>("ask-input");
    frage.value = "Wie oft wird Ventil V4 geprueft?";
    frage.setSelectionRange(0, frage.value.length);
    const daten = behaelter(frage.value);
    const ev = ereignisFeuern(frage, "copy", daten);
    expect(ev.defaultPrevented).toBe(false);
    expect(daten.getData("text/plain")).toBe("Wie oft wird Ventil V4 geprueft?");
  });
});

describe("mega36 B3 · der Fehler-Rueckfall bietet den ABGELEITETEN Text an", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("scheitert die Zwischenablage, steht der vollstaendige Text als nur lesbares Feld bereit", async () => {
    await bisZurAntwort({ grade: "unverified" }, { clipboardFehler: true });
    el<HTMLTextAreaElement>("ask-answer-edit").value = GEKUERZT;
    el("ask-copy-btn").click();
    await ruhe();

    const rueckfall = el<HTMLTextAreaElement>("ask-copy-fallback-text");
    expect(rueckfall.readOnly).toBe(true);
    expect(el("ask-copy-fallback").className).not.toContain("hidden");
    expect(rueckfall.value).toContain(GEKUERZT);
    expect(rueckfall.value).toContain("Einstufung: ungeprueft");
    expect(rueckfall.value).toContain("Wartungsplan Ventil V4");
    // Der Rueckfalltext schickt die Nutzerin NICHT mehr auf das Antwortfeld.
    const status = el("ask-status").textContent || "";
    expect(status).not.toContain("Text im Feld markieren");
  });

  it("in DE, EN und NL fordert der Rueckfalltext nirgends mehr das Kopieren des reinen Koerpers", () => {
    const html = readFileSync(resolve(process.cwd(), TASKPANE), "utf8");
    expect(html).not.toContain("bitte den Text im Feld markieren und manuell kopieren");
    expect(html).not.toContain("please select the text in the field and copy it manually");
    expect(html).not.toContain("selecteer de tekst in het veld en kopieer deze handmatig");
    for (const key of ['askCopyFail: "', 'askCopyFallbackHint: "', 'askCopyPartial: "']) {
      expect(html.split(key).length - 1, key).toBe(3);
    }
  });
});

describe("mega36 D · die Zusammensetzung doppelt nicht (bens GELB-2)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("DER GEGENFALL: ein Koerper, der Einstufung und Quellen-Zeile SCHON traegt, bekommt sie nicht doppelt", async () => {
    const lauf = await bisZurAntwort({ grade: "unverified" });
    // Genau der reale Weg: die Nutzerin hat die volle Ausgabe einmal kopiert und wieder eingefuegt.
    el("ask-copy-btn").click();
    await ruhe();
    const volltext = lauf.kopiert[0] as string;
    expect(volltext).toContain("Einstufung:");

    el<HTMLTextAreaElement>("ask-answer-edit").value = volltext;
    el("ask-copy-btn").click();
    await ruhe();

    const zweite = lauf.kopiert[1] as string;
    expect(zweite.split("Einstufung:").length).toBe(2);
    expect(zweite.split("Quelle:").length).toBe(2);
    expect(zweite).toBe(volltext);
  });

  it('KALIBRIERUNG: ein Koerper, der das Wort „Quelle" nur ERWAEHNT, wird nicht beschnitten', async () => {
    const lauf = await bisZurAntwort({ grade: "unverified" });
    const mitWort = "Die Quelle des Drucks ist Ventil V4.\nQuelle: unbekannte Anlage";
    el<HTMLTextAreaElement>("ask-answer-edit").value = mitWort;
    el("ask-copy-btn").click();
    await ruhe();

    const text = lauf.kopiert[0] as string;
    // Beide Zeilen der Nutzerin bleiben stehen — nur die ECHTE Metazeile des Panels wird erkannt.
    expect(text).toContain("Die Quelle des Drucks ist Ventil V4.");
    expect(text).toContain("Quelle: unbekannte Anlage");
    expect(text).toContain("Wartungsplan Ventil V4");
    expect(text.split("Einstufung:").length).toBe(2);
  });
});

// ================================================================================================
// AUFTRAG-mega37 BLOCK C1 — DAS ZEITFENSTER DER QUELLENAUFLOESUNG.
// ================================================================================================
//
// bens ROT-Befund zu mega36: Sobald `/api/ask` geantwortet hat, steht der Antwortkoerper im Feld —
// die Quellentitel werden DANACH asynchron geladen. Die beiden Schaltflaechen bleiben in diesem
// Fenster gesperrt (`currentAskSourcesResolved`), die NATIVEN Wege pruefen den Zustand nicht. Ein
// Cmd+C, ein Cmd+X oder ein Ziehen in genau diesem Moment baut die Quellen-Zeile mit dem
// generischen Namen `KLARWERK` statt mit den Belegen — eine Angabe, die aussieht wie ein Beleg
// und keiner ist.
//
// Warum das bis hier ungetestet war: der Vorlauf `bisZurAntwort` loest die Quellen VOR jeder
// Ausgabe auf. Dieser Vorlauf haelt das Tor absichtlich zu.
async function bisZurAntwortOhneQuellen(
  evidence: unknown,
  optionen: LaufOptionen = {},
): Promise<Laufzeit> {
  const lauf = taskpaneStarten(evidence, optionen);
  await ruhe();
  el<HTMLTextAreaElement>("ask-input").value = "Wie oft wird Ventil V4 geprueft?";
  el("ask-btn").click();
  await ruhe();
  return lauf; // `quellenAufloesen` wird ABSICHTLICH nicht gerufen — das Fenster bleibt offen.
}

describe("mega37 A · ein Tor, fuer alle Ausgaenge dasselbe", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("A1/A3/A4 · Cmd+C waehrend der Aufloesung: die Zwischenablage bleibt LEER, der Standard-Export ist verhindert, die Oberflaeche sagt es", async () => {
    await bisZurAntwortOhneQuellen({ grade: "unverified" });
    // KALIBRIERUNG: das Fenster ist wirklich offen — sonst pruefte der Test nichts.
    expect(el<HTMLButtonElement>("ask-copy-btn").disabled).toBe(true);
    const feld = el<HTMLTextAreaElement>("ask-answer-edit");
    feld.setSelectionRange(0, feld.value.length);

    const daten = behaelter("");
    const ev = ereignisFeuern(feld, "copy", daten);

    expect(ev.defaultPrevented).toBe(true); // A3
    expect(daten.getData("text/plain")).toBe(""); // A1 — nichts geht hinaus
    expect(daten.getData("text/plain")).not.toContain("KLARWERK");
    expect(el("ask-status").textContent || "").toContain("NOCH NICHT ausgegeben"); // A4
  });

  it("A2 · Cmd+X waehrend der Aufloesung schneidet NICHT — der Koerper bleibt im Feld stehen", async () => {
    await bisZurAntwortOhneQuellen({ grade: "unverified" });
    const feld = el<HTMLTextAreaElement>("ask-answer-edit");
    const vorher = feld.value;
    feld.setSelectionRange(0, feld.value.length);

    const daten = behaelter("");
    const ev = ereignisFeuern(feld, "cut", daten);

    expect(ev.defaultPrevented).toBe(true);
    expect(daten.getData("text/plain")).toBe("");
    // Der schlimmste Fall waere: geschnitten UND nichts in der Zwischenablage. Er tritt nicht ein.
    expect(feld.value).toBe(vorher);
    expect(el("ask-status").textContent || "").toContain("NOCH NICHT ausgegeben");
  });

  it("A1/A3 · Ziehen waehrend der Aufloesung legt NICHTS an und bricht den Ziehvorgang ab", async () => {
    await bisZurAntwortOhneQuellen({ grade: "unverified" });
    const feld = el<HTMLTextAreaElement>("ask-answer-edit");
    feld.setSelectionRange(0, feld.value.length);

    const daten = behaelter("");
    const ev = ereignisFeuern(feld, "dragstart", daten);

    expect(ev.defaultPrevented).toBe(true);
    expect(daten.getData("text/plain")).toBe("");
    // Beim Ziehen erschien bisher GAR KEIN Hinweis — jetzt derselbe wie an den anderen Ausgaengen.
    expect(el("ask-status").textContent || "").toContain("NOCH NICHT ausgegeben");
  });

  it("A6 · ohne Zwischenablage-Schnittstelle entsteht waehrend der Aufloesung KEIN Rueckfall-Volltext mit generischem Titel", async () => {
    await bisZurAntwortOhneQuellen({ grade: "unverified" });
    const feld = el<HTMLTextAreaElement>("ask-answer-edit");
    feld.setSelectionRange(0, feld.value.length);

    // Genau der Rueckfallweg aus mega36 B3 — nur eben im offenen Zeitfenster.
    const ev = new Event("copy", { bubbles: true, cancelable: true });
    Object.defineProperty(ev, "clipboardData", { value: null });
    feld.dispatchEvent(ev);

    expect(ev.defaultPrevented).toBe(true);
    expect(el("ask-copy-fallback").className).toContain("hidden");
    expect(el<HTMLTextAreaElement>("ask-copy-fallback-text").value).toBe("");
    expect(el("ask-status").textContent || "").toContain("NOCH NICHT ausgegeben");
  });

  it("A5 · NACH der Aufloesung traegt derselbe Weg die ECHTEN Quellentitel — nie den generischen Namen", async () => {
    const lauf = await bisZurAntwortOhneQuellen({ grade: "unverified" });
    const feld = el<HTMLTextAreaElement>("ask-answer-edit");
    feld.setSelectionRange(0, feld.value.length);

    const gesperrt = behaelter("");
    ereignisFeuern(feld, "copy", gesperrt);
    expect(gesperrt.getData("text/plain")).toBe("");

    lauf.quellenAufloesen();
    await ruhe();

    expect(el<HTMLButtonElement>("ask-copy-btn").disabled).toBe(false);
    feld.setSelectionRange(0, feld.value.length);
    const offen = behaelter("");
    const ev = ereignisFeuern(feld, "copy", offen);

    expect(ev.defaultPrevented).toBe(true);
    const text = offen.getData("text/plain");
    expect(text).toContain("Wartungsplan Ventil V4");
    expect(text).not.toContain("Quelle: KLARWERK"); // der generische Name als Beleg — nie wieder
    expect(el("ask-status").textContent || "").not.toContain("NOCH NICHT ausgegeben");
  });
});

describe("mega37 B · die Teilausnahme sagt an JEDEM Ausgang dasselbe", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("Ziehen einer TEILAUSWAHL bleibt roh — aber die Oberflaeche benennt es jetzt wie beim Kopieren", async () => {
    await bisZurAntwort({ grade: "unverified" });
    const feld = el<HTMLTextAreaElement>("ask-answer-edit");
    feld.value = GEKUERZT;
    feld.setSelectionRange(0, 10);

    const daten = behaelter("Ventil V4 ");
    const ev = ereignisFeuern(feld, "dragstart", daten);

    // Die Ausnahme SELBST bleibt: ein Satzfragment braucht keinen Metablock.
    expect(ev.defaultPrevented).toBe(false);
    expect(daten.getData("text/plain")).toBe("Ventil V4 ");
    expect(daten.getData("text/plain")).not.toContain("Einstufung");
    // Falsch war nur das Schweigen — der Hinweis ist jetzt an allen drei Wegen derselbe.
    expect(el("ask-status").textContent || "").toContain("Teilauswahl");
  });
});
