// ================================================================================================
// JOB 544 / D4 — DIE W7-MATRIX, AUSFÜHRBAR ENTSCHIEDEN.
// ================================================================================================
//
// Das rote Vollurteil `_relay/kopf/outbox/BEN3-PRUEFUNG-JOB-544-D3.md` verlangt (Korrekturpflicht 3):
//
//   „Altversions- und Dateinamensuche mit ausführbaren Fällen entscheiden und die W7-Matrix ohne
//    verbleibendes `UNBEWIESEN` für abnahmeprägende Aussagen schließen."
//
// D3 hat beide Dimensionen ehrlich als `UNBEWIESEN` geführt — „ich habe sie nicht gemessen und rate
// nicht". Hier werden sie gemessen. Zusätzlich läuft die Wiederholbarkeit ERSTMALS als echter
// Modullauf: D3s Sonde hat den Vergleicher wortgleich NACHGEBAUT, aber das Modul nicht importiert
// (D3 §6, ausdrücklich benannt). Dieser Fall importiert es.
//
// WAS DIESE DATEI NICHT TUT: sie entscheidet die Ownerfrage aus Korrekturpflicht 1 nicht (welche
// Primärordnung gelten soll) und baut keinen Tiebreaker. Sie hält fest, was heute gilt.
import { describe, expect, it } from "vitest";
import {
  InMemoryKoRepo,
  InMemoryKoSearchProjectionRepo,
  InMemoryKoVersionRepo,
  type KnowledgeObject,
  KoService,
  buildSearchProjection,
  dropConfidential,
} from "../../services/knowledge-object";

const EINGABE = {
  title: "Hydraulikzylinder HZ7",
  statement: "Vor dem Entlüften den Systemdruck ablassen.",
  type: "best_practice" as const,
  category: "Wartung",
  author: "anna",
};

/** Ein in Betrieb genommener Stapel; `ids` erlaubt feste Kennungen für die Ordnungsfälle. */
async function stapel(ids: readonly string[] = []) {
  const repo = new InMemoryKoRepo();
  const projections = new InMemoryKoSearchProjectionRepo(repo);
  const versions = new InMemoryKoVersionRepo();
  let i = 0;
  const ko = new KoService({
    repo,
    versions,
    searchProjections: projections,
    now: () => Date.parse("2026-08-17T09:00:00.000Z"),
    ...(ids.length > 0 ? { genId: () => ids[i++] ?? `rest-${i}` } : {}),
  });
  const { readiness } = await ko.activateSearchProjectionV2();
  expect(readiness.alle, readiness.befunde.join("; ")).toBe(true);
  return { repo, projections, versions, ko };
}

// ================================================================================================
// TEIL A — ALTVERSION (W7-Dimension 1, bisher UNBEWIESEN)
// ================================================================================================
describe("JOB 544 · A — die Suche findet die AKTIVE Fassung, nie die alte", () => {
  it("A1 · nach einer Revision ist der ALTE Begriff kein Treffer mehr", async () => {
    const { ko } = await stapel();
    const erstellt = await ko.create({ ...EINGABE, bodyHtml: "<p>Alphawort</p>" });
    expect((await ko.findSearchHits({ terms: ["alphawort"] })).map((h) => h.koId)).toEqual([
      erstellt.id,
    ]);

    await ko.revise(erstellt.id, { bodyHtml: "<p>Betawort</p>" }, "anna");

    // Der neue Begriff trifft …
    expect((await ko.findSearchHits({ terms: ["betawort"] })).map((h) => h.koId)).toEqual([
      erstellt.id,
    ]);
    // … und der alte NICHT MEHR. Das ist die Zusage „Aktiver Datensatz" aus der
    // G27-Architekturentscheidung, hier zum ersten Mal ausgeführt statt gelesen.
    expect(await ko.findSearchHits({ terms: ["alphawort"] })).toEqual([]);
  });

  it("A2 · die alte Projektionszeile bleibt trotzdem erhalten — kein Schattenfund, kein Datenverlust", async () => {
    const { ko, projections } = await stapel();
    const erstellt = await ko.create({ ...EINGABE, bodyHtml: "<p>Alphawort</p>" });
    await ko.revise(erstellt.id, { bodyHtml: "<p>Betawort</p>" }, "anna");

    // Beide Fassungen liegen im Bestand — die Historie wird nicht gelöscht, nur nicht mehr bedient.
    const zeilen = await projections.listByKo(erstellt.id);
    expect(zeilen.length).toBeGreaterThanOrEqual(2);
    expect(zeilen.some((z) => z.bodyText.includes("Alphawort"))).toBe(true);
    expect(zeilen.some((z) => z.bodyText.includes("Betawort"))).toBe(true);
    // Aber nur die aktive Fassung ist Treffer (A1) — beides zusammen ist die ganze Aussage.
  });
});

