// ================================================================================================
// JOB 3084 (Q6) · LIEFERUNG 5 — DIE ABLÖSUNG, AUS DEM QUELLTEXT ERHOBEN.
// ================================================================================================
//
// Die Zusage lautet: nach dieser Änderung liest KEINE der zwei Auskunftsflächen den Onlinezustand
// selbst, und neben dem Hook aus `lib/netzzustand.ts` entsteht kein zweiter. Das ist eine Aussage
// über den Bestand, nicht über einen Ablauf — sie lässt sich nur am Quelltext messen, und deshalb
// steht sie hier und nicht in einem gemounteten Fall.
//
// WARUM ÜBERHAUPT: zwei Flächen zeigen dieselbe Auskunft. Läse jede ihren eigenen Onlinezustand
// (die eine `navigator.onLine`, die andere den `onlineManager`), driftete die Auskunft genau so
// auseinander wie in JOB 3002 Runde 4, als die Startseite noch `?? []` las, während die Detailseite
// schon zählte. Der Kopfkommentar von `apps/web/src/lib/eigeneKollision.ts:15-17` ist gegen diese
// Drift geschrieben; dieser Wächter hält sie für den neuen Eingang fest.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WURZEL = new URL("../../apps/web/src/", import.meta.url).pathname;

const lies = (p: string): string => readFileSync(join(WURZEL, p), "utf8");

/**
 * NUR DIE CODEZEILEN — Zeilen, die als Kommentar beginnen, fallen heraus.
 *
 * Ohne diesen Schritt wäre der Wächter unbrauchbar: die Begründung, warum eine Fläche
 * `navigator.onLine` NICHT liest, enthält die Zeichenfolge selbst (BibliothekLesen.tsx:170,
 * netzzustand.ts:13-18). Ein Wächter, der schon an seiner eigenen Erklärung rot wird, zwingt dazu,
 * die Erklärung zu löschen — und das ist die falsche Richtung.
 *
 * Die Regel ist bewusst grob und nur in EINE Richtung ungenau: sie entfernt Text, sie fügt keinen
 * hinzu. Ein echter Lesezugriff, der auf einer Zeile stünde, die mit `//` beginnt, wäre kein
 * Lesezugriff mehr, sondern ein Kommentar.
 */
function codezeilen(quelle: string): string {
  return quelle
    .split("\n")
    .filter((z) => {
      const t = z.trimStart();
      return !(t.startsWith("//") || t.startsWith("*") || t.startsWith("/*"));
    })
    .join("\n");
}

const liesCode = (p: string): string => codezeilen(lies(p));

const LESEFLAECHE = "components/bibliothek/BibliothekLesen.tsx";
const STARTFLAECHE = "components/start/StartPanel.tsx";
const FLAECHEN: readonly string[] = [LESEFLAECHE, STARTFLAECHE];

/** Jede `.ts`/`.tsx`-Datei unterhalb von `apps/web/src`, als Pfad relativ zu dieser Wurzel. */
function alleQuelldateien(unter = ""): readonly string[] {
  const aus: string[] = [];
  for (const eintrag of readdirSync(join(WURZEL, unter))) {
    const rel = unter === "" ? eintrag : `${unter}/${eintrag}`;
    if (statSync(join(WURZEL, rel)).isDirectory()) {
      aus.push(...alleQuelldateien(rel));
    } else if (/\.tsx?$/.test(rel)) {
      aus.push(rel);
    }
  }
  return aus;
}

describe("JOB 3084 · die zwei Flächen reichen den Zustand, sie deuten ihn nicht", () => {
  it("W-1 · beide Flächen rufen `useNetzOnline` — und zwar aus `lib/netzzustand`", () => {
    for (const f of FLAECHEN) {
      const quelle = lies(f);
      expect(quelle, `${f} muss den Hook importieren`).toContain('from "../../lib/netzzustand"');
      expect(quelle, `${f} muss den Hook rufen`).toContain("useNetzOnline()");
    }
  });

  it("W-2 · keine der beiden Flächen liest `navigator.onLine` oder den `onlineManager` selbst", () => {
    for (const f of FLAECHEN) {
      const code = liesCode(f);
      // KALIBRIERUNG in derselben Zeile: die Datei wurde wirklich gelesen und ist nicht leer.
      expect(code.length, `${f} muss Code enthalten`).toBeGreaterThan(1000);
      expect(code, `${f} darf navigator.onLine nicht selbst lesen`).not.toContain(
        "navigator.onLine",
      );
      expect(code, `${f} darf den onlineManager nicht selbst verdrahten`).not.toContain(
        "onlineManager",
      );
    }
  });

  it("W-3 · beide Flächen reichen den Wert wirklich an die Regel weiter", () => {
    // Ohne diesen Fall wären W-1/W-2 grün, auch wenn der Hook zwar gerufen, sein Ergebnis aber
    // nirgends verwendet würde — die Auskunft spräche dann weiter aus dem ruhenden Speicher.
    expect(lies(LESEFLAECHE)).toMatch(/eigeneKollisionDetail\([\s\S]*?\n\s*netzOnline,\n\s*\);/);
    expect(lies(STARTFLAECHE)).toMatch(
      /eigeneKollisionStart\([\s\S]*?\n\s*useNetzOnline\(\),\n\s*\);/,
    );
  });
});

