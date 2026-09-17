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

/**
 * JOB 4233 · Die angefragte FASSUNG ist nicht belegt — 400 mit dem Wort `INVALID`.
 *
 * ================================================================================================
 * R2 · HIER STAND `status === 404`, UND DAS WAR EINE ERFINDUNG — BENs Korrekturpflicht 2
 * ================================================================================================
 *
 * Derselbe Endpunkt antwortet aus DREI Gründen ablehnend, und zwei davon sind „gibt es nicht":
 * die ANWEISUNG (404 `NOT_FOUND`) und die FASSUNG (400 `INVALID`). Runde 1 hat jeden 404 zur
 * Aussage über die Fassung gemacht; BEN hat gemessen, was daraus wird: verschwindet die Anweisung,
 * während das Formular offen steht, bekommt der Mensch „Diese Fassung gibt es nicht." über eine
 * Fassung, die es sehr wohl gibt — eine fachliche Ursache, die der Server nie gemeldet hat.
 *
 * Gelesen wird deshalb, WAS DER SERVER SAGT, und zwar beides: Status UND Code. Der Code allein
 * genügt nicht (die Route sendet bei unbrauchbarem Körper ebenfalls 400, aber mit `VALIDATION`),
 * der Status allein auch nicht (404 ist die Anweisung). Ein fünftes Fehlerwort gibt es nicht und
 * darf es hier nicht geben — Begründung im Kopf von `gesamtanweisung-routes.ts`.
 */
export function istUnbekannteFassung(fehler: unknown): boolean {
  return fehler instanceof ApiError && fehler.status === 400 && fehler.code === "INVALID";
}

/**
 * Der Schlüssel für die Absage AM AUFNAHMEFORMULAR — und nur dort.
 *
 * Getrennt von `fehlerSchluessel`, weil `INVALID` nur auf DIESEM Weg „diese Fassung ist nicht
 * belegt" heisst; an anderen Wegen des Gegenstands steht dasselbe Wort für andere unbrauchbare
 * Eingaben (etwa eine Reihenfolge, die nicht jeden Baustein genau einmal nennt). Ein gemeinsamer
 * Zweig würde dort einen Satz über eine Fassung behaupten, um die es gar nicht geht. Alles andere
 * gibt diese Funktion unverändert an `fehlerSchluessel` weiter; eine zweite Deutung entsteht nicht.
 */
export function aufnahmeFehlerSchluessel(fehler: unknown): string {
  return istUnbekannteFassung(fehler) ? "ga.aufnahme.fassungUnbekannt" : fehlerSchluessel(fehler);
}

/**
 * JOB 4156 R3 · Diese Instanz kann Gesamtanweisungen nicht dauerhaft ablegen.
 *
 * Der Server lehnt den Schreibvorgang ab, statt ihn zu bestätigen und beim nächsten Start zu
 * verlieren (`ANWEISUNG_ABLAGE_FLUECHTIG`, `services/app/src/build-app.ts`). GELESEN WIRD DER CODE
 * UND NICHT DER STATUS, und das ist gemessen: die Ablehnung geht heute als 400 heraus, weil die
 * Statustabelle (`services/app/src/http.ts`) unbekannte Codes auf 400 fallen lässt — derselbe
 * Status, unter dem auch `VALIDATION` und `INVALID` ankommen. Ein Zweig über den Status allein
 * behauptete dem Menschen also eine Fehleingabe, wo der Server sagt: ich kann das hier nicht halten.
 */
export function istAblageFluechtig(fehler: unknown): boolean {
  return fehler instanceof ApiError && fehler.code === "ANWEISUNG_ABLAGE_FLUECHTIG";
}

/** Der i18n-Schlüssel zu einem Fehler dieses Bereichs. Immer ein Satz, nie ein roher Code. */
export function fehlerSchluessel(fehler: unknown): string {
  // ZUERST: die Ablehnung wegen fehlender Haltbarkeit sagt etwas über die INSTANZ, nicht über den
  // Stand, die Rechte oder die Verbindung. Jeder Zweig darunter würde eine falsche Ursache nennen.
  if (istAblageFluechtig(fehler)) {
    return "ga.ablageFluechtig";
  }
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
