// ================================================================================================
// JOB 3326 · LESEVARIANTE — ZUORDNUNG, IDEMPOTENZ, ÄNDERUNGSAUSKUNFT, QUELLABGLEICH.
// ================================================================================================
//
// Gemessen wird gegen die ECHTE Lieferung (`example-packages/advisor-ict-v1.lokalisierung.json`)
// UND gegen das ECHTE Demopaket (`example-packages/advisor-ict-en-v1.ts`, JOB 3277). Kein Wert
// dieses Auftrags ist hier abgeschrieben: die sechs Grundlagen-Schlüssel kommen aus der
// Paketdefinition, die Anker aus deren Schreibweise, die Abdrücke aus der Lieferung. Ein Fixture
// hätte sich nur selbst bestätigt.
//
// RUNDE 2 — was Codex an Runde 1 zerlegt hat, und wo es jetzt steht:
//   · SEED_SCHLUESSEL waren OD01–OD05/WORD-NEW — falsch. Die sechs Bausteine sind
//     S02/S04/C01/C02/T01/T03 und werden hier aus `ADVISOR_ICT_EN_V1.items` GELESEN (A1, A4).
//   · `ordneZu` brach beim ersten Anker ab; die sechs Paketobjekte bekamen nichts (A5).
//   · Der Original-Abdruck wurde bei jedem Laden neu gesetzt und wischte die Warnung weg (E4–E6).
//   · Der gelieferte Quellabdruck wurde nur abgelegt statt geprüft (Q0–Q3).
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { KnowledgeObject, KoSource } from "../../knowledge-object";
import { EXAMPLE_PROVIDER } from "./example-packages";
import { ADVISOR_ICT_EN_V1 } from "./example-packages/advisor-ict-en-v1";
import {
  CONFLUENCE_PROVIDER,
  InMemoryLesevariantenRepo,
  type LokalisierungsRecord,
  type LokalisierungsText,
  ankerFuer,
  ladeLesevarianten,
  lokalisierungsPaket,
  mitAenderungsauskunft,
  ordneZu,
  originalAbdruck,
  quellabgleichFuer,
  uebersetzungsAbdruck,
} from "./lesevarianten";

const PAKET_ID = ADVISOR_ICT_EN_V1.id;
/** Die sechs Grundlagen-Bausteine — GELESEN, nicht abgeschrieben. */
const BAUSTEIN_SCHLUESSEL = ADVISOR_ICT_EN_V1.items.map((i) => i.key);

function quelle(externalId: string, provider: string): KoSource {
  return {
    id: externalId,
    label: externalId,
    url: null,
    excerpt: null,
    kind: "external",
    peerValidated: false,
    provider,
    externalId,
    author: "importer",
    at: "2026-09-01T00:00:00.000Z",
  };
}

function ko(
  id: string,
  anker: { externalId: string; provider: string },
  felder: Partial<KnowledgeObject> = {},
): KnowledgeObject {
  return {
    id,
    title: `Original ${id}`,
    statement: `Original statement of ${id}`,
    bodyHtml: `<p>Original body of ${id}</p>`,
    sources: [quelle(anker.externalId, anker.provider)],
    ...felder,
  } as unknown as KnowledgeObject;
}

function paket() {
  const p = lokalisierungsPaket(PAKET_ID);
  if (!p) {
    throw new Error("Lieferung nicht gefunden");
  }
  return p;
}

function record(key: string): LokalisierungsRecord {
  const r = paket().records.find((x) => x.key === key);
  if (!r) {
    throw new Error(`Datensatz ${key} fehlt`);
  }
  return r;
}

/**
 * Der Bestand, wie ihn die Vorführung erzeugt: die sechs Paketobjekte (Provider `Beispielpaket`,
 * Anker `<paket>/<key>`, Kernaussage = `paragraphs.join("\n\n")` wie `baselineStatement`) UND die
 * 36 Confluence-Kopien (Anker = Seiten-Id). Die sechs Schlüssel kommen in BEIDEN vor — genau das
 * ist die Lage, an der Runde 1 gescheitert ist.
 */
