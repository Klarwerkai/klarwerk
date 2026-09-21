// ================================================================================================
// JOB 4363 · DER STAND DER BEREITSCHAFTSKARTE IM ECHTEN BROWSER — DIE STATIONEN, GENAU EINMAL.
// ================================================================================================
//
// WAS HIER ECHT IST — und was ein Nachweis aus diesen Stationen deshalb behaupten darf:
//   · DIE GEBAUTE FLÄCHE (`apps/web/dist`), ausgeliefert von einer ECHTEN Fastify-Instanz auf einem
//     echten Port (`mitFlaeche()` → `registerWebStatic`, derselbe Aufruf wie `server.ts:66`).
//   · EIN ECHTES CHROMIUM mit der echten Sitzung aus der echten Anmeldemaske (Tastatur).
//   · DIE ECHTE VERBINDUNG DIESES PROFILS: `BrowserContext.setOffline` — `navigator.onLine` kippt,
//     `window.online`/`offline` feuern, laufende Anfragen scheitern wie ohne Netz. Das ist
//     dieselbe Quelle, aus der `onlineManager` und damit `useIstOnline()` ihren Wert ziehen.
//   · SICHTBARKEIT je TEXTKNOTEN (`sichtbefund`, `tests/gesamtanweisung-nutzerweg/weg.ts`), nicht
//     `textContent` — REGELN.md 9.
//   · ECHTE TASTENDRÜCKE für den Fokusnachweis (Tab, Enter) und ein echter Mausklick daneben.
//
// WAS NACHGESTELLT IST, ausdrücklich benannt: der GESCHEITERTE Abruf. Er entsteht durch eine
// Hülle um `window.fetch`, die für genau einen Pfad 503 zurückgibt — dieselbe Bauart, mit der
// `tests/design/h6-chromium.ts:344-352` seit JOB 3065 die Fehlerwege dieser Karten misst, nur auf
// der Seitenseite statt an der Weiche. Dieselbe Hülle ist zugleich der ABRUFZÄHLER je Pfad: an ihm
// und nur an ihm wird unterschieden, ob wirklich ein Abruf stattgefunden hat (Auftrag K4).
//
// WAS NICHT GEMESSEN WIRD und deshalb nirgends behauptet: andere Browser, der Word-Add-in-Host,
// Bildschirmleser, echte PostgreSQL. Diese Stationen enden an ihrer Schwelle.
//
// WARUM DIE STATIONEN HIER UND NICHT IN DER TESTDATEI STEHEN: die Kalibrierung fährt DIESELBEN
// Stationen mit einer gezielten Verstellung. Stünden sie zweimal ausgeschrieben da, wäre die
// Kalibrierung eine Aussage über ihre eigene Kopie und nicht über den Nachweis (dasselbe Argument
// wie in `tests/gesamtanweisung-tastaturweg/weg.ts:41-47`).
import { expect } from "vitest";
import type { Sprache } from "../../services/auth/src/meldungen";
import {
  type Browser,
  type Kontext,
  type Seite,
  fn,
  profil,
  tabBisText,
  warte,
} from "../gast-nutzerweg/browserweg";
import { fokusMussSichtbarSein } from "../gesamtanweisung-nutzerweg/weg";
import { sprachbestand } from "../support/i18nBestand";

export const MARKE = "JOB 4363 BEREITSCHAFTSSTAND";

/** Die drei Sprachen und die zwei Kanten, die der Auftrag (K5) verlangt. */
export const SPRACHEN: readonly Sprache[] = ["de", "en", "nl"];
export const SCHMAL = { width: 320, height: 720 } as const;
export const BREIT = { width: 1280, height: 900 } as const;

/** Die Karte, ihr Standhinweis und der Weg dorthin. */
export const KARTE = '[data-testid="detail-bereitschaft"]';
export const HINWEIS = '[data-einst="bereitschaft-stand"]';
export const KARTENPFAD = "/admin?detail=bereitschaft";

/**
 * Die sechs tragenden Quellen der Karte, mit ihren echten Pfaden.
 *
 * Abgeleitet aus `AdminSicherheitDetails.tsx` (`readySources`) über `api/endpoints.ts`:
 * `reasoner.config` → `/api/reasoner/config`, `analytics.overview` → `/api/analytics`,
 * `validation.board` → `/api/validation/board`, `uploadLimits.get` → `/api/upload-limits`,
 * `external.policy` → `/api/external/policy`, `admin.demoStatus` → `/api/admin/demo-seed`.
 */
