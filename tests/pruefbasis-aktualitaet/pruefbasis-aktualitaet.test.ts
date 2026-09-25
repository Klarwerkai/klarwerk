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
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { aiCheckCardState } from "../../apps/web/src/lib/aiCheckStatusCard";
import { answerCheckState } from "../../apps/web/src/lib/askView";
import {
  type AiCheckRunOutcome,
  type AiCheckWorker,
  createAiCheckWorker,
  shouldReEnqueueAiCheck,
} from "../../services/app/src/ai-check-worker";
import { type AppServices, buildApp, buildServices } from "../../services/app/src/build-app";
import {
  InMemoryKoRepo,
  type KnowledgeObject,
  KoService,
  pruefbasisVon,
} from "../../services/knowledge-object";

const leiseLog = (): void => {};

function neuerDienst(repo = new InMemoryKoRepo()): { repo: InMemoryKoRepo; ko: KoService } {
  return { repo, ko: new KoService({ repo }) };
}

async function objektMitFertigemNachweis(ko: KoService): Promise<KnowledgeObject> {
  const created = await ko.create({
    title: "Pruefbasis",
    statement: "Eine Aussage, deren Pruefung an ihre Basis gebunden ist.",
    type: "best_practice",
    category: "K",
    tags: ["a", "b"],
    author: "pedi",
  });
  expect(await ko.markAiCheckPending(created.id)).toBe(true);
  const start = await ko.get(created.id);
  expect(
    await ko.resolveAiCheck(
      created.id,
      { ok: true },
      start?.aiCheck?.koVersion,
      start ? pruefbasisVon(start) : undefined,
    ),
  ).toBe(true);
  const fertig = await ko.get(created.id);
  expect(fertig?.aiCheck?.status).toBe("done");
  expect(fertig?.aiCheck?.ueberholt, "frisch abgeschlossen ist nicht überholt").toBeUndefined();
  return fertig as KnowledgeObject;
}

