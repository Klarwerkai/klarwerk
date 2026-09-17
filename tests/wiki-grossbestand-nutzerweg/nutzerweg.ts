// ================================================================================================
// JOB 4271 · DER BEDIENWEG IM GROSSBESTAND — SUCHEN, SEHEN, MIT DER TASTATUR ÖFFNEN.
// ================================================================================================
//
// WAS HIER NEU IST UND WAS GELIEHEN. Die Browservorrichtung wird NICHT zum zweiten Mal gebaut:
// Chromiumstart, frisches Profil, die gebaute Fläche vor dem Horchen, der Tab-Weg und das Warten
// kommen wörtlich aus `tests/gast-nutzerweg/browserweg.ts` (JOB 4223) — dieselbe Datei, dieselben
// Funktionen, kein zweiter Weg. Neu ist ausschliesslich, was es dort nicht gibt:
//
//   · das SUCHFELD bedienen und auf das Ende der Auffrischung warten (die Suche ist entprellt,
//     `LIBRARY_SEARCH_DEBOUNCE_MS = 300`; auf eine Frist zu warten wäre genau die Halbheit, die
//     Auftrag §8.6 c ausschliesst),
//   · eine ZEILE über ihre Kennung ansteuern statt über ihren Text. `tabBisText` sucht das
//     Bedienelement an seiner BESCHRIFTUNG; im Großbestand stehen 20 Ablenker mit fast demselben
//     Titel, und eine Beschriftungssuche träfe irgendeinen von ihnen. Gesucht ist GENAU die Zeile
//     mit der vorab festgelegten Kennung.
//
// WARUM DIE FOKUSPRÜFUNG HIER EIN ZWEITES MAL STEHT: `browserweg.ts` hält sie in der privaten
// Konstante `FOKUS_SICHTBAR` und der privaten Funktion `fokusMussSichtbarSein` — beide werden nicht
// exportiert. `browserweg.ts` liegt ausserhalb der Zielpfade dieses Auftrags; ein Export dort wäre
// ein Diff an fremdem Code. Die Regel steht deshalb hier ein zweites Mal, wörtlich gleich
// (Umriss ODER Schatten am berechneten Stil), und die Doppelung ist in der Rückgabe benannt statt
// verschwiegen.
import { expect } from "vitest";
import {
  type Browser,
  type Kontext,
  LIES_TEXT,
  type Seite,
  fn,
  profil,
  tippeMitTastatur,
  warte,
} from "../gast-nutzerweg/browserweg";

export const JOB = "[KLARWERK] JOB 4271";

/** Ein Schreibtisch, kein Telefon: der Großbestand wird am breiten Fenster gemessen. */
export const BREIT = { width: 1440, height: 900 };

// ------------------------------------------------------------------------------------------------
// FOKUS — die zweite Fassung der Regel aus browserweg.ts (Begründung im Kopf).
// ------------------------------------------------------------------------------------------------
const FOKUS_SICHTBAR = `() => {
  const a = document.activeElement;
  if (!a) return false;
  const s = getComputedStyle(a);
  const umriss = s.outlineStyle !== "none" && Number.parseFloat(s.outlineWidth || "0") > 0;
  const schatten = s.boxShadow !== "none" && s.boxShadow !== "";
  return umriss || schatten;
}`;

const FOKUS_DIAGNOSE = `() => {
  const a = document.activeElement;
  if (!a) return "aktiv: (nichts)";
  const s = getComputedStyle(a);
  return [
    "aktiv: <" + a.tagName.toLowerCase() + ">",
    "testid=" + (a.getAttribute("data-testid") || "(keine)"),
    "tabindex=" + (a.getAttribute("tabindex") ?? "(keiner)"),
    "outline=" + s.outlineStyle + " " + s.outlineWidth,
    "boxShadow=" + String(s.boxShadow).slice(0, 60),
  ].join(" · ");
}`;

