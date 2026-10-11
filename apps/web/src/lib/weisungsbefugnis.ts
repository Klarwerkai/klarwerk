// ================================================================================================
// Aufnahme gesamt-wissen-herkunft · Entscheidung 18 — DECKT DIE EIGENE BEFUGNIS DIESEN BEREICH?
// ================================================================================================
//
// Der Spiegel von `befugnisDecktBereich` (services/auth/src/service.ts) — nur, um die Weisung an
// der Lesefläche anzubieten oder nicht. Er entscheidet NICHTS: der Server prüft dieselbe Regel beim
// Setzen noch einmal und lehnt ab, wenn sie nicht greift. Ohne Vermerk am Konto: nie, gleich welche
// Rolle — die Rolle allein verleiht die Befugnis nicht.
export function weisungsbefugtFuer(
  befugnis: { bereiche: readonly string[]; gesamt: boolean } | undefined,
  bereich: string,
): boolean {
  if (!befugnis) {
    return false;
  }
  if (befugnis.gesamt) {
    return true;
  }
  const gesucht = bereich.trim().toLocaleLowerCase("de");
  return (
    gesucht.length > 0 &&
    befugnis.bereiche.some((b) => b.trim().toLocaleLowerCase("de") === gesucht)
  );
}
