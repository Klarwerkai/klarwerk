import { useConflicts, useDuplicates, useGapsSummary, useValidationBoard } from "../api/hooks";

// SCRUM-486 E: Jeder Sidebar-Badge trägt neben der Zahl seine ART (i18n-Schlüssel mit {{count}}), damit
// Tooltip/aria-label sagen, WAS die Zahl bedeutet — Widersprüche vs. Dubletten vs. Aufgaben vs. Prüfung.
export const NAV_BADGE_LABEL_KEY: Record<string, string> = {
  tasks: "nav.badge.tasks",
  validation: "nav.badge.validation",
  conflicts: "nav.badge.conflicts",
  duplicates: "nav.badge.duplicates",
};

export function navBadgeLabelKey(badgeKey: string): string | undefined {
  return NAV_BADGE_LABEL_KEY[badgeKey];
}

// Echte Sidebar-Badge-Zähler aus den Lese-Hooks (cached). 0 = kein Badge.
// FUNKE-FIX3 P0 (bens Blocker A): die Sidebar ist auf JEDER Seite gemountet — der Aufgaben-Zähler
// speist sich deshalb aus der TEXTFREIEN aggregierten Quelle (useGapsSummary → GET /api/gaps/summary,
// nur Zahlen). Der Gap-Volltextpfad (useGaps → GET /api/gaps) darf in der Shell NIE geladen werden.
export function useNavBadges(): Record<string, number> {
  const board = useValidationBoard();
  const conflicts = useConflicts();
  const duplicates = useDuplicates();
  const gaps = useGapsSummary();
  return {
    tasks: (board.data?.length ?? 0) + (gaps.data?.open ?? 0),
    validation: board.data?.length ?? 0,
    conflicts: conflicts.data?.length ?? 0,
    // Berater-Konzept Duplikate 04.07. (Stufe D4): offene Überschneidungen als Sidebar-Badge.
    duplicates: duplicates.data?.length ?? 0,
    lifecycle: 0,
  };
}
