// ================================================================================================
// JOB 4223 R2 · DER GANZE GASTWEG IM BROWSER — EINMAL BESCHRIEBEN, ZWEIMAL GEFAHREN.
// ================================================================================================
//
// WARUM DIESE DATEI IN RUNDE 2 ENTSTANDEN IST. BEN hat an Runde 1 zu Recht beanstandet, dass der
// „durchgehende Weg" in Wahrheit zwei getrennte Behauptungen waren: der Browserlauf fuhr gegen
// SPEICHERablagen, der PostgreSQL-Lauf sprach nur HTTP und bediente kein Formular. Zwischen beiden
// lag genau die Annahme, gegen die dieser Auftrag gebaut ist. Der Weg steht deshalb ab jetzt GENAU
// EINMAL hier und wird von zwei Dateien mit zwei Ablagen gefahren:
//
//   · `gastweg-im-echten-browser.test.ts`              → Speicherablagen, läuft im Tor (kein Docker,
//                                                        keine Datenbank nötig).
//   · `gastweg-pg-im-browser.integration.test.ts`      → `buildPgServices(pool)`, echte PostgreSQL.
//
// Läge der Ablauf zweimal ausgeschrieben da, wären es wieder zwei Aussagen, die nur heute
// übereinstimmen — dasselbe Argument, mit dem `tests/demo-zugang-gaeste/aufbau.ts:7` seinen einen
// Aufbau begründet.
//
// ================================================================================================
// DIE TASTATUR WIRD GEDRÜCKT, NICHT NACHGEBILDET — der zweite Befund der Runde 1.
// ================================================================================================
//
// Runde 1 behauptete einen Tastaturnachweis und öffnete die Befristung in Wahrheit mit einem
// JavaScript-`click()` aus `page.evaluate`. BEN hat das mit einer eigenen Mutation belegt: er hat
// den Knopf „Befristung setzen" im Produkt mit `tabIndex={-1}` aus der Tab-Reihenfolge genommen —
// und der Fall blieb GRÜN. Ein Nachweis, der eine zerstörte Bedienbarkeit nicht sieht, ist keiner.
//
// JEDES Bedienelement dieses Weges wird deshalb über `tastaturAusloesen` erreicht: Tab drücken, bis
// das AKTIVE Element die gesuchte Beschriftung trägt, den SICHTBAREN Fokus am berechneten Stil
// nachmessen, dann Enter. Ein Knopf, den kein Tab erreicht, lässt diesen Weg scheitern — und genau
// das ist die Zusage aus Lieferung 6.
//
// JOB 4265 · DIE LETZTE AUSNAHME IST FORT — AUCH DAS DATUM WIRD GETIPPT.
//
// Hier stand bis JOB 4265: der TAG im Datumsfeld werde mit `fill` gesetzt, weil eine native
// Datumseingabe die Ziffern in der Reihenfolge des GEBIETSSCHEMAS entgegennimmt (TT.MM.JJJJ gegen
// MM/DD/YYYY) und ein getippter Tag deshalb die Einstellung des Prüfstands messe statt das Produkt.
// Das Argument war richtig — solange das Gebietsschema ungefragt aus der Umgebung kam. BEN hat die
// Lücke in Runde 3 zu Recht offengelassen benannt: „für einen vollständigen Eingabenachweis Ziffern
// bei festgelegtem Gebietsschema per Tastatur eingeben."
//
// Das Gebietsschema wird jetzt GESETZT (`GEBIETSSCHEMA`, am Browserprofil), genau wie die Sprache
// der Fläche schon seit jeher gesetzt wird und aus demselben Grund: ein Prüfstand, dessen
// Reihenfolge von der Umgebung abhängt, misst mal dies, mal das. Damit ist die Reihenfolge bekannt,
// die Ziffern gehen als echte Tastendrücke hinein — und das Ergebnis wird am `value` des Feldes
// nachgemessen (`tippeDatumMitTastatur`). Ein Feld, in das man den Tag nicht tippen kann, lässt
// diesen Weg ab jetzt scheitern; `fill` kommt in dieser Datei nicht mehr vor.
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { expect } from "vitest";
import { registerWebStatic } from "../../services/app/src/web-static";
import { MELDUNGEN, type Sprache } from "../../services/auth/src/meldungen";
import { PASSWORT, type Sitzung, type Strecke } from "./strecke";

export const DIST = resolve(process.cwd(), "apps/web/dist");
/** Das schmalste Gerät der Zielliste — Lieferung 6 misst an dieser Kante. */
export const SCHMAL = { width: 390, height: 844 };
/**
 * JOB 4265 · DAS GEBIETSSCHEMA DER BROWSERPROFILE — festgelegt, nicht geerbt.
 *
 * Deutsch, weil auch die Sprache der Fläche und die Sollwerte aus dem Katalog deutsch sind: ein
 * Prüfstand, der seine Spracheinstellungen aus der Umgebung nimmt, misst mal dies, mal das.
 *
 * WAS ES NACHWEISLICH NICHT TUT — und das steht hier, weil der erste Entwurf dieses Auftrags das
 * Gegenteil behauptet hat. Die Vermutung war, `locale` bestimme die Reihenfolge, in der eine native
 * Datumseingabe ihre Ziffern annimmt (TT.MM.JJJJ gegen MM/TT/JJJJ). GEMESSEN (Gegenprobe G6,
 * Arbeitsprüfung `d8ca99fb7eb84287918b063801ba2a52`): mit `en-US` statt `de-DE` bleibt P1 GRÜN —
 * dieselben acht Ziffern ergeben denselben Tag. Chromium richtet die Abschnittsreihenfolge dieses
 * Steuerelements also nicht nach dem Gebietsschema des Kontexts.
 *
 * Die Reihenfolge ist damit eine ANNAHME dieses Prüfstands und keine von ihm gesetzte Grösse. Sie
 * wird deshalb nicht geglaubt, sondern nach jeder Eingabe am `value` des Feldes NACHGEMESSEN
 * (`tippeDatumMitTastatur`). Ordnet ein Browser die Abschnitte eines Tages anders, wird dieser Weg
 * rot und sagt, was hineingelaufen ist — statt still einen falschen Tag zu speichern.
 */
export const GEBIETSSCHEMA = "de-DE";

// ------------------------------------------------------------------------------------------------
// Die schmale Typhülle um Playwright. `playwright` kommt über `createRequire` und nicht als
// statischer Import — so erkennt die Browser-Gruppe des Tors die Verbraucher dieser Datei am
// Importgraphen (`tests/tor-inventar/browser-gruppe.ts`).
// ------------------------------------------------------------------------------------------------
export type BrowserFn = (arg: unknown) => unknown;
export const fn = (quelle: string): BrowserFn =>
  new Function("arg", `return (${quelle})(arg);`) as BrowserFn;

