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
 *       umzäunt (```/~~~) oder eingerückt zitiert, urteilt damit nicht selbst — weder als Urteil
 *       noch als Sperre (R-1231).
 *   (c) DAS URTEILSFELD SELBST WIRD GELESEN. Beginnt der Wert mit NICHT oder KEIN
 *       (`GESAMTURTEIL: KEIN SACHURTEIL …`), bezeichnet der Bericht sich als Zustellsperre und ist
 *       kein Urteil (R-1362, Messmethode vom 27.08.).
 *   (d) MASCHINENURTEILE unter dem Zielnamen `CODE-PRUEFUNG-…` sind ebenso Teilurteile wie die
 *       alten `-CODE.md` (R-1440). Die Umbenennung selbst geschieht im Prüfwerkzeug, nicht hier.
 */

import { createHash } from "node:crypto";

/** Öffnender Zaun: bis drei Leerzeichen Einzug, drei oder mehr Backticks oder Tilden. */
const ZAUN_AUF = /^ {0,3}(`{3,}|~{3,})(.*)$/;

/** Schließender Zaun: bis drei Leerzeichen Einzug, nur Zaunzeichen, danach nur Leerraum. */
const ZAUN_ZU = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;

/** Eingerückter Codeblock: vier Leerzeichen oder ein Tab vor dem Inhalt. */
const EINGERUECKT = /^( {4}|\t)/;

const LEER = /^[ \t]*$/;

/** Ein einzelner Blockzitat-Marker am Zeilenanfang. */
const ZITATMARKER = /^ {0,3}> ?/;

/**
 * Wie tief die Zeile zitiert ist, und was nach den Zitatmarkern steht.
 *
 * `hoechstens` begrenzt, wie viele Marker abgenommen werden. In einem offenen Codeblock ist das
 * die Zitattiefe des Blocks: Weitere `>` sind Codeinhalt, kein neues Zitat (Nacharbeit 3).
 */
function zitatlage(
  zeile: string,
  hoechstens = Number.POSITIVE_INFINITY,
): { tiefe: number; inhalt: string } {
  let tiefe = 0;
  let inhalt = zeile;
  while (tiefe < hoechstens) {
    const marker = ZITATMARKER.exec(inhalt);
    if (!marker) break;
    inhalt = inhalt.slice(marker[0].length);
    tiefe += 1;
  }
  return { tiefe, inhalt };
}

/** Ein Listenmarker (`-`, `+`, `*`, `1.`, `1)`) mit bis drei Leerzeichen Einzug davor. */
const LISTENMARKER = /^( {0,3})([-+*]|\d{1,9}[.)])( +|$)/;

/** Führende Tabs als Leerzeichen bis zum nächsten Tabstopp (Breite 4), wie CommonMark zählt. */
function ausgerollt(zeile: string): string {
  let spalte = 0;
  let i = 0;
  while (i < zeile.length && (zeile[i] === " " || zeile[i] === "\t")) {
    spalte = zeile[i] === "\t" ? spalte + 4 - (spalte % 4) : spalte + 1;
    i += 1;
  }
  return " ".repeat(spalte) + zeile.slice(i);
}

function einzugVon(zeile: string): number {
  return /^ */.exec(zeile)?.[0].length ?? 0;
}

/**
 * Der Text ohne Markdown-Codeblöcke — was darin steht, ist zitiert, nicht geurteilt.
 *
 * Erkannt werden beide Arten nach CommonMark:
 *   - UMZÄUNT: Der Block endet erst an einem Zaun DERSELBEN Zeichenart, der MINDESTENS so lang ist
 *     wie der öffnende (```` schließt ```, ``` schließt ```` nicht). Ohne Schlusszaun reicht er
 *     bis zum Textende.
 *   - EINGERÜCKT: Zeilen mit vier Leerzeichen oder Tab Einzug nach einer Leerzeile oder am
 *     Textanfang; Leerzeilen dazwischen gehören zum Block. Direkt an einen Absatz angehängt ist
 *     eine solche Zeile Absatzfortsetzung — als Urteilsfeld zählt sie trotzdem nicht, weil
 *     `GESAMTURTEILSZEILE` höchstens drei Leerzeichen Einzug zulässt.
 *
 * BLOCKZITATE (Nacharbeit 2): Beide Arten werden auch innerhalb von `>`-Zitaten erkannt — Zaun und
 * Einzug werden HINTER den Zitatmarkern gelesen. Ein im Zitat geöffneter Zaun endet spätestens mit
 * dem Zitat: Eine Zeile mit geringerer Zitattiefe schließt ihn und wird selbst normal gelesen.
 *
 * LISTENPUNKTE (Nacharbeit 4): Ein Listenpunkt (`- `, `1. ` …) öffnet einen Behälter mit dem
 * Inhaltseinzug seines Markers; auch verschachtelt (`- - ```). Zaun und Einzug werden relativ zu
 * diesem Inhalt gelesen, ein neuer Listenpunkt beginnt wie ein Textanfang. Eine nicht leere Zeile
 * mit weniger Einzug beendet den Listenpunkt — und einen darin geöffneten Zaun; sie wird selbst
 * normal gelesen. Im offenen Block wird nur dessen eigener Einzug abgenommen.
 */
