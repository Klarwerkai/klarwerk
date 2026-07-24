// D-AISTATE PAKET 1/2/4 (bens V1/V2/V5) — End-to-End über den ECHTEN aiCheck-Runner + Reasoner.
//  V1: vertraulicher Text erreicht die Cloud NIE (Egress 0), die deterministische Ebene läuft trotzdem,
//      und ein cloud-only-vertrauliches Paar schließt ehrlich als "confidential" ab (nicht "done").
//  V2: der Konflikt-Cap 8 ist im Live-Pfad aufgehoben — ALLE >8 Kandidaten gehen an den Judge.
//  V5: die revise-Route gibt die frisch als pending markierte Fassung zurück (nicht den alten aiCheck).
import { describe, expect, it } from "vitest";
import { createAiCheckRunner } from "../../services/app/src/ai-check-worker";
import { type AppServices, buildApp, buildServices } from "../../services/app/src/build-app";
import type { DetectSubject } from "../../services/conflicts";
import { type ModelClient, ModelProvider, Reasoner } from "../../services/reasoner";

// Spy-CLIENT (Cloud ODER lokal): zählt jeden echten complete()-Aufruf. Liefert je nach System-Prompt
// gültiges Konflikt- bzw. Duplikat-JSON — so entstehen echte (Nicht-)Urteile ohne Netz.
function spyClient(): { client: ModelClient; calls: () => number } {
  let n = 0;
  const client = {
    name: "spy",
    complete: async (system: string) => {
      n += 1;
      return system.includes('"relation"')
        ? '{"relation":"kein_konflikt","older":null,"confidence":0.9,"begruendung":"ok","zitat_a":"a","zitat_b":"b"}'
        : '{"beziehung":"verschieden","gemeinsame_aussagen":[],"nur_in_a":"","nur_in_b":"","empfehlung":"getrennt_lassen","confidence":0.9,"begruendung":"ok"}';
    },
  } as unknown as ModelClient;
  return { client, calls: () => n };
}

async function makeKo(
  services: AppServices,
  over: Partial<Parameters<AppServices["ko"]["create"]>[0]> &
    Pick<Parameters<AppServices["ko"]["create"]>[0], "title" | "statement">,
) {
  return services.ko.create({
    type: "best_practice",
    category: "K",
    author: "u1",
    ...over,
  });
}

function runnerFor(services: AppServices) {
  return createAiCheckRunner({
    ko: services.ko,
    conflicts: services.conflicts,
    overlaps: services.overlaps,
    overlapSettings: services.overlapSettings,
    reasoner: services.reasoner,
  });
}

