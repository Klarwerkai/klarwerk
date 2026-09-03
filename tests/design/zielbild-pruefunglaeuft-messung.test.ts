// @vitest-environment jsdom
// ================================================================================================
// JOB 3012 · D3 „PRUEFUNG LAEUFT“ — DER WARTEZUSTAND, AM LAUFENDEN PANEL GEMESSEN.
// ================================================================================================
//
// PEDIS FRAGE: „Was sieht der Mensch in Word, waehrend Klara sucht — und ist das, was er sieht, das,
// was ich gezeichnet habe?“
//
// Bis zu diesem Auftrag war der Wartezustand des Aufgabenfensters von KEINEM ausgefuehrten Test
// gemessen: `word-addin-ask.test.ts:788/870` pinnen den Quelltext (`t("askBusy")`, Wortliste x3),
// mehr nicht. Dieser Test bringt das AUSGELIEFERTE `taskpane.html` ueber die Panel-Fixture
// wirklich in den Wartezustand: er schickt eine Frage ab und haelt den Ask-Fetch offen (das
// Versprechen bleibt unaufgeloest), sodass das Fenster genau zwischen `showAskStatus("warn",
// t("askBusy"))` und `renderAskOutcome(...)` steht. DORT misst er, was zu sehen ist.
//
// DANEBEN steht Zeile fuer Zeile, was das Zielbild `PruefungLaeuft.dc.html` (DESIGN_ZIELBILD_20260827)
// an derselben Stelle verlangt — GELESEN aus der Datei, nicht abgeschrieben. Der Test aendert nichts
// am Produkt; er liefert den belegten Ausgangsstand. Die Erwartungen sind das GEMESSENE, nicht das
// Erhoffte: der Test ist gruen gegen den heutigen Stand und wird rot, sobald sich der Wartezustand
// aendert — dann ist die Abweichungstabelle nachzufuehren, nicht der Test zu entschaerfen.
//
// WAS HIER BEWUSST NICHT GEMESSEN WIRD: reine Darstellungswerte (Farbe, Radius, Innenabstand,
// Schriftgrad, Balkenbreiten). jsdom rechnet kein Layout und keinen wirksamen Stil; ein statischer
// CSS-Vergleich waere eine zweite Wahrheit neben der Chromium-Panelmessung, die JOB 3004 baut.
// Solche Zeilen tragen deshalb `nicht messbar` mit Grund — nicht `erfuellt`, nicht `abweichend`.
//
// KALIBRIERUNG GEGEN DEN STILLEN NULL-TREFFER (Auftrag §6): jeder Messfall belegt zuerst, dass das
// Panel WIRKLICH im Wartezustand steht (ein Ask-Fetch ist abgegangen, sein Versprechen ist noch
// offen, `#ask-status` ist sichtbar). Loest der Fetch sofort auf oder geht die Frage nicht ab, ist
// das ein Fehlschlag, kein „0 von 0 gruen“.
//
// GEGENPROBE (Auftrag §6, einmalig gefahren, Ergebniszeilen in RUECKGABE.md): der Wortlaut
// `askBusy`, die Zeile `ask-btn.disabled = true`, eine eingefuegte Sperre `ask-input.disabled =
// true` sowie (Runde 2) je die Reset-Zeile von `#ask-answer-block` und `#ask-gap-block` in
// resetAskResult() wurden je einzeln an der Arbeitskopie von taskpane.html verfaelscht — der Fall
// mit dem Namen des verfaelschten Werts wurde rot, die Datei kam byteweise (samt Zeitstempel)
// zurueck. Zusaetzlich kippt Fall K die Sensoren im Speicher (ohne Datei) und belegt, dass sie
// mitgehen.
//
// NACHZUG JOB 3004 (Antwortkarte nach Zielbild „Main“, 03.09.2026): seit dem Umbau steht die
// Frage-Pille `#ask-frage-zeile-btn` IMMER im DOM — als Kind von `#ask-answer-block`, der ausserhalb
// des Antwortzustands `hidden` traegt. „Pille vorhanden“ heisst hier deshalb SICHTBAR (weder sie
// noch ein Vorfahre traegt `hidden`); ein verborgener Knoten ist im Wartezustand kein Pillen-Ersatz.
// Ausserdem verbirgt der Antwortzustand die Frage-Karte `#ask-karte`; beginnt aus ihm heraus ein
// neuer Ask, holt resetAskResult() die Karte zurueck — im Wartezustand ist sie also wie vor 3004
// sichtbar, und die Vorher/Nachher-Differenz nennt sie als neu sichtbar (U1). Die Urteile der
// Abweichungstabelle (1/6/17) sind davon unberuehrt: der Wartezustand selbst hat sich nicht geaendert.
//
// WAS DIE FIXTURE NICHT KANN (ABWEICHUNG, in der Rueckgabe benannt): `createKlaraPanel` antwortet
// je Route SOFORT — ein offen gehaltenes Versprechen kennt sie nicht. Geloest hier, wie in
// `job2703-d3-addin-paritaet.test.ts`: der Fake-Fetch der Fixture wird NACH dem Start durch einen
// Wrapper ersetzt, der allein `POST /api/ask` festhaelt und alles andere durchreicht. `restore()`
// der Fixture stellt den Vorzustand her.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  WERTE_FRAGEWEG_PRUEFUNG,
  cssRegel,
  inlineStyle,
  prop,
  vergleiche,
} from "../../tools/design-vergleich/werte";
import {
  type FakeResponse,
  type KlaraPanel,
  TASKPANE_PATH,
  createKlaraPanel,
  reply,
} from "../app/klara-panel-fixture";

const ZIELBILD =
  "/Users/peterkohnert/Documents/Projekt_klarwerk/DESIGN_ZIELBILD_20260827/PruefungLaeuft.dc.html";
const WURZEL = join(__dirname, "..", "..");
const PRODUKT = join(WURZEL, TASKPANE_PATH);
const zielbildDa = existsSync(ZIELBILD);
const lies = (p: string): string => readFileSync(p, "utf8");

/** Die Frage aus dem Zielbild (Z.23) — dieselbe Frage geht hier durch das echte Panel. */
const FRAGE_IM_ZIELBILD = "Welche Profile sind in Spritzzonen erlaubt?";

// ================================================================================================
// LIEFERUNG 1 — DIE SOLLWERTE, AUS DEM ZIELBILD GELESEN.
// ================================================================================================
// Je Sollwert eine benannte Kennung. Jede Kennung hat GENAU EINE Lesefunktion gegen den Text der
// dc-Datei; liefert sie null, existiert der Sollwert in der Datei nicht (Fall Z belegt: keiner
// fehlt; Fall ZK belegt: gegen eine leere Datei liefert jede Kennung null — kein Null-Null-Treffer).