// ================================================================================================
// TEIL D — DATEINAME (W7-Dimension 3, bisher UNBEWIESEN)
// ================================================================================================
describe("JOB 544 · D — der Anhangsdateiname ist NICHT durchsuchbar", () => {
  it("D1 · der Name eines Anhangs erreicht die Projektion nicht", () => {
    // Gemessen an der reinen Ableitung: der Projektionsinhalt entsteht aus Titel, Aussage,
    // Bildunterschriften und sichtbarem Dokumenttext (`inhaltVon`, search-projection.ts:628-639).
    // Ein Anhangsname ist keine dieser vier Quellen — und genau das wird hier festgehalten.
    const mitAnhang = {
      ...EINGABE,
      id: "ko-anhang",
      version: 1,
      createdAt: "2026-08-17T09:00:00.000Z",
      bodyHtml: "<p>Nur Fliesstext ohne den Namen.</p>",
      attachments: [{ id: "a1", name: "Ventilplan-XYZ7.pdf", mime: "application/pdf" }],
    } as unknown as KnowledgeObject;
    const projektion = buildSearchProjection(mitAnhang, "2026-08-17T09:00:00.000Z");
    expect(projektion.searchText).not.toContain("Ventilplan");
    expect(projektion.bodyText).not.toContain("Ventilplan");
    expect(projektion.titleText).not.toContain("Ventilplan");
  });

  it("D2 · derselbe Name IM FLIESSTEXT ist sehr wohl auffindbar — die Grenze ist benannt, nicht geraten", async () => {
    // Die Gegenprobe verhindert, dass D1 als „Dateinamen sind unauffindbar" missverstanden wird.
    // Auffindbar ist, was im Dokument STEHT; nicht auffindbar ist die Anhangs-Metadatenzeile.
    const { ko } = await stapel();
    const erstellt = await ko.create({
      ...EINGABE,
      bodyHtml: "<p>Siehe Ventilplan-XYZ7.pdf im Anhang.</p>",
    });
    expect(
      (await ko.findSearchHits({ terms: ["ventilplan-xyz7.pdf"] })).map((h) => h.koId),
    ).toEqual([erstellt.id]);
  });

  it("D3 · die Suchfelder der Projektion sind abschliessend vier — ein fünftes wäre eine neue Zusage", () => {
    const projektion = buildSearchProjection(
      {
        ...EINGABE,
        id: "ko-felder",
        version: 1,
        createdAt: "2026-08-17T09:00:00.000Z",
        bodyHtml: "<p>Rumpfwort</p>",
      } as unknown as KnowledgeObject,
      "2026-08-17T09:00:00.000Z",
    );
    // `searchText` ist die Vereinigung von titleText, statementText, captionText und bodyText.
    const vereinigung = [
      projektion.titleText,
      projektion.statementText,
      projektion.captionText,
      projektion.bodyText,
    ]
      .filter((t) => t.length > 0)
      .join("\n");
    expect(projektion.searchText).toBe(vereinigung);
  });
});

