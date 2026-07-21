// WP-IC-PAKET-1b (bens ROT-1): Entity-Dekodierung an der QUELLE — Ende-zu-Ende durch die echte Kette:
// Confluence-Seite (Titel/Autor/Label mit rohen Entities) → Mapper → Import-Kandidat → Erkundungs-
// Themenableitung → angenommenes KO. Vorher dekodierte nur das Body-Statement (htmlToPlainText); Titel,
// Autor und Tags trugen rohe Entities weiter — die Titel-Themenableitung baute daraus sogar
// Entity-Fragment-Themen („Uuml"). White-box-Import des Mappers (tests/ liegt außerhalb der
// dependency-cruiser-Modulgrenzen; gleiches Muster wie die reasoner-src-Tests).
import { describe, expect, it } from "vitest";
import { displayImportText } from "../../apps/web/src/lib/htmlEntities";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { mapConfluencePageToImportItem } from "../../services/confluence/src/mapper";
import type { ConfluencePage } from "../../services/confluence/src/rest-client";
import { summarizeImportItems, toPreviewEntry } from "../../services/library-analytics";

const OPTS = { baseUrl: "https://acme.atlassian.net/wiki", spaceKey: "OPS" };

function page(id: string, title: string): ConfluencePage {
  return {
    id,
    title,
    body: { storage: { value: "" } }, // leerer Body → statement fällt auf den Titel zurück
    version: {
      number: 1,
      when: "2026-05-01T10:00:00.000Z",
      by: { displayName: "J&uuml;rgen M&uuml;ller" },
    },
    metadata: { labels: { results: [{ name: "k&uuml;che" }] } },
  } as unknown as ConfluencePage;
}

describe("WP-IC-PAKET-1b ROT-1: Entities werden an der QUELLE dekodiert (E2E)", () => {
  const PAGES = [page("p1", "Wartung f&uuml;r Pumpen"), page("p2", "Wartung f&uuml;r Ventile")];

  it("Mapper dekodiert Titel (auch als Statement-Fallback), Autor und Labels", () => {
    const item = mapConfluencePageToImportItem(PAGES[0] as ConfluencePage, OPTS);
    expect(item.title).toBe("Wartung für Pumpen");
    expect(item.statement).toBe("Wartung für Pumpen"); // Titel-Fallback ebenfalls dekodiert
    expect(item.author).toBe("Jürgen Müller");
    expect(item.tags).toEqual(["küche"]);
    // WP-IC-PAKET-1c (bens ROT-2): der Mapper markiert die Felder als kanonisch dekodiert.
    expect(item.textCodec).toBe("decoded");
  });

  it("Themenableitung sieht dekodierte Titel — KEIN Entity-Fragment-Thema (uuml/…)", () => {
    // Ohne Labels, damit die TITEL-Ableitung greift (der Screenshot-Fall: label-lose Seiten).
    const items = PAGES.map((p) => {
      const mapped = mapConfluencePageToImportItem(p as ConfluencePage, OPTS);
      const { tags: _tags, ...withoutTags } = mapped;
      return withoutTags;
    });
    const summary = summarizeImportItems(items);
    const labels = summary.themes.map((t) => t.label);
    // Das echte gemeinsame Wort gruppiert; „für" ist Stoppwort. VOR dem Fix zerfiel „f&uuml;r" in
    // die Tokens f/uuml/r und „uuml" wurde zum Thema.
    expect(labels).toContain("Wartung");
    expect(labels.some((l) => /uuml|auml|ouml/i.test(l))).toBe(false);
  });

  it("Kandidat und ANGENOMMENES KO tragen den dekodierten Titel (echte Services)", async () => {
    const services = buildServices();
    buildApp(services); // Vertragskonform aufbauen; wir nutzen die Services direkt (read-only Routenfrei)
    const items = PAGES.map((p) => mapConfluencePageToImportItem(p as ConfluencePage, OPTS));
    const candidates = await services.library.createImportCandidates(items, "tester");
    expect(candidates.length).toBe(2);
    expect(candidates[0]?.item.title).toBe("Wartung für Pumpen");
    expect(candidates[0]?.item.title).not.toContain("&uuml;");

    const first = candidates[0];
    if (!first) {
      throw new Error("Kandidat fehlt");
    }
    const reviewed = await services.library.reviewImportCandidate(first.id, "accept", "tester");
    expect(reviewed.koId).toBeTruthy();
    const ko = (await services.ko.list()).find((k) => k.id === reviewed.koId);
    expect(ko?.title).toBe("Wartung für Pumpen");
    expect(ko?.statement).toBe("Wartung für Pumpen");
  });
});

// WP-IC-PAKET-1c (bens ROT-2): KEINE Doppel-Dekodier-Kette für NEUDATEN. Ein Quelltitel mit
// &amp;uuml; wird serverseitig EINMAL korrekt zum Literal „&uuml;" — Kandidat, Vorschau UND
// angenommenes KO tragen/zeigen exakt dieses Literal (nie ü). Der defensive Anzeige-Decode läuft
// NUR für echten Altbestand (Kandidaten OHNE Decode-Marker).
describe("WP-IC-PAKET-1c ROT-2: Decode-Marker verhindert Doppel-Dekodieren (E2E)", () => {
  const LITERAL_PAGE = page("p9", "Kapitel &amp;uuml; Anhang");
  const LITERAL = "Kapitel &uuml; Anhang"; // kanonischer Wert nach EINMALIGER Dekodierung

  it("Kandidat traegt das Literal + Marker; die Vorschau-Anzeige zeigt das Literal (NICHT ue)", async () => {
    const item = mapConfluencePageToImportItem(LITERAL_PAGE as ConfluencePage, OPTS);
    expect(item.title).toBe(LITERAL);
    expect(item.textCodec).toBe("decoded");

    // Vorschau-Projektion reicht den Marker durch; die Client-Anzeige dekodiert markierte Texte NICHT.
    const entry = toPreviewEntry(item);
    expect(entry.textCodec).toBe("decoded");
    expect(displayImportText(entry.title, entry.textCodec)).toBe(LITERAL);
    expect(displayImportText(entry.title, entry.textCodec)).not.toContain("ü");

    // Kandidat + angenommenes KO tragen den kanonischen Literal-Wert.
    const services = buildServices();
    buildApp(services);
    const candidates = await services.library.createImportCandidates([item], "tester");
    const first = candidates[0];
    if (!first) {
      throw new Error("Kandidat fehlt");
    }
    expect(first.item.title).toBe(LITERAL);
    expect(first.item.textCodec).toBe("decoded");
    const reviewed = await services.library.reviewImportCandidate(first.id, "accept", "tester");
    const ko = (await services.ko.list()).find((k) => k.id === reviewed.koId);
    expect(ko?.title).toBe(LITERAL);
  });

  it("ALTBESTAND (ohne Marker, rohe Entities) wird in der Anzeige weiterhin dekodiert", () => {
    // Gespeicherter Alt-Kandidat von VOR dem Quellen-Fix: rohe Entities, kein textCodec.
    expect(displayImportText("Onboarding-Guide f&uuml;r neue Mitarbeiter", undefined)).toBe(
      "Onboarding-Guide für neue Mitarbeiter",
    );
    // Mit Marker: exakt der kanonische Wert, unangetastet.
    expect(displayImportText(LITERAL, "decoded")).toBe(LITERAL);
  });
});
