// H3-LUECKEN · JOB 1577 D7 — DER EINZIGE OEFFENTLICHE WEG ZU EINER SICHTMETRIK.
//
// KORREKTUR ZU D6: Der Einstieg nimmt jetzt den BETRACHTER entgegen. Das ist kein Praedikat und
// kein Bypass — es ist die Angabe, FUER WEN gefiltert wird. Ohne sie kann `darfSehen(user, ko)`
// nicht aufgerufen werden, und die Naht liesse sich mit Weg B gar nicht schliessen (D6 hatte
// genau diesen Bruch, BEN hat ihn gefunden).
//
// Die Sicherheitszusagen bleiben unveraendert:
//   · Die Sicht wird NICHT entgegengenommen, sondern hier erzeugt.
//   · Das Praedikat ist KEIN Parameter — nicht als Argument, nicht im Optionsobjekt, nicht
//     hinter einem Vorgabewert. Es kommt aus der Naht und ist von aussen nicht ersetzbar.
//   · Ist die Naht offen, entsteht gar keine Sicht (fail-closed), und zwar VOR dem ersten Lesen.
import { type LesemodellDeps, LesemodellService } from "./lesemodell";
import type { WissensnetzKo } from "./lesemodell-ports";
import { type Sichtmetrik, sichtmetrik } from "./luecken";
import { type Betrachter, policyFuer } from "./policy-naht";

/**
 * Erhebt die rohe Sichtmetrik fuer GENAU DIESEN Betrachter.
 *
 * Der Name traegt den Anker `H3-LUECKEN`; der RUECKGABEWERT ist bewusst semantikneutral
 * (`Sichtmetrik`, nicht `LueckenBefund`) — was fachlich als Luecke zaehlt, ist offen und wird
 * hier nicht entschieden.
 *
 * @param betrachter fuer wen gefiltert wird — kein Praedikat, sondern der Kontext
 * @param lesemodell kommt aus der Kompositionswurzel; ein Consumer kann es nicht selbst bauen,
 *                   weil `LesemodellService` nicht im Paket-Index steht
 * @param opts       traegt NUR den Deckel
 */
export async function wissensnetzLuecken<K extends WissensnetzKo>(
  betrachter: Betrachter,
  lesemodell: LesemodellService<K>,
  opts: { readonly deckel?: number } = {},
): Promise<Sichtmetrik> {
  // Wirft, solange die Naht offen ist — bevor irgendetwas gelesen wird.
  const sichtbar = policyFuer<K>(betrachter);
  const sicht = await lesemodell.sicht({
    sichtbar,
    mitVerknuepfung: true,
    // JOB 2600 D1: Die Themenkarte reist auf DIESEM Weg — durch dieselbe Naht, dieselbe Policy,
    // dieselbe getrimmte Menge. Sie bekommt bewusst KEINEN eigenen Einstieg und KEINE eigene
    // Route: eine zweite Lesequelle waere genau das, was Codex' Auflage verbietet, und ein
    // zweiter Weg an dieser Naht vorbei waere die zweite Wahrheit, gegen die dieses Modul gebaut
    // ist. Wer die Metrik lesen darf, sieht die Karte desselben Bestands.
    mitThemenkarte: true,
    ...(opts.deckel !== undefined ? { deckel: opts.deckel } : {}),
  });
  return sichtmetrik(sicht);
}

// ================================================================================================
// JOB 2009 · D2 — DER WEG, DEN EIN AUFRUFER GEHEN KANN.
// ================================================================================================
//
// DAS PROBLEM, gemessen in D1: `wissensnetzLuecken` verlangt ein fertiges `LesemodellService` —
// und genau das darf ein Consumer nicht bauen, weil es nicht im Paket-Index steht
// (`h3-consumer-typvertrag.test.ts` C1 haelt das fest, und die Enge ist gewollt: sonst koennte
// jemand `sicht({ sichtbar: () => true })` bauen). Ergebnis: Der einzige oeffentliche Weg des
// Moduls war fuer jeden Aufrufer unerreichbar — H3 hatte nach vierzehn Durchgaengen keinen Leser.
//
// DIE AUFLOESUNG: Der Consumer bringt die PORTS mit, nicht das Lesemodell. Er kann damit
//   · keine ungefilterte Sicht erzeugen — das Lesemodell entsteht hier drinnen, und die Sicht
//     wird weiterhin ausschliesslich von `wissensnetzLuecken` erzeugt;
//   · keine vorhandene Sicht auswerten — `sichtmetrik` und `WissensnetzSicht` bleiben modulintern.
// Die beiden Zusagen aus `index.ts:10-12` gelten unveraendert. Was sich oeffnet, ist genau ein
// Loch in der Groesse eines Aufrufs.
//
// C1 UND C2 BLEIBEN WOERTLICH GRUEN: `LesemodellService` und `WissensnetzSicht` stehen weiterhin
// NICHT im Index. Was hinzukommt, sind die PORT-Typen — Leseschnittstellen auf den Bestand, keine
// Sicht und keine Auswertung.
/**
 * Erhebt die Sichtmetrik fuer genau diesen Betrachter — aus den PORTS des Aufrufers.
 *
 * Der Aufrufer liefert, woher gelesen wird (`deps.kos`, optional `deps.kanten`); das Lesemodell
 * entsteht hier und verlaesst diese Funktion nicht. Die Sichtbarkeit kommt weiterhin
 * ausschliesslich aus der Naht.
 */
export async function wissensnetzMetrikFuer<K extends WissensnetzKo>(
  betrachter: Betrachter,
  deps: LesemodellDeps<K>,
  opts: { readonly deckel?: number } = {},
): Promise<Sichtmetrik> {
  return wissensnetzLuecken(betrachter, new LesemodellService<K>(deps), opts);
}
