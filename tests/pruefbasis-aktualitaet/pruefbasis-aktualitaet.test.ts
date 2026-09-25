// AUFNAHME 20260922 · PRÜFBASIS-AKTUALITÄT — Prüfnachweise an ihre Quellen- und Kontextbasis binden.
//
// Entscheidung: docs/entscheidungen/pruefbasis-aktualitaet.md (globale Basisbindung je Nachweis,
// keine selektive Wiederverwendung). Die Fälle folgen den fünf Kriterien der Aufnahme:
//   K1  Regel und Geltungsbereich — jede Basisänderung macht überholt, Ablauffelder nicht.
//   K2  Änderung von Quelle bzw. Kontext macht einen FERTIGEN alten Nachweis sichtbar überholt.
//   K3  Abruf und Wiederholung reihen den neuen Lauf ohne Doppelauftrag ein; bis zum Abschluss
//       erscheint der alte Stand nicht als aktuell.
//   K4  Änderung zwischen Start und Ergebnis verhindert ein scheinbar aktuelles Ergebnis; gleicher
//       Text allein genügt nicht.
//   K5  Persistenz, Reload und Anzeige benutzen dieselbe gespeicherte Bindung; Rechte bleiben.
// Runde 2 (bens Befunde): Vergleichsquellen im echten Runner (K4), unbelegter Altbestand (K2/K3),
// serverseitige Antwortbewertung (K2) und der Suchkandidatenweg (K5).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { aiCheckCardState } from "../../apps/web/src/lib/aiCheckStatusCard";
import { answerCheckState } from "../../apps/web/src/lib/askView";
import {
  type AiCheckRunOutcome,
  type AiCheckWorker,
  createAiCheckRunner,
  createAiCheckWorker,
  shouldReEnqueueAiCheck,
} from "../../services/app/src/ai-check-worker";
import { type AppServices, buildApp, buildServices } from "../../services/app/src/build-app";
import { answerEvidence, answerCheckState as serverZustand } from "../../services/ask";
import {
  InMemoryKoRepo,
  InMemoryKoSearchProjectionRepo,
  InMemoryKoVersionRepo,
  type KnowledgeObject,
  KoService,
  pruefbasisVon,
} from "../../services/knowledge-object";
import { bestandsStempelVon } from "../../services/knowledge-object/src/pruefbasis";
import type { ConflictJudgeOutcome, DuplicateJudgeOutcome } from "../../services/reasoner";

const leiseLog = (): void => {};

function neuerDienst(repo = new InMemoryKoRepo()): { repo: InMemoryKoRepo; ko: KoService } {
  return { repo, ko: new KoService({ repo }) };
}

async function anlegen(ko: KoService, title: string, statement: string): Promise<KnowledgeObject> {
  return ko.create({
    title,
    statement,
    type: "best_practice",
    category: "K",
    tags: ["a", "b"],
    author: "pedi",
  });
}

async function objektMitFertigemNachweis(
  ko: KoService,
  title = "Pruefbasis",
): Promise<KnowledgeObject> {
  const created = await anlegen(
    ko,
    title,
    "Eine Aussage, deren Pruefung an ihre Basis gebunden ist.",
  );
  expect(await ko.markAiCheckPending(created.id)).toBe(true);
  const start = (await ko.get(created.id)) as KnowledgeObject;
  expect(
    await ko.resolveAiCheck(
      created.id,
      { ok: true },
      start.aiCheck?.koVersion,
      await ko.aktuellePruefbasis(start),
    ),
  ).toBe(true);
  const fertig = await ko.get(created.id);
  expect(fertig?.aiCheck?.status).toBe("done");
  expect(fertig?.aiCheck?.ueberholt, "frisch abgeschlossen ist nicht überholt").toBeUndefined();
  return fertig as KnowledgeObject;
}

