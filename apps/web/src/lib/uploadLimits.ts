// AUFTRAG-mega15 Block E (bens Benennungs- und Bedienungsschuld aus mega14).
//
// Der Befund: die Admin-Einstellung heißt „Größe je Anhang (MB)" und klingt nach Rohdatei. Gemessen
// wird aber die Länge der übertragenen Daten-URL — sowohl im Alt-Pfad (Inline-Bild, `att.dataUrl`)
// als auch im Object-Store-Pfad (`stored.size` = `input.data.length`, services/object-store/
// src/service.ts). 20 MB Einstellung lassen deshalb nur rund 15 MB Rohdatei zu.
//
// Pedis Entscheidung: NICHT das Modell umbenennen (das wäre eine stille Umdeutung eines
// gespeicherten Wertes und migrationsriskant), sondern die ungefähre ROHDATEIGRENZE zusätzlich
// anzeigen — im Admin und an jeder Auswahlstelle. Diese Datei rechnet sie aus; sie ist die EINE
// Quelle für beide Anzeigen und für den Beleg-Test.
//
// NEBENBEFUND, hier gleich mitgeradegerückt: der bisherige Text nannte „rund das 1,37-Fache".
// Base64 ist 4 Bytes je 3 Bytes Nutzlast, also das 1,333-Fache. Die 1,37 stammen aus der
// MIME-Variante mit Zeilenumbrüchen alle 76 Zeichen — eine Daten-URL hat keine. Der Faktor stand
// also selbst falsch da und ist auf 1,34 korrigiert.

/**
 * Reserve für den Kopf der Daten-URL: `data:` + MIME + `;base64,`.
 *
 * Bewusst großzügig (der längste hier vorkommende MIME-Typ,
 * `application/vnd.openxmlformats-officedocument.presentationml.presentation`, ergibt 86 Zeichen).
 * Die Reserve macht die angezeigte Rohdateigrenze KONSERVATIV: eine Datei genau dieser Größe geht
 * mit jedem MIME-Typ durch. Eine angezeigte Grenze, die knapp doch abgelehnt wird, wäre schlimmer
 * als eine, die ein paar Kilobyte verschenkt.
 */
export const DATA_URL_ENVELOPE_RESERVE = 96;

/**
 * Größte Rohdatei, die unter einer gegebenen Übertragungsgrenze sicher durchgeht.
 *
 * Die Daten-URL ist `<Kopf>` + Base64, und Base64 belegt 4 Zeichen je angefangene 3 Rohbytes.
 * Umgekehrt: aus dem verbleibenden Platz `k = floor((limit - Kopf) / 4)` folgen `3k` Rohbytes.
 */
export function maxRawAttachmentBytes(limitBytes: number): number {
  if (!Number.isFinite(limitBytes)) {
    return 0;
  }
  const usable = Math.floor(limitBytes) - DATA_URL_ENVELOPE_RESERVE;
  if (usable <= 0) {
    return 0;
  }
  return Math.floor(usable / 4) * 3;
}

/**
 * Dieselbe Grenze als anzeigefertige MB-Zahl mit einer Nachkommastelle — ABGERUNDET.
 *
 * Abgerundet, weil die Zahl ein Versprechen ist: was angezeigt wird, muss real durchgehen. Genau
 * das prüft `tests/app/upload-raw-limit-e2e.test.ts` gegen die echte Route.
 */
export function maxRawAttachmentMb(limitBytes: number): number {
  return Math.floor(maxRawAttachmentBytes(limitBytes) / 100_000) / 10;
}

/** Die eingestellte Übertragungsgrenze als MB-Zahl (eine Nachkommastelle, kaufmännisch). */
export function transferLimitMb(limitBytes: number): number {
  return Math.round((limitBytes / 1_000_000) * 10) / 10;
}