export interface Seite {
  goto(url: string, opts?: Record<string, unknown>): Promise<unknown>;
  reload(opts?: Record<string, unknown>): Promise<unknown>;
  waitForFunction(f: BrowserFn, arg?: unknown, opts?: Record<string, unknown>): Promise<unknown>;
  evaluate<T>(f: BrowserFn, arg?: unknown): Promise<T>;
  fill(selector: string, value: string): Promise<void>;
  click(selector: string, opts?: Record<string, unknown>): Promise<void>;
  keyboard: { press(key: string): Promise<void>; type(text: string): Promise<void> };
  url(): string;
}
export interface Kontext {
  newPage(): Promise<Seite>;
  addInitScript(script: string): Promise<void>;
  cookies(): Promise<{ name: string; value: string }[]>;
  /**
   * JOB 4322 · DIE VERBINDUNG DIESES BROWSERPROFILS — an oder aus, wie im echten Gerät.
   *
   * Playwright schaltet sie am BrowserContext (`BrowserContext.setOffline`): `navigator.onLine`
   * kippt, `window.online`/`window.offline` feuern, und jede Anfrage dieses Profils scheitert wie
   * ohne Netz. Das ist etwas anderes als ein abgefangener Aufruf — die Fläche erfährt die Lage über
   * denselben Weg wie am Handy, und der Dienstarbeiter (`apps/web/public/sw.js`) bedient das
   * Neuladen aus seinem Zwischenspeicher.
   *
   * ADDITIV UND OHNE AUFRUFERZWANG: Die bestehenden Verbraucher dieser Hülle (`fahreDenGanzenWeg`,
   * `gastweg-*`) rufen sie nicht und bleiben unverändert. Sie steht hier und nicht in einer zweiten
   * Hülle daneben, weil es genau EINE Typhülle um Playwright geben soll — zwei liefen eines Tages
   * auseinander (dieselbe Begründung wie im Kopf dieser Datei).
   */
  setOffline(offline: boolean): Promise<void>;
  close(): Promise<void>;
}
export interface Browser {
  newContext(opts?: Record<string, unknown>): Promise<Kontext>;
  close(): Promise<void>;
}

export const LIES_TEXT = "() => document.body.innerText";

/**
 * JOB 4265 · DER HANDLUNGSTEIL EINES MELDUNGSSATZES — alles nach dem ersten Satzende.
 *
 * Er wird GESCHNITTEN und nicht abgeschrieben: der Sollwert kommt aus `MELDUNGEN`, sonst stünde in
 * dieser Datei eine zweite Textquelle, die eines Tages von der ersten abwiche.
 *
 * Ein Satz OHNE zweiten Teil liefert die leere Zeichenkette — und nicht etwa den ganzen Satz. Das
 * ist Absicht: der Aufrufer sichert die Nichtleere eigens zu und merkt so, wenn die Handlung aus
 * dem Katalog verschwindet. Gäbe es hier einen stillen Rückfall, bliebe der Nachweis grün.
 */
export function handlungsteil(satz: string): string {
  const ende = satz.indexOf(". ");
  return ende < 0 ? "" : satz.slice(ende + 1).trim();
}

/**
 * JOB 4265 · RUNDE 2 · DIE BEIDEN ANDEREN SPRACHEN, die der echte Browser ebenfalls lesen muss.
 *
 * BENs Korrekturpflicht 1 der Runde 1: der Handlungssatz war im Browser nur auf Deutsch belegt.
 * „EN/NL sind durch Socket- und jsdom-Tests belegt, nicht durch den verlangten Browserlauf" —
 * und ein HTTP-Nachweis sagt nichts darüber, ob der Satz auch durch die gebaute Fläche kommt.
 *
 * Deutsch steht NICHT in dieser Liste, weil es den Hauptweg fährt (Abschnitt 6b/6c) und dort mehr
 * geprüft wird als hier: dort hängt der Satz an einer abgelaufenen Frist, die gerade über die
 * Fläche des Admins gesetzt wurde. Abschnitt 6d prüft dieselbe Lage in den beiden anderen Sprachen.
 */
const ANDERE_SPRACHEN: readonly Sprache[] = ["en", "nl"];
const AKTIVER_PFAD = `() => {
  const a = document.activeElement;
  if (!a) return "(nichts)";
  const id = a.getAttribute("id");
  const typ = a.getAttribute("type");
  return [a.tagName.toLowerCase(), id ? "#" + id : "", typ ? "[" + typ + "]" : "", (a.textContent || "").trim().slice(0, 40)].join("|");
}`;

/**
 * Sieht man, worauf der Fokus steht?
 *
 * Gemessen wird der BERECHNETE Stil des aktiven Elements — Umriss oder Schatten. Ein Vertrag, der
 * nur im Quelltext steht (`focus-visible:ring-…`), ist keine Sichtbarkeit: er wirkt erst, wenn der
 * Browser seine Tastaturheuristik anwendet, und genau die kann jsdom nicht.
 */
const FOKUS_SICHTBAR = `() => {
  const a = document.activeElement;
  if (!a) return false;
  const s = getComputedStyle(a);
  const umriss = s.outlineStyle !== "none" && Number.parseFloat(s.outlineWidth || "0") > 0;
  const schatten = s.boxShadow !== "none" && s.boxShadow !== "";
  return umriss || schatten;
}`;

/** Woran hing (oder fehlte) die Sichtbarkeit? Für Fehlermeldungen, die auf den Schuldigen zeigen. */
const FOKUS_DIAGNOSE = `() => {
  const a = document.activeElement;
  if (!a) return "aktiv: (nichts)";
  const s = getComputedStyle(a);
  return [
    "aktiv: <" + a.tagName.toLowerCase() + ">",
    "klassen=" + (a.getAttribute("class") || "").slice(0, 120),
    "tabindex=" + (a.getAttribute("tabindex") ?? "(keiner)"),
    "outline=" + s.outlineStyle + " " + s.outlineWidth + " " + s.outlineColor,
    "boxShadow=" + String(s.boxShadow).slice(0, 80),
  ].join(" · ");
}`;

/** Der Fokus geht auf den Dokumentanfang zurück — ohne das DOM anzufassen. */
const FOKUS_ZURUECKSETZEN =
  "() => { const a = document.activeElement; if (a && a.blur) { a.blur(); } return true; }";

export async function warte(
  seite: Seite,
  quelle: string,
  was: string,
  arg?: unknown,
  frist = 30_000,
): Promise<void> {
  try {
    await seite.waitForFunction(fn(quelle), arg, { timeout: frist });
  } catch (fehler) {
    const text = await seite.evaluate<string>(fn(LIES_TEXT)).catch(() => "<nicht lesbar>");
    throw new Error(
      `JOB 4223: ${was} — nicht eingetreten in ${frist} ms auf ${seite.url()}.\nSeitentext:\n${text.slice(0, 1600)}\n\nUrsprung: ${String(fehler)}`,
    );
  }
}

