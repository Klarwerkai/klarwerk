// ==================================================================================================
// JOB 4154 · DIE FEHLERDEUTUNG DIESES BEREICHS — DREI FRAGEN, EINE STELLE.
// ==================================================================================================
//
// Die ADRESSEN stehen in `api/endpoints.ts` (geteilter Katalog, additiv). Was hier wohnt, ist die
// Deutung dessen, was zurückkommt — und die braucht ihren eigenen Ort, weil sie in vier Bauteilen
// gebraucht wird und viermal abgeschrieben viermal anders wäre.
//
// DREI FRAGEN:
//   · Ist das ein Standkonflikt (409)? Dann ist der Stand veraltet, und der Mensch muss neu lesen.
//   · Ist das ein Zugriffsfehler (403)? Dann fehlen Rechte an einem gebundenen Baustein.
//   · Ist das gar keine Antwort, sondern eine fehlende Verbindung? Dann gilt „offline".
//
// ------------------------------------------------------------------------------------------------
// EINE BENANNTE GRENZE, UND SIE GEHÖRT HIERHER UND NICHT IN EINE FUSSNOTE
// ------------------------------------------------------------------------------------------------
// Der Server schickt bei 409 den NEUEN Stand mit (`{error, message, stand, version}`,
// `gesamtanweisung-routes.ts`). Beim Client kommt er NICHT an: `apiFetch` (`api/client.ts:37-44`)
// baut den `ApiError` aus genau zwei Feldern — `error` und `message` — und wirft den Rest des
// Körpers weg. `client.ts` gehört nicht zu diesem Auftrag.
//
// Die Fläche behauptet deshalb NICHT, den neuen Stand zu kennen. Sie sagt, was wahr ist („Die
// Anweisung wurde zwischenzeitlich geändert. Bitte neu laden …") und lädt neu. Eine erfundene
// Versionsnummer wäre schlimmer als keine.
import { ApiError } from "../../api/client";

/** Der Stand, auf dem geschrieben werden sollte, ist nicht mehr der aktuelle. */
export function istStandkonflikt(fehler: unknown): boolean {
  return fehler instanceof ApiError && fehler.status === 409;
}

/** Ein gebundener Baustein ist für diesen Betrachter nicht zugänglich. */
export function istZugriffsfehler(fehler: unknown): boolean {
  return fehler instanceof ApiError && fehler.status === 403;
}

/**
 * Keine Antwort erhalten.
 *
 * Ein `ApiError` heisst: der Server hat geantwortet, wenn auch ablehnend. Alles andere — ein
 * `TypeError` aus `fetch`, ein abgebrochener Vorgang — heisst: wir haben keine Antwort.
 *
 * HIER STAND EIN `navigator.onLine`-ZUGRIFF UND IST ERSATZLOS WEG. `tests/kollision-netztrennung/
 * eine-quelle-waechter.test.ts` (W-5) hält fest, dass der Onlinezustand im ganzen Haus GENAU EINMAL
 * verdrahtet ist; diese Datei wäre die dritte Stelle gewesen. Der Wächter hat recht, und die Zeile
 * war auch überflüssig: die Fläche bekommt ihren Offline-Zustand ausdrücklich übergeben
 * (`GesamtanweisungSeite`, Eigenschaft `offline`), und ein Fehler, der KEIN `ApiError` ist, heisst
 * ohnehin schon „keine Antwort". Der Browser wurde hier also ein zweites Mal nach etwas gefragt,
 * das die Hülle längst wusste.
 */
export function istOhneVerbindung(fehler: unknown): boolean {
  if (fehler instanceof ApiError) {
    // TIMEOUT: der Client hat abgebrochen — er weiss nicht, ob der Server fertig wurde.
    return fehler.status === 408;
  }
  return fehler != null;
}

/** Der i18n-Schlüssel zu einem Fehler dieses Bereichs. Immer ein Satz, nie ein roher Code. */
export function fehlerSchluessel(fehler: unknown): string {
  if (istStandkonflikt(fehler)) {
    return "ga.entscheidung.konflikt";
  }
  if (istZugriffsfehler(fehler)) {
    return "ga.unvollstaendig";
  }
  if (istOhneVerbindung(fehler)) {
    return "ga.offline";
  }
  return "ga.fehler";
}
