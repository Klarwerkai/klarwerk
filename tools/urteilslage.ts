/**
 * urteilslage — liest aus einem Prüfbericht ab, WAS er sagt, und aus einer Auftragsdatei, ob der
 * Bericht sich seit dem Zitat GEÄNDERT hat.
 *
 * ANLASS (JOB 2524 D1). Zwei Fragen dieses Durchgangs hängen an derselben Ablesung:
 * „Ändern sich Prüfberichte?" und „Trug der Bericht damals ein Sachurteil?" Die bisher dafür
 * benutzte Ablesung war falsch, und zwar messbar falsch: Das Raster
 *
 *     /NICHT BEURTEILT|ZUSTELLUNG UNVOLLST|KEIN SACHURTEIL|NICHT ERTEILT|NICHT ABGEGEBEN/i
 *
 * — übernommen in JOB 2500 und in JOB 2511 festgeschrieben — hielt in 313 von 492 Fällen
 * (63,6 %) gewöhnliche Prosa für eine Zustellsperre. Der Grund ist das abschließende `i`:
 * Jeder BEN-Bericht trägt einen Standardabschnitt
 *
 *     NICHT GEPRÜFT: … Nicht beurteilt sind Produktzustände außerhalb des Prüfpakets …
 *
 * und dort ist „nicht beurteilt" gewöhnliches Deutsch, kein Urteilswert. Dieselbe Fehlerart wie
 * `\bNEU\b` in JOB 2511: ein Formularwort und ein Alltagswort werden verwechselt.
 *
 * DIE REGEL HIER trennt beide an zwei Merkmalen, und nur beide zusammen tragen:
 *
 *   1. GROSSSCHREIBUNG — die Sperre ist ein Formularwert und wird groß geschrieben; die Prosa
 *      ist gewöhnliches Deutsch. Kein `i`.
 *   2. URTEILSZEILE — sie steht auf einem urteilstragenden Feld (`PRODUKT:`, `FORM:` …) oder
 *      eröffnet die Zeile selbst (`ZUSTELLUNG UNVOLLSTÄNDIG — es fehlen:`). Die Abschnitte
 *      `NICHT GEPRÜFT:` und `HINWEISE (ohne Urteilswirkung):` sind ausdrücklich keine — der
 *      zweite sagt es im eigenen Namen.
 *
 * Am Bestand von 2685 Berichten gemessen: 179 echte Sperren, 313 Fehlalarme beseitigt,
 * 0 Fälle übersehen (kein Bericht, den das alte Raster fing und dieses nicht).
 *
 * WAS DIESE REGEL NICHT KANN: Sie liest den HEUTIGEN Text. Ob ein Bericht früher etwas anderes
 * sagte, steht in keiner Datei — dafür ist `hatSichGeaendert` da, und auch das nur, wenn ein
 * Auftrag den SHA-256 des Berichts nennt.
 *
 * HÄRTUNGEN (Auftrag aufnahme:20260922:gesamt-pruefdienst, R-1231/R-1362/R-1379/R-1440):
 *
 *   (a) NUR DIE ZEILE `GESAMTURTEIL: GRÜN|ROT` BELEGT EIN URTEIL. Vorher genügte das Wort
 *       `GESAMTURTEIL` irgendwo im Text — auch „GESAMTURTEIL fehlt" oder eine Erwähnung in der
 *       Prosa. Eine Dimensionszeile (`PRODUKT:`, `FORM:` …) ersetzt ein fehlendes Gesamturteil
 *       nicht (R-1231, R-1379: „165 Dateien heissen wie ein Urteil und enthalten keines").
 *   (b) MARKDOWN-CODEBLÖCKE ZÄHLEN NICHT. Ein Bericht, der ein fremdes Urteil oder eine Vorlage
 *       in ``` zitiert, urteilt damit nicht selbst — weder als Urteil noch als Sperre (R-1231).
 *   (c) DAS URTEILSFELD SELBST WIRD GELESEN. Beginnt der Wert mit NICHT oder KEIN
 *       (`GESAMTURTEIL: KEIN SACHURTEIL …`), bezeichnet der Bericht sich als Zustellsperre und ist
 *       kein Urteil (R-1362, Messmethode vom 27.08.).
 *   (d) MASCHINENURTEILE unter dem Zielnamen `CODE-PRUEFUNG-…` sind ebenso Teilurteile wie die
 *       alten `-CODE.md` (R-1440). Die Umbenennung selbst geschieht im Prüfwerkzeug, nicht hier.
 */

import { createHash } from "node:crypto";

/** Ein Markdown-Codeblock: Zaun aus drei oder mehr Backticks oder Tilden bis zum gleichen Zaun. */
const CODEBLOCK = /^[ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^[ \t]*\1[ \t]*$|(?![\s\S]))/gm;

/** Der Text ohne Markdown-Codeblöcke — was darin steht, ist zitiert, nicht geurteilt. */
export function ohneCodebloecke(text: string): string {
  return text.replace(CODEBLOCK, "");
}

/**
 * Die Gesamturteilszeile: das Feld eröffnet die Zeile (Hervorhebung `**`/`#`/Aufzählung erlaubt),
 * der Wert folgt dahinter.
 */