/**
 * Wie weit die gestaffelten Quellen zurückfallen.
 *
 * ZWEI STÄRKEN, und die Wahl ist keine Geschmacksfrage (BENs Befund an Runde 3):
 *   · „kurz" — wenige Sekunden. Die gestaffelten Quellen bleiben damit INNERHALB der produktiven
 *     Frischefrist von 30 s, und eine Wiederverbindung holt nichts von selbst nach. Wer zusichert
 *     „die Wiederverbindung hat nicht nachgeholt", braucht das.
 *   · „minutengrenze" — bis 2 s nach der nächsten Minutengrenze. Nur dafür da, dass sich die
 *     ANZEIGE (HH:MM) der beiden Stände unterscheidet. Der Preis: die älteste Quelle ist danach
 *     womöglich älter als die Frist, ein Reconnect holt sie zu Recht nach. Runde 3 hat diese
 *     Staffelung versehentlich AUCH dort benutzt, wo „nichts nachgeholt" zugesichert war — der
 *     Fall war dann von der Startsekunde abhängig (BEN: `expected 7 to be 6`).
 */
export type Verzoegerungsart = "kurz" | "minutengrenze";

/** Die kurze Staffelung: klein genug, um die Frischefrist von 30 s nicht anzukratzen. */
const KURZE_STAFFELUNG_MS = 1500;

export const QUELLPFADE = [
  "/api/reasoner/config",
  "/api/analytics",
  "/api/validation/board",
  "/api/upload-limits",
  "/api/external/policy",
  "/api/admin/demo-seed",
] as const;

/**
 * Die Hülle um `window.fetch`. Sie kann viererlei, und mehr nicht:
 *
 *   · ZÄHLEN, je Pfad getrennt — und zwar die hinausgegangenen Anfragen (`zaehler`), die wirklich
 *     EMPFANGENEN Antworten (`antworten`) und den ZEITPUNKT der letzten Antwort (`zuletzt`). Der
 *     Unterschied trägt den Nachweis: „Anfrage raus" ist kein „Antwort da", und nur Letzteres
 *     erneuert einen Stand.
 *   · STÖREN: genau einen Pfadanfang mit 503 beantworten.
 *   · HÄNGEN LASSEN: die genannten Pfadanfänge bekommen eine Antwort, die NIE kommt — so lässt
 *     sich der Zustand herstellen, den BEN gemessen hat (eine Quelle antwortet, fünf bleiben
 *     unterwegs). Eine hängende Anfrage lässt sich später gezielt SCHEITERN lassen.
 *   · VERZÖGERN, in zwei Stärken. „kurz" staffelt um wenige Sekunden — das genügt überall dort,
 *     wo nur der SATZ geprüft wird, und hält die Quellen innerhalb der Frischefrist. Über die
 *     nächste MINUTENGRENZE staffelt, wer den angezeigten Stand (HH:MM) vergleichen will: lägen
 *     beide Zahlen in derselben Minute, wäre „der Stand hat sich nicht verschoben" eine
 *     Zusicherung ohne Gegenstand.
 *
 * Sie läuft als Init-Skript, also VOR dem ersten Skript der Fläche, und zählt damit auch den
 * allerersten Abruf. Bei jedem Seitenaufbau beginnt sie neu — das ist Absicht: gezählt wird immer
 * ab dem Aufbau der gemessenen Seite.
 */
