// ================================================================================================
// JOB 3259 · UX-19-R2 — DER GEMEINSAME AUFBAU DER ZWEI MESSUNGEN AM ECHTEN SERVER.
// ================================================================================================
//
// Diese Datei ist KEIN Test. Sie ist der Werkzeugkasten, den
// `ganzdokument-am-echten-server.test.ts` und `vorlesehilfe-ganzdokument.test.ts` teilen — die
// Bedienschritte eines Menschen auf der H3-Bühne (`tests/design/h3-blatt-buehne.ts`) und die
// Ableser, die in der Seite laufen.
//
// WARUM DIESE BÜHNE UND KEINE ZWEITE. Codex' Prüfurteil zu JOB 3196 R2 (ben.md, Prüfpunkt 3)
// beanstandet an den Bestandsbelegen genau einen Punkt: „Speicher-API dabei gemockt; keine neue
// Persistenzwirkung beansprucht." Die gemockte Bühne (`anleitung-folgt-der-importart-mounted.
// test.tsx:74-84`) ersetzt `endpoints.drafts` vollständig — ein Erfolgskasten kann dort nie
// widerlegt werden, weil es hinter ihm niemanden gibt, den man fragen könnte. Die H3-Bühne reicht
// jeden `/api/*`-Aufruf an die ECHTE Fastify-App weiter (`h3-blatt-buehne.ts:216-252`) und kann
// denselben Bestand OHNE den Browser befragen (`frage`, :130). Genau diese zweite Frage schliesst
// die Lücke.
//
// WAS HIER LOKAL NACHDEKLARIERT WIRD — und warum die Bühnendatei unberührt bleibt (Auftrag §10).
// Die Bühne gibt ihre Seite als schmales `Seite`-Interface heraus; Playwright liefert dort eine
// vollwertige `Page`. Dieselbe Stelle, dieselbe Lösung wie in
// `tests/import-anleitung-modus/tastatur-importart-chromium.test.ts:32-35`: die zusätzlich
// gebrauchten Fähigkeiten (`keyboard`, `setInputFiles`, `click`) werden HIER als Typ nachgezogen,
// ohne der gemeinsamen Bühne etwas hinzuzufügen. Kein neues Verhalten — nur der Zugang zu dem, was
// schon da ist.
import { Buffer } from "node:buffer";
import { cpus, loadavg } from "node:os";
import i18n from "../../apps/web/src/i18n";
import { CAPTURE_FILE_TEXT, FILE_IMPORT_ACCEPT } from "../../apps/web/src/lib/captureFromFile";
import { CAPTURE_FRONT_DOOR_ROUTE } from "../../apps/web/src/lib/captureFrontDoor";
import { type Buehne, ORIGIN, fn } from "../design/h3-blatt-buehne";

// ------------------------------------------------------------------------------------------------
// Die nachdeklarierten Playwright-Fähigkeiten.
// ------------------------------------------------------------------------------------------------

export interface Tastatur {
  press(taste: string): Promise<void>;
}

