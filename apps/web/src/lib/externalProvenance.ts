// SCRUM-438: Erkennung „Enthält externes, ungeprüftes Wissen" — DOM-frei, testbar. Übernommene
// Public-KI-/Web-Blöcke tragen die stabile, sprachunabhängige Marker-Klasse `panel-external`
// (überlebt die Sanitisierung server- wie clientseitig). Die Lese-Ansicht zeigt daraus ein Chip.
//
// Der Sichtbadge-Text ist zusätzlich als Übergangs-Fallback berücksichtigt: Blöcke, die VOR dieser
// Änderung ohne Marker-Klasse übernommen wurden, werden weiter erkannt (beide Sprachen).
const EXTERNAL_MARKER_CLASS = "panel-external";
const LEGACY_BADGES = ["[Extern · ungeprüft]", "[External · unverified]"] as const;

export function containsExternalUnchecked(bodyHtml: string | null | undefined): boolean {
  if (!bodyHtml) {
    return false;
  }
  if (bodyHtml.includes(EXTERNAL_MARKER_CLASS)) {
    return true;
  }
  return LEGACY_BADGES.some((badge) => bodyHtml.includes(badge));
}