type SollKennung =
  | "pille-vorhanden"
  | "pille-text"
  | "pille-hintergrund"
  | "pille-rahmen"
  | "pille-radius"
  | "pille-innenabstand"
  | "pille-schriftgrad"
  | "pille-farbe"
  | "karte-vorhanden"
  | "karte-innenabstand"
  | "karte-radius"
  | "karte-hintergrund"
  | "karte-balkenabstand"
  | "balken-anzahl"
  | "balken-hoehe"
  | "balken-radius"
  | "balken-farbe"
  | "balken-breiten"
  | "satz-wortlaut"
  | "satz-zusage-eingabe-gesperrt"
  | "satz-schriftgrad"
  | "satz-farbe"
  | "satz-ausrichtung"
  | "satz-einziger-hinweis";

/** Innentext des ersten Elements, dessen style-Attribut `anker` enthaelt. */
function innentext(z: string, anker: string): string | null {
  const re = /<div style="([^"]*)">([^<]*)<\/div>/g;
  for (let m = re.exec(z); m !== null; m = re.exec(z)) {
    if ((m[1] ?? "").includes(anker)) {
      return (m[2] ?? "").trim();
    }
  }
  return null;
}

/** Alle style-Attribute, die `anker` enthalten — fuer Zaehlung und Reihenfolge der Balken. */
function alleStile(z: string, anker: string): string[] {
  const raus: string[] = [];
  const re = /style="([^"]*)"/g;
  for (let m = re.exec(z); m !== null; m = re.exec(z)) {
    if ((m[1] ?? "").includes(anker)) {
      raus.push(m[1] ?? "");
    }
  }
  return raus;
}

const PILLE = "text-overflow: ellipsis";
const PILLE_RAHMEN = "border-radius: 10px";
const KARTE = "padding: 18px 16px";
const BALKEN = "height: 14px";
const SATZ = "text-align: center";

const SOLL_LESER: Record<SollKennung, (z: string) => string | null> = {
  // — Frage-Pille (Z.22-24) —
  "pille-vorhanden": (z) => (inlineStyle(z, PILLE_RAHMEN) === null ? null : "ja"),
  "pille-text": (z) => innentext(z, PILLE),
  "pille-hintergrund": (z) => prop(inlineStyle(z, PILLE_RAHMEN), "background"),
  "pille-rahmen": (z) => prop(inlineStyle(z, PILLE_RAHMEN), "border"),
  "pille-radius": (z) => prop(inlineStyle(z, PILLE_RAHMEN), "border-radius"),
  "pille-innenabstand": (z) => prop(inlineStyle(z, PILLE_RAHMEN), "padding"),
  "pille-schriftgrad": (z) => prop(inlineStyle(z, PILLE), "font-size"),
  "pille-farbe": (z) => prop(inlineStyle(z, PILLE), "color"),
  // — Ladekarte mit drei Balken (Z.26-30) —
  "karte-vorhanden": (z) => (inlineStyle(z, KARTE) === null ? null : "ja"),
  "karte-innenabstand": (z) => prop(inlineStyle(z, KARTE), "padding"),
  "karte-radius": (z) => prop(inlineStyle(z, KARTE), "border-radius"),
  "karte-hintergrund": (z) => prop(inlineStyle(z, KARTE), "background"),
  "karte-balkenabstand": (z) => prop(inlineStyle(z, KARTE), "gap"),
  "balken-anzahl": (z) => {
    const n = alleStile(z, BALKEN).length;
    return n === 0 ? null : String(n);
  },
  "balken-hoehe": (z) => prop(inlineStyle(z, BALKEN), "height"),
  "balken-radius": (z) => prop(inlineStyle(z, BALKEN), "border-radius"),
  "balken-farbe": (z) => prop(inlineStyle(z, BALKEN), "background"),
  "balken-breiten": (z) => {
    const breiten = alleStile(z, BALKEN).map((s) => prop(s, "width") ?? "?");
    return breiten.length === 0 ? null : breiten.join(" / ");
  },
  // — EIN zentrierter Sperr-Satz (Z.32) —
  "satz-wortlaut": (z) => innentext(z, SATZ),
  "satz-zusage-eingabe-gesperrt": (z) => {
    const satz = innentext(z, SATZ);
    if (satz === null) {
      return null;
    }
    return satz.includes("Eingabe ist so lange gesperrt") ? "gesperrt" : "nicht zugesagt";
  },
  "satz-schriftgrad": (z) => prop(inlineStyle(z, SATZ), "font-size"),
  "satz-farbe": (z) => prop(inlineStyle(z, SATZ), "color"),
  "satz-ausrichtung": (z) => prop(inlineStyle(z, SATZ), "text-align"),
  "satz-einziger-hinweis": (z) => {
    const n = alleStile(z, SATZ).length;
    return n === 0 ? null : String(n);
  },
};

const SOLL_KENNUNGEN = Object.keys(SOLL_LESER) as SollKennung[];

function sollwerte(z: string): Record<SollKennung, string | null> {
  const raus = {} as Record<SollKennung, string | null>;
  for (const k of SOLL_KENNUNGEN) {
    raus[k] = SOLL_LESER[k](z);
  }
  return raus;
}

// ================================================================================================
// LIEFERUNG 2 — DAS PANEL IM WARTEZUSTAND.
// ================================================================================================

/** Schmale Sicht auf das jsdom-Dokument (der Gate-tsc hat keine DOM-lib; s. Fixture-Kopf). */
interface DomKnoten {
  id: string;
  getAttribute(name: string): string | null;
  /** Naechster Vorfahre (einschliesslich selbst), der `selector` trifft — jsdom liefert ihn. */
  closest(selector: string): DomKnoten | null;
}
interface DomSicht {
  querySelectorAll(selector: string): ArrayLike<DomKnoten>;
}
interface EreignisFaehig {
  dispatchEvent(ereignis: unknown): boolean;
}
interface EreignisFabrik {
  new (typ: string): unknown;
}

function dom(): DomSicht {
  return (globalThis as unknown as { document: DomSicht }).document;
}

function versteckt(k: Pick<DomKnoten, "getAttribute">): boolean {
  return (k.getAttribute("class") ?? "").split(/\s+/).includes("hidden");
}

/** Ist die erste Stelle zu `selector` sichtbar — d. h. traegt weder sie noch ein Vorfahre `hidden`? */
function sichtbarImDom(selector: string): boolean {
  const k = dom().querySelectorAll(selector)[0];
  if (k === undefined) {
    return false;
  }
  return k.closest(".hidden") === null;
}

/** Welche `[id]`-Elemente tragen gerade die Klasse `hidden`? Grundlage der Vorher/Nachher-Differenz. */
function verstecktBild(): Map<string, boolean> {
  const bild = new Map<string, boolean>();
  const alle = dom().querySelectorAll("[id]");
  for (let i = 0; i < alle.length; i += 1) {
    const k = alle[i];
    if (k !== undefined) {
      bild.set(k.id, versteckt(k));
    }
  }
  return bild;
}