describe("K1 · die Regel: globale Basisbindung, Ablauffelder sind keine Basis", () => {
  const basis: KnowledgeObject = {
    id: "k1",
    version: 3,
    sources: [{ id: "s1" }, { id: "s2" }],
    attachments: [{ id: "f1" }],
    category: "K",
    tags: ["a", "b"],
    asset: null,
    confidentiality: "intern",
  } as unknown as KnowledgeObject;

  it("jede Änderung von Quelle oder Kontext ändert die Basis", () => {
    const b0 = pruefbasisVon(basis, "B");
    const quelleGeaendert: Partial<KnowledgeObject>[] = [
      { version: 4 },
      { sources: [{ id: "s1" }] as KnowledgeObject["sources"] },
      { attachments: [] },
    ];
    for (const aenderung of quelleGeaendert) {
      const b = pruefbasisVon({ ...basis, ...aenderung }, "B");
      expect(b.quelle, JSON.stringify(aenderung)).not.toBe(b0.quelle);
      expect(b.kontext).toBe(b0.kontext);
    }
    const kontextGeaendert: Partial<KnowledgeObject>[] = [
      { category: "L" },
      { tags: ["a"] },
      { asset: "Anlage 7" },
      { confidentiality: "vertraulich" },
    ];
    for (const aenderung of kontextGeaendert) {
      const b = pruefbasisVon({ ...basis, ...aenderung }, "B");
      expect(b.kontext, JSON.stringify(aenderung)).not.toBe(b0.kontext);
      expect(b.quelle).toBe(b0.quelle);
    }
  });

  it("der Bestandsteil folgt den Vergleichsquellen: Fassung, Einordnung, Zugang, Abgang", () => {
    const b = { ...basis, id: "k2" } as KnowledgeObject;
    const s0 = bestandsStempelVon([basis, b]);
    expect(bestandsStempelVon([basis, { ...b, version: 4 }]), "neue Fassung").not.toBe(s0);
    expect(bestandsStempelVon([basis, { ...b, tags: ["z"] }]), "Einordnung").not.toBe(s0);
    expect(bestandsStempelVon([basis]), "Abgang").not.toBe(s0);
    expect(
      bestandsStempelVon([basis, b, { ...basis, id: "k3" } as KnowledgeObject]),
      "Zugang",
    ).not.toBe(s0);
    expect(bestandsStempelVon([basis, { ...b, deletedAt: "x" }]), "Papierkorb = Abgang").toBe(
      bestandsStempelVon([basis]),
    );
    expect(
      bestandsStempelVon([basis, { ...b, demoSeed: true }]),
      "Demo gehört nicht zum Pool",
    ).toBe(bestandsStempelVon([basis]));
  });

  it("Reihenfolge und Ablauffelder (Status, Vertrauen, Nachweis) ändern die Basis NICHT", () => {
    const b0 = pruefbasisVon(basis, "B");
    const umsortiert = {
      ...basis,
      tags: ["b", "a"],
      sources: [{ id: "s2" }, { id: "s1" }],
      status: "validiert",
      trust: 99,
    } as unknown as KnowledgeObject;
    expect(pruefbasisVon(umsortiert, "B")).toEqual(b0);
    const s0 = bestandsStempelVon([basis]);
    expect(
      bestandsStempelVon([
        { ...basis, status: "offen", trust: 1, aiCheck: { status: "done", requestedAt: "x" } },
      ] as KnowledgeObject[]),
    ).toBe(s0);
  });
});

