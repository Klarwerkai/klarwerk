// JOB 593 / Ownerentscheidung vom 13.08.2026 (Option A): `KnowledgeObject.asset` ist die
// KANONISCHE Anlagenkennung. Reiner, zustandsloser Helfer im Hausmuster von `confidentiality.ts` —
// kleine Datei, ausgeschriebene Begründung, keine Abhängigkeit außer dem Typ.
//
// WARUM ES IHN GIBT. `selectCandidates` entscheidet über „dieselbe Anlage" mit einem
// zeichengenauen Vergleich: `c.asset === subject.asset` (services/conflicts/src/detect.ts:126).
// Legt der Bestand denselben Betriebsbegriff in mehreren Schreibweisen ab, ist er keine
// kanonische Quelle, sondern mehrere — und die Konflikterkennung findet die Doppelpflege nie,
// die zu finden ihr einziger Zweck ist. Der Browser trimmte bisher als Einziger; jeder Weg ohne
// Browser (Word-Add-in, Import, Seed, API) schrieb roh.
//
// DIE ENTSCHEIDUNG DAHINTER, in Pedis Worten zu JOB 671: EINE Stelle vergibt Identität. Deshalb
// steht die Regel hier und nicht an jedem Schreibrand einzeln.
import type { KnowledgeObject } from "./types";

/**
 * Bringt eine Anlagenkennung auf die Normalform — die EINZIGE Form, in der sie gespeichert wird.
 *
 * Drei Schritte, jeder mit einem Grund:
 *
 *  1. **NFC.** „Fräse" gibt es als ein Zeichen (U+00E4) und als a + Trema (U+0061 U+0308). Auf
 *     dem Schirm sind sie nicht zu unterscheiden, im Vergleich schon. Ohne diesen Schritt wären
 *     es zwei Anlagen, und niemand könnte sehen, warum. Dieselbe Regel wie K3 der
 *     Vorgangs-Kanonisierung (document-create.ts:168).
 *  2. **Leerraum innen auf EIN Zeichen.** `\s` deckt dabei auch das geschützte Leerzeichen
 *     (U+00A0) ab, das jede Einfügung aus Word oder Excel mitbringt. Bei einer KENNUNG ist
 *     mehrfacher Leerraum kein Inhalt, sondern Rauschen — anders als in einem Absatz, weshalb
 *     K3 für Fließtext bewusst NICHT innen normalisiert.
 *  3. **Außen trimmen, leer wird `null`.** Damit gibt es im Bestand genau zwei Zustände: eine
 *     Kennung oder keine. Nie einen leeren String, der sich wie eine Kennung anfühlt und in
 *     `Boolean(subject.asset)` (detect.ts:126) doch als „keine" zählt.
 *
 * WAS SIE AUSDRÜCKLICH NICHT TUT, und das ist eine Entscheidung, kein Vergessen:
 *
 *  - **Keine Kleinschreibung.** Bei Anlagenkennungen trägt Groß-/Kleinschreibung Bedeutung
 *    („DP-4" ist nicht „dp-4"). Eine Faltung wäre eine VERGLEICHSREGEL, keine SPEICHERFORM —
 *    sie würde echte Unterschiede einebnen und gehört nicht in diese Scheibe.
 *  - **Keine Zeichenersetzung, kein Formatzwang, keine Vorzugsliste.** Was ein Betrieb
 *    „Linie L4 / Dosierstation DP-4" nennt, bleibt genau das.
 *
 * Entfernt wird ausschließlich Leerraum, der keine Bedeutung tragen kann.
 */
export function normalizeAsset(value: unknown): KnowledgeObject["asset"] {
  if (typeof value !== "string") {
    return null;
  }
  const normalisiert = value.normalize("NFC").replace(/\s+/g, " ").trim();
  return normalisiert.length > 0 ? normalisiert : null;
}