/** Was ein Mensch im Wartezustand sieht — ein Bild, keine Einzelabfragen. */
interface Wartebild {
  statusText: string;
  statusKlasse: string;
  statusSichtbar: boolean;
  knopfGesperrt: boolean;
  eingabeGesperrt: boolean;
  eingabeWert: string;
  /** Die Pille ist SICHTBAR (JOB 3004: im DOM steht sie immer, verborgen bis zur Antwort). */
  pilleVorhanden: boolean;
  /** Text der sichtbaren Pille — sonst null. NICHT der Wert des Eingabefelds. */
  pilleText: string | null;
  ladebalken: number;
  antwortBlockVersteckt: boolean;
  lueckeBlockVersteckt: boolean;
  quellenBlockVersteckt: boolean;
  /** Ids, die VOR dem Absenden `hidden` trugen und im Wartezustand nicht mehr. */
  neuSichtbar: string[];
  /** Ids, die VOR dem Absenden sichtbar waren und im Wartezustand `hidden` tragen. */
  neuVersteckt: string[];
}

function pflicht(panel: KlaraPanel, selector: string) {
  const el = panel.q(selector);
  if (el === null) {
    throw new Error(`Panel: Stelle ${selector} existiert nicht`);
  }
  return el;
}

function wartebild(panel: KlaraPanel, vorher: Map<string, boolean>): Wartebild {
  const nachher = verstecktBild();
  const neuSichtbar: string[] = [];
  const neuVersteckt: string[] = [];
  for (const [id, hidden] of nachher) {
    const war = vorher.get(id);
    if (war === true && !hidden) {
      neuSichtbar.push(id);
    }
    if (war === false && hidden) {
      neuVersteckt.push(id);
    }
  }
  const status = pflicht(panel, "#ask-status");
  // JOB 3004: die Pille existiert im DOM immer — gemessen wird, ob sie SICHTBAR ist (s. Kopf).
  const pilleSichtbar = sichtbarImDom("#ask-frage-zeile-btn") || sichtbarImDom("#ask-frage-zeile");
  const pille = pilleSichtbar
    ? (panel.q("#ask-frage-zeile-btn") ?? panel.q("#ask-frage-zeile"))
    : null;
  return {
    pilleText: pille === null ? null : (pille.textContent ?? "").trim(),
    statusText: status.textContent ?? "",
    statusKlasse: status.className,
    statusSichtbar: !status.className.split(/\s+/).includes("hidden"),
    knopfGesperrt: pflicht(panel, "#ask-btn").disabled,
    eingabeGesperrt: pflicht(panel, "#ask-input").disabled,
    eingabeWert: pflicht(panel, "#ask-input").value,
    pilleVorhanden: pilleSichtbar,
    ladebalken: dom().querySelectorAll(".ladebalken").length,
    antwortBlockVersteckt: versteckt(pflicht(panel, "#ask-answer-block")),
    lueckeBlockVersteckt: versteckt(pflicht(panel, "#ask-gap-block")),
    quellenBlockVersteckt: versteckt(pflicht(panel, "#ask-sources-block")),
    neuSichtbar,
    neuVersteckt,
  };
}

/** Der offen gehaltene Ask-Fetch: abgegangen, aber nicht aufgeloest — bis `freigeben()`. */
interface OffenerAsk {
  panel: KlaraPanel;
  /** Wie oft `POST /api/ask` abgegangen ist, seit `halten` gilt. */
  abgegangen(): number;
  /** Ist das Versprechen des gehaltenen Fetch noch offen? */
  offen(): boolean;
  /** Ab jetzt wird `POST /api/ask` festgehalten; vorher laeuft alles ueber die Fixture-Routen. */
  halten(): void;
  freigeben(): void;
  /** Die Fristen (ms), die das Panel waehrend des Absendens per setTimeout gesetzt hat. */
  fristen: number[];
  absenden(frage: string): Wartebild;
}

const ANTWORT_NACH_FREIGABE: FakeResponse = {
  ok: true,
  status: 200,
  headers: { get: () => null },
  json: async () => ({ result: { answered: false, answer: null, sources: [] } }),
};

const ANTWORT_MIT_QUELLE = reply(200, {
  result: {
    answered: true,
    answer: "Nur Profile mit Kennzeichnung S sind in Spritzzonen erlaubt.",
    sources: ["ko-3012"],
    trust: 80,
  },
});

/** Die ehrliche Wissensluecke: `answered: false` — das Panel zeigt #ask-gap-block. */
const ANTWORT_LUECKE = reply(200, { result: { answered: false, answer: null, sources: [] } });

/** Welche Ergebnisart das Panel VOR dem Warten zeigen soll (Fixture-Route fuer /api/ask). */
type VorigesErgebnis = "antwort" | "luecke";

let offener: OffenerAsk | null = null;

function panelMitOffenemAsk(voriges: VorigesErgebnis = "antwort"): OffenerAsk {
  const panel = createKlaraPanel({
    routes: { "/api/ask": voriges === "antwort" ? ANTWORT_MIT_QUELLE : ANTWORT_LUECKE },
  });
  // NACH dem Start: die Fixture hat ihren Fake-Fetch gesetzt; er bleibt fuer alles ausser dem
  // gehaltenen Ask der Weg. `restore()` der Fixture setzt am Ende den Vorzustand zurueck.
  const fixtureFetch = globalThis.fetch;
  let haelt = false;
  let anzahl = 0;
  let aufgeloest = false;
  let loese: (r: FakeResponse) => void = () => undefined;
  const versprechen = new Promise<FakeResponse>((res) => {
    loese = res;
  });
  const gehalten = (async (eingabe: unknown, init?: RequestInit): Promise<unknown> => {
    const url = String(eingabe);
    if (haelt && url === "/api/ask" && (init?.method ?? "GET").toUpperCase() === "POST") {
      anzahl += 1;
      return versprechen;
    }
    return fixtureFetch(eingabe as string, init);
  }) as typeof globalThis.fetch;
  globalThis.fetch = gehalten;
  (globalThis as unknown as { window: { fetch: unknown } }).window.fetch = gehalten;

  const fristen: number[] = [];
  return {
    panel,
    abgegangen: () => anzahl,
    offen: () => !aufgeloest,
    halten: () => {
      haelt = true;
    },
    freigeben: () => {
      if (!aufgeloest) {
        aufgeloest = true;
        loese(ANTWORT_NACH_FREIGABE);
      }
    },
    fristen,
    absenden(frage: string): Wartebild {
      pflicht(panel, "#ask-input").value = frage;
      const vorher = verstecktBild();
      // Die Frist wird beim Absenden gesetzt (performAsk → setTimeout). Der Fixture-Timer wird
      // nur fuer den synchronen Teil des Absendens umwickelt, damit allein diese Fristen zaehlen.
      const fixtureSetTimeout = globalThis.setTimeout;
      const zaehler = ((handler: () => void, ms?: number) => {
        fristen.push(ms ?? 0);
        return fixtureSetTimeout(handler, ms);
      }) as unknown as typeof globalThis.setTimeout;
      globalThis.setTimeout = zaehler;
      try {
        panel.askKlara();
      } finally {
        globalThis.setTimeout = fixtureSetTimeout;
      }
      return wartebild(panel, vorher);
    },
  };
}

