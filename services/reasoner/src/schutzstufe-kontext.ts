// ================================================================================================
// KI-WAHL-BETRIEBSABNAHME · Antwort 29 — DIE SCHUTZSTUFE EINES LAUFS, VON DER ROUTE BIS VOR DEN AUFRUF.
// ================================================================================================
//
// Die Einstufung eines Textes bestimmt die ROUTE serverseitig (`reasoner-routes.ts`,
// `resolveProvenance`: Deklaration, gespeicherter Entwurf, gespeichertes KO, Klara-Riegel). Bis zum
// Reasoner reiste davon bisher nur ein Bit (`confidential`). Für die Anbieterwahl JE STUFE braucht
// der Reasoner die Stufe selbst — `vertraulich` und `streng_vertraulich` dürfen verschieden
// zugeordnet sein.
//
// WARUM EIN RAHMEN JE ANFRAGE UND KEIN WEITERER PARAMETER: Die Stufe muss an JEDER Stelle ankommen,
// an der eine Kette gebildet wird — auch in Wegen, die über Zwischendienste laufen (Ask → Reasoner).
// Ein Parameter durch alle Signaturen wäre eine zweite Wahrheit neben dem Bit, die an jeder
// vergessenen Stelle still fehlte. Dieselbe Bauform wie `imBindungsrahmen` (`anbieterbindung.ts`):
// die Route öffnet den Rahmen im `onRequest`-Hook, trägt die Stufe dort ein, wo sie die Einstufung
// entscheidet, und der Reasoner liest sie an EINER Stelle (`Reasoner.wahlFuerLauf`).
//
// WAS GILT, WENN KEINE STUFE GESETZT IST (Hintergrundwege, fremde Aufrufer, Anfragen ohne Rahmen):
// dann entscheidet im Reasoner das Bit, und zwar fail-safe — `confidential=false` liest die Wahl für
// „intern", `confidential=true` die strengere der beiden vertraulichen Stufen („Keine KI" gewinnt).
// So erreicht „Keine KI" auch Aufrufe, die ihre genaue Stufe nicht kennen.
import { AsyncLocalStorage } from "node:async_hooks";
import type { ReasonerSchutzstufe } from "./types";

const anfrageRahmen = new AsyncLocalStorage<{ stufe: ReasonerSchutzstufe | undefined }>();

/** Öffnet den Rahmen einer Anfrage; darin ist zunächst KEINE Stufe gesetzt. */
export function imSchutzstufenRahmen<T>(lauf: () => T): T {
  return anfrageRahmen.run({ stufe: undefined }, lauf);
}

/**
 * Trägt die serverseitig bestimmte Stufe in den Rahmen der laufenden Anfrage ein. `null` heisst
 * „nicht benennbar" (dann entscheidet im Reasoner das Bit, fail-safe). Ohne Rahmen: wirkungslos.
 */
export function setzeSchutzstufe(stufe: ReasonerSchutzstufe | null): void {
  const rahmen = anfrageRahmen.getStore();
  if (rahmen) {
    rahmen.stufe = stufe ?? undefined;
  }
}

/** Die Schutzstufe der laufenden Anfrage — oder `undefined`, wenn keine gesetzt ist. */
export function aktuelleSchutzstufe(): ReasonerSchutzstufe | undefined {
  return anfrageRahmen.getStore()?.stufe;
}
