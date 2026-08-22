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
import type { LesemodellService } from "./lesemodell";
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
    ...(opts.deckel !== undefined ? { deckel: opts.deckel } : {}),
  });
  return sichtmetrik(sicht);
}