/** Belegt, dass das Panel WIRKLICH wartet — sonst misst der Rest nichts. */
function imWartezustand(o: OffenerAsk, bild: Wartebild): void {
  expect(o.abgegangen(), "kein POST /api/ask abgegangen — kein Wartezustand").toBe(1);
  expect(o.offen(), "der Ask-Fetch ist schon aufgeloest — kein Wartezustand").toBe(true);
  expect(bild.statusSichtbar, "#ask-status ist nicht sichtbar — kein Wartezustand").toBe(true);
}

afterEach(async () => {
  if (offener) {
    offener.freigeben();
    await offener.panel.flush();
    offener.panel.restore();
    offener = null;
  }
});

// ================================================================================================
// LIEFERUNG 5 — DIE ABWEICHUNGSTABELLE (je Sollwert eine Zeile).
// ================================================================================================

const CHROMIUM = "nicht messbar (braucht die Chromium-Panelmessung aus JOB 3004)";
type Urteil = "erfüllt" | "abweichend" | typeof CHROMIUM;
interface Zeile {
  kennung: SollKennung;
  soll: string;
  ist: string;
  beleg: string;
  urteil: Urteil;
  /**
   * Ein GESONDERTER Ist-Befund, der NICHT in das Urteil eingeht: was das Produkt an anderer Stelle
   * tut. Ein gleichlautender Text in einem anderen Bedienelement ist keine Zielerfuellung (BEN,
   * Runde 1, Korrekturpflicht 2).
   */
  istBefund?: string;
}

const NICHT_VORHANDEN = "im Produkt nicht vorhanden";

/**
 * Die Regel hinter der Tabelle: fehlt der TRAEGER einer Soll-Eigenschaft (Pille, Ladekarte,
 * Balken, Absatz), darf keine von ihm abhaengige Zeile `erfuellt` tragen. Fall T haelt sie gegen
 * jede Zeile; welche Zeilen an welchem Traeger haengen, steht hier — nicht im Kopf des Lesers.
 */
const TRAEGER_VON: Partial<Record<SollKennung, "pille" | "karte" | "balken">> = {
  "pille-text": "pille",
  "pille-hintergrund": "pille",
  "pille-rahmen": "pille",
  "pille-radius": "pille",
  "pille-innenabstand": "pille",
  "pille-schriftgrad": "pille",
  "pille-farbe": "pille",
  "karte-innenabstand": "karte",
  "karte-radius": "karte",
  "karte-hintergrund": "karte",
  "karte-balkenabstand": "karte",
  "balken-hoehe": "balken",
  "balken-radius": "balken",
  "balken-farbe": "balken",
  "balken-breiten": "balken",
};

function traegerFehlt(w: Wartebild, traeger: "pille" | "karte" | "balken"): boolean {
  if (traeger === "pille") {
    return !w.pilleVorhanden;
  }
  if (traeger === "balken") {
    return w.ladebalken === 0;
  }
  // Die Karte ist da, wenn beim Absenden etwas anderes als allein #ask-status neu sichtbar wird.
  return w.neuSichtbar.length === 1 && w.neuSichtbar[0] === "ask-status";
}

function abweichungstabelle(soll: Record<SollKennung, string | null>, w: Wartebild): Zeile[] {
  const s = (k: SollKennung): string => soll[k] ?? "(Sollwert fehlt)";
  const darstellung = (k: SollKennung, traeger: string, beleg: string): Zeile => ({
    kennung: k,
    soll: s(k),
    ist: `${NICHT_VORHANDEN} (kein Träger: ${traeger})`,
    beleg,
    urteil: CHROMIUM,
  });
  return [
    // — Frage-Pille —
    {
      kennung: "pille-vorhanden",
      soll: s("pille-vorhanden"),
      ist: w.pilleVorhanden ? "ja" : NICHT_VORHANDEN,
      beleg: "#ask-frage-zeile-btn / #ask-frage-zeile im laufenden DOM",
      urteil: w.pilleVorhanden ? "erfüllt" : "abweichend",
    },
    {
      kennung: "pille-text",
      soll: s("pille-text"),
      // Ohne Pille gibt es keinen Pillentext — was im Eingabefeld steht, ist ein anderes
      // Bedienelement und wird nur als gesonderter Ist-Befund gefuehrt, nie als Erfuellung.
      ist: w.pilleText === null ? `${NICHT_VORHANDEN} (keine Pille)` : w.pilleText,
      beleg: "#ask-frage-zeile-btn.textContent im laufenden DOM",
      urteil: w.pilleText !== null && w.pilleText === s("pille-text") ? "erfüllt" : "abweichend",
      istBefund: `Frage bleibt im Eingabefeld #ask-input lesbar: „${w.eingabeWert}“ (kein Pillen-Ersatz)`,
    },
    darstellung("pille-hintergrund", "Pille", "cssProp(#ask-frage-zeile-btn) — Element fehlt"),
    darstellung("pille-rahmen", "Pille", "cssProp(#ask-frage-zeile-btn) — Element fehlt"),
    darstellung("pille-radius", "Pille", "cssProp(#ask-frage-zeile-btn) — Element fehlt"),
    darstellung("pille-innenabstand", "Pille", "cssProp(#ask-frage-zeile-btn) — Element fehlt"),
    darstellung("pille-schriftgrad", "Pille", "cssProp(#ask-frage-zeile) — Element fehlt"),
    darstellung("pille-farbe", "Pille", "cssProp(#ask-frage-zeile) — Element fehlt"),
    // — Ladekarte —
    {
      kennung: "karte-vorhanden",
      soll: s("karte-vorhanden"),
      ist: `${NICHT_VORHANDEN}; einzige neue Fläche: ${w.neuSichtbar.join(", ")} (${w.statusKlasse})`,
      beleg: "Vorher/Nachher-Differenz der hidden-Klassen über alle [id]-Elemente",
      urteil:
        w.neuSichtbar.length === 1 && w.neuSichtbar[0] === "ask-status" ? "abweichend" : "erfüllt",
    },
    darstellung("karte-innenabstand", "Ladekarte", ".status statt Karte"),
    darstellung("karte-radius", "Ladekarte", ".status statt Karte"),
    darstellung("karte-hintergrund", "Ladekarte", ".status.warn statt Karte"),
    darstellung("karte-balkenabstand", "Ladekarte", "keine Balken"),
    {
      kennung: "balken-anzahl",
      soll: s("balken-anzahl"),
      ist: String(w.ladebalken),
      beleg: "querySelectorAll('.ladebalken').length im Wartezustand",
      urteil: String(w.ladebalken) === s("balken-anzahl") ? "erfüllt" : "abweichend",
    },
    darstellung("balken-hoehe", "Balken", "cssRegel(.ladebalken) — Regel fehlt"),
    darstellung("balken-radius", "Balken", "cssRegel(.ladebalken) — Regel fehlt"),
    darstellung("balken-farbe", "Balken", "cssRegel(.ladebalken) — Regel fehlt"),
    darstellung("balken-breiten", "Balken", "cssRegel(.ladebalken:nth-child(n)) — Regel fehlt"),
    // — Sperr-Satz —
    {
      kennung: "satz-wortlaut",
      soll: s("satz-wortlaut"),
      ist: w.statusText,
      beleg: "#ask-status.textContent im Wartezustand",
      urteil: w.statusText === s("satz-wortlaut") ? "erfüllt" : "abweichend",
    },
    {
      kennung: "satz-zusage-eingabe-gesperrt",
      soll: s("satz-zusage-eingabe-gesperrt"),
      ist: w.eingabeGesperrt ? "gesperrt" : `nicht gesperrt (nur #ask-btn: ${w.knopfGesperrt})`,
      beleg: "#ask-input.disabled / #ask-btn.disabled im Wartezustand",
      urteil:
        (w.eingabeGesperrt ? "gesperrt" : "nicht gesperrt") === s("satz-zusage-eingabe-gesperrt")
          ? "erfüllt"
          : "abweichend",
    },
    darstellung("satz-schriftgrad", "Absatz", `.status (${w.statusKlasse}) statt Absatz`),
    darstellung("satz-farbe", "Absatz", ".status.warn statt Absatz"),
    darstellung("satz-ausrichtung", "Absatz", `.status (${w.statusKlasse}) statt Absatz`),
    {
      kennung: "satz-einziger-hinweis",
      soll: s("satz-einziger-hinweis"),
      ist: String(w.neuSichtbar.length),
      beleg: "Anzahl der neu sichtbaren Flächen (Vorher/Nachher-Differenz)",
      urteil:
        String(w.neuSichtbar.length) === s("satz-einziger-hinweis") ? "erfüllt" : "abweichend",
    },
  ];
}