function zaehlskript(verzoegert: readonly string[], art: Verzoegerungsart): string {
  return `(() => {
  const s = {
    zaehler: {},
    antworten: {},
    zuletzt: {},
    stoerung: null,
    haengt: [],
    haengende: {},
    verzoegert: ${JSON.stringify([...verzoegert])},
    ueberMinutengrenze: ${art === "minutengrenze" ? "true" : "false"},
    kurzMs: ${KURZE_STAFFELUNG_MS},
  };
  window.__job4363 = s;
  const echt = window.fetch.bind(window);
  const trifft = (pfad, muster) => muster.some((m) => pfad.indexOf(m) === 0);
  // Bis 2 s NACH der nächsten Minutengrenze — und wenn die Grenze schon in weniger als 3 s
  // erreicht wäre, bis 2 s nach der übernächsten. So liegt die unverzögerte Antwort garantiert
  // mindestens 3 s VOR der Grenze und damit sicher in einer anderen Minute.
  const wartezeit = () => {
    const d = new Date();
    let rest = (60 - d.getSeconds()) * 1000 - d.getMilliseconds();
    if (rest < 3000) { rest += 60000; }
    return rest + 2000;
  };
  window.fetch = (eingabe, init) => {
    const roh = typeof eingabe === "string" ? eingabe : (eingabe && eingabe.url) || "";
    let pfad = roh;
    try { pfad = new URL(roh, window.location.origin).pathname; } catch (e) {}
    s.zaehler[pfad] = (s.zaehler[pfad] || 0) + 1;
    if (trifft(pfad, s.haengt)) {
      return new Promise((_, abbrechen) => {
        (s.haengende[pfad] = s.haengende[pfad] || []).push(abbrechen);
      });
    }
    const merke = (r) => {
      s.antworten[pfad] = (s.antworten[pfad] || 0) + 1;
      s.zuletzt[pfad] = Date.now();
      return r;
    };
    if (s.stoerung !== null && pfad.indexOf(s.stoerung) === 0) {
      return Promise.resolve(merke(new Response(JSON.stringify({ error: "JOB4363", message: "gestoert" }), {
        status: 503,
        headers: { "content-type": "application/json" },
      })));
    }
    const warte = trifft(pfad, s.verzoegert)
      ? new Promise((weiter) => setTimeout(weiter, s.ueberMinutengrenze ? wartezeit() : s.kurzMs))
      : Promise.resolve();
    return warte.then(() => echt(eingabe, init)).then(merke);
  };
})();`;
}

const ZAEHLER_LESEN = "() => (window.__job4363 ? window.__job4363.zaehler : {})";
const ANTWORTEN_LESEN = "() => (window.__job4363 ? window.__job4363.antworten : {})";
const STOERUNG_SETZEN =
  "(p) => { if (window.__job4363) { window.__job4363.stoerung = p; } return p; }";
const HAENGEN_SETZEN =
  "(p) => { if (window.__job4363) { window.__job4363.haengt = p; } return p.length; }";
/** Die hängenden Anfragen EINES Pfades mit einem Netzfehler auflösen. */
const SCHEITERN_LASSEN = `(p) => {
  const s = window.__job4363;
  const offen = (s && s.haengende[p]) || [];
  const n = offen.length;
  for (const abbrechen of offen) { abbrechen(new TypeError("JOB4363: Netzfehler")); }
  if (s) { s.haengende[p] = []; }
  return n;
}`;
/** Die Minute der LETZTEN empfangenen Antwort eines Pfades, formatiert wie die Karte sie zeigt. */
const MINUTE_VON = `(p) => {
  const t = window.__job4363 ? window.__job4363.zuletzt[p] : 0;
  return t ? new Date(t).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : null;
}`;

/** Die Summe der ECHTEN Abrufe über alle sechs tragenden Quellen. */
export async function abrufe(seite: Seite): Promise<number> {
  const zaehler = await seite.evaluate<Record<string, number>>(fn(ZAEHLER_LESEN));
  return QUELLPFADE.reduce((summe, pfad) => summe + (zaehler[pfad] ?? 0), 0);
}

/** Wie oft EINE Quelle wirklich eine Antwort empfangen hat — nicht, wie oft gefragt wurde. */
export async function antwortenFuer(seite: Seite, pfad: string): Promise<number> {
  const antworten = await seite.evaluate<Record<string, number>>(fn(ANTWORTEN_LESEN));
  return antworten[pfad] ?? 0;
}

/** Einen Pfad ab jetzt mit 503 beantworten — `null` hebt die Störung wieder auf. */
export async function stoere(seite: Seite, pfad: string | null): Promise<void> {
  await seite.evaluate<string | null>(fn(STOERUNG_SETZEN), pfad);
}

/** Diese Pfade bekommen ab jetzt gar keine Antwort mehr — leere Liste hebt es wieder auf. */
export async function lassHaengen(seite: Seite, pfade: readonly string[]): Promise<void> {
  await seite.evaluate<number>(fn(HAENGEN_SETZEN), [...pfade]);
}

