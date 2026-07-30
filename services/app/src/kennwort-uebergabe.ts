// ================================================================================================
// AUFTRAG-mega65 BLOCK A — EINE ZUSAGE ÜBER EINEN KANAL WIRD AM KANAL BELEGT, NICHT AN DER
// ERWARTETEN NUTZUNG.
// ================================================================================================
//
// Hier stand die Lehre aus bens sammel62, ROT-1, und sie ist die dritte ihrer Art in dieser Woche:
// `seed.ts` erklärte richtig, dass `JSON.stringify(result)` „in jedem CI-Mitschnitt, jeder
// Terminalhistorie und jedem Container-Log" landet — und gab die Einmalkennwörter danach über
// GENAU DENSELBEN Kanal aus. `console.warn` schreibt nach `stderr`. Die Unterscheidung zwischen
// „Protokoll" und „Ausgabe", auf der der alte Kommentar beruhte, existiert technisch nicht; der
// tragende Satz war „wer diesen Befehl aufruft, sitzt davor", und das ist eine Annahme über den
// Bedienenden, keine Eigenschaft des Kanals.
//
// DESHALB DIESER KANAL: `/dev/tty` ist das KONTROLLIERENDE TERMINAL des Prozesses. Es ist nicht
// `stdout` und nicht `stderr`, sondern eine eigene Gerätedatei — eine Umleitung (`> log.txt`,
// `2>&1 | tee`) fängt es nicht ein, weil sie die Dateideskriptoren 1 und 2 ersetzt und diesen hier
// nicht kennt. Das ist keine Annahme, sondern nachmessbar (s. Bericht zu mega65).
//
// UND DIE FEHLRICHTUNG IST DIE RICHTIGE: Wo es kein kontrollierendes Terminal gibt — im CI, im
// Container, in einer Pipeline, unter Windows —, schlägt bereits das Öffnen fehl (ENXIO bzw.
// ENOENT). Der Befehl schreibt dann NICHTS und sagt es (s. `seed.ts`). Ein Kanal, der bei
// Abwesenheit eines Menschen versagt statt still mitzuschreiben, ist genau der Kanal, den eine
// einmalige Übergabe braucht.
//
// WARUM NICHT DIE DATEI MIT RECHTEN 0600, die als zweiter Weg zur Wahl stand: Sie wäre
// plattformsicherer (auch Windows) und einfacher zu belegen. Sie hinterlässt aber Klartext-
// Zugangsdaten auf der Platte, und ab da hängt die Zusage an einem Aufräumschritt, den jemand tun
// muss — an derselben Sorte Annahme über den Bedienenden also, an der ROT-1 gescheitert ist. Dazu
// kämen Sicherungen, Ordnersynchronisierung und ein `.gitignore`-Eintrag, der ein Netz ist und kein
// Aufräumen. Die Reißleine im Auftrag nennt die Alternative ausdrücklich: „eine frisch geseedete
// Instanz ohne Zugang ist ein bedienbares Problem, ein Kennwort im Log ist keines." Deshalb hier
// das Terminal — und bei dessen Abwesenheit der Verweis auf den Adminweg, nicht die Platte.
//
// ================================================================================================
// AUFTRAG-mega66 BLOCK A — UND DER ERFOLG DES KANALS WIRD AUCH GEMESSEN, NICHT ANGENOMMEN.
// ================================================================================================
//
// bens ROT-1 aus sammel63 ist DIESELBE FEHLERKLASSE wie die oben beschriebene, nur eine Ebene
// tiefer: nicht der Kanal war angenommen statt gemessen, sondern SEIN ERFOLG. `writeSync` liefert
// die Zahl der TATSÄCHLICH geschriebenen Bytes. Der Helfer rief es einmal auf, verwarf den
// Rückgabewert und meldete `true`. Ein gültiger Teil-Write ohne Ausnahme hieß damit: nur ein Präfix
// der Zugangsliste steht am Terminal, der Lauf meldet Erfolg, setzt keinen Fehlercode, nennt keinen
// Weg zurück — und die fehlenden Kennwörter sind unbekannt, weil sie nirgends sonst stehen.
//
// DESHALB DIE SCHLEIFE ÜBER DEN BYTE-OFFSET. Und deshalb ein `Buffer` und kein String: der Text
// trägt Umlaute („Einmalkennwörter"), ein Byte-Offset kann also mitten in eine Mehrbytefolge
// fallen. Wer die Schleife über einen String führt und dort „den Rest" nachschiebt, zerlegt genau
// dort ein Zeichen oder schreibt zu viel. Und wer bei einem Teil-Write den GANZEN String erneut
// schreibt, dupliziert bereits übertragene Kennwörter — das ist der Weg, den ben ausdrücklich
// ausschließt.
import { closeSync, openSync, writeSync } from "node:fs";