describe("K1 · die Regel: globale Basisbindung, Ablauffelder sind keine Basis", () => {
  const basis: KnowledgeObject = {
    version: 3,
    sources: [{ id: "s1" }, { id: "s2" }],
    attachments: [{ id: "f1" }],
    category: "K",
    tags: ["a", "b"],
    asset: null,
    confidentiality: "intern",
  } as unknown as KnowledgeObject;

  it("jede Änderung von Quelle oder Kontext ändert die Basis", () => {
    const b0 = pruefbasisVon(basis);
    const quelleGeaendert: Partial<KnowledgeObject>[] = [
      { version: 4 },
      { sources: [{ id: "s1" }] as KnowledgeObject["sources"] },
      { attachments: [] },
    ];
    for (const aenderung of quelleGeaendert) {
      const b = pruefbasisVon({ ...basis, ...aenderung });
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
      const b = pruefbasisVon({ ...basis, ...aenderung });
      expect(b.kontext, JSON.stringify(aenderung)).not.toBe(b0.kontext);
      expect(b.quelle).toBe(b0.quelle);
    }
  });

  it("Reihenfolge und Ablauffelder (Status, Vertrauen) ändern die Basis NICHT", () => {
    const b0 = pruefbasisVon(basis);
    const umsortiert = {
      ...basis,
      tags: ["b", "a"],
      sources: [{ id: "s2" }, { id: "s1" }],
      status: "validiert",
      trust: 99,
    } as unknown as KnowledgeObject;
    expect(pruefbasisVon(umsortiert)).toEqual(b0);
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

  it("Vertraulichkeit und Kategorie → überholt", async () => {
    const { ko } = neuerDienst();
    const a = await objektMitFertigemNachweis(ko);
    await ko.setConfidentiality(a.id, "vertraulich", "pedi");
    expect((await ko.get(a.id))?.aiCheck?.ueberholt).toBe(true);
    const b = await objektMitFertigemNachweis(ko);
    await ko.updateCategory(b.id, "Neu", "pedi");
    expect((await ko.get(b.id))?.aiCheck?.ueberholt).toBe(true);
  });

  it("neue Fassung mit ZEICHENGLEICHEM Inhalt → überholt (gleicher Text genügt nicht)", async () => {
    const { ko } = neuerDienst();
    const fertig = await objektMitFertigemNachweis(ko);
    await ko.revise(fertig.id, { title: fertig.title, statement: fertig.statement }, "pedi");
    const gelesen = await ko.get(fertig.id);
    expect(gelesen?.title).toBe(fertig.title);
    expect(gelesen?.statement).toBe(fertig.statement);
    expect(gelesen?.version).toBe(fertig.version + 1);
    expect(gelesen?.aiCheck?.ueberholt).toBe(true);
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

  it("Altbestand ohne Basis wird an seiner Fassung gemessen; ohne beides wird nichts behauptet", async () => {
    const { repo, ko } = neuerDienst();
    const created = await ko.create({
      title: "Alt",
      statement: "Altbestand",
      type: "best_practice",
      category: "K",
      author: "pedi",
    });
    await repo.setAiCheck(created.id, { status: "done", requestedAt: "x", koVersion: 1 });
    expect((await ko.get(created.id))?.aiCheck?.ueberholt).toBeUndefined();
    await ko.revise(created.id, { statement: "Altbestand, neue Fassung" }, "pedi");
    expect((await ko.get(created.id))?.aiCheck?.ueberholt).toBe(true);
    await repo.setAiCheck(created.id, { status: "done", requestedAt: "x" });
    expect((await ko.get(created.id))?.aiCheck?.ueberholt).toBeUndefined();
  });
});

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
    const gelesen = await ko.get(fertig.id);
    expect(gelesen?.aiCheck?.status).toBe("done");
    expect(gelesen?.aiCheck?.ueberholt).toBeUndefined();
    expect(gelesen?.aiCheck?.basis).toEqual(pruefbasisVon(gelesen as KnowledgeObject));
  });

  it("das Ergebnis ist an die START-Basis gebunden: später geschrieben heißt nicht aktuell", async () => {
    const { ko } = neuerDienst();
    const fertig = await objektMitFertigemNachweis(ko);
    await ko.markAiCheckPending(fertig.id);
    const start = await ko.get(fertig.id);
    const startBasis = pruefbasisVon(start as KnowledgeObject);
    // Die Änderung fällt in das Restfenster NACH der Probe des Workers, vor dem Schreiben.
    await ko.addSource(fertig.id, "pedi", { label: "Neue Quelle", url: "https://example.org/q" });
    expect(
      await ko.resolveAiCheck(fertig.id, { ok: true }, start?.aiCheck?.koVersion, startBasis),
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
    expect(roh?.aiCheck?.basis).toEqual(pruefbasisVon(fertig));
    await ko.updateTags(fertig.id, ["x"], "pedi");
    const rohDanach = await repo.findById(fertig.id);
    expect(rohDanach?.aiCheck?.ueberholt, "der Merker wird nie gespeichert").toBeUndefined();
    const neuGeladen = new KoService({ repo });
    expect((await neuGeladen.get(fertig.id))?.aiCheck?.ueberholt).toBe(true);
    // Auch ein versehentlich gespeicherter Merker wird nicht geglaubt, sondern neu abgeleitet.
    await repo.setAiCheck(fertig.id, {
      ...(rohDanach?.aiCheck as NonNullable<KnowledgeObject["aiCheck"]>),
      basis: pruefbasisVon((await repo.findById(fertig.id)) as KnowledgeObject),
      ueberholt: true,
    });
    expect((await neuGeladen.get(fertig.id))?.aiCheck?.ueberholt).toBeUndefined();
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
    let laeufe = 0;
    let freigeben: () => void = () => {};
    const tor = new Promise<void>((r) => {
      freigeben = r;
    });
    let worker: AiCheckWorker | undefined;
    // Der verdrahtete Worker bekommt einen zählenden, bis zur Freigabe hängenden Lauf.
    const { app, services, headers } = await appMitNutzer((s) => {
      worker = createAiCheckWorker({
        ko: s.ko,
        log: leiseLog,
        run: async () => {
          laeufe += 1;
          await tor;
          return { ok: true };
        },
      });
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
    expect(laeufe).toBe(1);
    const gelesen = await services.ko.get(fertig.id);
    expect(gelesen?.aiCheck?.status).toBe("done");
    expect(gelesen?.aiCheck?.ueberholt).toBeUndefined();
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
    const gelesen = await services.ko.get(fertig.id);
    expect(gelesen?.aiCheck?.status === "pending").toBe(false);
    expect(gelesen?.aiCheck?.ueberholt).toBeUndefined();
    expect(gelesen?.aiCheck?.basis).toEqual(pruefbasisVon(gelesen as KnowledgeObject));
  });
});
