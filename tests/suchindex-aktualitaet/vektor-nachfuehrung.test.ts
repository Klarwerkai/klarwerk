// ================================================================================================
// AUFNAHME 20260922 · GESAMT-SUCHINDEX-AKTUALITAET — DER VEKTORSPEICHER FOLGT DEM OBJEKT.
// ================================================================================================
//
// R-0470: „Die Neuindizierung läuft über eine Warteschlange statt sofort im Aufruf … und ein Objekt
// verschwindet aus dem Index, sobald seine Vertraulichkeit heraufgestuft wird."
// R-0483: „Ob Vektorspeicher und Suchprojektion das heute wirklich tun, ist ungeprüft."
//
// Gemessen wird hier die Vektorseite (der semantische Vorfilter der Textprüfung, hinter
// KLARWERK_DUP_PREFILTER), und zwar in drei Schichten:
//   N  der Nachlauf des KoService meldet JEDE gespeicherte Änderung — und keine gescheiterte;
//   R  der Reindex-Eintrag bettet neu ein oder entfernt den Vektor, je nach heutigem Stand;
//   Q  über die Warteschlange: der Aufruf ist fertig, während die Neuindizierung noch aussteht.
import { describe, expect, it } from "vitest";
import { reindexKoForDuplicatePrefilter } from "../../services/app/src/duplicate-detection";
import { createReindexQueue } from "../../services/app/src/reindex-queue";
import {
  type EmbeddingProvider,
  InMemoryEmbeddingStore,
  stubEmbeddingProvider,
} from "../../services/embedding";
import {
  InMemoryKoRepo,
  InMemoryKoSearchProjectionRepo,
  InMemoryKoVersionRepo,
  KoService,
} from "../../services/knowledge-object";

const EINGABE = {
  title: "Kompressor K9",
  statement: "Ölstand wöchentlich prüfen.",
  type: "best_practice" as const,
  category: "Wartung",
  author: "anna",
};

async function stapel() {
  const repo = new InMemoryKoRepo();
  const ko = new KoService({
    repo,
    versions: new InMemoryKoVersionRepo(),
    searchProjections: new InMemoryKoSearchProjectionRepo(repo),
  });
  await ko.activateSearchProjectionV2();
  return { ko };
}

/**
 * Der Vorfilter der Prüfung: ein Stub-Embedder, der jeden eingebetteten Text aufzeichnet und —
 * für Q — an einem Tor warten kann. Abfragen laufen über einen ZWEITEN, ungebremsten Stub derselben
 * Version: er bettet deterministisch identisch ein, ohne das Tor zu passieren.
 */
function vorfilter(tor: Promise<void> = Promise.resolve()) {
  const basis = stubEmbeddingProvider();
  const texte: string[] = [];
  const embedder: EmbeddingProvider = {
    ...basis,
    embed: async (eingabe: string[]) => {
      texte.push(...eingabe);
      await tor;
      return basis.embed(eingabe);
    },
  };
  const store = new InMemoryEmbeddingStore();
  const zuletzt = new Map<string, string>();
  return {
    deps: { semanticPrefilter: { embedder, store, topK: 25 }, zuletzt },
    store,
    texte,
    abfrage: stubEmbeddingProvider(),
  };
}

async function belegt(v: ReturnType<typeof vorfilter>): Promise<string[]> {
  // Ein beliebiger Anfragevektor — `nearest` liefert JEDEN gespeicherten Vektor der Version.
  const { vectors, embeddingVersion } = await v.abfrage.embed(["irgendwas"]);
  return (await v.store.nearest(vectors[0] ?? [], embeddingVersion, 100)).map((h) => h.id).sort();
}

describe("Vektor-Nachführung · N — der Änderungsnachlauf", () => {
  it("N1 · Überarbeitung, Stufenwechsel, Zusammenführen, Papierkorb und Wiederherstellen melden je einmal", async () => {
    const { ko } = await stapel();
    const a = await ko.create({ ...EINGABE });
    const b = await ko.create({ ...EINGABE, title: "Führend" });
    const gemeldet: string[] = [];
    ko.setAenderungsNachlauf((id) => gemeldet.push(id));

    const revidiert = await ko.revise(a.id, { statement: "Ölstand täglich prüfen." }, "anna");
    await ko.setConfidentiality(a.id, "vertraulich", "anna");
    await ko.markMergedInto(
      a.id,
      { koId: b.id, version: b.version, overlapId: "ov-1" },
      "kurator",
      revidiert.version,
    );
    await ko.delete(b.id, "anna");
    await ko.restore(b.id, "anna");

    expect(gemeldet).toEqual([a.id, a.id, a.id, b.id, b.id]);
  });

  it("N2 · eine abgewiesene Änderung meldet nichts — es gibt keinen neuen Stand", async () => {
    const { ko } = await stapel();
    const a = await ko.create({ ...EINGABE });
    const gemeldet: string[] = [];
    ko.setAenderungsNachlauf((id) => gemeldet.push(id));

    await expect(
      ko.revise(a.id, { statement: "Veraltet" }, "anna", { expectedVersion: a.version + 5 }),
    ).rejects.toMatchObject({ name: "KoError" });

    expect(gemeldet).toEqual([]);
  });

  it("N3 · ein werfender Nachlauf kippt die gespeicherte Änderung nicht", async () => {
    const { ko } = await stapel();
    const a = await ko.create({ ...EINGABE });
    ko.setAenderungsNachlauf(() => {
      throw new Error("Nachlauf kaputt");
    });

    const revidiert = await ko.revise(a.id, { statement: "Gilt trotzdem." }, "anna");

    expect(revidiert.statement).toBe("Gilt trotzdem.");
    expect((await ko.get(a.id))?.statement).toBe("Gilt trotzdem.");
  });
});

