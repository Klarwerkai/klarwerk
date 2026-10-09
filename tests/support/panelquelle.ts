// ================================================================================================
// AUFNAHME 20260922 · ZENTRALE-MODULE-AUFTEILEN (R-1611, P11) — DAS AUFGABENFENSTER IN DREI DATEIEN.
// ================================================================================================
//
// Bis zu diesem Auftrag war `apps/web/public/word-addin/taskpane.html` EINE Datei mit 13.729 Zeilen
// (803.665 Bytes): Markup, ein Inline-Stil und ein Inline-Skript. Jetzt sind es drei:
//
//   · `taskpane.html` — das Markup; an der Stelle des Stils steht `<link …taskpane.css…>`, an der
//                       Stelle des Skripts `<script src="taskpane.js…">`.
//   · `taskpane.css`  — der frühere Inhalt von `<style>`, Zeile für Zeile.
//   · `taskpane.js`   — der frühere Inhalt von `<script>`, Zeile für Zeile.
//
// Der Schnitt ist eine REINE TEXTOPERATION (keine Zeile umformatiert, keine umbenannt); die Bilanz
// geht auf das Byte auf. Diese Datei ist ihr Gegenstück: sie fügt die drei Dateien wieder zu genau
// dem Dokument zusammen, das vorher in `taskpane.html` stand. Dass es WIRKLICH dasselbe ist, misst
// `tests/klara-zerlegung/schnitt-echt.test.ts` gegen die Git-Blob-Kennung des Basisstands
// (`PANEL_VOR_SCHNITT_BLOB`) — seit der Integration die Datei von `main` a2ff8da8, nachprüfbar
// ohne diesen Test mit `git rev-parse a2ff8da8:apps/web/public/word-addin/taskpane.html`.
//
// WOZU DAS ZUSAMMENFÜGEN: rund hundert bestehende Prüfstände lesen das Fenster als EIN Dokument —
// sie schneiden Blöcke an `KW-…`-Marken heraus, bauen den Rumpf ins jsdom-DOM und führen das
// Skript aus. Sie lesen ab hier `panelQuelle()` statt der Datei und sehen damit unverändert das,
// was ein Browser nach dem Laden aller drei Dateien vor sich hat. Dass die GESCHNITTENE Auslieferung
// sich dabei genauso verhält wie das zusammengefügte Dokument, misst `probeschnitt.test.ts` (D2)
// über die echte Fastify-Verdrahtung in je einem eigenen jsdom-Fenster.
//
// BEWUSST OHNE DOM-LIB und ohne Zwischenspeicher: reine Textarbeit, jeder Aufruf liest die Platte.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { repoPfad } from "./repoPfad";

export const PANEL_HTML_RELATIV = "apps/web/public/word-addin/taskpane.html";
export const PANEL_CSS_RELATIV = "apps/web/public/word-addin/taskpane.css";
export const PANEL_JS_RELATIV = "apps/web/public/word-addin/taskpane.js";

/** Die Dateinamen, so wie sie neben `taskpane.html` liegen und im Verweis stehen. */
export const PANEL_CSS_DATEI = "taskpane.css";
export const PANEL_JS_DATEI = "taskpane.js";

/**
 * Die zwei Verweise, die der Schnitt in `taskpane.html` gesetzt hat — an genau der Stelle, an der
 * vorher `<style>` und `<script>` standen. Die Cachekennung `?v=__KW_FASSUNG__` ist dieselbe wie am
 * Verweis auf `rueckweg.js` (JOB 3667): `stempleFassung` ersetzt sie beim Ausliefern.
 */
export const PANEL_CSS_VERWEIS = `<link rel="stylesheet" href="${PANEL_CSS_DATEI}?v=__KW_FASSUNG__" />`;
export const PANEL_JS_VERWEIS = `<script src="${PANEL_JS_DATEI}?v=__KW_FASSUNG__"></script>`;

