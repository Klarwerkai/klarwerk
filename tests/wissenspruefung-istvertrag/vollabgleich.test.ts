// ================================================================================================
// AUFNAHME 20260922 · R-1124 — DER WAHLWEISE VOLLABGLEICH EINES OBJEKTS GEGEN DEN GANZEN BESTAND.
// ================================================================================================
//
// „Für besonders wichtige Wissensbestände soll die Widerspruchs- und Dublettenprüfung wahlweise
// gegen den ganzen Bestand laufen statt nur gegen die zwanzig nächsten Treffer."
//
// Der Bestand ist größer als der Deckel UND enthält Objekte, die die fachliche Vorauswahl des
// Konfliktwegs nie vorlegt (andere Kategorie, fremder Text). Gemessen wird an echten Diensten:
//   · V1  gedeckelt (Normalfall) bleibt, wie er war: höchstens 20 Vergleiche, nicht vollständig;
//   · V2  vollstaendig legt im Konfliktweg JEDES Objekt vor — Deckel und Vorfilter sind weg —, und
//         die vorhandene Abdeckungsregel weist den Lauf als vollständig aus;
//   · V3  dasselbe im Dublettenweg;
//   · V4  der Runner reicht den Umfang an beide Wege, die Zusammenfassung ist vollständig;
//   · V5  der Worker trägt die Wahl je Job (hochstufen, nie herab; Normalfall ruft wie bisher);
//   · V6  die Route nimmt die Wahl nur von `ko.validate`, auch bei aktuellem Nachweis, und weist
//         einen unbekannten Umfang ab; ohne Angabe gilt weiter der 409 des Bestands.
//
// GEGENPROBE: in `conflict-detection.ts` `vollabgleich: umfang === "vollstaendig"` entfernen → V2
// wird rot (die fünf Nicht-Nachbarn fehlen); `cap: vergleichsDeckel(umfang)` durch den festen Deckel
// ersetzen → V2 und V3 werden rot.
import { describe, expect, it } from "vitest";
import {
  type AiCheckRunner,
  createAiCheckRunner,
  createAiCheckWorker,
} from "../../services/app/src/ai-check-worker";
import { type AppServices, buildApp, buildServices } from "../../services/app/src/build-app";
import { detectConflictsForKo } from "../../services/app/src/conflict-detection";
import { DETECTION_CANDIDATE_CAP, vergleichsDeckel } from "../../services/app/src/detection-cap";
import { detectDuplicatesForKo } from "../../services/app/src/duplicate-detection";
import { isCompleteRun } from "../../services/conflicts";
import { type ModelClient, ModelProvider, Reasoner } from "../../services/reasoner";
import { erteileKiFreigabe } from "../../services/reasoner/src/testhelfer-ki-freigabe";

const NACHBARN = DETECTION_CANDIDATE_CAP + 5; // mehr als der Deckel, alle in derselben Kategorie
const FREMDE = 5; // von der fachlichen Vorauswahl nie vorgelegt
const BESTAND = NACHBARN + FREMDE;

const leiseLog = (): void => {};

// Zählt echte Judge-Aufrufe und liefert gültige Nicht-Treffer-Urteile (kein `null`).
function spyClient(): { client: ModelClient; konflikt: () => number; dublette: () => number } {
  let k = 0;
  let d = 0;
  const client = {
    name: "spy",
    complete: async (system: string) => {
      if (system.includes('"relation"')) {
        k += 1;
        return '{"relation":"kein_konflikt","older":null,"confidence":0.9,"begruendung":"ok","zitat_a":"a","zitat_b":"b"}';
      }
      d += 1;
      return '{"beziehung":"verschieden","gemeinsame_aussagen":[],"nur_in_a":"","nur_in_b":"","empfehlung":"getrennt_lassen","confidence":0.9,"begruendung":"ok"}';
    },
  } as unknown as ModelClient;
  return { client, konflikt: () => k, dublette: () => d };
}

async function anlegen(s: AppServices, title: string, statement: string, category: string) {
  return s.ko.create({
    title,
    statement,
    type: "best_practice",
    category,
    author: "u1",
    confidentiality: "intern",
  });
}