/**
 * Tab drücken, bis das AKTIVE Element den Selektor erfüllt. Gibt die Zahl der Anschläge zurück.
 *
 * `vonVorn` setzt den Fokus vorher auf den Dokumentanfang zurück — nötig überall dort, wo ein
 * React-Neuaufbau das zuletzt fokussierte Element entfernt hat (dann liegt der Fokus auf `body`,
 * und ohne diesen Schritt hinge die Zählung von der Vorgeschichte ab).
 */
export async function tabBisZu(
  seite: Seite,
  selektor: string,
  hoechstens = 150,
  vonVorn = false,
): Promise<number> {
  if (vonVorn) {
    await seite.evaluate<boolean>(fn(FOKUS_ZURUECKSETZEN));
  }
  const treffer = "(sel) => { const a = document.activeElement; return !!a && a.matches(sel); }";
  for (let schritte = 1; schritte <= hoechstens; schritte += 1) {
    await seite.keyboard.press("Tab");
    if (await seite.evaluate<boolean>(fn(treffer), selektor)) {
      return schritte;
    }
  }
  throw new Error(
    `JOB 4223: „${selektor}" war in ${hoechstens} Tab-Anschlägen nicht erreichbar. Zuletzt aktiv: ${await seite.evaluate<string>(fn(AKTIVER_PFAD))}`,
  );
}

/**
 * Die Menge der Elemente, die ein Mensch WIRKLICH bedient.
 *
 * RUNDE 2, ERSTER MESSBEFUND: Ohne diese Einschränkung traf der Tab-Weg an der Kontokarte ein
 * anderes Element als den Knopf — Chromium macht einen scrollbaren Bereich von sich aus
 * tastaturfokussierbar, und dessen `textContent` enthält die gesuchte Beschriftung ebenfalls. Der
 * Fall scheiterte dann an einem Container, der richtigerweise keinen Fokusring trägt, und die
 * Meldung zeigte auf den falschen Schuldigen. Gesucht ist das BEDIENELEMENT, nicht irgendein
 * Vorfahre, der denselben Text umschliesst.
 */
const BEDIENBAR = 'button, a[href], input, select, textarea, [role="button"]';

/** Tab drücken, bis das aktive BEDIENELEMENT diese Beschriftung trägt. */
export async function tabBisText(
  seite: Seite,
  text: string,
  hoechstens = 150,
  vonVorn = true,
): Promise<number> {
  if (vonVorn) {
    await seite.evaluate<boolean>(fn(FOKUS_ZURUECKSETZEN));
  }
  const treffer = `([t, sel]) => {
    const a = document.activeElement;
    return !!a && a.matches(sel) && (a.textContent || "").trim().includes(t);
  }`;
  for (let schritte = 1; schritte <= hoechstens; schritte += 1) {
    await seite.keyboard.press("Tab");
    if (await seite.evaluate<boolean>(fn(treffer), [text, BEDIENBAR])) {
      return schritte;
    }
  }
  throw new Error(
    `JOB 4223: ein Bedienelement mit „${text}" war in ${hoechstens} Tab-Anschlägen nicht erreichbar — das ist die Halbheit „nur mit der Maus". Zuletzt aktiv: ${await seite.evaluate<string>(fn(AKTIVER_PFAD))}`,
  );
}

/**
 * DER EINE WEG ZU EINEM BEDIENELEMENT: per Tab hin, Fokus sichtbar, mit Enter ausgelöst.
 *
 * Es gibt in dieser Datei bewusst KEINEN zweiten (kein `click()` aus `page.evaluate`, kein
 * `page.click`) — sonst stünde neben dem gemessenen Weg ein ungemessener, und der nächste Fall
 * nähme den bequemeren.
 */
export async function tastaturAusloesen(seite: Seite, text: string): Promise<number> {
  const schritte = await tabBisText(seite, text);
  await fokusMussSichtbarSein(seite, text);
  await seite.keyboard.press("Enter");
  return schritte;
}

/**
 * Die Sichtbarkeitsprüfung des Fokus, an EINER Stelle.
 *
 * Die Diagnose wird VOR der Zusicherung geholt und in ihre Meldung gelegt: ein „expected false to
 * be true" allein sagt nicht, WELCHES Element gemeint war und WORAN die Sichtbarkeit hing.
 */
async function fokusMussSichtbarSein(seite: Seite, was: string): Promise<void> {
  const stand = await seite.evaluate<string>(fn(FOKUS_DIAGNOSE));
  expect(
    await seite.evaluate<boolean>(fn(FOKUS_SICHTBAR)),
    `„${was}" zeigt keinen sichtbaren Fokus, obwohl es gerade per Tastatur angesteuert wurde — ${stand}`,
  ).toBe(true);
}

/**
 * RUNDE 3 · DER EINE WEG ZU EINEM EINGABEFELD — und warum es ihn geben muss.
 *
 * BEN hat an Runde 2 gemessen, was die Rückgabe damals „klickfrei" nannte: das ERSTE Formularfeld
 * (der Name) wurde mit `page.click` angesteuert, und alles danach hing an dessen Fokus. Seine
 * Mutation `tabIndex={-1}` AM NAMENSFELD liess den Fall deshalb GRÜN — ein Feld, das kein Tab mehr
 * erreicht, wäre für eine Tastaturnutzerin der Anfang einer Sackgasse, und der Nachweis sah es
 * nicht. Dasselbe galt für `#auth-email` an der Anmeldemaske.
 *
 * Seit dieser Runde führt auch zu einem EINGABEFELD nur ein Weg: Fokus auf den Dokumentanfang
 * zurück, per Tab hin, sichtbarer Fokus nachgemessen, dann tippen. `page.click` und `evaluate`-
 * `click()` kommen in dieser Datei nicht mehr vor.
 *
 * WARUM ÜBER DIE IDENTITÄT UND NICHT ÜBER EINEN SELEKTOR: gesucht ist „das erste Eingabefeld DIESER
 * Karte", und das ist genau `document.querySelector(sel)`. Ein Selektorvergleich (`a.matches(sel)`)
 * träfe jedes Feld der Karte und bliebe grün, wenn der Tab-Weg beim ZWEITEN landete — dann stimmte
 * die Reihenfolge nicht mehr, und die Eingaben lägen danach in den falschen Feldern.
 */
export async function tippeMitTastatur(
  seite: Seite,
  selektor: string,
  text: string,
  was: string,
): Promise<number> {
  await seite.evaluate<boolean>(fn(FOKUS_ZURUECKSETZEN));
  const treffer = `(sel) => {
    const ziel = document.querySelector(sel);
    return !!ziel && document.activeElement === ziel;
  }`;
  for (let schritte = 1; schritte <= 150; schritte += 1) {
    await seite.keyboard.press("Tab");
    if (await seite.evaluate<boolean>(fn(treffer), selektor)) {
      await fokusMussSichtbarSein(seite, was);
      await seite.keyboard.type(text);
      return schritte;
    }
  }
  throw new Error(
    `JOB 4223: das Eingabefeld „${was}" (${selektor}) war in 150 Tab-Anschlägen nicht erreichbar — das ist die Halbheit „nur mit der Maus". Zuletzt aktiv: ${await seite.evaluate<string>(fn(AKTIVER_PFAD))}`,
  );
}