const GESAMTURTEILSZEILE =
  /^[ \t]*(?:[-*>#]+[ \t]*)?(?:\*\*)?GESAMTURTEIL:?(?:\*\*)?:?[ \t]*(.*)$/m;

export type Gesamturteil = "GRÜN" | "ROT";

/**
 * Das Gesamturteil eines Berichts — oder `null`, wenn er keines trägt.
 *
 * `null` heißt ausdrücklich NICHT „rot": Ein Bericht ohne Gesamturteilszeile, mit einem Feldwert,
 * der mit NICHT/KEIN beginnt, oder mit einem Urteil nur im Codeblock hat nicht geurteilt.
 */
export function gesamturteil(text: string): Gesamturteil | null {
  const zeile = GESAMTURTEILSZEILE.exec(ohneCodebloecke(text));
  const wert = (zeile?.[1] ?? "").replace(/^[*_`\s]+/, "");
  if (/^(NICHT|KEIN)\b/.test(wert)) return null;
  if (/^(GRÜN|GRUEN)\b/.test(wert)) return "GRÜN";
  if (/^ROT\b/.test(wert)) return "ROT";
  return null;
}

/** Die fünf Formularwörter, mit denen ein Prüfer die Sache ausdrücklich offen lässt. */
const SPERRWORT =
  /NICHT BEURTEILT|ZUSTELLUNG UNVOLLST|KEIN SACHURTEIL|KEIN SUBSTANZURTEIL|NICHT ERTEILT|NICHT ABGEGEBEN/;

/** Felder, deren Zeile ein Urteil trägt. */
const URTEILSFELD = /^(GESAMTURTEIL|PRODUKT|FORM|SUBSTANZURTEIL|CODE-URTEIL|DURCHGANGSBINDUNG):/;

/** Abschnitte, die ausdrücklich KEIN Urteil tragen — der zweite sagt es selbst im Namen. */
const OHNE_URTEILSWIRKUNG = /^(NICHT GEPRÜFT|NICHT GEPRUEFT|HINWEISE)\b/;

/** Wie weit vorn in der Zeile ein Sperrwort stehen muss, um sie zu eröffnen. */
const ZEILENANFANG = 26;

/**
 * Die Zeilen, mit denen der Bericht die Sache ausdrücklich offen lässt — im Wortlaut.
 * Leer heißt: keine Zustellsperre.
 */
export function sperrzeilen(text: string): string[] {
  const treffer: string[] = [];
  for (const roh of ohneCodebloecke(text).split("\n")) {
    const zeile = roh.trim();
    if (OHNE_URTEILSWIRKUNG.test(zeile)) continue;
    if (!SPERRWORT.test(zeile)) continue;
    if (URTEILSFELD.test(zeile) || SPERRWORT.test(zeile.slice(0, ZEILENANFANG))) {
      treffer.push(zeile);
    }
  }
  return treffer;
}

/** Trägt der Bericht eine Zustellsperre? */
export function hatZustellsperre(text: string): boolean {
  return sperrzeilen(text).length > 0;
}

/**
 * Ein `-CODE.md` stammt von `kw_pruefer.py` — ein Skript, kein Prüfer. Es trägt zwar ein
 * `GESAMTURTEIL`, ist aber ein Teilurteil über den Code und nie ein Sachurteil über das Produkt.
 * Der angenommene neue Name `CODE-PRUEFUNG-…` (R-1440) gilt ebenso.
 */
export function istTeilurteil(dateiname: string): boolean {
  return /-CODE\.md$/.test(dateiname) || /^CODE-PRUEFUNG-/.test(dateiname);
}

/**
 * Trägt der Bericht ein Sachurteil über das Produkt?
 *
 * Der naheliegende Positivtest — „steht im Feld `PRODUKT:` ein ROT oder GRÜN?" — genügt NICHT:
 * 160 der 169 echten Sperren schreiben `PRODUKT: ROT — NICHT BEURTEILT: …`. Der Feldwert ist
 * dort ROT, die Begründung dahinter nimmt ihn zurück. Deshalb wird beides gelesen.
 */
export function hatSachurteil(dateiname: string, text: string): boolean {
  if (istTeilurteil(dateiname)) return false;
  if (gesamturteil(text) === null) return false;
  return !hatZustellsperre(text);
}

/** Ein Zitat aus einer Auftragsdatei: „dieser Bericht hatte in diesem Augenblick diesen Inhalt". */
export interface Berichtszitat {
  readonly bericht: string;
  readonly sha: string;
}

const ZITAT = /(BEN-PRUEFUNG-JOB-\d+-D\d+(?:-CODE)?\.md)`?\s*SHA(?:-256)?:?\s*`?([0-9a-f]{64})/g;

/** Alle Bericht-plus-SHA-Zitate einer Auftragsdatei. Jedes ist eine datierte Behauptung. */
export function zitateAus(auftragstext: string): Berichtszitat[] {
  const gefunden: Berichtszitat[] = [];
  for (const t of auftragstext.matchAll(ZITAT)) {
    const bericht = t[1];
    const sha = t[2];
    // Beide Gruppen sind im Muster nicht optional; die Prüfung hält den Typvertrag ein,
    // ohne ihn per Zusicherung zu umgehen.
    if (bericht === undefined || sha === undefined) continue;
    gefunden.push({ bericht, sha });
  }
  return gefunden;
}

/**
 * Hat sich der Bericht seit dem Zitat geändert?
 *
 * `null` heißt „nicht entscheidbar" — der zitierte Bericht liegt nicht vor. Das ist keine
 * Änderung und darf nicht als eine gezählt werden.
 */
export function hatSichGeaendert(
  zitat: Berichtszitat,
  heutigerInhalt: Buffer | null,
): boolean | null {
  if (heutigerInhalt === null) return null;
  return createHash("sha256").update(heutigerInhalt).digest("hex") !== zitat.sha;
}
