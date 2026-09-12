// ================================================================================================
// JOB 3338 · DIE LIEFERUNG UND IHR WORTLAUT — am Inhaltsmodul, ohne DOM.
// ================================================================================================
//
// `iso-hilfe-flaeche.test.tsx` misst, was auf der Seite ANKOMMT. Diese Datei misst, was das
// Inhaltsmodul TRÄGT: dass die vier Kapitel der redaktionellen Lieferung vollständig und in beiden
// Sprachen dastehen, dass der Suchalias `2701` nur ein Suchbegriff ist und keine Normbezeichnung,
// dass die Quellen extern und die Handlungslinks intern sind — und dass kein Satz eine Zusage macht.
//
// DAS ANTI-VAKUUM (V1/V2) IST DER WICHTIGSTE FALL DIESER DATEI. Ein Wortlautwächter, dessen Muster
// nichts treffen, ist grün und wertlos. V1 hält ihm erfundene Zusagen hin und verlangt Befunde; V2
// hält ihm die drei ECHTEN Einschränkungssätze der Lieferung hin und verlangt Schweigen. Erst beide
// zusammen sagen etwas über die Muster aus.
import { describe, expect, it } from "vitest";
import { HELP_TOPICS } from "../../apps/web/src/lib/helpTopics";
import {
  ISO_HELP_LABELS,
  ISO_HELP_TOPICS,
  helpAbsaetze,
  isoHelpSprache,
  isoQuellenAnzeige,
} from "../../apps/web/src/lib/helpTopics.iso";
import { VERBOTENE_ZUSAGEN, zusagenBefund, zusagenBlockliste } from "./zusagen";

const SPRACHEN = ["de", "en"] as const;

function thema(id: string) {
  const t = ISO_HELP_TOPICS.find((x) => x.id === id);
  if (!t) {
    throw new Error(`Kapitel ${id} fehlt`);
  }
  return t;
}

