// ================================================================================================
// AUFTRAG-mega61 BLOCK H — EIN KLICK, DER GELD KOSTET, SAGT ES VORHER.
// ================================================================================================
//
// DER BEFUND (Register F16): Der Beispielklick auf der Fragenfläche löst SOFORT einen echten,
// bezahlten Modellaufruf aus. Der Hinweis dazu existierte schon — aber nur zur Hälfte. Er sagte
// „das ist eine echte Anfrage an die KI". Das Wort KOSTENPFLICHTIG stand ausschließlich im
// Codekommentar (apps/web/src/pages/Ask.tsx), also genau dort, wo die Nutzerin es nie liest.
//
// EIN KOMMENTAR IM CODE IST KEINE AUSSAGE AN DEN NUTZER. Genau das war hier der Fehler, und er
// passt zum Thema dieses Auftrags: das Produkt argumentiert mit Ehrlichkeit und hat an der Stelle
// geschwiegen, an der ein Klick Geld kostet.
//
// KEIN BESTÄTIGUNGSDIALOG — das war eine bewusste Entscheidung aus mega51 und bleibt. Ein Beispiel,
// das nur das Feld füllt, wäre kein Beispiel. Der Hinweis steht deshalb VOR dem Klick: an der
// Beschriftung und als `title` an jedem einzelnen Chip.
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

describe("mega61 H · der Beispielklick sagt vorher, dass er Geld kostet", () => {
  it("der Hinweis nennt BEIDE Hälften — echte Anfrage UND kostenpflichtig, in allen drei Sprachen", () => {
    for (const [sprache, texte] of Object.entries(SPRACHEN)) {
      const hinweis = texte["ask.examplesSendHint"] ?? "";
      expect(hinweis, `${sprache}: der Hinweis fehlt`).toBeTruthy();
      expect(
        hinweis.toLowerCase(),
        `${sprache}: die Geld-Hälfte fehlt weiterhin — „${hinweis}“`,
      ).toContain(GELD[sprache]);
    }
  });

  it("er steht an der Beschriftung UND als `title` an jedem Chip — vor der Auslösung", () => {
    // Die zweite Stelle ist die wichtigere: die Beschriftung sieht man, wenn man hinschaut; der
    // `title` erreicht auch den, der direkt auf einen Chip zielt.
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
