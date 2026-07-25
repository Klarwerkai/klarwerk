import { useConflicts, useDuplicates, useGapsSummary, useValidationBoard } from "../api/hooks";
import { type HasData, type LoadPhase, groupLoadPhase, isGroupStale } from "../lib/loadingState";

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

// AUFTRAG-mega2 Block C (bens D9): ein Badge trägt jetzt neben der Zahl seinen LADEZUSTAND. Vorher
// reduzierte `?? 0` jede noch ungeladene Quelle auf 0, und die Sidebar blendete 0-Badges aus — „lädt"
// und „echte 0" waren nicht unterscheidbar. Jetzt ist `state: "loading"` explizit (kein Badge, aber ein
// neutraler Ladepunkt) und von einer echten 0 (gar kein Badge) UND von einem echten Zähler unterscheidbar.
// AUFTRAG-mega3 Block B (bens D9): der Badge trägt jetzt die dritte Phase „error" — eine dauerhaft
// gescheiterte Quelle (ohne nutzbare Daten) zeigt ehrlich einen Fehler-Marker mit Wiederholen, statt
// endlos den Ladepunkt oder eine erfundene 0. `refetch` löst den erneuten Abruf aller tragenden Quellen aus.
// AUFTRAG-mega4 Block B (bens Sammel-Review 4): der Badge trägt zusätzlich `stale`. Hatte eine Quelle
// bereits Daten und scheitert dann ein Refetch, bleibt `state` bewusst „loaded" (die vorhandene Zahl
// darf weiter stehen), ABER `stale` ist wahr — die Sidebar zeigt die alte Zahl WEITER und daneben einen
// bedienbaren Störungshinweis mit Wiederholen. Ohne dieses Bit verschwieg die Navigation den gestörten
// Refetch als stilles „loaded" (bens Blocker).
export interface NavBadge {
  count: number;
  state: LoadPhase;
  stale: boolean;
  refetch: () => void;
}

// Echte Sidebar-Badge-Zähler aus den Lese-Hooks (cached). state="loaded" + count=0 → kein Badge.
// FUNKE-FIX3 P0 (bens Blocker A): die Sidebar ist auf JEDER Seite gemountet — der Aufgaben-Zähler
// speist sich deshalb aus der TEXTFREIEN aggregierten Quelle (useGapsSummary → GET /api/gaps/summary,
// nur Zahlen). Der Gap-Volltextpfad (useGaps → GET /api/gaps) darf in der Shell NIE geladen werden.
export function useNavBadges(): Record<string, NavBadge> {
  const board = useValidationBoard();
  const conflicts = useConflicts();
  const duplicates = useDuplicates();
  const gaps = useGapsSummary();
  // Jede Kennzahl ist atomar mit IHREN Quellen: erst wenn alle Daten haben, wird eine echte Zahl gezeigt;
  // scheitert eine Quelle dauerhaft ohne Daten → state "error". Der Marker bietet Wiederholen (refetch).
  type NavSource = HasData & { refetch?: () => unknown };
  const badge = (count: number, ...sources: NavSource[]): NavBadge => ({
    count,
    state: groupLoadPhase(sources),
    // Refetch einer bereits geladenen Zahl gescheitert → gestört, aber Zahl bleibt sichtbar (Stale).
    stale: isGroupStale(sources),
    refetch: () => {
      for (const s of sources) {
        s.refetch?.();
      }
    },
  });
  const boardCount = board.data?.length ?? 0;
  return {
    tasks: badge(boardCount + (gaps.data?.open ?? 0), board, gaps),
    validation: badge(boardCount, board),
    conflicts: badge(conflicts.data?.length ?? 0, conflicts),
    // Berater-Konzept Duplikate 04.07. (Stufe D4): offene Überschneidungen als Sidebar-Badge.
    duplicates: badge(duplicates.data?.length ?? 0, duplicates),
    lifecycle: { count: 0, state: "loaded", stale: false, refetch: () => {} },
  };
}