describe("JOB 3084 · der Bestand an Onlinezustand-Verdrahtungen wächst nicht unbemerkt", () => {
  // WAS HIER FESTGEHALTEN WIRD, ist absichtlich der EHRLICHE Bestand und nicht ein Wunschbild:
  // drei Verdrahtungen bestanden vor diesem Auftrag und liegen außerhalb seiner Zielpfade, eine
  // kommt neu hinzu. Alle vier lesen DIESELBE Quelle (`onlineManager`), es gibt also keine zweite
  // Wahrheit — wohl aber vier Stellen, an denen sie verdrahtet ist. Wächst die Zahl, wird dieser
  // Fall rot und die Entscheidung fällt bewusst statt nebenbei.
  const ERWARTET: readonly string[] = [
    "components/einstellungen/zeilenWert.ts", // useIstOnline (vorbestehend)
    "lib/netzzustand.ts", // useNetzOnline (JOB 3084 — die Quelle für die Kollisionsauskunft)
    "pages/Stufe2.tsx", // abonniereOnline/leseOnline (vorbestehend)
    "shell/Meldungen.tsx", // useOnline (vorbestehend)
  ];

  it("W-4 · genau vier Dateien verdrahten `onlineManager.subscribe`", () => {
    const gefunden = alleQuelldateien()
      .filter((f) => liesCode(f).includes("onlineManager.subscribe"))
      .sort();
    expect(gefunden).toEqual([...ERWARTET]);
  });

  it("W-5 · `navigator.onLine` bleibt auf die zwei Stellen beschränkt, die nichts auskünden", () => {
    // `useOfflineQueue` steuert damit die Warteschlange, `AuthContext` unterdrückt einen Abruf.
    // Beides sind Handlungen, keine Auskünfte — und beide liegen außerhalb dieses Auftrags.
    const gefunden = alleQuelldateien()
      .filter((f) => liesCode(f).includes("navigator.onLine"))
      .sort();
    expect(gefunden).toEqual(["app/AuthContext.tsx", "app/useOfflineQueue.ts"]);
  });
});

describe("JOB 3084 · die Restschuld ist benannt, nicht vergessen", () => {
  // Der Auftrag nennt zwei Aufrufer der Regel (§2e). Gemessen sind es DREI: `pages/Start.tsx:116`
  // speist damit die Zeile in „FÜR DICH". Er liegt außerhalb der Zielpfade (REGELN.md §3) und wird
  // deshalb nicht angefasst — aber er wird gezählt, damit die Restschuld nicht verschwindet.
  const AUFRUFER = /eigeneKollision(Detail|Start)\(/;

  it("W-6 · genau drei Flächen rufen die Regel — zwei mit Onlinezustand, eine ohne", () => {
    const gefunden = alleQuelldateien()
      .filter((f) => f !== "lib/eigeneKollision.ts" && AUFRUFER.test(liesCode(f)))
      .sort();
    expect(gefunden).toEqual([LESEFLAECHE, STARTFLAECHE, "pages/Start.tsx"].sort());
  });

  it("W-7 · `Start.tsx` macht ohne den Zustand trotzdem keine Aussage über den Bestand", () => {
    // Das ist der Grund, warum der Vorgabewert dort tragbar ist: eine Verneinung entsteht in dieser
    // Fläche in KEINER Lage, weil sie die Zeile nur bei `art !== "keine"` UND `bestandGesichert`
    // baut. Verstellt jemand diese Bedingung, wird der Fall rot, bevor ein falscher Satz erscheint.
    const quelle = lies("pages/Start.tsx");
    expect(quelle).toContain(
      'kollisionsAuskunft.art === "keine" || !kollisionsAuskunft.bestandGesichert',
    );
  });
});