const FOKUS_ZURUECKSETZEN =
  "() => { const a = document.activeElement; if (a && a.blur) { a.blur(); } return true; }";

export interface Tastaturbefund {
  schritte: number;
  fokusSichtbar: boolean;
  diagnose: string;
}

/** Tab drücken, bis das aktive Element der Selektor ist — und den Fokusstand MESSEN, nicht werten. */
export async function tabBisSelektor(
  seite: Seite,
  selektor: string,
  was: string,
  hoechstens = 1200,
): Promise<Tastaturbefund> {
  await seite.evaluate<boolean>(fn(FOKUS_ZURUECKSETZEN));
  const treffer = "(sel) => { const a = document.activeElement; return !!a && a.matches(sel); }";
  for (let schritte = 1; schritte <= hoechstens; schritte += 1) {
    await seite.keyboard.press("Tab");
    if (await seite.evaluate<boolean>(fn(treffer), selektor)) {
      return {
        schritte,
        fokusSichtbar: await seite.evaluate<boolean>(fn(FOKUS_SICHTBAR)),
        diagnose: await seite.evaluate<string>(fn(FOKUS_DIAGNOSE)),
      };
    }
  }
  throw new Error(
    `${JOB}: „${was}" (${selektor}) war in ${hoechstens} Tab-Anschlägen nicht erreichbar — das ist die Halbheit „nur mit der Maus". Zuletzt aktiv: ${await seite.evaluate<string>(fn(FOKUS_DIAGNOSE))}`,
  );
}

/**
 * Tab drücken, bis das aktive Element der Selektor ist — mit SICHTBAREM Fokus — und dann Enter.
 *
 * `hoechstens` ist bewusst gross: eine Trefferliste mit 161 Zeilen trägt gut 320 erreichbare
 * Bedienelemente (je Zeile der Zeilenknopf und der Vorschau-Umschalter). Ein Deckel von 150 wie in
 * `browserweg.ts` wäre hier kein Befund über die Bedienbarkeit, sondern über die Deckelhöhe.
 */
export async function tastaturOeffnen(
  seite: Seite,
  selektor: string,
  was: string,
  hoechstens = 1200,
): Promise<number> {
  const befund = await tabBisSelektor(seite, selektor, was, hoechstens);
  expect(
    befund.fokusSichtbar,
    `„${was}" zeigt keinen sichtbaren Fokus, obwohl es gerade per Tastatur angesteuert wurde — ${befund.diagnose}`,
  ).toBe(true);
  await seite.keyboard.press("Enter");
  return befund.schritte;
}

/**
 * Tab hin und Enter — die Fokusprüfung wird MITGEGEBEN statt hier entschieden.
 *
 * `tastaturOeffnen` wertet den Fokus selbst und bricht ab; diese Fassung reicht den `Tastaturbefund`
 * an den Aufrufer zurück. Gebraucht wird sie für die Aufklapper, über die Quelle und Fassung
 * sichtbar werden (Lieferung 4): dort soll der gemessene Fokusstand in einem EIGENEN, benannten Fall
 * stehen (G6) statt mitten im Leseweg zu verschwinden. Was Lieferung 3 zusagt — den Treffer per
 * Tastatur mit sichtbarem Fokus zu öffnen — geht weiterhin ausnahmslos über `tastaturOeffnen`.
 */
export async function tastaturBetaetigen(
  seite: Seite,
  selektor: string,
  was: string,
): Promise<Tastaturbefund> {
  const befund = await tabBisSelektor(seite, selektor, was);
  await seite.keyboard.press("Enter");
  return befund;
}

