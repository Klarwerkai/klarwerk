// AUFTRAG-mega12 Block C (bens zweite Auflage): eine ARCHITEKTURPRÜFUNG, die in den Dirty-Flow-Modulen
// Navigation ablehnt, die am Wächter vorbeiführt.
//
// Zuschnitt, ehrlich begründet: Der Auftrag ging davon aus, dass nach Block B der Router rohe
// <Link>/<NavLink>/useNavigate ohnehin abfängt. Block B ist mit der Reißleine BEENDET (Begründung im
// Bericht) — es gibt also KEINEN Router-Blocker. Damit sind rohe Router-Navigationen weiterhin echte
// Löcher und gehören mit in die Prüfung. Sie stehen deshalb hier als ZWEITE, gesperrte Inventur
// (Teil 2), nicht als Pauschalverbot: die verbliebenen rohen Aufrufe sind einzeln begründet
// (Zustands-Räumung auf derselben Route, Navigation nach bewusstem Verwerfen bzw. nach erfolgreichem
// Speichern) und hier namentlich festgeschrieben. Jede NEUE rohe Navigation lässt den Test rot werden.
//
// Der Geltungsbereich BESTIMMT SICH SELBST: geprüft wird jede Datei unter apps/web/src, die einen
// Wächter anmeldet (`setGuard(`). Eine neue Seite mit schmutzigem Zustand ist damit automatisch
// erfasst und muss sich nicht an eine ungeschriebene Regel erinnern — genau der Bauartfehler, den
// mega11 beenden wollte.
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const WEB_SRC = join(__dirname, "../../apps/web/src");

function allSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...allSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

// Kommentare entfernen, damit eine ERWÄHNUNG (etwa „ein blanker <Link> tut das nicht") nicht als
// Treffer zählt. Genau diese Unterscheidung fehlte dem Scan aus mega8 nicht — sie wird hier
// ausdrücklich mitgeführt, weil dieser Prüfer auf JSX und nicht nur auf Importe zielt.
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

// Der Geltungsbereich: Module, die selbst einen Ungespeichert-Wächter anmelden.
const dirtyFlowFiles = allSourceFiles(WEB_SRC).filter((f) =>
  stripComments(readFileSync(f, "utf8")).includes("setGuard("),
);

const rel = (f: string): string => relative(WEB_SRC, f).replace(/\\/g, "/");