/** Die beim Seitenaufbau verzögerten Pfade wieder freigeben. */
export async function keineVerzoegerungMehr(seite: Seite): Promise<void> {
  await seite.evaluate<number>(
    fn("() => { if (window.__job4363) { window.__job4363.verzoegert = []; } return 0; }"),
  );
}

/** Die hängenden Anfragen EINES Pfades mit einem Netzfehler auflösen; gibt ihre Zahl zurück. */
export async function lassScheitern(seite: Seite, pfad: string): Promise<number> {
  return seite.evaluate<number>(fn(SCHEITERN_LASSEN), pfad);
}

/**
 * Die Minute der letzten empfangenen Antwort dieses Pfades — in der Schreibweise der Karte.
 *
 * Formatiert wird IM BROWSER (`toLocaleTimeString`, dieselben Optionen wie in
 * `bereitschaftstandhinweis.tsx`), nicht im Testprozess: dessen Zeitzone muss nicht die des
 * Browserprofils sein, und ein Vergleich über zwei Zeitzonen hinweg misst nichts.
 */
export async function minuteVon(seite: Seite, pfad: string): Promise<string | null> {
  return seite.evaluate<string | null>(fn(MINUTE_VON), pfad);
}

/** Die Sollwerte kommen aus dem Sprachkatalog der Oberfläche — nicht aus einer Abschrift hier. */
export interface Sollwerte {
  standVon: string;
  offline: string;
  netzluecke: string;
  laeuft: string;
  gescheitert: string;
  wiederholen: string;
  uploadZeile: string;
}

/**
 * Die erwarteten Texte einer Sprache.
 *
 * Jeder Wert wird auf NICHTLEERE geprüft: ein `includes("")` wäre immer wahr, und der ganze
 * Nachweis darunter bliebe grün, während die Beschriftung aus dem Katalog verschwände.
 */
export function sollwerte(sprache: string): Sollwerte {
  const bestand = sprachbestand(sprache);
  const hole = (schluessel: string): string => {
    const wert = bestand[schluessel];
    expect(
      wert,
      `${MARKE}: der Sprachkatalog „${sprache}" führt „${schluessel}" nicht — dann misst dieser Nachweis nichts`,
    ).toBeTruthy();
    return wert as string;
  };
  return {
    // „Stand von {{zeit}}" ohne die Zeit: die Uhrzeit entsteht im Browser und ist kein Katalogwert.
    standVon: hole("einst.wert.stand").replace("{{zeit}}", "").trim(),
    offline: hole("adm.ready.stand.offline"),
    netzluecke: hole("adm.ready.stand.netzluecke"),
    laeuft: hole("adm.ready.stand.laeuft"),
    gescheitert: hole("loadstate.stale"),
    wiederholen: hole("loadstate.error.retry"),
    uploadZeile: hole("adm.ready.upload"),
  };
}

/** In der Seite: steht die Karte mit ihren sechs geladenen Zeilen? */
const ZEILEN_GELADEN = `([karte, laedt]) => {
  const k = document.querySelector(karte);
  if (!k) return false;
  const zeilen = k.querySelectorAll("li");
  return zeilen.length >= 6 && !(k.innerText || "").includes(laedt);
}`;

/** In der Seite: die Uhrzeit-Ziffern im Standhinweis — der BESTÄTIGTE Abrufstand. */
const HINWEIS_TEXT = `(sel) => {
  const el = document.querySelector(sel);
  return el ? (el.innerText || "").replace(/\\s+/g, " ").trim() : "(kein Hinweis)";
}`;

/** In der Seite: gibt es im Standhinweis einen Wiederholen-Knopf? */
const HINWEIS_KNOPF = `(sel) => {
  const el = document.querySelector(sel);
  const b = el ? el.querySelector("button") : null;
  return b ? (b.innerText || "").replace(/\\s+/g, " ").trim() : null;
}`;