// ------------------------------------------------------------------------------------------------
// DER ZUSTAND DER TREFFERLISTE — gelesen, nicht aus dem Fehlen von Elementen geschlossen.
// ------------------------------------------------------------------------------------------------
//
// DIE EINE FRISCHEMARKE, die diese Fläche nach aussen trägt: der Fuss zeigt eine ZAHL nur dann,
// wenn der Abruf erfolgreich, nicht fehlgeschlagen und nicht offline angehalten ist
// (`BibliothekFlaeche.tsx:1503`, `gesamt={frisch && … ? sorted.length : null}`); sonst steht dort
// `lib.liste.eintraegeUnbekannt`. Eine leere Liste aus einem FEHLER kann damit nie als „nichts
// gefunden" gelesen werden — genau die Zusage aus Auftrag §9.
const LISTENSTAND = `() => {
  const fuss = document.querySelector('[data-testid="bib-fuss"]');
  const text = (fuss ? fuss.textContent : "") || "";
  const ziffern = text.replace(/[^0-9]/g, "");
  const zeilen = [...document.querySelectorAll('[data-testid="bib-zeile"]')];
  const feld = document.querySelector('[data-testid="bib-suche"]');
  return {
    fussText: text.trim(),
    // Steht im Fuss der Gedankenstrich (unbekannt), gibt es keine Ziffer: dann ist die Liste NICHT
    // frisch, und zaehler bleibt null. Genau daran haengt jede negative Aussage dieses Auftrags.
    zaehler: ziffern.length > 0 ? Number(ziffern) : null,
    zeilen: zeilen.length,
    kennungen: zeilen.map((z) => z.getAttribute("data-bib-id") || ""),
    leerSatz: (document.querySelector('[data-testid="bib-leer"]')?.textContent || "").trim(),
    offline: !!document.querySelector('[data-testid="bib-offline"]'),
    suchfeld: feld ? feld.value : "(kein Suchfeld)",
  };
}`;

export interface Listenstand {
  fussText: string;
  zaehler: number | null;
  zeilen: number;
  kennungen: string[];
  leerSatz: string;
  offline: boolean;
  suchfeld: string;
}

export function listenstand(seite: Seite): Promise<Listenstand> {
  return seite.evaluate<Listenstand>(fn(LISTENSTAND));
}

/**
 * Die Ausgangslage: der ganze Bestand steht da, frisch abgerufen.
 *
 * Gewartet wird auf die ZAHL im Fuss — nicht auf eine Frist und nicht auf „irgendeine Zeile".
 */
export async function warteAufBestand(seite: Seite, mindestens: number): Promise<Listenstand> {
  await warte(
    seite,
    `(n) => {
      const fuss = document.querySelector('[data-testid="bib-fuss"]');
      const ziffern = ((fuss ? fuss.textContent : "") || "").replace(/[^0-9]/g, "");
      return ziffern.length > 0 && Number(ziffern) >= n
        && document.querySelectorAll('[data-testid="bib-zeile"]').length > 0;
    }`,
    `die Bibliothek zeigt mindestens ${mindestens} Einträge (frisch abgerufen)`,
    mindestens,
    120_000,
  );
  return listenstand(seite);
}