describe("Block C: Dirty-Flow-Module haben keine Ausgänge, die den Wächter umgehen", () => {
  it("der Geltungsbereich ist nicht leer und enthält die bekannten Dirty-Flow-Seiten", () => {
    const names = dirtyFlowFiles.map(rel).sort();
    // Fände der Scan nichts, wäre die ganze Prüfung ein stiller Selbstbetrug.
    expect(names.length).toBeGreaterThan(0);
    expect(names).toContain("pages/Capture.tsx");
    expect(names).toContain("pages/CaptureFrontDoor.tsx");
    expect(names).toContain("pages/Mobile.tsx");
  });

  // ── Teil 1: die harte Sperre — Wege, die selbst ein Router-Blocker NICHT sähe ────────────────────
  //
  // Diese Formen verlassen die Seite AM ROUTER VORBEI. Für sie gibt es in einem Modul mit
  // ungespeicherter Eingabe keinen legitimen Grund; deshalb ohne Ausnahmeliste.
  const BYPASS_PATTERNS: { name: string; re: RegExp }[] = [
    {
      name: "window.location-Zuweisung oder -Sprung (href/assign/replace)",
      re: /window\.location\s*=|window\.location\.(href|assign|replace)\s*[=(]|(?<!window\.)\blocation\.(href\s*=|assign\(|replace\()/,
    },
    {
      name: "History-API von Hand (pushState/replaceState/back/forward/go)",
      re: /\bhistory\.(pushState|replaceState|back|forward|go)\s*\(/,
    },
    {
      name: "<a href> auf eine interne Route (umgeht den Router vollständig)",
      re: /<a\s[^>]*href=\{?["'`]\//,
    },
    {
      name: "form action (Vollbild-Navigation durch den Browser)",
      re: /<form\s[^>]*\saction=/,
    },
  ];

  for (const { name, re } of BYPASS_PATTERNS) {
    it(`kein Dirty-Flow-Modul benutzt: ${name}`, () => {
      const offenders = dirtyFlowFiles
        .filter((f) => re.test(stripComments(readFileSync(f, "utf8"))))
        .map(rel);
      expect(offenders).toEqual([]);
    });
  }

  // ── Teil 2: die gesperrte Inventur roher Router-Navigation ───────────────────────────────────────
  //
  // Solange kein Router-Blocker existiert (Block B: Reißleine), ist jede rohe Router-Navigation in
  // einem Dirty-Flow-Modul ein möglicher Verlustpfad. Die verbliebenen sind einzeln begründet —
  // hier als Zahl festgeschrieben. Wer eine hinzufügt, muss diesen Test anfassen und dabei
  // begründen; wer einen Ausgang auf GuardedLink umstellt, darf die Zahl senken.
  const RAW_NAVIGATION_BUDGET: Record<
    string,
    { rawLink: number; rawNavigate: number; why: string }
  > = {
    "pages/Capture.tsx": {
      rawLink: 0,
      rawNavigate: 2,
      why: "2x Räumung des location.state auf DERSELBEN Route (/erfassen, replace) — kein Seitenwechsel.",
    },
    "pages/CaptureFrontDoor.tsx": {
      rawLink: 2,
      rawNavigate: 3,
      // AUFTRAG-mega70 BLOCK B (JOB 1973 · B1): 3 -> 2. Der dritte rohe Link war „Zur Prüfung
      // geben" (`/validierung`, controller) auf der Erfolgskarte — die Sackgasse aus bens
      // sammel66. Er ist jetzt ein `RoleLink` und zählt damit nicht mehr als roher Ausgang.
      // Die Zahl wird GESENKT, nicht gelockert: das Budget ist eine Obergrenze für rohe
      // Navigation, und ein Ausgang weniger ist strikt enger als vorher.
      why: "2x <Link> in der Erfolgsansicht (savedStateRef auf den geleerten Stand ⇒ beweisbar nicht dirty; der dritte ist seit mega70 Block B ein RoleLink) und 3x navigate nach bewusstem Verwerfen bzw. erfolgreichem Speichern.",
    },
    "pages/Mobile.tsx": {
      rawLink: 0,
      rawNavigate: 1,
      why: "1x navigate, das bereits SELBST in guard(...) gewickelt ist (Zurück-Knopf der Kopfzeile).",
    },
  };

  it("die rohe Navigation je Dirty-Flow-Modul bleibt auf dem begründeten Stand", () => {
    const actual: Record<string, { rawLink: number; rawNavigate: number }> = {};
    for (const file of dirtyFlowFiles) {
      const src = stripComments(readFileSync(file, "utf8"));
      // Rohes <Link>/<NavLink> — GuardedLink/GuardedNavLink treffen bewusst NICHT (Wortgrenze).
      const rawLink = (src.match(/<(?:Link|NavLink)[\s>]/g) ?? []).length;
      // Rohe navigate(...)-Aufrufe; guardedNavigate(...) ist ausgenommen.
      const rawNavigate = (src.match(/(?<![A-Za-z])navigate\s*\(/g) ?? []).length;
      actual[rel(file)] = { rawLink, rawNavigate };
    }

    for (const [name, counts] of Object.entries(actual)) {
      const budget = RAW_NAVIGATION_BUDGET[name];
      if (!budget) {
        throw new Error(
          `Neues Dirty-Flow-Modul ${name} ohne begründetes Navigations-Budget. Entweder alle Ausgänge über GuardedLink/useGuardedNavigate führen oder hier begründen.`,
        );
      }
      // Je Datei EINZELN vergleichen: die Fehlermeldung benennt damit das betroffene Modul.
      expect(`${name} rawLink=${counts.rawLink}`).toBe(`${name} rawLink=${budget.rawLink}`);
      expect(`${name} rawNavigate=${counts.rawNavigate}`).toBe(
        `${name} rawNavigate=${budget.rawNavigate}`,
      );
    }
    // Kein Budget-Eintrag darf verwaisen (Datei umbenannt/Wächter entfernt ⇒ Eintrag anpassen).
    expect(Object.keys(RAW_NAVIGATION_BUDGET).sort()).toEqual(Object.keys(actual).sort());
  });

  // ── Was diese Prüfung NICHT sieht — ausdrücklich benannt (bens Einschränkung aus mega8) ──────────
  it("die Grenzen der Prüfung sind dokumentiert", () => {
    // Ein Scan auf Zeichenketten ist der SCHNELLE Wächter, nicht der vollständige. Er sieht nicht:
    //  · Navigation, die über eine HILFSFUNKTION in einer anderen Datei läuft (z. B. ein Helfer, der
    //    intern window.location setzt und hier nur als Aufruf erscheint),
    //  · dynamisch gebaute Zugriffe (`window["loc" + "ation"]`, `globalThis[k].href = …`),
    //  · Navigation aus KIND-Komponenten, die selbst keinen Wächter anmelden, aber innerhalb einer
    //    Dirty-Flow-Seite gerendert werden (der Geltungsbereich folgt `setGuard(`, nicht dem Baum),
    //  · `<a href>` auf eine ABSOLUTE eigene URL (https://…/erfassen) statt auf einen Pfad,
    //  · ob ein GuardedLink am Ende WIRKLICH schützt — das prüfen die gemounteten Tests
    //    (capture-exits-guarded-mounted.test.tsx), nicht dieser Scan.
    // Der Test steht hier als lesbare Zusicherung, damit diese Liste nicht in einem Kommentar
    // verwelkt, den niemand mehr liest.
    expect(dirtyFlowFiles.length).toBeGreaterThanOrEqual(3);
  });
});