// ================================================================================================
// LIEFERUNG 6 — DIE VERLUSTLISTE, UMGEKEHRT GELESEN.
// ================================================================================================
// Jeder heutige Traeger des Wartezustands, sein Platz im Zielbild, und — wo es keinen gibt — was
// sein Verlust kostet. Die Fallgruppe V misst jeden Traeger am laufenden Panel, damit ein spaeterer
// Umbau ihn nicht unbemerkt fallen laesst.
interface Traeger {
  traeger: string;
  heute: string;
  platzImZielbild: string;
  verlust: string;
}
const VERLUSTLISTE: readonly Traeger[] = [
  {
    traeger: "#ask-status als `status warn`",
    heute:
      'showAskStatus("warn", t("askBusy")) — Warnkasten, geteilt mit askEmpty/askAuth/askTimeout/askError/s4FragenGesperrt',
    platzImZielbild: "kein Warnkasten; der einzige Hinweis ist der zentrierte 12px-Satz (Z.32)",
    verlust:
      "faellt der Traeger, verlieren fuenf Fehl- und Sperrzustaende ihre Flaeche mit — sie teilen das Element",
  },
  {
    traeger: "Wortlaut askBusy in DE/EN/NL",
    heute: "„Klara sucht im KLARWERK-Wissen ...“ + EN + NL, gepinnt durch mega35-Wortliste",
    platzImZielbild:
      "ein deutscher Satz (Z.32) — „im freigegebenen Wissen — die Eingabe ist so lange gesperrt.“; EN/NL nicht gezeichnet",
    verlust:
      "zwei Uebersetzungen und der Wortlisten-Pin muessten mit — sonst spricht das Panel in EN/NL vom alten, in DE vom neuen Zustand",
  },
  {
    traeger: "Knopfsperre #ask-btn.disabled = true",
    heute: "gesetzt beim Absenden, aufgehoben durch updateAskState() nach Antwort",
    platzImZielbild: "in der Zusage „die Eingabe ist so lange gesperrt“ enthalten (Z.32)",
    verlust: "keiner — das Zielbild verlangt mehr, nicht weniger",
  },
  {
    traeger: "resetAskResult() vor dem Warten",
    heute: "Antwortblock, Lueckenblock, Quellen, KI-Kennzeichnung, Einstufung werden geraeumt",
    platzImZielbild: "die Ladekarte steht allein — kein voriges Ergebnis sichtbar (Z.26-30)",
    verlust: "keiner — das Zielbild zeigt dasselbe Ergebnis",
  },
  {
    traeger: "Frist WORD_ADDIN_ASK_TIMEOUT_MS = 15000",
    heute: "setTimeout beim Absenden; danach askTimeout in #ask-status",
    platzImZielbild: "keiner — das Zielbild zeichnet kein Ende der Wartezeit („so lange“)",
    verlust: "ohne Frist sperrt „so lange gesperrt“ bei haengendem Server das Fenster dauerhaft",
  },
];

// ================================================================================================
// DIE FAELLE
// ================================================================================================

