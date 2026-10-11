// ================================================================================================
// Aufnahme gesamt-wissen-herkunft · Entscheidung 18 — DECKT DIE EIGENE BEFUGNIS DIESEN BEREICH?
// ================================================================================================
//
// Der Spiegel von `weisungsbefugnisDeckt` (services/auth/src/types.ts) — nur, um die Weisung an
// der Lesefläche anzubieten oder nicht. Er entscheidet NICHTS: der Server prüft dieselbe Regel beim
// Setzen noch einmal und lehnt ab, wenn sie nicht greift. Ohne Vermerk am Konto: nie, gleich welche
// Rolle — die Rolle allein verleiht die Befugnis nicht. `*` ist das ganze Unternehmen
// (Geschäftsführung, Integration Nacharbeit 12).
export function weisungsbefugtFuer(
  befugnis: { bereiche: readonly string[] } | undefined,
  bereich: string,
): boolean {
  if (!befugnis) {
    return false;
  }
  if (befugnis.bereiche.includes("*")) {
    return true;
  }
  const gesucht = bereich.trim().toLocaleLowerCase("de");
  return (
    gesucht.length > 0 &&
    befugnis.bereiche.some((b) => b.trim().toLocaleLowerCase("de") === gesucht)
  );
}

/**
 * Nacharbeit 14 (Ben B1): welche Weisung ist die aktuelle? Spiegel von `aktuelleWeisung`
 * (services/app/src/weisung-und-freigabe.ts) — nur, um den richtigen Sichtungsweg anzubieten; der
 * Server entscheidet mit derselben Regel. Jünger ist der Beleg, der später in der Kette steht;
 * Altbestand ohne gebundenen Beleg fällt auf die Fassung zurück, bei Gleichstand gilt `eigene`.
 */
export function aktuelleWeisungsart(ko: {
  weisung?: { fassung: number; beleg?: { auditSeq: number } } | undefined;
  weisungsSichtung?: { auditSeq: number; koVersion: number } | undefined;
}): "punktweise" | "eigene" | null {
  const punktweise = ko.weisung;
  const eigene = ko.weisungsSichtung;
  if (!punktweise) {
    return eigene ? "eigene" : null;
  }
  if (!eigene) {
    return "punktweise";
  }
  if (punktweise.beleg) {
    return punktweise.beleg.auditSeq > eigene.auditSeq ? "punktweise" : "eigene";
  }
  return punktweise.fassung > eigene.koVersion ? "punktweise" : "eigene";
}

/**
 * Entscheidung 19 · Nacharbeit 11 (Ben B1): die wählbaren Sichtenden. Nur Konten, die der Server
 * für DIESEN Eintrag als sichtungsfähig nennt (`sichtungsKandidaten` — sie lesen ihn mit ihrem
 * eigenen Zugang), und nie die weisende Person selbst. Fehlt die Liste, ist niemand wählbar: die
 * Oberfläche rät nicht, wer lesen darf. Der Server prüft beim Setzen unabhängig davon noch einmal.
 */
export function sichtungsAuswahl<K extends { id: string }>(
  verzeichnis: readonly K[],
  sichtungsKandidaten: readonly string[] | undefined,
  selbst: string | undefined,
): K[] {
  const erlaubt = new Set(sichtungsKandidaten ?? []);
  return verzeichnis.filter((k) => k.id !== selbst && erlaubt.has(k.id));
}
