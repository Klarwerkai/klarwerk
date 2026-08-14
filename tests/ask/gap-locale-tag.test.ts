// GAP-SPRACHHERKUNFT · Anzeigeseite: das Etikett am fremdsprachigen Lückentitel.
//
// Der Befund des Design-Leads war, dass in der deutschen Aufgabenliste ein englischer Titel steht
// und wie ein Fehler aussieht. Der Titel bleibt (er ist der Beleg der Originalfrage) — die Liste
// sagt jetzt dazu, WOHER er kommt.
//
// Regeln, die dieser Test festhält:
//   · gleiche Sprache wie die Oberfläche  → KEIN Etikett (sonst klebt an jedem deutschen Eintrag
//     einer deutschen Liste das Wort „Deutsch")
//   · fremde Sprache                       → Sprachname, in der Sprache der Oberfläche
//   · Altbestand ohne Sprachangabe         → KEIN Etikett (nichts behaupten, was nicht belegt ist)
import { describe, expect, it } from "vitest";
import { gapLocaleTag } from "../../apps/web/src/lib/gapLocaleTag";

describe("GAP-SPRACHHERKUNFT: Etikett am Lückentitel", () => {
  it("englische Lücke in deutscher Oberfläche → deutscher Sprachname", () => {
    expect(gapLocaleTag("en", "de")).toBe("Englisch");
  });

  it("deutsche Lücke in englischer Oberfläche → englischer Sprachname", () => {
    expect(gapLocaleTag("de", "en")).toBe("German");
  });

  it("gleiche Sprache → kein Etikett", () => {
    expect(gapLocaleTag("de", "de")).toBeNull();
    expect(gapLocaleTag("en", "en")).toBeNull();
  });

  it("Altbestand ohne Sprachangabe → kein Etikett, keine Behauptung", () => {
    expect(gapLocaleTag(undefined, "de")).toBeNull();
  });

  it("Regionalkennungen zählen als dieselbe Sprache (de-CH ist Deutsch)", () => {
    // i18next liefert je nach Browsereinstellung „de-CH" statt „de". Ohne diese Regel trüge in
    // einer Schweizer Oberfläche jeder deutsche Eintrag das Etikett „Deutsch".
    expect(gapLocaleTag("de", "de-CH")).toBeNull();
    expect(gapLocaleTag("en", "en-GB")).toBeNull();
  });

  it("niederländische Lücke wird ebenfalls benannt", () => {
    expect(gapLocaleTag("nl", "de")).toBe("Niederländisch");
  });

  it("unbekannte Anzeigesprache lässt das Etikett nicht platzen", () => {
    // Fail-soft: lieber der rohe Sprachcode als eine leere oder abstürzende Liste.
    const tag = gapLocaleTag("en", "zz");
    expect(tag === null || typeof tag === "string").toBe(true);
  });
});
