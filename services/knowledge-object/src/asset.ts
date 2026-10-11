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
//
// R-0082 (aufnahme:20260922:gesamt-wissen-metadaten): seit dieser Regel trägt das Objekt MEHRERE
// Anlagen in `assets`; `asset` spiegelt die erste. Die drei Helfer unten sind die eine Stelle, die
// Liste zu bilden (`normalizeAssets`), zu lesen (`anlagenVon`) und auf beide Felder abzubilden
// (`anlagenFelder`).
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

/**
 * R-0082: die Normalform einer Anlagenliste — jeder Eintrag durch `normalizeAsset`, leere und
 * doppelte Einträge fallen weg, die Reihenfolge der Eingabe bleibt. Alles, was keine Liste ist,
 * ist die leere Liste.
 */
export function normalizeAssets(value: unknown): string[] {
  const liste: string[] = [];
  if (!Array.isArray(value)) {
    return liste;
  }
  for (const eintrag of value) {
    const kennung = normalizeAsset(eintrag);
    if (kennung !== null && !liste.includes(kennung)) {
      liste.push(kennung);
    }
  }
  return liste;
}

/**
 * R-0082: die Anlagen eines Objekts — DIE Lesestelle. Trägt das Objekt `assets`, gilt die Liste;
 * Altbestand ohne `assets` liefert seine Einzelzuordnung aus `asset` (oder keine).
 */
export function anlagenVon(ko: { asset?: string | null; assets?: readonly string[] }): string[] {
  if (Array.isArray(ko.assets)) {
    return normalizeAssets(ko.assets);
  }
  const einzeln = normalizeAsset(ko.asset);
  return einzeln === null ? [] : [einzeln];
}

/**
 * R-0082: bildet eine kanonische Liste auf die gespeicherten Felder ab. Beide entstehen NUR hier.
 *
 * EINE Anlage (oder keine) wird genau so gespeichert wie vor dieser Regel — nur `asset`. Erst ab
 * ZWEI Anlagen steht die Liste in `assets`, und `asset` spiegelt deren erste. So bleibt jede
 * vorhandene Einzelzuordnung in ihrer Gestalt erhalten (kein Nebeneinander von `asset` und einer
 * einelementigen Liste, das auseinanderlaufen könnte), und gelesen wird beides über `anlagenVon`.
 */
export function anlagenFelder(liste: readonly string[]): {
  asset: string | null;
  assets?: string[];
} {
  const anlagen = normalizeAssets(liste);
  return anlagen.length > 1
    ? { asset: anlagen[0] ?? null, assets: anlagen }
    : { asset: anlagen[0] ?? null };
}
