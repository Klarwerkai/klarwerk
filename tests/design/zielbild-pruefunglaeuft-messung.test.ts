// @vitest-environment jsdom
// ================================================================================================
// JOB 3012 · D3 „PRUEFUNG LAEUFT“ — DER WARTEZUSTAND, AM LAUFENDEN PANEL GEMESSEN.
// ================================================================================================
//
// PEDIS FRAGE: „Was sieht der Mensch in Word, waehrend Klara sucht — und ist das, was er sieht, das,
// was ich gezeichnet habe?“
//
// Bis zu diesem Auftrag war der Wartezustand des Aufgabenfensters von KEINEM ausgefuehrten Test
// gemessen: `word-addin-ask.test.ts` pinnt den Quelltext (`askBusy`, Wortliste x3), mehr nicht.
// Dieser Test bringt das AUSGELIEFERTE `taskpane.html` ueber die Panel-Fixture wirklich in den
// Wartezustand: er schickt eine Frage ab und haelt den Ask-Fetch offen (das Versprechen bleibt
// unaufgeloest), sodass das Fenster genau zwischen `askWartezustand(true)` und
// `renderAskOutcome(...)` steht. DORT misst er, was zu sehen ist.
//
// DANEBEN steht Zeile fuer Zeile, was das Zielbild `PruefungLaeuft.dc.html` (DESIGN_ZIELBILD_20260827)
// an derselben Stelle verlangt — GELESEN aus der Datei, nicht abgeschrieben. Die Erwartungen sind das
// GEMESSENE, nicht das Erhoffte: der Test ist gruen gegen den heutigen Stand und wird rot, sobald
// sich der Wartezustand aendert — dann ist die Abweichungstabelle nachzufuehren, nicht der Test zu
// entschaerfen.
//
// NACHGEFUEHRT IN JOB 3016 D3 (03.09.2026) — der Umbau, auf den dieser Test gewartet hat, und der
// ihn wie vorgesehen rot gemacht hat. Der Wartezustand ist jetzt die Ladekarte `#ask-ladekarte`
// (drei `.ladebalken`, Zielbild Z.26-30) mit dem Satz `#ask-ladekarte-satz` (Schluessel `askBusy`,
// Wortlaut des Zielbilds Z.32); `#ask-status` bleibt im Wartezustand verborgen und traegt weiter die
// echten Warnungen; `#ask-input` ist waehrend der Suche gesperrt (askWartezustand → updateAskState)
// und wird ueber JEDEN Ausgang wieder frei (Faelle F1-F4, fail-open). Die Erwartungen unten sind
// wieder das GEMESSENE — am neuen Stand. Wo eine Erwartung von JOB 3012 sich gedreht hat, steht es
// am Fall (W2, W4, L, LT, T, U1/U2, V3, K).
//
// WAS HIER BEWUSST NICHT GEMESSEN WIRD: reine Darstellungswerte (Farbe, Radius, Innenabstand,
// Schriftgrad, Balkenbreiten). jsdom rechnet kein Layout und keinen wirksamen Stil; solche Zeilen
// tragen deshalb `nicht messbar in jsdom` mit Verweis — gemessen werden sie in Chromium am realen
// Element, in `tests/design/zielbild-pruefunglaeuft.test.ts` (JOB 3016), ein Vergleich je Wert.
// Kein Wert steht in beiden Dateien als Vergleich. Die Frage-Pille (Z.22-24) hat im Produkt weiter
// keinen Traeger — sie gehoert zu D1/JOB 3004; ihre Zeilen tragen `nicht messbar (kein Traeger)`.
//
// KALIBRIERUNG GEGEN DEN STILLEN NULL-TREFFER (Auftrag §6): jeder Messfall belegt zuerst, dass das
// Panel WIRKLICH im Wartezustand steht (ein Ask-Fetch ist abgegangen, sein Versprechen ist noch
// offen, `#ask-ladekarte` ist sichtbar). Loest der Fetch sofort auf oder geht die Frage nicht ab,
// ist das ein Fehlschlag, kein „0 von 0 gruen“.
//
// GEGENPROBE (JOB 3012, Auftrag §6, einmalig gefahren, Ergebniszeilen in der damaligen
// RUECKGABE.md): Wortlaut, Knopfsperre, Eingabesperre und die Reset-Zeilen von `#ask-answer-block`
// und `#ask-gap-block` wurden je einzeln an der Arbeitskopie von taskpane.html verfaelscht — der
// Fall mit dem Namen des verfaelschten Werts wurde rot. Zusaetzlich kippt Fall K die Sensoren im
// Speicher (ohne Datei) und belegt, dass sie mitgehen.
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
// Wrapper ersetzt, der allein `POST /api/ask` festhaelt und alles andere durchreicht. Der Wrapper
// verwirft wie ein echter fetch, wenn das Panel seinen AbortController zieht (Frist) — sonst gaebe es
// keinen Frist-Ausgang zu messen. `restore()` der Fixture stellt den Vorzustand her.
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
/** Die Panel-Frist (taskpane.html: WORD_ADDIN_ASK_TIMEOUT_MS). */
const FRIST_MS = 15000;

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
  /** JOB 3016: die Ladekarte und ihr Satz — der Wartezustand des Zielbilds. */
  ladekarteSichtbar: boolean;
  satzSichtbar: boolean;
  satzText: string;
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
  /** Davon die, die eigenen Text tragen — die HINWEISE, die ein Mensch liest. */
  neuSichtbarMitText: string[];
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
  const karte = pflicht(panel, "#ask-ladekarte");
  const satz = pflicht(panel, "#ask-ladekarte-satz");
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
    ladekarteSichtbar: !versteckt(karte),
    satzSichtbar: !versteckt(satz),
    satzText: (satz.textContent ?? "").trim(),
    knopfGesperrt: pflicht(panel, "#ask-btn").disabled,
    eingabeGesperrt: pflicht(panel, "#ask-input").disabled,
    eingabeWert: pflicht(panel, "#ask-input").value,
    pilleVorhanden: pilleSichtbar,
    ladebalken: dom().querySelectorAll(".ladebalken").length,
    antwortBlockVersteckt: versteckt(pflicht(panel, "#ask-answer-block")),
    lueckeBlockVersteckt: versteckt(pflicht(panel, "#ask-gap-block")),
    quellenBlockVersteckt: versteckt(pflicht(panel, "#ask-sources-block")),
    neuSichtbar,
    neuSichtbarMitText: neuSichtbar.filter(
      (id) => (panel.q(`#${id}`)?.textContent ?? "").trim() !== "",
    ),
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
  /** Aufloesen mit der Wissensluecke (der Standard-Ausgang). */
  freigeben(): void;
  /** Aufloesen mit einer bestimmten Antwort (Antwort, 401, ...). */
  freigebenMit(antwort: FakeResponse): void;
  /** Verwerfen wie ein echter fetch bei Netzfehler — der Fehler-Ausgang. */
  verwerfen(fehler: Error): void;
  /** Die beim Absenden gestellte Panel-Frist (15000 ms) ausloesen, ohne zu warten. */
  fristAusloesen(): void;
  /** Die Fristen (ms), die das Panel waehrend des Absendens per setTimeout gesetzt hat. */
  fristen: number[];
  absenden(frage: string): Wartebild;
}

function antwort(status: number, body: unknown): FakeResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
  };
}

const ANTWORT_NACH_FREIGABE = antwort(200, {
  result: { answered: false, answer: null, sources: [] },
});

