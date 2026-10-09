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
 * Auftrag „Geschriebene Behauptungen gegen den Wissensbestand prüfen" (R-0336, R-0708): der Block
 * KW-WORDVERGLEICH, bis dahin das ENDE von `taskpane.js`, wohnt in einer fünften Datei — nach der
 * Regel von `marke.js` und aus demselben Grund (B3). `taskpane.html` lädt sie UNMITTELBAR NACH
 * `taskpane.js` und vor `marke.js`; der Verweis steht in derselben Zeile wie der auf `taskpane.js`,
 * damit die Markup-Datei unter 500 Zeilen bleibt (A2/E5). Der Kopf endet wie bei `marke.js` mit
 * `"use strict";` — alles danach ist der Abschnitt, beginnend mit der trennenden Leerzeile.
 */
export const PANEL_WV_RELATIV = "apps/web/public/word-addin/wortvergleich.js";
export const PANEL_WV_DATEI = "wortvergleich.js";
export const PANEL_WV_VERWEIS = `<script src="${PANEL_WV_DATEI}?v=__KW_FASSUNG__"></script>`;

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
 * AUFNAHME 20260922 · ANTWORT-ERKLÄRUNG (Ben nacharbeit-2, R-0321/R-0335): `taskpane.js` liest Lage und
 * Konfliktseiten (`performAsk`, `renderAskLage`, neun Wörterbuchschlüssel je Sprache), `taskpane.html`
 * trägt `#ask-lage-line`/`#ask-konflikt-seiten`. Der Bezugspunkt MUSS wandern; ohne zugelassenes
 * Hash-Werkzeug ist er hier nicht berechenbar. E2 meldet ihn im Prüflauf als „Received"; er wird danach
 * gemessen übernommen. E3 bleibt die Gegenprobe.
 * NACHARBEIT 4 (Antwort-Erklärung): gemessen zu Kandidat 64095a2e war `8f2a762d…189c20` — NICHT
 * übernommen, weil `taskpane.js` danach erneut geändert wurde (drei Lage-Schlüssel ohne
 * ASCII-Umschrift umbenannt, mega69 C). E2 meldet den Wert der endgültigen Fassung als „Received".
 * NACHARBEIT 5 (Antwort-Erklärung): GEMESSEN im Prüflauf zu Kandidat 0bd4f3cb (`469de4a6…`,
 * „Received" von E2, HISTORIE/nacharbeit-5/PRUEFUNG/word-fenster-pins.log) und unverändert
 * übernommen; die vier Panel-Dateien sind seit dieser Messung unberührt.
 * INTEGRATION mit main d8717621 (nacharbeit-6): `taskpane.js` trägt zusätzlich `ki-abgeschaltet`
 * (R-1040, gesamt-funktionsschalter). Der Bezugspunkt MUSS wandern; der Wert unten beschreibt nur den
 * Stand vor der Integration. Ohne zugelassenes Hash-Werkzeug nicht berechenbar — E2 meldet ihn im
 * Prüflauf als „Received"; er wird danach gemessen übernommen.
 * NACHARBEIT 8 (Antwort-Erklärung): GEMESSEN im Prüflauf zu Kandidat 7e98d5c4 (`8ad37a9c…`, „Received"
 * von E2, HISTORIE/nacharbeit-8/PRUEFUNG/integration-word-fenster.log) und unverändert übernommen;
 * die vier Panel-Dateien sind seit dieser Messung unberührt.
 *
 * AUFNAHME 20260922 · GESAMT-DOKUMENTERZEUGUNG (Pedi 28.09., Anleitung in Word): dieselbe Regel.
 * `taskpane.html` trägt im Kopf GENAU einen Verweis mehr — `anleitung.js` hinter `begriffe.js`, in
 * derselben Zeile (Zeilenzahl unverändert). `taskpane.js`, `taskpane.css` und `marke.js` bleiben
 * unberührt; `anleitung.js` selbst ist wie `begriffe.js` kein Teil des zusammengefügten Dokuments.
 * Der Bezugspunkt MUSS deshalb wandern; ohne zugelassenes Hash-Werkzeug ist er hier nicht
 * berechenbar. E2 meldet ihn im Prüflauf als „Received"; er wird danach gemessen übernommen. E3
 * bleibt die Gegenprobe.
 * NACHARBEIT 1 (gesamt-dokumenterzeugung): GEMESSEN im Prüflauf zu Kandidat a757d6c3
 * (`ca1f9d53…`, „Received" von E2, HISTORIE/nacharbeit-1/PRUEFUNG/panel-pins-messung.log) und
 * unverändert übernommen; die vier Panel-Dateien sind seit dieser Messung unberührt.
 * INTEGRATION gesamt-dokumenterzeugung × main d8717621 (Nacharbeit 2): main hat `taskpane.js`
 * geändert (gesamt-funktionsschalter, 503 `KI_ABGESCHALTET` und `askKiAbgeschaltet`), diese Zeile
 * aber nicht — sie wurde deshalb ohne Konflikt auf `ca1f9d53…` zusammengeführt. Dieser Wert
 * beschreibt nur den Zweig gesamt-dokumenterzeugung, nicht das vereinigte Fenster. Er ist ein
 * PLATZHALTER bis zur Messung; ohne zugelassenes Hash-Werkzeug nicht berechenbar. E2 meldet den
 * Wert im Prüflauf als „Received"; er wird danach gemessen übernommen. E3 bleibt die Gegenprobe.
 * NACHARBEIT 3 (gesamt-dokumenterzeugung): GEMESSEN im Prüflauf zu Kandidat b4a727cc (`84122c98…`,
 * „Received" von E2, HISTORIE/nacharbeit-3/PRUEFUNG/panel-pins-integration.log) und unverändert
 * übernommen; die vier Panel-Dateien sind seit dieser Messung unberührt.
 *
 * AUFTRAG „Geschriebene Behauptungen gegen den Wissensbestand prüfen" (R-0336, R-0708): ZWEI
 * Änderungen, und nur EINE bewegt diesen Wert.
 *   (1) Der Abschnitt KW-WORDVERGLEICH wandert Zeile für Zeile von `taskpane.js` nach
 *       `wortvergleich.js` (Kopf + `"use strict";` + Abschnitt), der Verweis steht in der Zeile von
 *       `taskpane.js`. Vor den Änderungen aus (2) ergab das Zusammensetzen dieselben Bytes: Rest von
 *       `taskpane.js` und Abschnitt aus `wortvergleich.js` sind mit `cmp` gegen die Datei des
 *       Basisstands 817d5347 verglichen (ohne Abweichung). Diese Änderung allein bewegt den Wert NICHT.
 *   (2) Im Abschnitt selbst: „Markierung prüfen", die Fundstelle als Zitat am Quellenfund und die
 *       Zustimmung zum noch nicht validierten Bestand. DIESE Änderung bewegt den Wert. Ohne
 *       zugelassenes Hash-Werkzeug (in dieser Bahn waren `git hash-object` und `shasum` gesperrt) ist
 *       er hier nicht berechenbar; E2 meldet ihn im Prüflauf als „Received", er wird danach gemessen
 *       übernommen. E3 bleibt die Gegenprobe.
 * NACHARBEIT 1 (dieser Auftrag): GEMESSEN im Prüflauf zu Kandidat 12b0b2d6 (`40d40053…`,
 * „Received" von E2, HISTORIE/nacharbeit-1/PRUEFUNG/schnitt-wortvergleich-und-panelwaechter.log)
 * und unverändert übernommen; die fünf Panel-Dateien sind seit dieser Messung unberührt.
 *
 * Auf `main` lief parallel (die Zeilen unten stammen von dort):
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
 *
 * INTEGRATION gesamt-dokumenterzeugung × antwort-quellenanzeige (main ffd509db, Nacharbeit 32):
 * BEIDE Änderungen stehen jetzt in den Panel-Dateien — der Verweis auf `anleitung.js` in
 * `taskpane.html` (gesamt-dokumenterzeugung) UND die Quellenanzeige samt `#ask-gap-zuordnung` in
 * `taskpane.js`/`taskpane.html`/`taskpane.css` (antwort-quellenanzeige). Keine der beiden Messungen
 * (`84122c98…` hier, `cb99796c…` auf main) beschreibt das zusammengefügte Dokument. Der Wert unten
 * ist der von main und damit ein PLATZHALTER bis zur Messung: ohne zugelassenes Hash-Werkzeug ist
 * der neue Blob hier nicht berechenbar. E2 meldet ihn im Prüflauf als „Received"; er wird danach
 * gemessen übernommen. E3 bleibt die Gegenprobe.
 * NACHARBEIT 33 (gesamt-dokumenterzeugung): GEMESSEN im Prüflauf zu Kandidat 38a24dcd am
 * ZUSAMMENGEFÜHRTEN Panel (`e18110b7…`, „Received" von E2,
 * HISTORIE/nacharbeit-33/PRUEFUNG/panel-pins-integration.log) und unverändert übernommen; die vier
 * Panel-Dateien sind seit dieser Messung unberührt.
 *
 * INTEGRATION „Geschriebene Behauptungen …" × main 70216f9f (Nacharbeit 3 dieses Auftrags): BEIDE
 * Änderungen stehen im zusammengefügten Dokument — die Quellenanzeige von main (R-0309/R-0310/
 * R-0325/R-0326, `#ask-gap-zuordnung`) in `taskpane.js`/`.html`/`.css` UND der Wortvergleich dieses
 * Auftrags (ausgelagert nach `wortvergleich.js`, R-0336/R-0708). Git hat die Panel-Dateien ohne
 * Konflikt zusammengeführt; der Block KW-WORDVERGLEICH steht nur in `wortvergleich.js`,
 * `taskpane.js` hat 11544 Zeilen, `taskpane.html` 498. Keine der beiden Messungen (`40d40053…` hier,
 * `cb99796c…` auf main) beschreibt dieses Dokument. Der Wert unten ist der von main und damit ein
 * PLATZHALTER — DER BLOB MUSS WANDERN; ohne zugelassenes Hash-Werkzeug hier nicht berechenbar. E2
 * meldet den Ist-Wert als „Received", er wird danach gemessen übernommen. E3 bleibt die Gegenprobe.
 * NACHARBEIT 4 (dieser Auftrag): GEMESSEN im Prüflauf zu Kandidat 3b7914f4 am zusammengeführten
 * Panel (`a72dfdf0…`, „Received" von E2, HISTORIE/nacharbeit-4/PRUEFUNG/
 * panel-nach-integration-pins-und-schnitt.log) und unverändert übernommen; die fünf Panel-Dateien
 * sind seit dieser Messung unberührt.
 *
 * Auf `main` lief parallel (die Zeilen unten stammen von dort):
 * INTEGRATION Antwort-Erklärung (`8ad37a9c…`) × antwort-quellenanzeige (main `cb99796c…`),
 * Nacharbeit 17 der Antwort-Erklärung: `taskpane.js` trägt Lage/Konfliktseiten (R-0321/R-0335) UND
 * die Absatz-Beleg-Zuordnung (R-0310); drei Kommentarköpfe ohne Wortverlust verdichtet (12490
 * Zeilen, B3). Keiner der beiden Werte beschreibt das zusammengeführte Dokument; der Wert unten
 * (main) ist ein PLATZHALTER — DER BLOB MUSS WANDERN; E2 meldet den Ist-Wert als „Received", er
 * wird danach gemessen übernommen. E3 bleibt die Gegenprobe.
 * NACHARBEIT 19 (Antwort-Erklärung): GEMESSEN im Prüflauf zu Kandidat d96bc621 am zusammengeführten
 * Panel (`c2a57caf…`, „Received" von E2, HISTORIE/nacharbeit-19/PRUEFUNG/integration-word-fenster.log)
 * und unverändert übernommen; die vier Panel-Dateien sind seit dieser Messung unberührt.
 *
 * INTEGRATION gesamt-dokumenterzeugung × Antwort-Erklärung (main 97440d8a, Nacharbeit 56): BEIDE
 * Änderungen stehen jetzt in den Panel-Dateien — der Verweis auf `anleitung.js` in `taskpane.html`
 * (gesamt-dokumenterzeugung) UND Lage/Konfliktseiten samt `#ask-lage-line`/`#ask-konflikt-seiten`
 * (Antwort-Erklärung). Keine der beiden Messungen (`e18110b7…` hier, `c2a57caf…` auf main)
 * beschreibt das zusammengefügte Dokument. Der Wert unten ist der von main und damit ein
 * PLATZHALTER bis zur Messung — DER BLOB MUSS WANDERN; E2 meldet den Ist-Wert als „Received", er
 * wird danach gemessen übernommen. E3 bleibt die Gegenprobe.
 * NACHARBEIT 57 (gesamt-dokumenterzeugung): GEMESSEN im Prüflauf zu Kandidat 88250be0 am
 * ZUSAMMENGEFÜHRTEN Panel (`e73efa0f…`, „Received" von E2,
 * HISTORIE/nacharbeit-57/PRUEFUNG/panel-pins-integration.log) und unverändert übernommen; die vier
 * Panel-Dateien sind seit dieser Messung unberührt.
 *
 * INTEGRATION „Geschriebene Behauptungen …" × main ab5f3c95 (Nacharbeit 8 dieses Auftrags): BEIDE
 * Änderungen stehen im zusammengefügten Dokument — Lage/Konfliktseiten und Absatz-Beleg-Zuordnung
 * von main (R-0321/R-0335/R-0310) in `taskpane.js`/`.html` UND der Wortvergleich dieses Auftrags
 * (`wortvergleich.js`, R-0336/R-0708). Git hat die Panel-Dateien ohne Konflikt zusammengeführt;
 * KW-WORDVERGLEICH steht nur in `wortvergleich.js`, `taskpane.js` hat 11537 Zeilen, `taskpane.html`
 * 498. Keine der Messungen (`a72dfdf0…` hier, `c2a57caf…` auf main) beschreibt dieses Dokument. Der
 * Wert unten ist der von main und damit ein PLATZHALTER — DER BLOB MUSS WANDERN; E2 meldet den
 * Ist-Wert als „Received", er wird danach gemessen übernommen. E3 bleibt die Gegenprobe.
 * NACHARBEIT 9 (dieser Auftrag): GEMESSEN im Prüflauf zu Kandidat 42f34c5e am zusammengeführten
 * Panel (`2d544023…`, „Received" von E2, HISTORIE/nacharbeit-9/PRUEFUNG/
 * panel-nach-integration-ab5f3c95-pins-und-schnitt.log) und unverändert übernommen; die fünf
 * Panel-Dateien sind seit dieser Messung unberührt.
 *
 * INTEGRATION gesamt-dokumenterzeugung × „Geschriebene Behauptungen …" (main 13984aac, Nacharbeit 70
 * dieses Auftrags): BEIDE Änderungen stehen jetzt in den Panel-Dateien — der Verweis auf
 * `anleitung.js` in `taskpane.html` (gesamt-dokumenterzeugung) UND der ausgelagerte Block
 * KW-WORDVERGLEICH in `wortvergleich.js` samt Verweis (R-0336/R-0708). Keine der beiden Messungen
 * (`e73efa0f…` hier, `2d544023…` auf main) beschreibt das zusammengefügte Dokument. Der Wert unten
 * ist der von main und damit ein PLATZHALTER — DER BLOB MUSS WANDERN; E2 meldet den Ist-Wert als
 * „Received", er wird danach gemessen übernommen. E3 bleibt die Gegenprobe.
 * NACHARBEIT 71 (gesamt-dokumenterzeugung): GEMESSEN im Prüflauf zu Kandidat 1fb4e6af am
 * ZUSAMMENGEFÜHRTEN Panel (`af829859…`, „Received" von E2,
 * HISTORIE/nacharbeit-71/PRUEFUNG/panel-integration-wortvergleich.log) und unverändert übernommen;
 * die fünf Panel-Dateien sind seit dieser Messung unberührt.
 *
 * INTEGRATION gesamt-sprache-begriffe × main 13984aac (K22): Auf den Stand von `main` kommt GENAU
 * eine Zeile in `renderStatics` (`taskpane.js`) — der Gruppenname der Sprachwahl
 * `#einst-sprache-wahl` über `t("einstSprache")` (gesamt-sprache-begriffe Nacharbeit 9; frühere
 * Messungen dieses Zweigs `44414ac3…`, `876b3150…`, `36967412…`). `taskpane.html`, `taskpane.css`,
 * `wortvergleich.js` und `marke.js` sind byte-gleich mit `main`; `taskpane.js` hat 11538 Zeilen
 * (B3). GEMESSEN am zusammengeführten Inhalt: die fünf Dateien genau nach `fuegePanelZusammen`
 * zusammengesetzt (Teile per `sed`/`cat`, Abschnitte von `wortvergleich.js` und `marke.js` jeweils
 * nach ihrem Kopfende), Kennung über `git diff --no-index --full-index`. Kalibrierung: dasselbe
 * Verfahren mit `taskpane.js` aus `main` 13984aac ergibt wörtlich
 * `2d544023972d9f9be4e644b2ace90e52c233bdb2` (der Wert von `main` oben); mit der Zeile
 * `dc94b941…` (Beleg CLAUDE/BLOB-MESSUNG-NACHARBEIT-27.json im Auftragsordner).
 *
 * INTEGRATION gesamt-dokumenterzeugung × gesamt-sprache-begriffe (main 1ff962b3, Nacharbeit 74
 * dieses Auftrags): BEIDE Änderungen stehen jetzt in den Panel-Dateien — der Verweis auf
 * `anleitung.js` in `taskpane.html` (gesamt-dokumenterzeugung) UND die Zeile für den Gruppennamen
 * der Sprachwahl in `taskpane.js` (gesamt-sprache-begriffe). Keine der beiden Messungen
 * (`af829859…` hier, `dc94b941…` auf main) beschreibt das zusammengefügte Dokument. Der Wert unten
 * ist der von main und damit ein PLATZHALTER — DER BLOB MUSS WANDERN; E2 meldet den Ist-Wert als
 * „Received", er wird danach gemessen übernommen. E3 bleibt die Gegenprobe.
 * NACHARBEIT 75 (gesamt-dokumenterzeugung): GEMESSEN im Prüflauf zu Kandidat c437ae6e am
 * ZUSAMMENGEFÜHRTEN Panel (`e9e11524…`, „Received" von E2,
 * HISTORIE/nacharbeit-75/PRUEFUNG/panel-blob-integration.log) und unverändert übernommen; die fünf
 * Panel-Dateien sind seit dieser Messung unberührt.
 */
export const PANEL_VOR_SCHNITT_BLOB = "e9e115249cfcf653dede036c37fa0b44d5f25163";

export interface PanelTeile {
  html: string;
  css: string;
  js: string;
  /** `marke.js`, wie sie im Baum liegt — samt Kopf. */
  marke: string;
  /** `wortvergleich.js`, wie sie im Baum liegt — samt Kopf. */
  wortvergleich: string;
}

/** Die fünf ausgelieferten Dateien, so wie sie im Baum liegen. */
export function panelTeile(): PanelTeile {
  return {
    html: readFileSync(repoPfad(PANEL_HTML_RELATIV), "utf8"),
    css: readFileSync(repoPfad(PANEL_CSS_RELATIV), "utf8"),
    js: readFileSync(repoPfad(PANEL_JS_RELATIV), "utf8"),
    marke: readFileSync(repoPfad(PANEL_MARKE_RELATIV), "utf8"),
    wortvergleich: readFileSync(repoPfad(PANEL_WV_RELATIV), "utf8"),
  };
}

/** Der Abschnitt einer Geschwisterdatei ohne ihren Kopf — fail-closed, wenn das Kopfende fehlt. */
function abschnittNachKopf(text: string, relativ: string): string {
  const ende = text.indexOf(MARKE_KOPF_ENDE);
  if (ende < 0) {
    throw new Error(`${relativ}: das Kopfende ${MARKE_KOPF_ENDE.trim()} fehlt`);
  }
  return text.slice(ende + MARKE_KOPF_ENDE.length);
}

/** Der Abschnitt aus `marke.js` ohne ihren Kopf — fail-closed, wenn das Kopfende fehlt. */
export function markeAbschnitt(marke: string): string {
  return abschnittNachKopf(marke, PANEL_MARKE_RELATIV);
}

/** Der Abschnitt aus `wortvergleich.js` ohne ihren Kopf — fail-closed wie `markeAbschnitt`. */
export function wortvergleichAbschnitt(wortvergleich: string): string {
  return abschnittNachKopf(wortvergleich, PANEL_WV_RELATIV);
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
  // R-0336/R-0708: dazwischen, in der Zeile von `taskpane.js`, der Verweis auf `wortvergleich.js` —
  // ihr Abschnitt steht wieder zwischen dem Fensterskript und dem Abschnitt KW-MARKE.
  const wortvergleich = wortvergleichAbschnitt(teile.wortvergleich);
  const marke = markeAbschnitt(teile.marke);
  return setzeEin(
    mitStil,
    `${PANEL_JS_VERWEIS}${PANEL_WV_VERWEIS}\n  ${PANEL_MARKE_VERWEIS}`,
    `<script>\n${teile.js}${wortvergleich}${marke}  </script>`,
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
