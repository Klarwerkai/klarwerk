// WP-RETEST7 R5 (Pedis Befund: Fragen findet Fußnotentext nicht): der Ask-/Fragen-Retrieval-Pfad
// matcht jetzt auch die PERSISTIERTEN Bild-Fußnoten (captionTexts-Suchfeld — kein bodyHtml-Scan,
// kein neuer Scanner). Ein KO, dessen Wissen NUR in der Fußnote steht, wird als Grundlage gefunden
// und in der Antwort als Fußnoten-Fund gekennzeichnet (captionSources → Badge „Bildbeschreibung").
// Vertraulichkeits-/Sichtbarkeitsregeln bleiben EXAKT (vertraulich → nie Quelle, Pin).
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { rankCandidates } from "../../services/reasoner";

const FIGURE = (caption: string): string =>
  `<figure><img src="/api/objects/x/raw" alt="Bild"><figcaption data-image-id="kw-img-1">${caption}</figcaption></figure>`;

describe("WP-RETEST7 R5: Fragen matcht Bild-Fußnoten", () => {
  it("KO mit NUR-Fußnoten-Treffer wird Antwortgrundlage; captionSources kennzeichnet die Fundstelle", async () => {
    const services = buildServices();
    buildApp(services);
    const ko = await services.ko.create({
      title: "Wartungshinweis Portalanlage",
      statement: "Allgemeiner Hinweis zur Anlagenpflege ohne das Suchwort.",
      type: "best_practice",
      category: "Wartung",
      author: "anna",
      bodyHtml: FIGURE("Verschraubung der Grundplatte quartalsweise nachziehen"),
    });
    const { result } = await services.ask.ask("Wie oft die Verschraubung nachziehen?", "pedi");
    expect(result.answered).toBe(true);
    expect(result.sources).toEqual([ko.id]);
    // Fundstellen-Kennzeichnung: der Treffer kam AUSSCHLIESSLICH über die Bild-Fußnote.
    expect(result.captionSources).toEqual([ko.id]);
  });

  it("Treffer in Titel/Aussage bleibt UNMARKIERT (captionSources nur für reine Fußnoten-Funde)", async () => {
    const services = buildServices();
    buildApp(services);
    const ko = await services.ko.create({
      title: "Verschraubung der Grundplatte",
      statement: "Die Verschraubung wird quartalsweise nachgezogen.",
      type: "best_practice",
      category: "Wartung",
      author: "anna",
      bodyHtml: FIGURE("Verschraubung im Detail"),
    });
    const { result } = await services.ask.ask("Wie oft die Verschraubung nachziehen?", "pedi");
    expect(result.sources).toEqual([ko.id]);
    expect(result.captionSources).toEqual([]);
  });

  it("PIN: VERTRAULICHE KOs bleiben auch bei Fußnoten-Treffer draußen (Egress-Regel unverändert)", async () => {
    const services = buildServices();
    buildApp(services);
    await services.ko.create({
      title: "Interner Hinweis",
      statement: "Allgemeine Aussage ohne das Suchwort.",
      type: "best_practice",
      category: "Wartung",
      author: "anna",
      confidentiality: "vertraulich",
      bodyHtml: FIGURE("Verschraubung der Grundplatte quartalsweise nachziehen"),
    });
    const { result, gap } = await services.ask.ask("Wie oft die Verschraubung nachziehen?", "pedi");
    expect(result.answered).toBe(false);
    expect(result.sources).toEqual([]);
    expect(result.captionSources).toEqual([]);
    expect(gap).not.toBeNull(); // ehrliche Wissenslücke statt vertraulicher Quelle
  });

  it("Ranking-Kern: ein Nur-Fußnoten-Ref passiert das Relevanz-Gate (rankCandidates)", () => {
    const ranked = rankCandidates("Verschraubung nachziehen", [
      {
        id: "a",
        title: "Ohne Treffer",
        statement: "Nichts Passendes.",
        status: "offen",
        trust: 0,
        captionTexts: ["Verschraubung der Grundplatte nachziehen"],
      },
      { id: "b", title: "Ohne Treffer", statement: "Nichts Passendes.", status: "offen", trust: 0 },
    ]);
    expect(ranked.map((r) => r.ref.id)).toEqual(["a"]);
  });
});