/**
 * Zerlegungsauftrag Bestandsblick (aufnahme:20260922:gesamt-bestandsblick:zerlegung-aufraeumen):
 * der Block KW-MARKE, das ENDE des Fensterskripts, wohnt in einer vierten Datei. `taskpane.html`
 * laedt sie als klassisches Skript UNMITTELBAR NACH `taskpane.js` — er laeuft also genau dort, wo
 * er stand. Grund ist die Schranke von `schnittflaechen.test.ts` B3 (12500 Zeilen an `taskpane.js`),
 * die nicht angehoben werden darf.
 */
export const PANEL_MARKE_RELATIV = "apps/web/public/word-addin/marke.js";
export const PANEL_MARKE_DATEI = "marke.js";
export const PANEL_MARKE_VERWEIS = `<script src="${PANEL_MARKE_DATEI}?v=__KW_FASSUNG__"></script>`;
/**
 * Das Ende des Kopfes von `marke.js`. Alles DANACH ist der Abschnitt, Zeichen fuer Zeichen so, wie
 * er am Ende des Skripts stand (beginnend mit der Leerzeile, die ihn vom Block davor trennte).
 */
const MARKE_KOPF_ENDE = '"use strict";\n';

/**
 * Git-Blob-Kennung der EINEN Datei `apps/web/public/word-addin/taskpane.html`, die die drei Dateien
 * zusammengefügt ergeben müssen.
 *
 * Bis zur Integration mit `main` war das der Basisstand `3b79c5d1` (`95226f6582e5…`). Auf `main`
 * (a2ff8da8) hat R-0169 das Inline-Skript weitergebaut (Dokumentkennung, KI-Aufgabe `enrich`) — in
 * der ungeschnittenen Datei. Diese Änderung ist Zeile für Zeile in `taskpane.js` übernommen; der
 * Bezugspunkt war deshalb die Datei von `main` (`7d5a6234…`, nachprüfbar mit
 * `git rev-parse a2ff8da8:apps/web/public/word-addin/taskpane.html`).
 *
 * Aufnahme m365-anmeldung (Integration mit `main`, 05.10.2026): die Anmeldeänderung aus Lauf 1
 * (abgelehntes Anmelde-Fenster im fremden Rahmen → `loginDialogDeclined`, drei Texte DE/EN/NL,
 * gekürzte Kommentare am Anmelde-Poll) war in der ungeschnittenen Datei gebaut und ist Zeile für
 * Zeile in `taskpane.js` übertragen. Das zusammengefügte Dokument ist damit die Datei von `main`
 * PLUS genau diese Änderung; ihr Blob ist `3c755f63…` (lesend nach `fuegePanelZusammen` ermittelt
 * am geprüften Kandidaten 7b78946e). Eine ungeschnittene Datei mit diesem Inhalt liegt in keinem
 * Commit — die Abweichung zu `7d5a6234…` ist ausschließlich `git diff ebfe7718 --
 * apps/web/public/word-addin/taskpane.js`. E3 (ein Zeichen mehr → rot) bleibt die Gegenprobe.
 *
 * Zerlegungsauftrag Bestandsblick (Integration mit `main` 93c25f5a): dieselbe Regel — eine
 * fachliche Aenderung am Skript verschiebt den Bezugspunkt. Hinzugekommen ist GENAU die
 * Bestandsblick-Lesekoordination aus 67d5e6fd (drei Stellen: `readWholeDocument(done, fehlschlag)`,
 * `ka1Stand`/`ka1Aktuell`, das Warten bzw. Neulesen in `ka3Ausfuehren`). Die Auslagerung von
 * KW-MARKE nach `marke.js` aendert am zusammengefuegten Dokument kein Byte. Gemessen mit
 * `git diff --no-index --full-index`: das aus den vier Dateien zusammengefuegte Dokument hat den
 * Blob `90936dcc…`; `taskpane.js` plus Abschnitt aus `marke.js` weicht von `main`s `taskpane.js`
 * nur in diesen drei Stellen ab (+60/-8), `taskpane.html` nur im Verweis auf `marke.js`,
 * `taskpane.css` gar nicht.
 *
 * Aufnahme GESAMT-VERTRAULICHKEIT-ERFASSUNG (R-0632, Integration mit `main` 38508a1e): dieselbe
 * Regel. Die Stufenwahl war in der ungeschnittenen Datei gebaut und ist übertragen — Markup
 * `#capture-stufe` in `taskpane.html`, Logik in `taskpane.js` (optionales `confidentiality` in
 * `draftPostPayload`/`prepareWordDraftRequest`, `captureStufeGewaehlt`/`renderCaptureStufe`,
 * Klick-Zuhörer, vier Wörterbuchschlüssel je Sprache, Stufe im from-docx-Rumpf nur bei echter Wahl).
 * Der Bezugspunkt MUSS deshalb wandern; der Blob des zusammengefügten Dokuments war bei der
 * Konfliktlösung nicht berechenbar (kein Hash-Werkzeug zugelassen). E2 meldet ihn im Prüflauf als
 * „Received"; er wird danach gemessen übernommen.
 * GEMESSEN im Prüflauf zu Kandidat 83c9a4b8: `d5d7a936…` (unten eingetragen). DANACH ERNEUT GEÄNDERT,
 * nur in der Ablage: die Knopfgruppe steht in der Zeile von `#capture-aktion`, ihr Kommentar in
 * `taskpane.js`, damit die Markup-Datei unter 500 Zeilen bleibt (A2/E5). Der Blob muss deshalb EIN
 * weiteres Mal gemessen übernommen werden.
 * NACHARBEIT 15: GEMESSEN im Prüflauf zu Kandidat 124645e8 (`b3f3846c…`, „Received" von E2) und
 * unverändert übernommen; die vier Panel-Dateien sind seit dieser Messung unberührt.
 * WORD-HOST-GESAMTWEG (Nacharbeit 4, Realhostbeleg 06.10.2026): `taskpane.js` ändert sich an der
 * Warnung zur Dokumentkennung (verzögertes `saveAsync`). Der Bezugspunkt MUSS deshalb wandern; ohne
 * zugelassenes Hash-Werkzeug ist er hier nicht berechenbar. E2 meldet ihn im Prüflauf als
 * „Received"; er wird danach gemessen übernommen.
 * NACHARBEIT 5: GEMESSEN im Prüflauf zu Kandidat 6dc92d9b (`0548d086…`, „Received" von E2,
 * HISTORIE/nacharbeit-5/PRUEFUNG/panel-auslieferung-pins.log) und unverändert übernommen; die
 * Panel-Dateien sind seit dieser Messung unberührt.
 * NACHARBEIT 6: `taskpane.js` ändert sich am Auswahlzugriff des Fragenwegs (`Word.run` zuerst, mit
 * Frist). Der Bezugspunkt MUSS wandern; E2 meldet ihn im Prüflauf als „Received", er wird danach
 * gemessen übernommen.
 * NACHARBEIT 7: GEMESSEN im Prüflauf zu Kandidat 26e86268 (`87cb70fe…`, „Received" von E2,
 * HISTORIE/nacharbeit-7/PRUEFUNG/panel-auslieferung-pins.log) und unverändert übernommen; die
 * Panel-Dateien sind seit dieser Messung unberührt.
 * NACHARBEIT 9: `taskpane.js` ändert sich an der Bestandssuche (Schlüssel Text + Titel) und um zwei
 * Wörterbuchschlüssel des Rückwegs. Der Bezugspunkt MUSS wandern; E2 meldet ihn im Prüflauf als
 * „Received", er wird danach gemessen übernommen.
 * NACHARBEIT 11: gemessen zu Kandidat 10b99093 war `99c60bac…` — NICHT übernommen, weil
 * `taskpane.js` wegen der Zeilenschranke B3 (ausgeliefert 12500) danach um zwei Kommentarzeilen
 * kürzer wurde. Root hat den neuen Blob direkt aus den vier Quelldateien berechnet.
 * AUFTRAG gesamt-ki-einwilligung:bindung (R-0590, Ben nacharbeit-3/-4): `taskpane.js` ändert sich
 * an `performAsk` (409 `KLARA_AUSWEICHWEG_GESPERRT` → Grund), an der Statusanzeige des Fragenwegs,
 * um zwei Wörterbuchschlüssel je Sprache und an einem umformulierten Kommentar; netto null Zeilen.
 * Der Bezugspunkt MUSS wandern; ohne zugelassenes Hash-Werkzeug ist er hier nicht berechenbar. E2
 * meldet ihn im Prüflauf als „Received"; er wird danach gemessen übernommen.
 * NACHARBEIT 5 (dieser Auftrag): GEMESSEN im Prüflauf zu Kandidat 430c247c (`33e52280…`, „Received"
 * von E2, HISTORIE/nacharbeit-5/PRUEFUNG/panel-auslieferung-pins.log) und unverändert übernommen;
 * die vier Panel-Dateien sind seit dieser Messung unberührt.
 * AUFTRAG firmenwoerterbuch: `taskpane.html` ändert sich um den Block `#begriffe-block` (Markup,
 * ohne Text) und den Verweis auf `begriffe.js` im Kopf hinter office.js; `taskpane.js`, `taskpane.css`
 * und `marke.js` bleiben unberührt. Der Bezugspunkt MUSS deshalb wandern; ohne zugelassenes
 * Hash-Werkzeug ist er hier nicht berechenbar. E2 meldet ihn im Prüflauf als „Received"; er wird
 * danach gemessen übernommen.
 * NACHARBEIT 1 (firmenwoerterbuch): gemessen zu Kandidat aac85540 war `84436ffdd17714a1…` — NICHT
 * übernommen, weil `taskpane.html` danach um eine Zeile kürzer wurde (der Block steht jetzt in der
 * Schlusszeile des Bestandsblocks, Schranke A2/E5 „unter 500 Zeilen"). Die vollständige Kennung
 * stand im Prüfbericht nur gekürzt, und kein Hash-Werkzeug war zugelassen. E2 meldet den Wert der
 * endgültigen Fassung als „Received"; er wird danach gemessen übernommen. E3 bleibt die Gegenprobe.
 * NACHARBEIT 2 (firmenwoerterbuch): GEMESSEN am Kandidaten 64d3d35d durch Rekonstruktion nach
 * `fuegePanelZusammen` aus den vier Quelldateien (`f96a6710…`, Beleg
 * BAHN17-PANEL-BLOB-MESSUNG-20261006.json samt SHA-256 der vier Quellen) und unverändert
 * übernommen. Die Integration mit `main` danach hat keine der vier Panel-Dateien berührt.
 *
 * Aufnahme 20260922 · gesamt-bestandsblick (R-0427; Integration mit `main` d19886ff): dieselbe
 * Regel. Auf den Stand oben kommt GENAU der Absatzwechselweg nach bewusstem Ja — Einstellungszeile
 * `#einst-absatzblick` (in der Zeile hinter `#einst-mitlesen`, Markup unter 500 Zeilen), drei Texte
 * DE/EN/NL in `KA3_TEXTE`, `ka3AbsatzPruefen()` in `ka3Planen`, Beschriftung in `ka3Neuzeichnen`,
 * Block `ka3AbsatzPruefen`/Schalter und die Bindung an die gültige Aktivierung (`ka3AbsatzRunde`,
 * `gilt()` in `ka3Ausfuehren`). Damit `taskpane.js` unter der Schranke B3 bleibt (zusammengeführt
 * 12544 Zeilen), sind die Kommentarköpfe der Blöcke KA2-BESTAND und W6 verdichtet — nur Kommentar,
 * kein Ausdruck geändert; die Datei hat 12492 Zeilen. GEMESSEN beim Auflösen: das genau nach
 * `fuegePanelZusammen` zusammengesetzte Dokument hat den Blob `2d5d9c26…` (`git diff --no-index
 * --full-index`); dasselbe Verfahren ergibt an den vier Dateien von `main` d19886ff wörtlich
 * `33e52280…`. Frühere Messungen dieses Auftrags: `0f733b04…`, `eb344beb…`, `fd19fe43…`.
 *
 * INTEGRATION firmenwoerterbuch × gesamt-bestandsblick (Kandidat 1194ffaa, Nacharbeit 7): BEIDE
 * Änderungen stehen jetzt in den Panel-Dateien — `#begriffe-block` und der Verweis auf
 * `begriffe.js` (firmenwoerterbuch) UND `#einst-absatzblick` samt Absatzwechselweg in
 * `taskpane.js` (gesamt-bestandsblick). `taskpane.html` hat 498 Zeilen, `taskpane.js` 12492.
 * Keine der beiden Messungen (`f96a6710…` firmenwoerterbuch, `2d5d9c26…` gesamt-bestandsblick)
 * beschreibt dieses zusammengefügte Dokument; beide galten nur für ihren Zweig. Der Wert unten ist
 * der von `main` und damit ein PLATZHALTER bis zur Messung: ohne zugelassenes Hash-Werkzeug ist
 * der neue Blob hier nicht berechenbar. E2 meldet ihn im Prüflauf als „Received"; er wird danach
 * gemessen übernommen. E3 bleibt die Gegenprobe.
 * NACHARBEIT 8 (firmenwoerterbuch): GEMESSEN im Prüflauf zu Kandidat a8ec940f (`5d7ae0b8…`,
 * „Received" von E2, HISTORIE/nacharbeit-8/PRUEFUNG/panel-integration-pins.log) und unverändert
 * übernommen; die vier Panel-Dateien sind seit dieser Messung unberührt.
 *
 * Aufnahme 20260922 · antwort-quellenanzeige (R-0309/R-0325): `taskpane.js` ändert sich (Stand-Datum
 * an der Herkunftszeile, tragende Quellen samt Prüfstand/Version in der Dokument-Quellenzeile, ein
 * verdichteter Kommentarkopf; 12494 Zeilen). Der Wert unten ist damit ein PLATZHALTER bis zur
 * Messung — ohne zugelassenes Hash-Werkzeug hier nicht berechenbar; E2 meldet den neuen Blob im
 * Prüflauf als „Received", er wird danach gemessen übernommen. E3 bleibt die Gegenprobe.
 * NACHARBEIT 1 (antwort-quellenanzeige): GEMESSEN im Prüflauf zu Kandidat 95df9979 (`c8b2ec45…`,
 * „Received" von E2, HISTORIE/nacharbeit-1/PRUEFUNG/panel-ausgabe-und-waechter.log) und unverändert
 * übernommen; die vier Panel-Dateien sind seit dieser Messung unberührt.
 * NACHARBEIT 3 (antwort-quellenanzeige): `taskpane.js` (tragende Quellen, Stand je Quelle,
 * Einschub, verdichtete Kommentare; 12495 Zeilen) und `taskpane.css` ändern sich erneut. Der Wert
 * unten ist damit wieder ein PLATZHALTER bis zur Messung; E2 meldet den neuen Blob als „Received".
 * NACHARBEIT 4: GEMESSEN im Prüflauf zu Kandidat ca6061e4 (`ebe3b2c0…`, „Received" von E2,
 * HISTORIE/nacharbeit-3/PRUEFUNG/panel-waechter-und-pins.log) und unverändert übernommen; die vier
 * Panel-Dateien sind seit dieser Messung unberührt.
 * NACHARBEIT 5: `taskpane.js` ändert sich erneut (Belegstelle am Quellenlink, Wissensnetz-Sprung,
 * 12497 Zeilen). Der Wert unten ist wieder ein PLATZHALTER bis zur Messung („Received" von E2).
 * NACHARBEIT 6: GEMESSEN im Prüflauf zu Kandidat 300b9834 (`baadfb41…`, „Received" von E2,
 * HISTORIE/nacharbeit-5/PRUEFUNG/panel-belegstelle-und-wissensnetz.log) und unverändert
 * übernommen; die vier Panel-Dateien sind seit dieser Messung unberührt.
 * INTEGRATION mit main (Kandidat d9fe11c3, Nacharbeit 8): `taskpane.js` trägt zusätzlich die
 * Auswertung von `KI_ABGESCHALTET` (gesamt-funktionsschalter, R-1040; 12498 Zeilen). Der Wert unten
 * beschreibt das zusammengeführte Dokument nicht mehr und ist ein PLATZHALTER bis zur Messung
 * („Received" von E2).
 * NACHARBEIT 10: GEMESSEN im Prüflauf zu Kandidat a54d2eff am zusammengeführten Panel (`96fc81a8…`,
 * „Received" von E2, HISTORIE/nacharbeit-10/PRUEFUNG/panel-pins-nach-integration.log) und
 * unverändert übernommen; die vier Panel-Dateien sind seit dieser Messung unberührt.
 * NACHARBEIT 11 (Ben zu c022ce07, R-0310/R-0326): `taskpane.js` und `taskpane.css` geändert
 * (Absatz-Belege, Fußnoten je Absatz, Passage als Belegstellen-Link). Der Wert unten ist wieder ein
 * PLATZHALTER — DER BLOB MUSS WANDERN; E2 meldet den Ist-Wert als „Received", er wird danach
 * gemessen übernommen.
 * NACHARBEIT 12: GEMESSEN im Prüflauf zu Kandidat ff6019e3 (`9bee4487…`, „Received" von E2,
 * HISTORIE/nacharbeit-12/PRUEFUNG/panel-waechter-und-pins.log) und unverändert übernommen; die
 * vier Panel-Dateien sind seit dieser Messung unberührt.
 * NACHARBEIT 13 (Ben zu 6cc581b4): `taskpane.js`/`taskpane.css` geändert (Sichtbarkeit je
 * Absatzmarke). Der Wert unten ist wieder ein PLATZHALTER — DER BLOB MUSS WANDERN; E2 meldet den
 * Ist-Wert als „Received", er wird danach gemessen übernommen.
 * NACHARBEIT 14: GEMESSEN im Prüflauf zu Kandidat 966d179e (`3cd14422…`, „Received" von E2,
 * HISTORIE/nacharbeit-14/PRUEFUNG/r0310-panel-absatzmarken.log) und unverändert übernommen; die
 * vier Panel-Dateien sind seit dieser Messung unberührt.
 * NACHARBEIT 15 (Ben zu 8e6c9d73): `taskpane.js`, `taskpane.html` und `taskpane.css` geändert
 * (Lücke nennt die unbekannte Zuordnung, `#ask-gap-zuordnung`). Der Wert unten ist wieder ein
 * PLATZHALTER — DER BLOB MUSS WANDERN; E2 meldet den Ist-Wert als „Received", er wird danach
 * gemessen übernommen.
 * NACHARBEIT 17: GEMESSEN im Prüflauf zu Kandidat 2c099872 (`cb99796c…`, „Received" von E2,
 * HISTORIE/nacharbeit-17/PRUEFUNG/r0310-panel-und-pins.log) und unverändert übernommen; die vier
 * Panel-Dateien sind seit dieser Messung unberührt.
 */