/**
 * JOB 4265 · DER TAG WIRD GETIPPT — ECHTE ZIFFERN, BEI FESTGELEGTEM GEBIETSSCHEMA.
 *
 * VORBEDINGUNG: Das Feld ist bereits per Tab angesteuert und sein Fokus nachgemessen. Diese
 * Funktion fasst den Fokus nicht an — sie tippt, wohin er zeigt. Ein eigener Weg zum Feld stünde
 * neben dem gemessenen, und der nächste Fall nähme den bequemeren (dasselbe Argument wie bei
 * `tastaturAusloesen`).
 *
 * DIE REIHENFOLGE IST TAG, MONAT, JAHR — und sie wird NACHGEMESSEN, nicht gesetzt (die Messung dazu
 * steht bei `GEBIETSSCHEMA`). Chromium schaltet nach jedem vollständigen Abschnitt von selbst
 * weiter, deshalb reichen die acht Ziffern am Stück.
 *
 * UND DAS ERGEBNIS WIRD NACHGEMESSEN. Der `value` einer Datumseingabe ist IMMER `YYYY-MM-DD`,
 * unabhängig davon, wie der Browser sie anzeigt — er ist damit der eine Wert, an dem sich
 * ablesen lässt, ob die Ziffern in den richtigen Abschnitten gelandet sind. Ohne diese Zusicherung
 * bliebe der Fall grün, wenn Tag und Monat vertauscht hineinliefen, und die Fehlermeldung zeigte
 * erst zwei Stationen später auf die falsche Stelle.
 */
export async function tippeDatumMitTastatur(
  seite: Seite,
  selektor: string,
  tag: string,
  was: string,
): Promise<void> {
  const teile = /^(\d{4})-(\d{2})-(\d{2})$/.exec(tag);
  if (!teile) {
    throw new Error(`JOB 4265: „${tag}" ist kein Tag der Form JJJJ-MM-TT (${was}).`);
  }
  const [, jahr, monat, tagZahl] = teile;
  await seite.keyboard.type(`${tagZahl}${monat}${jahr}`);
  const gesetzt = await seite.evaluate<string>(
    fn(`(s) => { const e = document.querySelector(s); return e ? e.value : "(kein Feld)"; }`),
    selektor,
  );
  expect(
    gesetzt,
    `die getippten Ziffern ${tagZahl}${monat}${jahr} sind im Feld „${was}" nicht als ${tag} angekommen (gelesen: „${gesetzt}") — dieser Browser nimmt die Abschnitte einer Datumseingabe in einer anderen Reihenfolge entgegen als Tag, Monat, Jahr`,
  ).toBe(tag);
}

/**
 * Ein frisches Browserprofil: eigener Keksbeutel, eigener Speicher, Sprache FESTGELEGT.
 *
 * JOB 4265 · RUNDE 2, BENs KORREKTURPFLICHT 1: die Sprache ist jetzt ein Parameter statt fest
 * verdrahtetem „de". Der Grund ist kein Aufräumen, sondern ein fehlender Nachweis — der abgewiesene
 * Gast wurde bis hierher ausschliesslich auf Deutsch im echten Browser gelesen, obwohl der Auftrag
 * DE/EN/NL verlangt. Zwei weitere Profile fahren denselben Weg in „en" und „nl" (Abschnitt 6d).
 *
 * Das GEBIETSSCHEMA bleibt dabei bei allen Profilen `de-DE` und wandert NICHT mit der Sprache mit.
 * Das ist Absicht und trägt den Nachweis: Playwrights `locale` setzt auch den `Accept-Language`-
 * Kopf, den der Browser von sich aus sendet. Ginge er mit, könnte der englische Satz auch dann
 * ankommen, wenn die Fläche die gespeicherte Wahl gar nicht weiterreichte — der Fall bliebe grün
 * und bewiese nichts. So sagt die Umgebung „Deutsch" und nur die Wahl der Nutzerin „Englisch":
 * erscheint der englische Satz, dann WEIL `client.ts:23` `i18n.language` in den Kopf schreibt.
 */
export async function profil(
  browser: Browser,
  viewport = SCHMAL,
  sprache: Sprache = "de",
): Promise<{ kontext: Kontext; seite: Seite }> {
  // JOB 4265: `locale` gehört zum Profil und nicht zu einem einzelnen Schritt. Es legt die
  // Umgebung dieses Profils fest — was es für die Ziffernreihenfolge einer Datumseingabe
  // NACHWEISLICH nicht tut, steht bei `GEBIETSSCHEMA` und wird dort nicht geglaubt, sondern
  // nachgemessen.
  const kontext = await browser.newContext({ viewport, locale: GEBIETSSCHEMA });
  // Die Sprache wird GESETZT und nicht geraten: die Sollwerte unten stammen aus dem Katalog, und
  // ein Prüfstand, dessen Sprache von der Umgebung abhängt, misst mal dies, mal das. Der Schlüssel
  // ist `sprachwahl.ts:23` (`SPRACHE_STORAGE_KEY`), gelesen beim Start von `i18n.ts`.
  await kontext.addInitScript(
    `try { localStorage.setItem("kw.sprache", ${JSON.stringify(sprache)}); } catch (e) {}`,
  );
  return { kontext, seite: await kontext.newPage() };
}

/** Chromium starten — mit der Vorbedingung, die LAUT scheitert statt still zu überspringen. */
export function starteChromium(): Promise<Browser> {
  if (!existsSync(join(DIST, "index.html"))) {
    throw new Error(
      `JOB 4223: ${DIST}/index.html fehlt — die gebaute Fläche ist die Vorbedingung dieses Laufs (im Tor läuft ./tools/build davor, tools/check:9).`,
    );
  }
  const require = createRequire(import.meta.url);
  const { chromium } = require("playwright") as {
    chromium: { launch(o: Record<string, unknown>): Promise<Browser> };
  };
  return chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-gpu"] });
}

/** Die gebaute Fläche vor dem Horchen an die echte Instanz hängen — wie `server.ts:66`. */
export function mitFlaeche(): {
  vorListen: (app: Parameters<typeof registerWebStatic>[0]) => Promise<void>;
} {
  return { vorListen: (app) => registerWebStatic(app, DIST) };
}

/**
 * Anmeldung über die ECHTE Maske, ausschliesslich mit der Tastatur.
 *
 * RUNDE 3: auch das E-Mail-Feld wird per Tab erreicht und nicht mehr angeklickt. Dass die Maske es
 * von sich aus fokussiert (`autoFocus` in `AuthScreens.tsx`), ist dabei KEIN Ersatz für die
 * Erreichbarkeit — ein Feld mit `tabIndex={-1}` wäre autofokussiert und trotzdem für jeden, der
 * einmal weggetabbt ist, unerreichbar. Der Fokus geht deshalb zuerst auf den Dokumentanfang zurück.
 */
