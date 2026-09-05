// WP-UX-WOW-1 (U4/U5/U6/U7): Verdrahtungs-Pins + Logik der kleineren Politur-Befunde und die
// DE/EN/NL-Vollständigkeit aller neuen Texte (Muster import-explore-wiring).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import { fragenHref } from "../../apps/web/src/components/bibliothek/fragen";
import i18n from "../../apps/web/src/i18n";

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
  it("fragenHref nutzt die formulierte Frage, den ?ask=1-Weg und den Bezug auf den Eintrag", () => {
    // JOB 3063 (H4, Runde 5): die Adresse kommt nicht mehr aus `libraryUseCta` (das über die Reife
    // verzweigte und offene Einträge nach `/validierung` schickte), sondern aus `fragenHref` —
    // ohne Zustandsparameter, dafür mit `ko=<id>`.
    const href = fragenHref(ko({}).id, "Was gilt zu: Ventil X bei Überdruck schließen?", "intern");
    expect(decodeURIComponent(href)).toContain("Was gilt zu: Ventil X");
    expect(href).toContain("&ask=1"); // direkt beantworten — kein zweiter Klick
    expect(new URLSearchParams(href.split("?")[1] ?? "").get("ko")).toBe("k1");
  });

  it("die Bibliothek reicht eine echte Startfrage herein; Enter sendet (Form-Submit)", () => {
    // JOB 3063 (H4): der Knopf sitzt auf der Lesefläche des gewählten Eintrags, nicht mehr in der
    // Trefferzeile — und die Startfrage ist jetzt der SUCHTEXT, wenn einer da ist (die abgelöste
    // Karte „Antwort statt nur Treffer?" hat genau das getan). Ohne Suche bleibt es der Titel.
    const lesen = read("apps/web/src/components/bibliothek/BibliothekLesen.tsx");
    expect(lesen).toContain("fragenHref(ko.id, suchtext.trim() || ko.title, ko.confidentiality)");
    // Ask-Eingabe: einzeiliges input IN einem form mit type=submit → Enter sendet nativ.
    const ask = read("apps/web/src/pages/Ask.tsx");
    expect(ask).toContain("<form");
    // PAKET 1 (D-AISTATE): der Submit-Button ist jetzt mehrzeilig (disabled/title für Modell-Zustand) —
    // der Submit-Typ im Form bleibt die geprüfte Wahrheit (Enter sendet nativ).
    expect(ask).toContain('type="submit"');
  });
});

describe("WP-UX-WOW-1 U4: Bibliothek-Karten lesbar", () => {
  it("der Zeilentitel wird nicht hart gekappt — der Volltext steht im title-Attribut", () => {
    // JOB 3063 (H4) — WAS SICH GEÄNDERT HAT und warum es keine Rücknahme ist: die Trefferzeile ist
    // eine Postfach-Zeile geworden (Punkt · Titel · „Bereich · Zustand"), und die Vorlage kappt den
    // Titel dort ausdrücklich EINZEILIG mit Auslassungspunkten (Bibliothek.dc.html Z.46:
    // `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`). Zwei Zeilen wären hier
    // eine andere Fläche. Die Zusage von U4 — „der Volltext geht nicht verloren" — bleibt: er
    // steht im `title`, und die volle Fassung steht rechts auf der Lesefläche.
    const liste = read("apps/web/src/components/bibliothek/BibliothekListe.tsx");
    expect(liste).toContain("truncate");
    expect(liste).toContain("title={p.titel}");
  });

  it("Autor-Zeile trägt den Volltext im title-Attribut", () => {
    const author = read("apps/web/src/components/trust/KoAuthorLine.tsx");
    expect(author).toContain("<div title={text}");
  });

  // AUFTRAG-mega51 BLOCK D2 — HARNESS-KORREKTUR, KEINE ANPASSUNG AN NEUEN CODE.
  // Dieser Pin hat den Fehler MITGEHALTEN: er verlangte wörtlich `k.trust === 0`, während die
  // Leiste daneben `k.confidence` anzeigt. Bei `trust > 0` und `confidence = 0` blieb die
  // unerklärte Null damit stehen — und der grüne Test behauptete das Gegenteil. Die Zusage lautet
  // ab jetzt nicht mehr „liest trust", sondern „liest DENSELBEN Wert, den sie anzeigt".
  it("validiert + Sicherheit 0 → nüchterner Hinweis statt leerer Leiste (Bedingung liest den angezeigten Wert)", () => {
    // JOB 3063 (H4): die Konfidenz steht jetzt im Abschnitt „Belege" hinter der Zeile „Mehr" —
    // derselbe Balken, dieselbe Sonderregel, ein anderer Ort.
    const mehr = read("apps/web/src/components/bibliothek/MehrAbschnitte.tsx");
    expect(mehr).toContain('deriveStatus(ko) === "validiert" && ko.confidence === 0');
    expect(mehr).toContain('t("lib.confidenceNone")');
    expect(mehr).toContain('title={t("lib.confidenceNoneHint")}');
    // Der angezeigte Wert der Leiste ist derselbe, den die Bedingung prüft.
    expect(mehr).toContain("<ConfidenceBar value={ko.confidence}");
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
    // AUFTRAG-mega38 BLOCK I: „Canvas" ist uebersetzt — die Umlaut-Zusage gilt unveraendert.
    //
    // JOB 3062 · H3: Die beiden bisher hier gepinnten Anzeige-Strings „Dokument-Editor für Titel"
    // und „Dokument-Editor öffnen" standen im Standardweg-Kasten und in seinem Ausgang. Beide
    // Flächen sind mit H3 gelöscht (der Standardweg IST das Blatt), die Strings existieren im
    // ganzen Baum nicht mehr — ein Pin darauf wäre ab jetzt eine Behauptung über nichts.
    // Die ZUSAGE dieses Falls ist „echte Umlaute, keine ASCII-Ersatzformen"; sie wird deshalb an
    // den Anzeige-Strings gemessen, die die Erfassung HEUTE zeigt: die Wörter des Blattes stehen
    // in `i18n.ts` (das Blatt selbst ruft nur Schlüssel auf).
    expect(capture).not.toContain("Entwuerfe");
    expect(capture).not.toContain("naechsten Oeffnen");
    const woerter = read("apps/web/src/i18n.ts");
    expect(woerter).toContain('"erfassen.mehr.entwuerfe": "Entwürfe"');
    expect(woerter).toContain('"erfassen.mehr.anhaenge": "Anhänge"');
    expect(woerter).not.toContain('"Entwuerfe"');
    expect(woerter).not.toContain('"Anhaenge"');
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
