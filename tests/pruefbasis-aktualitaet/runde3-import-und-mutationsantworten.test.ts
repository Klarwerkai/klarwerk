// AUFNAHME 20260922 · PRÜFBASIS-AKTUALITÄT — Runde 3, bens zwei Befunde aus Runde 2.
//
// B1 · Die SYNCHRONE Import-Annahme band die Bestandsbasis erst NACH dem Lauf. Eine Vergleichsquelle,
//      die während des Urteils neu gefasst wurde, verschwand damit aus dem Nachweis: done, nicht
//      überholt, Prüfliste ohne neuen Lauf, Wiederholung 409. Gemessen wird hier über die echte
//      Import-API mit echtem Runner und kontrolliertem Judge.
// B2 · Direkte Rückgaben (addSource/removeSource und alle anderen Pfade, die ein Objekt
//      unverändert zurückgaben) umgingen die Lesefassung: die Mutationsantwort sagte „aktuell",
//      der Reload „überholt". Gemessen wird Gleichheit von Antwort und Reload — am Dienst und über
//      HTTP mit derselben Anzeigefunktion wie in der Oberfläche.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { aiCheckCardState } from "../../apps/web/src/lib/aiCheckStatusCard";
import { type AppServices, buildApp, buildServices } from "../../services/app/src/build-app";
import { InMemoryKoRepo, type KnowledgeObject, KoService } from "../../services/knowledge-object";
import type { ConflictJudgeOutcome, DuplicateJudgeOutcome } from "../../services/reasoner";

const ENV_KEYS = ["KLARWERK_CONFLUENCE_IMPORT", "KLARWERK_SKIP_KEYCHAIN"] as const;
const gesichert: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) {
    gesichert[k] = process.env[k];
  }
  process.env.KLARWERK_SKIP_KEYCHAIN = "1";
  // Die Erkennung an der Import-Annahme hängt an diesem Schalter.
  process.env.KLARWERK_CONFLUENCE_IMPORT = "1";
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (gesichert[k] === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = gesichert[k];
    }
  }
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

async function anmelden(app: ReturnType<typeof buildApp>): Promise<Record<string, string>> {
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "a@x.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "a@x.de", password: "secret123" },
  });
  return { authorization: `Bearer ${login.json().token}` };
}

const IMPORTIERT = {
  title: "Urlaubsregelung",
  statement: "Der Urlaub betraegt 30 Tage pro Jahr im Personalbereich.",
  type: "best_practice" as const,
  category: "Personal",
  confidentiality: "intern" as const,
};

async function importAnnehmen(
  app: ReturnType<typeof buildApp>,
  headers: Record<string, string>,
): Promise<string> {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/library/import/candidates",
    headers,
    payload: { items: [IMPORTIERT] },
  });
  expect(angelegt.statusCode).toBe(201);
  const angenommen = await app.inject({
    method: "PUT",
    url: `/api/library/import/candidates/${angelegt.json()[0].id}`,
    headers,
    payload: { action: "accept" },
  });
  expect(angenommen.statusCode).toBe(200);
  expect(angenommen.json().status).toBe("angenommen");
  return angenommen.json().koId as string;
}

// Ein Import-Lauf gegen eine Vergleichsquelle. `drift`: die Vergleichsquelle wird beim ERSTEN
// Urteil mit ZEICHENGLEICHEM Inhalt neu gefasst — der Judge hat Fassung 1 gelesen.
async function importLauf(drift: boolean) {
  const services = buildServices();
  let vergleichId = "";
  let geaendert = false;
  let urteile = 0;
  services.reasoner = kontrollierterJudge(async () => {
    urteile += 1;
    if (drift && !geaendert) {
      geaendert = true;
      const b = (await services.ko.get(vergleichId)) as KnowledgeObject;
      await services.ko.revise(vergleichId, { statement: b.statement }, "pedi");
    }
  });
  const vergleich = await services.ko.create({
    title: "Urlaub im Personalbereich",
    statement: "Der Urlaub im Personalbereich betraegt 30 Tage pro Jahr.",
    type: "best_practice",
    category: "Personal",
    author: "u1",
    confidentiality: "intern",
  });
  vergleichId = vergleich.id;
  const app = buildApp(services);
  const headers = await anmelden(app);
  const koId = await importAnnehmen(app, headers);
  return { services, app, headers, koId, vergleichId, urteile: () => urteile };
}