// ------------------------------------------------------------------------------------------------
// DIE ABBRUCHBEDINGUNG DER SUCHE — RUNDE 2, BENs PRÜFLÜCKE 6.
// ------------------------------------------------------------------------------------------------
//
// WAS IN RUNDE 1 ZU SCHWACH WAR. Gewartet wurde auf drei DOM-Aussagen: der Fuss trägt eine Zahl, das
// Suchfeld trägt den getippten Begriff, und die Zahl im Fuss stimmt mit der Zahl der gezeichneten
// Zeilen überein. BEN hat zu Recht gesagt: das bindet die Trefferzahl NICHT an die abgeschlossene
// Anfrage. Steht aus einer vorigen Suche eine kurze, in sich stimmige Liste da, während die neue
// Anfrage noch läuft, passt alles drei — und gemessen würde ein Zwischenstand.
//
// WAS JETZT DAZUKOMMT, und warum es die Lücke wirklich schliesst:
//
//   1 VOR dem Tippen wird die Ressourcen-Zeitleiste GELEERT (`clearResourceTimings`) und ihr Puffer
//     hochgesetzt. Danach ist jeder Eintrag darin nachweislich von DIESEM Tastendruck an entstanden.
//   2 Gewartet wird darauf, dass in dieser Zeitleiste eine ABGESCHLOSSENE Antwort (`responseEnd > 0`)
//     auf GENAU diese Abfrage steht — `/api/library/search?q=<begriff>`, so wie `qs()` sie baut
//     (`apps/web/src/api/endpoints.ts:106-115`, einziger Parameter, weil die Fläche mit
//     `EMPTY_LIBRARY_FILTER` fragt). Eine laufende Anfrage hat diesen Eintrag noch nicht.
//   3 Und die drei DOM-Aussagen müssen danach DREIMAL HINTEREINANDER unverändert dastehen. Zwischen
//     „Antwort da" und „Antwort gezeichnet" liegt ein Renderzyklus; die Ruhezählung überbrückt ihn,
//     ohne auf eine Frist zu warten.
//
// Der Puffer muss geleert werden: die Vorgabegrösse ist 250 Einträge, und ist sie voll, nimmt der
// Browser KEINE neuen mehr auf (er verwirft nicht die alten). Ohne Schritt 1 fehlte bei einer langen
// Sitzung ausgerechnet der Eintrag, auf den gewartet wird.
const ZEITLEISTE_ZURUECKSETZEN = `() => {
  try {
    performance.setResourceTimingBufferSize(1000);
    performance.clearResourceTimings();
  } catch (e) {}
  delete window.__kw4271Ruhe;
  return true;
}`;

/** Wie oft die Liste unverändert dastehen muss, bevor sie als gezeichnet gilt. */
const RUHE = 3;

/** Die Abfrage, die die Fläche wirklich stellt — nicht geraten, sondern nach `qs()` gebaut. */
export function suchpfad(begriff: string): string {
  return `/api/library/search?q=${encodeURIComponent(begriff)}`;
}

/** Zeitleiste leeren und den Begriff mit echten Tastendrücken eingeben. */
async function tippeSuche(seite: Seite, begriff: string): Promise<number> {
  await seite.evaluate<boolean>(fn(ZEITLEISTE_ZURUECKSETZEN));
  return tippeMitTastatur(seite, '[data-testid="bib-suche"]', begriff, "Suchfeld");
}

/**
 * Suchen — echte Tastendrücke — und auf das ENDE der Auffrischung warten.
 *
 * Die Gleichheit von Zähler und Zeilenzahl gilt nur, solange die Trefferzahl unter dem
 * Anzeigefenster von 200 bleibt (`LIBRARY_RESULT_LIMIT`, `apps/web/src/lib/libraryDisplay.ts:3`).
 * Jede Suche dieses Auftrags liegt darunter; der Aufrufer gibt den Gesamtbestand mit, gegen den
 * „kleiner" gemessen wird.
 */
export async function sucheMitTastatur(
  seite: Seite,
  begriff: string,
  gesamtbestand: number,
  frist = 120_000,
): Promise<{ stand: Listenstand; tastaturschritte: number }> {
  const schritte = await tippeSuche(seite, begriff);
  await warte(
    seite,
    `([begriff, gesamt, pfad, ruhe]) => {
      const antwortDa = performance.getEntriesByType("resource").some(
        (e) => e.name.slice(-pfad.length) === pfad && e.responseEnd > 0,
      );
      if (!antwortDa) return false;
      const fuss = document.querySelector('[data-testid="bib-fuss"]');
      const ziffern = ((fuss ? fuss.textContent : "") || "").replace(/[^0-9]/g, "");
      if (ziffern.length === 0) return false;
      const zaehler = Number(ziffern);
      const feld = document.querySelector('[data-testid="bib-suche"]');
      if (!feld || feld.value !== begriff) return false;
      const zeilen = document.querySelectorAll('[data-testid="bib-zeile"]').length;
      if (!(zaehler < gesamt && zaehler === zeilen)) return false;
      const marke = begriff + "|" + zaehler + "|" + zeilen;
      const stand = window.__kw4271Ruhe;
      if (stand && stand.marke === marke) { stand.n += 1; } else { window.__kw4271Ruhe = { marke: marke, n: 1 }; }
      return window.__kw4271Ruhe.n >= ruhe;
    }`,
    `die Trefferliste zu „${begriff}" ist fertig aufgefrischt (abgeschlossene Antwort auf ${suchpfad(begriff)} in der Ressourcen-Zeitleiste, danach ${RUHE}× unveränderte Liste)`,
    [begriff, gesamtbestand, suchpfad(begriff), RUHE],
    frist,
  );
  return { stand: await listenstand(seite), tastaturschritte: schritte };
}

