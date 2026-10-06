// ================================================================================================
// R-0658 · SCHUTZDATEN ERKENNEN, BEVOR EIN WISSENSOBJEKT DURCHSUCHBAR WIRD.
// ================================================================================================
//
// DER ZIELZUSTAND (R-0658): „Bevor ein Dokument durchsuchbar wird, soll das System Muster wie
// Personalnummern oder Kontodaten erkennen, warnen und den Fall in Quarantäne stellen. So landen
// Personalnummern oder Kontodaten gar nicht erst im durchsuchbaren Bestand."
//
// WAS DIESE DATEI TUT — reine Funktionen, kein Zustand:
//   · `erkenneSchutzdaten` findet in Titel, Aussage, sichtbarem Rumpftext, Bedingungen und
//     Maßnahmen die ARTEN von Schutzdaten. Sie liefert NIE die Werte selbst: weder die Marke am
//     Objekt noch die Antwort an den Client noch ein Protokoll soll die Nummer ein zweites Mal
//     tragen.
//   · `mitSchutzdatenBefund` setzt bzw. entfernt die Marke `schutzdatenQuarantaene` am Objekt.
//
// WO SIE WIRKT (knowledge-object/src/service.ts und search-projection.ts):
//   · Anlegen (`buildCreatedKo`) und Überarbeiten (`naechsteFassung`) — beide Schreibränder, an
//     denen eine neue Suchprojektion entsteht.
//   · Die Suchprojektion eines Objekts in Quarantäne trägt KEINEN durchsuchbaren Text
//     (`inhaltVon`): der Schutzdatentext gelangt gar nicht erst in den Suchbestand. Die Zeile
//     selbst entsteht weiter — Rebuild, Readiness und Audit sehen ein vollständig projiziertes
//     Objekt, nur eben eines ohne Suchtext.
//   · Die Sucheinstiege (`LibraryService.search`, `KoService.findCandidates`) lassen ein Objekt in
//     Quarantäne zusätzlich aus — sonst träfe es über Kategorie oder Schlagwort.
//
// WANN DIE QUARANTÄNE ENDET: wenn eine Überarbeitung die Schutzdaten entfernt. Eine Freigabe von
// Hand („trotzdem durchsuchbar machen") ist NICHT gebaut — wer sie erteilen darf, nennt keine
// Quelle; das ist eine offene Entscheidung, keine Lücke dieser Datei.
//
// DIE MUSTER, ausdrücklich schmal gehalten (falsch-positive Quarantäne kostet Auffindbarkeit):
//   · Personalnummer: eine Beschriftung (Personalnummer, Personal-Nr., Pers.-Nr., Mitarbeiter-
//     nummer) mit einer 4- bis 12-stelligen Ziffernfolge dahinter.
//   · Kontodaten: eine IBAN, die die Prüfziffer nach ISO 13616 (mod 97 = 1) besteht — mit oder
//     ohne Leerzeichen. Eine beliebige Buchstaben-Ziffern-Folge ohne gültige Prüfziffer zählt nicht.
import { htmlToPlainText } from "../../structure";
import type { KnowledgeObject, SchutzdatenArt, SchutzdatenQuarantaene } from "./types";

const PERSONALNUMMER =
  /\b(?:personal[-\s]?(?:nummer|nr\.?)|pers\.?[-\s]?nr\.?|mitarbeiter[-\s]?(?:nummer|nr\.?))\s*[:#]?\s*\d{4,12}\b/i;

// Kandidaten: Ländercode, zwei Prüfziffern, danach Ziffern/Großbuchstaben mit optionalen
// Leerzeichen. Die Länge wird erst nach dem Verdichten geprüft (15 bis 34 Zeichen, ISO 13616).
const IBAN_KANDIDAT = /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]){11,40}/g;

function ibanPrueft(kompakt: string): boolean {
  if (kompakt.length < 15 || kompakt.length > 34) {
    return false;
  }
  const umgestellt = kompakt.slice(4) + kompakt.slice(0, 4);
  let rest = 0;
  for (const zeichen of umgestellt) {
    const code = zeichen.charCodeAt(0);
    const ziffern = code >= 65 && code <= 90 ? String(code - 55) : zeichen;
    for (const z of ziffern) {
      rest = (rest * 10 + Number(z)) % 97;
    }
  }
  return rest === 1;
}

/** Enthält der Text eine IBAN mit gültiger Prüfziffer? Längere Kandidaten werden gekürzt. */
function enthaeltIban(text: string): boolean {
  for (const treffer of text.matchAll(IBAN_KANDIDAT)) {
    const kompakt = treffer[0].replace(/ /g, "");
    // Ein Kandidat kann ein angrenzendes Großbuchstabenwort mitgenommen haben — deshalb jede
    // zulässige Länge von vorn prüfen, nicht nur die ganze Folge.
    for (let laenge = Math.min(34, kompakt.length); laenge >= 15; laenge -= 1) {
      if (ibanPrueft(kompakt.slice(0, laenge))) {
        return true;
      }
    }
  }
  return false;
}

/** Die ARTEN von Schutzdaten in den übergebenen Texten — nie die Werte. Reihenfolge fest. */
export function erkenneSchutzdaten(texte: readonly (string | undefined)[]): SchutzdatenArt[] {
  const gesamt = texte.filter((t): t is string => typeof t === "string" && t.length > 0).join("\n");
  const arten: SchutzdatenArt[] = [];
  if (PERSONALNUMMER.test(gesamt)) {
    arten.push("personalnummer");
  }
  if (enthaeltIban(gesamt)) {
    arten.push("kontodaten");
  }
  return arten;
}

/** Die durchsuchbaren Textteile eines Objekts — dieselben Felder, aus denen die Suche entsteht. */
function texteVon(ko: KnowledgeObject): (string | undefined)[] {
  return [
    ko.title,
    ko.statement,
    ko.bodyHtml ? htmlToPlainText(ko.bodyHtml) : undefined,
    ...(ko.conditions ?? []),
    ...(ko.measures ?? []),
  ];
}

/**
 * Setzt die Quarantänemarke, wenn das Objekt Schutzdaten trägt, und entfernt sie, wenn nicht.
 * `seit` bleibt beim ERSTEN Befund stehen — eine weitere Fassung mit Schutzdaten verlängert die
 * Quarantäne, sie beginnt sie nicht neu.
 */
export function mitSchutzdatenBefund<T extends KnowledgeObject>(ko: T, at: string): T {
  const arten = erkenneSchutzdaten(texteVon(ko));
  const { schutzdatenQuarantaene: bisher, ...ohne } = ko;
  if (arten.length === 0) {
    return ohne as unknown as T;
  }
  const marke: SchutzdatenQuarantaene = { arten, seit: bisher?.seit ?? at };
  return { ...ohne, schutzdatenQuarantaene: marke } as unknown as T;
}

/** Liegt das Objekt in Quarantäne? Die eine Lesestelle für Projektion und Sucheinstiege. */
export function inSchutzdatenQuarantaene(
  ko: Pick<KnowledgeObject, "schutzdatenQuarantaene">,
): boolean {
  return ko.schutzdatenQuarantaene !== undefined && ko.schutzdatenQuarantaene.arten.length > 0;
}
