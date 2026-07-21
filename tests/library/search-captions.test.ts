// WP-BILD-1e: Bild-Fußnoten (figcaption im bodyHtml) sind in der Suche auffindbar. Vorher matchte
// die Bibliotheks-Suche (FR-LIB-01) NUR title/statement — eine Fußnote wie „Verschraubung" war
// unsichtbar. Alt-Platzhaltertexte (WP-D10) gelten weiterhin als KEIN Inhalt: sie werden weder
// indexiert noch gefunden (konsistent zur Leer-Behandlung in Editor und Anzeige).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import { LEGACY_IMAGE_CAPTION_PLACEHOLDERS as CLIENT_PLACEHOLDERS } from "../../apps/web/src/lib/editorFigures";
import {
  imageCaptionTexts as clientCaptionTexts,
  scoreKo,
} from "../../apps/web/src/lib/librarySearch";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import {
  LEGACY_IMAGE_CAPTION_PLACEHOLDERS as SERVER_PLACEHOLDERS,
  imageCaptionTexts,
} from "../../services/library-analytics";

const FIGURE = (caption: string): string =>
  `<p>Einleitung.</p><figure><img src="/api/objects/x/raw" alt="Bild"><figcaption data-image-id="kw-img-1">${caption}</figcaption></figure>`;

describe("WP-BILD-1e: Fußnoten-Extraktion (pure)", () => {
  it("liefert Fußnoten-Texte ohne Tags/Whitespace-Müll; Leeres und Alt-Platzhalter fallen weg", () => {
    expect(imageCaptionTexts(FIGURE("Verschraubung der Dosierpumpe"))).toEqual([
      "Verschraubung der Dosierpumpe",
    ]);
    expect(imageCaptionTexts(FIGURE("  <strong>Ventil</strong>\n  prüfen "))).toEqual([
      "Ventil prüfen",
    ]);
    expect(imageCaptionTexts(FIGURE(""))).toEqual([]);
    for (const placeholder of SERVER_PLACEHOLDERS) {
      expect(imageCaptionTexts(FIGURE(placeholder))).toEqual([]);
    }
    expect(imageCaptionTexts(undefined)).toEqual([]);
    expect(imageCaptionTexts("<p>ohne Figur</p>")).toEqual([]);
  });

  it("PARITÄT: Server- und Client-Platzhalterliste sind identisch (eine Wahrheit, kein Drift)", () => {
    expect([...SERVER_PLACEHOLDERS]).toEqual([...CLIENT_PLACEHOLDERS]);
    // Auch die Client-Extraktion behandelt die Platzhalter als KEIN Inhalt.
    for (const placeholder of CLIENT_PLACEHOLDERS) {
      expect(clientCaptionTexts(FIGURE(placeholder))).toEqual([]);
    }
  });
});

describe("WP-BILD-1e: Bibliotheks-Suche findet Bild-Fußnoten (echte Services)", () => {
  const create = async () => {
    const services = buildServices();
    buildApp(services);
    await services.ko.create({
      title: "Dosierpumpe warten",
      statement: "Regelmäßig entlüften.",
      type: "best_practice",
      category: "Wartung",
      author: "anna",
      bodyHtml: FIGURE("Verschraubung am Pumpenkopf"),
    });
    await services.ko.create({
      title: "Ventil tauschen",
      statement: "Nur drucklos arbeiten.",
      type: "best_practice",
      category: "Wartung",
      author: "bob",
      bodyHtml: FIGURE(""), // leere Fußnote stört nicht
    });
    await services.ko.create({
      title: "Filter reinigen",
      statement: "Monatlich prüfen.",
      type: "best_practice",
      category: "Wartung",
      author: "carl",
      bodyHtml: FIGURE("Noch keine Bildbeschreibung"), // Alt-Platzhalter = KEIN Inhalt
    });
    return services;
  };

  it("Suche nach dem Fußnoten-Wort findet das KO (case-insensitiv)", async () => {
    const services = await create();
    const hits = await services.library.search("Verschraubung");
    expect(hits.map((k) => k.title)).toEqual(["Dosierpumpe warten"]);
    const lower = await services.library.search("verschraubung");
    expect(lower.map((k) => k.title)).toEqual(["Dosierpumpe warten"]);
  });

  it("leere Fußnoten stören nicht; title/statement-Treffer bleiben unverändert", async () => {
    const services = await create();
    expect((await services.library.search("Ventil")).map((k) => k.title)).toEqual([
      "Ventil tauschen",
    ]);
    expect((await services.library.search("entlüften")).length).toBe(1);
  });

  it("Alt-Platzhaltertexte werden NICHT als Inhalt gefunden (konsistent zur Leer-Behandlung)", async () => {
    const services = await create();
    // „Bildbeschreibung" kommt NUR im Platzhalter vor → kein Treffer.
    expect(await services.library.search("Bildbeschreibung")).toEqual([]);
  });
});

describe("WP-BILD-1e: Fundstellen-Kennzeichnung in der Bildbeschreibung (Client-Ranking)", () => {
  const ko = (bodyHtml: string): KnowledgeObject =>
    ({
      id: "k1",
      title: "Pumpe",
      statement: "Aussage ohne Suchwort.",
      type: "best_practice",
      category: "Wartung",
      status: "offen",
      trust: 0,
      bodyHtml,
    }) as unknown as KnowledgeObject;

  it("ein Fußnoten-Treffer trägt den eigenen Match-Grund caption", () => {
    const scored = scoreKo(ko(FIGURE("Verschraubung am Pumpenkopf")), "Verschraubung");
    expect(scored.matches).toContain("caption");
    expect(scored.score).toBeGreaterThan(0);
  });

  it("Alt-Platzhalter erzeugen KEINEN caption-Treffer", () => {
    const scored = scoreKo(ko(FIGURE("Noch keine Bildbeschreibung")), "Bildbeschreibung");
    expect(scored.matches).not.toContain("caption");
    expect(scored.score).toBe(0);
  });

  it("der Match-Grund ist in DE, EN und NL beschriftet (lib.match.caption)", () => {
    const i18n = readFileSync(resolve(process.cwd(), "apps/web/src/i18n.ts"), "utf8");
    expect(i18n.split('"lib.match.caption":').length - 1).toBe(3);
  });
});