/**
 * Derselbe Weg, aber für die ERFOLGREICH LEERE Antwort.
 *
 * Gelesen wird der LEERSATZ (`bib-leer`), nicht das Fehlen von Zeilen — „nichts gefunden" ist eine
 * Tatsachenaussage über den Bestand und darf nie aus einem leeren DOM geschlossen werden. Und auch
 * hier hängt die Aussage an der ABGESCHLOSSENEN Antwort auf genau diese Abfrage: eine leere Liste,
 * die noch aus dem vorigen Stand stammt, ist kein Beleg.
 */
export async function sucheOhneTreffer(
  seite: Seite,
  begriff: string,
  frist = 120_000,
): Promise<Listenstand> {
  await tippeSuche(seite, begriff);
  await warte(
    seite,
    `([begriff, pfad, ruhe]) => {
      const antwortDa = performance.getEntriesByType("resource").some(
        (e) => e.name.slice(-pfad.length) === pfad && e.responseEnd > 0,
      );
      if (!antwortDa) return false;
      const feld = document.querySelector('[data-testid="bib-suche"]');
      if (!feld || feld.value !== begriff) return false;
      const leer = document.querySelector('[data-testid="bib-leer"]');
      if (!leer || document.querySelectorAll('[data-testid="bib-zeile"]').length !== 0) return false;
      const stand = window.__kw4271Ruhe;
      if (stand && stand.marke === begriff) { stand.n += 1; } else { window.__kw4271Ruhe = { marke: begriff, n: 1 }; }
      return window.__kw4271Ruhe.n >= ruhe;
    }`,
    `die Suche nach „${begriff}" sagt ausdrücklich: nichts gefunden (abgeschlossene Antwort auf ${suchpfad(begriff)}, danach ${RUHE}× unveränderter Leerstand)`,
    [begriff, suchpfad(begriff), RUHE],
    frist,
  );
  return listenstand(seite);
}

// ------------------------------------------------------------------------------------------------
// DIE GEÖFFNETE SEITE
// ------------------------------------------------------------------------------------------------

/** Den Treffer mit DIESER Kennung per Tastatur öffnen. */
export async function oeffneTreffer(seite: Seite, koId: string, tabDeckel = 1200): Promise<number> {
  const schritte = await tastaturOeffnen(
    seite,
    `[data-testid="bib-zeile"][data-bib-id="${koId}"]`,
    `die Trefferzeile ${koId}`,
    tabDeckel,
  );
  await warte(
    seite,
    `() => !!document.querySelector('[data-testid="bib-titel"]')`,
    "der geöffnete Eintrag zeigt seinen Titel",
    undefined,
    60_000,
  );
  return schritte;
}

const GEOEFFNET = `() => ({
  titel: (document.querySelector('[data-testid="bib-titel"]')?.textContent || "").trim(),
  text: (document.querySelector('[data-testid="bib-text"]')?.textContent || "").trim(),
  seitentext: document.body.innerText,
})`;

export interface Geoeffnet {
  titel: string;
  text: string;
  seitentext: string;
}

export function gelesen(seite: Seite): Promise<Geoeffnet> {
  return seite.evaluate<Geoeffnet>(fn(GEOEFFNET));
}