describe("B1 · synchrone Import-Annahme: die Basis wird VOR dem Lauf gebunden", () => {
  it("Kalibrierung: ohne Änderung während des Laufs ist der Nachweis done und aktuell", async () => {
    const lauf = await importLauf(false);
    try {
      expect(lauf.urteile(), "der Judge wurde wirklich gefragt").toBeGreaterThan(0);
      const ko = (await lauf.services.ko.get(lauf.koId)) as KnowledgeObject;
      expect(ko.aiCheck?.status).toBe("done");
      expect(ko.aiCheck?.ueberholt).toBeUndefined();
      expect(ko.aiCheck?.basis).toEqual(await lauf.services.ko.aktuellePruefbasis(ko));
    } finally {
      await lauf.app.close();
    }
  });

  it("Vergleichsquelle während des Urteils neu gefasst (gleicher Text) → überholt, Abruf reiht ein, Wiederholung gilt", async () => {
    const lauf = await importLauf(true);
    try {
      expect(lauf.urteile()).toBeGreaterThan(0);
      expect((await lauf.services.ko.get(lauf.vergleichId))?.version, "Fassung 2").toBe(2);
      const ko = (await lauf.services.ko.get(lauf.koId)) as KnowledgeObject;
      expect(ko.aiCheck?.status).toBe("done");
      expect(ko.aiCheck?.ueberholt, "das Ergebnis gilt für Fassung 1 der Vergleichsquelle").toBe(
        true,
      );
      // Die gespeicherte Basis ist die START-Basis, nicht die Endbasis.
      expect(ko.aiCheck?.basis).not.toEqual(await lauf.services.ko.aktuellePruefbasis(ko));

      // Wiederholung wird angenommen (kein AI_CHECK_NOT_RETRYABLE).
      const worker = lauf.services.aiCheckWorker;
      expect(worker).toBeDefined();
      const retry = await lauf.app.inject({
        method: "POST",
        url: `/api/kos/${lauf.koId}/ai-check`,
        headers: lauf.headers,
      });
      expect(retry.statusCode).toBe(200);
      // Kein Doppelauftrag: höchstens EIN Job für dieses Objekt steht an oder läuft.
      expect(worker?.queuedCount()).toBeLessThanOrEqual(1);
      await worker?.idle();
      const erneuert = (await lauf.services.ko.get(lauf.koId)) as KnowledgeObject;
      expect(erneuert.aiCheck?.status).toBe("done");
      expect(erneuert.aiCheck?.ueberholt).toBeUndefined();
    } finally {
      await lauf.app.close();
    }
  });

  it("Vergleichsquelle während des Urteils neu gefasst → die Prüfliste reiht den Lauf beim Abruf ein", async () => {
    const lauf = await importLauf(true);
    try {
      const worker = lauf.services.aiCheckWorker;
      const board = await lauf.app.inject({
        method: "GET",
        url: "/api/validation/board",
        headers: lauf.headers,
      });
      expect(board.statusCode).toBe(200);
      const zeile = (board.json() as KnowledgeObject[]).find((k) => k.id === lauf.koId);
      expect(zeile, "das importierte Objekt steht in der Prüfliste").toBeDefined();
      expect(zeile?.aiCheck?.status, "nicht mehr als fertig und aktuell").toBe("pending");
      await worker?.idle();
      // Der eingereihte Lauf hat wirklich stattgefunden: der Nachweis ist neu gebunden, an die
      // jetzige Fassung der Vergleichsquelle.
      const erneuert = (await lauf.services.ko.get(lauf.koId)) as KnowledgeObject;
      expect(erneuert.aiCheck?.status).toBe("done");
      expect(erneuert.aiCheck?.ueberholt).toBeUndefined();
      expect(erneuert.aiCheck?.basis).toEqual(await lauf.services.ko.aktuellePruefbasis(erneuert));
    } finally {
      await lauf.app.close();
    }
  });
});

async function fertigerNachweis(ko: KoService, id: string): Promise<KnowledgeObject> {
  expect(await ko.markAiCheckPending(id)).toBe(true);
  const start = (await ko.get(id)) as KnowledgeObject;
  expect(
    await ko.resolveAiCheck(
      id,
      { ok: true },
      start.aiCheck?.koVersion,
      await ko.aktuellePruefbasis(start),
    ),
  ).toBe(true);
  const fertig = (await ko.get(id)) as KnowledgeObject;
  expect(fertig.aiCheck?.ueberholt, "frisch abgeschlossen ist nicht überholt").toBeUndefined();
  return fertig;
}

async function objektMitQuelleUndAnhang(ko: KoService) {
  const created = await ko.create({
    title: "Antwort gegen Reload",
    statement: "Eine Aussage mit Quelle und Anhang.",
    type: "best_practice",
    category: "K",
    tags: ["a"],
    author: "pedi",
  });
  const mitQuelle = await ko.addSource(created.id, "pedi", {
    label: "Erste Quelle",
    url: "https://example.org/eins",
  });
  const mitAnhang = await ko.addAttachment(created.id, "pedi", {
    name: "anhang.txt",
    mime: "text/plain",
    dataUrl: "data:text/plain;base64,SGFsbG8=",
  });
  const quelleId = mitQuelle.sources?.[0]?.id as string;
  const anhangId = mitAnhang.attachments?.[0]?.id as string;
  const fertig = await fertigerNachweis(ko, created.id);
  return { id: created.id, quelleId, anhangId, fertig };
}