/** Ein angemeldetes Profil dieser Sprache und Kante, stehend auf der offenen Bereitschaftskarte. */
export async function karteOffen(
  browser: Browser,
  basis: string,
  sprache: Sprache,
  kante: { width: number; height: number },
  anmelden: (seite: Seite, basis: string) => Promise<void>,
  laedtText: string,
  /**
   * Diese Pfade antworten beim Seitenaufbau SPÄTER als die übrigen.
   *
   * Damit entstehen sechs Quellen mit wirklich unterschiedlichen Abrufzeitpunkten — ohne jeden
   * Fehler und ohne Offlinephase, es beginnt dabei also noch keine Störungsepisode. Genau diese
   * Staffelung brauchen BENs Fälle: eine Quelle ist die ÄLTESTE, und wenn ausgerechnet sie
   * antwortet, darf das den bestätigten Stand nicht erneuern.
   */
  verzoegert: readonly string[] = [],
  /** Wie weit sie zurückfallen — die Wahl ist begründet, siehe `Verzoegerungsart`. */
  art: Verzoegerungsart = "kurz",
): Promise<{ kontext: Kontext; seite: Seite }> {
  const { kontext, seite } = await profil(browser, kante, sprache);
  await kontext.addInitScript(zaehlskript(verzoegert, art));
  await anmelden(seite, basis);
  await seite.goto(`${basis}${KARTENPFAD}`, { waitUntil: "domcontentloaded" });
  await warte(
    seite,
    `() => document.documentElement.lang === ${JSON.stringify(sprache)}`,
    `die Fläche steht auf „${sprache}"`,
    undefined,
    45_000,
  );
  await warte(
    seite,
    ZEILEN_GELADEN,
    `die Bereitschaftskarte steht mit sechs geladenen Zeilen (${sprache}, ${kante.width} px)`,
    [KARTE, laedtText],
    // Staffeln die Quellen über die Minutengrenze, warten sie höchstens rund 62 s. Die Frist muss
    // das aushalten, ohne den Fall aus dem falschen Grund rot zu machen.
    art === "minutengrenze" && verzoegert.length > 0 ? 150_000 : 45_000,
  );
  return { kontext, seite };
}