// ------------------------------------------------------------------------------------------------
// WAS WIRKLICH DASTEHT — RUNDE 2, BENs KORREKTURPFLICHT 1.
// ------------------------------------------------------------------------------------------------
//
// WAS IN RUNDE 1 ZU SCHWACH WAR, in BENs eigenen Worten: „vergleicht den Titel, aber nicht den
// sichtbaren Fliesstext mit PostgreSQL … Meine gegenteilige Handlungsanweisung passiert beide
// Prüfungen. Die Versionsprüfung sucht ausserdem lediglich `v1` als Teilzeichenfolge im gesamten
// Seitentext." Er hat den sichtbaren Text durch eine Anweisung ersetzt, die das Gegenteil sagt und
// das Suchwort behält — und der Nachweis blieb grün.
//
// DESHALB WIRD HIER NICHT MEHR „ENTHÄLT" GELESEN, SONDERN „IST":
//
//   · der Fliesstext kommt aus `[data-testid="bib-text"]` über `innerText` (nicht `textContent`:
//     das klebte `<p>A.</p><p>B.</p>` zu „A.B." zusammen und wäre nie mit der Spalte vergleichbar),
//   · die Quellen kommen aus den Chips `[data-testid="bib-quellen-chip"]`, ohne ihre laufende
//     Nummer (`${i+1} · ${label}`, `BibliothekLesen.tsx:3030`) — eine LISTE, die verglichen wird,
//   · die Fassung kommt aus dem Abschnitt `provenienz` (`MehrAbschnitte.tsx:1433,1469-1474`,
//     `ProvenanceLine` schreibt dort `v<n>`) und wird als ZAHL gelesen. „v1" irgendwo im Seitentext
//     ist keine Fassungsaussage: es steckt auch in „v12", und es steht auch in der Historie.
const LESESTAND = `() => {
  const norm = (s) => String(s == null ? "" : s).replace(/\\s+/g, " ").trim();
  const innen = (el) => norm(!el ? "" : (el.innerText != null ? el.innerText : el.textContent));
  const prov = document.querySelector('[data-bib-abschnitt="provenienz"]');
  const provText = innen(prov);
  const treffer = provText.match(/(?:^|[^A-Za-z0-9])v([0-9]+)(?![0-9])/);
  return {
    titel: innen(document.querySelector('[data-testid="bib-titel"]')),
    fliesstext: innen(document.querySelector('[data-testid="bib-text"]')),
    quellenChips: Array.prototype.slice
      .call(document.querySelectorAll('[data-testid="bib-quellen-chip"]'))
      .map((c) => innen(c).replace(/^[0-9]+ · /, "")),
    quellenAbschnitt: innen(document.querySelector('[data-bib-abschnitt="quellen"]')),
    provenienz: provText,
    fassung: treffer ? Number(treffer[1]) : null,
  };
}`;

export interface Lesestand {
  titel: string;
  fliesstext: string;
  quellenChips: string[];
  quellenAbschnitt: string;
  provenienz: string;
  /** `null` heisst: im Abschnitt „Provenienz" steht keine Fassungszahl — NICHT „Fassung 0". */
  fassung: number | null;
}

export function lesestand(seite: Seite): Promise<Lesestand> {
  return seite.evaluate<Lesestand>(fn(LESESTAND));
}

/**
 * Derselbe Normalisierer für die SPALTE — sonst verglichen wir zwei verschiedene Schreibweisen.
 *
 * Tags werden durch ein Leerzeichen ersetzt (nicht gelöscht): `</p><p>` ist ein Absatzwechsel, und
 * `innerText` macht daraus im Browser ebenfalls einen Zwischenraum.
 */
export function alsSichtbarerText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Ein Abruf AUS DER SEITE HERAUS, mit genau den Keksen dieses Profils.
 *
 * Er misst die zweite Hälfte von Lieferung 5: „nicht in der Liste" ist eine Aussage über das DOM,
 * nicht über den Transport. Was der Server diesem Menschen wirklich geschickt hat, steht im Rumpf.
 */
