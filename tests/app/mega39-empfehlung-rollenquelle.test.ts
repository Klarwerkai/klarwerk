// ================================================================================================
// AUFTRAG-mega39 BLOCK A — DIE EMPFEHLUNG DARF NUR ZEIGEN, WOHIN DIE ROLLE AUCH DARF.
// ================================================================================================
//
// DER BEFUND (ben, sammel37-mega38): mega38 BLOCK G3 hat eine Rollenlogik gebaut und „rollenbewusst"
// behauptet — aber an einer EIGENEN Tabelle (`WORK_ROLES` in lib/workCenter.ts), nicht an der Quelle,
// die über Rollen tatsächlich entscheidet. Diese Tabelle erlaubte `criticalGaps` und `learning` für
// Viewer und Experte. Die Ziele sind `/risiko` und `/lebenszyklus`; beide tragen in der zentralen
// Navigationsquelle `minRole: "controller"` (app/navigation.ts), und der Router schickt eine nicht
// berechtigte Rolle auf `/start` zurück (routes.tsx).
//
// Eine Viewerin bekam also „Dringendste offene Arbeit" angezeigt, klickte — und landete wieder da,
// wo sie war. Genau die Sackgasse, die G3 beseitigen sollte, nur eine Ebene tiefer.
//
// DIESER TEST PINNT DIE BINDUNG, NICHT DAS ERGEBNIS: er baut KEINE eigene Erwartungstabelle für die
// Rollen, sondern fragt für jede der vier Rollen und jede der fünf Arbeitskategorien DIESELBE Quelle,
// die Navigation und Router fragen (`ALL_ITEMS` + `roleAllows`). Eine zweite Tabelle im Test wäre
// derselbe Fehler noch einmal — sie könnte mit der Navigation auseinanderlaufen, ohne rot zu werden.
// Die konkrete Matrix steht zusätzlich als lesbarer Pin darunter (damit sichtbar ist, WAS sich
// ändert, nicht nur dass es zusammenpasst).
import { describe, expect, it } from "vitest";
import { ALL_ITEMS, ROLES, roleAllows } from "../../apps/web/src/app/navigation";
import {
  type WorkOverviewItem,
  buildWorkOverview,
  primaryWorkItem,
} from "../../apps/web/src/lib/workCenter";

// Alle fünf Kategorien mit echtem Signal — aus der PRODUKTIVEN Definition, nicht abgeschrieben.
const ALLE_KATEGORIEN: WorkOverviewItem[] = buildWorkOverview({
  validationOpen: 1,
  conflictsOpen: 1,
  revalidationPending: 1,
  criticalGaps: 1,
  learningOpenSteps: 1,
});

// „Empfohlen" heißt: `primaryWorkItem` gibt diese Kategorie für diese Rolle als Einstieg MIT
// Klickziel zurück. Einzeln geprüft, damit die Severity-Reihenfolge das Ergebnis nicht verdeckt.
function wirdEmpfohlen(item: WorkOverviewItem, rolle: (typeof ROLES)[number]): boolean {
  return primaryWorkItem([item], rolle)?.key === item.key;
}

// Dieselbe Frage, die der Router beim Klick stellen wird.
function rolleDarfAufsZiel(item: WorkOverviewItem, rolle: (typeof ROLES)[number]): boolean {
  const ziel = ALL_ITEMS.find((n) => n.path === item.to);
  // Ziel, das die Navigationsquelle gar nicht kennt ⇒ niemand kann belegen, dass es erlaubt ist.
  return ziel ? roleAllows(ziel, rolle) : false;
}

describe("mega39 A · die Arbeits-Empfehlung fragt dieselbe Rollenquelle wie Navigation und Router", () => {
  it("der Geltungsbereich stimmt: vier Rollen, fünf Arbeitskategorien", () => {
    expect(ROLES).toEqual(["viewer", "experte", "controller", "admin"]);
    expect(ALLE_KATEGORIEN.map((i) => i.key).sort()).toEqual([
      "conflicts",
      "criticalGaps",
      "learning",
      "revalidation",
      "validation",
    ]);
  });

  it("jedes Klickziel einer Arbeitskategorie ist der Navigationsquelle überhaupt bekannt", () => {
    // Ohne diese Zusicherung könnte die Prüfung unten still leerlaufen: ein unbekanntes Ziel wäre
    // für jede Rolle „nicht erlaubt" und die Bindung damit trivial erfüllt.
    const unbekannt = ALLE_KATEGORIEN.filter((i) => !ALL_ITEMS.some((n) => n.path === i.to)).map(
      (i) => `${i.key} → ${i.to}`,
    );
    expect(unbekannt).toEqual([]);
  });

  // ── Die eigentliche Zusage: 4 × 5 = 20 Paare, jedes gegen `roleAllows` ──────────────────────────
  for (const rolle of ROLES) {
    for (const schluessel of [
      "conflicts",
      "criticalGaps",
      "revalidation",
      "validation",
      "learning",
    ]) {
      it(`${rolle} · ${schluessel}: empfohlen genau dann, wenn roleAllows das Ziel freigibt`, () => {
        const item = ALLE_KATEGORIEN.find((i) => i.key === schluessel);
        expect(item, `Kategorie ${schluessel} fehlt in der Übersicht`).toBeTruthy();
        if (!item) {
          return;
        }
        const darf = rolleDarfAufsZiel(item, rolle);
        expect(`${rolle}/${schluessel} empfohlen=${wirdEmpfohlen(item, rolle)}`).toBe(
          `${rolle}/${schluessel} empfohlen=${darf}`,
        );
      });
    }
  }

  // ── Der lesbare Pin: WAS sich dadurch ändert ────────────────────────────────────────────────────
  it("die Matrix im Klartext — alle fünf Kategorien zielen heute auf Controller-Seiten", () => {
    const matrix = ROLES.map(
      (rolle) =>
        `${rolle}: ${ALLE_KATEGORIEN.filter((i) => wirdEmpfohlen(i, rolle))
          .map((i) => i.key)
          .join(",")}`,
    );
    expect(matrix).toEqual([
      "viewer: ",
      "experte: ",
      "controller: conflicts,criticalGaps,revalidation,validation,learning",
      "admin: conflicts,criticalGaps,revalidation,validation,learning",
    ]);
  });

  it("ohne Rolle bleibt der rollenblinde Altvertrag unverändert (die Aufgabenseite nutzt ihn so)", () => {
    expect(primaryWorkItem(ALLE_KATEGORIEN)?.key).toBe("conflicts");
    expect(primaryWorkItem([])).toBeNull();
  });
});