describe("JOB 3338 L · die vier Kapitel der Lieferung sind vollständig da", () => {
  it("L1: genau vier Kapitel mit den IDs der Lieferung, eindeutig", () => {
    expect(ISO_HELP_TOPICS.map((t) => t.id)).toEqual([
      "iso-overview",
      "iso-9001",
      "iso-27001",
      "iso-maintain",
    ]);
    expect(new Set(ISO_HELP_TOPICS.map((t) => t.id)).size).toBe(4);
  });

  it("L2: jedes Kapitel trägt Titel und Fliesstext in DE UND EN — und sie sind verschieden", () => {
    for (const t of ISO_HELP_TOPICS) {
      for (const lng of SPRACHEN) {
        expect(t.title[lng].trim().length, `${t.id}/${lng}: Titel leer`).toBeGreaterThan(10);
        expect(t.body[lng].trim().length, `${t.id}/${lng}: Text leer`).toBeGreaterThan(400);
      }
      expect(t.title.de, `${t.id}: EN-Titel ist der deutsche`).not.toBe(t.title.en);
      expect(t.body.de, `${t.id}: EN-Text ist der deutsche`).not.toBe(t.body.en);
      // Vier verständliche Abschnitte statt eines Blocks (ISO-HILFE-AUFTRAG.md §17).
      for (const lng of SPRACHEN) {
        expect(
          helpAbsaetze(t.body[lng]).length,
          `${t.id}/${lng}: weniger als drei Absätze`,
        ).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("L3: die Kernsätze der Lieferung stehen wörtlich da — kein umformulierter Ersatz", () => {
    // Je Kapitel EIN Satz, der seine Aussage trägt. Wer den Text umschreibt, sieht es hier.
    expect(thema("iso-overview").body.de).toContain("ISO selbst stellt keine Zertifikate aus.");
    expect(thema("iso-overview").body.en).toContain("ISO itself does not issue certificates.");
    expect(thema("iso-9001").body.de).toContain(
      "Klarwerk unterstützt diese Arbeit; es garantiert weder die Erstzertifizierung noch deren Erhalt.",
    );
    expect(thema("iso-9001").body.en).toContain(
      "it does not guarantee initial or continued certification.",
    );
    expect(thema("iso-27001").body.de).toContain("belegen keine ISO-27001-Konformität.");
    expect(thema("iso-27001").body.en).toContain("does not establish conformity with ISO 27001.");
    expect(thema("iso-maintain").body.de).toContain(
      "Eine KI-Antwort ist kein Ersatz für einen Nachweis.",
    );
    expect(thema("iso-maintain").body.en).toContain("An AI answer does not replace evidence.");
  });
});

describe("JOB 3338 S · `2701` ist ein Suchalias, keine Normbezeichnung", () => {
  it("S1: der Alias steht in den Tags der drei 27001-nahen Kapitel", () => {
    for (const id of ["iso-overview", "iso-27001", "iso-maintain"]) {
      expect(thema(id).tags, `${id} ohne Suchalias 2701`).toContain("2701");
    }
    // Und die richtigen Nummern sind ebenfalls Suchbegriffe.
    expect(thema("iso-27001").tags).toContain("27001");
    expect(thema("iso-9001").tags).toContain("9001");
  });

  it("S2: `2701` steht in KEINEM sichtbaren Titel und in KEINEM Fliesstext", () => {
    for (const t of ISO_HELP_TOPICS) {
      for (const lng of SPRACHEN) {
        expect(t.title[lng], `${t.id}/${lng}: Alias im Titel`).not.toMatch(/2701(?!\d)/);
        expect(t.body[lng], `${t.id}/${lng}: Alias im Fliesstext`).not.toMatch(/(?<!7)2701(?!\d)/);
      }
    }
    // Die richtige Bezeichnung kommt dagegen vor — sonst prüfte S2 nur eine Abwesenheit.
    expect(thema("iso-27001").title.de).toContain("ISO/IEC 27001");
    expect(thema("iso-27001").title.en).toContain("ISO/IEC 27001");
  });

  it("S3: die Suche über Titel+Text+Tags trifft jeden Pflichtbegriff — in beiden Sprachen", () => {
    // Dieselbe Rechnung wie `filterHelpTopics` (helpTopics.ts:105), hier ohne DOM und ohne React.
    const treffer = (begriff: string, lng: "de" | "en"): string[] =>
      ISO_HELP_TOPICS.filter((t) =>
        `${t.title[lng]} ${t.body[lng]} ${t.tags.join(" ")}`
          .toLowerCase()
          .includes(begriff.toLowerCase()),
      ).map((t) => t.id);
    for (const lng of SPRACHEN) {
      expect(treffer("9001", lng), `9001/${lng}`).toContain("iso-9001");
      expect(treffer("27001", lng), `27001/${lng}`).toContain("iso-27001");
      expect(treffer("2701", lng), `2701/${lng}`).toContain("iso-27001");
      expect(treffer("ISO 2701", lng), `ISO 2701/${lng}`).toContain("iso-27001");
      expect(treffer("iso2701", lng), `iso2701/${lng}`).toContain("iso-27001");
      expect(treffer("ISO 9001", lng), `ISO 9001/${lng}`).toContain("iso-9001");
      expect(treffer("iso", lng).length, `iso/${lng}`).toBe(4);
      expect(treffer("audit", lng), `audit/${lng}`).toContain("iso-maintain");
    }
  });
});

describe("JOB 3338 Q · Quellen sind extern, Handlungslinks sind intern", () => {
  it("Q1: jede Quelle ist eine absolute https-URL auf iso.org", () => {
    for (const t of ISO_HELP_TOPICS) {
      expect(t.sources.length, `${t.id} ohne Quelle`).toBeGreaterThan(0);
      for (const quelle of t.sources) {
        const url = new URL(quelle);
        expect(url.protocol, `${t.id}: ${quelle} ist nicht https`).toBe("https:");
        expect(url.hostname.endsWith("iso.org"), `${t.id}: ${quelle} ist keine ISO-Quelle`).toBe(
          true,
        );
      }
    }
  });

  it("Q2: jeder Handlungslink ist eine interne Route, die das Produkt wirklich führt", () => {
    const echteRouten = new Set(HELP_TOPICS.map((t) => t.to));
    for (const t of ISO_HELP_TOPICS) {
      expect(t.to.startsWith("/"), `${t.id}: ${t.to} ist keine interne Route`).toBe(true);
      expect(echteRouten.has(t.to), `${t.id}: ${t.to} führt nirgendwohin`).toBe(true);
    }
  });

  it("Q3: die Anzeigeform einer Quelle bleibt vollständig, nur ohne Schema", () => {
    expect(isoQuellenAnzeige("https://www.iso.org/standard/27001")).toBe(
      "www.iso.org/standard/27001",
    );
    expect(isoQuellenAnzeige("https://www.iso.org/about")).toBe("www.iso.org/about");
    for (const t of ISO_HELP_TOPICS) {
      for (const quelle of t.sources) {
        // Kein Kürzen: der Pfad bleibt lesbar, der Nutzer sieht, wohin er geht.
        expect(quelle).toContain(isoQuellenAnzeige(quelle));
        expect(isoQuellenAnzeige(quelle)).not.toContain("…");
      }
    }
  });
});

describe("JOB 3338 W · kein Satz macht eine Zusage, die Klarwerk nicht halten kann", () => {
  it("W1: Titel und Fliesstext aller vier Kapitel, DE und EN, ohne Befund", () => {
    for (const t of ISO_HELP_TOPICS) {
      for (const lng of SPRACHEN) {
        expect(
          zusagenBefund(`${t.title[lng]}\n${t.body[lng]}`),
          `${t.id}/${lng}: verbotene Zusage`,
        ).toEqual([]);
      }
    }
  });

  it("W2: auch die Beschriftungen des Quellenblocks sagen nichts über Konformität zu", () => {
    for (const label of Object.values(ISO_HELP_LABELS)) {
      for (const lng of SPRACHEN) {
        expect(zusagenBlockliste(label[lng]), `Beschriftung „${label[lng]}"`).toEqual([]);
      }
    }
  });

  it("V1 (Anti-Vakuum): erfundene Zusagen werden WIRKLICH gefunden — sonst misst W1 nichts", () => {
    const zusagen = [
      "Klarwerk garantiert die Zertifizierung nach ISO 9001.",
      "Mit Klarwerk ist Ihr Unternehmen ISO-konform.",
      "Klarwerk zertifiziert Ihr Managementsystem.",
      "Klarwerk erfüllt die Norm ISO/IEC 27001.",
      "Ihre Ablage wird damit revisionssicher.",
      "Klarwerk ensures compliance with ISO 27001.",
      "Using Klarwerk makes you compliant.",
      "Klarwerk certifies your organization.",
      "Klarwerk guarantees certification.",
      "Klarwerk meets the standard for you.",
    ];
    for (const satz of zusagen) {
      expect(zusagenBefund(satz), `unentdeckt: „${satz}"`).not.toEqual([]);
    }
    // Und die Satzregel allein trägt auch das, was in keiner Blockliste steht.
    expect(
      zusagenBefund("Klarwerk sorgt für die Konformität Ihres Managementsystems."),
      "die Satzregel greift nicht",
    ).not.toEqual([]);
  });

  it("V2 (Gegenrichtung): die ECHTEN Einschränkungssätze der Lieferung bleiben stumm", () => {
    // Genau die Sätze, die ein blosses Wortverbot („zertifiziert", „garantiert", „konform")
    // fälschlich rot gemacht hätte. Sie müssen erlaubt bleiben, sonst löscht die nächste Runde sie.
    const erlaubt = [
      "Klarwerk unterstützt diese Arbeit; es garantiert weder die Erstzertifizierung noch deren Erhalt.",
      "Zertifiziert wird das Managementsystem des Unternehmens im festgelegten Geltungsbereich durch eine externe Zertifizierungsstelle.",
      "Eine gespeicherte Sicherheitsanweisung, ein KI-Urteil oder der Einsatz von Klarwerk allein belegen keine ISO-27001-Konformität.",
      "Die Nutzung einer Software allein erfüllt jedoch keine dieser Normen.",
      "Klarwerk supports this work; it does not guarantee initial or continued certification.",
      "A stored security instruction, an AI judgment or using Klarwerk alone does not establish conformity with ISO 27001.",
      "Using software alone does not meet either standard.",
    ];
    for (const satz of erlaubt) {
      expect(zusagenBefund(satz), `falscher Alarm: „${satz}"`).toEqual([]);
    }
  });

  it("V3: die Zusagenliste ist besetzt und jedes Muster ist ein eigenes", () => {
    expect(VERBOTENE_ZUSAGEN.length).toBeGreaterThan(15);
    const quellen = VERBOTENE_ZUSAGEN.map((z) => z.muster.source);
    expect(new Set(quellen).size, "ein Muster steht doppelt").toBe(quellen.length);
    for (const z of VERBOTENE_ZUSAGEN) {
      expect(z.warum.length, `Muster ${z.muster.source} ohne Begründung`).toBeGreaterThan(10);
    }
  });
});

describe("JOB 3338 R · der bestehende Hilfebestand bleibt unangetastet", () => {
  // JOB 3468 (REVIEW26-HILFE-IMPORT): von zehn auf elf Kapitel. Das neue `fileimport` liegt in
  // HELP_TOPICS und NICHT bei den ISO-Kapiteln — die Aussage dieses Falls (zwei getrennte Listen,
  // genau ein Kapitel je Menü-Route) ist davon unberührt und wird unten weiter gemessen. Die Zahl
  // ist gepinnt und nicht abgeleitet: ein verlorenes Kapitel soll hier auffallen.
  //
  // JOB 3741 (SEITENHILFE-LUECKEN): von elf auf einundzwanzig. Die zehn neuen liegen ebenfalls in
  // HELP_TOPICS und ebenfalls NICHT bei den ISO-Kapiteln; keines von ihnen zeigt auf `/bibliothek`,
  // `/validierung` oder `/aufgaben` — das hält die Zeile unten weiter fest.
  it("R1: HELP_TOPICS führt weiterhin genau die bekannten Kapitel — kein ISO-Kapitel darin", () => {
    expect(HELP_TOPICS).toHaveLength(21);
    const isoIds = new Set(ISO_HELP_TOPICS.map((t) => t.id));
    for (const t of HELP_TOPICS) {
      expect(isoIds.has(t.id), `${t.id} ist in beide Listen geraten`).toBe(false);
    }
    // Die Seitenhilfe des Zahnrads rechnet „genau EIN Kapitel je Route" (JOB 3028, U3-5). Wären die
    // ISO-Kapitel in HELP_TOPICS gelandet, verlören /bibliothek, /validierung und /aufgaben dort
    // still ihren Erklärsatz. Diese Zeile hält den Grund fest, warum es zwei Listen sind.
    for (const route of ["/bibliothek", "/validierung", "/aufgaben"]) {
      expect(HELP_TOPICS.filter((t) => t.to === route).length, `${route}`).toBe(1);
    }
  });

  it("R2: Sprachwahl und Absatzzerlegung verhalten sich wie i18n — `nl` und Unbekanntes → Deutsch", () => {
    expect(isoHelpSprache("de")).toBe("de");
    expect(isoHelpSprache("en")).toBe("en");
    expect(isoHelpSprache("en-GB")).toBe("en");
    expect(isoHelpSprache("nl")).toBe("de");
    expect(isoHelpSprache(undefined)).toBe("de");
    expect(isoHelpSprache("")).toBe("de");
    // Ein Text ohne Leerzeile ergibt genau EINEN Absatz — die bestehenden Kapitel bleiben, wie sie sind.
    for (const t of HELP_TOPICS) {
      expect(helpAbsaetze(t.titleKey).length).toBe(1);
    }
    expect(helpAbsaetze("a\n\nb\n\n\nc")).toEqual(["a", "b", "c"]);
    expect(helpAbsaetze("   ")).toEqual([]);
  });
});