async function anmelden(
  seite: Seite,
  basis: string,
  email: string,
  passwort: string,
  /** Unter welchem Namen die Tastaturschritte im Befund erscheinen. */
  marke: string,
  tastatur: Record<string, number>,
  /** Beim Wiederanmelden nach dem Ablauf steht die Maske schon da — dann nicht neu laden. */
  neuLaden = true,
): Promise<void> {
  if (neuLaden) {
    await seite.goto(`${basis}/`, { waitUntil: "domcontentloaded" });
  }
  await warte(seite, `() => !!document.querySelector("#auth-email")`, `Anmeldemaske für ${email}`);
  tastatur[`${marke}_email`] = await tippeMitTastatur(
    seite,
    "#auth-email",
    email,
    `E-Mail (${marke})`,
  );
  tastatur[`${marke}_passwort`] = await tippeMitTastatur(
    seite,
    "#auth-password",
    passwort,
    `Passwort (${marke})`,
  );
  await seite.keyboard.press("Enter");
}

/** Der lokalisierte Kalendertag, wie ihn das Produkt schreibt (`toLocaleDateString(i18n.language)`). */
const TAG_ANZEIGE = `(tag) => {
  const teile = tag.split("-").map(Number);
  return new Date(teile[0], teile[1] - 1, teile[2], 23, 59, 59, 999).toLocaleDateString("de");
}`;

/** Die Zeile der Kontenliste, die diesen Text trägt — Wert, Überlauf und Geometrie. */
const ZEILE = `(n) => {
  const z = [...document.querySelectorAll('[data-einst="zeile"]')].find((e) => (e.textContent || "").includes(n));
  if (!z) return null;
  const wert = z.querySelector('[data-einst="wert"]');
  const label = z.querySelector('[data-einst="label"]');
  const zr = z.getBoundingClientRect();
  const lr = label ? label.getBoundingClientRect() : zr;
  return {
    wert: (wert ? wert.textContent : "") || "",
    zeileUeberlauf: z.scrollWidth - z.clientWidth,
    seiteUeberlauf: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    labelRechts: Math.round(lr.right),
    zeileRechts: Math.round(zr.right),
  };
}`;

/** Ein geschützter Abruf AUS DER SEITE HERAUS — mit den Keksen genau dieses Profils. */
const GESCHUETZTER_ABRUF = `() => fetch("/api/kos", { credentials: "include" })
  .then((r) => r.text().then((t) => ({ status: r.status, rumpf: t.slice(0, 4000) })))
  .catch((e) => ({ status: -1, rumpf: String(e) }))`;

export interface Zeilenbefund {
  wert: string;
  zeileUeberlauf: number;
  seiteUeberlauf: number;
  labelRechts: number;
  zeileRechts: number;
}

export interface WegAufbau {
  browser: Browser;
  strecke: Strecke;
  /** Die API-Sitzung des Admins — NUR zum Nachsehen, nie als Abkürzung für einen Schritt des Weges. */
  adminApi: Sitzung;
  adminEmail: string;
  gastName: string;
  gastEmail: string;
  titel: string;
  /** Der Tag, auf den befristet wird, und der Tag, auf den verlängert wird (`YYYY-MM-DD`). */
  fristTag: string;
  verlaengerungsTag: string;
  vergangenerTag: string;
}

export interface WegBefund {
  gastId: string;
  zeileNachAnlage: Zeilenbefund;
  nachbarWert: string;
  erwarteteAnzeige: string;
  gesperrterAbruf: { status: number; rumpf: string };
  tastatur: Record<string, number>;
}

/**
 * DER GANZE WEG, in der Reihenfolge, in der ihn ein Mensch geht.
 *
 * Anlegen (Formular, Tastatur, 390 px) → Anmelden im ZWEITEN Profil → Arbeiten → Ablauf über die
 * Fläche des Admins → der nächste Schritt des Gastes ist gesperrt → Verlängern über dieselbe
 * Fläche → erneut anmelden → weiterarbeiten.
 *
 * Alles an EINER Instanz, mit zwei getrennten Browserprofilen. Welche Ablagen darunter liegen,
 * entscheidet der Aufrufer — das ist der einzige Unterschied zwischen dem Tor-Lauf und dem
 * PostgreSQL-Lauf.
 */
