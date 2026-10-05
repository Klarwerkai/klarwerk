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
 */
export const PANEL_VOR_SCHNITT_BLOB = "3c755f6356cb1da091fdb7bba587386262d322a4";

export interface PanelTeile {
  html: string;
  css: string;
  js: string;
}

/** Die drei ausgelieferten Dateien, so wie sie im Baum liegen. */
export function panelTeile(): PanelTeile {
  return {
    html: readFileSync(repoPfad(PANEL_HTML_RELATIV), "utf8"),
    css: readFileSync(repoPfad(PANEL_CSS_RELATIV), "utf8"),
    js: readFileSync(repoPfad(PANEL_JS_RELATIV), "utf8"),
  };
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
  return setzeEin(mitStil, PANEL_JS_VERWEIS, `<script>\n${teile.js}  </script>`);
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