describe("K2 · eine Änderung macht den fertigen Nachweis sichtbar überholt", () => {
  it("Einordnung (Schlagworte) ohne Versionssprung → überholt, gezählt als unvollständig", async () => {
    const { ko } = neuerDienst();
    const fertig = await objektMitFertigemNachweis(ko);
    await ko.updateTags(fertig.id, ["a", "c"], "pedi");
    const gelesen = await ko.get(fertig.id);
    expect(gelesen?.version, "kein Versionssprung").toBe(fertig.version);
    expect(gelesen?.aiCheck?.status).toBe("done");
    expect(gelesen?.aiCheck?.ueberholt).toBe(true);
    expect((await ko.list()).find((k) => k.id === fertig.id)?.aiCheck?.ueberholt).toBe(true);
    const summary = await ko.aiCheckCoverageSummary({ sichtbar: () => true });
    expect(summary.incomplete).toBe(1);
  });

  it("Vertraulichkeit und Kategorie → überholt; auch der Rückgabewert der Änderung sagt es", async () => {
    const { ko } = neuerDienst();
    const a = await objektMitFertigemNachweis(ko);
    const nachStufe = await ko.setConfidentiality(a.id, "vertraulich", "pedi");
    expect(nachStufe.aiCheck?.ueberholt).toBe(true);
    expect((await ko.get(a.id))?.aiCheck?.ueberholt).toBe(true);
    const { ko: ko2 } = neuerDienst();
    const b = await objektMitFertigemNachweis(ko2);
    const nachKategorie = await ko2.updateCategory(b.id, "Neu", "pedi");
    expect(nachKategorie.aiCheck?.ueberholt).toBe(true);
    expect((await ko2.get(b.id))?.aiCheck?.ueberholt).toBe(true);
  });

  it("neue Fassung mit ZEICHENGLEICHEM Inhalt → überholt (gleicher Text genügt nicht)", async () => {
    const { ko } = neuerDienst();
    const fertig = await objektMitFertigemNachweis(ko);
    const revidiert = await ko.revise(
      fertig.id,
      { title: fertig.title, statement: fertig.statement },
      "pedi",
    );
    expect(revidiert.aiCheck?.ueberholt, "Rückgabe der Überarbeitung").toBe(true);
    const gelesen = await ko.get(fertig.id);
    expect(gelesen?.title).toBe(fertig.title);
    expect(gelesen?.statement).toBe(fertig.statement);
    expect(gelesen?.version).toBe(fertig.version + 1);
    expect(gelesen?.aiCheck?.ueberholt).toBe(true);
  });

  it("bens Befund 1 · eine VERGLEICHSQUELLE ändert sich nach dem Lauf → der Nachweis ist überholt", async () => {
    const { ko } = neuerDienst();
    const vergleich = await anlegen(ko, "Vergleich", "Die Pumpe wird monatlich entlueftet.");
    const fertig = await objektMitFertigemNachweis(ko);
    // Gleicher Text der Vergleichsquelle, nur eine neue Fassung — genügt.
    await ko.revise(vergleich.id, { statement: vergleich.statement }, "pedi");
    expect((await ko.get(fertig.id))?.aiCheck?.ueberholt).toBe(true);
    const { ko: ko2 } = neuerDienst();
    await objektMitFertigemNachweis(ko2, "Erster");
    const zweiter = await objektMitFertigemNachweis(ko2, "Zweiter");
    // Ein Zugang zum Vergleichsbestand ändert den Auswahlkontext.
    await anlegen(ko2, "Neu", "Ein neues Objekt im Pool.");
    expect((await ko2.get(zweiter.id))?.aiCheck?.ueberholt).toBe(true);
  });

  it("die Anzeige-Libs lesen überholt nie als aktuell", () => {
    const ueberholt = {
      status: "done" as const,
      requestedAt: "2026-09-22T00:00:00.000Z",
      coverage: {
        available: 1,
        selected: 1,
        alreadyOpen: 0,
        attempted: 1,
        completed: 1,
        skipped: 0,
        capped: false,
        aborted: false,
      },
      ueberholt: true,
    };
    expect(aiCheckCardState(ueberholt)).toEqual({ kind: "outdated" });
    expect(aiCheckCardState({ ...ueberholt, status: "failed" })).toEqual({ kind: "outdated" });
    expect(answerCheckState({ aiCheck: ueberholt } as never)).toBe("incomplete");
    expect(answerCheckState({ aiCheck: { ...ueberholt, ueberholt: undefined } } as never)).toBe(
      "proven",
    );
  });

  it("bens Befund 3 · die SERVERSEITIGE Antwortbewertung liest den frisch gelesenen überholten Nachweis", async () => {
    const { ko } = neuerDienst();
    const fertig = await objektMitFertigemNachweis(ko);
    await ko.recordAiCheckOutcome(fertig.id, {
      ok: true,
      coverage: {
        available: 0,
        selected: 0,
        alreadyOpen: 0,
        attempted: 0,
        completed: 0,
        skipped: 0,
        capped: false,
        aborted: false,
      },
    });
    const vorher = (await ko.get(fertig.id)) as KnowledgeObject;
    expect(serverZustand(vorher), "Kalibrierung: belegt ist gesichert").toBe("proven");
    await ko.updateTags(fertig.id, ["neu"], "pedi");
    const gelesen = (await ko.get(fertig.id)) as KnowledgeObject;
    expect(gelesen.aiCheck?.ueberholt).toBe(true);
    expect(serverZustand(gelesen)).toBe("incomplete");
    expect(serverZustand(gelesen)).toBe(answerCheckState(gelesen as never));
    const evidenz = answerEvidence({
      answer: {
        answered: true,
        knowledgeClass: "gesichert",
        sources: [gelesen.id],
        citedSources: [gelesen.id],
      },
      sourceKos: new Map([[gelesen.id, gelesen]]),
      openConflicts: [],
    });
    expect(evidenz.grade).toBe("unverified");
    expect(evidenz.knowledgeClass).toBe("ungeprueft");
    expect(evidenz.checkCaveat?.reason).toBe("incomplete");
  });

  it("bens Befund 2 · unbelegter Altbestand ist überholt — mit und ohne Fassungsbindung", async () => {
    const { repo, ko } = neuerDienst();
    const created = await anlegen(ko, "Alt", "Altbestand");
    await repo.setAiCheck(created.id, { status: "done", requestedAt: "x", koVersion: 1 });
    expect((await ko.get(created.id))?.aiCheck?.ueberholt).toBe(true);
    await repo.setAiCheck(created.id, { status: "done", requestedAt: "x" });
    expect((await ko.get(created.id))?.aiCheck?.ueberholt).toBe(true);
    await repo.setAiCheck(created.id, { status: "failed", requestedAt: "x", fallbackReason: "x" });
    expect((await ko.get(created.id))?.aiCheck?.ueberholt).toBe(true);
    // Ein laufender Vermerk ist nie „überholt" — er gilt ohnehin nicht als aktuell.
    await repo.setAiCheck(created.id, { status: "pending", requestedAt: "x" });
    expect((await ko.get(created.id))?.aiCheck?.ueberholt).toBeUndefined();
  });
});