async function bestand() {
  const s = buildServices();
  const spy = spyClient();
  s.reasoner = new Reasoner(new ModelProvider(spy.client));
  await erteileKiFreigabe(s.reasoner);
  for (let i = 0; i < NACHBARN; i++) {
    await anlegen(s, `Kandidat ${i}`, `verschiedene aussage nummer ${i} im betrieb`, "Betrieb");
  }
  for (let i = 0; i < FREMDE; i++) {
    await anlegen(s, `Urlaub ${i}`, `Formular fuer Reisekosten ${i} abgeben`, "Personal");
  }
  const subjekt = await anlegen(s, "Subjekt", "subjekt aussage im betrieb ohne deckung", "Betrieb");
  return { s, spy, id: subjekt.id };
}

describe("R-1124 · der Umfang", () => {
  it("vergleichsDeckel: gedeckelt = 20 (auch ohne Angabe), vollstaendig = ohne Deckel", () => {
    expect(vergleichsDeckel()).toBe(DETECTION_CANDIDATE_CAP);
    expect(vergleichsDeckel("gedeckelt")).toBe(DETECTION_CANDIDATE_CAP);
    expect(vergleichsDeckel("vollstaendig")).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("R-1124 · Konfliktweg", () => {
  it("V1: gedeckelt bleibt der Normalfall — höchstens 20 Vergleiche, nicht vollständig", async () => {
    const { s, spy, id } = await bestand();
    const coverage = await detectConflictsForKo(id, {
      ko: s.ko,
      conflicts: s.conflicts,
      reasoner: s.reasoner,
    });
    expect(coverage.available).toBe(BESTAND);
    expect(coverage.attempted).toBeLessThanOrEqual(DETECTION_CANDIDATE_CAP);
    expect(spy.konflikt()).toBe(coverage.attempted);
    expect(isCompleteRun(coverage)).toBe(false);
  });

  it("V2: vollstaendig legt jedes Objekt vor — auch die fachlich fremden — und ist vollständig", async () => {
    const { s, spy, id } = await bestand();
    const coverage = await detectConflictsForKo(
      id,
      { ko: s.ko, conflicts: s.conflicts, reasoner: s.reasoner },
      undefined,
      "vollstaendig",
    );
    expect(coverage).toMatchObject({
      available: BESTAND,
      selected: BESTAND,
      attempted: BESTAND,
      completed: BESTAND,
      skipped: 0,
      capped: false,
      aborted: false,
    });
    expect(spy.konflikt()).toBe(BESTAND);
    expect(isCompleteRun(coverage)).toBe(true);
  });
});

describe("R-1124 · Dublettenweg", () => {
  it("V3: vollstaendig vergleicht den ganzen Pool; gedeckelt bleibt bei 20", async () => {
    const { s, spy, id } = await bestand();
    const deps = {
      ko: s.ko,
      overlaps: s.overlaps,
      reasoner: s.reasoner,
      settings: s.overlapSettings,
    };
    const gedeckelt = await detectDuplicatesForKo(id, deps);
    expect(gedeckelt.attempted).toBe(DETECTION_CANDIDATE_CAP);
    expect(isCompleteRun(gedeckelt)).toBe(false);

    const vorher = spy.dublette();
    const voll = await detectDuplicatesForKo(id, deps, undefined, "vollstaendig");
    expect(voll).toMatchObject({
      available: BESTAND,
      selected: BESTAND,
      attempted: BESTAND,
      completed: BESTAND,
      capped: false,
    });
    expect(spy.dublette() - vorher).toBe(BESTAND);
    expect(isCompleteRun(voll)).toBe(true);
  });
});

describe("R-1124 · Runner", () => {
  it("V4: der Runner reicht den Umfang an beide Wege; ohne Angabe gedeckelt", async () => {
    const { s, id } = await bestand();
    const run = createAiCheckRunner({
      ko: s.ko,
      conflicts: s.conflicts,
      overlaps: s.overlaps,
      overlapSettings: s.overlapSettings,
      reasoner: s.reasoner,
    });
    const normal = await run(id);
    expect(normal.coverage?.capped).toBe(true);

    const voll = await run(id, "vollstaendig");
    expect(voll.ok).toBe(true);
    expect(voll.coverage).toMatchObject({
      available: BESTAND,
      selected: BESTAND,
      completed: BESTAND,
      skipped: 0,
      capped: false,
      aborted: false,
    });
  });
});

describe("R-1124 · Worker", () => {
  it("V5: Wahl je Job — Normalfall ruft wie bisher, ein wartender Job wird hochgestuft", async () => {
    const s = buildServices();
    const a = await anlegen(s, "A", "erstes objekt im betrieb", "Betrieb");
    const b = await anlegen(s, "B", "zweites objekt im betrieb", "Betrieb");
    const c = await anlegen(s, "C", "drittes objekt im betrieb", "Betrieb");
    const aufrufe: string[] = [];
    let freigeben: () => void = () => {};
    const tor = new Promise<void>((r) => {
      freigeben = r;
    });
    const run: AiCheckRunner = async (koId, umfang) => {
      aufrufe.push(`${koId}:${umfang ?? "ohne"}`);
      await tor;
      return { ok: true };
    };
    const worker = createAiCheckWorker({ ko: s.ko, run, log: leiseLog });
    worker.enqueue(a.id); // läuft sofort (ein Job zur Zeit)
    worker.enqueue(b.id); // wartet
    worker.enqueue(b.id, undefined, "vollstaendig"); // wird hochgestuft
    worker.enqueue(c.id, undefined, "vollstaendig");
    worker.enqueue(c.id); // wird NICHT herabgestuft
    expect(worker.queuedCount()).toBe(3);
    freigeben();
    await worker.idle();
    expect(aufrufe).toEqual([`${a.id}:ohne`, `${b.id}:vollstaendig`, `${c.id}:vollstaendig`]);
  });
});

describe("R-1124 · Route POST /api/kos/:id/ai-check", () => {
  it("V6: Wahl durch ko.validate, auch bei aktuellem Nachweis; unbekannt → 400; ohne → 409", async () => {
    const aufrufe: string[] = [];
    const s = buildServices();
    const worker = createAiCheckWorker({
      ko: s.ko,
      log: leiseLog,
      run: async (koId, umfang) => {
        aufrufe.push(`${koId}:${umfang ?? "ohne"}`);
        return { ok: true };
      },
    });
    s.aiCheckWorker = worker;
    const app = buildApp(s);
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Pedi", email: "p@x.de", password: "secret123" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "p@x.de", password: "secret123" },
    });
    const headers = { authorization: `Bearer ${login.json().token}` };
    await app.inject({
      method: "POST",
      url: "/api/users",
      headers,
      payload: { name: "Vera", email: "vera@x.de", password: "secret123", role: "viewer" },
    });
    const vera = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "vera@x.de", password: "secret123" },
    });
    const leserin = { authorization: `Bearer ${vera.json().token}` };

    // Ein Objekt mit AKTUELLEM fertigem Nachweis (gedeckelter Lauf).
    const ko = await anlegen(s, "Kritisch", "eine besonders wichtige aussage", "Betrieb");
    await s.ko.markAiCheckPending(ko.id);
    worker.enqueue(ko.id, (await s.ko.get(ko.id))?.aiCheck?.koVersion);
    await worker.idle();
    expect((await s.ko.get(ko.id))?.aiCheck?.status).toBe("done");
    expect((await s.ko.get(ko.id))?.aiCheck?.ueberholt).toBeUndefined();
    const url = `/api/kos/${ko.id}/ai-check`;
    const post = (payload: object | undefined, mit = headers) =>
      app.inject({ method: "POST", url, headers: mit, ...(payload ? { payload } : {}) });

    const ohne = await post(undefined);
    expect(ohne.statusCode, "ohne Wahl unverändert nicht wiederholbar").toBe(409);

    const unbekannt = await post({ umfang: "alles" });
    expect(unbekannt.statusCode).toBe(400);
    expect(unbekannt.json().error).toBe("AI_CHECK_UMFANG_UNBEKANNT");

    const fremd = await post({ umfang: "vollstaendig" }, leserin);
    expect(fremd.statusCode).toBe(403);

    const voll = await post({ umfang: "vollstaendig" });
    expect(voll.statusCode).toBe(200);
    expect(voll.json()).toEqual({ status: "pending", umfang: "vollstaendig" });
    await worker.idle();
    expect(aufrufe).toEqual([`${ko.id}:ohne`, `${ko.id}:vollstaendig`]);
    expect((await s.ko.get(ko.id))?.aiCheck?.status).toBe("done");
  });
});
