// ================================================================================================
// JOB 690 · D2 (Design D-019) — DER AUFGABEN-BADGE ZÄHLT, WAS DIE AUFGABENSEITE ZÄHLT.
// ================================================================================================
//
// DER BEFUND, der diese Datei erzwingt: Die Seitenleiste zeigte „54", die Aufgabenseite „Alle · 57".
// Zwei Zähler, zwei Wahrheiten. Der Badge zählte ZWEI Quellen (Validierungsboard + offene
// Wissenslücken), die Seite FÜNF — zusätzlich ungelöste Konflikte, Lebenszyklus-Fällige und an den
// Autor zurückgegebene Entwürfe (`MyTasks.tsx:84-135`).
//
// WAS DIESE DATEI PINNT — und was ausdrücklich NICHT:
//   · Aufgaben-Badge = Board + offene Lücken + UNGELÖSTE Konflikte + Lebenszyklus-Fällige.
//   · Konflikte-Badge zählt einen GELÖSTEN Konflikt nicht mit (`status !== "geloest"`, dieselbe
//     Regel wie `MyTasks.tsx:98`).
//   · Der Ladezustand ist ATOMAR: solange EINE tragende Quelle fehlt, ist der Badge „loading" —
//     nie eine zu kleine Zahl. Genau das ist der Unterschied zwischen „lädt" und „echte 0"
//     (mega2 Block C), und er darf durch eine neue Quelle nicht verloren gehen.
//   · NICHT gepinnt: die zurückgegebenen Entwürfe. Sie fehlen dem Badge weiterhin — sie bräuchten
//     zwei VOLLTEXTQUELLEN (`returnedToAuthor(audit, kos, user)`), und die Sidebar ist auf JEDER
//     Seite gemountet (FUNKE-FIX3 P0, `useNavBadges.ts:37-39`). Der Weg wäre ein kleiner
//     Serverzähler nach dem Muster `/gaps/summary`; das ist ein eigenes Vorhaben. Im Demo-Bestand
//     sind es null — dann stimmen die Zahlen exakt; sobald einer existiert, zeigt der Badge eine
//     KLEINERE Zahl als die Seite. Diese Datei behauptet deshalb KEINE vollständige Übereinstimmung.
//
// KEIN MOUNT, und das ist begründet: `apps/web` fährt `environment: "node"` (`vite.config.ts:74`),
// `@testing-library/react`/`jsdom` stehen dort nicht im Paket. Der RENDERER-Vertrag (reale Sidebar,
// echte Provider- und Endpointgrenze) ist deshalb NICHT hier, sondern in
// `tests/app/nav-badges-sidebar-mounted.test.tsx` gepinnt — beide zusammen, nicht eines statt des
// anderen (BENs Promptverbesserung zu D1).
//
// JOB 3113 H1b — WAS SICH HIER GEÄNDERT HAT UND WARUM: bis heute stand hier „`useNavBadges` trägt
// selbst KEINEN React-Zustand" und der Hook wurde als gewöhnliche Funktion aufgerufen. Seit H1b
// trägt er einen: er muss zum Ablauf der Frischefrist GENAU EINMAL neu zeichnen lassen
// (`useState` + `useEffect` mit einem `setTimeout`), sonst bliebe eine Zahl stehen, die niemand
// mehr bestätigt hat. Ein Hook mit Zustand darf nur IM Rendern laufen — deshalb läuft er hier
// jetzt in einer winzigen Sonde durch den Server-Renderer (node-tauglich, kein jsdom nötig).
// Gemessen werden unverändert Zahl und Ladezustand; `useEffect` läuft im Server-Renderer nicht,
// die Frist ist hier also NICHT Gegenstand — die misst `tests/kopfzaehler-frische/`.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface Quelle {
  data: unknown;
  isError: boolean;
  refetch: () => void;
}

const q = vi.hoisted(() => {
  const leer = (): {
    data: unknown;
    isError: boolean;
    refetch: () => void;
  } => ({ data: undefined, isError: false, refetch: () => {} });
  return {
    board: leer(),
    conflicts: leer(),
    duplicates: leer(),
    gaps: leer(),
    lifecycle: leer(),
  };
});

vi.mock("../api/hooks", () => ({
  useValidationBoard: () => q.board,
  useConflicts: () => q.conflicts,
  useDuplicates: () => q.duplicates,
  useGapsSummary: () => q.gaps,
  useLifecyclePending: () => q.lifecycle,
}));