describe("D-AISTATE V1: Vertraulichkeit — Cloud-Egress 0, deterministische Ebene läuft, kein Fake-done", () => {
  it("vertraulich + nur Cloud: Cloud-Judge 0, deterministischer Treffer bleibt, verschieden-Paar → 'confidential'", async () => {
    const services = buildServices();
    const cloud = spyClient();
    services.reasoner = new Reasoner(new ModelProvider(cloud.client));
    const run = runnerFor(services);

    const a = await makeKo(services, {
      title: "Pumpe P2 Druckverlust",
      statement: "Bei Pumpe P2 faellt der Druck an Ventil V4.",
      confidentiality: "vertraulich",
    });
    await run(a.id); // Pool leer
    const b = await makeKo(services, {
      title: "Pumpe P2 Druckverlust",
      statement: "Bei Pumpe P2 faellt der Druck an Ventil V4.",
      confidentiality: "vertraulich",
    });
    // b vs a WORTGLEICH → deterministischer Overlap; die KI-Zweitprüfung (bens V2) ist für das
    // vertrauliche Paar cloud-only blockiert — Cloud-Egress bleibt 0.
    await run(b.id);
    const c = await makeKo(services, {
      title: "Schmierplan Lager",
      statement: "Lager alle 200 Stunden nachfetten.",
      confidentiality: "vertraulich",
    });
    const cOut = await run(c.id); // c vs a/b VERSCHIEDEN → Judge-Pfad, aber Cloud ausgeschlossen

    // Cloud hat NIE vertraulichen Text gesehen.
    expect(cloud.calls()).toBe(0);
    // Die (lokale) deterministische Ebene hat trotz Vertraulichkeit einen Treffer erzeugt.
    const open = await services.overlaps.unresolved();
    expect(open.some((e) => e.detector?.method === "deterministic")).toBe(true);
    // Das verschieden-Paar schließt EHRLICH als confidential ab — NICHT als schlichtes done.
    expect(cOut).toEqual({ ok: false, fallbackReason: "confidential" });
  });

  it("vertraulich + lokales Modell: Cloud 0, der lokale Judge läuft (kein confidential-Block)", async () => {
    const services = buildServices();
    const cloud = spyClient();
    const local = spyClient();
    services.reasoner = new Reasoner(
      new ModelProvider(cloud.client),
      undefined,
      undefined,
      undefined,
      new ModelProvider(local.client),
    );
    const run = runnerFor(services);

    const a = await makeKo(services, {
      title: "Thema A",
      statement: "Erste ganz eigene Aussage.",
      confidentiality: "vertraulich",
    });
    await run(a.id);
    const b = await makeKo(services, {
      title: "Thema B",
      statement: "Voellig andere zweite Aussage.",
      confidentiality: "vertraulich",
    });
    const out = await run(b.id);

    expect(cloud.calls()).toBe(0); // Cloud bleibt außen vor
    expect(local.calls()).toBeGreaterThan(0); // der lokale Judge hat gearbeitet
    expect(out.ok).toBe(true); // lokal geurteilt → ehrlich abgeschlossen (kein confidential/no-model)
  });

  it("vertraulicher KANDIDAT im Pool eines OFFENEN Subjekts: kein Cloud-Egress, Status confidential", async () => {
    const services = buildServices();
    const cloud = spyClient();
    services.reasoner = new Reasoner(new ModelProvider(cloud.client));
    const run = runnerFor(services);

    const secret = await makeKo(services, {
      title: "Geheim",
      statement: "streng vertraulicher inhalt xyz.",
      confidentiality: "vertraulich",
    });
    await run(secret.id);
    const openSubject = await makeKo(services, {
      title: "Offen",
      statement: "voellig anderer offener inhalt abc.",
    });
    const out = await run(openSubject.id);

    // Das Paar (offen + vertraulich) erbt die strengere Stufe → Cloud NIE aufgerufen.
    expect(cloud.calls()).toBe(0);
    expect(out.fallbackReason).toBe("confidential");
  });
});

