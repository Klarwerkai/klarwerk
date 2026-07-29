// AUFTRAG-mega54 BLOCK E6 — SAMMLER: KEINE FLÄCHE ZEIGT ZU EINER LÜCKE MEHR ALS EINEN NÄCHSTEN
// SCHRITT.
//
// DER BEFUND (vom Kopf am Code nachgesehen, OFFEN.md S4): bei jeder Wissenslücke stand auf dem
// Desktop ZWEIMAL „Nächster Schritt:", mit ZWEI VERSCHIEDENEN Antworten — oben im Vertragskasten
// „die Frage noch einmal mit den Fachwörtern aus eurem Betrieb stellen", unten in der Lückenkarte
// „Lücke im Risiko-Board priorisieren oder einem Experten zuweisen". Auf Mobile fehlte der
// kostenlose Schritt ganz. Zwei widersprüchliche nächste Schritte auf einem Bildschirm sind
// schlechter als einer.
//
// DIE ERHEBUNG LÄUFT ÜBER DIE BAUFORM, NICHT ÜBER EINE LISTE DER HEUTIGEN TEXTE:
//  1. Eine LÜCKENFLÄCHE ist jede Oberfläche, die die Lückenüberschrift `ask.noBasisTitle` RENDERT
//     (`t("ask.noBasisTitle")`). AUFTRAG-mega55 BLOCK D2 (ben, sammel52, Prüfwerkzeug 2): dafür
//     wird der GANZE Quellbaum `apps/web/src` durchsucht, nicht mehr eine feste Liste von sechs
//     Dateien — eine morgen gebaute dritte Lückenfläche ist damit wirklich automatisch erfasst.
//     Nicht gedeckt bleibt, wer den Schlüssel BERECHNET statt ihn zu schreiben; das ist die Grenze
//     einer Quelltext-Erhebung und steht hier, statt behauptet zu werden.
//  2. Ein NÄCHSTER-SCHRITT-SATZ ist jeder i18n-Schlüssel, dessen deutscher Wert mit
//     „Nächster Schritt:" beginnt — ein ganzer Satz, nicht die bloße Beschriftung „Nächster
//     Schritt" (die im Risiko-Board und im Lebenszyklus als Feldname steht und dort richtig ist).
//     Wer einen neuen solchen Satz erfindet und in eine Lückenfläche hängt, wird rot.
//  3. Der Schlüssel des Vertragskastens wird NICHT aus dem Quelltext geraten, sondern beim echten
//     Modul erfragt: `answerContract("gap").nextStepKey`.
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { answerContract } from "../../apps/web/src/lib/askAnswerContract";

const i18nQuelle = readFileSync(
  fileURLToPath(new URL("../../apps/web/src/i18n.ts", import.meta.url)),
  "utf8",
);

function woerterbuch(marker: string): Record<string, string> {
  const start = i18nQuelle.indexOf(marker);
  if (start < 0) {
    throw new Error(`Marker nicht gefunden: ${marker}`);
  }
  const auf = i18nQuelle.indexOf("{", start);
  const zu = i18nQuelle.indexOf("\n};", auf);
  return new Function(`return (${i18nQuelle.slice(auf, zu + 2)})`)() as Record<string, string>;
}

const de = woerterbuch("const de = {");
const en = woerterbuch("const en: typeof de = {");
const nl = woerterbuch("const nl: typeof de = {");

// Erhebung 2: die Menge der Nächster-Schritt-SÄTZE. Aus den Werten erhoben, nicht aufgezählt.
const NAECHSTER_SCHRITT_SAETZE = Object.keys(de).filter((k) =>
  /^Nächster Schritt:/.test(de[k] ?? ""),
);

// Erhebung 1: die Lückenflächen. REPO-WEIT aus dem Quelltext erhoben, nicht aufgezählt (mega55 D2).
const WEB_SRC = fileURLToPath(new URL("../../apps/web/src", import.meta.url));

function alleQuelldateien(verzeichnis: string): string[] {
  const gefunden: string[] = [];
  for (const eintrag of readdirSync(verzeichnis, { withFileTypes: true })) {
    const pfad = join(verzeichnis, eintrag.name);
    if (eintrag.isDirectory()) {
      gefunden.push(...alleQuelldateien(pfad));
    } else if (/\.tsx?$/.test(eintrag.name) && !/\.test\.tsx?$/.test(eintrag.name)) {
      gefunden.push(pfad);
    }
  }
  return gefunden.sort();
}

const OBERFLAECHEN = alleQuelldateien(WEB_SRC);