// Fake-Reasoner mit AKTIVEM Modell; `beimUrteil` läuft bei jedem Urteil VOR der Antwort.
function kontrollierterJudge(beimUrteil: () => Promise<void>): AppServices["reasoner"] {
  return {
    status: () => ({ active: true, provider: "fake-model", mode: "model" }),
    judgeConflictOutcome: async (): Promise<ConflictJudgeOutcome> => {
      await beimUrteil();
      return {
        verdict: {
          relation: "kein_konflikt",
          older: null,
          confidence: 0.9,
          begruendung: "Kein Widerspruch",
          zitat_a: "",
          zitat_b: "",
        },
      };
    },
    judgeDuplicateOutcome: async (): Promise<DuplicateJudgeOutcome> => {
      await beimUrteil();
      return {
        verdict: {
          beziehung: "verschieden",
          aspects: [],
          nurInA: "",
          nurInB: "",
          empfehlung: "getrennt_lassen",
          confidence: 0.9,
          begruendung: "Verschiedene Aussagen",
        },
      };
    },
  } as unknown as AppServices["reasoner"];
}

describe("K4 · Änderung zwischen Start und Ergebnis", () => {
  it("Basisänderung während des Laufs → kein Ergebnis eingetragen, frischer Lauf für die neue Basis", async () => {
    const { ko } = neuerDienst();
    const fertig = await objektMitFertigemNachweis(ko);
    await ko.markAiCheckPending(fertig.id);
    let laeufe = 0;
    const worker = createAiCheckWorker({
      ko,
      log: leiseLog,
      run: async (id): Promise<AiCheckRunOutcome> => {
        laeufe += 1;
        if (laeufe === 1) {
          // Mitten im ersten Lauf: gleicher Text, gleiche Fassung — nur die Einordnung wandert.
          await ko.updateTags(id, ["neu"], "pedi");
        }
        return { ok: true };
      },
    });
    worker.enqueue(fertig.id, fertig.version);
    await worker.idle();
    expect(laeufe, "der alte Lauf trägt nichts ein, ein frischer läuft").toBe(2);
    const gelesen = (await ko.get(fertig.id)) as KnowledgeObject;
    expect(gelesen.aiCheck?.status).toBe("done");
    expect(gelesen.aiCheck?.ueberholt).toBeUndefined();
    expect(gelesen.aiCheck?.basis).toEqual(await ko.aktuellePruefbasis(gelesen));
  });

  it("bens Befund 1 · echter Runner: die Vergleichsquelle wird WÄHREND des Urteils neu gefasst", async () => {
    let geaendert = false;
    let urteile = 0;
    const services = buildServices();
    let vergleichId = "";
    services.reasoner = kontrollierterJudge(async () => {
      urteile += 1;
      if (!geaendert) {
        geaendert = true;
        // Der Judge hat Fassung 1 gelesen; jetzt wird die Vergleichsquelle Fassung 2 — mit
        // ZEICHENGLEICHEM Inhalt.
        const b = (await services.ko.get(vergleichId)) as KnowledgeObject;
        await services.ko.revise(vergleichId, { statement: b.statement }, "pedi");
      }
    });
    const vergleich = await anlegen(
      services.ko,
      "Pumpe entlueften",
      "Die Pumpe P4 wird vor dem Start entlueftet und monatlich geprueft.",
    );
    vergleichId = vergleich.id;
    const subjekt = await anlegen(
      services.ko,
      "Pumpe P4 pruefen",
      "Die Pumpe P4 wird vor dem Start geprueft und monatlich entlueftet.",
    );
    await services.ko.markAiCheckPending(subjekt.id);
    let laeufe = 0;
    const runner = createAiCheckRunner(services);
    const worker = createAiCheckWorker({
      ko: services.ko,
      log: leiseLog,
      run: async (id) => {
        laeufe += 1;
        return runner(id);
      },
    });
    worker.enqueue(subjekt.id, subjekt.version);
    await worker.idle();
    expect(urteile, "der Judge wurde wirklich gefragt").toBeGreaterThan(0);
    expect((await services.ko.get(vergleichId))?.version, "Vergleichsquelle neu gefasst").toBe(2);
    expect(laeufe, "der Lauf über Fassung 1 trägt nichts ein, ein frischer läuft").toBe(2);
    const gelesen = (await services.ko.get(subjekt.id)) as KnowledgeObject;
    expect(gelesen.aiCheck?.status).toBe("done");
    expect(gelesen.aiCheck?.ueberholt).toBeUndefined();
    expect(gelesen.aiCheck?.basis).toEqual(await services.ko.aktuellePruefbasis(gelesen));
  });

  it("das Ergebnis ist an die START-Basis gebunden: später geschrieben heißt nicht aktuell", async () => {
    const { ko } = neuerDienst();
    const fertig = await objektMitFertigemNachweis(ko);
    await ko.markAiCheckPending(fertig.id);
    const start = (await ko.get(fertig.id)) as KnowledgeObject;
    const startBasis = await ko.aktuellePruefbasis(start);
    // Die Änderung fällt in das Restfenster NACH der Probe des Workers, vor dem Schreiben.
    await ko.addSource(fertig.id, "pedi", { label: "Neue Quelle", url: "https://example.org/q" });
    expect(
      await ko.resolveAiCheck(fertig.id, { ok: true }, start.aiCheck?.koVersion, startBasis),
    ).toBe(true);
    const gelesen = await ko.get(fertig.id);
    expect(gelesen?.aiCheck?.status).toBe("done");
    expect(gelesen?.aiCheck?.ueberholt, "done, aber für die alte Basis").toBe(true);
  });
});

