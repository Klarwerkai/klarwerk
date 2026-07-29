// AUFTRAG-mega54 BLOCK D2 — SAMMLER: IM ANTWORTWEG GIBT ES EINE ZERLEGUNG UND EINE GRUNDFORM.
//
// Eine zweite Zerlegung ist eine zweite Wahrheit. Sie wandert nicht mit: mega54 hat die Kennungs-
// regel und die Grundform an EINER Stelle eingebaut (services/reasoner/src/provider.ts), und die
// Zusage an den Repo-Prefilter — Vorauswahl und Ranking nutzen EXAKT dieselben Terme — hält nur
// solange, wie es diese eine Stelle gibt. Wer eine zweite einführt, wird hier rot.
//
// DIE ERHEBUNG LÄUFT ÜBER DIE BAUFORM, NICHT ÜBER EINE LISTE DER HEUTIGEN DATEIEN:
//  1. Der Antwortweg wird BERECHNET — die transitive Hülle der relativen Importe ab dem Einstieg
//     `services/ask/src/service.ts`. Kommt morgen eine Datei dazu, ist sie automatisch erfasst.
//  2. Eine ZERLEGUNG ist eine Deklaration, die `string[]` liefert und in ihrem Rumpf sowohl
//     kleinschreibt (`toLowerCase`) als auch zerteilt (`split`/`match`). Die Kleinschreibung ist
//     genau das, was Token VERGLEICHBAR macht — wer Vergleichstoken baut, faltet die Schreibweise.
//  3. Ein ENDUNGS-ABTRAG — der Kern jeder Grundform — ist eine Deklaration, die `string` liefert
//     und in ihrem Rumpf ein Wortende abträgt (`endsWith` + `slice`).
//
// AUFTRAG-mega55 BLOCK D1 — WAS DIESER SAMMLER WIRKLICH DECKT (ben, sammel52, Prüfwerkzeug 1):
// Die Erhebung sieht AUSGESCHRIEBENE `function`-Deklarationen MIT explizitem Rückgabetyp, und sie
// erkennt eine Zerlegung/Grundform nur an den oben genannten Implementierungssignaturen. NICHT
// gedeckt sind: Pfeilfunktionen, Klassenmethoden, Funktionen ohne notierten Rückgabetyp, aus einem
// Paket importierte Zerlegungen, der reine Vorsilben-Abtrag (`abtragGe`) und jede anders
// geschriebene Bauform (etwa ein Regex-`replace` statt `slice`). Der Sammler belegt also: die
// HEUTIGE Bauform gibt es genau einmal, und sie liegt in genau einer Datei. Er belegt NICHT, dass
// eine zweite Zerlegung strukturell unmöglich wäre.
//
// DER SAMMLER BEWEIST SEINE ZÄHNE: dieselbe Erhebung wird auf zwei Dateien AUSSERHALB des
// Antwortwegs angesetzt, die nachweislich eine eigene Zerlegung tragen. Findet sie dort nichts, ist
// das Kriterium blind und der Sammler wertlos — dann wird er ebenfalls rot.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const EINSTIEG = join(ROOT, "services/ask/src/service.ts");
const DIE_EINE_STELLE = "services/reasoner/src/provider.ts";

function aufloesen(von: string, spezifizierer: string): string | null {
  if (!spezifizierer.startsWith(".")) {
    return null; // Paket oder Node-Builtin — kein Produktmodul dieses Repos.
  }
  const basis = resolve(dirname(von), spezifizierer);
  for (const kandidat of [`${basis}.ts`, join(basis, "index.ts")]) {
    if (existsSync(kandidat)) {
      return kandidat;
    }
  }
  return null;
}

// Die transitive Hülle der relativen Importe ab dem Einstieg = der Antwortweg.
function antwortweg(): string[] {
  const gesehen = new Set<string>();
  const offen = [EINSTIEG];
  while (offen.length > 0) {
    const datei = offen.shift() as string;
    if (gesehen.has(datei)) {
      continue;
    }
    gesehen.add(datei);
    for (const treffer of readFileSync(datei, "utf8").matchAll(/from\s+"([^"]+)"/g)) {
      const ziel = aufloesen(datei, treffer[1] ?? "");
      if (ziel && !ziel.endsWith(".test.ts")) {
        offen.push(ziel);
      }
    }
  }
  return [...gesehen].sort();
}

interface Deklaration {
  name: string;
  rueckgabe: string;
  rumpf: string;
}

