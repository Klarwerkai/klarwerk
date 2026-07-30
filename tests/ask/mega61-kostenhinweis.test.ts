// ================================================================================================
// AUFTRAG-mega61 BLOCK H — EIN KLICK, DER GELD KOSTEN KANN, SAGT ES VORHER.
// AUFTRAG-mega69 BLOCK B1 (bens sammel65-Auflage 1) — UND ER SAGT ES NUR, WENN ES STIMMT.
// ================================================================================================
//
// DER BEFUND (Register F16, mega61): Der Beispielklick auf der Fragenfläche löst SOFORT einen
// Modellaufruf aus; das Wort KOSTENPFLICHTIG stand nur im Codekommentar. mega61 stellte den Satz
// sichtbar hin — aber UNBEDINGT. bens sammel65-Befund: damit umging die Fragenfläche genau die
// Bedingung, die mega67 überall sonst eingeführt hat („Kostenhinweis nur bei kostenpflichtiger
// KI"). Läuft „answer" lokal/deterministisch, war der unbedingte Satz eine falsche
// Tatsachenaussage.
//
// DIE NEUE ARBEITSTEILUNG, die dieser Test pinnt:
//  · `ask.examplesSendHint` trägt NUR die Sofort-Zusage (mega51: ein Beispiel sendet direkt,
//    das muss vorher erkennbar sein) — und KEIN Kostenwort mehr, in keiner Sprache.
//  · Die Kosten-Hälfte ist der ZENTRALE `AiCostHint` (ai.costHint), gebunden an
//    `useAiBillable("answer")` — dieselbe Ableitung wie an jeder anderen Auslösestelle.
//  · Die bedingte Anzeige selbst (Cloud/Lokal/Laden) belegt GEMOUNTET
//    tests/ask/mega69-ask-kostenhinweis-mounted.test.tsx.
//
// KEIN BESTÄTIGUNGSDIALOG — das war eine bewusste Entscheidung aus mega51 und bleibt.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WURZEL = join(__dirname, "..", "..");
const quelle = readFileSync(join(WURZEL, "apps", "web", "src", "i18n.ts"), "utf8");

function objekt(marker: string): Record<string, string> {
  const start = quelle.indexOf(marker);
  const auf = quelle.indexOf("{", start);
  const zu = quelle.indexOf("\n};", auf);
  return new Function(`return (${quelle.slice(auf, zu + 2)})`)() as Record<string, string>;
}

const SPRACHEN: Record<string, Record<string, string>> = {
  de: objekt("const de = {"),
  en: objekt("const en: typeof de = {"),
  nl: objekt("const nl: typeof de = {"),
};

// Das Geld-Wort je Sprache. Bewusst der Wortstamm, damit auch eine Umformulierung noch trägt.
const GELD: Record<string, string> = { de: "kostenpflichtig", en: "chargeable", nl: "betaalde" };

describe("mega61 H / mega69 B1 · der Beispielklick sagt vorher, was er tut — und Kosten nur bedingt", () => {
  it("der Sofort-Hinweis existiert in allen drei Sprachen — und trägt KEIN Kostenwort mehr", () => {
    for (const [sprache, texte] of Object.entries(SPRACHEN)) {
      const hinweis = texte["ask.examplesSendHint"] ?? "";
      expect(hinweis, `${sprache}: der Sofort-Hinweis fehlt`).toBeTruthy();
      // mega69 B1: ein unbedingt angezeigter Satz darf keine Kostenbehauptung tragen — die steht
      // BEDINGT im zentralen ai.costHint. Dieser Negativ-Pin verhindert, dass sie zurückrutscht.
      expect(
        hinweis.toLowerCase(),
        `${sprache}: der unbedingte Hinweis behauptet wieder Kosten — „${hinweis}“`,
      ).not.toContain(GELD[sprache]);
    }
  });

  it("die Kosten-Hälfte ist der ZENTRALE, bedingte AiCostHint an der Ableitung für „answer“", () => {
    const ask = readFileSync(join(WURZEL, "apps", "web", "src", "pages", "Ask.tsx"), "utf8");
    // Dieselbe Ableitung wie überall: useAiBillable("answer") → <AiCostHint billable={…}>.
    expect(ask).toContain('useAiBillable("answer")');
    expect(ask).toContain("<AiCostHint billable={answerBillable}");
    // Und der zentrale Wortlaut nennt die Kosten weiterhin — als Möglichkeit (mega69 B2).
    for (const [sprache, texte] of Object.entries(SPRACHEN)) {
      const zentral = texte["ai.costHint"] ?? "";
      expect(zentral.toLowerCase(), `${sprache}: ai.costHint nennt die Kosten nicht`).toContain(
        GELD[sprache],
      );
      expect(zentral.toLowerCase(), `${sprache}: ai.costHint ist wieder absolut`).toContain(
        { de: "kann", en: "may", nl: "kan" }[sprache] as string,
      );
    }
  });

  it("der Sofort-Hinweis steht an der Beschriftung UND als `title` an jedem Chip — vor der Auslösung", () => {
    const ask = readFileSync(join(WURZEL, "apps", "web", "src", "pages", "Ask.tsx"), "utf8");
    const vorkommen = ask.split('t("ask.examplesSendHint")').length - 1;
    expect(vorkommen, "der Hinweis steht nicht an beiden Stellen").toBeGreaterThanOrEqual(2);
    expect(ask).toContain('title={t("ask.examplesSendHint")}');
  });

  it("und der Chip löst WIRKLICH sofort aus — sonst wäre der Hinweis überflüssig", () => {
    // Kalibrierung: der Hinweis ist nur dann Pflicht, wenn der Klick auch wirklich sendet. Würde
    // jemand daraus ein bloßes Füllen des Eingabefelds machen, gehörte der Hinweis überarbeitet.
    const ask = readFileSync(join(WURZEL, "apps", "web", "src", "pages", "Ask.tsx"), "utf8");
    expect(ask).toContain("onClick={() => askExample(question)}");
    expect(ask).toMatch(/const askExample[\s\S]{0,400}submitAsk/);
  });
});