describe("K5 · Persistenz, Reload und Anzeige lesen dieselbe gespeicherte Bindung", () => {
  it("gespeichert wird die Basis, nie der abgeleitete Merker; ein neuer Dienst liest dasselbe", async () => {
    const { repo, ko } = neuerDienst();
    const fertig = await objektMitFertigemNachweis(ko);
    const roh = await repo.findById(fertig.id);
    expect(roh?.aiCheck?.basis).toEqual(await ko.aktuellePruefbasis(fertig));
    await ko.updateTags(fertig.id, ["x"], "pedi");
    const rohDanach = await repo.findById(fertig.id);
    expect(rohDanach?.aiCheck?.ueberholt, "der Merker wird nie gespeichert").toBeUndefined();
    const neuGeladen = new KoService({ repo });
    expect((await neuGeladen.get(fertig.id))?.aiCheck?.ueberholt).toBe(true);
    // Auch ein versehentlich gespeicherter Merker wird nicht geglaubt, sondern neu abgeleitet.
    await repo.setAiCheck(fertig.id, {
      ...(rohDanach?.aiCheck as NonNullable<KnowledgeObject["aiCheck"]>),
      basis: await neuGeladen.aktuellePruefbasis(
        (await repo.findById(fertig.id)) as KnowledgeObject,
      ),
      ueberholt: true,
    });
    expect((await neuGeladen.get(fertig.id))?.aiCheck?.ueberholt).toBeUndefined();
  });

  it("der Bestandsstempel folgt dem Schreibstand: gemerkt, solange niemand schreibt", async () => {
    const { ko } = neuerDienst();
    const fertig = await objektMitFertigemNachweis(ko);
    const s1 = await ko.pruefbestandStempel();
    expect(await ko.pruefbestandStempel()).toBe(s1);
    // Ein Ablaufschreiben (Vertrauenswert) erhöht den Schreibstand, ändert den Stempel aber nicht.
    await ko.bumpTrust(fertig.id, 5, 99);
    expect(await ko.pruefbestandStempel()).toBe(s1);
    expect((await ko.get(fertig.id))?.aiCheck?.ueberholt).toBeUndefined();
    await ko.updateTags(fertig.id, ["y"], "pedi");
    expect(await ko.pruefbestandStempel()).not.toBe(s1);
  });

  it("bens Befund 4 · der Suchkandidatenweg (findCandidates) liefert dieselbe Lesefassung", async () => {
    const repo = new InMemoryKoRepo();
    const ko = new KoService({
      repo,
      versions: new InMemoryKoVersionRepo(),
      searchProjections: new InMemoryKoSearchProjectionRepo(repo),
    });
    const { readiness } = await ko.activateSearchProjectionV2();
    expect(readiness.alle, readiness.befunde.join("; ")).toBe(true);
    const fertig = await objektMitFertigemNachweis(ko, "Kreiselpumpe");
    const suche = () => ko.findCandidates({ terms: ["kreiselpumpe"], limit: 10 });
    expect(
      (await suche()).map((k) => k.id),
      "Kalibrierung: der Kandidat wird gefunden",
    ).toEqual([fertig.id]);
    expect((await suche())[0]?.aiCheck?.ueberholt).toBeUndefined();
    await ko.updateTags(fertig.id, ["neu"], "pedi");
    const [kandidat] = await suche();
    expect(kandidat?.aiCheck?.ueberholt).toBe(true);
    expect(kandidat?.aiCheck?.ueberholt).toBe((await ko.get(fertig.id))?.aiCheck?.ueberholt);
    expect((await ko.listForSearch()).find((k) => k.id === fertig.id)?.aiCheck?.ueberholt).toBe(
      true,
    );
  });

  it("Quelltext-Pin: das Badge zeigt überholt vor done/failed, Texte in DE/EN/NL", () => {
    const badge = readFileSync(
      resolve(__dirname, "../../apps/web/src/components/AiCheckBadge.tsx"),
      "utf8",
    );
    expect(badge.indexOf("aiCheck.ueberholt")).toBeGreaterThan(-1);
    expect(badge.indexOf("aiCheck.ueberholt")).toBeLessThan(badge.indexOf('status === "done"'));
    const texte = readFileSync(
      resolve(__dirname, "../../apps/web/src/texte/pruefbasis.ts"),
      "utf8",
    );
    expect(texte.match(/"pruefbasis\.ueberholt":/g)?.length).toBe(3);
    expect(texte.match(/"pruefbasis\.ueberholtHinweis":/g)?.length).toBe(3);
  });
});

