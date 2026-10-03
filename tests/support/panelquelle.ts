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
// (`PANEL_VOR_SCHNITT_BLOB`) — nachprüfbar ohne diesen Test mit
// `git rev-parse 3b79c5d1:apps/web/public/word-addin/taskpane.html`.
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
 * Git-Blob-Kennung von `apps/web/public/word-addin/taskpane.html` am Basisstand `3b79c5d1` — also
 * der EINEN Datei unmittelbar vor dem Schnitt.
 */
export const PANEL_VOR_SCHNITT_BLOB = "95226f6582e51480973024e16e1cf4d132fb80c0";

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