export const PANEL_VOR_SCHNITT_BLOB = "cb99796c9a3134f0ffd02a97c3c1eb270055e4b8";

export interface PanelTeile {
  html: string;
  css: string;
  js: string;
  /** `marke.js`, wie sie im Baum liegt — samt Kopf. */
  marke: string;
}

/** Die vier ausgelieferten Dateien, so wie sie im Baum liegen. */
export function panelTeile(): PanelTeile {
  return {
    html: readFileSync(repoPfad(PANEL_HTML_RELATIV), "utf8"),
    css: readFileSync(repoPfad(PANEL_CSS_RELATIV), "utf8"),
    js: readFileSync(repoPfad(PANEL_JS_RELATIV), "utf8"),
    marke: readFileSync(repoPfad(PANEL_MARKE_RELATIV), "utf8"),
  };
}

/** Der Abschnitt aus `marke.js` ohne ihren Kopf — fail-closed, wenn das Kopfende fehlt. */
export function markeAbschnitt(marke: string): string {
  const ende = marke.indexOf(MARKE_KOPF_ENDE);
  if (ende < 0) {
    throw new Error(`${PANEL_MARKE_RELATIV}: das Kopfende ${MARKE_KOPF_ENDE.trim()} fehlt`);
  }
  return marke.slice(ende + MARKE_KOPF_ENDE.length);
}

