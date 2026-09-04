// ================================================================================================
// JOB 2618 · D5 → JOB 3061 · H2 — ABGELÖST. DIESE DATEI MISST NICHTS MEHR SELBST.
// ================================================================================================
//
// WAS HIER STAND: sechzehn Messungen am Fußband der Validierungskarte, in Chromium an der
// gemounteten echten Seite, gegen das Zielbild `DESIGN_ZIELBILD_20260827/Validierung.dc.html`.
// Sie hingen an einem Anker, den es nicht mehr gibt: dem Dauertext „* Rückfrage und Ablehnung
// brauchen eine Begründung." am rechten Rand des Bandes.
//
// WARUM SIE ABGELÖST IST — und ausdrücklich nicht abgeschaltet: JOB 3061 baut die vier Prüfseiten
// auf die Mockups vom 04.09. um (`design/klarwerk/Pruefen.dc.html`, `Konflikte.dc.html`,
// `Duplikate.dc.html`). Das Zielbild vom 27.08. ist damit nicht mehr das Ziel, und eine Messung
// gegen ein überholtes Ziel ist keine Deckung, sondern eine Fessel. Der Auftrag sagt es wörtlich
// (§5.7): „`zielbild-validierung.test.ts` wird dadurch ERSETZT."
//
// DIE NACHFOLGER, und sie sind BREITER als die abgelöste Fassung:
//   · `tests/design/zielbild-h2-pruefen.test.ts` — 69 Messungen an DREI Mockups (Titel, Segment,
//     Warteschlange, Karte, Fußband, Kartenpaar, Markierung, Knöpfe) plus der Textmesser je Reiter.
//     Das Fußband selbst ist darin mit neun eigenen Fällen vertreten (P-F1…P-F9).
//   · `tests/design/h2-funktionsinventar.test.ts` — jede Funktion der alten Seiten an ihrem neuen
//     Ort, angeklickt in der gebauten Fläche.
//
// WARUM DIE DATEI ÜBERHAUPT NOCH DA IST — und das ist eine ENTSCHEIDUNG, keine Einschränkung:
// Runde 1 hat hier behauptet, die Sandkiste erlaube kein Entfernen von Dateien. Das war falsch
// (`Bash(rm *)` ist der Bahn erlaubt, der Arbeitsbaum ist beschreibbar); die Behauptung ist
// deshalb gestrichen statt stehengelassen. Die Datei bleibt aus zwei nachprüfbaren Gründen:
//   1. Sieben Messdateien nennen sie als das MUSTER, nach dem in diesem Haus gegen ein Zielbild
//      gemessen wird (`zielbild-konsole-start`, `-schlankes-panel`, `-klara-main`,
//      `-pruefunglaeuft`, `-keinwissen`, `job2935-validierung-fussband`, `zielbild-h2-pruefen`).
//   2. Ohne sie sichert nichts zu, dass die Nachfolger weiter existieren und weiter MESSEN —
//      verschwände einer, wäre die Deckung still weg. Genau das wird hier rot.
// Der Auftrag verlangt in §5.7 die ABLÖSUNG der Messung („wird dadurch ERSETZT"), nicht die
// Löschung der Datei; die alte Messung gegen das Zielbild vom 27.08. ist vollständig entfernt.
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const WURZEL = resolve(process.cwd());
const NACHFOLGER = [
  "tests/design/zielbild-h2-pruefen.test.ts",
  "tests/design/h2-funktionsinventar.test.ts",
] as const;

describe("JOB 2618 D5 · abgelöst durch JOB 3061 H2 — die Deckung ist gewandert, nicht verschwunden", () => {
  it("A1 · beide Nachfolger existieren", () => {
    for (const datei of NACHFOLGER) {
      expect(existsSync(join(WURZEL, datei)), `Nachfolger fehlt: ${datei}`).toBe(true);
    }
  });

  it("A2 · der Nachfolger misst an der ECHTEN Seite in Chromium, gegen die DREI Mockups", () => {
    const quelle = readFileSync(join(WURZEL, NACHFOLGER[0]), "utf8");
    // Dieselbe Bauart wie die abgelöste Fassung: echte App aus `dist`, echte API, Theme modern.
    expect(quelle).toContain("apps/web/dist");
    expect(quelle).toContain("buildApp");
    expect(quelle).toContain('localStorage.setItem("kw.designTheme", "modern")');
    expect(quelle).toContain("getComputedStyle");
    // Und gegen die drei Vorlagen, nicht gegen ein Nachbau-Fragment.
    expect(quelle).toContain("Pruefen.dc.html");
    expect(quelle).toContain("Konflikte.dc.html");
    expect(quelle).toContain("Duplikate.dc.html");
  });

  it("A3 · das Fußband — der Gegenstand dieser Datei — ist im Nachfolger weiterhin gemessen", () => {
    const quelle = readFileSync(join(WURZEL, NACHFOLGER[0]), "utf8");
    // Die neun Fußband-Fälle: Polster, Grund, Trennlinie, Knopfabstand, die drei Entscheidungen,
    // die Stimmenpunkte. Fällt einer weg, ist die alte Deckung wirklich verloren.
    for (const fall of ["P-F1", "P-F2", "P-F3", "P-F4", "P-F5", "P-F6", "P-F7", "P-F8", "P-F9"]) {
      expect(quelle, `Fußband-Fall ${fall} fehlt im Nachfolger`).toContain(fall);
    }
  });

  it("A4 · und der Textmesser ist dazugekommen — die Fläche zeigt, sie erklärt nicht", () => {
    const quelle = readFileSync(join(WURZEL, NACHFOLGER[0]), "utf8");
    expect(quelle).toContain("Textmesser");
    expect(quelle).toContain("data-text");
  });

  it("A5 · das Funktionsinventar hält jede Zeile aus §5a — keine still gestrichene Funktion", () => {
    const quelle = readFileSync(join(WURZEL, NACHFOLGER[1]), "utf8");
    expect(quelle).toContain("INVENTAR");
    // Die vier Menüorte, an denen die Funktionen jetzt wohnen.
    for (const ort of ["filter", "hilfe", "menue", "mehr"]) {
      expect(quelle, `Menüort ${ort} fehlt im Inventar`).toContain(`"${ort}"`);
    }
  });
});
