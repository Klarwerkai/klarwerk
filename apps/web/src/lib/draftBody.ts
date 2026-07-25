// AUFTRAG-mega7 Block A (bens Ship-Blocker): EINE Quelle für die Leerwert-Semantik des Bodys.
//
// Der Server merged ein PUT auf einen Entwurf PARTIELL (mergeDraftPayload, services/capture/src/
// service.ts) — und das muss so bleiben: fünf von sieben Aufrufern (Mobil ×2, Vordertür ×2,
// Offline-Queue) senden bewusst nur einen Ausschnitt und hängen daran, dass die übrigen Felder
// überleben. Der Vertrag dazu lautet:
//
//   Schlüssel NICHT mitgeschickt ⇒ Altwert bleibt.
//   Schlüssel mitgeschickt mit LEERWERT ⇒ Altwert geht.
//
// Genau diese Unterscheidung fehlte dem bodyHtml: es wurde nur mitgeschickt, wenn es Inhalt trug.
// Wer einen fortgesetzten Entwurf im Studio BEWUSST leerte, sendete damit kein `bodyHtml: ""`,
// sondern gar nichts — der Merge holte den alten Body zurück, und toKoInput trug ihn beim Promote
// ins Wissensobjekt. Das bringt bewusst entfernten Inhalt zurück (Datenminimierung, Nutzerabsicht).
//
// Diese Funktion macht daraus dieselbe eindeutige Semantik, die mega6 bereits für reviewerIds,
// pendingSources, sourceForm, extQuery und interview eingeführt hat. „Leer" ist hier bewusst
// dasselbe `trim()`-Kriterium, das die Aufrufer schon vorher benutzt haben — die Änderung betrifft
// NUR den leeren Fall beim Aktualisieren, nicht was als „Inhalt" zählt.
export const CLEARED_DRAFT_BODY_HTML = "";

export function draftBodyPatch(bodyHtml: string, isDraftUpdate: boolean): { bodyHtml?: string } {
  if (bodyHtml.trim()) {
    return { bodyHtml };
  }
  // Beim ANLEGEN gibt es keinen Altwert zu löschen — dort bleibt das Feld wie bisher ganz aus der
  // Payload (die Mobil-/Vordertür-Pfade, die nur Titel und Aussage senden, ändern sich dadurch nicht).
  return isDraftUpdate ? { bodyHtml: CLEARED_DRAFT_BODY_HTML } : {};
}