function bestandDerVorfuehrung(): KnowledgeObject[] {
  const kos: KnowledgeObject[] = [];
  for (const item of ADVISOR_ICT_EN_V1.items) {
    kos.push(
      ko(
        `paket-${item.key}`,
        { externalId: `${PAKET_ID}/${item.key}`, provider: EXAMPLE_PROVIDER },
        { title: `[Beispiel] ${item.title}`, statement: item.paragraphs.join("\n\n") },
      ),
    );
  }
  for (const r of paket().records) {
    if (r.confluence_id) {
      kos.push(ko(`conf-${r.key}`, { externalId: r.confluence_id, provider: CONFLUENCE_PROVIDER }));
    }
  }
  return kos;
}

describe("JOB 3326 · die Lieferung und das Paket", () => {
  it("L0 · 43 Datensätze, 36 mit Confluence-Id, jeder ausdrücklich ohne Freigabe", () => {
    const p = paket();
    expect(p.package_id).toBe(PAKET_ID);
    expect(p.records.length).toBe(43);
    expect(p.records.filter((r) => r.confluence_id).length).toBe(36);
    expect([...p.languages].sort()).toEqual(["de", "en"]);
    expect(
      p.records.every((r) => r.translation_status === "draft_translation_not_business_approval"),
    ).toBe(true);
  });

  it("L1 · die sechs Grundlagen-Bausteine sind S02/S04/C01/C02/T01/T03 und stehen ALLE in der Lieferung", () => {
    expect(BAUSTEIN_SCHLUESSEL).toEqual(["S02", "S04", "C01", "C02", "T01", "T03"]);
    const inLieferung = paket().records.map((r) => r.key);
    for (const key of BAUSTEIN_SCHLUESSEL) {
      expect(inLieferung, `${key} fehlt in der Lieferung`).toContain(key);
    }
    // Und sie tragen ALLE auch eine Seiten-Id — deshalb bedient ihr Datensatz ZWEI Objekte.
    for (const key of BAUSTEIN_SCHLUESSEL) {
      expect(record(key).confluence_id, `${key} ohne Seiten-Id`).toBeTruthy();
    }
  });

  it("L2 · ein unbekanntes Paket liefert nichts (kein Rückfall auf ein anderes)", () => {
    expect(lokalisierungsPaket("gibt-es-nicht")).toBeUndefined();
  });
});

describe("JOB 3326 · Q · der Quellabgleich ist eine echte Prüfung", () => {
  it("Q0 · KALIBRIERUNG: `source_body_sha256` IST sha256 von `en.paragraphs.join(\\n\\n)` — alle 36", () => {
    const mitHash = paket().records.filter((r) => r.source_body_sha256);
    expect(mitHash.length).toBe(36);
    const abweichend = mitHash.filter(
      (r) =>
        createHash("sha256")
          .update((r.en as LokalisierungsText).paragraphs.join("\n\n"), "utf8")
          .digest("hex") !== r.source_body_sha256,
    );
    expect(abweichend.map((r) => r.key)).toEqual([]);
  });

  it("Q1 · und genau diese Zeichenfolge legt das Demopaket als `bodySha256` je Baustein ab", () => {
    for (const item of ADVISOR_ICT_EN_V1.items) {
      expect(item.bodySha256, item.key).toBe(record(item.key).source_body_sha256);
    }
  });

  it("Q2 · Paketobjekt (Kernaussage = die Absätze) → BESTAETIGT", () => {
    const item = ADVISOR_ICT_EN_V1.items[0];
    if (!item) {
      throw new Error("Paket ohne Bausteine");
    }
    const objekt = ko(
      "paket-1",
      { externalId: `${PAKET_ID}/${item.key}`, provider: EXAMPLE_PROVIDER },
      { statement: item.paragraphs.join("\n\n") },
    );
    expect(quellabgleichFuer(record(item.key), objekt)).toBe("bestaetigt");
  });

  it("Q3 · abweichende Kernaussage → UNBESTAETIGT, ohne Zurechtbiegen", () => {
    const item = ADVISOR_ICT_EN_V1.items[0];
    if (!item) {
      throw new Error("Paket ohne Bausteine");
    }
    // Nur ein zusätzliches Leerzeichen — es wird NICHT wegnormalisiert.
    const knapp = ko(
      "paket-1",
      { externalId: `${PAKET_ID}/${item.key}`, provider: EXAMPLE_PROVIDER },
      { statement: `${item.paragraphs.join("\n\n")} ` },
    );
    expect(quellabgleichFuer(record(item.key), knapp)).toBe("unbestaetigt");
    // Ein Datensatz ohne gelieferten Abdruck kann gar nicht belegt werden.
    expect(quellabgleichFuer({}, knapp)).toBe("unbestaetigt");
  });
});