describe("D-AISTATE V2: Konflikt-Cap 8 im Live-Pfad aufgehoben — ALLE Kandidaten an den Judge", () => {
  it(">8 gleichkategorisierte Konflikt-Kandidaten (cap Infinity) ⇒ Judge sieht ALLE (12)", async () => {
    const services = buildServices();
    let conflictJudgeCalls = 0;
    const subject: DetectSubject = {
      refId: "subj",
      title: "Subjekt",
      statement: "subjekt aussage",
      conditions: [],
      measures: [],
      tags: [],
      category: "K",
    };
    const pool: DetectSubject[] = Array.from({ length: 12 }, (_, i) => ({
      refId: `c${i}`,
      title: `Kandidat ${i}`,
      statement: `verschiedene aussage nummer ${i}`,
      conditions: [],
      measures: [],
      tags: [],
      category: "K",
    }));
    await services.conflicts.detectForSubject(
      subject,
      pool,
      async () => {
        conflictJudgeCalls += 1;
        return null; // kein Urteil → keine Anlage, aber der Judge WURDE befragt
      },
      { cap: Number.POSITIVE_INFINITY },
    );
    // Alle zwölf (weit über 8) wurden dem Konflikt-Judge vorgelegt — kein stiller Cap.
    expect(conflictJudgeCalls).toBe(12);
  });

  it("LIVE-Pfad (echter Runner, bens V2-Auflage): 12 Kandidaten ⇒ 12 Konflikt- UND 12 Duplikat-Judge-Aufrufe (getrennte Zähler)", async () => {
    // Kein Quelltext-Pin: der ECHTE aiCheck-Runner läuft über detectConflictsForKo/
    // detectDuplicatesForKo gegen den echten Bestand; der Spy-CLIENT zählt Konflikt- und
    // Duplikat-Urteile GETRENNT (unterscheidbar am System-Prompt-Vertrag).
    const services = buildServices();
    let conflictJudge = 0;
    let duplicateJudge = 0;
    const client = {
      name: "spy",
      complete: async (system: string) => {
        if (system.includes('"relation"')) {
          conflictJudge += 1;
          return '{"relation":"kein_konflikt","older":null,"confidence":0.9,"begruendung":"ok","zitat_a":"a","zitat_b":"b"}';
        }
        duplicateJudge += 1;
        return '{"beziehung":"verschieden","gemeinsame_aussagen":[],"nur_in_a":"","nur_in_b":"","empfehlung":"getrennt_lassen","confidence":0.9,"begruendung":"ok"}';
      },
    } as unknown as ModelClient;
    services.reasoner = new Reasoner(new ModelProvider(client));
    const run = runnerFor(services);

    // 12 inhaltlich verschiedene Bestands-KOs derselben Kategorie + 1 Subjekt (weit über dem
    // früheren stillen Cap 8).
    for (let i = 0; i < 12; i++) {
      await makeKo(services, {
        title: `Kandidat ${i}`,
        statement: `verschiedene aussage nummer ${i}`,
      });
    }
    const subject = await makeKo(services, {
      title: "Subjekt",
      statement: "subjekt aussage ohne deckung",
    });
    const out = await run(subject.id);

    expect(out.ok).toBe(true);
    // ALLE 12 hervorgeholten Kandidaten gingen an den Konflikt-Judge (kein stiller Cap 8) …
    expect(conflictJudge).toBe(12);
    // … und (bens V2/Pedi D-V2=a) ebenso ALLE 12 an den Duplikat-Judge — getrennt gezählt.
    expect(duplicateJudge).toBe(12);
  });
});

describe("D-AISTATE V5: revise-Route gibt die frisch als pending markierte Fassung zurück", () => {
  it("PUT revise → Response-aiCheck ist pending (nicht der alte Ausgang)", async () => {
    const outcome = async (): Promise<{ verdict: null }> => ({ verdict: null });
    const modelReasoner = {
      status: () => ({ active: true, provider: "fake-model", mode: "model" }),
      judgeConflict: async () => null,
      judgeDuplicate: async () => null,
      judgeConflictOutcome: outcome,
      judgeDuplicateOutcome: outcome,
    } as unknown as AppServices["reasoner"];
    const services = buildServices();
    services.reasoner = modelReasoner;
    const app = buildApp(services);
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
    const headers = { authorization: `Bearer ${(login.json() as { token: string }).token}` };
    const created = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        title: "Erstfassung",
        statement: "Aussage eins.",
        type: "best_practice",
        category: "K",
      },
    });
    const id = (created.json() as { id: string }).id;
    await services.aiCheckWorker?.idle();

    const revised = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers,
      payload: { action: "revise", changes: { statement: "Vollstaendig ueberarbeitete Aussage." } },
    });
    expect(revised.statusCode).toBe(200);
    // Die HTTP-Antwort zeigt die FRISCH markierte Prüfung (pending), nicht das alte done.
    expect((revised.json() as { aiCheck?: { status?: string } }).aiCheck?.status).toBe("pending");
  });
});