export function rohantwort(seite: Seite, pfad: string): Promise<{ status: number; rumpf: string }> {
  return seite.evaluate<{ status: number; rumpf: string }>(
    fn(
      `(pfad) => fetch(pfad, { credentials: "include" })
        .then((r) => r.text().then((t) => ({ status: r.status, rumpf: t })))
        .catch((e) => ({ status: -1, rumpf: String(e) }))`,
    ),
    pfad,
  );
}

/**
 * Die ersten `anzahl` Vorschau-Aufklapper der Liste öffnen — mit der Tastatur.
 *
 * Der Aufklapper je Zeile ist ein `<button aria-expanded>` (`KoSummaryDisclosure.tsx:56-58`) und
 * steht in der Tabulatorreihenfolge direkt hinter seinem Zeilenknopf. Gezählt wird, was wirklich
 * aufgegangen ist — nicht, wie oft Enter gedrückt wurde.
 */
export async function klappeVorschauenAuf(seite: Seite, anzahl: number): Promise<number> {
  await seite.evaluate<boolean>(fn(FOKUS_ZURUECKSETZEN));
  const istZu = `() => {
    const a = document.activeElement;
    return !!a && a.matches('button[aria-expanded="false"]');
  }`;
  const offen = `() => document.querySelectorAll('button[aria-expanded="true"]').length`;
  let geoeffnet = 0;
  for (let schritte = 1; schritte <= 2000 && geoeffnet < anzahl; schritte += 1) {
    await seite.keyboard.press("Tab");
    if (await seite.evaluate<boolean>(fn(istZu))) {
      await seite.keyboard.press("Enter");
      geoeffnet += 1;
    }
  }
  return Math.min(geoeffnet, await seite.evaluate<number>(fn(offen)));
}

/** Der ganze sichtbare Text der Seite — für die Aussagen „steht nicht da". */
export function seitentext(seite: Seite): Promise<string> {
  return seite.evaluate<string>(fn(LIES_TEXT));
}

// ------------------------------------------------------------------------------------------------
// ANMELDEN — dieselben fünf Schritte wie in browserweg.ts, aus seinen EXPORTIERTEN Bausteinen.
// ------------------------------------------------------------------------------------------------
//
// `browserweg.ts` hat diese Folge als private Funktion `anmelden`. Sie wird nicht exportiert, und
// die Datei liegt ausserhalb der Zielpfade. Hier steht deshalb dieselbe Folge — aber aus den
// EXPORTIERTEN Bausteinen derselben Datei (`tippeMitTastatur`, `warte`): kein zweiter Tab-Weg, kein
// zweiter Fokusbegriff, nur die Reihenfolge.
export async function anmelden(
  seite: Seite,
  basis: string,
  email: string,
  passwort: string,
): Promise<void> {
  await seite.goto(`${basis}/`, { waitUntil: "domcontentloaded" });
  await warte(seite, `() => !!document.querySelector("#auth-email")`, `Anmeldemaske für ${email}`);
  await tippeMitTastatur(seite, "#auth-email", email, "E-Mail");
  await tippeMitTastatur(seite, "#auth-password", passwort, "Passwort");
  await seite.keyboard.press("Enter");
  await warte(
    seite,
    `() => !document.querySelector("#auth-email")`,
    `die Anmeldung von ${email} trägt`,
    undefined,
    60_000,
  );
}

/** Ein frisches Profil am breiten Fenster, angemeldet, in der Bibliothek. */
export async function frischerNutzerInDerBibliothek(
  browser: Browser,
  basis: string,
  email: string,
  passwort: string,
): Promise<{ kontext: Kontext; seite: Seite }> {
  const p = await profil(browser, BREIT);
  await anmelden(p.seite, basis, email, passwort);
  await p.seite.goto(`${basis}/bibliothek`, { waitUntil: "domcontentloaded" });
  return p;
}