export async function fahreDenGanzenWeg(a: WegAufbau): Promise<WegBefund> {
  const basis = a.strecke.basis;
  const tastatur: Record<string, number> = {};
  const adminProfil = await profil(a.browser);
  const gastProfil = await profil(a.browser);
  const spaeterProfil = await profil(a.browser);
  // JOB 4265 · RUNDE 2: je ein eigenes, frisches Profil für die beiden anderen Sprachen. Sie werden
  // hier oben angelegt, damit der `finally`-Zweig sie unter allen Umständen wieder schliesst — ein
  // Kontext, der an einem gescheiterten Fall hängenbliebe, hielte Chromium am Leben.
  const sprachProfile = new Map<Sprache, { kontext: Kontext; seite: Seite }>();
  for (const sprache of ANDERE_SPRACHEN) {
    sprachProfile.set(sprache, await profil(a.browser, SCHMAL, sprache));
  }
  try {
    // ══ 1. Der Admin meldet sich an seiner Fläche an. ══════════════════════════════════════════
    const adminSeite = adminProfil.seite;
    await anmelden(adminSeite, basis, a.adminEmail, PASSWORT, "anmeldungAdmin", tastatur);
    await warte(
      adminSeite,
      `() => !document.querySelector("#auth-email")`,
      "die Anmeldung des Admins trägt",
    );

    // ══ 2. Anlegen — EIN Formular, Rolle UND Frist, bei 390 px, mit der Tastatur. ══════════════
    await adminSeite.goto(`${basis}/admin?bereich=konten&detail=nutzerNeu`, {
      waitUntil: "domcontentloaded",
    });
    const karte = `[data-testid="detail-nutzer-neu"]`;
    await warte(adminSeite, "(s) => !!document.querySelector(s)", "Anlegekarte", karte);
    expect(
      await adminSeite.evaluate<number>(
        fn("() => document.documentElement.scrollWidth - document.documentElement.clientWidth"),
      ),
      "die Anlegekarte läuft bei 390 px seitlich über",
    ).toBeLessThanOrEqual(0);

    // DAS ERSTE FELD WIRD PER TAB ERREICHT, NICHT ANGEKLICKT (BENs Korrekturpflicht 1 der Runde 2).
    // Bis hierher stand hier `page.click` — und damit hing der ganze Tastaturweg an einem Mausklick.
    // BENs Mutation `tabIndex={-1}` am Namensfeld liess den Fall deshalb grün.
    tastatur.namensfeld = await tippeMitTastatur(
      adminSeite,
      `${karte} input`,
      a.gastName,
      "Name (Anlegekarte)",
    );
    // Die drei folgenden Felder in der Reihenfolge des Formulars — jedes mit sichtbarem Fokus.
    for (const [feld, wert] of [
      ["E-Mail (Anlegekarte)", a.gastEmail],
      ["Passwort (Anlegekarte)", PASSWORT],
      ["Passwortwiederholung (Anlegekarte)", PASSWORT],
    ] as const) {
      await adminSeite.keyboard.press("Tab");
      await fokusMussSichtbarSein(adminSeite, feld);
      await adminSeite.keyboard.type(wert);
    }
    // Die Rolle: von der Vorgabe „Experte" (ROLES[1]) eine Stufe hinauf zu „Betrachter" (ROLES[0]),
    // mit der Pfeiltaste an der nativen Auswahl.
    tastatur.rollenauswahl = await tabBisZu(adminSeite, `${karte} select`, 20);
    await fokusMussSichtbarSein(adminSeite, "Rollenauswahl");
    await adminSeite.keyboard.press("ArrowUp");
    expect(
      await adminSeite.evaluate<string>(
        fn(`(s) => (document.querySelector(s + " select") || {}).value || ""`),
        karte,
      ),
      "die per Tastatur gewählte Rolle",
    ).toBe("viewer");

    // Die Befristung öffnen — per Tab und Enter, nicht per `click()`.
    tastatur.befristungOeffnen = await tastaturAusloesen(adminSeite, "Befristung setzen");
    await warte(
      adminSeite,
      `(s) => !!document.querySelector(s + " input[type=date]")`,
      "die Datumseingabe der Anlage",
      karte,
    );
    tastatur.datumsfeldAnlage = await tabBisZu(adminSeite, `${karte} input[type=date]`, 150, true);
    expect(
      await adminSeite.evaluate<boolean>(fn(FOKUS_SICHTBAR)),
      "das Datumsfeld der Anlage zeigt keinen sichtbaren Fokus",
    ).toBe(true);
    await tippeDatumMitTastatur(
      adminSeite,
      `${karte} input[type=date]`,
      a.fristTag,
      "Datumsfeld der Anlage",
    );

    tastatur.anlegen = await tastaturAusloesen(adminSeite, "Anlegen");

    // ══ 3. Die Frist steht an SEINER Zeile — mit Tag, Monat und Jahr. ══════════════════════════
    await warte(
      adminSeite,
      `(n) => [...document.querySelectorAll('[data-einst="zeile"]')].some((z) => (z.textContent || "").includes(n))`,
      "die Kontenliste führt den neuen Gast",
      a.gastName,
      45_000,
    );
    const erwarteteAnzeige = await adminSeite.evaluate<string>(fn(TAG_ANZEIGE), a.fristTag);
    const zeileNachAnlage = await adminSeite.evaluate<Zeilenbefund | null>(fn(ZEILE), a.gastName);
    expect(zeileNachAnlage, "die Zeile des Gastes fehlt").not.toBeNull();
    const zeile = zeileNachAnlage as Zeilenbefund;
    expect(zeile.wert, "die Zeile nennt die Rolle nicht").toContain("Betrachter");
    expect(zeile.wert, "die Zeile nennt die Befristung nicht").toContain("befristet bis");
    // VOLLSTÄNDIGES Datum, nicht nur das Jahr (BEN, Prüflücke 6 der Runde 1): ein Test, der nur
    // „2031" liest, bliebe grün, wenn Tag und Monat vertauscht oder verschoben wären.
    expect(zeile.wert, `die Zeile zeigt nicht den gewählten Tag ${erwarteteAnzeige}`).toContain(
      erwarteteAnzeige,
    );
    // Der Nachbar bleibt unbefristet — sonst wäre oben auch ein Produkt erfüllt, das jeder Zeile
    // dieselbe Frist anschriebe.
    const nachbar = await adminSeite.evaluate<Zeilenbefund | null>(fn(ZEILE), "Admin");
    expect(nachbar, "die Zeile des Admins fehlt").not.toBeNull();
    expect((nachbar as Zeilenbefund).wert, "der Nachbar trägt eine Befristung").not.toContain(
      "befristet bis",
    );

    const gastId = await gastKennung(a);

    // ══ 4. Der Gast meldet sich in SEINEM eigenen, frischen Profil an und arbeitet. ════════════
    const gastSeite = gastProfil.seite;
    await gastSeite.goto(`${basis}/`, { waitUntil: "domcontentloaded" });
    await warte(
      gastSeite,
      `() => !!document.querySelector("#auth-email")`,
      "Anmeldemaske des Gastes",
    );
    expect(
      (await gastProfil.kontext.cookies()).some((k) => k.name === "kw_session"),
      "ein frisches Profil trägt bereits einen Sitzungskeks",
    ).toBe(false);
    await anmelden(gastSeite, basis, a.gastEmail, PASSWORT, "anmeldungGast", tastatur);
    await warte(
      gastSeite,
      `() => !document.querySelector("#auth-email")`,
      "die Anmeldung des Gastes trägt",
    );
    expect(
      (await gastProfil.kontext.cookies()).some((k) => k.name === "kw_session"),
      "das Gastprofil hat keinen eigenen Sitzungskeks bekommen",
    ).toBe(true);
    await gastSeite.goto(`${basis}/bibliothek`, { waitUntil: "domcontentloaded" });
    await warte(
      gastSeite,
      "(t) => document.body.innerText.includes(t)",
      "der Gast sieht den Bestand in der Bibliothek",
      a.titel,
      45_000,
    );

    // ══ 5. Der Admin beendet die Frist über SEINE Fläche — wieder mit der Tastatur. ════════════
    await adminSeite.goto(`${basis}/admin?bereich=konten`, { waitUntil: "domcontentloaded" });
    await warte(
      adminSeite,
      `(n) => [...document.querySelectorAll('[data-einst="zeile"]')].some((z) => (z.textContent || "").includes(n))`,
      "die Kontenliste führt den Gast",
      a.gastName,
      45_000,
    );
    tastatur.zeileOeffnen = await tastaturAusloesen(adminSeite, a.gastName);
    await warte(
      adminSeite,
      `() => !!document.querySelector('[data-einst="gastfrist-stand"]')`,
      "die Kontokarte mit dem Fristenstand",
    );
    tastatur.fristBeenden = await fristSetzen(adminSeite, a.vergangenerTag, tastatur, "beenden");
    await warte(
      adminSeite,
      `() => (document.querySelector('[data-einst="gastfrist-stand"]')?.textContent || "").includes("Abgelaufen am")`,
      "die Karte sagt: abgelaufen",
      undefined,
      45_000,
    );

    // ══ 6. Der nächste Schritt des Gastes ist gesperrt — Fläche UND geschützter Abruf. ════════
    await gastSeite.reload({ waitUntil: "domcontentloaded" });
    await warte(
      gastSeite,
      `() => !!document.querySelector("#auth-email")`,
      "der Gast steht wieder vor der Anmeldemaske",
      undefined,
      45_000,
    );
    expect(
      await gastSeite.evaluate<string>(fn(LIES_TEXT)),
      "geschützter Inhalt steht noch auf der Seite — auch aus dem Zwischenspeicher darf er nicht",
    ).not.toContain(a.titel);
    // BEN, Prüflücke 6: die Maske allein belegt nur die ANSICHT. Hier fragt das Gastprofil den
    // geschützten Weg SELBST, mit genau seinen Keksen — Status und Rumpf werden gelesen.
    const gesperrterAbruf = await gastSeite.evaluate<{ status: number; rumpf: string }>(
      fn(GESCHUETZTER_ABRUF),
    );
    expect(
      [401, 403],
      `der geschützte Abruf aus dem Gastprofil antwortete ${gesperrterAbruf.status}: ${gesperrterAbruf.rumpf.slice(0, 400)}`,
    ).toContain(gesperrterAbruf.status);
    expect(gesperrterAbruf.rumpf, "der Rumpf trägt geschützten Inhalt").not.toContain(a.titel);

    // ══ 6b. UND ER LIEST, WAS MIT SEINEM ZUGANG IST — im echten Browser. ══════════════════════
    //
    // RUNDE 3, BENs KORREKTURPFLICHT 2: Dieser Nachweis stand in Runde 1 als Ende von C4 da und ist
    // beim Zusammenführen zu EINEM Weg in Runde 2 verlorengegangen — die Rückgabe behauptete ihn
    // trotzdem weiter. Er steht jetzt wieder hier, an der Stelle, an der ein Mensch ihn erlebt:
    // der Gast versucht sich neu anzumelden und bekommt den ABLAUFsatz, nicht irgendeinen Fehler.
    //
    // DER SOLLWERT KOMMT AUS DEM KATALOG (`MELDUNGEN`), nicht aus einer hier eingetippten Abschrift
    // — dieselbe Regel wie in `tests/gast-ablauf-anmeldemaske/…:27-30`. Und er wird gegen den
    // NACHBARSATZ abgegrenzt: „noch nicht freigegeben" wäre hier eine Unwahrheit, denn dieses Konto
    // IST freigegeben (JOB 3756, und der BEN-Neufund aus JOB 4011).
    await anmelden(
      gastSeite,
      basis,
      a.gastEmail,
      PASSWORT,
      "anmeldungGastNachAblauf",
      tastatur,
      false,
    );
    await warte(
      gastSeite,
      "(t) => document.body.innerText.includes(t)",
      `der abgewiesene Gast liest „${MELDUNGEN.ACCESS_EXPIRED.de}"`,
      MELDUNGEN.ACCESS_EXPIRED.de,
      45_000,
    );
    const maskentext = await gastSeite.evaluate<string>(fn(LIES_TEXT));
    expect(
      maskentext,
      "die Maske behauptet, das Konto sei nie freigegeben worden — es ist aber abgelaufen",
    ).not.toContain(MELDUNGEN.NOT_APPROVED.de);
    expect(maskentext, "und geschützter Inhalt steht auch hier nicht").not.toContain(a.titel);

    // ══ 6c. UND ER LIEST, WAS ER JETZT TUN KANN. ══════════════════════════════════════════════
    //
    // JOB 4265: Bis hierher las der Gast die LAGE („Ihr Zugang ist abgelaufen.") und sonst nichts —
    // er wusste, was ist, und nicht, was er tun kann. Seit 4265 nennt der Katalogsatz beides, und
    // der Nachweis dafür gehört an DIESE Stelle: nicht an den Katalog, den kein Mensch liest,
    // sondern an den Seitentext eines echten Browsers, in dem ein abgewiesener Gast steht.
    //
    // Der Handlungsteil wird aus dem Katalogsatz GESCHNITTEN und nicht danebengetippt (dieselbe
    // Regel wie oben). Dass er dabei nicht leer wird, ist eine eigene Zusicherung: ein `includes("")`
    // wäre immer wahr, und der Nachweis bliebe grün, während die Handlung aus dem Satz verschwände.
    const handlung = handlungsteil(MELDUNGEN.ACCESS_EXPIRED.de);
    expect(
      handlung,
      "der Ablaufsatz des Katalogs nennt keine Handlung mehr — dann misst dieser Nachweis nichts",
    ).not.toBe("");
    expect(
      maskentext,
      `der abgewiesene Gast liest die Lage, aber nicht die Handlung „${handlung}"`,
    ).toContain(handlung);
    // UNGEKÜRZT: der ganze Satz am Stück, nicht zwei Bruchstücke, die zufällig beide vorkommen.
    // Eine Maske, die den Serversatz nach dem ersten Punkt abschnitte, käme hier nicht durch.
    expect(
      maskentext,
      "der Satz steht nicht am Stück auf der Seite — er ist gekürzt oder auseinandergerissen",
    ).toContain(MELDUNGEN.ACCESS_EXPIRED.de);
    // Und der längere Satz sprengt die schmalste Kante nicht. Ein Text, der bei 390 px seitlich
    // hinausläuft, ist für den, der ihn braucht, halb unlesbar.
    expect(
      await gastSeite.evaluate<number>(
        fn("() => document.documentElement.scrollWidth - document.documentElement.clientWidth"),
      ),
      "die Anmeldemaske läuft mit dem Ablaufsatz bei 390 px seitlich über",
    ).toBeLessThanOrEqual(0);

    // ══ 6d. UND ER LIEST IHN AUCH AUF ENGLISCH UND NIEDERLÄNDISCH — im echten Browser. ════════
    //
    // RUNDE 2, BENs KORREKTURPFLICHT 1: Bis hierher las nur ein DEUTSCHES Profil den Satz im
    // Browser; EN und NL hingen an Socket- und jsdom-Nachweisen. Die sagen aber nichts über die
    // letzte Station: ob die gebaute Fläche die Sprachwahl überhaupt an den Server weiterreicht
    // und den fremdsprachigen Satz ungekürzt anzeigt. Genau das wird hier gemessen.
    //
    // DIESELBE LAGE, NICHT EINE NACHGESTELLTE: die Frist dieses Kontos ist oben über die Fläche
    // des Admins abgelaufen und ist es noch (Abschnitt 7 verlängert erst danach). Jedes Profil
    // meldet sich mit denselben Zugangsdaten an derselben Instanz an — es ist derselbe Gast,
    // nur mit einer anderen Spracheinstellung.
    for (const sprache of ANDERE_SPRACHEN) {
      const eintrag = sprachProfile.get(sprache);
      if (!eintrag) {
        throw new Error(`JOB 4265: kein Browserprofil für die Sprache „${sprache}" angelegt.`);
      }
      const satz = MELDUNGEN.ACCESS_EXPIRED[sprache];
      const handlungFremd = handlungsteil(satz);
      // Wie oben in 6c: ein leerer Handlungsteil machte jede `toContain`-Zusicherung darunter
      // wahr, und der Nachweis bliebe grün, während die Handlung aus dem Satz verschwände.
      expect(
        handlungFremd,
        `der Ablaufsatz des Katalogs nennt in „${sprache}" keine Handlung mehr — dann misst dieser Nachweis nichts`,
      ).not.toBe("");
      const fremdSeite = eintrag.seite;
      await anmelden(
        fremdSeite,
        basis,
        a.gastEmail,
        PASSWORT,
        `anmeldungGastNachAblauf_${sprache}`,
        tastatur,
      );
      // ERST die Fläche in dieser Sprache, DANN der Satz: steht `<html lang>` falsch, ist nicht der
      // Satz schuld, sondern die Sprachwahl kam nie an — und die Meldung soll das auch sagen.
      await warte(
        fremdSeite,
        "(s) => document.documentElement.lang === s",
        `die Fläche des Gastprofils steht auf „${sprache}"`,
        sprache,
        45_000,
      );
      await warte(
        fremdSeite,
        "(t) => document.body.innerText.includes(t)",
        `der abgewiesene Gast liest in „${sprache}" den ganzen Satz „${satz}"`,
        satz,
        45_000,
      );
      const fremdText = await fremdSeite.evaluate<string>(fn(LIES_TEXT));
      // Der Handlungsteil eigens: `satz` oben enthält ihn zwar, aber diese Zusicherung benennt
      // beim Scheitern GENAU das Stück, das fehlt, statt nur „der Satz stimmt nicht".
      expect(
        fremdText,
        `der abgewiesene Gast liest in „${sprache}" die Lage, aber nicht die Handlung „${handlungFremd}"`,
      ).toContain(handlungFremd);
      // Die Abgrenzung gegen den Nachbarn gilt in jeder Sprache: dieses Konto IST freigegeben.
      expect(
        fremdText,
        `die Maske behauptet in „${sprache}", das Konto sei nie freigegeben worden — es ist aber abgelaufen`,
      ).not.toContain(MELDUNGEN.NOT_APPROVED[sprache]);
      // Und die Sprache ist wirklich gewechselt, nicht bloss der deutsche Satz mit lang="en" davor.
      expect(
        fremdText,
        `in „${sprache}" steht der DEUTSCHE Ablaufsatz auf der Seite — die Sprachwahl kam nicht bis zum Server`,
      ).not.toContain(MELDUNGEN.ACCESS_EXPIRED.de);
      expect(
        fremdText,
        `geschützter Inhalt steht in „${sprache}" vor dem gesperrten Gast`,
      ).not.toContain(a.titel);
      // Der längere Satz sprengt die schmalste Kante auch in der längsten Übersetzung nicht.
      expect(
        await fremdSeite.evaluate<number>(
          fn("() => document.documentElement.scrollWidth - document.documentElement.clientWidth"),
        ),
        `die Anmeldemaske läuft mit dem Ablaufsatz in „${sprache}" bei 390 px seitlich über`,
      ).toBeLessThanOrEqual(0);
    }

    // ══ 7. Verlängern — über dieselbe Fläche, mit der Tastatur. ════════════════════════════════
    tastatur.fristVerlaengern = await fristSetzen(
      adminSeite,
      a.verlaengerungsTag,
      tastatur,
      "verlaengern",
    );
    await warte(
      adminSeite,
      `() => (document.querySelector('[data-einst="gastfrist-stand"]')?.textContent || "").includes("Gültig bis")`,
      "die Karte sagt wieder: gültig bis",
      undefined,
      45_000,
    );

    // ══ 8. Und der Gast kommt wirklich zurück herein und arbeitet weiter. ═════════════════════
    const spaet = spaeterProfil.seite;
    await anmelden(spaet, basis, a.gastEmail, PASSWORT, "anmeldungGastVerlaengert", tastatur);
    await warte(
      spaet,
      `() => !document.querySelector("#auth-email")`,
      "die erneute Anmeldung des Gastes trägt",
      undefined,
      45_000,
    );
    await spaet.goto(`${basis}/bibliothek`, { waitUntil: "domcontentloaded" });
    await warte(
      spaet,
      "(t) => document.body.innerText.includes(t)",
      "der verlängerte Gast arbeitet weiter",
      a.titel,
      45_000,
    );

    return {
      gastId,
      zeileNachAnlage: zeile,
      nachbarWert: (nachbar as Zeilenbefund).wert,
      erwarteteAnzeige,
      gesperrterAbruf,
      tastatur,
    };
  } finally {
    await adminProfil.kontext.close();
    await gastProfil.kontext.close();
    await spaeterProfil.kontext.close();
    for (const { kontext } of sprachProfile.values()) {
      await kontext.close();
    }
  }
}

