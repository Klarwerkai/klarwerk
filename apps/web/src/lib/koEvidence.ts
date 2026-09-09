import type { EvidenceRecord } from "../api/types";

export interface EvidenceRow {
  key: string;
  kind: EvidenceRecord["kind"];
  title: string;
  meta: string[];
  createdAt: string;
  createdBy: string;
  // JOB 3272 · UX-25: der Originalbezug überlebt die Zeilenbildung. Beide Kennungen kommen seit
  // jeher vom Server (`api/types.ts:209-210`) — bis zu diesem Auftrag warf `evidenceRows` sie weg
  // und zeigte statt dessen die rohe Kennung als Text an.
  attachmentId?: string;
  objectId?: string;
}

export function evidenceKindLabel(kind: EvidenceRecord["kind"]): "source" | "attachment" {
  return kind;
}

export function evidenceRows(records: readonly EvidenceRecord[]): EvidenceRow[] {
  return [...records]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id))
    .map((record) => {
      // JOB 3272 · UX-25: die rohe Kennung (`object:<id>`) ist hier ERSETZT, nicht danebengelegt.
      // Sie war der einzige Ort, an dem der Originalbezug sichtbar wurde — als Programmschlüssel,
      // der niemandem den Weg zum Original zeigte. Den Weg baut jetzt die Belegkarte über
      // `belegOriginal`; stünde die Kennung daneben, behaupteten zwei Anzeigen dasselbe.
      const meta = [
        `v${record.koVersion}`,
        record.provider ?? undefined,
        record.mime ?? undefined,
        record.url ?? undefined,
      ].filter((value): value is string => Boolean(value));
      return {
        key: record.id,
        kind: record.kind,
        title: record.label,
        meta,
        createdAt: record.createdAt,
        createdBy: record.createdBy,
        ...(record.attachmentId ? { attachmentId: record.attachmentId } : {}),
        ...(record.objectId ? { objectId: record.objectId } : {}),
      };
    });
}

// ==================================================================================================
// JOB 3272 · UX-25 — DIE EINE ZUORDNUNG VON BELEG ZU ORIGINAL.
// ==================================================================================================
//
// Sie wohnt HIER, bei der Zeilenbildung, und nirgends sonst: die Belegkarte fragt, sie antwortet.
// Drei Ergebnisse, keine vierte Möglichkeit — und ausdrücklich KEIN Raten:
//
//   · Ein Bezug, der auf MEHRERE Anhänge passt, gilt als „fehlt". Eine Zuordnung, die raten müsste,
//     ist keine; ein Weg auf einen willkürlich gewählten Anhang wäre schlimmer als kein Weg.
//   · Ein LEERSTRING ist kein Bezug. Sonst träfe er jeden Altbestands-Anhang ohne `objectId`
//     (Inline-Anhang, SCRUM-121) und die Karte böte einen Weg auf ein fremdes Bild an.
//   · Die genauere Kennung entscheidet zuerst: `attachmentId` benennt EINEN Anhang, `objectId`
//     benennt das Original dahinter, das mehrere Anhänge tragen können.
//
// RUNDE 2 · BENs Gegenbeispiel (Korrekturpflicht 1) — ZWEI Löcher in der ersten Fassung, beide
// führten zum FALSCHEN Original bei scheinbar eindeutigem Weg:
//
//   (a) DER RÜCKFALL NACH MEHRDEUTIGKEIT. `attachmentId: "doppelt"` traf zwei Anhänge; statt zu
//       verzichten, fiel die Regel auf die `objectId` zurück, traf dort genau einen — und meldete
//       „vorhanden". Ein mehrdeutiger Bezug wird durch einen zweiten Blick nicht eindeutig: wer
//       „doppelt" sagt, hat nicht gesagt, welchen. Deshalb endet die genauere Kennung bei mehreren
//       Treffern SOFORT in „fehlt", ohne Rückfall.
//   (b) DIE KENNUNG ALS ANKER. Das Ergebnis benennt den Anhang über seine `id`, und die Fläche
//       sucht ihn über genau diese Kennung (`data-bib-anhang`, `MehrAbschnitte.tsx:1395`). Tragen
//       ZWEI Anhänge dieselbe `id`, ist der Anker mehrdeutig, und der Sprung landete auf dem ersten
//       gleichnamigen — auch dann, wenn der Weg über die `objectId` gefunden wurde. Ein Ergebnis
//       „vorhanden" gibt es deshalb nur, wenn die genannte Kennung im Bestand EINMAL vorkommt.
//
// Beides wohnt hier, in der einen Regel, und NICHT als zweite Sicherung im Sprungwerk: dort wäre es
// unerreichbarer Code (die Fläche ruft den Sprung nur mit einem „vorhanden"-Ergebnis auf) und damit
// eine Scheinsicherung, die nichts misst.
//
// NICHT dieselbe Frage wie `evidenceConsistency.ts:49-57` (`attachmentMatchesEvidence`): dort wird
// paarweise geprüft, ob ein Anhang zu einem Beleg gehört, um FEHLBESTÄNDE zu zählen — nur für
// `kind: "attachment"`, ohne Ergebnis „keiner" und ohne den Mehrdeutigkeitsfall. Hier wird EIN Ziel
// für den Sprung bestimmt, auch aus einem Quellbeleg (der seit `service.ts:2186` eine
// `attachmentId` tragen kann).
export type BelegOriginal =
  | { art: "vorhanden"; anhangId: string }
  | { art: "fehlt" }
  | { art: "keiner" };

/** Was die Regel von einem Anhang wissen muss — nicht mehr (`KoAttachment` erfüllt es). */
interface AnhangBezug {
  id: string;
  objectId?: string | undefined;
}

/**
 * Genau ein Treffer — UND seine Kennung kommt im Bestand nur einmal vor, sonst wäre der Anker der
 * Fläche mehrdeutig (Grund (b) oben). `null` heißt „kein tragfähiges Ziel", nicht „kein Treffer".
 */
function genauEiner(
  treffer: readonly AnhangBezug[],
  anhaenge: readonly AnhangBezug[],
): BelegOriginal | null {
  const eins = treffer.length === 1 ? treffer[0] : undefined;
  if (!eins) {
    return null;
  }
  const gleichnamige = anhaenge.filter((a) => a.id === eins.id).length;
  return gleichnamige === 1 ? { art: "vorhanden", anhangId: eins.id } : null;
}

export function belegOriginal(
  beleg: Pick<EvidenceRow, "attachmentId" | "objectId">,
  anhaenge: readonly AnhangBezug[],
): BelegOriginal {
  const anhangId = (beleg.attachmentId ?? "").trim();
  const objektId = (beleg.objectId ?? "").trim();
  if (anhangId.length === 0 && objektId.length === 0) {
    return { art: "keiner" };
  }
  if (anhangId.length > 0) {
    const treffer = anhaenge.filter((a) => a.id === anhangId);
    if (treffer.length > 1) {
      // Grund (a): mehrdeutig gesagt bleibt mehrdeutig — KEIN Rückfall auf die gröbere Kennung.
      return { art: "fehlt" };
    }
    const gefunden = genauEiner(treffer, anhaenge);
    if (gefunden) {
      return gefunden;
    }
  }
  if (objektId.length > 0) {
    const gefunden = genauEiner(
      anhaenge.filter((a) => (a.objectId ?? "").trim() === objektId),
      anhaenge,
    );
    if (gefunden) {
      return gefunden;
    }
  }
  return { art: "fehlt" };
}
