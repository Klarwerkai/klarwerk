// ================================================================================================
// UX-26 · BELEG UND ORIGINAL — DIE BEDEUTUNG TRÄGT, UND IHRE GEGENPROBEN SCHEITERN.
// ================================================================================================
//
// Drei Dinge, die ohne Fläche messbar sind (die Fläche messen `bibliothek-beleg-original.test.tsx`
// und `pruefkarte-frische.test.tsx` in jsdom, `beleg-original-im-echten-browser.test.ts` im
// gebauten Chromium):
//
//   B1  Der heutige Katalog erfüllt die unabhängig festgehaltene Bedeutung (`bedeutung.ts`) in
//       DE/EN/NL, und keiner der drei Texte erfüllt zugleich die Regel eines anderen.
//   B2  GEGENPROBEN: die alten „Evidence"-Texte des Basisstands und die in Beleg/Original
//       VERTAUSCHTEN Sätze scheitern an genau dieser Regel — sonst wäre sie keine.
//   B3  Die Frischeberechnung und ihre Schlüsselzuordnung sind unverändert: dieselben Eingaben
//       ergeben dieselben Zustände, `evidenceFreshnessLabelKey` bleibt `ko.evFresh.<status>`. Die
//       Schlüsselmenge des Moduls ist dieselbe wie vorher.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { EvidenceRecord, KnowledgeObject } from "../../apps/web/src/api/types";
import i18n from "../../apps/web/src/i18n";
import { analyzeEvidenceFreshness } from "../../apps/web/src/lib/evidenceFreshness";
import { evidenceFreshnessLabelKey } from "../../apps/web/src/lib/evidenceFreshnessView";
import ux26 from "../../apps/web/src/texte/ux26";
import { repoPfad } from "../support/repoPfad";
import {
  type Aussage,
  SCHLUESSEL,
  SPRACHEN,
  type Sprache,
  verstoesse,
  verwechslungen,
  zaehlerVerstoesse,
} from "./bedeutung";

const katalog = (sprache: Sprache, aussage: Aussage): string =>
  i18n.getFixedT(sprache)(SCHLUESSEL[aussage]);

/**
 * Die Werte des Basisstands (vor diesem Auftrag), wörtlich — die Gegenprobe „alte Texte
 * zurückgeholt". Englisch hat für die beiden Frischezustände keine alte Fassung, die scheitern
 * müsste: es behält sein normales Wort (Auftrag K3).
 */
const ALT: Record<Sprache, Partial<Record<Aussage, string>>> = {
  de: {
    abgeloest: "Original nicht mehr an diesem Objekt",
    belegFehlt: "Evidence fehlt",
    keinAnlass: "kein Evidence-Anlass",
  },
  en: { abgeloest: "Original no longer attached to this object" },
  nl: {
    abgeloest: "Origineel hangt niet meer aan dit object",
    belegFehlt: "Evidence ontbreekt",
    keinAnlass: "geen aanleiding voor evidence",
  },
};

/** Der Satz mit vertauschten Rollen: das Original bliebe, der Beleg wäre weg. */
const VERTAUSCHT: Record<Sprache, string> = {
  de: "Das Original bleibt verzeichnet, aber die Belegdatei hängt nicht mehr an diesem Objekt.",
  en: "The original file remains, but the evidence record is no longer attached to this object.",
  nl: "Het originele bestand blijft vastgelegd, maar het bewijs hangt niet meer aan dit object.",
};

describe("UX-26 · B1 — der Katalog sagt, was er sagen muss", () => {
  for (const sprache of SPRACHEN) {
    it(`${sprache}: alle drei Aussagen erfüllen ihre Regel und keine die einer anderen`, () => {
      const texte = {
        abgeloest: katalog(sprache, "abgeloest"),
        belegFehlt: katalog(sprache, "belegFehlt"),
        keinAnlass: katalog(sprache, "keinAnlass"),
      };
      for (const [aussage, text] of Object.entries(texte) as [Aussage, string][]) {
        expect(verstoesse(sprache, aussage, text)).toEqual([]);
      }
      expect(verwechslungen(sprache, texte)).toEqual([]);
      // Der Neutral-Zähler der Prüfkarte trägt dieselbe Bedeutung — aus demselben Label-Schlüssel.
      const zaehler = i18n.getFixedT(sprache)("evFresh.summary.neutral", { n: 3 });
      expect(zaehler).toBe(`${i18n.getFixedT(sprache)(evidenceFreshnessLabelKey("neutral"))}: 3`);
      expect(zaehlerVerstoesse(sprache, zaehler)).toEqual([]);
    });
  }
});

