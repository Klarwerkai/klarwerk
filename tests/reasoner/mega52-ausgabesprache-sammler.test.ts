import { readFileSync, readdirSync } from "node:fs";
import { join, sep } from "node:path";
import { describe, expect, it } from "vitest";

// ================================================================================================
// AUFTRAG-mega52 BLOCK D3 — DER SAMMLER FÜR DIE AUSGABESPRACHE.
// ================================================================================================
//
// DER VORFALL (Pedi, Word-Handlauf 28.07.): Englisch UND Niederländisch übersetzten nur die
// Metadaten, nicht den Antwortkörper. Die Ursache war nicht ein vergessener Prompt, sondern eine
// fehlende REGEL: `answerSystem` enthielt keinerlei Anweisung zur Ausgabesprache. Welche Sprache
// herauskam, ergab sich zufällig daraus, in welcher Sprache der Prompt-Zwilling formuliert war —
// bei gemischtsprachigen Quellen also gar nicht.
//
// `interviewSystem` machte es seit SCRUM-410 richtig („Antworte ausschließlich auf Deutsch." /
// „Answer in English only."). EIN Task von elf. Das ist die Klasse, nicht der Einzelfall.
//
// ────────────────────────────────────────────────────────────────────────────────────────────────
// DIE BAUFORM, NICHT DIE HEUTIGEN FÄLLE. Es steht hier bewusst keine Liste der elf Prompts. Der
// Sammler erhebt aus dem Quellbaum des Reasoner-Moduls jede Funktion, die einen System-Prompt für
// einen Modell-Task baut — erkannt an der tatsächlichen Bauform, die jeder dieser Prompts teilt:
//
//     function <name>System(locale: ReasonerLocale …): string
//
// Der Anker ist BEWUSST die Signatur und nicht eine Zeichenfolge, die jemand freiwillig setzt
// (bens Nachschärfung aus sammel45, hier gespiegelt): wer eine Aufgabe baut, die das Modell
// sprachbewusst ansprechen soll, schreibt genau diese Signatur — er kann sie nicht weglassen und
// trotzdem lokalisieren. Ein zwölfter Task morgen ist ohne Zutun Gegenstand dieser Datei.
//
// WAS VERLANGT WIRD: dass jeder dieser Prompts die Ausgabesprache über die EINE Quelle festlegt.
// Zwei Antworten sind zulässig, beide ausdrücklich:
//   · `outputLanguageRule(locale)`    — die Ausgabe ist in der GEWÄHLTEN Sprache (Antwort, Hilfe,
//     Interview, Bildbeschreibung, Anreicherung, Strukturierung, Gruppierung, Urteilsbegründung).
//   · `keepInputLanguageRule(locale)` — die Ausgabe bleibt in der Sprache des EINGABETEXTES
//     (assist glättet den Text des Experten; ihn in die UI-Sprache zu zwingen wäre schlicht falsch).
// Nicht zulässig ist das DRITTE, das bis mega52 der Normalfall war: die Frage offenlassen.
//
// Eine Aufgabe darf sich der Regel nicht durch Weglassen entziehen — es gibt hier keine Ausnahme-
// Zeichenfolge. Wer eine braucht, muss die Signatur ändern, und das ist eine sichtbare Entscheidung.
//
// ────────────────────────────────────────────────────────────────────────────────────────────────
// BENANNTE BLINDHEIT DIESER ERHEBUNG (es gibt sie immer; verschwiegen wird sie zur Falle):
//
//  1. SIE LIEST QUELLTEXT, KEIN VERHALTEN. Dass ein echtes Modell die Regel auch BEFOLGT, kann kein
//     statischer Wächter zeigen — das zeigt nur ein Lauf gegen ein echtes Modell. Belegt ist hier,
//     dass die Anweisung den Prompt überhaupt erreicht; bis mega52 tat sie das bei zehn von elf
//     Aufgaben nicht.
//  2. INDIREKTION GREIFT. Baute jemand den Prompt über eine Hilfsfunktion, die die Regel ihrerseits
//     anhängt, sähe diese Erhebung sie im Rumpf der Builder-Funktion nicht. Heute tut das niemand.
//  3. SIE PRÜFT NICHT DIE ÜBERSETZUNGSQUALITÄT der Regel selbst — nur, dass jede der drei Sprachen
//     einen eigenen, nicht-leeren Satz hat (letzter Fall unten). Ob „Antwoord uitsluitend in het
//     Nederlands." gutes Niederländisch ist, entscheidet ein Mensch.
//  4. SIE SIEHT NUR `services/reasoner/src`. Ein Modell-Task ausserhalb des Reasoner-Moduls ist
//     nicht Gegenstand — es gibt heute keinen, und die Modulgrenze ist per dependency-cruiser die
//     Stelle, an der das auffiele.
// ================================================================================================