/** Ersetzt GENAU EIN Vorkommen; zwei oder keines sind ein Fehler und kein stilles Weiterlaufen. */
function setzeEin(text: string, verweis: string, ersatz: string): string {
  const teile = text.split(verweis);
  if (teile.length !== 2) {
    throw new Error(
      `${PANEL_HTML_RELATIV}: der Verweis ${verweis} steht ${teile.length - 1}-mal da, erwartet genau einmal`,
    );
  }
  // Zusammensetzen über Verkettung, nicht über `String.replace`: im Panelskript steht `$&`, und
  // `replace` würde es als Ersatzmuster auswerten (JOB 3014, probeschnitt.test.ts A1).
  return `${teile[0]}${ersatz}${teile[1]}`;
}

/**
 * Die Umkehrung des Schnitts. Die Einrückung (`  `) vor dem Verweis bleibt stehen; vor dem
 * Schlusstag stand im Original dieselbe Einrückung, und jeder Block begann mit einem Zeilenumbruch
 * nach dem Öffnungstag.
 */
export function fuegePanelZusammen(teile: PanelTeile): string {
  const mitStil = setzeEin(teile.html, PANEL_CSS_VERWEIS, `<style>\n${teile.css}  </style>`);
  // Der Verweis auf `marke.js` steht in der naechsten Zeile hinter dem auf `taskpane.js`; beide
  // zusammen werden zu dem EINEN Skript, das vorher dastand (der Abschnitt wieder an dessen Ende).
  return setzeEin(
    mitStil,
    `${PANEL_JS_VERWEIS}\n  ${PANEL_MARKE_VERWEIS}`,
    `<script>\n${teile.js}${markeAbschnitt(teile.marke)}  </script>`,
  );
}

/** Das Aufgabenfenster als EIN Dokument — Markup, Stil und Skript an ihren Stellen. */
export function panelQuelle(): string {
  return fuegePanelZusammen(panelTeile());
}

/**
 * Wie `panelQuelle()`, aber für Prüfstände, die den Pfad schon als eigene Konstante führen
 * (relativ zum Startverzeichnis oder absolut). Der Pfad muss auf `taskpane.html` zeigen — sonst
 * ist es ein Testfehler, kein stiller Rückfall auf eine andere Datei.
 */
export function panelQuelleAus(pfad: string): string {
  const ende = PANEL_HTML_RELATIV.split("/").join(sep);
  if (!resolve(pfad).endsWith(ende)) {
    throw new Error(`panelQuelleAus: ${pfad} ist nicht ${PANEL_HTML_RELATIV}`);
  }
  return panelQuelle();
}

/** Dieselbe Kennung, die `git hash-object` für diesen Inhalt ausgibt. */
export function gitBlobKennung(text: string): string {
  const inhalt = Buffer.from(text, "utf8");
  return createHash("sha1").update(`blob ${inhalt.length}\0`).update(inhalt).digest("hex");
}
