// ================================================================================================
// EDITOR-EINHEITLICH (produkt:20261007:editor-einheitlich) — DIE AUSSAGE, DIE AUS DEM INHALT KOMMT.
// ================================================================================================
//
// DER BEFUND (U05/U21): Beim ERSTELLEN über das Blatt schreibt der Mensch Titel und Inhalt — die
// Aussage bildet niemand von Hand, sie wird aus dem Inhalt abgeleitet (`frontDoorStatement` liefert
// den Klartext, der Server kürzt ihn mit `kernaussageAusKlartext`). Beim BEARBEITEN in der Bibliothek
// standen danach zwei Felder mit demselben Text da, „Aussage" und „Ausführlicher Inhalt": wer einen
// Satz änderte, musste ihn zweimal ändern — sonst widersprachen sich Aussage und Inhalt.
//
// DIE REGEL HIER: Eine Aussage, die nachweislich aus dem Inhalt gebildet wurde, FOLGT dem Inhalt
// auch beim Bearbeiten — mit derselben Kürzungsregel wie beim Erstellen. Eine Aussage, die sich
// vom Inhalt unterscheidet, ist eine eigene Formulierung und bleibt unangetastet. Wer in das Feld
// „Aussage" selbst schreibt, legt damit eine eigene Aussage fest (`aussageFolgtInhalt: false`).
//
// WARUM EINE ABSCHRIFT DER SERVERREGEL: `apps/web/src` darf aus `services/` nichts importieren
// (Wächter `tests/capture/draft-limits-shared.test.ts`, Grund: der Webbuild kopiert nur apps/web).
// Dasselbe Muster wie `draftLimits.ts`: die Werte stehen hier, und
// `tests/editor-einheitlich/aussage-paritaet.test.ts` legt beide Fassungen Fall für Fall
// gegeneinander — ändert sich eine Seite ohne die andere, wird der Test rot.
//
// GEGENSTÜCK: `services/structure/src/kernaussage.ts` (`kernaussageAusKlartext`, `kernaussageAusHtml`).
import { htmlToPlainText, isEmptyHtml } from "./richText";

export const AUSSAGE_MAX = 500;

const SCHLIESSEND = "“”\"»«›‹'’‘)\\]}";
const SATZENDE = new RegExp(`[.!?:;][${SCHLIESSEND}]*(?=\\s|$)`, "g");

/** Faltet Leerraum und schneidet an einer Satz-, sonst Wortgrenze — nie mitten im Wort. */
export function aussageAusKlartext(text: string, max: number = AUSSAGE_MAX): string {
  const gefaltet = text.replace(/\s+/g, " ").trim();
  if (gefaltet.length <= max) {
    return gefaltet;
  }
  const fenster = gefaltet.slice(0, max);
  let satzende = -1;
  for (const m of fenster.matchAll(SATZENDE)) {
    const ende = (m.index ?? 0) + m[0].length;
    if (ende < fenster.length || /\s/.test(gefaltet.charAt(ende))) {
      satzende = ende;
    }
  }
  if (satzende > 0) {
    return fenster.slice(0, satzende).trim();
  }
  const wortgrenze = /\s/.test(gefaltet.charAt(max)) ? fenster.length : fenster.lastIndexOf(" ");
  if (wortgrenze > 0) {
    return fenster.slice(0, wortgrenze).trim();
  }
  return fenster.trim();
}

const BLOCKENDE = /<\/(?:p|h[1-6]|li|blockquote|div|caption|figcaption|th|td|tr|pre)>/i;

/** Die Aussage aus dem ERSTEN Absatz eines HTML-Körpers — Rückfall auf den ganzen Klartext. */
export function aussageAusErstemAbsatz(html: string, max: number = AUSSAGE_MAX): string {
  const erstesBlockende = html.search(BLOCKENDE);
  const ersterBlock = erstesBlockende >= 0 ? html.slice(0, erstesBlockende) : html;
  const ausErstem = aussageAusKlartext(htmlToPlainText(ersterBlock), max);
  if (ausErstem.length > 0) {
    return ausErstem;
  }
  return aussageAusKlartext(htmlToPlainText(html), max);
}

/** Die Aussage, die das Erstellen aus diesem Inhalt bilden würde (Klartext, Satzgrenze, ≤ 500). */
export function aussageAusInhalt(bodyHtml: string): string {
  return aussageAusKlartext(htmlToPlainText(bodyHtml));
}

/**
 * Stammt die Aussage aus dem Inhalt? Nur dann darf sie ihm folgen. Erkannt werden die drei Formen,
 * die die vorhandenen Wege tatsächlich schreiben: der gekürzte Klartext (Blatt, Word, Datei), der
 * erste Absatz (Rückfall der Entwurfsroute) und der ungekürzte Klartext (Rückfall beim Anlegen).
 * Leere Aussage oder leerer Inhalt: nichts folgt — dann gibt es nichts, das doppelt stünde.
 */
export function aussageFolgtInhalt(
  statement: string,
  bodyHtml: string | null | undefined,
): boolean {
  const aussage = statement.replace(/\s+/g, " ").trim();
  if (aussage.length === 0 || !bodyHtml) {
    return false;
  }
  const klartext = htmlToPlainText(bodyHtml);
  if (klartext.length === 0) {
    return false;
  }
  return (
    aussage === klartext ||
    aussage === aussageAusKlartext(klartext) ||
    aussage === aussageAusErstemAbsatz(bodyHtml)
  );
}

/** Der Bearbeitungsstand nach einer Änderung am Inhalt — die gekoppelte Aussage zieht mit. */
export function mitNeuemInhalt<
  T extends { statement: string; bodyHtml: string; aussageFolgtInhalt: boolean },
>(stand: T, bodyHtml: string): T {
  if (!stand.aussageFolgtInhalt) {
    return { ...stand, bodyHtml };
  }
  return { ...stand, bodyHtml, statement: aussageAusInhalt(bodyHtml) };
}

export type Pflichtfeld = "titel" | "inhalt" | "aussage";

/**
 * Welche Pflichtangaben fehlen — dieselbe Regel wie der Speicher-Check beim Erstellen
 * (`capture.readyHint`: Titel und Aussage/Inhalt). Im Prüfweg reist der Titel nicht mit; dort ist
 * die Aussage Pflicht, weil der Vorschlag ohne sie nicht eingereicht werden kann.
 */
export function fehlendePflichtangaben(
  stand: { title: string; statement: string; bodyHtml: string },
  pruefweg: boolean,
): Pflichtfeld[] {
  if (pruefweg) {
    return stand.statement.trim().length === 0 ? ["aussage"] : [];
  }
  const fehlt: Pflichtfeld[] = [];
  if (stand.title.trim().length === 0) {
    fehlt.push("titel");
  }
  if (stand.statement.trim().length === 0 && isEmptyHtml(stand.bodyHtml)) {
    fehlt.push("inhalt");
  }
  return fehlt;
}