/** Die Form, in der Playwright eine Datei OHNE Datei auf der Platte entgegennimmt. */
export interface DateiAnlage {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

export type SeiteMitDatei = Buehne["seite"] & {
  keyboard: Tastatur;
  setInputFiles(selektor: string, dateien: readonly DateiAnlage[]): Promise<void>;
  /**
   * JOB 3259 R2 (Codex-Nachführung 08.09. 16:50) — DER ECHTE ZEIGERKLICK.
   *
   * Runde 1 hat den Öffnen-Link über `evaluate(… el.click())` betätigt. Das ist KEIN Zeigerklick:
   * `HTMLElement.click()` verschickt ein Ereignis am Element vorbei an allem, was ein Mensch
   * überwinden müsste — Sichtbarkeit, Lage im Fenster, ein Deckel darüber. `page.click` fährt
   * dagegen Playwrights Bedienbarkeitsprüfung (sichtbar · stabil · empfängt Zeigerereignisse ·
   * nicht gesperrt) und schickt dann echte Maus-Ereignisse an die Stelle im Fenster. Der
   * Unterschied ist in `F4` mit einem Deckel über dem Link kalibriert: mit Deckel kommt der Klick
   * NICHT durch.
   */
  click(selektor: string, opts?: { timeout?: number }): Promise<void>;
};

/**
 * Die volle Playwright-`Route`. Die Bühne deklariert davon nur `request()` und `fulfill()` — für
 * den Fehlerfall (Auftrag §5.5) werden zusätzlich `abort()` und `fallback()` gebraucht:
 *
 *   · `fallback()` reicht den Aufruf an die BESTEHENDE Weiche der Bühne weiter, also an die echte
 *     Fastify-App. Ohne sie müsste diese Datei die Weiterleitung nachbauen — eine zweite Wahrheit.
 *   · `abort()` lässt den Aufruf scheitern, ohne eine Antwort zu erfinden.
 *
 * WARUM NICHT DER `skript`-PARAMETER DER BÜHNE (Auftrag §5.5 nennt ihn): gemessen an
 * `h3-blatt-buehne.ts:220-228` antwortet er AUSSCHLIESSLICH mit `status: 200`. Ein Fehlschlag des
 * Anlege-Aufrufs ist damit dort nicht ausdrückbar — `endpoints.drafts.create` liefe in den
 * Erfolgszweig. Die Abweichung steht in der Rückgabe.
 */
export interface Weiche {
  request(): { method(): string; url(): string };
  fulfill(r: {
    status: number;
    body: string;
    headers?: Record<string, string>;
  }): Promise<void>;
  abort(grund?: string): Promise<void>;
  fallback(): Promise<void>;
}

// ================================================================================================
// JOB 3575 · DIE EINE QUELLE DER WARTEBUDGETS — abgeleitet aus dem Rahmen, nicht geraten.
// ================================================================================================
//
// WAS HIER VORHER STAND und warum es weg ist: sieben nackte Zahlenfristen, über die Bedienschritte
// verstreut (`30_000` viermal, `60_000`, `20_000`, `10_000`), dazu eine achte in der Testdatei.
// Sie haben am 10.09. den Torlauf von JOB 3488 rot gemacht, ohne dass an der geprüften Arbeit etwas
// falsch war: `F2` lief in seine 30-s-Grenze, `F3` folgte als Folgefehler, die übrigen 1634
// Testdateien waren grün (`archiv/3488/runde-2/RUECKGABE.md`, REST 1). Im selben Torlauf waren
// F4/F5/F7/F9 — DERSELBE Speicherweg — mit 5,4 s / 394 ms / 322 ms / 337 ms grün.
//
// DIE MESSREIHE, an der die Grenze einzuordnen ist (11.09.2026, 01:41–01:46 Uhr, auf dem
// Tor-Rechner selbst, 12 Kerne, fünf aufeinanderfolgende Läufe des ganzen Ordners mit EINEM Fork,
// 1-Minuten-Last 3,48–4,80):
//
//     F2 gesamt            312 · 293 · 288 · 237 · 237 ms          Höchstwert  312 ms
//     davon der Warteschritt „Speichern gedrückt → Erfolgskasten steht":
//                          74,8 · 86,3 · 93,7 ms                   Höchstwert 93,7 ms
//
// Der Warteschritt braucht im Regelbetrieb also rund ein Dreihundertstel seiner bisherigen Grenze.
//
// ================================================================================================
// MEHR BUDGET WAR NICHT DIE HEILUNG — und die Meldung hat das binnen eines Laufs gezeigt.
// ================================================================================================
// Drei Läufe derselben Prüfkette auf dem Cloud-Prüfrechner (32 Kerne, 1-Minuten-Last 18,27), die
// sich nur im Quellstand unterscheiden:
//
//   · unveränderter Basisstand `f86dd4c` (Arbeitsprüfung d6efd47f476e4e6199df306db0d0dd5c):
//     F2 rot nach 30 312 ms, Wortlaut `page.waitForFunction: Timeout 30000ms exceeded.` — genau
//     der Satz aus dem Torlauf von JOB 3488, und genau so stumm. Der Fall ist auf diesem Rechner
//     also nicht „gelegentlich langsam", sondern zuverlässig rot.
//   · dieser Umbau, erste Fassung (Arbeitsprüfung 71eac0da945d4e44b41d63b2b20195fe): F2 rot nach
//     120 015 ms, aber mit Zustand — „… · Entwurfsweiche angekommen=0 beendet=0 · … ·
//     lastabhängig (1-Minuten-Last 18,27 auf 32 Kernen, Lastschalter an)". `angekommen=0` heisst:
//     es war nie ein `POST /api/drafts` unterwegs. Der Erfolgskasten kam also nicht zu SPÄT — es
//     wurde nie gespeichert. Ein grösseres Budget konnte das nicht heilen und hat es nicht.
//   · derselbe Umbau, zweiter Lauf (Arbeitsprüfung 02229078b92c454688798c70e913ed4e): diesmal war
//     F2 grün und dafür `V5` rot, an der Zeile, die den Speichern-Knopf unmittelbar nach der
//     Dateiwahl misst (`vorlesehilfe-ganzdokument.test.ts:348`, „expected true to be false") — der
//     Knopf war GESPERRT.
//
// Damit war die Ursache benannt, und sie liegt in dieser Bühne: `dateiWaehlen` wartete darauf, dass
// der Speichern-Knopf DASTEHT, nicht darauf, dass er BETÄTIGBAR ist. `Capture.tsx:5313-5319` sperrt
// ihn, solange die Datei eingelesen wird. Ein `el.click()` auf einen gesperrten Knopf tut nichts —
// und der alte Ableser meldete trotzdem „geklickt". Behoben in `KLICK_KNOPF`,
// `aufSpeichernknopfWarten` und `speichernDruecken`; das ist der Zustand, auf den zu warten war
// (Lehre JOB 3152 T1b), nicht die Frist.
//
// WAS DIE SCHRANKE VERSPRICHT UND WAS NICHT (Lehre JOB 3448/3151: „Zahlen in Werkzeugkommentaren
// sind Zusicherungen und schwanken unter Last"). Sie ist eine SCHRANKE mit Umgebung, kein exakter
// Einzelwert: unter Last stehen mindestens 120 000 ms zur Verfügung, gemessener Höchstwert des
// Warteschritts aus fünf Läufen OHNE Fremdlast 93,7 ms. Eine Zusage für beliebige Spitzenlast ist
// das ausdrücklich NICHT, und nach dem Cloud-Befund oben ist sie erst recht keine Zusage, dass
// dieser Fall überall grün wird. Für den Fall, dass auch das Budget reisst, bleibt der Fallrahmen
// der Auffangbügel; er meldet dann allerdings ohne Zustand, weshalb das Budget ausdrücklich UNTER
// ihm bleibt (`DECKEL_MS`).
//
// WARUM DER SCHALTER LOKAL HIER STEHT UND KEIN ZWEITER DANEBEN (Auftrag §5.2, Lehre JOB 3562/3563:
// eine Quelle, kein zweiter Weg). Gesucht und NICHT gefunden: `tools/test`, `vitest.config.ts`,
// `vitest.browser.config.ts` und `tests/design/*` kennen keine Frist- oder Lastquelle für Tests —
// `KLARWERK_TEST_FORKS` regelt Fork-Zahlen, `KLARWERK_BROWSERDECKEL_TIMEOUT` die Wartezeit am
// Browserschloss, `loadavg()` wird im ganzen Testbestand nur in
// `tests/tor-inventar/chromium-prozesszahl.test.ts` gelesen, und zwar zum Protokollieren. Es gibt
// also nichts zu benutzen. Der Schalter wird deshalb HIER eingeführt — und er ist keiner, den
// niemand setzt: `tools/test:188` fährt die serielle Browsergruppe mit
// `KLARWERK_TESTGRUPPE=browser`, und GENAU in dieser Gruppe lief der Torlauf, der gerissen ist. Ein
// Bahnaufruf von Hand (`npx vitest run tests/ux19-…`) setzt die Gruppe nicht und bekommt damit
// unverändert das heutige Budget.
// ------------------------------------------------------------------------------------------------

/**
 * DER EINZIGE ORT IM ORDNER, an dem eine unmittelbare Zahl stehen darf. Alles andere leitet sich
 * hieraus ab; `wartebudget-waechter.test.ts` (W1) macht jede weitere Zahlenfrist im Ordner rot.
 */
export const WARTEBUDGET = {
  /**
   * Der Zeitrahmen, den jeder `it` und jeder `beforeAll` dieser Bühne trägt. Er ist die QUELLE der
   * Ableitung, keine zweite Zahl: die Testdateien setzen ihre Rahmen über `FALL_RAHMEN_MS`.
   */
  rahmenMs: 180_000,
  /**
   * Anteile am Rahmen, als Teiler. Sie bilden GENAU die bisherigen Werte ab, damit im Regelbetrieb
   * (ohne Lastschalter) nichts weicher und nichts länger wird: 60 → 3 000 ms, 18 → 10 000 ms,
   * 12 → 15 000 ms, 9 → 20 000 ms, 6 → 30 000 ms, 3 → 60 000 ms.
   */
  teiler: { winzig: 60, klein: 18, zwischen: 12, mittel: 9, gross: 6, sehrGross: 3 },
  /**
   * Der Deckel als Anteil des Rahmens. Zwei Drittel lassen dem Fall nach einem erschöpften Budget
   * noch ein Drittel für die Meldung und den Rest seiner Arbeit — ohne ihn stürbe der Fall wieder
   * im Rahmen und damit OHNE Zustand, also genau in dem Zustand, den dieser Auftrag beseitigt.
   */
  deckelZaehler: 2,
  deckelNenner: 3,
  /**
   * Der Lastfaktor. ABGELEITET, nicht gewählt: er ist der grösste ganzzahlige Faktor, der den
   * schwersten Regelschritt (Rahmen/6 = 30 000 ms) noch genau auf den Deckel (120 000 ms) und damit
   * unter den Rahmen bringt. Ein Faktor 5 ergäbe 150 000 ms und liefe in den Deckel, ohne dass die
   * Rechnung noch etwas erklärte.
   */
  lastfaktor: 4,
  /**
   * Die gestellte Verzögerung der Weiche im Stand `langsam` — eine WARTEZEIT, keine Frist: nur mit
   * ihr ist der Zustand `wholeSaving` überhaupt ablesbar (am echten Server ist er kürzer als jede
   * Messung). Rahmen/90 = 2 000 ms, der bisherige Wert.
   */
  langsamTeiler: 90,
  /** Der Takt, in dem die Bühne die Fläche abfragt. Derselbe wie bisher in `warteAufAbschluss`. */
  taktMs: 25,
  /** So viele Zeichen des Flächentextes stehen in der Ablaufmeldung — lesbar, nicht erschlagend. */
  textKuerzungZeichen: 240,
  /**
   * Ab dieser Grösse ist eine unmittelbare Zahl im Ordner keine Zählgrösse mehr (Tab-Anschläge,
   * Zeichenzahlen, Teiler), sondern eine Zeit. `wartebudget-waechter.test.ts` (W1) liest die
   * Schwelle von HIER — auch der Wächter soll keine eigene Zahl mitbringen.
   */
  waechterSchwelle: 1_000,
} as const;

/** Der Zeitrahmen jedes Falls dieser Bühne — die Testdateien setzen ihn hieraus. */
export const FALL_RAHMEN_MS: number = WARTEBUDGET.rahmenMs;

/** Der Deckel, unter dem jedes abgeleitete Budget bleibt. */
export const DECKEL_MS: number =
  (FALL_RAHMEN_MS * WARTEBUDGET.deckelZaehler) / WARTEBUDGET.deckelNenner;

/** Der Name des Lastschalters und der Wert, der Last bedeutet (`tools/test:188`). */
export const LAST_SCHALTER = "KLARWERK_TESTGRUPPE";
export const LAST_WERT = "browser";

/** Die gestellte Verzögerung der Weiche im Stand `langsam`. */
export const LANGSAM_MS: number = FALL_RAHMEN_MS / WARTEBUDGET.langsamTeiler;

export type Umgebung = Readonly<Record<string, string | undefined>>;

/** Die benannten Warteschritte dieser Bühne. Jeder trägt genau einen Anteil am Fallrahmen. */
export type Warteschritt =
  | "dateiwegOeffnen"
  | "ganzdokumentWaehlen"
  | "dateiWaehlen"
  | "speichernDruecken"
  | "aufErfolgskastenWarten"
  | "aufRuhestandWarten"
  | "aufFlaechensatzWarten"
  | "warteAufAbschluss"
  | "neuLadenAdresse"
  | "neuLadenBlatt"
  | "zeigerklick"
  | "deckelGegenprobe";

const ANTEIL: Readonly<Record<Warteschritt, number>> = {
  dateiwegOeffnen: WARTEBUDGET.teiler.mittel,
  ganzdokumentWaehlen: WARTEBUDGET.teiler.klein,
  dateiWaehlen: WARTEBUDGET.teiler.gross,
  speichernDruecken: WARTEBUDGET.teiler.gross,
  aufErfolgskastenWarten: WARTEBUDGET.teiler.gross,
  aufRuhestandWarten: WARTEBUDGET.teiler.gross,
  aufFlaechensatzWarten: WARTEBUDGET.teiler.gross,
  warteAufAbschluss: WARTEBUDGET.teiler.gross,
  neuLadenAdresse: WARTEBUDGET.teiler.sehrGross,
  neuLadenBlatt: WARTEBUDGET.teiler.gross,
  zeigerklick: WARTEBUDGET.teiler.zwischen,
  // Die Kalibrierung in F4 MUSS scheitern (der Deckel fängt den Zeigerklick ab). Sie bekommt
  // deshalb den kleinsten Anteil: ein grösseres Budget verlängerte hier nur das Warten auf ein
  // Ergebnis, das ohnehin feststeht.
  deckelGegenprobe: WARTEBUDGET.teiler.winzig,
};

/**
 * Der Lastfaktor. `1` ohne Lastschalter — dann gilt zeichengleich das bisherige Budget.
 * Die Umgebung ist ein Parameter, damit `wartebudget-waechter.test.ts` (W2) beide Stellungen
 * messen kann, ohne an `process.env` zu drehen.
 */
export function lastfaktor(umgebung: Umgebung = process.env): number {
  return umgebung[LAST_SCHALTER] === LAST_WERT ? WARTEBUDGET.lastfaktor : 1;
}

/** Das Budget eines Warteschritts: Anteil am Fallrahmen, mal Lastfaktor, gedeckelt. */
export function wartebudget(schritt: Warteschritt, umgebung: Umgebung = process.env): number {
  const grundwert = FALL_RAHMEN_MS / ANTEIL[schritt];
  return Math.min(grundwert * lastfaktor(umgebung), DECKEL_MS);
}

// ------------------------------------------------------------------------------------------------
// DIE ABLAUFMELDUNG — Vorbild ist die schon vorhandene Meldung von `warteAufAbschluss`.
// ------------------------------------------------------------------------------------------------

/**
 * Ist die Umgebung erkennbar unter Last? GEMESSEN (1-Minuten-Last je Kern), nicht behauptet. Die
 * Meldung sagt damit „lastabhängig" nur, wenn sie es an der Maschine abgelesen hat, und behauptet
 * sonst keine feste Eigenschaft (Lehre JOB 3138: Umgebungsfehler als lastabhängig melden, nicht als
 * Defekt).
 */
export function lastlage(umgebung: Umgebung = process.env): string {
  const kerne = Math.max(cpus().length, 1);
  const eine = loadavg()[0] ?? 0;
  const jeKern = eine / kerne;
  const schalter = umgebung[LAST_SCHALTER] === LAST_WERT ? "an" : "aus";
  const urteil = jeKern >= 1 || schalter === "an" ? "lastabhängig" : "keine Last erkennbar";
  return `${urteil} (1-Minuten-Last ${eine.toFixed(2)} auf ${kerne} Kernen, Lastschalter ${schalter})`;
}

/** Der Zählerstand der Entwurfsweiche dieser Seite — oder die ehrliche Auskunft, dass keine liegt. */
function weichenstand(seite: SeiteMitDatei): string {
  const w = WEICHE_JE_SEITE.get(seite);
  if (w === undefined) {
    return "Entwurfsweiche: keine gelegt (Zähler unbekannt)";
  }
  return `Entwurfsweiche angekommen=${w.zaehler.angekommen} beendet=${w.zaehler.beendet}`;
}

/**
 * Der zuletzt sichtbare Flächentext, gekürzt — oder der Grund, warum er nicht zu lesen war.
 *
 * WARUM ANFANG **UND** ENDE und nicht nur der Anfang. Die erste Fassung dieser Zeile schnitt die
 * ersten 240 Zeichen heraus; im ersten Cloud-Lauf dieses Auftrags (Arbeitsprüfung
 * 71eac0da945d4e44b41d63b2b20195fe) stand darin genau das, was auf JEDER Seite dieses Produkts
 * steht — Kopfband, Werkzeugzeile, Importart-Karten. Der Arbeitsraum, in dem der Fehler sitzt,
 * liegt am ENDE des Flächentextes: dort stehen der Speichern-Knopf, die Einlese-Quittung, der
 * Fehlerkasten und der Erfolgskasten. Gekürzt wird deshalb in der MITTE.
 */
async function flaechentext(seite: SeiteMitDatei): Promise<string> {
  try {
    const roh = await seite.evaluate<string>(fn(SEITENTEXT));
    const haelfte = Math.floor(WARTEBUDGET.textKuerzungZeichen / WARTEBUDGET.deckelZaehler);
    const kurz =
      roh.length <= WARTEBUDGET.textKuerzungZeichen
        ? roh
        : `${roh.slice(0, haelfte)} … […${roh.length - WARTEBUDGET.textKuerzungZeichen} Zeichen…] … ${roh.slice(-haelfte)}`;
    return `zuletzt auf der Fläche: «${kurz}»`;
  } catch (e) {
    return `Flächentext nicht lesbar: ${String(e).split("\n")[0] ?? ""}`;
  }
}

interface Warteauftrag {
  /** Der Name des Schritts, so wie er in der Meldung stehen soll. */
  schritt: Warteschritt;
  /** Der Zustand, auf den gewartet wird — in einem Satz, den ein Mensch liest. */
  erwartet: string;
  /** Der Ableser, der IN der Seite läuft und `true` liefert, sobald der Zustand da ist. */
  ableser: string;
  arg?: unknown;
  /** Eigenes Budget statt des abgeleiteten — nur für die Wächterproben. */
  budget?: number;
  /**
   * Der Fehlerabbruch (Auftrag §5.4): endet der Speicherweg im Fehler, endet der Warteschritt
   * SOFORT mit dessen Grund, statt bis zum Budget zu warten. Übergeben wird der SPEICHERVERSUCH —
   * er trägt seinen eigenen Fehlerstand von VOR dem Klick mit sich (s. `Speicherversuch`).
   */
  fehlerabbruch?: Speicherversuch;
}

/**
 * JOB 3575 R2 — DIE EINE ZUSTANDSDIAGNOSE.
 *
 * Jeder Ablauf dieser Bühne geht durch DIESEN Satzbau: der selbst getaktete (`aufZustandWarten`)
 * ebenso wie der, dessen Frist Playwright gehört (`goto` in `neuLaden`, `setInputFiles` in
 * `dateiWaehlen`). Runde 1 hatte für den zweiten Fall nichts — Codex' Korrekturpflicht 2: „ein
 * erzwungener Navigationstimeout nennt Schritt, Zielzustand, Weichenzähler und Flächentext
 * beziehungsweise dessen Nichtlesbarkeit". Genau das leistet diese Zeile für alle drei Wege, und
 * zwar aus einer Quelle statt dreimal ähnlich geschrieben.
 */
async function ablaufmeldung(
  seite: SeiteMitDatei,
  m: {
    /** „Wartebudget erschöpft" oder der ehrlichere Kopf, wenn es gar keine Frist war. */
    kopf: string;
    schritt: Warteschritt;
    erwartet: string;
    budget: number;
    verstrichen: number;
    /** Was diesen Schritt zusätzlich erklärt — der letzte Ableserfehler, Playwrights Wortlaut. */
    zusatz: string;
  },
): Promise<string> {
  return `${m.kopf} · Schritt «${m.schritt}» · erwartet war: ${m.erwartet} · Budget ${m.budget} ms (Fallrahmen ${FALL_RAHMEN_MS} ms, Lastfaktor ${lastfaktor()}) · abgelaufen nach ${m.verstrichen} ms · ${weichenstand(seite)} · ${await flaechentext(seite)} · ${m.zusatz} · ${lastlage()}`;
}

/**
 * JOB 3575 — DER EINE WARTEWEG DIESER BÜHNE.
 *
 * Bis hierher ging jeder Schritt über `seite.waitForFunction(...)`. Läuft dessen Frist ab, wirft
 * Playwright `Timeout 30000ms exceeded` — eine Zahl ohne Zustand. Genau dieser Satz stand im
 * Torprotokoll von JOB 3488, und niemand konnte ihm ansehen, ob er Last oder Defekt bedeutete.
 *
 * Deshalb wird hier SELBST getaktet: derselbe Ableser, derselbe Takt wie in `warteAufAbschluss`,
 * aber die Bühne behält den Zustand in der Hand und kann ihn beim Ablauf nennen. Der Preis ist
 * ein Abfragetakt von `WARTEBUDGET.taktMs` statt Playwrights interner Bildtaktung — bei einem
 * gemessenen Warteschritt von 74,8–93,7 ms sind das höchstens 25 ms mehr.
 *
 * WARUM JEDER `evaluate`-FEHLER IM TAKT GESCHLUCKT WIRD, statt zu werfen: `seite.click` auf den
 * Öffnen-Link löst eine echte Navigation aus, und ein `evaluate` mitten in einer Navigation stirbt
 * mit „Execution context was destroyed". `waitForFunction` fängt das intern ab; hier wird es
 * ausdrücklich abgefangen, GEMERKT und beim Ablauf mitgemeldet — verschluckt wird nichts.
 */
async function aufZustandWarten(seite: SeiteMitDatei, auftrag: Warteauftrag): Promise<void> {
  const budget = auftrag.budget ?? wartebudget(auftrag.schritt);
  const start = Date.now();
  const ende = start + budget;
  let letzterAbleserfehler = "keiner";
  for (;;) {
    // ZUERST der Fehlerzustand, DANN der Ableser. Runde 1 hatte es umgekehrt und liess damit einen
    // SCHNELLEN Fehler durchrutschen (Codex' Korrekturpflicht 1). Dass diese Reihenfolge dem
    // Erfolgsfall nichts nimmt, hängt an Bedingung 3 in `fehlerzustand`: steht der Erfolgskasten,
    // ist der Versuch gelungen und der Fehlerzweig schweigt — auch wenn ein alter Satz daneben steht.
    if (auftrag.fehlerabbruch !== undefined) {
      const grund = await fehlerzustand(seite, auftrag.fehlerabbruch);
      if (grund !== null) {
        throw new Error(
          `Warteschritt «${auftrag.schritt}» endet im Fehlerzustand des Speicherwegs · erwartet war: ${auftrag.erwartet} · Grund auf der Fläche: «${grund}» · ${weichenstand(seite)} · nach ${Date.now() - start} ms von ${budget} ms Budget`,
        );
      }
    }
    try {
      if (await seite.evaluate<boolean>(fn(auftrag.ableser), auftrag.arg)) {
        return;
      }
    } catch (e) {
      letzterAbleserfehler = String(e).split("\n")[0] ?? "";
    }
    if (Date.now() >= ende) {
      break;
    }
    await new Promise((auf) => setTimeout(auf, WARTEBUDGET.taktMs));
  }
  throw new Error(
    await ablaufmeldung(seite, {
      kopf: "Wartebudget erschöpft",
      schritt: auftrag.schritt,
      erwartet: auftrag.erwartet,
      budget,
      verstrichen: Date.now() - start,
      zusatz: `letzter Ableserfehler: ${letzterAbleserfehler}`,
    }),
  );
}

/**
 * Die Fehlersätze, die der Ganzdokument-Speicherweg auf die Fläche bringen kann. Alle vier kommen
 * aus derselben Quelle wie das Produkt (`Capture.tsx:1065`, `:1436`, `:1446`, `:1454`); der fünfte
 * ist der Grund, den die GESTELLTE 500-Antwort dieser Bühne mitschickt.
 */
export function speicherFehlersaetze(): readonly string[] {
  return [
    flaechensatz("state.error"),
    flaechensatz(CAPTURE_FILE_TEXT.tooLargeForImport),
    flaechensatz(CAPTURE_FILE_TEXT.wholeOpenMissing),
    WEICHE_FEHLERSATZ.replace(/\s+/g, " ").trim(),
  ].filter((s) => s.length > 0);
}

/**
 * Ein Satz des Produkts, so gefaltet, wie die Ableser dieser Bühne die Fläche lesen. EINE Stelle
 * für alle drei Zustandssätze des Speicherwegs — Wartezustand, Erfolgskasten, Fehlersätze.
 */
export function flaechensatz(schluessel: string): string {
  return String(i18n.t(schluessel)).replace(/\s+/g, " ").trim();
}

/**
 * ================================================================================================
 * JOB 3575 R3 · DER ZUSTAND DES SPEICHERWEGS — in EINEM Blick auf die Fläche.
 * ================================================================================================
 *
 * Gelesen wird GENAU EINMAL (`SEITENTEXT`), und alle drei Aussagen werden aus DIESEM einen Text
 * abgeleitet. Das ist kein Sparen an Aufrufen, sondern die Bedingung dafür, dass die Aussagen
 * zueinander passen: würde „kein Wartezustand mehr" aus einem früheren und „ein Fehlersatz steht
 * da" aus einem späteren Blick stammen, beschriebe die Antwort einen Zustand, den es nie gab.
 */
interface Speicherwegzustand {
  /** War die Fläche überhaupt lesbar? `false` = wir wissen nichts, und behaupten auch nichts. */
  readonly lesbar: boolean;
  /** Steht der Wartezustand (`wholeSaving`) noch da? Dann rechnet der Client noch. */
  readonly wartezustand: boolean;
  /** Steht der Erfolgskasten (`wholeSavedTitle`) da? Dann ist der Versuch GELUNGEN. */
  readonly erfolgskasten: boolean;
  /** Der erste sichtbare Fehlersatz des Speicherwegs — oder `null`. */
  readonly fehlersatz: string | null;
}

async function speicherwegZustand(seite: SeiteMitDatei): Promise<Speicherwegzustand> {
  let text: string;
  try {
    text = (await seite.evaluate<string>(fn(SEITENTEXT))).replace(/\s+/g, " ");
  } catch {
    return { lesbar: false, wartezustand: false, erfolgskasten: false, fehlersatz: null };
  }
  return {
    lesbar: true,
    wartezustand: text.includes(flaechensatz(CAPTURE_FILE_TEXT.wholeSaving)),
    erfolgskasten: text.includes(flaechensatz(CAPTURE_FILE_TEXT.wholeSavedTitle)),
    fehlersatz: speicherFehlersaetze().find((s) => text.includes(s)) ?? null,
  };
}

/**
 * ================================================================================================
 * JOB 3575 · DER SPEICHERVERSUCH — die Bezugsgrösse, an der „frisch" gemessen wird.
 * ================================================================================================
 *
 * `speicherversuchBeginnen` wird VOR dem Klick gerufen und hält fest, was den Versuch von seiner
 * Vorgeschichte trennt: den Zählerstand der BEENDETEN Anlege-Aufrufe. Mehr braucht es nicht — warum
 * nicht, steht bei `fehlerzustand`.
 */
export interface Speicherversuch {
  /** Die Weiche, durch die der Anlege-Aufruf dieses Versuchs läuft. */
  readonly weiche: Entwurfsweiche;
  /** Der Zählerstand der BEENDETEN Anlege-Aufrufe von VOR dem Klick. */
  readonly marke: number;
}

/**
 * Den Speicherversuch beginnen: VOR dem Klick zu rufen, das Ergebnis an `aufErfolgskastenWarten`
 * und `aufRuhestandWarten` weiterzugeben.
 */
export function speicherversuchBeginnen(weiche: Entwurfsweiche): Speicherversuch {
  return { weiche, marke: weiche.marke };
}

/**
 * ================================================================================================
 * JOB 3575 R3 · DER FEHLERZUSTAND DIESES VERSUCHS — und warum der Textvergleich WEG ist.
 * ================================================================================================
 *
 * WAS IN RUNDE 2 FALSCH WAR (Codex' Korrekturpflicht 1, am echten Chromium nachgestellt): „frisch"
 * hiess dort „der Fehlersatz stand beim Beginn dieses Versuchs noch nicht da". Codex hat zwei
 * Speicherungen mit DEMSELBEN gestellten Serverfehler gefahren. Der zweite Versuch scheiterte mit
 * demselben Wortlaut — und genau dieser Wortlaut stand auf der Ausschlussliste seines eigenen
 * Versuchs. Ergebnis: `Wartebudget erschöpft` nach 142 ms von 120 ms Probebudget, bei
 * `angekommen=2 beendet=2`.
 *
 * Der Textvergleich kann diesen Fall NICHT lösen, auch nicht mit einem besseren Vergleich, und der
 * Grund liegt im Produkt: `Capture.tsx:1065` (`fail`) ruft `setErr(e.message)`. Beim zweiten
 * Fehlschlag ist `e.message` ZEICHENGLEICH derselbe Wert. React bricht bei einem identischen
 * Zustandswert ab (`Object.is`), rendert also nicht neu — es gibt keine DOM-Änderung, kein neues
 * Element, keinen neuen Text. Die Fläche vor und nach dem zweiten Fehlschlag ist dieselbe. Jeder
 * Frischemarker, der aus dem SICHTBAREN TEXT gewonnen wird, muss hier scheitern.
 *
 * DIE BEZUGSGRÖSSE IST DESHALB DER AUSGANG DES VERSUCHS, nicht sein Text. Drei Bedingungen:
 *
 *   1. Die Weiche hat seit der Marke einen Anlege-Aufruf BEENDET — der Versuch hat stattgefunden.
 *      Ohne sie wäre schon der alte Satz eines VORIGEN Versuchs ein Abbruchgrund (F6, F7, F9
 *      speichern nach einem Fehlschlag ein zweites Mal).
 *   2. Der Wartezustand (`wholeSaving`) steht NICHT mehr auf der Fläche. Das ist der Ersatz für den
 *      Textvergleich, und er ist belastbar, weil er nicht am Text hängt: `Capture.tsx:5333-5340`
 *      beschriftet den Knopf mit `wholeSaving`, solange `fileWholeDraft.isPending` gilt, und
 *      `@tanstack/query-core` 5.101.1 verlässt diesen Zustand ERST, nachdem `onSuccess`/`onError`
 *      vollständig gelaufen sind (`src/mutation.ts:246-251` vor `:271`, `:288-293` vor `:324`).
 *      Die Weiche zählt dagegen schon im Routenumgang hoch, also VOR der Antwort im Browser. Genau
 *      das Fenster zwischen beidem — beendeter POST, Client noch nicht fertig — deckt diese Zeile
 *      ab, und zwar unabhängig davon, ob sich der Wortlaut geändert hat.
 *   3. Der Erfolgskasten steht NICHT da. Sonst ist der Versuch GELUNGEN, und ein daneben stehender
 *      Fehlersatz ist keine Absage: `Capture.tsx:1435-1438` setzt bei einem angelegten, aber
 *      kennungslosen Entwurf `wholeOpenMissing` NEBEN den Erfolgskasten, und ein Fehler-Toast bleibt
 *      nach `ToastContext.tsx:28` volle 4 000 ms stehen. Ohne diese Zeile machte der Abbruch aus
 *      einem Erfolg mit Hinweis ein Rot.
 *
 * Damit greift der Abbruch bei JEDEM wirklich gezeigten Fehlerausgang dieses Versuchs — auch beim
 * zweiten mit identischem Wortlaut — und bei keinem alten (Auftrag §8.6).
 */
async function fehlerzustand(
  seite: SeiteMitDatei,
  versuch: Speicherversuch,
): Promise<string | null> {
  if (versuch.weiche.zaehler.beendet <= versuch.marke) {
    return null;
  }
  const zustand = await speicherwegZustand(seite);
  if (!zustand.lesbar || zustand.wartezustand || zustand.erfolgskasten) {
    return null;
  }
  return zustand.fehlersatz;
}

// ------------------------------------------------------------------------------------------------
// DIE WEICHE VOR DEM ANLEGE-AUFRUF — und ihr Zähler.
// ------------------------------------------------------------------------------------------------

/** Der gemessene Aufrufpfad des Anlegens: `endpoints.drafts.create` → `api/endpoints.ts:436`. */
export const ENTWURFS_PFAD = "/api/drafts";

/**
 * `durch`   — der Regelfall: `fallback()` reicht an die ECHTE Fastify-App weiter.
 * `langsam` — dieselbe echte Antwort, nur später. Nur damit ist der Wartezustand `wholeSaving`
 *             überhaupt ablesbar; am echten Server ist er kürzer als jede Messung.
 * `abbruch` — der Aufruf kommt gar nicht an (Netz weg). Der Zustand, den §9 „offline" nennt.
 * `fehler`  — der Server antwortet 500 im Fehlerschema aus `services/app/src/http.ts`.
 */
export type Weichenstand = "durch" | "langsam" | "abbruch" | "fehler";

/** Der Grund, den die gestellte 500-Antwort mitschickt — er MUSS beim Menschen ankommen. */
export const WEICHE_FEHLERCODE = "UX19_TESTFEHLER";
export const WEICHE_FEHLERSATZ =
  "Der Entwurf konnte nicht angelegt werden (gestellter Serverfehler UX19).";

export interface Entwurfsweiche {
  /** Der aktuell eingestellte Stand. */
  readonly stand: Weichenstand;
  setze(stand: Weichenstand): void;
  /**
   * Der Zählerstand der BEENDETEN Anlege-Aufrufe. Vor dem Klick merken, danach an
   * `warteAufAbschluss` geben — so wird gemessen, dass der POST wirklich lief.
   */
  readonly marke: number;
  /**
   * JOB 3575 — DIE ZÄHLER, DIE IN JEDE ABLAUFMELDUNG GEHÖREN.
   *
   * Bis hierher waren `angekommen` und `beendet` nur im Wurf von `warteAufAbschluss` sichtbar.
   * Jeder andere Warteschritt lief in Playwrights nackten Satz. Beide Zahlen stehen jetzt an EINER
   * Stelle bereit; `ablaufmeldung` liest sie über die Seite (`WEICHE_JE_SEITE`).
   */
  readonly zaehler: { readonly angekommen: number; readonly beendet: number };
  /**
   * JOB 3259 R2 (Codex-Nachführung 08.09. 16:50) — WARTEN AUF DEN POST, NICHT AUF EINE LEERSTELLE.
   *
   * Runde 1 hat den Abschluss eines Speicherversuchs allein daran erkannt, dass der Wartezustand
   * `wholeSaving` NICHT (mehr) auf der Seite steht. Diese Bedingung ist auch dann erfüllt, wenn gar
   * nichts passiert ist — ein nicht angekommener Klick, ein gesperrter Knopf, eine Fläche ohne
   * Speicherweg hätten den Fehlerfall grün durchrutschen lassen. Gemessen wird deshalb hier: die
   * Weiche hat einen POST auf `/api/drafts` GESEHEN und ihn BEENDET (beantwortet oder abgebrochen).
   */
  warteAufAbschluss(marke: number, frist?: number): Promise<void>;
}

/**
 * Welche Weiche gehört zu welcher Seite? Ohne diese Zuordnung könnte eine Ablaufmeldung die Zähler
 * der Entwurfsweiche nicht nennen — der Bedienschritt bekommt die Weiche ja nicht übergeben. Die
 * `WeakMap` hält die Seite nicht am Leben und legt keinen zweiten Zustand daneben: geschrieben wird
 * an genau einer Stelle, in `entwurfsWeicheLegen`.
 */
const WEICHE_JE_SEITE = new WeakMap<SeiteMitDatei, Entwurfsweiche>();

/**
 * Legt die Weiche VOR die Weiche der Bühne (Playwright prüft Routen in umgekehrter
 * Registrierungsreihenfolge) und zählt jeden Anlege-Aufruf mit.
 */
export async function entwurfsWeicheLegen(
  seite: SeiteMitDatei,
  langsamMs = LANGSAM_MS,
): Promise<Entwurfsweiche> {
  let stand: Weichenstand = "durch";
  let angekommen = 0;
  let beendet = 0;

  await seite.route(`${ORIGIN}${ENTWURFS_PFAD}`, async (route) => {
    const r = route as unknown as Weiche;
    if (r.request().method() !== "POST") {
      await r.fallback();
      return;
    }
    angekommen += 1;
    try {
      if (stand === "abbruch") {
        await r.abort("failed");
        return;
      }
      if (stand === "fehler") {
        await r.fulfill({
          status: 500,
          body: JSON.stringify({ error: WEICHE_FEHLERCODE, message: WEICHE_FEHLERSATZ }),
          headers: { "content-type": "application/json" },
        });
        return;
      }
      if (stand === "langsam") {
        await new Promise((auf) => setTimeout(auf, langsamMs));
      }
      await r.fallback();
    } finally {
      beendet += 1;
    }
  });

  const weiche: Entwurfsweiche = {
    get stand(): Weichenstand {
      return stand;
    },
    setze(neu: Weichenstand): void {
      stand = neu;
    },
    get marke(): number {
      return beendet;
    },
    get zaehler(): { readonly angekommen: number; readonly beendet: number } {
      return { angekommen, beendet };
    },
    async warteAufAbschluss(
      marke: number,
      budget = wartebudget("warteAufAbschluss"),
    ): Promise<void> {
      const start = Date.now();
      const ende = start + budget;
      while (Date.now() < ende) {
        if (angekommen > marke && beendet > marke) {
          return;
        }
        await new Promise((auf) => setTimeout(auf, WARTEBUDGET.taktMs));
      }
      throw new Error(
        `Wartebudget erschöpft · Schritt «warteAufAbschluss» · erwartet war: ein angekommener UND beendeter POST ${ENTWURFS_PFAD} über der Marke ${marke} · Budget ${budget} ms (Fallrahmen ${FALL_RAHMEN_MS} ms, Lastfaktor ${lastfaktor()}) · abgelaufen nach ${Date.now() - start} ms · Entwurfsweiche angekommen=${angekommen} beendet=${beendet} · Weichenstand «${stand}» · ${lastlage()}`,
      );
    },
  };
  WEICHE_JE_SEITE.set(seite, weiche);
  return weiche;
}

// ------------------------------------------------------------------------------------------------
// Die Datei, die ein Mensch wählt.
// ------------------------------------------------------------------------------------------------

/**
 * Der Dateiname reist als `wholeSavedSource`-Platzhalter über die Fläche und als Quelle in den
 * Rumpf des Entwurfs — er ist damit selbst ein Beleg und darf nicht generisch sein.
 */
export const DATEI_NAME = "UX19-Ganzdokument-Beleg.txt";

/**
 * Die Überschrift entscheidet den Titel des Entwurfs (`wholeDocumentTitle`,
 * `captureFromFile.ts:335-348`) — deshalb steht sie hier und nicht der Zufall des Dateinamens.
 * Der zweite Absatz ist der Inhaltsbeleg: Er muss nach dem Öffnen auf der Fläche STEHEN, sonst ist
 * der Öffnen-Weg leer (Auftrag §5.3).
 */
export const DATEI_TITEL = "UX19 Ganzdokument Beleg";
export const DATEI_INHALTSSATZ =
  "Diese Zeile beweist, dass der Rumpf des Entwurfs beim Server angekommen ist.";
export const DATEI_INHALT = `# ${DATEI_TITEL}\n\n${DATEI_INHALTSSATZ}\n`;

export function dateiAnlage(name = DATEI_NAME, inhalt = DATEI_INHALT): DateiAnlage {
  return { name, mimeType: "text/plain", buffer: Buffer.from(inhalt, "utf8") };
}

// ------------------------------------------------------------------------------------------------
// Ableser, die IN der Seite laufen.
// ------------------------------------------------------------------------------------------------

/** Der sichtbare Text der ganzen Seite, Leerraum gefaltet. */
export const SEITENTEXT = `() => (document.body.textContent || '').replace(/\\s+/g, ' ').trim()`;

/**
 * Alles, was ein Mensch LESEN oder VORGELESEN bekommen kann: sichtbarer Text plus die vorgelesenen
 * Attribute. Bewusst NICHT das rohe `innerHTML` — dieselbe Begründung wie in
 * `anleitung-folgt-der-importart-mounted.test.tsx:186-198`: die technische Adresse
 * `/capture/frontdoor` steht im `href` des Öffnen-Wegs und BLEIBT dort. Verschwinden muss das Wort
 * aus dem, was jemand liest.
 */
export const LESBARER_TEXT = `() => {
  const attrs = [...document.querySelectorAll('*')].flatMap((el) =>
    ['title', 'aria-label', 'alt', 'placeholder'].map((a) => el.getAttribute(a) || ''),
  );
  return ((document.body.textContent || '') + ' ' + attrs.join(' ')).replace(/\\s+/g, ' ').trim();
}`;

/**
 * Ist dieser Knopf für einen Menschen betätigbar? `disabled` UND `aria-disabled` zählen — die
 * Fläche benutzt beide Schreibweisen (`ChoiceCards.tsx`, `Button.tsx`).
 */
const KNOPF_BEREIT = `(b) => !b.disabled && b.getAttribute('aria-disabled') !== 'true'`;

/**
 * Klickt den ersten BETÄTIGBAREN `<button>`, dessen gefalteter Text `text` enthält.
 * `false` = keiner da, der sich betätigen liesse.
 *
 * JOB 3575 — WARUM „BETÄTIGBAR" UND NICHT NUR „VORHANDEN". Bis hierher nahm dieser Ableser den
 * ersten Treffer und rief `k.click()`. Auf einem GESPERRTEN Knopf tut `click()` nichts — und der
 * Ableser meldete trotzdem `true`. Genau dieser Fall ist im Cloud-Prüflauf
 * 02229078b92c454688798c70e913ed4e aufgefallen: `V5` misst den Speichern-Knopf unmittelbar nach der
 * Dateiwahl und fand ihn GESPERRT (`vorlesehilfe-ganzdokument.test.ts:348`, „expected true to be
 * false"). Im selben Lauf lief `F2` in sein volles Budget, mit `angekommen=0 beendet=0` — es war
 * nie ein Anlege-Aufruf unterwegs, weil der Klick auf einen gesperrten Knopf ging.
 *
 * Ein Ableser, der „geklickt" meldet, wo nichts geklickt wurde, ist eine Scheinfunktion. Er meldet
 * jetzt ehrlich `false`, und die Zusicherung der Testdatei („Speichern-Knopf nicht gefunden")
 * schlägt an der richtigen Stelle an statt zwei Minuten später an einem Budget.
 */
export const KLICK_KNOPF = `(text) => {
  const k = [...document.querySelectorAll('button')].find(
    (b) => (b.textContent || '').replace(/\\s+/g, ' ').trim().includes(text)
      && (${KNOPF_BEREIT})(b),
  );
  if (!k) { return false; }
  k.click();
  return true;
}`;

/** Klickt die Auswahlkarte (`aria-pressed`), deren Text `text` enthält. */
export const KLICK_KARTE = `(text) => {
  const k = [...document.querySelectorAll('button[aria-pressed]')].find(
    (b) => (b.textContent || '').replace(/\\s+/g, ' ').includes(text),
  );
  if (!k) { return false; }
  k.click();
  return true;
}`;

/** Der CSS-Selektor des Öffnen-Links — für den ECHTEN Zeigerklick (`page.click`). */
export const OEFFNEN_LINK_SELEKTOR = `a[href^="${CAPTURE_FRONT_DOOR_ROUTE}?draft="]`;

/** Die `href` des Öffnen-Links — oder `null`, wenn keiner da ist. */
export const OEFFNEN_LINK_HREF = `(pfad) => {
  const a = [...document.querySelectorAll('a')].find(
    (x) => (x.getAttribute('href') || '').indexOf(pfad + '?draft=') === 0,
  );
  return a ? a.getAttribute('href') : null;
}`;

/**
 * Legt einen durchsichtigen Deckel ÜBER die Seite. Er verändert am Öffnen-Link nichts — er nimmt
 * ihm nur die Zeigerereignisse. Ein echter Zeigerklick kommt damit nicht mehr durch, ein
 * `el.click()` sehr wohl: genau das trennt die beiden (Kalibrierung in F4).
 *
 * WARUM DAS GANZE FENSTER UND NICHT NUR DAS RECHTECK DES LINKS. Zwei Fassungen sind daran
 * gescheitert und beide Male aus demselben Grund: Playwright scrollt sein Ziel VOR dem Klick ins
 * Bild. Ein nach Koordinaten gesetzter Deckel — ob am Fenster (`fixed`) oder am Dokument
 * (`absolute` + Scrollversatz) — liegt danach neben dem Link, weil das Blatt in einem EIGENEN
 * Scroll-Container sitzt und keine der beiden Bezugsgrössen mitwandert. Gemessen in Runde 2: der
 * Klick ging beide Male durch. `position: fixed; inset: 0` ist von jedem Scrollen unabhängig und
 * sagt genau das, was diese Kalibrierung sagen soll: liegt etwas dazwischen, kommt ein Zeigerklick
 * nicht ans Ziel.
 */
export const DECKE_LINK_ZU = `() => {
  const deckel = document.createElement('div');
  deckel.id = 'ux19-deckel';
  deckel.style.position = 'fixed';
  deckel.style.left = '0';
  deckel.style.top = '0';
  deckel.style.right = '0';
  deckel.style.bottom = '0';
  deckel.style.zIndex = '2147483647';
  deckel.style.background = 'rgba(0,0,0,0.01)';
  document.body.appendChild(deckel);
  return document.getElementById('ux19-deckel') !== null;
}`;

/** Nimmt den Deckel wieder weg. */
export const DECKE_LINK_AUF = `() => {
  const d = document.getElementById('ux19-deckel');
  if (!d) { return false; }
  d.remove();
  return true;
}`;

/** Wo steht die Seite gerade? (Pfad samt Abfrage — die Adresszeile ohne Herkunft.) */
export const ADRESSE = "() => location.pathname + location.search";

/** Wie viele Dateieingänge des Dokument-Imports stehen auf der Fläche? Muss genau einer sein. */
export const EINGANG_ZAEHLEN = `(accept) =>
  document.querySelectorAll('input[type="file"][accept="' + accept + '"]:not([multiple])').length`;

/** Der Selektor des EINEN Dateieingangs des Dokument-Imports. */
export const DATEI_EINGANG = `input[type="file"][accept="${FILE_IMPORT_ACCEPT}"]:not([multiple])`;

/** Trägt das fokussierte Element diese `href`? (Für den Tastaturweg zum Öffnen-Link.) */
export const FOKUS_HREF = `() => {
  const el = document.activeElement;
  return el ? el.getAttribute('href') : null;
}`;

/** Der Titel im Blatt (`blatt-titel`) und der sichtbare Text der Schreibfläche (`blatt-text`). */
export const BLATT_INHALT = `() => {
  const titel = document.querySelector('[data-testid="blatt-titel"]');
  const text = document.querySelector('[data-testid="blatt-text"]');
  return {
    titel: titel && 'value' in titel ? String(titel.value) : (titel ? (titel.textContent || '') : ''),
    text: text ? (text.textContent || '').replace(/\\s+/g, ' ').trim() : '',
  };
}`;

// ------------------------------------------------------------------------------------------------
// Bedienschritte — genau der Weg, den ein Mensch geht.
// ------------------------------------------------------------------------------------------------

/**
 * Öffnet auf dem Blatt den Arbeitsraum „Aus Datei": Werkzeugzeile „Datei" → „Datei importieren".
 * Derselbe Weg wie in `tastatur-importart-chromium.test.ts:102-121` — kein zweiter Einstieg.
 */
export async function dateiwegOeffnen(seite: SeiteMitDatei): Promise<void> {
  await seite.evaluate<boolean>(fn(KLICK_KNOPF), String(i18n.t("erfassen.werkzeug.datei")));
  await seite.evaluate<boolean>(fn(KLICK_KNOPF), String(i18n.t("erfassen.weg.datei")));
  await aufZustandWarten(seite, {
    schritt: "dateiwegOeffnen",
    erwartet: "beide Auswahlkarten des Dateiwegs stehen (mindestens zwei `button[aria-pressed]`)",
    ableser: `() => document.querySelectorAll('button[aria-pressed]').length >= 2`,
  });
}

/** Wählt die Importart „Ganzes Dokument übernehmen" und wartet, bis sie gedrückt ist. */
export async function ganzdokumentWaehlen(seite: SeiteMitDatei): Promise<void> {
  const ganzes = String(i18n.t(CAPTURE_FILE_TEXT.importModeWhole));
  await seite.evaluate<boolean>(fn(KLICK_KARTE), ganzes);
  await aufZustandWarten(seite, {
    schritt: "ganzdokumentWaehlen",
    erwartet: `die gedrückte Auswahlkarte trägt «${ganzes}»`,
    ableser: `(w) => {
      const k = document.querySelector('button[aria-pressed="true"]');
      return k !== null && (k.textContent || '').includes(w);
    }`,
    arg: ganzes,
  });
}

/**
 * Setzt die Datei über den ECHTEN versteckten Dateieingang (derselbe `<input type=file>`, den der
 * Knopf „Datei auswählen" und die Ablagefläche klicken — `CaptureFileImport.tsx:81-87`) und wartet,
 * bis der Speichern-Knopf des Ganzdokument-Wegs da ist.
 */
export async function dateiWaehlen(
  seite: SeiteMitDatei,
  anlage: DateiAnlage = dateiAnlage(),
): Promise<void> {
  const knopf = String(i18n.t(CAPTURE_FILE_TEXT.wholeCta));
  // Der zweite Schritt mit einer Frist, die Playwright gehört (hier seine eigene Voreinstellung,
  // die diese Bühne nicht setzen kann — `setInputFiles` nimmt in der nachdeklarierten Form keine).
  // Auch er geht bei einem Fehlschlag durch die gemeinsame Zustandsdiagnose statt in einen nackten
  // Wurf; das Budget in der Meldung ist ausdrücklich das ABGELEITETE des Schritts, nicht Playwrights
  // eigenes — deshalb steht sein Wortlaut daneben.
  const start = Date.now();
  try {
    await seite.setInputFiles(DATEI_EINGANG, [anlage]);
  } catch (e) {
    const wortlaut = String(e).split("\n")[0] ?? "";
    throw new Error(
      await ablaufmeldung(seite, {
        kopf: /timeout/i.test(wortlaut) ? "Wartebudget erschöpft" : "Warteschritt gescheitert",
        schritt: "dateiWaehlen",
        erwartet: `der EINE Dateieingang «${DATEI_EINGANG}» nimmt die Datei «${anlage.name}» an`,
        budget: wartebudget("dateiWaehlen"),
        verstrichen: Date.now() - start,
        zusatz: `Playwrights Wortlaut: ${wortlaut}`,
      }),
    );
  }
  await aufSpeichernknopfWarten(seite, "dateiWaehlen", knopf);
}

/**
 * JOB 3575 — AUF DEN ZUSTAND WARTEN, NICHT AUF DIE FRIST (Lehre JOB 3152 T1b).
 *
 * Bis hierher wartete `dateiWaehlen` darauf, dass der Speichern-Knopf DASTEHT. Das ist nicht der
 * Zustand, den ein Mensch braucht: `Capture.tsx:5313-5319` sperrt denselben Knopf, solange die
 * Datei noch eingelesen wird (`fileBusy`) oder ihr Text noch leer ist (`fileText.trim().length
 * === 0`). Zwischen „Knopf da" und „Knopf betätigbar" liegt also das ganze Einlesen — auf einem
 * schnellen Rechner Millisekunden, auf dem Cloud-Prüfrechner unter Last so lang, dass der Test
 * dazwischen geriet (Lauf 02229078b92c454688798c70e913ed4e, `V5`).
 *
 * Gewartet wird deshalb auf die BETÄTIGBARKEIT. Die Zusicherung wird dadurch nicht weicher,
 * sondern schärfer: ein Knopf, der nie betätigbar wird, macht den Fall jetzt mit Grund rot statt
 * einen Klick ins Leere gehen zu lassen.
 */
async function aufSpeichernknopfWarten(
  seite: SeiteMitDatei,
  schritt: Warteschritt,
  knopf: string,
): Promise<void> {
  await aufZustandWarten(seite, {
    schritt,
    erwartet: `der Speichern-Knopf «${knopf}» des Ganzdokument-Wegs steht da UND ist betätigbar (nicht gesperrt)`,
    ableser: `(text) => [...document.querySelectorAll('button')].some(
      (b) => (b.textContent || '').replace(/\\s+/g, ' ').trim().includes(text)
        && (${KNOPF_BEREIT})(b),
    )`,
    arg: knopf,
  });
}

/**
 * Drückt „Ganzes Dokument als Entwurf speichern" — und wartet vorher, bis der Knopf betätigbar ist.
 *
 * Das Warten gehört HIERHER und nicht nur in `dateiWaehlen`: F6, F7 und F9 drücken nach einem
 * Fehlschlag ein zweites Mal, ohne die Datei neu zu wählen. Auch dort muss der Knopf erst wieder
 * aus dem Wartezustand zurückkommen.
 */
export async function speichernDruecken(seite: SeiteMitDatei): Promise<boolean> {
  const knopf = String(i18n.t(CAPTURE_FILE_TEXT.wholeCta));
  await aufSpeichernknopfWarten(seite, "speichernDruecken", knopf);
  return seite.evaluate<boolean>(fn(KLICK_KNOPF), knopf);
}

/**
 * Der Ableser, der einen Satz auf der Fläche sucht — GENAU der bisherige, Zeichen für Zeichen:
 * `textContent` der Seite, Leerraum gefaltet, `includes`. Er stand bis JOB 3575 zweimal im Ordner
 * (in `aufErfolgskastenWarten` und im lokalen `aufSatzWarten` der Testdatei); jetzt einmal.
 */
const SATZ_STEHT = `(s) => (document.body.textContent || '').replace(/\\s+/g, ' ').includes(s)`;

/**
 * Wartet, bis ein bestimmter Satz auf der Fläche steht.
 *
 * ABLÖSUNG (Auftrag §5.5): dieser Helfer ersetzt den lokalen `aufSatzWarten` aus
 * `ganzdokument-am-echten-server.test.ts` und den inline gebauten `waitForFunction` aus
 * `vorlesehilfe-ganzdokument.test.ts`. Es gibt jetzt EINEN Warteweg auf einen Flächensatz, nicht
 * drei.
 */
export async function aufFlaechensatzWarten(
  seite: SeiteMitDatei,
  satz: string,
  budget?: number,
): Promise<void> {
  await aufZustandWarten(seite, {
    schritt: "aufFlaechensatzWarten",
    erwartet: `der Satz «${satz}» steht auf der Fläche`,
    ableser: SATZ_STEHT,
    arg: satz,
    ...(budget === undefined ? {} : { budget }),
  });
}

/**
 * Wartet, bis der Erfolgskasten (`wholeSavedTitle`) auf der Fläche steht — und bricht SOFORT ab,
 * wenn der Speicherweg stattdessen seinen Fehlerzustand zeigt (Auftrag §5.4: schnell rot mit Grund
 * ist besser als langsam rot ohne).
 *
 * Die Weiche und die Marke von VOR dem Klick sind PFLICHT, weil ohne sie „ein Fehlersatz steht da"
 * nichts über DIESEN Speicherversuch aussagt (s. `fehlerzustand`). Die Fallaussage ändert sich
 * dadurch nicht: Was heute grün ist, bleibt grün — der Abbruch greift nur, wenn dieser Versuch
 * beendet, der Client fertig, kein Erfolgskasten da und ein Fehlersatz sichtbar ist. In diesem
 * Zustand wäre der Fall ohnehin rot geworden, nur eben erst nach dem vollen Budget.
 */
export async function aufErfolgskastenWarten(
  seite: SeiteMitDatei,
  versuch: Speicherversuch,
  budget?: number,
): Promise<void> {
  const titel = flaechensatz(CAPTURE_FILE_TEXT.wholeSavedTitle);
  await aufZustandWarten(seite, {
    schritt: "aufErfolgskastenWarten",
    erwartet: `der Erfolgskasten «${titel}» steht auf der Fläche`,
    ableser: SATZ_STEHT,
    arg: titel,
    fehlerabbruch: versuch,
    ...(budget === undefined ? {} : { budget }),
  });
}

/**
 * Wartet, bis der Speicherversuch WIRKLICH zu Ende ist. Zwei Bedingungen, und die erste ist die
 * wichtige (Codex-Nachführung 08.09. 16:50):
 *   1. Die Weiche hat einen POST auf `/api/drafts` gesehen UND beendet — der Versuch hat also
 *      stattgefunden. Ohne diese Messung wäre „kein `wholeSaving` mehr da" auch dann wahr, wenn
 *      nie etwas losgelaufen ist.
 *   2. Der Wartezustand `wholeSaving` steht nicht mehr auf der Fläche — der Client ist fertig.
 */
export async function aufRuhestandWarten(
  seite: SeiteMitDatei,
  versuch: Speicherversuch,
): Promise<void> {
  const warten = flaechensatz(CAPTURE_FILE_TEXT.wholeSaving);
  await versuch.weiche.warteAufAbschluss(versuch.marke);
  await aufZustandWarten(seite, {
    schritt: "aufRuhestandWarten",
    erwartet: `der Wartezustand «${warten}» steht NICHT mehr auf der Fläche`,
    ableser: `(w) => !(document.body.textContent || '').includes(w)`,
    arg: warten,
  });
}

/** Die Entwurfskennung aus dem Öffnen-Link — die Kennung, die der MENSCH angeboten bekommt. */
export async function kennungAusOeffnenLink(seite: SeiteMitDatei): Promise<string | null> {
  const href = await seite.evaluate<string | null>(fn(OEFFNEN_LINK_HREF), CAPTURE_FRONT_DOOR_ROUTE);
  if (href === null) {
    return null;
  }
  const roh = href.slice(`${CAPTURE_FRONT_DOOR_ROUTE}?draft=`.length);
  return decodeURIComponent(roh);
}

/** Lädt die Seite neu — ein echtes `goto`, kein Zustandsschubs. Budget nur für die Wächterproben. */
export async function neuLaden(
  seite: SeiteMitDatei,
  pfad = "/erfassen",
  budget = wartebudget("neuLadenAdresse"),
): Promise<void> {
  // ==============================================================================================
  // JOB 3575 R2 — AUCH DIESER SCHRITT SAGT, WORAUF ER GEWARTET HAT.
  // ==============================================================================================
  // Der `goto` ist der EINE Schritt, den die Bühne nicht selbst takten kann — die Frist gehört
  // Playwright, und ihr Wert kommt aus derselben Quelle. Runde 1 hat daraus geschlossen, die
  // MELDUNG müsse ebenfalls Playwrights bleiben, mit der Begründung, vor dem Laden sei keine Fläche
  // da. Das war falsch, und Codex hat es nachgewiesen (Korrekturpflicht 2): ein `goto` verlässt die
  // ALTE Seite nicht, solange es nicht durch ist — deren Text ist lesbar, die Weichenzähler stehen
  // ohnehin in Node. Läuft die Frist ab, kam bis hierher nur `page.goto: Timeout 60000ms exceeded.`
  // — dieselbe stumme Zahl, gegen die dieser ganze Auftrag geschrieben ist.
  //
  // Ist der Text WIRKLICH nicht lesbar (die alte Seite ist schon weg), sagt `flaechentext` genau
  // das — „Flächentext nicht lesbar: …" — statt eine Fläche zu behaupten, die niemand gesehen hat.
  const start = Date.now();
  try {
    await seite.goto(`${ORIGIN}${pfad}`, { waitUntil: "load", timeout: budget });
  } catch (e) {
    const wortlaut = String(e).split("\n")[0] ?? "";
    throw new Error(
      await ablaufmeldung(seite, {
        // Ehrlich getrennt: eine abgelaufene Frist ist ein erschöpftes Budget, jeder andere
        // Navigationsfehler ist keines und darf auch nicht so heissen.
        kopf: /timeout/i.test(wortlaut) ? "Wartebudget erschöpft" : "Warteschritt gescheitert",
        schritt: "neuLadenAdresse",
        erwartet: `die Adresse «${ORIGIN}${pfad}» ist geladen (waitUntil=load)`,
        budget,
        verstrichen: Date.now() - start,
        zusatz: `Playwrights Wortlaut: ${wortlaut}`,
      }),
    );
  }
  await aufZustandWarten(seite, {
    schritt: "neuLadenBlatt",
    erwartet: `das Blatt («[data-testid="blatt"]») steht nach dem Laden von ${pfad}`,
    ableser: "(sel) => document.querySelector(sel) !== null",
    arg: '[data-testid="blatt"]',
  });
}

/**
 * Die Sprache dieser Bühne umstellen. Gemessen am Produkt: `i18n.ts` liest den Startwert über
 * `gespeicherteSprache()` aus `localStorage["kw.sprache"]` (`lib/sprachwahl.ts:22`, `:36-42`) —
 * kein LanguageDetector, kein Browsersprachen-Rückfall. Ein `addInitScript` setzt den Schlüssel
 * VOR jedem Skript der Seite; wirksam wird er mit dem nächsten `goto` (Muster
 * `h3-blatt-buehne.ts:212-214`, das dort das Theme setzt).
 */
export async function spracheSetzen(seite: SeiteMitDatei, sprache: string): Promise<void> {
  await seite.addInitScript(
    `try { localStorage.setItem("kw.sprache", ${JSON.stringify(sprache)}); } catch (e) {}`,
  );
  await i18n.changeLanguage(sprache);
}