// ================================================================================================
// SICHTBAR HEISST SICHTBAR — JE TEXTKNOTEN. UND WARUM DIE MESSUNG HIER STEHT.
// ================================================================================================
//
// Die Regel ist die des Hauses (REGELN.md 9, ausgeschrieben in `tests/gesamtanweisung-nutzerweg/
// weg.ts:262-300`): gemessen wird je TEXTKNOTEN, nicht je Absatz, und `textContent` ist kein Beleg.
// Die Bedingungen unten sind wörtlich dieselben — `checkVisibility` am Elternelement, kein
// `content-visibility: hidden` bis zur Wurzel, Deckkraft, Schriftfarbe, die Fläche EINES `Range`
// um genau diese Zeichen, nichtleerer `innerText` des Elternteils.
//
// EINE EINZIGE BEDINGUNG IST ANDERS, und sie ist der Grund für diese Datei: die Prüfung auf eine
// DURCHSICHTIGE SCHRIFTFARBE. Der Hausleser prüft sie so:
//
//     const farbe = String(s.color).replace(/\s/g, "");
//     return farbe === "transparent" || farbe.endsWith(",0)");
//
// Die Warnfarbe dieses Hinweises ist im Thema „modern" `rgb(138, 90, 0)` — ein sattes Bernstein,
// gemessen im echten Chromium (Arbeitsprüfung 2e6bff1a…, Lauf `-t "de, 320px"`). Ohne Leerzeichen
// endet sie auf „,0)", weil ihr BLAUKANAL null ist. Der Hausleser hielt den vollständig sichtbaren
// Satz deshalb für unsichtbar und meldete `text: ""` bei `verborgen: ["Stand von 01:58 · ohne
// Netzverbindung nicht aktualisiert"]` — ein falsch NEGATIVES Urteil, das jede Farbe mit einem
// Nullkanal (rot, grün, blau) trifft.
//
// Hier wird stattdessen der ALPHAKANAL gelesen: nur `rgba(r, g, b, 0)` und das Schlüsselwort
// `transparent` sind durchsichtig. Das ist strenger, nicht schwächer — die Zusage von REGELN 9
// bleibt vollständig erhalten, sie urteilt nur richtig.
//
// Die Fundstelle im Hausleser bleibt unangetastet: sie liegt ausserhalb der Zielpfade dieses
// Auftrags (siehe RUECKGABE, ABWEICHUNGEN). Wer sie behebt, kann diese Messung hier ersatzlos
// durch `sichtbefund` ersetzen.
const SICHTBARER_TEXT = `(sel) => {
  const wurzel = document.querySelector(sel);
  if (!wurzel) return { da: false, text: "", verborgen: [], flaeche: 0, diagnose: "(nicht im Dokument)" };
  const normal = (t) => String(t || "").replace(/\\s+/g, " ").trim();
  const durchsichtig = (farbe) => {
    const roh = String(farbe || "").replace(/\\s/g, "");
    if (roh === "transparent") return true;
    const m = /^rgba\\(([^)]*)\\)$/.exec(roh);
    if (!m) return false;
    const teile = m[1].split(",");
    return teile.length === 4 && Number.parseFloat(teile[3]) === 0;
  };
  const unterdrueckt = (el) => {
    for (let lauf = el; lauf; lauf = lauf.parentElement) {
      if (getComputedStyle(lauf).contentVisibility === "hidden") return true;
      if (lauf === wurzel) return false;
    }
    return false;
  };
  const flaecheVon = (knoten) => {
    const bereich = document.createRange();
    bereich.selectNodeContents(knoten);
    const rechtecke = bereich.getClientRects();
    let summe = 0;
    for (let i = 0; i < rechtecke.length; i += 1) {
      summe += Math.max(0, rechtecke[i].width) * Math.max(0, rechtecke[i].height);
    }
    return Math.round(summe);
  };
  const sichtbar = [];
  const verborgen = [];
  const diagnose = [];
  const gang = document.createTreeWalker(wurzel, NodeFilter.SHOW_TEXT);
  for (let k = gang.nextNode(); k; k = gang.nextNode()) {
    const el = k.parentElement;
    const text = normal(k.textContent);
    if (!el || text === "") continue;
    const s = getComputedStyle(el);
    const kann = typeof el.checkVisibility === "function";
    const gruende = [];
    if (!kann) gruende.push("checkVisibility fehlt");
    else if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) gruende.push("checkVisibility=false");
    if (unterdrueckt(el)) gruende.push("content-visibility=hidden");
    if (Number.parseFloat(s.opacity || "1") <= 0) gruende.push("opacity=" + s.opacity);
    if (durchsichtig(s.color)) gruende.push("color=" + s.color);
    const flaeche = flaecheVon(k);
    if (flaeche <= 0) gruende.push("flaeche=0");
    if (normal(el.innerText) === "") gruende.push("innerText leer");
    diagnose.push("<" + el.tagName.toLowerCase() + "> " + JSON.stringify(text.slice(0, 48)) +
      (gruende.length === 0 ? " sichtbar" : " verborgen: " + gruende.join(", ")));
    if (gruende.length === 0) sichtbar.push(text); else verborgen.push(text);
  }
  const r = wurzel.getBoundingClientRect();
  const kannWurzel = typeof wurzel.checkVisibility === "function";
  const wurzelSichtbar = kannWurzel
    ? wurzel.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
    : getComputedStyle(wurzel).display !== "none";
  return {
    da: true,
    text: sichtbar.join(" "),
    verborgen,
    flaeche: wurzelSichtbar && r.width > 0 && r.height > 0 ? Math.round(r.width * r.height) : 0,
    diagnose: diagnose.join(" || "),
  };
}`;

export interface Sichtbefund4363 {
  da: boolean;
  text: string;
  verborgen: string[];
  flaeche: number;
  /** Je Textknoten: sichtbar, oder die Bedingung, an der es hängt. Für Meldungen mit Adresse. */
  diagnose: string;
}

/** Der WIRKLICH sichtbare Text eines Elements — je Textknoten gemessen, nicht `textContent`. */
export async function sichtText(seite: Seite, selektor: string): Promise<Sichtbefund4363> {
  return seite.evaluate<Sichtbefund4363>(fn(SICHTBARER_TEXT), selektor);
}

/** Zusicherung: dieses Element ist da, hat Fläche und trägt diese Texte SICHTBAR. */
export async function mussSichtbarTragen4363(
  seite: Seite,
  selektor: string,
  erwartet: readonly string[],
  was: string,
): Promise<string> {
  const befund = await sichtText(seite, selektor);
  expect(befund.da, `${MARKE}: ${was} — ${selektor} steht nicht im Dokument`).toBe(true);
  expect(
    befund.flaeche,
    `${MARKE}: ${was} — ${selektor} hat keine Fläche auf dem Bildschirm · ${befund.diagnose}`,
  ).toBeGreaterThan(0);
  for (const teil of erwartet) {
    expect(
      befund.text,
      `${MARKE}: ${was} — sichtbar steht „${befund.text}", erwartet war „${teil}" · ${befund.diagnose}`,
    ).toContain(teil);
  }
  return befund.text;
}

