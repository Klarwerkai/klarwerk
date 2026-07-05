import { useConflicts, useDuplicates, useGaps, useValidationBoard } from "../api/hooks";

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
