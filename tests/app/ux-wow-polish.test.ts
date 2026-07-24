// WP-UX-WOW-1 (U4/U5/U6/U7): Verdrahtungs-Pins + Logik der kleineren Politur-Befunde und die
// DE/EN/NL-Vollständigkeit aller neuen Texte (Muster import-explore-wiring).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import i18n from "../../apps/web/src/i18n";
import { libraryUseCta } from "../../apps/web/src/lib/libraryMaturity";

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

function ko(over: Partial<KnowledgeObject>): KnowledgeObject {
  return {
    id: "k1",
    title: "Ventil X bei Überdruck schließen",
    statement: "Aussage",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Wartung",
    tags: [],
    confidence: 50,
    trust: 10,
    status: "validiert",
    version: 1,
    originalAuthor: "u1",
    author: "u1",
    neededValidations: 0,
    assignments: [],
    asset: null,
    ...over,
  } as KnowledgeObject;
}

describe("WP-UX-WOW-1 U5: Fragen-Knopf stellt eine echte Frage und sendet direkt", () => {
  it("libraryUseCta nutzt die formulierte Frage und den ?ask=1-Direktantwort-Weg", () => {
    const cta = libraryUseCta(ko({}), "Was gilt zu: Ventil X bei Überdruck schließen?");
    expect(cta.kind).toBe("ask");
    expect(decodeURIComponent(cta.href)).toContain("Was gilt zu: Ventil X");
    expect(cta.href).toContain("&ask=1"); // direkt beantworten — kein zweiter Klick
  });

  it("die Bibliothek reicht das lokalisierte Frage-Muster herein; Enter sendet (Form-Submit)", () => {
    const lib = read("apps/web/src/pages/Library.tsx");
    expect(lib).toContain('libraryUseCta(k, t("ask.koQuestion", { title: k.title }))');
    // Ask-Eingabe: einzeiliges input IN einem form mit type=submit → Enter sendet nativ.
    const ask = read("apps/web/src/pages/Ask.tsx");
    expect(ask).toContain("<form");
    // PAKET 1 (D-AISTATE): der Submit-Button ist jetzt mehrzeilig (disabled/title für Modell-Zustand) —
    // der Submit-Typ im Form bleibt die geprüfte Wahrheit (Enter sendet nativ).
    expect(ask).toContain('type="submit"');
  });
});

describe("WP-UX-WOW-1 U4: Bibliothek-Karten lesbar", () => {
  it("Titel zweizeilig per line-clamp (Volltext im title-Attribut) statt harter Kappung", () => {
    const lib = read("apps/web/src/pages/Library.tsx");
    expect(lib).toContain("line-clamp-2");
    expect(lib).toContain("title={k.title}");
  });

  it("Autor-Zeile trägt den Volltext im title-Attribut", () => {
    const author = read("apps/web/src/components/trust/KoAuthorLine.tsx");
    expect(author).toContain("<div title={text}");
  });

  it("validiert + Trust 0 → nüchterner Hinweis statt leerer Leiste (Leiste erst ab Trust > 0)", () => {
    const lib = read("apps/web/src/pages/Library.tsx");
    expect(lib).toContain('deriveStatus(k) === "validiert" && k.trust === 0');
    expect(lib).toContain('t("lib.trustNone")');
    expect(lib).toContain('title={t("lib.trustNoneHint")}');
  });
});

describe("WP-UX-WOW-1 U6: Konflikte-Leerzustand erklärt", () => {
  it("der Leerzustand erklärt Konflikte und verlinkt (Admin) auf die Beispielpakete", () => {
    const conflicts = read("apps/web/src/pages/Conflicts.tsx");
    expect(conflicts).toContain('t("con.emptyWhat")');
    expect(conflicts).toContain('t("con.emptyHow")');
    expect(conflicts).toContain('role === "admin"');
    expect(conflicts).toContain('to="/import#beispielpakete"');
  });

  it("der Beispielpakete-Kasten trägt den Anker und scrollt beim Deep-Link hin", () => {
    const packages = read("apps/web/src/components/ExamplePackages.tsx");
    expect(packages).toContain('id="beispielpakete"');
    expect(packages).toContain('window.location.hash === "#beispielpakete"');
  });
});

describe("WP-UX-WOW-1 U7: echte Umlaute in Nutzertexten", () => {
  it("keine ASCII-Umlaut-Formen mehr in den betroffenen Anzeige-Strings", () => {
    const capture = read("apps/web/src/pages/Capture.tsx");
    expect(capture).toContain("Dokument-Canvas für Titel");
    expect(capture).toContain("Dokument-Canvas öffnen");
    expect(capture).not.toContain("Entwuerfe");
    expect(capture).not.toContain("naechsten Oeffnen");
    const editor = read("apps/web/src/components/RichTextEditor.tsx");
    expect(editor).toContain("Bildgröße");
    expect(editor).not.toContain("Bildgroesse");
    const frontDoorLib = read("apps/web/src/lib/captureFrontDoor.ts");
    expect(frontDoorLib).toContain("Bitte prüfe Bibliothek oder Entwürfe");
  });
});

describe("WP-UX-WOW-1: neue Texte in DE/EN/NL vollständig", () => {
  it("alle neuen Keys existieren in allen drei Sprachen", () => {
    const keys = [
      "ask.koQuestion",
      "ask.expect.neutral",
      "lib.trustNone",
      "lib.trustNoneHint",
      "con.emptyWhat",
      "con.emptyHow",
      "con.emptyExamplesHint",
      "con.emptyExamplesCta",
      "stage2.gate.title",
      "stage2.gate.body",
      "stage2.gate.enable",
      "stage2.gate.adminOnly",
      "stage2.gate.back",
    ];
    for (const key of keys) {
      for (const lng of ["de", "en", "nl"]) {
        expect(
          String(i18n.getResource(lng, "translation", key) ?? "").length,
          `${lng}:${key}`,
        ).toBeGreaterThan(0);
      }
    }
    // Das Frage-Muster behält den Platzhalter in jeder Sprache.
    for (const lng of ["de", "en", "nl"]) {
      expect(String(i18n.getResource(lng, "translation", "ask.koQuestion"))).toContain("{{title}}");
    }
  });
});