describe("JOB 3326 · A · Zuordnung über Herkunftsanker", () => {
  it("A1 · 36 Confluence-Objekte + genau die sechs Paketobjekte; 7 Datensätze bleiben BENANNT", () => {
    const befund = ordneZu(PAKET_ID, paket().records, bestandDerVorfuehrung());
    expect(befund.treffer.filter((t) => t.weg === "confluence").length).toBe(36);
    expect(befund.treffer.filter((t) => t.weg === "paketschluessel").length).toBe(6);
    expect(befund.treffer.length).toBe(42);
    // Die Word-/OneDrive-Datensätze haben KEIN Objekt — sie stehen mit NAMEN da, nicht als Zahl.
    expect(befund.ohneObjekt).toEqual([
      "WORD-NEW",
      "WORD-COMPARE",
      "OD01",
      "OD02",
      "OD03",
      "OD04",
      "OD05",
    ]);
  });

  it("A2 · die sechs Grundlagen-Datensätze bedienen ZWEI Objekte — Confluence-Kopie UND Baustein", () => {
    const befund = ordneZu(PAKET_ID, paket().records, bestandDerVorfuehrung());
    for (const key of BAUSTEIN_SCHLUESSEL) {
      const dazu = befund.treffer.filter((t) => t.record.key === key);
      expect(dazu.map((t) => t.ko.id).sort(), key).toEqual([`conf-${key}`, `paket-${key}`]);
      expect(dazu.map((t) => t.weg).sort(), key).toEqual(["confluence", "paketschluessel"]);
    }
    // Ein Datensatz OHNE Baustein bedient genau ein Objekt.
    expect(befund.treffer.filter((t) => t.record.key === "S01").length).toBe(1);
  });

  it("A3 · zugeordnet wird NUR über den Anker, nie über den Titel", () => {
    const s01 = record("S01");
    const fremd = ko(
      "ko-fremd",
      { externalId: "irgendein-anderer-anker", provider: "Confluence" },
      { title: (s01.en as LokalisierungsText).title },
    );
    const befund = ordneZu(PAKET_ID, [s01], [fremd]);
    expect(befund.treffer).toEqual([]);
    expect(befund.ohneObjekt).toEqual(["S01"]);
  });

  it("A4 · der Paketanker ist GENAU die Schreibweise des Demopakets, samt Provider", () => {
    const anker = ankerFuer(PAKET_ID, record("S02"));
    expect(anker).toEqual([
      {
        externalId: record("S02").confluence_id,
        weg: "confluence",
        provider: CONFLUENCE_PROVIDER,
      },
      { externalId: `${PAKET_ID}/S02`, weg: "paketschluessel", provider: EXAMPLE_PROVIDER },
    ]);
    // Ein FREMDER Provider mit derselben Kennung zählt nicht als Baustein.
    const fremderProvider = ko("x", {
      externalId: `${PAKET_ID}/S02`,
      provider: "Irgendwer",
    });
    expect(ordneZu(PAKET_ID, [record("S02")], [fremderProvider]).ohneObjekt).toEqual(["S02"]);
  });

  it("A5 · trägt EIN Objekt beide Anker, entsteht trotzdem nur EINE Zuordnung", () => {
    const beides = {
      ...ko("doppelt", { externalId: `${PAKET_ID}/S02`, provider: EXAMPLE_PROVIDER }),
      sources: [
        quelle(`${PAKET_ID}/S02`, EXAMPLE_PROVIDER),
        quelle(String(record("S02").confluence_id), "Confluence"),
      ],
    } as unknown as KnowledgeObject;
    const befund = ordneZu(PAKET_ID, [record("S02")], [beides]);
    expect(befund.treffer.length).toBe(1);
    expect(befund.treffer[0]?.weg).toBe("confluence");
  });

  // ==============================================================================================
  // JOB 3326 R2 (Codex 9e24066d) — EINE KENNUNG OHNE PROVIDER IST KEIN ANKER.
  // ==============================================================================================
  //
  // Confluence-Seiten-Ids sind blosse Zahlen. Ein Jira-Vorgang, ein Fremdimport oder ein von Hand
  // gesetzter Anker mit derselben Ziffernfolge dürfen NIE eine Advisor-Übersetzung erben: der
  // Leser läse dann an seinem Objekt einen Text, der zu einem ganz anderen Dokument gehört. Der
  // Bestand hält denselben Satz schon fest (`confluence-import.ts`, `importStatusKey`).
  it("A7 · dieselbe Kennung bei einem FREMDEN Provider bekommt KEINE Lesevariante", () => {
    const seitenId = String(record("S01").confluence_id);
    const echt = ko("ko-confluence", { externalId: seitenId, provider: CONFLUENCE_PROVIDER });
    const fremd = ko("ko-jira", { externalId: seitenId, provider: "Jira" });
    const befund = ordneZu(PAKET_ID, [record("S01")], [echt, fremd]);
    expect(befund.treffer.map((t) => t.ko.id)).toEqual(["ko-confluence"]);
    // Und ALLEIN reicht das fremde Objekt nicht: der Datensatz bleibt unzugeordnet.
    expect(ordneZu(PAKET_ID, [record("S01")], [fremd]).ohneObjekt).toEqual(["S01"]);
  });

  it("A8 · der Providervergleich ist der kanonische (trim/Kleinschreibung; ohne Provider = Confluence)", () => {
    const seitenId = String(record("S01").confluence_id);
    // Schreibweise egal — dieselbe Normalisierung wie in Queue und Status-Abgleich.
    for (const schreibweise of ["Confluence", " confluence ", "CONFLUENCE"]) {
      const objekt = ko("ko-x", { externalId: seitenId, provider: schreibweise });
      expect(ordneZu(PAKET_ID, [record("S01")], [objekt]).treffer.length, schreibweise).toBe(1);
    }
    // Altbestand OHNE Provider zählt als Confluence — deckungsgleich mit dem Pg-Backfill.
    const ohneProvider = {
      ...ko("ko-alt", { externalId: seitenId, provider: CONFLUENCE_PROVIDER }),
      sources: [
        {
          id: seitenId,
          label: seitenId,
          url: null,
          excerpt: null,
          kind: "external",
          peerValidated: false,
          externalId: seitenId,
          author: "importer",
          at: "2026-09-01T00:00:00.000Z",
        },
      ],
    } as unknown as KnowledgeObject;
    expect(ordneZu(PAKET_ID, [record("S01")], [ohneProvider]).treffer.length).toBe(1);
    // Der PAKETANKER dagegen zählt einen fehlenden Provider NICHT als Beispielpaket.
    const paketOhneProvider = {
      ...ko("ko-alt2", { externalId: `${PAKET_ID}/S02`, provider: EXAMPLE_PROVIDER }),
      sources: [
        {
          id: `${PAKET_ID}/S02`,
          label: "x",
          url: null,
          excerpt: null,
          kind: "external",
          peerValidated: false,
          externalId: `${PAKET_ID}/S02`,
          author: "importer",
          at: "2026-09-01T00:00:00.000Z",
        },
      ],
    } as unknown as KnowledgeObject;
    expect(ordneZu(PAKET_ID, [record("S02")], [paketOhneProvider]).ohneObjekt).toEqual(["S02"]);
  });

  it("A9 · der geforderte Providername ist DER, den der Confluence-Mapper wirklich schreibt", () => {
    // Ohne diese Bindung wäre `CONFLUENCE_PROVIDER` eine Behauptung: benennt der Adapter seinen
    // Provider eines Tages um, fiele die Zuordnung STILL auf null Treffer — alle Übersetzungen
    // wären weg, und kein Test sagte warum. Gelesen wird die Quelle des Mappers, nicht ein Kommentar.
    const mapper = readFileSync(new URL("../../confluence/src/mapper.ts", import.meta.url), "utf8");
    expect(mapper).toContain(`provider: "${CONFLUENCE_PROVIDER}"`);
    // Und er schreibt die Seiten-Id als externalId — das andere Glied desselben Ankers.
    expect(mapper).toContain("externalId: page.id");
  });

  it("A6 · ein Word-/OneDrive-Datensatz wird zugeordnet, WENN ein Objekt den Paketanker trägt", () => {
    const od = record("OD01");
    const objekt = ko("paket-OD01", {
      externalId: `${PAKET_ID}/OD01`,
      provider: EXAMPLE_PROVIDER,
    });
    const befund = ordneZu(PAKET_ID, [od], [objekt]);
    expect(befund.treffer.map((t) => t.ko.id)).toEqual(["paket-OD01"]);
    expect(befund.ohneObjekt).toEqual([]);
  });
});