// ================================================================================================
// TEIL R — WIEDERHOLBARKEIT AM ECHTEN SUCHWEG (W7-Dimension 4, erstmals als Modullauf)
// ================================================================================================
describe("JOB 544 · R — gleicher Bestand, andere Schreibhistorie, gleiches Ergebnis", () => {
  it("R1 · zwei Bestände in umgekehrter Einfügereihenfolge liefern unter `limit 1` DIESELBE Kennung", async () => {
    // GENAU D3s Fall — diesmal mit dem ECHTEN Modul statt einem nachgebauten Vergleicher.
    // Feste Kennungen, damit „dieselbe Kennung" überhaupt eine prüfbare Aussage ist.
    const eins = await stapel(["ko-A", "ko-B"]);
    await eins.ko.create({ ...EINGABE, bodyHtml: "<p>Gleichstandwort</p>" });
    await eins.ko.create({ ...EINGABE, bodyHtml: "<p>Gleichstandwort</p>" });

    const zwei = await stapel(["ko-B", "ko-A"]);
    await zwei.ko.create({ ...EINGABE, bodyHtml: "<p>Gleichstandwort</p>" });
    await zwei.ko.create({ ...EINGABE, bodyHtml: "<p>Gleichstandwort</p>" });

    const a = await eins.ko.findSearchHits({ terms: ["gleichstandwort"], limit: 1 });
    const b = await zwei.ko.findSearchHits({ terms: ["gleichstandwort"], limit: 1 });
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
    // Der stabile Tiebreaker (`koId` aufsteigend) entscheidet — nicht die Einfügereihenfolge.
    expect(a[0]?.koId).toBe(b[0]?.koId);
    expect(a[0]?.koId).toBe("ko-A");
  });

  it("R2 · dasselbe gilt für den Kandidatenweg, den Ask benutzt", async () => {
    // `KoService.findCandidates` läuft über `findSearchHits` → `findActive`. Der Fall hält fest,
    // dass die Kandidatenreihenfolge damit dieselbe Determiniertheit erbt.
    const eins = await stapel(["ko-A", "ko-B"]);
    await eins.ko.create({ ...EINGABE, bodyHtml: "<p>Gleichstandwort</p>" });
    await eins.ko.create({ ...EINGABE, bodyHtml: "<p>Gleichstandwort</p>" });

    const zwei = await stapel(["ko-B", "ko-A"]);
    await zwei.ko.create({ ...EINGABE, bodyHtml: "<p>Gleichstandwort</p>" });
    await zwei.ko.create({ ...EINGABE, bodyHtml: "<p>Gleichstandwort</p>" });

    const a = await eins.ko.findCandidates({ terms: ["gleichstandwort"], limit: 1 });
    const b = await zwei.ko.findCandidates({ terms: ["gleichstandwort"], limit: 1 });
    expect(a.map((k) => k.id)).toEqual(["ko-A"]);
    expect(b.map((k) => k.id)).toEqual(["ko-A"]);
  });

  it("R3 · die vollständige Reihenfolge ist in beiden Beständen identisch, nicht nur der erste Treffer", async () => {
    const eins = await stapel(["ko-A", "ko-B", "ko-C"]);
    const zwei = await stapel(["ko-C", "ko-B", "ko-A"]);
    for (const s of [eins, zwei]) {
      await s.ko.create({ ...EINGABE, bodyHtml: "<p>Gleichstandwort</p>" });
      await s.ko.create({ ...EINGABE, bodyHtml: "<p>Gleichstandwort</p>" });
      await s.ko.create({ ...EINGABE, bodyHtml: "<p>Gleichstandwort</p>" });
    }
    const a = (await eins.ko.findSearchHits({ terms: ["gleichstandwort"] })).map((h) => h.koId);
    const b = (await zwei.ko.findSearchHits({ terms: ["gleichstandwort"] })).map((h) => h.koId);
    expect(a).toEqual(["ko-A", "ko-B", "ko-C"]);
    expect(b).toEqual(a);
  });
});

// ================================================================================================
// TEIL S — DIE SICHERHEITSGRENZE DES KANDIDATENWEGS (Prüflücke 5, gemessener Teil)
// ================================================================================================
//
// Prüflücke 5 verlangt: „mehr als `limit` höher gerankte unzulässige Kandidaten plus zulässiger
// Treffer; erwartet: kein Datenleck und kein still falsch-negatives Leer".
//
// DIESE DATEI ENTSCHEIDET B2 NICHT — die Behebung („Filter vor Limit" oder „ausgewiesene
// Überdeckung") ist die offene Ownerfrage F2 aus D3 §9. Was hier steht, ist die Hälfte, die ohne
// Entscheidung messbar ist: dass die Vertraulichkeitsgrenze am Ask-Weg HÄLT.
describe("JOB 544 · S — vertrauliches Wissen verlässt den Kandidatenweg nicht", () => {
  it("S1 · `dropConfidential` entfernt vertrauliche Kandidaten rollenunabhängig", async () => {
    const { ko } = await stapel(["ko-a1", "ko-a2", "ko-a3"]);
    for (const n of [1, 2, 3]) {
      await ko.create({
        ...EINGABE,
        title: `Verborgen ${n}`,
        author: "fremd",
        confidentiality: "vertraulich",
        bodyHtml: "<p>Grenzwort</p>",
      });
    }
    const kandidaten = await ko.findCandidates({ terms: ["grenzwort"], limit: 10 });
    expect(kandidaten).toHaveLength(3);
    // Kein Leck: was vertraulich ist, erreicht den Reasoner nicht.
    expect(dropConfidential(kandidaten)).toHaveLength(0);
  });

  it("S2 · ein zulässiger Treffer bleibt erhalten, wenn der Deckel ihn nicht abschneidet", async () => {
    const { ko } = await stapel(["ko-a1", "ko-a2", "ko-a3", "ko-z9"]);
    for (const n of [1, 2, 3]) {
      await ko.create({
        ...EINGABE,
        title: `Verborgen ${n}`,
        author: "fremd",
        confidentiality: "vertraulich",
        bodyHtml: "<p>Grenzwort</p>",
      });
    }
    await ko.create({ ...EINGABE, title: "Zulaessig", bodyHtml: "<p>Grenzwort</p>" });
    // Ohne Deckel liefert der Weg alle vier; nach der Vertraulichkeitsgrenze bleibt genau der eine
    // zulässige übrig. Das ist die Zusage „kein Leck UND kein falsches Leer" — für den Fall, dass
    // der Deckel nicht greift.
    const kandidaten = await ko.findCandidates({ terms: ["grenzwort"], limit: 10 });
    expect(kandidaten).toHaveLength(4);
    expect(dropConfidential(kandidaten).map((k) => k.id)).toEqual(["ko-z9"]);
  });
});
