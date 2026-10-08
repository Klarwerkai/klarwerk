// ================================================================================================
// AUFNAHME 20260922 · GESAMT-SUCHINDEX-AKTUALITAET — DER VEKTORSPEICHER FOLGT DEM OBJEKT.
// ================================================================================================
//
// R-0470: „Die Neuindizierung läuft über eine Warteschlange statt sofort im Aufruf, der Index
// überlebt einen Neustart, und ein Objekt verschwindet aus dem Index, sobald seine Vertraulichkeit
// heraufgestuft wird." R-0483: „Ob Vektorspeicher und Suchprojektion das heute wirklich tun, ist
// ungeprüft."
//
// Gemessen wird die Vektorseite (der semantische Vorfilter der Textprüfung, hinter
// KLARWERK_DUP_PREFILTER):
//   N  der Nachlauf des KoService meldet JEDE gespeicherte Änderung samt Stand — keine gescheiterte;
//   R  der Reindex-Eintrag bettet neu ein oder entfernt den Vektor, je nach heutigem Stand;
//   Q  über die Warteschlange: der Aufruf ist fertig, während die Neuindizierung noch aussteht;
//   S  (Ben, Nacharbeit 3) Entfernen SOFORT bei Heraufstufung — bei blockierter Warteschlange am
//      echten Produktweg (`buildApp`) und während einer laufenden Einbettung;
//   W  (Ben, Nacharbeit 3) nach einem Neustart wird nachgeholt, was unterbrochen wurde.
// Der Erhalt der Vektoren über einen Neustart selbst liegt im dauerhaften Speicher und ist gegen
// echtes PostgreSQL in `vektorspeicher-pg.integration.test.ts` belegt.
import { afterEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import {
  indexKoForDuplicatePrefilter,
  nachfuehrungNachStart,
  reindexKoForDuplicatePrefilter,
  vektorBleibtFuer,
} from "../../services/app/src/duplicate-detection";
import { createReindexQueue } from "../../services/app/src/reindex-queue";
import {
  type EmbeddingProvider,
  type EmbeddingStore,
  InMemoryEmbeddingStore,
  stubEmbeddingProvider,
} from "../../services/embedding";
import {
  InMemoryKoRepo,
  InMemoryKoSearchProjectionRepo,
  InMemoryKoVersionRepo,
  type KnowledgeObject,
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

/** Ein Tor, das ein Test von aussen öffnet. */
function tor(): { warte: Promise<void>; oeffne: () => void } {
  let oeffne: () => void = () => undefined;
  const warte = new Promise<void>((r) => {
    oeffne = r;
  });
  return { warte, oeffne };
}

const ruhe = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

/**
 * Der Vorfilter der Prüfung: ein Stub-Embedder, der jeden eingebetteten Text aufzeichnet und an
 * einem Tor warten kann. Abfragen laufen über einen ZWEITEN, ungebremsten Stub derselben Version.
 */
function vorfilter(warte: Promise<void> = Promise.resolve()) {
  const basis = stubEmbeddingProvider();
  const texte: string[] = [];
  const embedder: EmbeddingProvider = {
    ...basis,
    embed: async (eingabe: string[]) => {
      texte.push(...eingabe);
      await warte;
      return basis.embed(eingabe);
    },
  };
  const store = new InMemoryEmbeddingStore();
  // Jede Ablage wird mitgezählt — „nichts geschrieben" ist eine eigene Aussage neben „nichts da".
  const geschrieben: string[] = [];
  const ablegen = store.upsert.bind(store);
  store.upsert = async (id, vector, version, stand) => {
    geschrieben.push(id);
    await ablegen(id, vector, version, stand);
  };
  return { semanticPrefilter: { embedder, store, topK: 25 }, store, texte, geschrieben };
}

async function belegt(store: EmbeddingStore): Promise<string[]> {
  return [...(await store.staende()).keys()].sort();
}

/** Der Nachlauf, wie build-app.ts ihn verdrahtet: sofort entziehen, dann einreihen. */
function nachlaufWieImProdukt(store: EmbeddingStore, enqueue: (id: string) => void) {
  return (koId: string, stand?: KnowledgeObject) => {
    if (stand && !vektorBleibtFuer(stand)) {
      void store.delete(koId);
    }
    enqueue(koId);
  };
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

  it("N4 · der Nachlauf trägt den GESPEICHERTEN Stand — eine Heraufstufung ist darin schon sichtbar", async () => {
    const { ko } = await stapel();
    const a = await ko.create({ ...EINGABE });
    const staende: (KnowledgeObject | undefined)[] = [];
    ko.setAenderungsNachlauf((_id, stand) => staende.push(stand));

    await ko.setConfidentiality(a.id, "vertraulich", "anna");
    await ko.delete(a.id, "anna");

    expect(staende.map((s) => s?.confidentiality)).toEqual(["vertraulich", "vertraulich"]);
    expect(staende[1]?.deletedAt).toBeTruthy();
    expect(staende.every((s) => !vektorBleibtFuer(s))).toBe(true);
  });
});

describe("Vektor-Nachführung · R — der Reindex-Eintrag", () => {
  it("R1 · nach einer Überarbeitung wird der NEUE Stand eingebettet und ersetzt den alten Vektor", async () => {
    const { ko } = await stapel();
    const v = vorfilter();
    const a = await ko.create({ ...EINGABE });
    await indexKoForDuplicatePrefilter(a, v.semanticPrefilter);
    const standAlt = await v.store.standVon(a.id);
    expect(v.texte.at(-1)).toContain("Kompressor K9");

    await ko.revise(a.id, { title: "Turbine T4", statement: "Lager monatlich schmieren." }, "anna");
    await reindexKoForDuplicatePrefilter(a.id, { ko, semanticPrefilter: v.semanticPrefilter });

    expect(v.texte.at(-1)).toContain("Turbine T4");
    expect(v.texte.at(-1)).not.toContain("Kompressor K9");
    // GENAU EIN Vektor für das Objekt — ersetzt, nicht ergänzt — und er trägt den neuen Stand.
    expect(await belegt(v.store)).toEqual([a.id]);
    expect(await v.store.standVon(a.id)).not.toBe(standAlt);
  });

  it("R2 · heraufgestuft, aufgegangen oder im Papierkorb ⇒ der nächste Eintrag entfernt den Vektor", async () => {
    const { ko } = await stapel();
    const v = vorfilter();
    const hoch = await ko.create({ ...EINGABE });
    const auf = await ko.create({ ...EINGABE });
    const korb = await ko.create({ ...EINGABE });
    const bleibt = await ko.create({ ...EINGABE, title: "Führend" });
    for (const k of [hoch, auf, korb, bleibt]) {
      await indexKoForDuplicatePrefilter(k, v.semanticPrefilter);
    }
    expect(await belegt(v.store)).toEqual([hoch.id, auf.id, korb.id, bleibt.id].sort());

    await ko.setConfidentiality(hoch.id, "vertraulich", "anna");
    await ko.markMergedInto(
      auf.id,
      { koId: bleibt.id, version: bleibt.version, overlapId: "ov-2" },
      "kurator",
      auf.version,
    );
    await ko.delete(korb.id, "anna");
    for (const id of [hoch.id, auf.id, korb.id]) {
      await reindexKoForDuplicatePrefilter(id, { ko, semanticPrefilter: v.semanticPrefilter });
    }

    expect(await belegt(v.store)).toEqual([bleibt.id]);
  });

  it("R3 · unveränderter Kerntext (etwa nach einer Bewertung) kostet keinen Embedder-Aufruf", async () => {
    const { ko } = await stapel();
    const v = vorfilter();
    const a = await ko.create({ ...EINGABE });
    await indexKoForDuplicatePrefilter(a, v.semanticPrefilter);
    expect(v.texte).toHaveLength(1);

    await reindexKoForDuplicatePrefilter(a.id, { ko, semanticPrefilter: v.semanticPrefilter });

    expect(v.texte).toHaveLength(1);
  });

  it("R4 · nachgeführt wird, was im Index steht — ein nie eingebettetes Objekt bleibt ohne Vektor", async () => {
    // Bulk-Import und Antwortwege betten bewusst nicht ein; eine spätere Änderung ändert das nicht.
    const { ko } = await stapel();
    const v = vorfilter();
    const importiert = await ko.create({ ...EINGABE, title: "Importiert, nie eingebettet" });

    await ko.revise(importiert.id, { statement: "Später überarbeitet." }, "anna");
    await reindexKoForDuplicatePrefilter(importiert.id, {
      ko,
      semanticPrefilter: v.semanticPrefilter,
    });

    expect(v.texte).toEqual([]);
    expect(await belegt(v.store)).toEqual([]);
  });
});

/** Eine Ablage mit veraltetem Stand — ohne Embedder, für Fälle, in denen das Tor ihn anhält. */
async function ablegenMitAltemStand(store: EmbeddingStore, id: string): Promise<void> {
  const { vectors, embeddingVersion } = await stubEmbeddingProvider().embed(["alt"]);
  await store.upsert(id, vectors[0] ?? [], embeddingVersion, "alt");
}

describe("Vektor-Nachführung · Q — über die Warteschlange, nicht im Aufruf", () => {
  it("Q1 · die Überarbeitung ist fertig, während die Neuindizierung noch aussteht", async () => {
    const { ko } = await stapel();
    const t = tor();
    const v = vorfilter(t.warte);
    const fehler: string[] = [];
    const queue = createReindexQueue({
      reindex: (id) =>
        reindexKoForDuplicatePrefilter(id, { ko, semanticPrefilter: v.semanticPrefilter }),
      onError: (id) => fehler.push(id),
    });
    const a = await ko.create({ ...EINGABE });
    await ablegenMitAltemStand(v.store, a.id);
    ko.setAenderungsNachlauf((id) => queue.enqueue(id));

    const revidiert = await ko.revise(
      a.id,
      { title: "Turbine T4", statement: "Lager monatlich schmieren." },
      "anna",
    );

    // Die Überarbeitung ist zurück — im Speicher steht noch der alte Stand.
    expect(revidiert.title).toBe("Turbine T4");
    expect(queue.queuedCount()).toBe(1);
    expect(await v.store.standVon(a.id)).toBe("alt");

    t.oeffne();
    await queue.idle();

    expect(await belegt(v.store)).toEqual([a.id]);
    expect(await v.store.standVon(a.id)).not.toBe("alt");
    expect(v.texte.at(-1)).toContain("Turbine T4");
    expect(fehler).toEqual([]);
  });
});

describe("Vektor-Nachführung · S — entfernen, sobald die Stufe steigt (Ben, Nacharbeit 3)", () => {
  const vorher = process.env.KLARWERK_DUP_PREFILTER;
  afterEach(() => {
    if (vorher === undefined) {
      delete process.env.KLARWERK_DUP_PREFILTER;
    } else {
      process.env.KLARWERK_DUP_PREFILTER = vorher;
    }
  });

  it("S1 · am echten Produktweg: die Warteschlange hängt an einem anderen Eintrag — der Vektor geht trotzdem sofort", async () => {
    process.env.KLARWERK_DUP_PREFILTER = "1";
    const innen = new InMemoryEmbeddingStore();
    const t = tor();
    let bremse: string | null = null;
    // Derselbe Speicher, nur dass der Eintrag für `bremse` beim Lesen seines Stands hängt — so steht
    // die serielle Schlange nachweislich, solange das Tor zu ist.
    const gebremst: EmbeddingStore = {
      upsert: (id, vector, version, stand) => innen.upsert(id, vector, version, stand),
      nearest: (q, version, k, ausser) => innen.nearest(q, version, k, ausser),
      delete: (id) => innen.delete(id),
      staende: () => innen.staende(),
      standVon: async (id) => {
        if (id === bremse) {
          await t.warte;
        }
        return innen.standVon(id);
      },
    };
    const services = buildServices();
    services.vektorSpeicher = gebremst;
    const app = buildApp(services);
    await app.ready();
    try {
      const ko = services.ko;
      const oeffentlich = await ko.create({ ...EINGABE, title: "Wird vertraulich" });
      const anderer = await ko.create({ ...EINGABE, title: "Hält die Schlange auf" });
      const { vectors, embeddingVersion } = await stubEmbeddingProvider().embed(["x"]);
      await innen.upsert(oeffentlich.id, vectors[0] ?? [], embeddingVersion, "alt");
      expect(await belegt(innen)).toContain(oeffentlich.id);

      // Die Schlange blockieren: ein Eintrag, der beim Lesen seines Stands hängt.
      bremse = anderer.id;
      await ko.revise(anderer.id, { statement: "Neue Aussage." }, "anna");
      await ruhe();

      await ko.setConfidentiality(oeffentlich.id, "vertraulich", "anna");

      // SOFORT entfernt — die Schlange steht noch am anderen Eintrag.
      expect(await innen.standVon(oeffentlich.id)).toBeUndefined();

      t.oeffne();
      await ruhe();
      expect(await belegt(innen)).not.toContain(oeffentlich.id);
    } finally {
      t.oeffne();
      await app.close();
    }
  });

  // S2/S2b rufen den Eintrag DIREKT und ohne Schlange: sonst räumte der Folgeeintrag der
  // Heraufstufung jeden falsch geschriebenen Vektor ohnehin weg, und der Fall bewiese nichts über
  // die laufende Einbettung selbst. Der Nachlauf entzieht nur sofort, wie im Produkt.
  it("S2 · eine LAUFENDE Einbettung schreibt nach der Heraufstufung keinen öffentlichen Stand mehr", async () => {
    const { ko } = await stapel();
    const t = tor();
    const v = vorfilter(t.warte);
    const a = await ko.create({ ...EINGABE });
    await ablegenMitAltemStand(v.store, a.id);
    v.geschrieben.length = 0;
    ko.setAenderungsNachlauf(nachlaufWieImProdukt(v.store, () => undefined));

    // Die Einbettung des öffentlichen Stands beginnt und wartet am Tor …
    const laufend = reindexKoForDuplicatePrefilter(a.id, {
      ko,
      semanticPrefilter: v.semanticPrefilter,
    });
    await ruhe();
    expect(v.texte.at(-1)).toContain("Kompressor K9");

    // … währenddessen steigt die Stufe.
    await ko.setConfidentiality(a.id, "vertraulich", "anna");
    t.oeffne();
    await laufend;

    expect(v.geschrieben).toEqual([]);
    expect(await belegt(v.store)).toEqual([]);
  });

  it("S2b · steigt die Stufe, während der Vektor gerade geschrieben wird, verschwindet er danach", async () => {
    const { ko } = await stapel();
    const v = vorfilter();
    const schreiben = tor();
    const a = await ko.create({ ...EINGABE });
    await ablegenMitAltemStand(v.store, a.id);
    ko.setAenderungsNachlauf(nachlaufWieImProdukt(v.store, () => undefined));
    // Das Schreiben selbst hängt: die Prüfung VOR dem Schreiben ist schon bestanden.
    const echt = v.store.upsert.bind(v.store);
    v.store.upsert = async (id, vector, version, stand) => {
      await schreiben.warte;
      await echt(id, vector, version, stand);
    };

    const laufend = reindexKoForDuplicatePrefilter(a.id, {
      ko,
      semanticPrefilter: v.semanticPrefilter,
    });
    await ruhe();
    // Der sofortige Entzug läuft VOR dem verspäteten Schreiben ins Leere …
    await ko.setConfidentiality(a.id, "vertraulich", "anna");
    schreiben.oeffne();
    await laufend;

    // … und die Prüfung NACH dem Schreiben räumt den eben geschriebenen Vektor wieder weg.
    expect(await belegt(v.store)).toEqual([]);
  });

  it("S3 · auch ein WARTENDER Eintrag hält die Entfernung nicht auf", async () => {
    const { ko } = await stapel();
    const t = tor();
    const v = vorfilter(t.warte);
    const vorne = await ko.create({ ...EINGABE, title: "Vorne in der Schlange" });
    const hinten = await ko.create({ ...EINGABE, title: "Hinten in der Schlange" });
    await ablegenMitAltemStand(v.store, vorne.id);
    await ablegenMitAltemStand(v.store, hinten.id);
    const queue = createReindexQueue({
      reindex: (id) =>
        reindexKoForDuplicatePrefilter(id, { ko, semanticPrefilter: v.semanticPrefilter }),
      onError: () => undefined,
    });
    ko.setAenderungsNachlauf(nachlaufWieImProdukt(v.store, (id) => queue.enqueue(id)));

    await ko.revise(vorne.id, { statement: "Läuft gerade." }, "anna");
    await ko.revise(hinten.id, { statement: "Wartet." }, "anna");
    await ruhe();
    expect(queue.queuedCount()).toBe(2);

    await ko.setConfidentiality(hinten.id, "vertraulich", "anna");

    expect(await v.store.standVon(hinten.id)).toBeUndefined();
    t.oeffne();
    await queue.idle();
    expect(await belegt(v.store)).toEqual([vorne.id]);
  });
});

describe("Vektor-Nachführung · W — nach einem Neustart wird nachgeholt (Ben, Nacharbeit 3)", () => {
  it("W1 · der Abgleich beim Start reiht genau die unterbrochenen Fälle ein — und die Schlange heilt sie", async () => {
    const { ko } = await stapel();
    const v = vorfilter();
    const passt = await ko.create({ ...EINGABE, title: "Unverändert" });
    const veraltet = await ko.create({ ...EINGABE, title: "Vor dem Neustart überarbeitet" });
    const hoch = await ko.create({ ...EINGABE, title: "Vor dem Neustart heraufgestuft" });
    const korb = await ko.create({ ...EINGABE, title: "Vor dem Neustart zurückgezogen" });
    const ohne = await ko.create({ ...EINGABE, title: "Nie eingebettet" });
    for (const k of [passt, veraltet, hoch, korb]) {
      await indexKoForDuplicatePrefilter(k, v.semanticPrefilter);
    }
    const standVorher = await v.store.standVon(veraltet.id);
    // „Absturz": diese Änderungen erreichen keine Schlange mehr (kein Nachlauf verdrahtet).
    await ko.revise(veraltet.id, { statement: "Geändert vor dem Neustart." }, "anna");
    await ko.setConfidentiality(hoch.id, "vertraulich", "anna");
    await ko.delete(korb.id, "anna");

    const eingereiht: string[] = [];
    const zahl = await nachfuehrungNachStart({
      ko,
      store: v.store,
      enqueue: (id) => eingereiht.push(id),
    });

    expect(zahl).toBe(3);
    expect(eingereiht.sort()).toEqual([veraltet.id, hoch.id, korb.id].sort());
    // Weder das passende noch das nie eingebettete Objekt (Import-Regel, R4).
    expect(eingereiht).not.toContain(passt.id);
    expect(eingereiht).not.toContain(ohne.id);

    for (const id of eingereiht) {
      await reindexKoForDuplicatePrefilter(id, { ko, semanticPrefilter: v.semanticPrefilter });
    }
    expect(await belegt(v.store)).toEqual([passt.id, veraltet.id].sort());
    expect(await v.store.standVon(veraltet.id)).not.toBe(standVorher);
    // Ein zweiter Abgleich findet nichts mehr: alles passt.
    expect(await nachfuehrungNachStart({ ko, store: v.store, enqueue: () => undefined })).toBe(0);
  });
});