describe("JOB 3326 · B · Laden und Idempotenz", () => {
  async function lade(repo: InMemoryLesevariantenRepo, kos: KnowledgeObject[], zeit?: string) {
    return ladeLesevarianten(
      { repo, kos: async () => kos, ...(zeit ? { jetzt: () => new Date(zeit) } : {}) },
      paket(),
      "admin-1",
    );
  }

  it("B1 · erstes Laden: 42 Varianten an 42 Objekten, 36 Datensätze zugeordnet, KEIN Wissensobjekt angelegt", async () => {
    const kos = bestandDerVorfuehrung();
    const vorher = kos.length;
    const repo = new InMemoryLesevariantenRepo();
    const bilanz = await lade(repo, kos);
    expect(bilanz.sprachen).toEqual(["de"]);
    expect(bilanz.neu).toBe(42);
    expect(bilanz.aktualisiert).toBe(0);
    expect(bilanz.zugeordnet).toBe(36);
    expect(bilanz.objekte).toBe(42);
    expect(bilanz.ueberConfluence).toBe(36);
    expect(bilanz.ueberPaketschluessel).toBe(6);
    expect(bilanz.nichtZugeordnet.length).toBe(7);
    expect(kos.length).toBe(vorher);
    expect((await repo.inSprache("de")).length).toBe(42);
  });

  it("B2 · die sechs Bausteine haben ihre eigene Variante — nicht nur die Confluence-Kopien", async () => {
    const repo = new InMemoryLesevariantenRepo();
    await lade(repo, bestandDerVorfuehrung());
    for (const key of BAUSTEIN_SCHLUESSEL) {
      const variante = await repo.get(`paket-${key}`, "de");
      expect(variante, `Baustein ${key} ohne Lesevariante`).toBeDefined();
      expect(variante?.title).toBe((record(key).de as LokalisierungsText).title);
    }
  });

  it("B3 · zweites Laden: 0 neu, 42 angefasst, kein Text geändert, keine doppelte Zeile", async () => {
    const kos = bestandDerVorfuehrung();
    const repo = new InMemoryLesevariantenRepo();
    await lade(repo, kos);
    const zweite = await lade(repo, kos);
    expect(zweite.neu).toBe(0);
    expect(zweite.aktualisiert).toBe(42);
    expect(zweite.textGeaendert).toEqual([]);
    expect((await repo.inSprache("de")).length).toBe(42);
    expect((await repo.forKo("conf-S01")).length).toBe(1);
  });

  it("B4 · die geladene Variante trägt Text, Herkunft und den Nicht-Freigabe-Stand", async () => {
    const repo = new InMemoryLesevariantenRepo();
    await lade(repo, bestandDerVorfuehrung());
    const variante = await repo.get("conf-S01", "de");
    expect(variante?.title).toBe("Kundenprofil: Harbor Field Services");
    expect(variante?.originalLanguage).toBe("en");
    expect(variante?.herkunft).toBe(`lokale Lieferung ${PAKET_ID}`);
    expect(variante?.status).toBe("draft_translation_not_business_approval");
    expect(variante?.statement.startsWith("Harbor Field Services ist ein fiktiver Kunde")).toBe(
      true,
    );
    expect(variante?.bodyHtml.startsWith("<p>Harbor Field Services ist ein fiktiver Kunde")).toBe(
      true,
    );
    expect(variante?.sourceBodySha256).toMatch(/^[0-9a-f]{64}$/);
    expect(variante?.uebersetzungSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("B5 · der Quellabgleich fällt gemessen aus: die sechs Bausteine BESTAETIGT, die Kopien nicht", async () => {
    const repo = new InMemoryLesevariantenRepo();
    const bilanz = await lade(repo, bestandDerVorfuehrung());
    expect(bilanz.quellabgleichBestaetigt).toBe(6);
    expect(bilanz.quellabgleichUnbestaetigt).toBe(36);
    for (const key of BAUSTEIN_SCHLUESSEL) {
      expect((await repo.get(`paket-${key}`, "de"))?.quellabgleich, key).toBe("bestaetigt");
      expect((await repo.get(`conf-${key}`, "de"))?.quellabgleich, key).toBe("unbestaetigt");
    }
  });

  it("B6 · es wird KEINE englische Variante geschrieben (das Original ist kein Zweitexemplar)", async () => {
    const repo = new InMemoryLesevariantenRepo();
    await lade(repo, bestandDerVorfuehrung());
    expect(await repo.inSprache("en")).toEqual([]);
    expect((await repo.forKo("conf-S01")).map((v) => v.lang)).toEqual(["de"]);
  });
});

describe('JOB 3326 · E · „Original seit Übersetzung geändert" — die Warnung hält', () => {
  const KO_ID = "conf-S01";

  async function geladen(kos: KnowledgeObject[]) {
    const repo = new InMemoryLesevariantenRepo();
    await ladeLesevarianten(
      { repo, kos: async () => kos, jetzt: () => new Date("2026-09-01T00:00:00.000Z") },
      paket(),
      "admin-1",
    );
    return repo;
  }

  function originalKo(): KnowledgeObject {
    return ko(KO_ID, {
      externalId: String(record("S01").confluence_id),
      provider: "Confluence",
    });
  }

  it("E1 · unverändertes Original → kein Kennzeichen", async () => {
    const objekt = originalKo();
    const repo = await geladen([objekt]);
    const variante = await repo.get(KO_ID, "de");
    if (!variante) {
      throw new Error("Variante fehlt");
    }
    expect(mitAenderungsauskunft(variante, objekt).originalGeaendert).toBe(false);
  });

  it("E2 · geändertes Original → Kennzeichen, und die Variante bleibt SICHTBAR", async () => {
    const objekt = originalKo();
    const repo = await geladen([objekt]);
    const variante = await repo.get(KO_ID, "de");
    if (!variante) {
      throw new Error("Variante fehlt");
    }
    const geaendert = { ...objekt, statement: "Original statement has been revised" };
    const sicht = mitAenderungsauskunft(variante, geaendert);
    expect(sicht.originalGeaendert).toBe(true);
    // Der Vorbehalt LEERT nichts (Zustandsmodell auf der Fläche, Lehre 7).
    expect(sicht.title).toBe("Kundenprofil: Harbor Field Services");
    expect(sicht.statement.length).toBeGreaterThan(0);
  });

  it("E3 · derselbe Lauf meldet die Warnung in der Bilanz — mit Kennung", async () => {
    const objekt = originalKo();
    const repo = await geladen([objekt]);
    const geaendert = { ...objekt, statement: "Original statement has been revised" };
    const zweite = await ladeLesevarianten(
      { repo, kos: async () => [geaendert] },
      paket(),
      "admin-1",
    );
    expect(zweite.originalGeaendert).toEqual([KO_ID]);
  });

  it("E4 · DER FALL AUS RUNDE 1: dieselbe Lieferung erneut laden LÖSCHT die Warnung NICHT", async () => {
    const objekt = originalKo();
    const repo = await geladen([objekt]);
    const geaendert = { ...objekt, statement: "Original statement has been revised" };
    // Zweimal nachladen — der Ladeklick ändert die Übersetzung nicht, also auch nicht ihren Bezug.
    await ladeLesevarianten({ repo, kos: async () => [geaendert] }, paket(), "admin-1");
    await ladeLesevarianten({ repo, kos: async () => [geaendert] }, paket(), "admin-1");
    const nachher = await repo.get(KO_ID, "de");
    if (!nachher) {
      throw new Error("Variante fehlt");
    }
    expect(mitAenderungsauskunft(nachher, geaendert).originalGeaendert).toBe(true);
    // Auch der Zeitpunkt bleibt: er beschreibt, wann DIESE Übersetzung abgelegt wurde.
    expect(nachher.updatedAt).toBe("2026-09-01T00:00:00.000Z");
  });

  it("E5 · eine NEUE Übersetzung nimmt die Warnung weg — und nur sie", async () => {
    const objekt = originalKo();
    const repo = await geladen([objekt]);
    const geaendert = { ...objekt, statement: "Original statement has been revised" };
    // Die Lieferung mit GEÄNDERTEM deutschen Text für S01.
    const alt = paket();
    const neueLieferung = {
      ...alt,
      records: alt.records.map((r) =>
        r.key === "S01"
          ? {
              ...r,
              de: {
                title: "Kundenprofil: Harbor Field Services (überarbeitet)",
                paragraphs: ["Neu übersetzt gegen den überarbeiteten Originaltext."],
              },
            }
          : r,
      ),
    };
    const bilanz = await ladeLesevarianten(
      { repo, kos: async () => [geaendert] },
      neueLieferung,
      "admin-1",
    );
    expect(bilanz.textGeaendert).toEqual([KO_ID]);
    expect(bilanz.originalGeaendert).toEqual([]);
    const nachher = await repo.get(KO_ID, "de");
    if (!nachher) {
      throw new Error("Variante fehlt");
    }
    expect(mitAenderungsauskunft(nachher, geaendert).originalGeaendert).toBe(false);
    expect(nachher.title).toBe("Kundenprofil: Harbor Field Services (überarbeitet)");
  });

  it("E6 · der Abdruck der Übersetzung unterscheidet Titeländerung von Absatzänderung", () => {
    const basis: LokalisierungsText = { title: "T", paragraphs: ["A", "B"] };
    expect(uebersetzungsAbdruck(basis)).toBe(
      uebersetzungsAbdruck({ title: "T", paragraphs: ["A", "B"] }),
    );
    expect(uebersetzungsAbdruck(basis)).not.toBe(uebersetzungsAbdruck({ ...basis, title: "T2" }));
    expect(uebersetzungsAbdruck(basis)).not.toBe(
      uebersetzungsAbdruck({ ...basis, paragraphs: ["A", "C"] }),
    );
  });

  it("E7 · der Original-Abdruck deckt Titel, Kernaussage UND Rumpf", () => {
    const basis = { title: "T", statement: "S", bodyHtml: "<p>B</p>" };
    expect(originalAbdruck(basis)).not.toBe(originalAbdruck({ ...basis, title: "T2" }));
    expect(originalAbdruck(basis)).not.toBe(originalAbdruck({ ...basis, statement: "S2" }));
    expect(originalAbdruck(basis)).not.toBe(originalAbdruck({ ...basis, bodyHtml: "<p>C</p>" }));
  });
});