const ANTWORT_MIT_QUELLE_KOERPER = {
  result: {
    answered: true,
    answer: "Nur Profile mit Kennzeichnung S sind in Spritzzonen erlaubt.",
    sources: ["ko-3012"],
    trust: 80,
  },
};
const ANTWORT_MIT_QUELLE = reply(200, ANTWORT_MIT_QUELLE_KOERPER);

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
  let verwerfe: (e: Error) => void = () => undefined;
  const versprechen = new Promise<FakeResponse>((res, rej) => {
    loese = res;
    verwerfe = rej;
  });
  const verwerfen = (fehler: Error): void => {
    if (anzahl === 0) {
      throw new Error("kein gehaltener Ask — nichts zu verwerfen");
    }
    if (!aufgeloest) {
      aufgeloest = true;
      verwerfe(fehler);
    }
  };
  const gehalten = (async (eingabe: unknown, init?: RequestInit): Promise<unknown> => {
    const url = String(eingabe);
    if (haelt && url === "/api/ask" && (init?.method ?? "GET").toUpperCase() === "POST") {
      anzahl += 1;
      // Zieht das Panel seinen AbortController (Frist), verwirft der gehaltene Fetch wie ein
      // echter — genau so entsteht im Panel der Ausgang `timeout`.
      const signal = init?.signal;
      if (signal) {
        signal.addEventListener("abort", () => verwerfen(new Error("The operation was aborted.")));
      }
      return versprechen;
    }
    return fixtureFetch(eingabe as string, init);
  }) as typeof globalThis.fetch;
  globalThis.fetch = gehalten;
  (globalThis as unknown as { window: { fetch: unknown } }).window.fetch = gehalten;

  const fristen: number[] = [];
  // Runde 5: das Panel stellt je Lauf bis zu ZWEI Fristen von 15000 ms — die Auswahlfrist (Klick →
  // Word-Rueckruf) und, nach dem Rueckruf, die Ask-Frist (performAsk). `fristAusloesen()` loest die
  // ZULETZT gestellte aus: bei ausgebliebenem Rueckruf ist das die Auswahlfrist (G3), nach einem
  // synchronen Rueckruf die Ask-Frist (F2) — die Auswahlfrist ist dann bereits geloescht.
  const fristHandler: Array<() => void> = [];
  const freigebenMit = (r: FakeResponse): void => {
    if (!aufgeloest) {
      aufgeloest = true;
      loese(r);
    }
  };
  return {
    panel,
    abgegangen: () => anzahl,
    offen: () => !aufgeloest,
    halten: () => {
      haelt = true;
    },
    freigeben: () => freigebenMit(ANTWORT_NACH_FREIGABE),
    freigebenMit,
    verwerfen,
    fristAusloesen: () => {
      const letzte = fristHandler[fristHandler.length - 1];
      if (letzte === undefined) {
        throw new Error("keine Panel-Frist gestellt — kein Wartezustand");
      }
      letzte();
    },
    fristen,
    absenden(frage: string): Wartebild {
      pflicht(panel, "#ask-input").value = frage;
      const vorher = verstecktBild();
      // Die Frist wird beim Absenden gesetzt (performAsk → setTimeout). Der Fixture-Timer wird
      // nur fuer den synchronen Teil des Absendens umwickelt, damit allein diese Fristen zaehlen —
      // und der Frist-Rueckruf wird festgehalten, damit F2 ihn ausloesen kann, ohne 15 s zu warten.
      const fixtureSetTimeout = globalThis.setTimeout;
      const zaehler = ((handler: () => void, ms?: number) => {
        fristen.push(ms ?? 0);
        // Runde 6: die Ask-Frist ist die RESTZEIT der Gesamtfrist (15000 minus die Zeit bis zum
        // Rueckruf) — bei synchronem Rueckruf 15000 oder wenige ms darunter.
        if (ms !== undefined && ms >= FRIST_MS - 1000 && ms <= FRIST_MS) {
          fristHandler.push(handler);
        }
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

/** Die beim Absenden gestellten Fristen des Laufs (Auswahlfrist, Ask-Restfrist) — ohne Kleinkram. */
function gestellteFristen(o: OffenerAsk): number[] {
  return o.fristen.filter((ms) => ms >= FRIST_MS - 1000 && ms <= FRIST_MS);
}

/** Belegt, dass das Panel WIRKLICH wartet — sonst misst der Rest nichts. */
function imWartezustand(o: OffenerAsk, bild: Wartebild): void {
  expect(o.abgegangen(), "kein POST /api/ask abgegangen — kein Wartezustand").toBe(1);
  expect(o.offen(), "der Ask-Fetch ist schon aufgeloest — kein Wartezustand").toBe(true);
  expect(bild.ladekarteSichtbar, "#ask-ladekarte ist nicht sichtbar — kein Wartezustand").toBe(
    true,
  );
}

/** Der Zustand NACH einem Ausgang — dieselben Sensoren, ohne Vorher/Nachher-Differenz. */
function nachAusgang(panel: KlaraPanel) {
  return {
    eingabeGesperrt: pflicht(panel, "#ask-input").disabled,
    knopfGesperrt: pflicht(panel, "#ask-btn").disabled,
    ladekarteVersteckt: versteckt(pflicht(panel, "#ask-ladekarte")),
    satzVersteckt: versteckt(pflicht(panel, "#ask-ladekarte-satz")),
    statusKlasse: pflicht(panel, "#ask-status").className,
    statusText: pflicht(panel, "#ask-status").textContent ?? "",
    antwortBlockVersteckt: versteckt(pflicht(panel, "#ask-answer-block")),
  };
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

const OHNE_TRAEGER =
  "nicht messbar (kein Träger im Produkt — die Frage-Pille gehört zu D1/JOB 3004)";
const IN_CHROMIUM =
  "nicht messbar in jsdom (Darstellungswert; gemessen in Chromium: tests/design/zielbild-pruefunglaeuft.test.ts)";
type Urteil = "erfüllt" | "abweichend" | typeof OHNE_TRAEGER | typeof IN_CHROMIUM;
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
  return !w.ladekarteSichtbar;
}

function abweichungstabelle(soll: Record<SollKennung, string | null>, w: Wartebild): Zeile[] {
  const s = (k: SollKennung): string => soll[k] ?? "(Sollwert fehlt)";
  const ohneTraeger = (k: SollKennung, traeger: string, beleg: string): Zeile => ({
    kennung: k,
    soll: s(k),
    ist: `${NICHT_VORHANDEN} (kein Träger: ${traeger})`,
    beleg,
    urteil: OHNE_TRAEGER,
  });
  // Der Traeger ist da (Karte, Balken, Absatz); seinen Darstellungswert rechnet jsdom nicht.
  const inChromium = (k: SollKennung, selektor: string, eigenschaft: string): Zeile => ({
    kennung: k,
    soll: s(k),
    ist: `vorhanden (${selektor}) — ${eigenschaft} in jsdom nicht berechnet`,
    beleg: `getComputedStyle(${selektor}).${eigenschaft} in Chromium`,
    urteil: IN_CHROMIUM,
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
    ohneTraeger("pille-hintergrund", "Pille", "cssProp(#ask-frage-zeile-btn) — Element fehlt"),
    ohneTraeger("pille-rahmen", "Pille", "cssProp(#ask-frage-zeile-btn) — Element fehlt"),
    ohneTraeger("pille-radius", "Pille", "cssProp(#ask-frage-zeile-btn) — Element fehlt"),
    ohneTraeger("pille-innenabstand", "Pille", "cssProp(#ask-frage-zeile-btn) — Element fehlt"),
    ohneTraeger("pille-schriftgrad", "Pille", "cssProp(#ask-frage-zeile) — Element fehlt"),
    ohneTraeger("pille-farbe", "Pille", "cssProp(#ask-frage-zeile) — Element fehlt"),
    // — Ladekarte —
    {
      kennung: "karte-vorhanden",
      soll: s("karte-vorhanden"),
      ist: w.ladekarteSichtbar
        ? "ja"
        : `${NICHT_VORHANDEN}; neu sichtbar: ${w.neuSichtbar.join(", ")} (${w.statusKlasse})`,
      beleg: "#ask-ladekarte ohne `hidden` im Wartezustand",
      urteil: w.ladekarteSichtbar ? "erfüllt" : "abweichend",
    },
    inChromium("karte-innenabstand", "#ask-ladekarte", "padding"),
    inChromium("karte-radius", "#ask-ladekarte", "border-radius"),
    inChromium("karte-hintergrund", "#ask-ladekarte", "background-color"),
    inChromium("karte-balkenabstand", "#ask-ladekarte", "gap"),
    {
      kennung: "balken-anzahl",
      soll: s("balken-anzahl"),
      ist: String(w.ladebalken),
      beleg: "querySelectorAll('.ladebalken').length im Wartezustand",
      urteil: String(w.ladebalken) === s("balken-anzahl") ? "erfüllt" : "abweichend",
    },
    inChromium("balken-hoehe", ".ladebalken", "height"),
    inChromium("balken-radius", ".ladebalken", "border-radius"),
    inChromium("balken-farbe", ".ladebalken", "background-color"),
    inChromium("balken-breiten", ".ladebalken:nth-child(n)", "width"),
    // — Sperr-Satz —
    {
      kennung: "satz-wortlaut",
      soll: s("satz-wortlaut"),
      ist: w.satzText,
      beleg: "#ask-ladekarte-satz.textContent im Wartezustand",
      urteil: w.satzSichtbar && w.satzText === s("satz-wortlaut") ? "erfüllt" : "abweichend",
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
    inChromium("satz-schriftgrad", "#ask-ladekarte-satz", "font-size"),
    inChromium("satz-farbe", "#ask-ladekarte-satz", "color"),
    inChromium("satz-ausrichtung", "#ask-ladekarte-satz", "text-align"),
    {
      kennung: "satz-einziger-hinweis",
      soll: s("satz-einziger-hinweis"),
      // Die Karte traegt keinen Text — der Satz ist der einzige Hinweis, den ein Mensch liest.
      ist: String(w.neuSichtbarMitText.length),
      beleg: `neu sichtbare Flächen mit eigenem Text (Vorher/Nachher-Differenz): ${w.neuSichtbarMitText.join(", ") || "keine"}`,
      urteil:
        String(w.neuSichtbarMitText.length) === s("satz-einziger-hinweis")
          ? "erfüllt"
          : "abweichend",
    },
  ];
}

// ================================================================================================
// LIEFERUNG 6 — DIE VERLUSTLISTE, UMGEKEHRT GELESEN.
// ================================================================================================
// Jeder Traeger des Wartezustands VOR JOB 3016, sein Platz im Zielbild, sein Platz NACH dem Umbau
// und — wo es keinen gibt — was sein Verlust kostet. Die Fallgruppe V/F misst jeden Traeger am
// laufenden Panel, damit ein spaeterer Umbau ihn nicht unbemerkt fallen laesst.
interface Traeger {
  traeger: string;
  bisJob3016: string;
  platzImZielbild: string;
  platzNachUmbau: string;
  verlust: string;
}
const VERLUSTLISTE: readonly Traeger[] = [
  {
    traeger: "#ask-status als `status warn`",
    bisJob3016:
      'showAskStatus("warn", t("askBusy")) — Warnkasten, geteilt mit askEmpty/askAuth/askTimeout/askError/s4FragenGesperrt',
    platzImZielbild: "kein Warnkasten; der einzige Hinweis ist der zentrierte 12px-Satz (Z.32)",
    platzNachUmbau:
      "im Wartezustand verborgen (askWartezustand → hideAskStatus); traegt unveraendert askEmpty, askAuth, askTimeout, askError, s4FragenGesperrt (Faelle V, F2, F3, F4)",
    verlust:
      "faellt der Traeger, verlieren fuenf Fehl- und Sperrzustaende ihre Flaeche mit — sie teilen das Element",
  },
  {
    traeger: "Wortlaut askBusy in DE/EN/NL",
    bisJob3016: "„Klara sucht im KLARWERK-Wissen ...“ + EN + NL, gepinnt durch mega35-Wortliste",
    platzImZielbild:
      "ein deutscher Satz (Z.32) — „im freigegebenen Wissen — die Eingabe ist so lange gesperrt.“; EN/NL nicht gezeichnet",
    platzNachUmbau:
      "derselbe Schluessel, jetzt am Absatz #ask-ladekarte-satz (data-t); DE woertlich das Zielbild, EN/NL mit beiden Haelften (Fall V3)",
    verlust:
      "zwei Uebersetzungen und der Wortlisten-Pin muessten mit — sonst spricht das Panel in EN/NL vom alten, in DE vom neuen Zustand",
  },
  {
    traeger: "Knopfsperre #ask-btn.disabled = true",
    bisJob3016: "gesetzt beim Absenden, aufgehoben durch updateAskState() nach Antwort",
    platzImZielbild: "in der Zusage „die Eingabe ist so lange gesperrt“ enthalten (Z.32)",
    platzNachUmbau:
      "askLaeuft in updateAskState(): Knopf UND #ask-input gesperrt, Freigabe an derselben Stelle ueber jeden Ausgang (W3, W4, F1-F4)",
    verlust: "keiner — das Zielbild verlangt mehr, nicht weniger",
  },
  {
    traeger: "resetAskResult() vor dem Warten",
    bisJob3016: "Antwortblock, Lueckenblock, Quellen, KI-Kennzeichnung, Einstufung werden geraeumt",
    platzImZielbild: "die Ladekarte steht allein — kein voriges Ergebnis sichtbar (Z.26-30)",
    platzNachUmbau: "unveraendert, unmittelbar vor askWartezustand(true) (U1, U2, V)",
    verlust: "keiner — das Zielbild zeigt dasselbe Ergebnis",
  },
  {
    traeger: "Frist WORD_ADDIN_ASK_TIMEOUT_MS = 15000",
    bisJob3016: "setTimeout beim Absenden; danach askTimeout in #ask-status",
    platzImZielbild: "keiner — das Zielbild zeichnet kein Ende der Wartezeit („so lange“)",
    platzNachUmbau:
      "unveraendert 15000 ms (V); nach der Frist: Karte weg, Feld frei, askTimeout in #ask-status (F2)",
    verlust: "ohne Frist sperrt „so lange gesperrt“ bei haengendem Server das Fenster dauerhaft",
  },
];

// ================================================================================================
// DIE FAELLE
// ================================================================================================

describe.runIf(zielbildDa)(
  "JOB 3012 · D3 · PruefungLaeuft — Wartezustand gemessen, Zielbild daneben (nachgefuehrt in JOB 3016)",
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

    it("W1 — das Panel steht wirklich im Wartezustand: Frage abgegangen, Fetch offen, #ask-ladekarte sichtbar, #ask-status verborgen", async () => {
      offener = panelMitOffenemAsk();
      await offener.panel.flush();
      expect(pflicht(offener.panel, "#ask-btn").disabled, "Knopf vor dem Absenden gesperrt").toBe(
        false,
      );
      expect(pflicht(offener.panel, "#ask-input").disabled, "Feld vor dem Absenden gesperrt").toBe(
        false,
      );
      expect(versteckt(pflicht(offener.panel, "#ask-ladekarte")), "Karte vor dem Absenden").toBe(
        true,
      );
      offener.halten();
      const bild = offener.absenden(FRAGE_IM_ZIELBILD);
      imWartezustand(offener, bild);
      expect(bild.statusSichtbar).toBe(false);
      expect(bild.satzSichtbar).toBe(true);
      // Und der Zustand HAELT: auch nach Abwarten aller Promise-Ketten bleibt der Fetch offen.
      await offener.panel.flush();
      expect(offener.offen()).toBe(true);
      expect(versteckt(pflicht(offener.panel, "#ask-ladekarte"))).toBe(false);
      expect(pflicht(offener.panel, "#ask-ladekarte-satz").textContent).toBe(bild.satzText);
    });

    it("W2 — der Satz unter der Karte ist askBusy = Zielbild Z.32; #ask-status ist `status hidden` und leer", async () => {
      offener = panelMitOffenemAsk();
      await offener.panel.flush();
      offener.halten();
      const bild = offener.absenden(FRAGE_IM_ZIELBILD);
      imWartezustand(offener, bild);
      // JOB 3012 mass hier „Klara sucht im KLARWERK-Wissen ...“ in `status warn` — gedreht.
      expect(bild.satzText).toBe(
        "Klara sucht im freigegebenen Wissen — die Eingabe ist so lange gesperrt.",
      );
      expect(bild.satzText).toBe(offener.panel.t("askBusy"));
      expect(bild.satzText).toBe(soll["satz-wortlaut"]);
      expect(bild.statusKlasse).toBe("status hidden");
      expect(bild.statusText).toBe("");
    });

    it("W3 — #ask-btn ist im Wartezustand gesperrt (disabled = true)", async () => {
      offener = panelMitOffenemAsk();
      await offener.panel.flush();
      offener.halten();
      const bild = offener.absenden(FRAGE_IM_ZIELBILD);
      imWartezustand(offener, bild);
      expect(bild.knopfGesperrt).toBe(true);
    });

    it("W4 — LIEFERUNG 4: die Zusage „die Eingabe ist so lange gesperrt“ ist wahr — #ask-input.disabled = true, solange der Fetch offen ist", async () => {
      offener = panelMitOffenemAsk();
      await offener.panel.flush();
      offener.halten();
      const bild = offener.absenden(FRAGE_IM_ZIELBILD);
      imWartezustand(offener, bild);
      expect(soll["satz-zusage-eingabe-gesperrt"]).toBe("gesperrt");
      // JOB 3012 mass hier `false` (nur der Knopf war gesperrt) — gedreht. Dass ein gesperrtes
      // Feld auch per Tastatur nichts annimmt, misst Chromium (zielbild-pruefunglaeuft.test.ts,
      // Fall E); jsdom kennt keine Nutzereingabe, nur das Attribut.
      expect(bild.eingabeGesperrt).toBe(true);
      expect(bild.knopfGesperrt).toBe(true);
      await offener.panel.flush();
      expect(pflicht(offener.panel, "#ask-input").disabled).toBe(true);
      expect(offener.offen(), "der Fetch ist noch offen").toBe(true);
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

    it("L — LIEFERUNG 3: die Ladekarte mit genau drei Balken ist da; neu sichtbar sind allein Karte und Satz, nichts wird versteckt", async () => {
      offener = panelMitOffenemAsk();
      await offener.panel.flush();
      offener.halten();
      const bild = offener.absenden(FRAGE_IM_ZIELBILD);
      imWartezustand(offener, bild);
      // JOB 3012 mass hier 0 Balken und `neuSichtbar = ["ask-status"]` — gedreht.
      expect(bild.ladebalken).toBe(3);
      expect(dom().querySelectorAll("#ask-ladekarte > .ladebalken").length).toBe(3);
      expect(dom().querySelectorAll("[class*='ladebalken']").length).toBe(3);
      expect(bild.neuSichtbar).toEqual(["ask-ladekarte", "ask-ladekarte-satz"]);
      expect(bild.neuSichtbarMitText).toEqual(["ask-ladekarte-satz"]);
      expect(bild.neuVersteckt).toEqual([]);
      expect(bild.statusSichtbar).toBe(false);
      expect(bild.antwortBlockVersteckt).toBe(true);
      expect(bild.lueckeBlockVersteckt).toBe(true);
      expect(bild.quellenBlockVersteckt).toBe(true);
    });

    it("LT — WERTE_FRAGEWEG_PRUEFUNG ist lebendig: jede Zeile trifft den Stilblock, ist gleich dem Zielbild, traegt einen Messpunkt — und der Chromium-Vergleich liest sie", () => {
      const produkt = lies(PRODUKT);
      // JOB 3012 mass hier 6 tote Zeilen (`gebaut = null`) — gedreht: 15 Zeilen, alle gleich.
      // Runde 2: 18 Zeilen — dazu kamen die Aussenabstaende von Karte und Satz und `display: flex`.
      expect(WERTE_FRAGEWEG_PRUEFUNG.length).toBe(18);
      expect(cssRegel(produkt, ".ladebalken")).not.toBeNull();
      expect(cssRegel(produkt, "#ask-ladekarte")).not.toBeNull();
      expect(cssRegel(produkt, "#ask-ladekarte-satz")).not.toBeNull();
      const befunde = vergleiche(zielbild, produkt, WERTE_FRAGEWEG_PRUEFUNG);
      for (const b of befunde) {
        expect(b.ziel, `${b.name}: Zielwert fehlt`).not.toBeNull();
        expect(b.gebaut, `${b.name}: fehlt im gebauten Stand`).not.toBeNull();
        expect(b.gleich, `${b.name}: ziel=${b.ziel} gebaut=${b.gebaut}`).toBe(true);
      }
      for (const w of WERTE_FRAGEWEG_PRUEFUNG) {
        expect(w.messpunkt, `${w.name}: Zeile ohne Messpunkt`).toBeDefined();
      }
      // Gelesen heisst: ausser der Definition und dieser Messung liest sie der Chromium-Vergleich.
      const leser = dateienMit("WERTE_FRAGEWEG_PRUEFUNG", [
        "tests",
        "tools",
        "apps/web/src",
        "services",
      ]);
      expect(leser.sort()).toEqual(
        [
          "tests/design/zielbild-pruefunglaeuft-messung.test.ts",
          "tests/design/zielbild-pruefunglaeuft.test.ts",
          "tools/design-vergleich/werte.ts",
        ].sort(),
      );
    });

    it("V — LIEFERUNG 6: die fünf Träger der Verlustliste am laufenden Panel — Statusfläche (geteilt, im Warten verborgen), askBusy am Satz, Sperre von Knopf UND Feld, Aufräumen des ANTWORT-Ausgangs, Frist (der Lücken-Ausgang steht in U2)", async () => {
      offener = panelMitOffenemAsk();
      await offener.panel.flush();
      // (1) Ein voriges Ergebnis liegt vor: eine beantwortete Frage (Fixture-Route) fuellt den
      //     Antwortblock — Grundlage fuer den Beleg, dass resetAskResult() ihn wegraeumt.
      pflicht(offener.panel, "#ask-input").value = "Vorige Frage";
      offener.panel.askKlara();
      await offener.panel.flush();
      await offener.panel.flush();
      expect(versteckt(pflicht(offener.panel, "#ask-answer-block")), "voriges Ergebnis fehlt").toBe(
        false,
      );
      expect(pflicht(offener.panel, "#ask-answer-edit").value).toContain("Kennzeichnung S");
      // (2) Der Traeger #ask-status ist GETEILT: dieselbe Flaeche traegt weiterhin askEmpty —
      //     und die Ladekarte bleibt dabei verborgen (kein Warten ohne Frage).
      pflicht(offener.panel, "#ask-input").value = "";
      offener.panel.askKlara();
      expect(pflicht(offener.panel, "#ask-status").className).toBe("status warn");
      expect(pflicht(offener.panel, "#ask-status").textContent).toBe(offener.panel.t("askEmpty"));
      expect(versteckt(pflicht(offener.panel, "#ask-ladekarte"))).toBe(true);
      expect(pflicht(offener.panel, "#ask-input").disabled).toBe(false);
      // (3) Jetzt der Wartezustand mit offenem Fetch — die askEmpty-Warnung verschwindet dabei.
      pflicht(offener.panel, "#ask-input").value = "Vorige Frage";
      offener.panel.askKlara();
      await offener.panel.flush();
      await offener.panel.flush();
      offener.halten();
      const bild = offener.absenden(FRAGE_IM_ZIELBILD);
      imWartezustand(offener, bild);
      expect(bild.statusKlasse).toBe("status hidden");
      expect(bild.statusText).toBe("");
      expect(bild.satzText).toBe(offener.panel.t("askBusy"));
      expect(bild.knopfGesperrt).toBe(true);
      expect(bild.eingabeGesperrt).toBe(true);
      // resetAskResult(): das vorige Ergebnis ist weg, bevor gewartet wird.
      expect(bild.antwortBlockVersteckt).toBe(true);
      expect(pflicht(offener.panel, "#ask-answer-edit").value).toBe("");
      expect(pflicht(offener.panel, "#ask-sources").textContent).toBe("");
      // Die Fristen: beim Absenden werden ZWEI Fristen gestellt — die Auswahlfrist (Klick →
      // Word-Rueckruf, 15000 ms) und nach dem Rueckruf die Ask-Frist mit der RESTZEIT derselben
      // Gesamtfrist (Runde 6: hoechstens 15000, bei synchronem Rueckruf praktisch 15000). JOB 3012
      // mass hier eine volle Frist; die Gesamtfrist ab Klick ist unveraendert 15000 ms (G5).
      expect(gestellteFristen(offener)).toHaveLength(2);
      expect(gestellteFristen(offener)[0]).toBe(FRIST_MS);
      expect(gestellteFristen(offener)[1]).toBeLessThanOrEqual(FRIST_MS);
      // Und nach der Luecke sind Knopf und Feld wieder frei, die Karte ist weg — die Sperre gehoert
      // zur Wartezeit (F5, der Luecken-Ausgang).
      offener.freigeben();
      await offener.panel.flush();
      await offener.panel.flush();
      const danach = nachAusgang(offener.panel);
      expect(danach.knopfGesperrt).toBe(false);
      expect(danach.eingabeGesperrt).toBe(false);
      expect(danach.ladekarteVersteckt).toBe(true);
      expect(danach.satzVersteckt).toBe(true);
      expect(versteckt(pflicht(offener.panel, "#ask-gap-block"))).toBe(false);
      expect(VERLUSTLISTE).toHaveLength(5);
      expect(VERLUSTLISTE.filter((t) => t.platzImZielbild.startsWith("keiner"))).toHaveLength(1);
      for (const t of VERLUSTLISTE) {
        expect(t.platzNachUmbau.length, `${t.traeger}: Platz nach dem Umbau fehlt`).toBeGreaterThan(
          20,
        );
      }
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
      const antwortBlock = pflicht(offener.panel, "#ask-answer-block");
      expect(
        versteckt(antwortBlock),
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
      // neu sichtbar. JOB 3016: #ask-status bleibt waehrend des Wartens verborgen (hideAskStatus());
      // an seiner Stelle werden #ask-ladekarte und #ask-ladekarte-satz neu sichtbar (DOM-Reihenfolge).
      expect(bild.neuSichtbar).toEqual(["ask-karte", "ask-ladekarte", "ask-ladekarte-satz"]);
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
      // Nach der Luecke ist die Statuszeile leer — und bleibt es im Wartezustand.
      expect(versteckt(pflicht(offener.panel, "#ask-status"))).toBe(true);
      offener.halten();
      const bild = offener.absenden(FRAGE_IM_ZIELBILD);
      imWartezustand(offener, bild);
      expect(bild.lueckeBlockVersteckt).toBe(true);
      expect(bild.neuVersteckt).toContain("ask-gap-block");
      expect(bild.neuSichtbar).toEqual(["ask-ladekarte", "ask-ladekarte-satz"]);
      expect(bild.statusSichtbar).toBe(false);
    });

    it("V3 — der Wortlaut askBusy liegt in drei Sprachen vor (DE/EN/NL), jede mit BEIDEN Hälften: freigegebenes Wissen UND Eingabe gesperrt", async () => {
      offener = panelMitOffenemAsk();
      await offener.panel.flush();
      const texte: Record<string, string> = {};
      for (const code of ["de", "en", "nl"]) {
        offener.panel.setLang(code);
        await offener.panel.flush();
        texte[code] = offener.panel.t("askBusy");
      }
      // JOB 3012 mass hier dreimal „KLARWERK-Wissen ...“ ohne Sperr-Zusage — gedreht.
      expect(texte).toEqual({
        de: "Klara sucht im freigegebenen Wissen — die Eingabe ist so lange gesperrt.",
        en: "Klara is searching the approved knowledge — input is locked until then.",
        nl: "Klara zoekt in de vrijgegeven kennis — de invoer is zolang vergrendeld.",
      });
      expect(texte.de).toBe(soll["satz-wortlaut"]);
      expect(texte.de).toContain("freigegebenen Wissen");
      expect(texte.de).toContain("gesperrt");
      expect(texte.en).toContain("approved knowledge");
      expect(texte.en).toContain("locked");
      expect(texte.nl).toContain("vrijgegeven kennis");
      expect(texte.nl).toContain("vergrendeld");
      for (const text of Object.values(texte)) {
        expect(text).not.toContain("KLARWERK-Wissen ...");
        expect(text.endsWith("...")).toBe(false);
      }
      // Der Sprachwechsel zieht den sichtbaren Satz mit (data-t), nicht nur das Woerterbuch.
      offener.panel.setLang("nl");
      await offener.panel.flush();
      expect(pflicht(offener.panel, "#ask-ladekarte-satz").textContent).toBe(texte.nl);
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
          expect([OHNE_TRAEGER, IN_CHROMIUM]).toContain(z.urteil);
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
        // Und umgekehrt: ist der Traeger da, sagt keine Zeile mehr „nicht vorhanden“.
        if (traeger !== undefined && !traegerFehlt(bild, traeger)) {
          expect(
            z.ist,
            `${z.kennung}: Traeger ${traeger} ist da, Ist sagt „nicht vorhanden“`,
          ).not.toContain(NICHT_VORHANDEN);
        }
      }
      // JOB 3012 mass alle drei Traeger als fehlend; seit JOB 3016 fehlt allein die Pille (D1).
      expect(traegerFehlt(bild, "pille")).toBe(true);
      expect(traegerFehlt(bild, "karte")).toBe(false);
      expect(traegerFehlt(bild, "balken")).toBe(false);
      const urteile = { erfüllt: 0, abweichend: 0, ohneTraeger: 0, inChromium: 0 };
      for (const z of tabelle) {
        if (z.urteil === "erfüllt") {
          urteile.erfüllt += 1;
        } else if (z.urteil === "abweichend") {
          urteile.abweichend += 1;
        } else if (z.urteil === OHNE_TRAEGER) {
          urteile.ohneTraeger += 1;
        } else {
          urteile.inChromium += 1;
        }
      }
      // GEMESSEN am Stand nach JOB 3016 (Basis e8a35bf + Umbau): erfuellt sind Karte, Balkenzahl,
      // Wortlaut, Eingabesperre und „ein einziger Hinweis“; abweichend bleiben Pille und Pillentext
      // (D1/JOB 3004); sechs Pillen-Darstellungswerte haben keinen Traeger; elf Darstellungswerte
      // von Karte, Balken und Satz misst Chromium (zielbild-pruefunglaeuft.test.ts, alle gleich).
      // JOB 3012 stand bei 1 / 6 / 17 nicht messbar.
      expect(urteile).toEqual({ erfüllt: 5, abweichend: 2, ohneTraeger: 6, inChromium: 11 });
      const befunde = tabelle
        .filter((z) => z.istBefund !== undefined)
        .map((z) => `  Ist-Befund (ohne Urteilswirkung) ${z.kennung}: ${z.istBefund}`);
      expect(befunde).toHaveLength(1);
      console.info(
        [
          "JOB 3012 · D3 · Abweichungstabelle PruefungLaeuft (Stand: laufendes Panel, nach JOB 3016)",
        ]
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
      // JOB 3012 kippte hier zum Sollwert HIN; seit JOB 3016 wird vom Sollwert WEG gekippt.
      pflicht(offener.panel, "#ask-ladekarte-satz").textContent =
        "Klara sucht im KLARWERK-Wissen ...";
      pflicht(offener.panel, "#ask-btn").disabled = false;
      pflicht(offener.panel, "#ask-input").disabled = false;
      const gekippt = wartebild(offener.panel, vorher);
      expect(gekippt.satzText).not.toBe(echt.satzText);
      expect(gekippt.knopfGesperrt).not.toBe(echt.knopfGesperrt);
      expect(gekippt.eingabeGesperrt).not.toBe(echt.eingabeGesperrt);
      const tabelle = abweichungstabelle(soll, gekippt);
      const zeile = (k: SollKennung): Urteil =>
        tabelle.find((z) => z.kennung === k)?.urteil ?? IN_CHROMIUM;
      expect(zeile("satz-wortlaut")).toBe("abweichend");
      expect(zeile("satz-zusage-eingabe-gesperrt")).toBe("abweichend");
      const echteTabelle = abweichungstabelle(soll, echt);
      expect(echteTabelle.find((z) => z.kennung === "satz-wortlaut")?.urteil).toBe("erfüllt");
      expect(echteTabelle.find((z) => z.kennung === "satz-zusage-eingabe-gesperrt")?.urteil).toBe(
        "erfüllt",
      );
    });

    // ------------------------------------------------------------------------------------------
    // JOB 3016 LIEFERUNG 4/7 — DIE FREIGABE JE AUSGANG (fail-open). Ein Feld, das nach Frist oder
    // Fehler gesperrt bleibt, macht das Fenster unbenutzbar. Je Ausgang ein eigener Fall; der
    // Luecken-Ausgang steht in V.
    // ------------------------------------------------------------------------------------------

    it("F1 — FREIGABE NACH ANTWORT: Karte und Satz weg, Feld und Knopf frei, Antwortblock sichtbar", async () => {
      offener = panelMitOffenemAsk();
      await offener.panel.flush();
      offener.halten();
      const bild = offener.absenden(FRAGE_IM_ZIELBILD);
      imWartezustand(offener, bild);
      expect(bild.eingabeGesperrt).toBe(true);
      offener.freigebenMit(antwort(200, ANTWORT_MIT_QUELLE_KOERPER));
      await offener.panel.flush();
      await offener.panel.flush();
      const danach = nachAusgang(offener.panel);
      expect(danach.eingabeGesperrt).toBe(false);
      expect(danach.knopfGesperrt).toBe(false);
      expect(danach.ladekarteVersteckt).toBe(true);
      expect(danach.satzVersteckt).toBe(true);
      expect(danach.antwortBlockVersteckt).toBe(false);
      expect(pflicht(offener.panel, "#ask-answer-edit").value).toContain("Kennzeichnung S");
    });

    it("F2 — FREIGABE NACH FRIST (15000 ms): Karte weg, Feld und Knopf frei, askTimeout im Warnkasten", async () => {
      offener = panelMitOffenemAsk();
      await offener.panel.flush();
      offener.halten();
      const bild = offener.absenden(FRAGE_IM_ZIELBILD);
      imWartezustand(offener, bild);
      expect(gestellteFristen(offener)).toHaveLength(2);
      // Die (zuletzt gestellte) Ask-Frist zieht den AbortController des Panels; der gehaltene
      // Fetch verwirft daraufhin.
      offener.fristAusloesen();
      await offener.panel.flush();
      await offener.panel.flush();
      expect(offener.offen()).toBe(false);
      const danach = nachAusgang(offener.panel);
      expect(danach.eingabeGesperrt).toBe(false);
      expect(danach.knopfGesperrt).toBe(false);
      expect(danach.ladekarteVersteckt).toBe(true);
      expect(danach.satzVersteckt).toBe(true);
      expect(danach.statusKlasse).toBe("status warn");
      expect(danach.statusText).toBe(offener.panel.t("askTimeout"));
    });

    it("F3 — FREIGABE NACH FEHLER (Netz): Karte weg, Feld und Knopf frei, askError im Warnkasten", async () => {
      offener = panelMitOffenemAsk();
      await offener.panel.flush();
      offener.halten();
      const bild = offener.absenden(FRAGE_IM_ZIELBILD);
      imWartezustand(offener, bild);
      offener.verwerfen(new Error("offline"));
      await offener.panel.flush();
      await offener.panel.flush();
      const danach = nachAusgang(offener.panel);
      expect(danach.eingabeGesperrt).toBe(false);
      expect(danach.knopfGesperrt).toBe(false);
      expect(danach.ladekarteVersteckt).toBe(true);
      expect(danach.satzVersteckt).toBe(true);
      expect(danach.statusKlasse).toBe("status warn");
      expect(danach.statusText).toBe(offener.panel.t("askError", { detail: "offline" }));
    });

    it("F4 — FREIGABE NACH FEHLENDER ANMELDUNG (401): Karte weg, Feld frei, askAuth im Warnkasten", async () => {
      offener = panelMitOffenemAsk();
      await offener.panel.flush();
      offener.halten();
      const bild = offener.absenden(FRAGE_IM_ZIELBILD);
      imWartezustand(offener, bild);
      offener.freigebenMit(antwort(401, {}));
      await offener.panel.flush();
      await offener.panel.flush();
      const danach = nachAusgang(offener.panel);
      // Das Feld ist frei, egal was die Sitzung sagt (fail-open); der Knopf haengt weiter an der
      // Anmeldung — die Fixture bestaetigt sie bei der Nachpruefung (checkSession), also frei.
      expect(danach.eingabeGesperrt).toBe(false);
      expect(danach.knopfGesperrt).toBe(false);
      expect(danach.ladekarteVersteckt).toBe(true);
      expect(danach.satzVersteckt).toBe(true);
      expect(danach.statusKlasse).toBe("status warn");
      expect(danach.statusText).toBe(offener.panel.t("askAuth"));
    });

    // ------------------------------------------------------------------------------------------
    // JOB 3016 RUNDE 4 (BEN) — DER WORD-WEG IST ASYNCHRON. Zwischen Klick und Wartezustand liegt
    // der Auswahlrueckruf von `getSelectedDataAsync`; die Fixture ruft ihn synchron zurueck und
    // umging damit die Kante, an der bis Runde 3 ein zweiter Klick einen zweiten Lauf startete.
    // Hier wird der Rueckruf FESTGEHALTEN — am Office-Objekt der laufenden Fixture-Sitzung, nicht
    // in der Fixture (Zielpfad von JOB 3008); `restore()` setzt das Objekt zurueck.
    // ------------------------------------------------------------------------------------------
    type AuswahlRueckruf = (r: { status: string; value: string }) => void;
    interface OfficeSicht {
      context: { document: { getSelectedDataAsync: (typ: string, cb: AuswahlRueckruf) => void } };
    }
    function auswahlFesthalten(): { rueckrufe(): number; liefern(text: string): number } {
      const office = (globalThis as unknown as { Office: OfficeSicht }).Office;
      const wartend: AuswahlRueckruf[] = [];
      let anzahl = 0;
      office.context.document.getSelectedDataAsync = (_typ, cb) => {
        anzahl += 1;
        wartend.push(cb);
      };
      return {
        rueckrufe: () => anzahl,
        liefern(text) {
          const jetzt = wartend.splice(0);
          for (const cb of jetzt) {
            cb({ status: "succeeded", value: text });
          }
          return jetzt.length;
        },
      };
    }

    it("G1 — SINGLE FLIGHT im Word-Weg: Auswahlrueckruf offen, zwei Klicks und ein direkter Aufruf → genau ein Rueckruf, genau ein POST; Karte und Sperre stehen ab dem ersten Klick bis zum Ende", async () => {
      offener = panelMitOffenemAsk();
      await offener.panel.flush();
      offener.halten();
      const auswahl = auswahlFesthalten();
      pflicht(offener.panel, "#ask-input").value = FRAGE_IM_ZIELBILD;
      const vorher = verstecktBild();
      const knopf = pflicht(offener.panel, "#ask-btn") as unknown as {
        click(): void;
        disabled: boolean;
      };
      knopf.click();
      // Sofort nach dem ERSTEN Klick, VOR jedem Rueckruf: Tor zu, Karte da, Feld und Knopf gesperrt.
      expect(auswahl.rueckrufe(), "der erste Klick hat keinen Auswahlrueckruf angestossen").toBe(1);
      expect(knopf.disabled).toBe(true);
      expect(pflicht(offener.panel, "#ask-input").disabled).toBe(true);
      expect(versteckt(pflicht(offener.panel, "#ask-ladekarte"))).toBe(false);
      expect(offener.abgegangen()).toBe(0);
      // Der zweite Klick (DOM) und ein direkter Aufruf, der am `disabled` vorbeigeht.
      knopf.click();
      offener.panel.askKlara();
      expect(auswahl.rueckrufe(), "ein zweiter Auswahlrueckruf ist abgegangen").toBe(1);
      expect(offener.abgegangen()).toBe(0);
      // Jetzt liefert Word die (leere) Auswahl fuer den EINEN Rueckruf → die getippte Frage geht ab.
      expect(auswahl.liefern("")).toBe(1);
      const bild = wartebild(offener.panel, vorher);
      imWartezustand(offener, bild);
      expect(bild.eingabeGesperrt).toBe(true);
      expect(bild.knopfGesperrt).toBe(true);
      expect(bild.statusSichtbar).toBe(false);
      await offener.panel.flush();
      expect(offener.abgegangen(), "ein zweiter POST /api/ask ist abgegangen").toBe(1);
      expect(offener.offen()).toBe(true);
      expect(versteckt(pflicht(offener.panel, "#ask-ladekarte"))).toBe(false);
      expect(pflicht(offener.panel, "#ask-input").disabled).toBe(true);
      // Der eine Ausgang gibt frei — und das Tor ist danach wieder offen (naechster Klick geht ab).
      offener.freigeben();
      await offener.panel.flush();
      await offener.panel.flush();
      const danach = nachAusgang(offener.panel);
      expect(danach.eingabeGesperrt).toBe(false);
      expect(danach.knopfGesperrt).toBe(false);
      expect(danach.ladekarteVersteckt).toBe(true);
      knopf.click();
      expect(auswahl.rueckrufe()).toBe(2);
      expect(auswahl.liefern("")).toBe(1);
      await offener.panel.flush();
      expect(offener.abgegangen()).toBe(2);
    });

    it("G2 — FAIL-OPEN am Tor: wirft das Absenden synchron (fetch nicht aufrufbar), fallen Tor, Karte und Sperre sofort, askError nennt den Grund — der naechste Klick geht wieder ab", async () => {
      offener = panelMitOffenemAsk();
      await offener.panel.flush();
      const g = globalThis as unknown as { fetch: unknown; window: { fetch: unknown } };
      const vorherFetch = g.fetch;
      const kaputt = () => {
        throw new Error("fetch kaputt");
      };
      g.fetch = kaputt;
      g.window.fetch = kaputt;
      pflicht(offener.panel, "#ask-input").value = FRAGE_IM_ZIELBILD;
      const panel = offener.panel;
      // Runde 5: kein Wurf mehr aus dem Klick heraus — der Fehler wird gefangen und angezeigt.
      expect(() => panel.askKlara()).not.toThrow();
      g.fetch = vorherFetch;
      g.window.fetch = vorherFetch;
      const danach = nachAusgang(panel);
      expect(danach.eingabeGesperrt).toBe(false);
      expect(danach.knopfGesperrt).toBe(false);
      expect(danach.ladekarteVersteckt).toBe(true);
      expect(danach.satzVersteckt).toBe(true);
      expect(danach.statusKlasse).toBe("status warn");
      expect(danach.statusText).toBe(panel.t("askError", { detail: "fetch kaputt" }));
      // Das Tor ist wirklich gefallen: der naechste Klick geht ab.
      offener.halten();
      const bild = offener.absenden(FRAGE_IM_ZIELBILD);
      imWartezustand(offener, bild);
    });

    // ------------------------------------------------------------------------------------------
    // JOB 3016 RUNDE 5 (BEN) — DIE AUSWAHLPHASE IST EIN BEGRENZTER LAUF. Word kann den Rueckruf
    // schuldig bleiben (G3), synchron werfen (G4) oder ihn erst liefern, wenn der Lauf vorbei ist
    // (G3, zweiter Teil). Jeder dieser Ausgaenge muss Tor, Karte und Sperre loesen, ehrlich melden,
    // KEINEN nachtraeglichen Ask ausloesen — und danach einen sauberen Einzel-Ask erlauben.
    // ------------------------------------------------------------------------------------------

    it("G3 — AUSWAHLRUECKRUF BLEIBT AUS: die Auswahlfrist gibt frei (askSelectionTimeout, 0 POST); ein verspaeteter Rueckruf wird ignoriert (0 POST, Feld bleibt frei); der naechste Klick startet genau einen Rueckruf und einen Ask", async () => {
      offener = panelMitOffenemAsk();
      await offener.panel.flush();
      offener.halten();
      const auswahl = auswahlFesthalten();
      // Klick: Tor zu, Karte da — und Word antwortet nicht.
      const bild = offener.absenden(FRAGE_IM_ZIELBILD);
      expect(auswahl.rueckrufe()).toBe(1);
      expect(bild.ladekarteSichtbar).toBe(true);
      expect(bild.eingabeGesperrt).toBe(true);
      expect(offener.abgegangen()).toBe(0);
      // Beim Klick wurde genau EINE Frist gestellt: die Auswahlfrist (die Ask-Frist kaeme erst
      // nach dem Rueckruf).
      expect(gestellteFristen(offener)).toEqual([FRIST_MS]);
      offener.fristAusloesen();
      const nachFrist = nachAusgang(offener.panel);
      expect(nachFrist.eingabeGesperrt).toBe(false);
      expect(nachFrist.knopfGesperrt).toBe(false);
      expect(nachFrist.ladekarteVersteckt).toBe(true);
      expect(nachFrist.satzVersteckt).toBe(true);
      expect(nachFrist.statusKlasse).toBe("status warn");
      expect(nachFrist.statusText).toBe(offener.panel.t("askSelectionTimeout"));
      expect(offener.abgegangen(), "ohne Rueckruf darf kein Ask abgehen").toBe(0);
      // Der VERSPAETETE Rueckruf des beendeten Laufs: wird ignoriert — kein Ask, keine Sperre.
      expect(auswahl.liefern("")).toBe(1);
      await offener.panel.flush();
      expect(offener.abgegangen(), "ein verspaeteter Rueckruf hat einen Ask ausgeloest").toBe(0);
      const nachVerspaetet = nachAusgang(offener.panel);
      expect(nachVerspaetet.eingabeGesperrt).toBe(false);
      expect(nachVerspaetet.ladekarteVersteckt).toBe(true);
      expect(nachVerspaetet.statusText).toBe(offener.panel.t("askSelectionTimeout"));
      // Der naechste Klick: genau ein neuer Rueckruf, genau ein Ask.
      const bild2 = offener.absenden(FRAGE_IM_ZIELBILD);
      expect(auswahl.rueckrufe()).toBe(2);
      expect(bild2.ladekarteSichtbar).toBe(true);
      expect(auswahl.liefern("")).toBe(1);
      await offener.panel.flush();
      expect(offener.abgegangen()).toBe(1);
      expect(offener.offen()).toBe(true);
      expect(pflicht(offener.panel, "#ask-input").disabled).toBe(true);
      expect(versteckt(pflicht(offener.panel, "#ask-ladekarte"))).toBe(false);
    });

    it("G4 — getSelectedDataAsync WIRFT SYNCHRON: Tor, Karte und Sperre fallen sofort, askError nennt den Grund, 0 POST — der naechste Klick startet genau einen Rueckruf und einen Ask", async () => {
      offener = panelMitOffenemAsk();
      await offener.panel.flush();
      offener.halten();
      const office = (globalThis as unknown as { Office: OfficeSicht }).Office;
      office.context.document.getSelectedDataAsync = () => {
        throw new Error("Office kaputt");
      };
      const panel = offener.panel;
      pflicht(panel, "#ask-input").value = FRAGE_IM_ZIELBILD;
      expect(() => panel.askKlara()).not.toThrow();
      const danach = nachAusgang(panel);
      expect(danach.eingabeGesperrt).toBe(false);
      expect(danach.knopfGesperrt).toBe(false);
      expect(danach.ladekarteVersteckt).toBe(true);
      expect(danach.satzVersteckt).toBe(true);
      expect(danach.statusKlasse).toBe("status warn");
      expect(danach.statusText).toBe(panel.t("askError", { detail: "Office kaputt" }));
      await panel.flush();
      expect(offener.abgegangen()).toBe(0);
      // Word antwortet wieder: der naechste Klick geht sauber durch.
      const auswahl = auswahlFesthalten();
      const bild = offener.absenden(FRAGE_IM_ZIELBILD);
      expect(auswahl.rueckrufe()).toBe(1);
      expect(bild.ladekarteSichtbar).toBe(true);
      expect(auswahl.liefern("")).toBe(1);
      await panel.flush();
      expect(offener.abgegangen()).toBe(1);
      expect(offener.offen()).toBe(true);
      expect(pflicht(panel, "#ask-input").disabled).toBe(true);
    });

    // ------------------------------------------------------------------------------------------
    // JOB 3016 RUNDE 6 (BEN) — EINE ABSOLUTE GESAMTFRIST AB KLICK. Das Versprechen „wartet bis zu
    // 15 Sekunden" gilt fuer den ganzen Lauf. Grenzfall: Word liefert den Rueckruf erst bei
    // 14 999 ms, danach bleibt der Server-Fetch offen — spaetestens bei 15 000 ms ab Klick muessen
    // Karte und Sperre enden. Die Uhr des Panels (`Date.now`) wird dafuer im Speicher der Sitzung
    // vorgestellt; die Fristen selbst laufen echt (1 ms Rest).
    // ------------------------------------------------------------------------------------------

    it("G5 — GESAMTFRIST: Auswahlrueckruf bei 14 999 ms, dann offener Fetch → performAsk erhaelt nur die Restzeit (1 ms), das Panel gibt bei 15 000 ms ab Klick frei (askTimeout), genau ein POST, kein nachtraeglicher; der naechste Klick startet genau einen Ask", async () => {
      offener = panelMitOffenemAsk();
      await offener.panel.flush();
      offener.halten();
      const auswahl = auswahlFesthalten();
      const uhr = globalThis as unknown as { Date: { now: () => number } };
      const echteNow = uhr.Date.now;
      const klick = echteNow();
      uhr.Date.now = () => klick;
      try {
        const bild = offener.absenden(FRAGE_IM_ZIELBILD);
        expect(auswahl.rueckrufe()).toBe(1);
        expect(bild.ladekarteSichtbar).toBe(true);
        expect(gestellteFristen(offener)).toEqual([FRIST_MS]);
        // Word antwortet erst bei 14 999 ms nach dem Klick.
        uhr.Date.now = () => klick + FRIST_MS - 1;
        const fixtureSetTimeout = globalThis.setTimeout;
        const askFristen: number[] = [];
        globalThis.setTimeout = ((handler: () => void, ms?: number) => {
          askFristen.push(ms ?? 0);
          return fixtureSetTimeout(handler, ms);
        }) as unknown as typeof globalThis.setTimeout;
        try {
          expect(auswahl.liefern("")).toBe(1);
        } finally {
          globalThis.setTimeout = fixtureSetTimeout;
        }
        // performAsk bekam die RESTZEIT der Gesamtfrist, nicht erneut 15 000 ms.
        expect(askFristen).toEqual([1]);
        expect(offener.abgegangen()).toBe(1);
        expect(pflicht(offener.panel, "#ask-input").disabled).toBe(true);
      } finally {
        uhr.Date.now = echteNow;
      }
      // Die Restfrist (1 ms) laeuft echt ab: Karte weg, Feld frei, askTimeout — kein zweiter POST.
      await offener.panel.flush();
      await offener.panel.flush();
      expect(offener.offen(), "der offene Fetch wurde durch die Restfrist abgebrochen").toBe(false);
      const danach = nachAusgang(offener.panel);
      expect(danach.eingabeGesperrt).toBe(false);
      expect(danach.knopfGesperrt).toBe(false);
      expect(danach.ladekarteVersteckt).toBe(true);
      expect(danach.satzVersteckt).toBe(true);
      expect(danach.statusKlasse).toBe("status warn");
      expect(danach.statusText).toBe(offener.panel.t("askTimeout"));
      expect(offener.abgegangen()).toBe(1);
      // Der naechste Klick: genau ein Rueckruf, genau ein Ask.
      const bild2 = offener.absenden(FRAGE_IM_ZIELBILD);
      expect(auswahl.rueckrufe()).toBe(2);
      expect(bild2.ladekarteSichtbar).toBe(true);
      expect(auswahl.liefern("")).toBe(1);
      await offener.panel.flush();
      expect(offener.abgegangen()).toBe(2);
    });

    // ------------------------------------------------------------------------------------------
    // JOB 3016 RUNDE 7 (BEN) — DIE KANTE SELBST. Trifft der Word-Rueckruf exakt bei oder nach
    // 15 000 ms ein, BEVOR der Auswahl-Timer Gelegenheit hatte zu laufen, darf trotzdem kein Ask
    // abgehen: der Rueckruf liest die Uhr selbst. Der Timer wird hier bewusst NICHT ausgeloest.
    // ------------------------------------------------------------------------------------------
    async function rueckrufNachAblauf(versatzMs: number): Promise<void> {
      const o = offener as OffenerAsk;
      const auswahl = auswahlFesthalten();
      const uhr = globalThis as unknown as { Date: { now: () => number } };
      const echteNow = uhr.Date.now;
      const klick = echteNow();
      uhr.Date.now = () => klick;
      const askFristen: number[] = [];
      try {
        const bild = o.absenden(FRAGE_IM_ZIELBILD);
        expect(auswahl.rueckrufe()).toBe(1);
        expect(bild.ladekarteSichtbar).toBe(true);
        expect(bild.eingabeGesperrt).toBe(true);
        // Die Uhr steht auf Klick + 15 000 (+ Versatz); der Timer wurde NICHT ausgeloest.
        uhr.Date.now = () => klick + FRIST_MS + versatzMs;
        const fixtureSetTimeout = globalThis.setTimeout;
        globalThis.setTimeout = ((handler: () => void, ms?: number) => {
          askFristen.push(ms ?? 0);
          return fixtureSetTimeout(handler, ms);
        }) as unknown as typeof globalThis.setTimeout;
        try {
          expect(auswahl.liefern("")).toBe(1);
        } finally {
          globalThis.setTimeout = fixtureSetTimeout;
        }
      } finally {
        uhr.Date.now = echteNow;
      }
      // Kein performAsk, keine Ask-Frist, kein POST — der Auswahlfrist-Ausgang, sofort.
      expect(askFristen).toEqual([]);
      expect(o.abgegangen(), "ein abgelaufener Lauf hat einen Ask ausgeloest").toBe(0);
      const danach = nachAusgang(o.panel);
      expect(danach.eingabeGesperrt).toBe(false);
      expect(danach.knopfGesperrt).toBe(false);
      expect(danach.ladekarteVersteckt).toBe(true);
      expect(danach.satzVersteckt).toBe(true);
      expect(danach.statusKlasse).toBe("status warn");
      expect(danach.statusText).toBe(o.panel.t("askSelectionTimeout"));
      await o.panel.flush();
      expect(o.abgegangen()).toBe(0);
      // Danach ein sauberer Einzel-Ask.
      const bild2 = o.absenden(FRAGE_IM_ZIELBILD);
      expect(auswahl.rueckrufe()).toBe(2);
      expect(bild2.ladekarteSichtbar).toBe(true);
      expect(auswahl.liefern("")).toBe(1);
      await o.panel.flush();
      expect(o.abgegangen()).toBe(1);
      expect(o.offen()).toBe(true);
    }

    it("G6 — KANTE: Auswahlrueckruf EXAKT bei 15 000 ms (Timer nicht gelaufen) → 0 POST, Feld frei, Karte weg, askSelectionTimeout; danach genau ein Ask", async () => {
      offener = panelMitOffenemAsk();
      await offener.panel.flush();
      offener.halten();
      await rueckrufNachAblauf(0);
    });

    it("G7 — NACH DER KANTE: Auswahlrueckruf bei 15 500 ms (Timer nicht gelaufen) → 0 POST, Feld frei, Karte weg, askSelectionTimeout; danach genau ein Ask", async () => {
      offener = panelMitOffenemAsk();
      await offener.panel.flush();
      offener.halten();
      await rueckrufNachAblauf(500);
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