describe("Vektor-Nachführung · R — der Reindex-Eintrag", () => {
  it("R1 · nach einer Überarbeitung wird der NEUE Stand eingebettet und ersetzt den alten Vektor", async () => {
    const { ko } = await stapel();
    const v = vorfilter();
    const a = await ko.create({ ...EINGABE });
    await reindexKoForDuplicatePrefilter(a.id, { ko, ...v.deps });
    expect(v.texte.at(-1)).toContain("Kompressor K9");

    await ko.revise(a.id, { title: "Turbine T4", statement: "Lager monatlich schmieren." }, "anna");
    await reindexKoForDuplicatePrefilter(a.id, { ko, ...v.deps });

    // Eingebettet wurde der heutige Kerntext, nicht der des Aufrufers und nicht der alte …
    expect(v.texte.at(-1)).toContain("Turbine T4");
    expect(v.texte.at(-1)).not.toContain("Kompressor K9");
    // … und es steht weiterhin GENAU EIN Vektor für das Objekt da: ersetzt, nicht ergänzt.
    expect(await belegt(v)).toEqual([a.id]);
  });

  it("R2 · heraufgestuft, aufgegangen oder im Papierkorb ⇒ der Vektor verlässt den Speicher", async () => {
    const { ko } = await stapel();
    const v = vorfilter();
    const hoch = await ko.create({ ...EINGABE });
    const auf = await ko.create({ ...EINGABE });
    const korb = await ko.create({ ...EINGABE });
    const bleibt = await ko.create({ ...EINGABE, title: "Führend" });
    for (const k of [hoch, auf, korb, bleibt]) {
      await reindexKoForDuplicatePrefilter(k.id, { ko, ...v.deps });
    }
    // Kalibrierung: alle vier stehen im Speicher.
    expect(await belegt(v)).toEqual([hoch.id, auf.id, korb.id, bleibt.id].sort());

    await ko.setConfidentiality(hoch.id, "vertraulich", "anna");
    await ko.markMergedInto(
      auf.id,
      { koId: bleibt.id, version: bleibt.version, overlapId: "ov-2" },
      "kurator",
      auf.version,
    );
    await ko.delete(korb.id, "anna");
    for (const id of [hoch.id, auf.id, korb.id]) {
      await reindexKoForDuplicatePrefilter(id, { ko, ...v.deps });
    }

    expect(await belegt(v)).toEqual([bleibt.id]);
  });

  it("R3 · unveränderter Kerntext (etwa nach einer Bewertung) kostet keinen Embedder-Aufruf", async () => {
    const { ko } = await stapel();
    const v = vorfilter();
    const a = await ko.create({ ...EINGABE });
    await reindexKoForDuplicatePrefilter(a.id, { ko, ...v.deps });
    expect(v.texte).toHaveLength(1);

    await reindexKoForDuplicatePrefilter(a.id, { ko, ...v.deps });

    expect(v.texte).toHaveLength(1);
  });
});

describe("Vektor-Nachführung · Q — über die Warteschlange, nicht im Aufruf", () => {
  it("Q1 · die Überarbeitung ist fertig, während die Neuindizierung noch aussteht", async () => {
    const { ko } = await stapel();
    let oeffnen: () => void = () => undefined;
    const v = vorfilter(
      new Promise<void>((r) => {
        oeffnen = r;
      }),
    );
    const fehler: string[] = [];
    const queue = createReindexQueue({
      reindex: (id) => reindexKoForDuplicatePrefilter(id, { ko, ...v.deps }),
      onError: (id) => fehler.push(id),
    });
    const a = await ko.create({ ...EINGABE });
    ko.setAenderungsNachlauf((id) => queue.enqueue(id));

    const revidiert = await ko.revise(
      a.id,
      { title: "Turbine T4", statement: "Lager monatlich schmieren." },
      "anna",
    );

    // Die Überarbeitung ist gespeichert und zurückgegeben — die Neuindizierung steht noch aus.
    expect(revidiert.title).toBe("Turbine T4");
    expect(queue.queuedCount()).toBe(1);
    expect(await belegt(v)).toEqual([]);

    oeffnen();
    await queue.idle();

    expect(await belegt(v)).toEqual([a.id]);
    expect(v.texte.at(-1)).toContain("Turbine T4");
    expect(fehler).toEqual([]);
  });
});
