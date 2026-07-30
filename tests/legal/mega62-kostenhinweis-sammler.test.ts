// ================================================================================================
// AUFTRAG-mega62 BLOCK F — DER KOSTENHINWEIS GILT FÜR ALLE AUSLÖSESTELLEN.
// ================================================================================================
//
// DER BEFUND (bens mega61-Anmerkung 5): Der Hinweis war für den Beispielklick auf der Fragenfläche
// korrekt in DE/EN/NL vorhanden und kalibriert (tests/ask/mega61-kostenhinweis.test.ts) — und fehlte
// an Strukturieren, Extrahieren, Interview, Umformulieren, Gruppieren und Bildbeschreibung. Block H
// aus mega61 war damit fachlich zu einem Siebtel erledigt.
//
// DER SAMMLER RECHNET DIE FLÄCHEN AUS, statt sie aufzuzählen. Die Regel:
//
//     Jede Datei unter apps/web/src, die (a) `useAiAvailable(...)` aufruft ODER (b) einen Träger
//     der KI-Kennzeichnung rendert (`<AiGeneratedNotice`, `<AiModelInfo`), ist eine Modellfläche —
//     und muss den Kostenhinweis tragen, direkt (`<AiCostHint`) oder über die Modellangabe.
//
// WARUM ZWEI ANKER UND NICHT NUR `useAiAvailable`: mega61 hat gezeigt, dass vier echte
// Auslösestellen ihn NICHT selbst aufrufen (BodyExtractPanel, RichTextEditor, CaptureFrontDoor,
// ImportGroups — sie bekommen die Verfügbarkeit durchgereicht oder gar nicht). Ein Sammler allein
// über `useAiAvailable` hätte genau die Stellen ausgelassen, um die es hier geht — er hätte mehr
// behauptet, als er prüft. Der zweite Anker schließt sie ein: Wer eine Modellfläche baut, trägt
// seit mega61 die KI-Kennzeichnung (eigener Sammler), und damit greift diese Regel auch für ihn.
//
// DIE AUSNAHMEN sind benannt, begründet und GEBUNDEN — eine Ausnahme, die niemand mehr braucht,
// wird rot, und die eine inhaltliche Ausnahme (die Fragenfläche) ist an ihren eigenen, älteren
// Kostenhinweis gebunden. Eine pauschale Ausnahme gibt es nicht.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WURZEL = join(__dirname, "..", "..");
const WEB = join("apps", "web", "src");
const SCHLUESSEL = "ai.costHint";

/** Wer den Kostenhinweis trägt: direkt, oder über die Modellangabe (die ihn seit mega62 enthält). */
const TRAEGER = ["AiCostHint", "AiModelInfo"];
/** Wer die KI-Kennzeichnung trägt — der zweite Anker der Erhebung (s. Kopf). */
const KENNZEICHNUNG = ["AiGeneratedNotice", "AiModelInfo"];

const AUSNAHMEN: Record<string, string> = {
  [join(WEB, "app", "ImageDescribeContext.tsx")]:
    "KEINE Fläche, sondern der WEG zur Bildbeschreibung für die ganze App (mega50 Block A). Er " +
    "rendert nichts Sichtbares; den Hinweis tragen die beiden Stellen, die den Vorschlag anbieten " +
    "(components/RichTextEditor.tsx, Fußnoten-Leiste und Bildbeschreibungs-Formular).",
  [join(WEB, "components", "ImportSelect.tsx")]:
    "Reicht die Verfügbarkeit nur DURCH an ImportGroups, das den Gruppierungsschritt rendert und " +
    "den Hinweis trägt. Hier gibt es keinen Auslöser — der Halbsatz stünde an einer Stelle, an " +
    "der nichts ausgelöst werden kann, und wäre damit selbst irreführend.",
  [join(WEB, "lib", "useAiAvailable.tsx")]:
    "Die Vorrichtung SELBST — sie definiert den Haken, an dem dieser Sammler hängt, und ist keine " +
    "Fläche. Sie rendert nichts und hat keinen Auslöser; ein Hinweis stünde hier an einer Stelle, " +
    "die niemand sieht.",
  // KEINE Ausnahme für components/AiGeneratedNotice.tsx: Die Datei DEFINIERT den Träger, rendert
  // ihn aber nicht — der Sammler sieht sie deshalb gar nicht erst als Fläche. Ein Eintrag hier
  // wäre eine Ausnahme ohne Fall, und der Fall unten („wird noch gebraucht") würde ihn rot melden.
  // Dass der Träger selbst KEINEN Kostenhinweis enthält, ist trotzdem Absicht: er steht auch an
  // ERGEBNISSEN (der fertigen Antwort), und dort wäre eine Kostenwarnung eine nach dem Schuss.
  // KEINE Ausnahme mehr für pages/Ask.tsx: seit AUFTRAG-mega69 B1 (bens sammel65-Auflage 1) trägt
  // die Fragenfläche den ZENTRALEN, bedingten <AiCostHint> am Auslöser selbst — sie erfüllt die
  // Regel direkt, statt über einen eigenen, unbedingten Wortlaut davon ausgenommen zu sein.
};