/**
 * Befristung ändern oder verlängern — öffnen, Tag setzen, speichern. Alles per Tab und Enter.
 *
 * Der Knopf heisst an einem bereits befristeten Konto „Befristung ändern oder verlängern"; die
 * Datumseingabe und „Befristung speichern" folgen. Nach jedem React-Neuaufbau beginnt der Tab-Weg
 * wieder am Dokumentanfang (`vonVorn`), sonst hinge die Zählung an der Vorgeschichte.
 */
async function fristSetzen(
  seite: Seite,
  tag: string,
  tastatur: Record<string, number>,
  marke: string,
): Promise<number> {
  const schritte = await tastaturAusloesen(seite, "Befristung ändern oder verlängern");
  await warte(seite, `() => !!document.querySelector('input[type=date]')`, `Datumsfeld (${marke})`);
  tastatur[`datumsfeld_${marke}`] = await tabBisZu(seite, "input[type=date]", 150, true);
  expect(
    await seite.evaluate<boolean>(fn(FOKUS_SICHTBAR)),
    `das Datumsfeld (${marke}) zeigt keinen sichtbaren Fokus`,
  ).toBe(true);
  await tippeDatumMitTastatur(seite, "input[type=date]", tag, `Datumsfeld (${marke})`);
  tastatur[`speichern_${marke}`] = await tastaturAusloesen(seite, "Befristung speichern");
  return schritte;
}

/** Die Kennung des Gastes — nachgesehen, nicht geraten. Kein Schritt des Weges, nur ein Blick. */
async function gastKennung(a: WegAufbau): Promise<string> {
  const antwort = await a.adminApi.sende("GET", "/api/users");
  const liste = antwort.json as { id: string; email: string }[];
  const gast = liste.find((u) => u.email === a.gastEmail);
  if (!gast) {
    throw new Error(
      `JOB 4223: der über die Fläche angelegte Gast ${a.gastEmail} fehlt im Bestand.`,
    );
  }
  return gast.id;
}
