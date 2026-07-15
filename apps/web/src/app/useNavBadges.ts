import { useConflicts, useDuplicates, useGaps, useValidationBoard } from "../api/hooks";

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
export function useNavBadges(): Record<string, number> {
  const board = useValidationBoard();
  const conflicts = useConflicts();
  const duplicates = useDuplicates();
  const gaps = useGaps();
  return {
    tasks: (board.data?.length ?? 0) + (gaps.data?.filter((g) => g.status === "offen").length ?? 0),
    validation: board.data?.length ?? 0,
    conflicts: conflicts.data?.length ?? 0,
    // Berater-Konzept Duplikate 04.07. (Stufe D4): offene Überschneidungen als Sidebar-Badge.
    duplicates: duplicates.data?.length ?? 0,
    lifecycle: 0,
  };
}