/** Der SICHTBARE Text des Standhinweises — je Textknoten gemessen, nicht `textContent`. */
export async function hinweisMussSichtbarTragen(
  seite: Seite,
  erwartet: readonly string[],
  was: string,
): Promise<string> {
  return mussSichtbarTragen4363(seite, HINWEIS, erwartet, was);
}

/** Der Hinweis darf diesen Satz NICHT tragen — die Abgrenzung zwischen den drei Lagen. */
export async function hinweisDarfNichtTragen(
  seite: Seite,
  verboten: string,
  was: string,
): Promise<void> {
  const gelesen = await seite.evaluate<string>(fn(HINWEIS_TEXT), HINWEIS);
  expect(
    gelesen,
    `${MARKE}: ${was} — „${verboten}" steht im Standhinweis, obwohl es nicht gilt`,
  ).not.toContain(verboten);
}

/** Die Uhrzeit im Standhinweis — der BESTÄTIGTE Abrufstand, als Ziffernpaar. */
export async function abrufstand(seite: Seite): Promise<string> {
  const gelesen = await seite.evaluate<string>(fn(HINWEIS_TEXT), HINWEIS);
  const treffer = /\d{1,2}[:.]\d{2}/.exec(gelesen);
  expect(
    treffer,
    `${MARKE}: im Standhinweis steht keine Uhrzeit („${gelesen}") — dann nennt er den Stand nicht`,
  ).not.toBeNull();
  return treffer?.[0] ?? "";
}

/** Steht ein Standhinweis überhaupt im Dokument? */
export async function hinweisDa(seite: Seite): Promise<boolean> {
  return seite.evaluate<boolean>(fn("(sel) => document.querySelector(sel) !== null"), HINWEIS);
}

/** Die Beschriftung des Wiederholen-Knopfes im Standhinweis — oder `null`, wenn keiner dasteht. */
export async function knopfBeschriftung(seite: Seite): Promise<string | null> {
  return seite.evaluate<string | null>(fn(HINWEIS_KNOPF), HINWEIS);
}

/**
 * Per Tab auf den Wiederholen-Knopf, SICHTBAREN Fokus nachgemessen, dann Enter.
 *
 * Der sichtbare Fokus wird am BERECHNETEN Stil gemessen (`fokusMussSichtbarSein`): ein Vertrag, der
 * nur im Quelltext steht (`focus-visible:ring-…`), ist keine Sichtbarkeit.
 */
export async function wiederholenMitTastatur(seite: Seite, beschriftung: string): Promise<number> {
  const schritte = await tabBisText(seite, beschriftung, 150, true);
  const imHinweis = await seite.evaluate<boolean>(
    fn(
      "(sel) => { const a = document.activeElement; const h = document.querySelector(sel); return !!a && !!h && h.contains(a); }",
    ),
    HINWEIS,
  );
  expect(
    imHinweis,
    `${MARKE}: der Tab-Weg zu „${beschriftung}" endete nicht im Standhinweis — dann misst der Fokusnachweis einen anderen Knopf`,
  ).toBe(true);
  await fokusMussSichtbarSein(seite, `Wiederholen im Standhinweis („${beschriftung}")`);
  await seite.keyboard.press("Enter");
  return schritte;
}

/** Derselbe Knopf mit der MAUS — der zweite Weg, den der Auftrag (K3) ausdrücklich verlangt. */
export async function wiederholenMitMaus(seite: Seite): Promise<void> {
  await seite.click(`${HINWEIS} button`);
}

/** Warten, bis der Zähler der sechs Quellen den erwarteten Wert erreicht hat. */
export async function warteAufAbrufe(seite: Seite, erwartet: number): Promise<void> {
  await warte(
    seite,
    `([pfade, soll]) => {
      const z = window.__job4363 ? window.__job4363.zaehler : {};
      let summe = 0;
      for (const p of pfade) { summe += z[p] || 0; }
      return summe >= soll;
    }`,
    `${erwartet} Abrufe der sechs tragenden Quellen`,
    [QUELLPFADE, erwartet],
    30_000,
  );
}