const WURZEL = process.cwd();
const REASONER_SRC = join("services", "reasoner", "src");

// Das Modul, das die REGELN DEFINIERT, benutzt sich selbst — das ist keine Fundstelle.
const REGEL_QUELLE = "outputLanguageRule";
const REGEL_QUELLE_EINGABE = "keepInputLanguageRule";

function istQuelldatei(pfad: string): boolean {
  if (!pfad.endsWith(".ts")) {
    return false;
  }
  return !pfad.endsWith(".test.ts");
}

function quelldateien(verzeichnis: string): string[] {
  const gefunden: string[] = [];
  for (const eintrag of readdirSync(join(WURZEL, verzeichnis), { withFileTypes: true })) {
    if (eintrag.name === "node_modules" || eintrag.name.startsWith(".")) {
      continue;
    }
    const relativ = join(verzeichnis, eintrag.name);
    if (eintrag.isDirectory()) {
      gefunden.push(...quelldateien(relativ));
    } else if (istQuelldatei(relativ)) {
      gefunden.push(relativ);
    }
  }
  return gefunden;
}

// Kommentare zählen nicht: dieser Block ist im Produktcode ausführlich erklärt, und eine Erwähnung
// der Regel in einer Erklärung ist keine Verdrahtung. Gespiegelt aus mega47/mega50.
function ohneKommentare(quelle: string): string {
  return quelle.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function posix(pfad: string): string {
  return pfad.split(sep).join("/");
}

interface Quelle {
  datei: string;
  quelle: string;
}

const ALLE_QUELLEN: Quelle[] = quelldateien(REASONER_SRC).map((datei) => ({
  datei: posix(datei),
  quelle: ohneKommentare(readFileSync(join(WURZEL, datei), "utf8")),
}));

// Die Bauform eines System-Prompt-Bauers: Name endet auf `System`, erster Parameter ist die locale.
const BAUER_MUSTER = /function\s+(\w*System)\s*\(\s*locale\s*:\s*ReasonerLocale/g;

interface Bauer {
  datei: string;
  name: string;
  rumpf: string;
}

// Schneidet den Rumpf einer Funktion ab ihrem Kopf klammerbewusst heraus. Nötig, weil mehrere
// Bauer in derselben Datei stehen — eine Regel im Nachbarn ist keine Regel in dieser Funktion.
function rumpfAb(quelle: string, start: number): string {
  const auf = quelle.indexOf("{", start);
  if (auf < 0) {
    return "";
  }
  let tiefe = 0;
  for (let i = auf; i < quelle.length; i += 1) {
    if (quelle[i] === "{") {
      tiefe += 1;
    } else if (quelle[i] === "}") {
      tiefe -= 1;
      if (tiefe === 0) {
        return quelle.slice(auf, i + 1);
      }
    }
  }
  return quelle.slice(auf);
}

const BAUER: Bauer[] = ALLE_QUELLEN.flatMap((f) =>
  [...f.quelle.matchAll(BAUER_MUSTER)].map((m) => ({
    datei: f.datei,
    name: m[1] as string,
    rumpf: rumpfAb(f.quelle, m.index ?? 0),
  })),
);

function legtSpracheFest(bauer: Bauer): boolean {
  return bauer.rumpf.includes(REGEL_QUELLE) || bauer.rumpf.includes(REGEL_QUELLE_EINGABE);
}

function schluessel(b: Bauer): string {
  return `${b.datei} → ${b.name}()`;
}

describe("mega52 D3: die Erhebung greift", () => {
  it("der Quellbaum wird wirklich gelesen (ein leerer Sammler wäre ein grüner Sammler)", () => {
    expect(ALLE_QUELLEN.length).toBeGreaterThan(5);

    // Positiv-Sonde: die beiden Prompts, um die dieser Auftrag entstanden ist, MÜSSEN im Fund
    // liegen. Das ist KEINE Liste, gegen die geprüft wird — es ist die Kalibrierung, dass die
    // Erhebung nicht ins Leere greift. Die Regeln unten laufen über `BAUER`, nicht über die Namen.
    const namen = BAUER.map((b) => b.name);
    expect(namen).toContain("answerSystem");
    expect(namen).toContain("interviewSystem");

    // Die Erhebung findet die Bauer in MEHREREN Dateien — `importSelectSystem` lebt in service.ts,
    // nicht in provider-model.ts. Ein Sammler, der nur eine Datei liest, hätte ihn verpasst.
    expect(new Set(BAUER.map((b) => b.datei)).size).toBeGreaterThanOrEqual(2);
    expect(BAUER.length).toBeGreaterThanOrEqual(10);

    // Negativ-Sonde: die Rumpf-Ausschneidung trennt Nachbarn wirklich. `answerSystem` darf NICHT
    // den halben Rest der Datei enthalten (sonst wäre jede Regel irgendwo im File ein Freibrief).
    const answer = BAUER.find((b) => b.name === "answerSystem");
    expect(answer, "answerSystem nicht gefunden").toBeDefined();
    expect(answer?.rumpf).not.toContain("interviewSystem");
    expect(answer?.rumpf).not.toContain("duplicateSystem");
  });
});

describe("mega52 D3: jeder Modell-Task legt seine Ausgabesprache fest", () => {
  it("kein System-Prompt lässt die Ausgabesprache offen", () => {
    const offen = BAUER.filter((b) => !legtSpracheFest(b)).map(schluessel);

    expect(
      offen,
      "Diese Modell-Aufgaben bauen einen sprachbewussten System-Prompt, sagen dem Modell aber " +
        "NICHT, in welcher Sprache es antworten soll. Genau daran ist mega52 entstanden: die " +
        "Antwort kam in der Sprache, in der der Prompt zufällig formuliert war — für " +
        "Niederländisch also nie auf Niederländisch. Zulässig ist `outputLanguageRule(locale)` " +
        "(Ausgabe in der gewählten Sprache) oder `keepInputLanguageRule(locale)` (Ausgabe in der " +
        "Sprache des Eingabetextes). Nicht zulässig ist, die Frage offenzulassen.",
    ).toEqual([]);
  });

  it("die Regel hat für JEDE Reasoner-Sprache einen eigenen, nicht-leeren Satz", async () => {
    // Ein Record<ReasonerLocale, string> mit einem leeren nl-Eintrag wäre compilerseitig grün und
    // fachlich stumm — deshalb wird der WERT geprüft, nicht nur die Existenz des Zweigs.
    const { outputLanguageRule, keepInputLanguageRule } = await import(
      "../../services/reasoner/src/provider-model"
    );
    const sprachen = ["de", "en", "nl"] as const;
    for (const regel of [outputLanguageRule, keepInputLanguageRule]) {
      const saetze = sprachen.map((l) => regel(l));
      for (const [i, satz] of saetze.entries()) {
        expect(satz.trim().length, `leere Ausgaberegel für "${sprachen[i]}"`).toBeGreaterThan(10);
      }
      // Drei Sprachen, drei VERSCHIEDENE Sätze — ein stiller Rückfall auf Deutsch wäre genau der
      // Fehler, den `toReasonerLocale` bis mega52 gemacht hat.
      expect(new Set(saetze).size, "zwei Sprachen teilen sich denselben Satz").toBe(3);
    }
  });
});