describe("UX-26 · B2 — die Gegenproben scheitern an derselben Regel", () => {
  for (const sprache of SPRACHEN) {
    it(`${sprache}: die alten Texte des Basisstands werden erkannt`, () => {
      const alte = Object.entries(ALT[sprache]) as [Aussage, string][];
      expect(alte.length).toBeGreaterThan(0);
      for (const [aussage, text] of alte) {
        expect(
          verstoesse(sprache, aussage, text),
          `der alte Text „${text}“ ginge als ${aussage} durch`,
        ).not.toEqual([]);
      }
    });

    it(`${sprache}: der alte Neutral-Zähler „neutral“/„neutraal“ wird erkannt`, () => {
      const alt = sprache === "nl" ? "neutraal: 3" : "neutral: 3";
      expect(zaehlerVerstoesse(sprache, alt), `„${alt}“ ginge als Zähler durch`).not.toEqual([]);
    });

    it(`${sprache}: vertauschte Rollen von Beleg und Original werden erkannt`, () => {
      expect(verstoesse(sprache, "abgeloest", VERTAUSCHT[sprache])).not.toEqual([]);
    });

    it(`${sprache}: der Satz zum abgelösten Original taugt nicht als „Beleg fehlt“ und umgekehrt`, () => {
      // Die Behauptung einer fehlenden Datei gehört nicht an den Zustand „Beleg fehlt" (K2).
      expect(verstoesse(sprache, "belegFehlt", katalog(sprache, "abgeloest"))).not.toEqual([]);
      expect(verstoesse(sprache, "abgeloest", katalog(sprache, "belegFehlt"))).not.toEqual([]);
    });
  }
});

// ------------------------------------------------------------------------------------------------
// B3 — nichts an der Berechnung, nichts an der Schlüsselmenge
// ------------------------------------------------------------------------------------------------
function ko(overrides: Partial<KnowledgeObject>): KnowledgeObject {
  return {
    id: "ko-1",
    title: "KO",
    statement: "S",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Anlage",
    tags: [],
    confidence: 50,
    trust: 50,
    status: "validiert",
    version: 1,
    originalAuthor: "u-1",
    author: "u-1",
    neededValidations: 3,
    assignments: [],
    asset: null,
    createdAt: "2026-09-21T10:00:00.000Z",
    history: [],
    ...overrides,
  };
}

const quelle = {
  id: "s-1",
  label: "Q",
  url: null,
  excerpt: null,
  kind: "external" as const,
  peerValidated: false,
  author: "u-1",
  at: "x",
};

describe("UX-26 · B3 — Berechnung und Schlüsselmenge unverändert", () => {
  it("missing/neutral/current/outdated entstehen aus denselben Eingaben wie vorher", () => {
    const beleg = (koId: string, koVersion: number): EvidenceRecord => ({
      id: `ev-${koId}-${koVersion}`,
      koId,
      koVersion,
      kind: "source",
      label: "Q",
      createdBy: "u-1",
      createdAt: "2026-09-21T10:00:00.000Z",
    });
    const kos = [
      ko({ id: "fehlt", sources: [quelle] }),
      ko({ id: "ohne-anlass" }),
      // Ein Altanhang ohne Objektkennung ist ein Original OHNE eigenen Beleg — kein Anlass.
      ko({
        id: "altanhang",
        attachments: [
          { id: "a", name: "alt.png", mime: "image/png", dataUrl: "data:image/png;base64,AA" },
        ] as NonNullable<KnowledgeObject["attachments"]>,
      }),
      ko({ id: "aktuell", sources: [quelle] }),
      ko({ id: "aelter", version: 2, sources: [quelle] }),
    ];
    const zeilen = analyzeEvidenceFreshness({
      kos,
      evidence: [beleg("aktuell", 1), beleg("aelter", 1)],
    }).rows;
    const status = Object.fromEntries(zeilen.map((z) => [z.koId, z.status]));
    expect(status).toEqual({
      fehlt: "missing",
      "ohne-anlass": "neutral",
      altanhang: "neutral",
      aktuell: "current",
      aelter: "outdated",
    });
    for (const s of ["current", "outdated", "missing", "neutral"] as const) {
      expect(evidenceFreshnessLabelKey(s)).toBe(`ko.evFresh.${s}`);
    }
  });

  it("das Modul führt seine vier Texte und den umgezogenen Neutral-Zähler — die Schlüsselmenge des Katalogs bleibt", () => {
    const fuenf = [
      "evFresh.summary.neutral",
      "ko.evCons.allOk",
      "ko.evFresh.missing",
      "ko.evFresh.neutral",
      "ko.evidenceOriginalDetached",
    ];
    expect([...ux26.legacySchluessel].sort()).toEqual(fuenf);
    for (const sprache of SPRACHEN) {
      expect(Object.keys(ux26[sprache]).sort(), sprache).toEqual(fuenf);
    }
    // Umgezogen, nicht neu: der Zähler stand im Basisstand in allen drei Sprachen in `i18n.ts`
    // (s. `werte-vorher.json`), jetzt steht er AUSSCHLIESSLICH hier.
    const quelle = readFileSync(repoPfad("apps/web/src/i18n.ts"), "utf8");
    expect(quelle.includes('"evFresh.summary.neutral":')).toBe(false);
    // Nicht bestellt, also nicht angefasst (JOB 3384 hat ihn ausdrücklich stehen lassen).
    expect(ux26.de["ko.evCons.allOk"]).toBe("Quellen, Anhänge und Evidence sind deckungsgleich.");
    // Englisch behält seine normalen Frischewörter (K3).
    expect(ux26.en["ko.evFresh.missing"]).toBe("evidence missing");
    expect(ux26.en["ko.evFresh.neutral"]).toBe("no evidence expected");
  });
});
