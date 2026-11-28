/** Eine selbständige Richtigkeitsfrage kann die zu prüfende Behauptung selbst enthalten.
 * Der Wortlaut bleibt Nutzereingabe. Nur Firmenquellen dürfen das Urteil tragen. */
export function getippteAussage(frage: string): { auftrag: string; aussage: string } | undefined {
  const text = frage.trim();
  const nebensatz =
    /^(stimmt (?:es|das),?\s+dass|ist es (?:richtig|wahr),?\s+dass|klopt (?:het|dit),?\s+dat|is het (?:waar|juist),?\s+dat|is it (?:correct|true|right|accurate) that)\s+(.+?)\s*\??$/isu.exec(
      text,
    );
  if (nebensatz) {
    const [, einleitung, aussage] = nebensatz;
    if (!einleitung || !aussage || !istAussage(aussage)) return undefined;
    const auftrag = /^is it /iu.test(einleitung)
      ? "Is the following statement correct?"
      : /^(klopt|is het)/iu.test(einleitung)
        ? "Klopt de volgende uitspraak?"
        : "Stimmt die folgende Aussage?";
    return { auftrag, aussage };
  }

  // Begrenzte, affirmative Arbeitsaufträge. Eine normale Sachfrage mit zitiertem Namen
  // (z.B. „Wer prüfte …?“) oder eine Frage zur Person des Prüfers bleibt im üblichen Weg.
  const auftragsformen = [
    /^stimmt (?:das|dies|(?:diese|die(?: folgende)?|folgende) (?:aussage|behauptung)|dieser satz)\b/iu,
    /^ist (?:das|dies|(?:diese|die(?: folgende)?) (?:aussage|behauptung)|dieser satz)\b[^?!:]*?\b(?:richtig|korrekt|wahr)\b/iu,
    /^klopt (?:dit|dat|(?:deze|de(?: volgende)?|volgende) (?:uitspraak|stelling|bewering))\b/iu,
    /^is (?:dit|(?:deze|de volgende) (?:uitspraak|bewering))\b[^?!:]*?\b(?:juist|correct|waar)\b/iu,
    /^is (?:this|that|the following (?:claim|statement|assertion))\b[^?!:]*?\b(?:true|correct|right|accurate)\b/iu,
  ];
  const trennung = /^([^?!:]+[?:])\s*([\s\S]+)$/u.exec(text);
  const auftrag = trennung?.[1]?.trim();
  let aussage = trennung?.[2]?.trim();
  if (!auftrag || !aussage) return undefined;
  if (!auftragsformen.some((form) => form.test(auftrag))) return undefined;
  if (/(?:\bnicht\b|\bniet\b|\bnot\b|n['’]t\b)/iu.test(auftrag)) return undefined;

  const paare: Readonly<Record<string, string>> = {
    '"': '"',
    "„": "“”",
    "“": "”",
    "«": "»",
    "‘": "’",
    "'": "'",
    "‚": "‘’",
  };
  const ende = paare[aussage[0] ?? ""];
  if (ende) {
    const zitat = aussage.replace(/[.?!]\s*$/u, "").trimEnd();
    if (!ende.includes(zitat.slice(-1))) return undefined;
    aussage = zitat.slice(1, -1).trim();
  }
  if (!istAussage(aussage)) return undefined;
  return { auftrag, aussage };
}

function istAussage(text: string): boolean {
  return !text.endsWith("?") && (text.match(/[\p{L}\p{N}]+/gu)?.length ?? 0) >= 2;
}