async function appMitNutzer(mutate?: (s: AppServices) => void) {
  const services = buildServices();
  mutate?.(services);
  const app = buildApp(services);
  const einloggen = async (email: string) => {
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: "secret123" },
    });
    return { authorization: `Bearer ${login.json().token}` };
  };
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "p@x.de", password: "secret123" },
  });
  const headers = await einloggen("p@x.de");
  // Eine Leserin ohne `ko.validate`, angelegt von der Verwaltung (erste Person = Admin).
  const leserin = async () => {
    await app.inject({
      method: "POST",
      url: "/api/users",
      headers,
      payload: { name: "Vera", email: "vera@x.de", password: "secret123", role: "viewer" },
    });
    return einloggen("vera@x.de");
  };
  return { app, services, headers, leserin };
}

function zaehlenderWorker(s: AppServices, tor: Promise<void>, zaehler: { laeufe: number }) {
  return createAiCheckWorker({
    ko: s.ko,
    log: leiseLog,
    run: async () => {
      zaehler.laeufe += 1;
      await tor;
      return { ok: true };
    },
  });
}

describe("K3 · Abruf und Wiederholung reihen den neuen Lauf ein — ohne Doppelauftrag", () => {
  it("shouldReEnqueueAiCheck: überholt abgeschlossen → ja; laufend → nein", () => {
    const now = Date.now();
    const iso = new Date(now).toISOString();
    expect(shouldReEnqueueAiCheck({ status: "done", requestedAt: iso, ueberholt: true }, now)).toBe(
      true,
    );
    expect(
      shouldReEnqueueAiCheck({ status: "failed", requestedAt: iso, ueberholt: true }, now),
    ).toBe(true);
    expect(shouldReEnqueueAiCheck({ status: "done", requestedAt: iso }, now)).toBe(false);
    expect(shouldReEnqueueAiCheck({ status: "pending", requestedAt: iso }, now)).toBe(false);
  });

  it("Board-Abruf: überholter Nachweis → genau EIN neuer Lauf, Antwort zeigt ihn als laufend", async () => {
    const zaehler = { laeufe: 0 };
    let freigeben: () => void = () => {};
    const tor = new Promise<void>((r) => {
      freigeben = r;
    });
    let worker: AiCheckWorker | undefined;
    const { app, services, headers } = await appMitNutzer((s) => {
      worker = zaehlenderWorker(s, tor, zaehler);
      s.aiCheckWorker = worker;
    });
    if (!worker) {
      throw new Error("Worker nicht verdrahtet");
    }
    const fertig = await objektMitFertigemNachweis(services.ko);
    await services.ko.updateTags(fertig.id, ["neu"], "pedi");
    expect((await services.ko.get(fertig.id))?.aiCheck?.ueberholt).toBe(true);

    const board1 = await app.inject({ method: "GET", url: "/api/validation/board", headers });
    expect(board1.statusCode).toBe(200);
    const zeile = (board1.json() as KnowledgeObject[]).find((k) => k.id === fertig.id);
    expect(zeile?.aiCheck?.status, "der alte Stand erscheint nicht als aktuell").toBe("pending");
    expect(zeile?.aiCheck?.ueberholt).toBeUndefined();
    // Zweiter Abruf und Wiederholung WÄHREND des Laufs: kein Doppelauftrag.
    await app.inject({ method: "GET", url: "/api/validation/board", headers });
    const retry = await app.inject({
      method: "POST",
      url: `/api/kos/${fertig.id}/ai-check`,
      headers,
    });
    expect(retry.statusCode).toBe(200);
    expect(worker.queuedCount()).toBe(1);
    freigeben();
    await worker.idle();
    expect(zaehler.laeufe).toBe(1);
    const gelesen = await services.ko.get(fertig.id);
    expect(gelesen?.aiCheck?.status).toBe("done");
    expect(gelesen?.aiCheck?.ueberholt).toBeUndefined();
  });

  it("bens Befund 2 · Altbestand ohne Basis nach Kategorieänderung: Abruf reiht ein, Wiederholung gilt", async () => {
    const zaehler = { laeufe: 0 };
    let freigeben: () => void = () => {};
    const tor = new Promise<void>((r) => {
      freigeben = r;
    });
    let worker: AiCheckWorker | undefined;
    const { app, services, headers } = await appMitNutzer((s) => {
      worker = zaehlenderWorker(s, tor, zaehler);
      s.aiCheckWorker = worker;
    });
    if (!worker) {
      throw new Error("Worker nicht verdrahtet");
    }
    const alt = await anlegen(services.ko, "Altbestand", "Ein Nachweis von vor der Basisbindung.");
    // Altbestand: fertig, mit Fassung, aber OHNE gespeicherte Basis — direkt in die Ablage.
    const koRepo = (services.ko as unknown as { repo: InMemoryKoRepo }).repo;
    await koRepo.setAiCheck(alt.id, { status: "done", requestedAt: "x", koVersion: alt.version });
    await services.ko.updateCategory(alt.id, "Neu", "pedi");
    const board = await app.inject({ method: "GET", url: "/api/validation/board", headers });
    expect(board.statusCode).toBe(200);
    const zeile = (board.json() as KnowledgeObject[]).find((k) => k.id === alt.id);
    expect(zeile?.aiCheck?.status, "nicht mehr als fertig und aktuell").toBe("pending");
    expect(worker.queuedCount(), "genau ein Lauf eingereiht").toBe(1);
    // Die Wiederholung weist nicht ab (kein AI_CHECK_NOT_RETRYABLE) und reiht nicht doppelt ein.
    const retry = await app.inject({ method: "POST", url: `/api/kos/${alt.id}/ai-check`, headers });
    expect(retry.statusCode).toBe(200);
    expect(worker.queuedCount()).toBe(1);
    freigeben();
    await worker.idle();
    expect(zaehler.laeufe).toBe(1);
    const gelesen = (await services.ko.get(alt.id)) as KnowledgeObject;
    expect(gelesen.aiCheck?.status).toBe("done");
    expect(gelesen.aiCheck?.ueberholt).toBeUndefined();
    expect(gelesen.aiCheck?.basis).toEqual(await services.ko.aktuellePruefbasis(gelesen));
  });

  it("bens Befund 2 · Wiederholung eines unbelegten Altnachweises ohne vorherigen Abruf", async () => {
    const { app, services, headers } = await appMitNutzer();
    const alt = await anlegen(services.ko, "Altbestand", "Ein Nachweis von vor der Basisbindung.");
    const koRepo = (services.ko as unknown as { repo: InMemoryKoRepo }).repo;
    await koRepo.setAiCheck(alt.id, { status: "done", requestedAt: "x", koVersion: alt.version });
    const retry = await app.inject({ method: "POST", url: `/api/kos/${alt.id}/ai-check`, headers });
    expect(retry.statusCode).toBe(200);
    await services.aiCheckWorker?.idle();
    const gelesen = (await services.ko.get(alt.id)) as KnowledgeObject;
    expect(gelesen.aiCheck?.basis).toEqual(await services.ko.aktuellePruefbasis(gelesen));
    expect(gelesen.aiCheck?.ueberholt).toBeUndefined();
  });

  it("Wiederholung: überholt → 200 und neuer Lauf; aktuell done → weiter 409; ohne Recht → 403", async () => {
    const { app, services, headers, leserin } = await appMitNutzer();
    const fertig = await objektMitFertigemNachweis(services.ko);
    const aktuell = await app.inject({
      method: "POST",
      url: `/api/kos/${fertig.id}/ai-check`,
      headers,
    });
    expect(aktuell.statusCode).toBe(409);
    await services.ko.setConfidentiality(fertig.id, "vertraulich", "pedi");
    const fremd = await leserin();
    const ohneRecht = await app.inject({
      method: "POST",
      url: `/api/kos/${fertig.id}/ai-check`,
      headers: fremd,
    });
    expect(ohneRecht.statusCode).toBe(403);
    expect((await services.ko.get(fertig.id))?.aiCheck?.ueberholt, "unverändert überholt").toBe(
      true,
    );
    const retry = await app.inject({
      method: "POST",
      url: `/api/kos/${fertig.id}/ai-check`,
      headers,
    });
    expect(retry.statusCode).toBe(200);
    await services.aiCheckWorker?.idle();
    const gelesen = (await services.ko.get(fertig.id)) as KnowledgeObject;
    expect(gelesen.aiCheck?.status === "pending").toBe(false);
    expect(gelesen.aiCheck?.ueberholt).toBeUndefined();
    expect(gelesen.aiCheck?.basis).toEqual(await services.ko.aktuellePruefbasis(gelesen));
  });
});