describe("B2 · Mutationsantwort und Reload lesen dieselbe gespeicherte Bindung", () => {
  // Basis-Änderungen: die Antwort MUSS überholt sagen, genau wie der Reload.
  const basisAenderungen: [
    string,
    (
      ko: KoService,
      o: { id: string; quelleId: string; anhangId: string },
    ) => Promise<KnowledgeObject>,
  ][] = [
    [
      "addSource",
      (ko, o) => ko.addSource(o.id, "pedi", { label: "Neu", url: "https://example.org/n" }),
    ],
    ["removeSource", (ko, o) => ko.removeSource(o.id, o.quelleId, "pedi")],
    [
      "addAttachment",
      (ko, o) =>
        ko.addAttachment(o.id, "pedi", {
          name: "zwei.txt",
          mime: "text/plain",
          dataUrl: "data:text/plain;base64,WndlaQ==",
        }),
    ],
    ["removeAttachment", (ko, o) => ko.removeAttachment(o.id, o.anhangId, "pedi")],
  ];
  for (const [name, aendern] of basisAenderungen) {
    it(`${name}: Antwort überholt = Reload überholt`, async () => {
      const ko = new KoService({ repo: new InMemoryKoRepo() });
      const o = await objektMitQuelleUndAnhang(ko);
      const antwort = await aendern(ko, o);
      const reload = (await ko.get(o.id)) as KnowledgeObject;
      expect(reload.aiCheck?.ueberholt, "Kalibrierung: die Änderung ist basisrelevant").toBe(true);
      expect(antwort.aiCheck?.ueberholt).toBe(reload.aiCheck?.ueberholt);
      expect(aiCheckCardState(antwort.aiCheck as never)).toEqual(
        aiCheckCardState(reload.aiCheck as never),
      );
      // Gespeichert wird der Merker nie.
      const roh = await (ko as unknown as { repo: InMemoryKoRepo }).repo.findById(o.id);
      expect(roh?.aiCheck?.ueberholt).toBeUndefined();
    });
  }

  // Ablauf-Änderungen an einem SCHON überholten Nachweis: die Antwort darf ihn nicht wieder als
  // aktuell zeigen (vorher gaben diese Pfade das Objekt ungeprüft zurück).
  const ablaufAenderungen: [string, (ko: KoService, id: string) => Promise<KnowledgeObject>][] = [
    ["addComment", (ko, id) => ko.addComment(id, "pedi", "Ein Kommentar")],
    ["setValidationState", (ko, id) => ko.setValidationState(id, { trust: 10, status: "offen" })],
    [
      "setValidationDecisionRef",
      (ko, id) => ko.setValidationDecisionRef(id, { auditSeq: 1, auditHash: "h" }),
    ],
    ["setAuthor", (ko, id) => ko.setAuthor(id, "andere", "pedi")],
  ];
  for (const [name, aendern] of ablaufAenderungen) {
    it(`${name}: ein überholter Nachweis bleibt in der Antwort überholt`, async () => {
      const ko = new KoService({ repo: new InMemoryKoRepo() });
      const o = await objektMitQuelleUndAnhang(ko);
      await ko.updateTags(o.id, ["neu"], "pedi");
      const antwort = await aendern(ko, o.id);
      const reload = (await ko.get(o.id)) as KnowledgeObject;
      expect(reload.aiCheck?.ueberholt).toBe(true);
      expect(antwort.aiCheck?.ueberholt).toBe(true);
    });
  }

  it("restore: die Antwort trägt dieselbe Lesefassung wie der Reload", async () => {
    const ko = new KoService({ repo: new InMemoryKoRepo() });
    const o = await objektMitQuelleUndAnhang(ko);
    await ko.updateTags(o.id, ["neu"], "pedi");
    await ko.delete(o.id, "pedi");
    const antwort = await ko.restore(o.id, "pedi");
    const reload = (await ko.get(o.id)) as KnowledgeObject;
    expect(reload.aiCheck?.ueberholt).toBe(true);
    expect(antwort.aiCheck?.ueberholt).toBe(reload.aiCheck?.ueberholt);
  });

  it("über HTTP: PUT remove-source und anschließendes GET zeigen dieselbe Karte (outdated)", async () => {
    const services = buildServices();
    const app = buildApp(services);
    try {
      const headers = await anmelden(app);
      const o = await objektMitQuelleUndAnhang(services.ko);
      const put = await app.inject({
        method: "PUT",
        url: `/api/kos/${o.id}`,
        headers,
        payload: { action: "remove-source", sourceId: o.quelleId },
      });
      expect(put.statusCode).toBe(200);
      const get = await app.inject({ method: "GET", url: `/api/kos/${o.id}`, headers });
      expect(get.statusCode).toBe(200);
      const karteAntwort = aiCheckCardState(put.json().aiCheck);
      const karteReload = aiCheckCardState(get.json().aiCheck);
      expect(karteReload).toEqual({ kind: "outdated" });
      expect(karteAntwort).toEqual(karteReload);
    } finally {
      await app.close();
    }
  });
});