// Funktionsdeklarationen mit ausgeschriebenem Rückgabetyp samt ihrem Rumpf (Klammerpaarung).
function deklarationen(quelle: string): Deklaration[] {
  const gefunden: Deklaration[] = [];
  const kopf =
    /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([\s\S]*?\)\s*:\s*([A-Za-z<>[\]|\s]+?)\s*\{/g;
  let treffer = kopf.exec(quelle);
  while (treffer !== null) {
    let i = kopf.lastIndex - 1;
    let tiefe = 0;
    for (; i < quelle.length; i += 1) {
      if (quelle[i] === "{") {
        tiefe += 1;
      } else if (quelle[i] === "}") {
        tiefe -= 1;
        if (tiefe === 0) {
          break;
        }
      }
    }
    gefunden.push({
      name: treffer[1] ?? "",
      rueckgabe: (treffer[2] ?? "").replace(/\s+/g, " ").trim(),
      rumpf: quelle.slice(kopf.lastIndex, i),
    });
    treffer = kopf.exec(quelle);
  }
  return gefunden;
}

function istZerlegung(d: Deklaration): boolean {
  return (
    /^(?:readonly )?string\[\]$/.test(d.rueckgabe) &&
    d.rumpf.includes(".toLowerCase()") &&
    /\.(?:split|match|matchAll)\(/.test(d.rumpf)
  );
}

// Bewusst am WORTENDE festgemacht: `startsWith` + `slice` mitzunehmen würde jede HTML-/Präfix-
// Verarbeitung im Antwortweg einsammeln (nachgemessen: `services/structure/src/sanitize.ts`) und
// den Sammler zu einer Fehlalarmquelle machen. Der Abtrag der Vorsilbe „ge" (`abtragGe`) bleibt
// deshalb außerhalb dieser Erhebung — s. die Deckungsangabe im Kopf.
function istGrundform(d: Deklaration): boolean {
  return (
    /^string$/.test(d.rueckgabe) && d.rumpf.includes(".endsWith(") && d.rumpf.includes(".slice(")
  );
}

function erheben(dateien: readonly string[], pruefung: (d: Deklaration) => boolean): string[] {
  const gefunden: string[] = [];
  for (const datei of dateien) {
    for (const d of deklarationen(readFileSync(datei, "utf8"))) {
      if (pruefung(d)) {
        gefunden.push(`${relative(ROOT, datei)}:${d.name}`);
      }
    }
  }
  return gefunden;
}

// Zwei Dateien AUSSERHALB des Antwortwegs, die nachweislich eine eigene Zerlegung tragen — die
// Gegenprobe, die belegt, dass das Kriterium nicht blind ist.
const AUSSERHALB = [
  join(ROOT, "services/embedding/src/provider.ts"),
  join(ROOT, "apps/web/src/lib/librarySearch.ts"),
];

describe("AUFTRAG-mega54 D2 — Sammler: eine Zerlegung, eine Grundform", () => {
  const weg = antwortweg();

  it("der Antwortweg wird berechnet, nicht aufgezählt", () => {
    // Der Einstieg und die eine Stelle liegen darin — sonst misst der Sammler ins Leere.
    const relativ = weg.map((f) => relative(ROOT, f));
    expect(relativ).toContain("services/ask/src/service.ts");
    expect(relativ).toContain(DIE_EINE_STELLE);
    expect(relativ.length).toBeGreaterThan(20);
  });

  it("es gibt GENAU EINE Zerlegung im Antwortweg", () => {
    expect(erheben(weg, istZerlegung)).toEqual([`${DIE_EINE_STELLE}:tokenize`]);
  });

  it("es gibt GENAU EINEN Endungs-Abtrag im Antwortweg, und er liegt in DER EINEN Datei", () => {
    // mega55 A3 hat die Grundform in ihre zwei Schritte zerlegt (Endungen, dann die Vorsilbe „ge"),
    // weil BLOCK A der Vorsilbe eine andere Antwort gibt als der Endung. Das sind zwei Bausteine
    // EINER Grundform, keine zwei Grundformen. Erhoben wird der Endungs-Abtrag — namentlich, damit
    // ein zweiter sichtbar wird, statt still durchzugehen.
    const gefunden = erheben(weg, istGrundform);
    expect(gefunden).toEqual([`${DIE_EINE_STELLE}:abtragEndungen`]);
    expect([...new Set(gefunden.map((g) => g.split(":")[0]))]).toEqual([DIE_EINE_STELLE]);
  });

  it("der Sammler hat Zähne — er erkennt eine Zerlegung dort, wo es sie gibt", () => {
    // BLOCK D1: services/embedding trägt eine eigene, BERECHTIGTE zweite Bauform (anderer Zweck:
    // sprachneutrale Hash-Buckets für den Stub-Vektor, keine Stoppwörter, keine Grundform) und
    // liegt NICHT im Antwortweg. apps/web/src/lib/librarySearch.ts ist die Bibliothekssuche.
    // Beide dürfen existieren — der Sammler muss sie aber SEHEN können, sonst prüft er nichts.
    expect(erheben(AUSSERHALB, istZerlegung)).toEqual([
      "services/embedding/src/provider.ts:tokenize",
      "apps/web/src/lib/librarySearch.ts:queryTokens",
    ]);
    // …und keine der beiden ist über den Antwortweg erreichbar.
    const relativ = weg.map((f) => relative(ROOT, f));
    expect(relativ).not.toContain("services/embedding/src/provider.ts");
    expect(relativ).not.toContain("apps/web/src/lib/librarySearch.ts");
  });
});