/** Der Sofort-Hinweis der Fragenfläche (seit mega69 B1 OHNE Kostenbehauptung — die trägt der
 * zentrale, bedingte AiCostHint daneben). */
const ASK_SCHLUESSEL = "ask.examplesSendHint";

function quelldateien(verzeichnis: string): string[] {
  const gefunden: string[] = [];
  for (const eintrag of readdirSync(join(WURZEL, verzeichnis))) {
    if (eintrag === "node_modules" || eintrag === "dist" || eintrag.startsWith(".")) {
      continue;
    }
    const relativ = join(verzeichnis, eintrag);
    if (statSync(join(WURZEL, relativ)).isDirectory()) {
      gefunden.push(...quelldateien(relativ));
    } else if (
      (relativ.endsWith(".ts") || relativ.endsWith(".tsx")) &&
      !relativ.endsWith(".test.ts") &&
      !relativ.endsWith(".test.tsx")
    ) {
      gefunden.push(relativ);
    }
  }
  return gefunden;
}

/** Kommentarzeilen raus — eine in Prosa erwähnte Fläche ist keine Fläche. */
function ohneKommentare(inhalt: string): string {
  return inhalt.replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

/** Die Modellflächen — BERECHNET über beide Anker, nicht aufgezählt. */
function modellflaechen(): string[] {
  return quelldateien(WEB).filter((datei) => {
    const inhalt = ohneKommentare(readFileSync(join(WURZEL, datei), "utf8"));
    if (/\buseAiAvailable\s*\(/.test(inhalt)) {
      return true;
    }
    return KENNZEICHNUNG.some((name) => inhalt.includes(`<${name}`));
  });
}

describe("mega62 F · der Kostenhinweis an jeder Auslösestelle", () => {
  it("die Erhebung greift überhaupt — ein leerer Sammler wäre ein grüner Sammler", () => {
    expect(quelldateien(WEB).length).toBeGreaterThan(100);
    // Vor mega62 waren es sieben Flächen; weniger als sieben hieße, der Anker hat sich gelöst.
    expect(modellflaechen().length).toBeGreaterThanOrEqual(7);
  });

  it("der Hinweis existiert als EIN Schlüssel in allen drei Sprachen", () => {
    const i18n = readFileSync(join(WURZEL, WEB, "i18n.ts"), "utf8");
    const treffer = i18n.split("\n").filter((z) => z.includes(`"${SCHLUESSEL}"`));
    expect(treffer.length, "der Hinweis fehlt in einer der drei Sprachen").toBe(3);
  });

  it("JEDE berechnete Modellfläche trägt den Kostenhinweis", () => {
    const verstoesse: string[] = [];
    for (const datei of modellflaechen()) {
      if (datei in AUSNAHMEN) {
        continue;
      }
      const inhalt = ohneKommentare(readFileSync(join(WURZEL, datei), "utf8"));
      if (!TRAEGER.some((traeger) => inhalt.includes(`<${traeger}`))) {
        verstoesse.push(`${datei} löst ein Modell aus, zeigt aber den Kostenhinweis nicht`);
      }
    }
    expect(verstoesse).toEqual([]);
  });

  it("die Modellangabe trägt ihn WIRKLICH — sonst wäre die Regel oben hohl", () => {
    // Ohne diesen Fall wäre jede Fläche mit `<AiModelInfo` grün, auch wenn dort nichts stünde.
    const info = readFileSync(join(WURZEL, WEB, "components", "AiModelInfo.tsx"), "utf8");
    expect(info).toContain("<AiCostHint");
    const hinweis = readFileSync(join(WURZEL, WEB, "components", "AiCostHint.tsx"), "utf8");
    expect(hinweis).toContain(SCHLUESSEL);
  });

  it("jede benannte Ausnahme ist begründet — und wird noch gebraucht", () => {
    const flaechen = new Set(modellflaechen());
    for (const [datei, grund] of Object.entries(AUSNAHMEN)) {
      expect(grund.length, `Ausnahme ${datei} ohne echten Grund`).toBeGreaterThan(60);
      expect(datei).not.toContain("*");
      expect(flaechen.has(datei), `Ausnahme ${datei} wird nicht mehr gebraucht`).toBe(true);
    }
  });

  it("die Fragenfläche trägt den ZENTRALEN Hinweis am Auslöser — und den Sofort-Satz dazu", () => {
    // mega69 B1: keine Ausnahme mehr — Ask rendert <AiCostHint> (bedingt, zentrale Ableitung) und
    // behält den kostenfreien Sofort-Hinweis an Beschriftung und Chip-`title`.
    const ask = readFileSync(join(WURZEL, WEB, "pages", "Ask.tsx"), "utf8");
    expect(ask).toContain("<AiCostHint");
    expect(ask).toContain(`t("${ASK_SCHLUESSEL}")`);
    expect(ask).toContain(`title={t("${ASK_SCHLUESSEL}")}`);
  });

  it("die sechs nachgerüsteten Auslösestellen tragen ihn — namentlich, weil sie der Befund waren", () => {
    // Strukturieren, Extrahieren, Interview, Umformulieren, Gruppieren, Bildbeschreibung. Jede
    // Zeile nennt die Fläche und den Weg, auf dem der Hinweis sie erreicht.
    const nachgeruestet: ReadonlyArray<[string, string]> = [
      [join(WEB, "pages", "Capture.tsx"), "Strukturieren, Extrahieren, Interview"],
      [join(WEB, "components", "BodyExtractPanel.tsx"), "Extrahieren im Fließtext"],
      [join(WEB, "components", "AiAssistBox.tsx"), "Umformulieren"],
      [join(WEB, "pages", "CaptureFrontDoor.tsx"), "Strukturieren und Umformulieren an der Tür"],
      [join(WEB, "components", "ImportGroups.tsx"), "Gruppieren"],
      [join(WEB, "components", "RichTextEditor.tsx"), "Bildbeschreibung, beide Stellen"],
    ];
    for (const [datei, was] of nachgeruestet) {
      const inhalt = ohneKommentare(readFileSync(join(WURZEL, datei), "utf8"));
      expect(
        TRAEGER.some((traeger) => inhalt.includes(`<${traeger}`)),
        `${datei} (${was}) trägt den Kostenhinweis nicht`,
      ).toBe(true);
    }
  });

  it("der Wortlaut nennt in jeder Sprache wirklich die Kosten", () => {
    // Ein Halbsatz, der alles Mögliche sagt, nur nicht, dass es Geld kostet, wäre kein Hinweis.
    // Dieselbe Kalibrierung wie in tests/ask/mega61-kostenhinweis.test.ts.
    const i18n = readFileSync(join(WURZEL, WEB, "i18n.ts"), "utf8");
    const zeilen = i18n.split("\n").filter((z) => z.includes(`"${SCHLUESSEL}"`));
    const stamm = ["kostenpflichtig", "chargeable", "betaalde"];
    for (const [i, wort] of stamm.entries()) {
      expect(zeilen[i]?.toLowerCase(), `Sprache ${i + 1} nennt die Kosten nicht`).toContain(wort);
    }
  });
});