describe.runIf(zielbildDa)(
  "JOB 3012 · D3 · PruefungLaeuft — Wartezustand gemessen, Zielbild daneben",
  () => {
    const zielbild = lies(ZIELBILD);
    const soll = sollwerte(zielbild);

    it("Z — jede Sollkennung liest ihren Wert aus PruefungLaeuft.dc.html (keine fehlt)", () => {
      for (const k of SOLL_KENNUNGEN) {
        expect(soll[k], `Sollwert ${k} nicht im Zielbild lesbar`).not.toBeNull();
      }
      // Die tragenden Werte im Klartext — gelesen, nicht abgeschrieben; hier nur gegengehalten,
      // damit ein geaendertes Zielbild diesen Test rot macht statt still eine andere Tabelle zu bauen.
      expect(soll["pille-text"]).toBe(FRAGE_IM_ZIELBILD);
      expect(soll["balken-anzahl"]).toBe("3");
      expect(soll["balken-breiten"]).toBe("92% / 100% / 64%");
      expect(soll["satz-wortlaut"]).toBe(
        "Klara sucht im freigegebenen Wissen — die Eingabe ist so lange gesperrt.",
      );
      expect(soll["satz-zusage-eingabe-gesperrt"]).toBe("gesperrt");
      expect(soll["satz-einziger-hinweis"]).toBe("1");
      expect(SOLL_KENNUNGEN.length).toBe(24);
    });

    it("ZK — KALIBRIERUNG: gegen eine leere Datei liefert jede Sollkennung null (kein Null-Null-Treffer)", () => {
      const leer = sollwerte("<html></html>");
      for (const k of SOLL_KENNUNGEN) {
        expect(leer[k], `${k} findet einen Wert, wo keiner ist`).toBeNull();
      }
    });

    it("W1 — das Panel steht wirklich im Wartezustand: Frage abgegangen, Fetch offen, #ask-status sichtbar", async () => {
      offener = panelMitOffenemAsk();
      await offener.panel.flush();
      expect(pflicht(offener.panel, "#ask-btn").disabled, "Knopf vor dem Absenden gesperrt").toBe(
        false,
      );
      offener.halten();
      const bild = offener.absenden(FRAGE_IM_ZIELBILD);
      imWartezustand(offener, bild);
      // Und der Zustand HAELT: auch nach Abwarten aller Promise-Ketten bleibt der Fetch offen.
      await offener.panel.flush();
      expect(offener.offen()).toBe(true);
      expect(pflicht(offener.panel, "#ask-status").textContent).toBe(bild.statusText);
    });

    it("W2 — der Text in #ask-status ist askBusy „Klara sucht im KLARWERK-Wissen ...“, Fläche `status warn`", async () => {
      offener = panelMitOffenemAsk();
      await offener.panel.flush();
      offener.halten();
      const bild = offener.absenden(FRAGE_IM_ZIELBILD);
      imWartezustand(offener, bild);
      // GEMESSEN, nicht erhofft — der Wortlaut des Zielbilds ist ein anderer.
      expect(bild.statusText).toBe("Klara sucht im KLARWERK-Wissen ...");
      expect(bild.statusText).toBe(offener.panel.t("askBusy"));
      expect(bild.statusKlasse).toBe("status warn");
      expect(bild.statusText).not.toBe(soll["satz-wortlaut"]);
    });

    it("W3 — #ask-btn ist im Wartezustand gesperrt (disabled = true)", async () => {
      offener = panelMitOffenemAsk();
      await offener.panel.flush();
      offener.halten();
      const bild = offener.absenden(FRAGE_IM_ZIELBILD);
      imWartezustand(offener, bild);
      expect(bild.knopfGesperrt).toBe(true);
    });

    it("W4 — LIEFERUNG 4: das Zielbild sagt „die Eingabe ist so lange gesperrt“ zu — #ask-input ist NICHT gesperrt und nimmt weiter Eingaben an", async () => {
      offener = panelMitOffenemAsk();
      await offener.panel.flush();
      offener.halten();
      const bild = offener.absenden(FRAGE_IM_ZIELBILD);
      imWartezustand(offener, bild);
      expect(soll["satz-zusage-eingabe-gesperrt"]).toBe("gesperrt");
      // Das Gemessene: die Sperre trifft allein den Knopf.
      expect(bild.eingabeGesperrt).toBe(false);
      expect(bild.knopfGesperrt).toBe(true);
      // Und das Feld nimmt waehrend der Wartezeit weiter Eingaben an: Wert setzen, Ereignis
      // ausloesen, Wert lesen — das Panel reagiert (Herkunftszeile), nichts blockt.
      const eingabe = pflicht(offener.panel, "#ask-input");
      const Ereignis = (globalThis as unknown as { Event: EreignisFabrik }).Event;
      eingabe.value = `${FRAGE_IM_ZIELBILD} Und in Trockenzonen?`;
      (eingabe as unknown as EreignisFaehig).dispatchEvent(new Ereignis("input"));
      expect(eingabe.value).toBe(`${FRAGE_IM_ZIELBILD} Und in Trockenzonen?`);
      expect(eingabe.disabled).toBe(false);
      expect(offener.panel.text("#ask-source-note")).toBe(offener.panel.t("askSourceManual"));
      expect(offener.offen(), "der Fetch ist waehrend des Tippens noch offen").toBe(true);
    });

    it("W5 — die Frage-Pille #ask-frage-zeile-btn ist im Wartezustand nicht sichtbar (seit JOB 3004 im DOM, verborgen bis zur Antwort); die Frage bleibt nur im Eingabefeld", async () => {
      offener = panelMitOffenemAsk();
      await offener.panel.flush();
      offener.halten();
      const bild = offener.absenden(FRAGE_IM_ZIELBILD);
      imWartezustand(offener, bild);
      expect(bild.pilleVorhanden).toBe(false);
      // Der Knoten selbst ist da (JOB 3004) — aber verborgen: kein Pillen-Ersatz im Wartezustand.
      expect(dom().querySelectorAll("#ask-frage-zeile-btn").length).toBe(1);
      expect(sichtbarImDom("#ask-frage-zeile-btn")).toBe(false);
      expect(bild.eingabeWert).toBe(FRAGE_IM_ZIELBILD);
    });

    it("L — LIEFERUNG 3: keine Ladebalken, keine Ladekarte — die einzige neu sichtbare Fläche ist #ask-status", async () => {
      offener = panelMitOffenemAsk();
      await offener.panel.flush();
      offener.halten();
      const bild = offener.absenden(FRAGE_IM_ZIELBILD);
      imWartezustand(offener, bild);
      expect(bild.ladebalken).toBe(0);
      expect(
        dom().querySelectorAll("[class*='ladebalken'], [class*='skelett'], [class*='shimmer']")
          .length,
      ).toBe(0);
      expect(bild.neuSichtbar).toEqual(["ask-status"]);
      expect(bild.neuVersteckt).toEqual([]);
      expect(bild.antwortBlockVersteckt).toBe(true);
      expect(bild.lueckeBlockVersteckt).toBe(true);
      expect(bild.quellenBlockVersteckt).toBe(true);
    });

    it("LT — WERTE_FRAGEWEG_PRUEFUNG misst gegen `.ladebalken`, das das Produkt nicht kennt: jede Zeile „fehlt im gebauten Stand“, und kein anderer Test liest sie", () => {
      const produkt = lies(PRODUKT);
      expect(WERTE_FRAGEWEG_PRUEFUNG.length).toBe(6);
      expect(cssRegel(produkt, ".ladebalken")).toBeNull();
      expect(produkt.includes("ladebalken")).toBe(false);
      const befunde = vergleiche(zielbild, produkt, WERTE_FRAGEWEG_PRUEFUNG);
      for (const b of befunde) {
        expect(b.ziel, `${b.name}: Zielwert fehlt`).not.toBeNull();
        expect(b.gebaut, `${b.name}: das Produkt liefert ploetzlich einen Wert`).toBeNull();
        expect(b.gleich).toBe(false);
      }
      // Tot heisst: ausser der Definition und dieser Messung liest sie niemand.
      const leser = dateienMit("WERTE_FRAGEWEG_PRUEFUNG", [
        "tests",
        "tools",
        "apps/web/src",
        "services",
      ]);
      expect(leser.sort()).toEqual(
        [
          "tests/design/zielbild-pruefunglaeuft-messung.test.ts",
          "tools/design-vergleich/werte.ts",
        ].sort(),
      );
    });

    it("V — LIEFERUNG 6: die fünf Träger der Verlustliste am laufenden Panel — Statusfläche (geteilt), askBusy, Knopfsperre, Aufräumen des ANTWORT-Ausgangs, Frist (der Lücken-Ausgang steht in U2)", async () => {
      offener = panelMitOffenemAsk();
      await offener.panel.flush();
      // (1) Ein voriges Ergebnis liegt vor: eine beantwortete Frage (Fixture-Route) fuellt den
      //     Antwortblock — Grundlage fuer den Beleg, dass resetAskResult() ihn wegraeumt.
      //     Der zweite heute sichtbare Ausgang, die Wissensluecke, wird in U2 getrennt erzeugt und
      //     getrennt gemessen — hier steht nur der Antwort-Ausgang.
      pflicht(offener.panel, "#ask-input").value = "Vorige Frage";
      offener.panel.askKlara();
      await offener.panel.flush();
      await offener.panel.flush();
      expect(versteckt(pflicht(offener.panel, "#ask-answer-block")), "voriges Ergebnis fehlt").toBe(
        false,
      );
      expect(pflicht(offener.panel, "#ask-answer-edit").value).toContain("Kennzeichnung S");
      // (2) Der Traeger #ask-status ist GETEILT: dieselbe Flaeche traegt askEmpty.
      pflicht(offener.panel, "#ask-input").value = "";
      offener.panel.askKlara();
      expect(pflicht(offener.panel, "#ask-status").className).toBe("status warn");
      expect(pflicht(offener.panel, "#ask-status").textContent).toBe(offener.panel.t("askEmpty"));
      // (3) Jetzt der Wartezustand mit offenem Fetch.
      pflicht(offener.panel, "#ask-input").value = "Vorige Frage";
      offener.panel.askKlara();
      await offener.panel.flush();
      await offener.panel.flush();
      offener.halten();
      const bild = offener.absenden(FRAGE_IM_ZIELBILD);
      imWartezustand(offener, bild);
      expect(bild.statusKlasse).toBe("status warn");
      expect(bild.statusText).toBe(offener.panel.t("askBusy"));
      expect(bild.knopfGesperrt).toBe(true);
      // resetAskResult(): das vorige Ergebnis ist weg, bevor gewartet wird.
      expect(bild.antwortBlockVersteckt).toBe(true);
      expect(pflicht(offener.panel, "#ask-answer-edit").value).toBe("");
      expect(pflicht(offener.panel, "#ask-sources").textContent).toBe("");
      // Die Frist: beim Absenden wurde genau eine Frist von 15000 ms gestellt.
      expect(offener.fristen.filter((ms) => ms === 15000)).toHaveLength(1);
      // Und nach der Antwort ist der Knopf wieder frei — die Sperre gehoert zur Wartezeit.
      offener.freigeben();
      await offener.panel.flush();
      await offener.panel.flush();
      expect(pflicht(offener.panel, "#ask-btn").disabled).toBe(false);
      expect(VERLUSTLISTE).toHaveLength(5);
      expect(VERLUSTLISTE.filter((t) => t.platzImZielbild.startsWith("keiner"))).toHaveLength(1);
    });

    // ------------------------------------------------------------------------------------------
    // DIE UEBERGANGSKANTEN (BEN, Runde 1, Korrekturpflicht 1): jede heute sichtbare Ergebnisart
    // wird VOR dem Warten getrennt erzeugt und sichtbar belegt; dann beginnt ein offen gehaltener
    // Folge-Ask, und die Ergebnisart muss verschwunden sein. Gegenprobe je Kante: allein die
    // Reset-Zeile des jeweiligen Blocks in resetAskResult() entfernen — genau U1 bzw. U2 wird rot.
    // ------------------------------------------------------------------------------------------

    it("U1 — Übergang vorige ANTWORT → offener neuer Ask: #ask-answer-block war sichtbar und ist im Wartezustand versteckt", async () => {
      offener = panelMitOffenemAsk("antwort");
      await offener.panel.flush();
      pflicht(offener.panel, "#ask-input").value = "Vorige Frage";
      offener.panel.askKlara();
      await offener.panel.flush();
      await offener.panel.flush();
      const antwort = pflicht(offener.panel, "#ask-answer-block");
      expect(
        versteckt(antwort),
        "die vorige Antwort ist nicht sichtbar — Kante nicht erreicht",
      ).toBe(false);
      expect(pflicht(offener.panel, "#ask-answer-edit").value).toContain("Kennzeichnung S");
      expect(versteckt(pflicht(offener.panel, "#ask-gap-block"))).toBe(true);
      offener.halten();
      const bild = offener.absenden(FRAGE_IM_ZIELBILD);
      imWartezustand(offener, bild);
      expect(bild.antwortBlockVersteckt).toBe(true);
      expect(bild.neuVersteckt).toContain("ask-answer-block");
      // JOB 3004: der Antwortzustand verbirgt die Frage-Karte #ask-karte (Zielbild „Main“: Pille
      // statt Eingabefeld). Der neue Ask holt sie ueber resetAskResult() zurueck — sie wird hier
      // neben #ask-status neu sichtbar. Vor 3004 war sie nie verborgen, die Liste war [ask-status].
      expect(bild.neuSichtbar).toEqual(["ask-karte", "ask-status"]);
    });

    it("U2 — Übergang vorige WISSENSLÜCKE → offener neuer Ask: #ask-gap-block war sichtbar und ist im Wartezustand versteckt", async () => {
      offener = panelMitOffenemAsk("luecke");
      await offener.panel.flush();
      pflicht(offener.panel, "#ask-input").value = "Vorige Frage ohne Wissen";
      offener.panel.askKlara();
      await offener.panel.flush();
      await offener.panel.flush();
      const luecke = pflicht(offener.panel, "#ask-gap-block");
      expect(versteckt(luecke), "die vorige Luecke ist nicht sichtbar — Kante nicht erreicht").toBe(
        false,
      );
      expect(versteckt(pflicht(offener.panel, "#ask-answer-block"))).toBe(true);
      // Nach der Luecke ist die Statuszeile leer — der Wartezustand macht sie neu sichtbar.
      expect(versteckt(pflicht(offener.panel, "#ask-status"))).toBe(true);
      offener.halten();
      const bild = offener.absenden(FRAGE_IM_ZIELBILD);
      imWartezustand(offener, bild);
      expect(bild.lueckeBlockVersteckt).toBe(true);
      expect(bild.neuVersteckt).toContain("ask-gap-block");
      expect(bild.neuSichtbar).toEqual(["ask-status"]);
    });

    it("V3 — der Wortlaut askBusy liegt in drei Sprachen vor (DE/EN/NL), alle „KLARWERK-Wissen“, keine mit der Sperr-Zusage", async () => {
      offener = panelMitOffenemAsk();
      await offener.panel.flush();
      const texte: Record<string, string> = {};
      for (const code of ["de", "en", "nl"]) {
        offener.panel.setLang(code);
        await offener.panel.flush();
        texte[code] = offener.panel.t("askBusy");
      }
      expect(texte).toEqual({
        de: "Klara sucht im KLARWERK-Wissen ...",
        en: "Klara is searching KLARWERK knowledge ...",
        nl: "Klara zoekt in KLARWERK-kennis ...",
      });
      for (const text of Object.values(texte)) {
        expect(text).not.toContain("gesperrt");
        expect(text).not.toContain("locked");
      }
      offener.panel.setLang("de");
      await offener.panel.flush();
    });

    it("T — LIEFERUNG 5: die Abweichungstabelle — je Sollwert Soll, Ist, Beleg, Urteil", async () => {
      offener = panelMitOffenemAsk();
      await offener.panel.flush();
      offener.halten();
      const bild = offener.absenden(FRAGE_IM_ZIELBILD);
      imWartezustand(offener, bild);
      const tabelle = abweichungstabelle(soll, bild);
      expect(tabelle.map((z) => z.kennung)).toEqual(SOLL_KENNUNGEN);
      for (const z of tabelle) {
        if (z.urteil === "erfüllt") {
          expect(z.ist, `${z.kennung}: erfuellt, aber Ist ≠ Soll`).toBe(z.soll);
        } else if (z.urteil === "abweichend") {
          expect(z.ist, `${z.kennung}: abweichend, aber Ist = Soll`).not.toBe(z.soll);
        } else {
          expect(z.urteil).toBe(CHROMIUM);
        }
        // DIE TRAEGER-REGEL: fehlt der Traeger, ist keine abhaengige Zeile erfuellt — und ihr Ist
        // sagt „nicht vorhanden“, nicht den Wert eines anderen Bedienelements.
        const traeger = TRAEGER_VON[z.kennung];
        if (traeger !== undefined && traegerFehlt(bild, traeger)) {
          expect(z.urteil, `${z.kennung}: Traeger ${traeger} fehlt, Zeile gilt trotzdem`).not.toBe(
            "erfüllt",
          );
          expect(z.ist, `${z.kennung}: Traeger ${traeger} fehlt, Ist nennt es nicht`).toContain(
            NICHT_VORHANDEN,
          );
        }
      }
      // Heute fehlen alle drei Traeger — sonst misst die Regel oben nichts.
      expect(traegerFehlt(bild, "pille")).toBe(true);
      expect(traegerFehlt(bild, "karte")).toBe(true);
      expect(traegerFehlt(bild, "balken")).toBe(true);
      const urteile = { erfüllt: 0, abweichend: 0, nichtMessbar: 0 };
      for (const z of tabelle) {
        if (z.urteil === "erfüllt") {
          urteile.erfüllt += 1;
        } else if (z.urteil === "abweichend") {
          urteile.abweichend += 1;
        } else {
          urteile.nichtMessbar += 1;
        }
      }
      // GEMESSEN am Stand a148ecc: erfuellt ist allein „ein einziger Hinweis“ (nur #ask-status
      // wird neu sichtbar); abweichend sind Pille, Pillentext, Karte, Balkenzahl, Wortlaut und
      // Eingabesperre; die 17 reinen Darstellungswerte warten auf die Chromium-Panelmessung aus
      // JOB 3004. (Runde 1 hatte „pille-text“ ueber den Wert des Eingabefelds als erfuellt gefuehrt
      // — ein anderes Bedienelement ist keine Pille; BEN, Korrekturpflicht 2. Der Pin wurde auf
      // BENs Vorgabe 1/6/17 gesetzt, der erste Lauf danach bestaetigte sie ohne Rot.)
      expect(urteile).toEqual({ erfüllt: 1, abweichend: 6, nichtMessbar: 17 });
      const befunde = tabelle
        .filter((z) => z.istBefund !== undefined)
        .map((z) => `  Ist-Befund (ohne Urteilswirkung) ${z.kennung}: ${z.istBefund}`);
      expect(befunde).toHaveLength(1);
      console.info(
        ["JOB 3012 · D3 · Abweichungstabelle PruefungLaeuft (Stand: laufendes Panel)"]
          .concat(
            tabelle.map(
              (z) => `  ${z.kennung} · soll=${z.soll} · ist=${z.ist} · ${z.urteil} · [${z.beleg}]`,
            ),
          )
          .concat(befunde)
          .join("\n"),
      );
    });

    it("K — KALIBRIERUNG: die Sensoren gehen mit, wenn sich der Wartezustand im Speicher ändert", async () => {
      offener = panelMitOffenemAsk();
      await offener.panel.flush();
      offener.halten();
      const vorher = verstecktBild();
      pflicht(offener.panel, "#ask-input").value = FRAGE_IM_ZIELBILD;
      offener.panel.askKlara();
      const echt = wartebild(offener.panel, vorher);
      imWartezustand(offener, echt);
      // Im Speicher verfaelschen — NICHT in der Datei — und dieselben Sensoren erneut lesen.
      pflicht(offener.panel, "#ask-status").textContent = soll["satz-wortlaut"] ?? "";
      pflicht(offener.panel, "#ask-btn").disabled = false;
      pflicht(offener.panel, "#ask-input").disabled = true;
      const gekippt = wartebild(offener.panel, vorher);
      expect(gekippt.statusText).not.toBe(echt.statusText);
      expect(gekippt.knopfGesperrt).not.toBe(echt.knopfGesperrt);
      expect(gekippt.eingabeGesperrt).not.toBe(echt.eingabeGesperrt);
      const tabelle = abweichungstabelle(soll, gekippt);
      const zeile = (k: SollKennung): Urteil =>
        tabelle.find((z) => z.kennung === k)?.urteil ?? CHROMIUM;
      expect(zeile("satz-wortlaut")).toBe("erfüllt");
      expect(zeile("satz-zusage-eingabe-gesperrt")).toBe("erfüllt");
    });
  },
);

describe.runIf(!zielbildDa)("JOB 3012 · D3 · PruefungLaeuft-Messung uebersprungen", () => {
  it("meldet den fehlenden Kontrollordner statt eine Messung vorzutaeuschen", () => {
    expect(zielbildDa, `Zielbild nicht lesbar: ${ZIELBILD} — Abgleich hier nicht messbar.`).toBe(
      false,
    );
  });
});

/** Alle .ts/.tsx-Dateien unter `flaechen`, deren Quelle `wort` enthaelt — relativ zur Wurzel. */
function dateienMit(wort: string, flaechen: string[]): string[] {
  const raus: string[] = [];
  const lauf = (dir: string): void => {
    if (!existsSync(dir)) {
      return;
    }
    for (const eintrag of readdirSync(dir)) {
      if (eintrag === "node_modules" || eintrag === "dist") {
        continue;
      }
      const pfad = join(dir, eintrag);
      if (statSync(pfad).isDirectory()) {
        lauf(pfad);
      } else if (/\.tsx?$/.test(eintrag) && lies(pfad).includes(wort)) {
        raus.push(relative(WURZEL, pfad));
      }
    }
  };
  for (const f of flaechen) {
    lauf(join(WURZEL, f));
  }
  return raus;
}