/** Das kontrollierende Terminal. Bewusst als Konstante: der Kanal ist die Zusage. */
export const TERMINAL = "/dev/tty";

/**
 * Schreibt die Zeilen auf das kontrollierende Terminal — und NUR dorthin.
 *
 * @returns `true`, wenn **alle** Bytes der Zeilen von `writeSync` angenommen wurden; `false`
 *   sonst — es gibt kein kontrollierendes Terminal, oder es hat den Text nicht vollständig
 *   angenommen. Bei `false` kann ein PRÄFIX am Terminal stehen; die Übergabe hat trotzdem nicht
 *   stattgefunden, und der Aufrufer muss das sagen, statt auf einen anderen Kanal auszuweichen.
 *
 *   DER VERTRAG IST BEWUSST GENAU SO ENG (bens GELB-1 aus sammel63): „alle Bytes wurden von
 *   `writeSync` angenommen" — nicht „sie sind sichtbar", nicht „der Deskriptor wurde saubergelegt".
 *   Ein Fehlschlag beim `closeSync` macht die Bytes nicht ungeschrieben; am Terminal sind sie zu
 *   diesem Zeitpunkt beim Gerät. Er wird deshalb NICHT zum Fehlschlag erklärt — aber es steht hier,
 *   und die Zusage reicht nicht weiter als dieser Satz.
 */
export function amTerminalUebergeben(zeilen: readonly string[]): boolean {
  // Ein Puffer, EINMAL erzeugt: die Schleife unten zählt Bytes, und nur an einem Puffer ist ein
  // Byte-Offset eine wohldefinierte Stelle.
  const puffer = Buffer.from(`${zeilen.join("\n")}\n`, "utf8");
  let griff: number | null = null;
  try {
    griff = openSync(TERMINAL, "w");
    let offset = 0;
    while (offset < puffer.length) {
      const angenommen = writeSync(griff, puffer, offset, puffer.length - offset);
      if (angenommen <= 0) {
        // Ein Kanal, der nichts mehr annimmt, ist kein Kanal. Hier wird NICHT weitergedreht: ein
        // erneuter Versuch am selben Offset wäre eine Endlosschleife, und ein Sprung nach vorn
        // wäre eine Lücke mitten in einem Kennwort.
        return false;
      }
      offset += angenommen;
    }
    return true;
  } catch {
    // Kein Terminal (CI, Container, Pipeline, Windows), oder der Kanal bricht mitten im Schreiben
    // ab. Auch dann gilt die Übergabe als nicht stattgefunden — durchgekommene Bytes sind keine
    // übergebene Liste. Kein Rückfall auf `stdout`/`stderr`: das wäre der Befund von ROT-1 in
    // einer anderen Zeile.
    return false;
  } finally {
    if (griff !== null) {
      try {
        closeSync(griff);
      } catch {
        // Ein nicht geschlossener Deskriptor endet mit dem Prozess — der Befehl ist ein CLI-Lauf.
        // Und er ändert nichts an der oben verengten Zusage; s. JSDoc.
      }
    }
  }
}
