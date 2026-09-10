import type { KnowledgeObject, KoVersionSnapshot } from "../api/types";
import { htmlToPlainText } from "./richText";

export type KoVersionDiffField =
  | "title"
  | "statement"
  | "conditions"
  | "measures"
  | "type"
  | "status"
  // JOB 3475 · UX-28: der ausführliche Bericht (`api/types.ts:337`) ist das SIEBTE verglichene Feld.
  // Bis hierher verglich diese Datei sechs — wer nur den Bericht überarbeitete, las danach auf der
  // Fassungskarte „Keine Änderung in den Hauptfeldern" (`MehrAbschnitte.tsx`). Das war keine
  // Ungenauigkeit, sondern eine falsche Verneinung über den gespeicherten Stand.
  | "bodyHtml";

export interface KoVersionDiff {
  fromVersion: number | null;
  toVersion: number;
  changed: KoVersionDiffField[];
}

function norm(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((v) => String(v).trim())
      .filter(Boolean)
      .join("\n");
  }
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

// ================================================================================================
// JOB 3475 · UX-28 — WORAUF DER BERICHT VERGLICHEN WIRD, UND WARUM AUF DEM ROH-HTML.
// ================================================================================================
//
// `norm` darüber glättet nur Leerraum. Für die sechs Kernfelder trägt das; für HTML nicht: dieselbe
// Absatzfolge, einmal eingerückt gespeichert und einmal nicht, wäre damit eine INHALTSänderung.
// Deshalb glättet diese Regel zusätzlich den Leerraum ZWISCHEN den Tags.
//
// RUNDE 2 · KORREKTURPFLICHT 1 (BEN): DER LEERRAUM, DEN MAN SIEHT, DARF NICHT MITGEGLÄTTET WERDEN.
//
// Runde 1 entfernte den Leerraum zwischen ALLEN Tags. Damit galt
//     `<strong>nicht</strong> <em>freigeben</em>`  ==  `<strong>nicht</strong><em>freigeben</em>`
// als unverändert — obwohl der Leser dort „nicht freigeben" gegen „nichtfreigeben" vor sich hat.
// Zwischen BLOCKelementen trägt Leerraum keine Bedeutung (der Absatz beginnt ohnehin neu), zwischen
// INLINE-Elementen ist er Text. Die alte Regel kannte den Unterschied nicht.
//
// DER SCHLÜSSEL EINES BERICHTS HAT DESHALB ZWEI TEILE, und geändert ist, was in EINEM davon
// abweicht:
//   1. DER SICHTBARE TEXT über `htmlToPlainText` (`richText.ts:450`) — die EINE Textreduktion
//      dieses Hauses, gepinnt gegen ihr Server-Original. Sie setzt genau an den Blockenden
//      (`</p>`, `</li>`, `</td>`, `<br>`, …) ein Leerzeichen ein und entfernt sonst nur Tags;
//      damit fällt Einrückung zwischen Blöcken zusammen, und der Leerraum zwischen zwei
//      Inline-Elementen bleibt stehen. Eine EIGENE Block/Inline-Aufstellung wäre eine zweite
//      Wahrheit über dieselbe Frage — die Doppelung, gegen die dieses Haus mehrfach angetreten ist.
//   2. DAS MARKUP ohne Leerraum zwischen Tags — es fängt, was der Text nicht sieht: eine
//      Formatierung mehr, ein anderes Bild, ein anderes Verweisziel.
//
// DIE EINGEORDNETEN FÄLLE, ausdrücklich und in beide Richtungen gepinnt
// (`tests/ux28-fassungen/berichtsaenderung-ist-eine-aenderung.test.ts`, C/D/F):
//   · reine Einrückung/Serialisierung (`<p>a</p>\n  <p>b</p>` gegen `<p>a</p><p>b</p>`)
//     gilt als UNVERÄNDERT — daran hat der Mensch nichts geändert.
//   · eine Formatierung mehr (`<strong>` um ein Wort) gilt als GEÄNDERT — der gespeicherte Bericht
//     IST ein anderer. Nur auf dem Text verglichen läse der Leser hier „keine Änderung", obwohl er
//     selbst gerade etwas geändert hat.
//   · sichtbarer Leerraum zwischen Inline-Elementen gilt als GEÄNDERT (BENs Gegenfall).
//   · BEWUSST IN KAUF GENOMMEN: ein Inline-Element unmittelbar vor einem Block
//     (`<strong>a</strong> <p>b</p>`) gilt als geändert, obwohl der Browser den Leerraum dort
//     verwirft. Ehrlichkeit vor Optik: „geändert" ist die SCHWÄCHERE Aussage, und der Fall entsteht
//     aus dem Editor dieses Hauses gar nicht (Fließtext liegt immer in Blockbehältern).
//
// FEHLEND, `null` UND LEER SIND DASSELBE: `String(value ?? "")` bildet alle drei auf `""` ab — „an
// dieser Fassung steht kein Bericht" ist eine Aussage, nicht sieben verschiedene.
function berichtsSchluessel(value: unknown): string {
  const glatt = norm(value);
  // Das NULL-Zeichen trennt die beiden Teile: es kommt in sanitisiertem HTML nicht vor, und ohne Trenner
  // könnte ein Textende, das wie ein Markupanfang aussieht, zwei verschiedene Berichte auf denselben
  // Schlüssel abbilden.
  return `${htmlToPlainText(glatt)}\u0000${glatt.replace(/>\s+</g, "><")}`;
}

function changedFields(prev: KnowledgeObject, next: KnowledgeObject): KoVersionDiffField[] {
  const fields: KoVersionDiffField[] = [
    "title",
    "statement",
    "conditions",
    "measures",
    "type",
    "status",
    "bodyHtml",
  ];
  return fields.filter((field) => {
    if (field !== "bodyHtml") {
      return norm(prev[field]) !== norm(next[field]);
    }
    // ZUERST der billige Vergleich: ein Bericht kann megabytegroß sein (eingebettete Bilder als
    // base64), und der unveränderte Fall ist der häufige. Nur wenn die rohen Zeichenketten
    // auseinandergehen, wird der Schlüssel überhaupt gebildet.
    const a = prev.bodyHtml ?? "";
    const b = next.bodyHtml ?? "";
    return a === b ? false : berichtsSchluessel(a) !== berichtsSchluessel(b);
  });
}

export function versionDiffs(snapshots: readonly KoVersionSnapshot[]): KoVersionDiff[] {
  const asc = [...snapshots].sort((a, b) => a.version - b.version || a.at.localeCompare(b.at));
  return asc.map((snap, index) => {
    const prev = asc[index - 1];
    return {
      fromVersion: prev?.version ?? null,
      toVersion: snap.version,
      changed: prev ? changedFields(prev.snapshot, snap.snapshot) : [],
    };
  });
}

export function diffForVersion(
  snapshots: readonly KoVersionSnapshot[],
  version: number,
): KoVersionDiff | undefined {
  return versionDiffs(snapshots).find((diff) => diff.toVersion === version);
}