function quelle(pfad: string): string {
  return readFileSync(pfad, "utf8");
}

// Gerendert wird der Schlüssel über die Übersetzungsfunktion — das Wörterbuch selbst (i18n.ts), das
// den Schlüssel nur DEFINIERT, ist damit keine Lückenfläche.
const LUECKENFLAECHEN = OBERFLAECHEN.filter((p) => /\bt\(\s*"ask\.noBasisTitle"/.test(quelle(p)));

// Welche Nächster-Schritt-Sätze rendert eine Fläche? Direkt als Schlüssel-Literal — und indirekt
// über den Vertragskasten, dessen Lücken-Schlüssel beim echten Modul erfragt wird.
function saetzeDerFlaeche(pfad: string): string[] {
  const src = quelle(pfad);
  const gefunden = new Set<string>();
  for (const key of NAECHSTER_SCHRITT_SAETZE) {
    if (src.includes(`"${key}"`)) {
      gefunden.add(key);
    }
  }
  if (src.includes("contract.nextStepKey")) {
    gefunden.add(answerContract("gap").nextStepKey);
  }
  return [...gefunden].sort();
}

describe("AUFTRAG-mega54 E6 — Sammler: ein nächster Schritt je Lücke", () => {
  it("die Erhebung findet überhaupt Lückenflächen (sonst prüft der Sammler nichts)", () => {
    // Der Scan läuft über den ganzen Quellbaum — er muss deutlich mehr Dateien sehen als die sechs
    // der früheren Fassung, sonst greift er ins Leere.
    expect(OBERFLAECHEN.length).toBeGreaterThan(50);
    expect(LUECKENFLAECHEN.length).toBeGreaterThanOrEqual(2);
    const relativ = LUECKENFLAECHEN.map((p) => relative(WEB_SRC, p));
    expect(relativ).toContain("pages/Ask.tsx");
    expect(relativ).toContain("pages/Mobile.tsx");
  });

  it("JEDE Lückenfläche nennt GENAU EINEN nächsten Schritt — nicht zwei, nicht keinen", () => {
    const befund = LUECKENFLAECHEN.map((p) => ({ flaeche: p, saetze: saetzeDerFlaeche(p) }));
    const abweichend = befund.filter((b) => b.saetze.length !== 1);
    expect(abweichend).toEqual([]);
  });

  it("alle Lückenflächen nennen DENSELBEN — eine Lücke, eine Formulierung", () => {
    const alle = new Set(LUECKENFLAECHEN.flatMap(saetzeDerFlaeche));
    expect([...alle]).toEqual([answerContract("gap").nextStepKey]);
  });

  it("der eine Satz steht vollständig in DE, EN und NL (E5)", () => {
    const key = answerContract("gap").nextStepKey;
    for (const [sprache, dict] of [
      ["de", de],
      ["en", en],
      ["nl", nl],
    ] as const) {
      expect({ sprache, wert: (dict[key] ?? "").length > 0 }).toEqual({ sprache, wert: true });
    }
  });

  it("die Reihenfolge steht: erst der kostenlose Schritt, zuletzt das Risiko-Board (E2)", () => {
    const key = answerContract("gap").nextStepKey;
    // Anker je Sprache — der teuerste Schritt steht nie vorn.
    const anker: Array<[string, Record<string, string>, string, string, string]> = [
      ["de", de, "Fachwörtern", "erfassen", "Risiko-Board"],
      ["en", en, "terms", "capture", "risk board"],
      ["nl", nl, "vakwoorden", "kennis", "risicobord"],
    ];
    for (const [sprache, dict, kostenlos, erfassen, board] of anker) {
      const text = dict[key] ?? "";
      expect({
        sprache,
        reihenfolge:
          text.indexOf(kostenlos) >= 0 &&
          text.indexOf(kostenlos) < text.indexOf(erfassen) &&
          text.indexOf(erfassen) < text.indexOf(board),
      }).toEqual({ sprache, reihenfolge: true });
    }
  });

  it("es gibt keinen zweiten, konkurrierenden Lücken-Satz mehr im Wörterbuch", () => {
    // Der Vertragskasten und die Lückenkarte teilen sich EINEN Schlüssel. Ein zweiter Satz, der
    // ebenfalls von einer Lücke handelt, wäre die alte Doppelung — er wird hier sichtbar.
    const luecken = NAECHSTER_SCHRITT_SAETZE.filter((k) => /^ask\./.test(k) && /gap/i.test(k));
    expect(luecken).toEqual([answerContract("gap").nextStepKey]);
  });
});