export function ohneCodebloecke(text: string): string {
  const behalten: string[] = [];
  let zaun: { zeichen: string; laenge: number; tiefe: number; einzug: number } | null = null;
  let eingerueckt = false;
  let vorherLeer = true;
  let vorherTiefe = 0;
  /** Inhaltseinzüge der offenen Listenpunkte, innen zuletzt (Spalten hinter den Zitatmarkern). */
  let listen: number[] = [];
  const teile = text.split("\n");
  for (const [i, teil] of teile.entries()) {
    const roh = i < teile.length - 1 ? `${teil}\n` : teil;
    const ohneCr = teil.replace(/\r$/, "");
    if (zaun !== null) {
      // Im offenen Block nur dessen eigenen Zitatkontext abnehmen — `> ```` darin ist Code.
      const imBlock = zitatlage(ohneCr, zaun.tiefe);
      const imZitat = imBlock.tiefe >= zaun.tiefe;
      const zeileImBlock = ausgerollt(imBlock.inhalt);
      // Ebenso nur den Einzug des Listenpunkts, in dem der Block steht.
      const imListenpunkt = LEER.test(zeileImBlock) || einzugVon(zeileImBlock) >= zaun.einzug;
      if (imZitat && imListenpunkt) {
        const zu = ZAUN_ZU.exec(zeileImBlock.slice(zaun.einzug));
        if (zu?.[1] && zu[1][0] === zaun.zeichen && zu[1].length >= zaun.laenge) {
          zaun = null;
          vorherLeer = true;
        }
        continue;
      }
      // Zitat oder Listenpunkt des Blocks enden hier, und mit ihnen der Block; die Zeile wird
      // normal gelesen.
      zaun = null;
    }
    const lage = zitatlage(ohneCr);
    const tiefe = lage.tiefe;
    if (tiefe !== vorherTiefe) {
      // Ein neuer Zitatbehälter beginnt wie ein Textanfang; ein verlassener beendet seinen Block.
      eingerueckt = false;
      listen = [];
      if (tiefe > vorherTiefe) vorherLeer = true;
      vorherTiefe = tiefe;
    }
    const hinterZitat = ausgerollt(lage.inhalt);
    let basis = 0;
    if (!LEER.test(hinterZitat)) {
      const einzug = einzugVon(hinterZitat);
      while (listen.length > 0 && (listen[listen.length - 1] ?? 0) > einzug) {
        listen.pop();
        eingerueckt = false;
      }
      basis = listen[listen.length - 1] ?? 0;
    }
    let zeile = hinterZitat.slice(Math.min(basis, einzugVon(hinterZitat)));
    if (!(EINGERUECKT.test(zeile) && (eingerueckt || vorherLeer))) {
      // Neue Listenpunkte, auch mehrere in einer Zeile (`- 1. ```).
      for (let marker = LISTENMARKER.exec(zeile); marker; marker = LISTENMARKER.exec(zeile)) {
        const vor = (marker[1] ?? "").length + (marker[2] ?? "").length;
        const abstand = (marker[3] ?? "").length;
        // Ohne Inhalt oder mit fünf und mehr Leerzeichen zählt genau eines zum Marker.
        const breite = vor + (abstand === 0 || abstand > 4 ? 1 : abstand);
        basis += breite;
        listen.push(basis);
        zeile = zeile.slice(breite);
        eingerueckt = false;
        vorherLeer = true;
      }
    }
    const auf = ZAUN_AUF.exec(zeile);
    // Ein Backtick-Zaun darf in seiner Info-Zeichenkette keinen Backtick tragen (CommonMark).
    if (auf?.[1] && !(auf[1][0] === "`" && (auf[2] ?? "").includes("`"))) {
      zaun = { zeichen: auf[1][0] as string, laenge: auf[1].length, tiefe, einzug: basis };
      eingerueckt = false;
      continue;
    }
    if (LEER.test(zeile)) {
      vorherLeer = true;
      if (!eingerueckt) behalten.push(roh);
      continue;
    }
    if (EINGERUECKT.test(zeile) && (eingerueckt || vorherLeer)) {
      eingerueckt = true;
      vorherLeer = false;
      continue;
    }
    eingerueckt = false;
    vorherLeer = false;
    behalten.push(roh);
  }
  return behalten.join("");
}

/**
 * Die Gesamturteilszeile: das Feld eröffnet die Zeile (Hervorhebung `**`/`#`/Aufzählung erlaubt),
 * der Wert folgt dahinter. Höchstens drei Leerzeichen Einzug — ab vier ist es Code oder Fortsetzung.
 * Das gilt auch hinter Blockzitat-Markern: `> GESAMTURTEIL: …` ja, `>     GESAMTURTEIL: …` nein.
 */
const GESAMTURTEILSZEILE =
  /^(?: {0,3}> ?)* {0,3}(?:[-*#]+[ \t]*)?(?:\*\*)?GESAMTURTEIL:?(?:\*\*)?:?[ \t]*(.*)$/m;

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