import { type NavBadge, useNavBadges } from "./useNavBadges";

/** Die Sonde: ruft den Hook IM Rendern und reicht sein Ergebnis heraus. */
function badgesLesen(): Record<string, NavBadge> {
  let ergebnis: Record<string, NavBadge> = {};
  const Sonde = (): null => {
    ergebnis = useNavBadges();
    return null;
  };
  renderToStaticMarkup(createElement(Sonde));
  return ergebnis;
}

// Drei Konflikte, EINER davon gelöst → zwei ungelöste. Dieselbe Menge trägt beide Zählfälle:
// im Aufgaben-Badge als Summand 2, im Konflikte-Badge als Gesamtzahl 2 (nicht 3).
const KONFLIKTE = [
  { id: "c1", status: "offen" },
  // „eskaliert" ist Arbeit — die Regel ist bewusst `!== "geloest"` und keine Positivliste:
  // `ConflictStatus` kennt vier Werte (`api/types.ts:299`), und eine Positivliste müsste bei jedem
  // neuen Zustand nachgezogen werden und ließe ihn bis dahin still verschwinden.
  { id: "c2", status: "eskaliert" },
  { id: "c3", status: "geloest" },
];

function setze(werte: Partial<Record<keyof typeof q, unknown>>): void {
  for (const [name, data] of Object.entries(werte)) {
    (q as unknown as Record<string, Quelle>)[name].data = data;
  }
}

beforeEach(() => {
  for (const name of ["board", "conflicts", "duplicates", "gaps", "lifecycle"] as const) {
    q[name].data = undefined;
    q[name].isError = false;
  }
});

describe("JOB 690 D-019: der Aufgaben-Badge zählt dieselben Quellen wie die Aufgabenseite", () => {
  it("zählt Board + offene Lücken + ungelöste Konflikte + Lebenszyklus-Fällige", () => {
    setze({
      board: [{ id: "k1" }, { id: "k2" }, { id: "k3" }],
      gaps: { open: 5, byPriority: { hoch: 1, mittel: 2, niedrig: 2 } },
      conflicts: KONFLIKTE,
      lifecycle: ["l1", "l2", "l3", "l4"],
      duplicates: [],
    });
    const badges = badgesLesen();
    expect(
      badges.tasks?.count,
      "Der Aufgaben-Badge zählt zu wenig (Board 3 + Lücken 5 + ungelöste Konflikte 2 + Lebenszyklus 4)",
    ).toBe(14);
    expect(badges.tasks?.state).toBe("loaded");
  });

  it("der Konflikte-Badge zählt einen GELÖSTEN Konflikt nicht mit", () => {
    setze({
      board: [],
      gaps: { open: 0, byPriority: { hoch: 0, mittel: 0, niedrig: 0 } },
      conflicts: KONFLIKTE,
      lifecycle: [],
      duplicates: [],
    });
    const badges = badgesLesen();
    expect(badges.conflicts?.count, "Der Konflikte-Badge zählt den gelösten Konflikt c3 mit").toBe(
      2,
    );
  });

  it("ohne Lebenszyklus-Daten bleibt der Badge im Ladezustand statt eine zu kleine Zahl zu zeigen", () => {
    setze({
      board: [{ id: "k1" }, { id: "k2" }],
      gaps: { open: 1, byPriority: { hoch: 1, mittel: 0, niedrig: 0 } },
      conflicts: KONFLIKTE,
      duplicates: [],
      // lifecycle bleibt bewusst `undefined` — die Quelle lädt noch.
    });
    const badges = badgesLesen();
    expect(
      badges.tasks?.state,
      "Ohne Lebenszyklus-Daten muss der Badge im Ladezustand bleiben, nicht eine zu kleine Zahl zeigen",
    ).toBe("loading");
  });

  it("Kalibrierung: eine ECHTE Null bleibt eine Null (der Test ist nicht pauschal rot)", () => {
    setze({
      board: [],
      gaps: { open: 0, byPriority: { hoch: 0, mittel: 0, niedrig: 0 } },
      conflicts: [],
      lifecycle: [],
      duplicates: [],
    });
    const badges = badgesLesen();
    expect(badges.tasks?.count).toBe(0);
    expect(badges.tasks?.state).toBe("loaded");
    expect(badges.conflicts?.count).toBe(0);
  });
});
