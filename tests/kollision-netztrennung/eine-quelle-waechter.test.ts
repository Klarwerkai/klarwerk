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
// JOB 3098 (Q6b): die dritte Fläche — die Karte „FÜR DICH" auf `/start`. Sie war der Aufrufer, den
// JOB 3084 als Restschuld offenlegen musste, weil er außerhalb seiner Zielpfade lag.
const STARTSEITE = "pages/Start.tsx";
const FLAECHEN: readonly string[] = [LESEFLAECHE, STARTFLAECHE, STARTSEITE];

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

describe("JOB 3084/3098 · die drei Flächen reichen den Zustand, sie deuten ihn nicht", () => {
  it("W-1 · jede Fläche ruft `useNetzOnline` — und zwar aus `lib/netzzustand`", () => {
    for (const f of FLAECHEN) {
      const quelle = lies(f);
      // Die Tiefe des Pfades hängt am Ort der Datei (`pages/` gegen `components/…/`) — geprüft
      // wird das ZIEL des Imports, nicht seine Schreibweise.
      expect(quelle, `${f} muss den Hook importieren`).toMatch(/from "(\.\.\/)+lib\/netzzustand"/);
      expect(quelle, `${f} muss den Hook rufen`).toContain("useNetzOnline()");
    }
  });

  it("W-2 · keine der drei Flächen liest `navigator.onLine` oder den `onlineManager` selbst", () => {
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

  it("W-3 · jede Fläche reicht den Wert wirklich an die Regel weiter", () => {
    // Ohne diesen Fall wären W-1/W-2 grün, auch wenn der Hook zwar gerufen, sein Ergebnis aber
    // nirgends verwendet würde — die Auskunft spräche dann weiter aus dem ruhenden Speicher.
    expect(lies(LESEFLAECHE)).toMatch(/eigeneKollisionDetail\([\s\S]*?\n\s*netzOnline,\n\s*\);/);
    expect(lies(STARTFLAECHE)).toMatch(
      /eigeneKollisionStart\([\s\S]*?\n\s*useNetzOnline\(\),\n\s*\);/,
    );
    expect(lies(STARTSEITE)).toMatch(/eigeneKollisionStart\([\s\S]*?\n\s*netzOnline,\n\s*\);/);
  });

  it("W-3b · die Startseite reicht ihn AUCH an die Lage ihrer Karten", () => {
    // JOB 3098 Lieferung 5: `forYouLage` entscheidet, ob „FÜR DICH" überhaupt etwas behauptet.
    // Bekäme nur die Kollisionsregel den Zustand, trüge die Zeile den Vorbehalt und die Karte
    // daneben behauptete weiter Frische — zwei Aussagen über denselben Sachverhalt.
    // `liesCode` und nicht `lies`: die Begründung DIESER Regel steht als Kommentar in `Start.tsx`
    // und nennt `forYouLage()` ohne Argument. Ein Wächter, der an der Erklärung seiner eigenen
    // Regel rot wird, zwingt dazu, die Erklärung zu löschen — dieselbe Falle, gegen die
    // `codezeilen()` oben geschrieben ist (JOB 3098 Runde 2, selbst hineingelaufen).
    const quelle = liesCode(STARTSEITE);
    for (const treffer of quelle.match(/forYouLage\([^)]*\)/g) ?? []) {
      expect(treffer, "jeder forYouLage-Aufruf braucht den Onlinezustand").toContain("netzOnline");
    }
    expect((quelle.match(/forYouLage\(/g) ?? []).length, "beide Karten").toBe(2);
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

describe("JOB 3098 · die Restschuld ist abgetragen, nicht nur benannt", () => {
  // JOB 3084 hielt hier fest, dass es DREI Aufrufer gibt, zwei mit Onlinezustand und einen ohne —
  // eine ehrliche Zählung einer offenen Rechnung. Diese Rechnung ist jetzt beglichen: die Zahl der
  // Aufrufer OHNE Onlinezustand ist null, und sie kann nicht wieder wachsen, weil der Vorgabewert
  // weg ist (W-7). Der Wächter verlangt deshalb genau das und nicht weniger.
  const AUFRUFER = /eigeneKollision(Detail|Start)\(/;

  it("W-6 · genau drei Flächen rufen die Regel — und ALLE DREI reichen den Onlinezustand", () => {
    const gefunden = alleQuelldateien()
      .filter((f) => f !== "lib/eigeneKollision.ts" && AUFRUFER.test(liesCode(f)))
      .sort();
    expect(gefunden).toEqual([...FLAECHEN].sort());
  });

  it("W-7 · die Regel hat KEINEN Vorgabewert mehr — der vierte Aufrufer fällt dem Typprüfer auf", () => {
    // DIE ABLÖSUNG, aus dem Quelltext erhoben. `ONLINE_WENN_UNGEFRAGT = true` machte aus dem
    // fünften Eingang eine Bitte; drei Flächen lang war das tragbar, weil keine eine Verneinung
    // daraus baute — bis JOB 3098 den dritten Aufrufer wirklich anschloss. Ohne Vorgabewert ist
    // „vergessen" kein möglicher Zustand mehr, sondern ein Übersetzungsfehler.
    const regel = lies("lib/eigeneKollision.ts");
    expect(liesCode("lib/eigeneKollision.ts")).not.toContain("ONLINE_WENN_UNGEFRAGT");
    expect(regel, "beide Einstiege verlangen den Zustand ohne Ausnahme").toMatch(
      /eigeneKollisionDetail\([\s\S]*?online: boolean,\n\): Kollisionsauskunft/,
    );
    expect(regel).toMatch(/eigeneKollisionStart\([^)]*online: boolean\): Kollisionsauskunft/);
  });

  it("W-9 · die HANDGESCHRIEBENE zweite Quellenliste ist weg — Wiederholen liest dieselbe", () => {
    // DIE ABLÖSUNG DER RUNDE 2. Bis hierher stand die Liste der Quellen ZWEIMAL in `Start.tsx`:
    // einmal für die Lage, einmal für das Wiederholen. Runde 1 erweiterte die erste und vergaß die
    // zweite — die Karte geriet in eine Störung, aus der ihr eigener Knopf nicht mehr herausführte
    // (Ben, Korrekturpflicht 1). Dass der Knopf jetzt WIRKT, misst
    // `start-fuerdich-offline.test.tsx` (S-7/S-8) am Klick; dass es keine zweite Liste mehr GIBT,
    // ist eine Aussage über den Bestand und nur hier messbar.
    const quelle = liesCode(STARTSEITE);
    expect(quelle).toMatch(
      /const wiederholen = \(\): void => \{\s*for \(const quelle of arbeitsQuellen\) \{\s*void quelle\.refetch\(\);/,
    );
    // Genau ein weiterer Refetch bleibt: der eigene Weg der Karte „ZULETZT" (`liveWall`), die ihre
    // Lage auch aus ihrer eigenen Quelle bezieht. Wüchse diese Zahl, entstünde wieder eine Liste
    // neben der Liste.
    expect((quelle.match(/\.refetch\(\)/g) ?? []).length, "ein Refetch je Karte").toBe(2);
  });

  it("W-8 · auch `forYouLage` kennt keinen Vorgabewert für den Onlinezustand", () => {
    // Dieselbe Begründung eine Fläche weiter (JOB 3098 Lieferung 5): die Karte „FÜR DICH"
    // entscheidet über Pille und Zeilen, und ein Vorgabewert „online" wäre dort die Erlaubnis,
    // Frische zu behaupten, ohne das Netz gefragt zu haben.
    const quelle = lies("components/start/forYou.ts");
    expect(quelle).toMatch(
      /export function forYouLage\(\s*quellen: readonly ForYouQuelle\[\],\s*online: boolean,?\s*\): ForYouLage/,
    );
    expect(liesCode("components/start/forYou.ts")).not.toContain("online =");
  });
});
