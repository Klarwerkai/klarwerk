// AUFTRAG-aistate-fix3 (bens 2. ROT, 23.07.) — echte Runner-/Routen-Beweise (keine Quelltext-Pins):
//  V2 (Pedi D-V2=a): deterministische Ebene UND Modell-Judge laufen je Kandidat BEIDE; der
//     deterministische Treffer geht nie verloren, die KI-Einordnung wird additiv notiert.
//     Echter No-Model-Runner-Test: Provider-/complete-Aufrufe EXAKT 0 (Fetch-Spy), Status "no-model".
//  V5: ECHTES Interleaving — hängender Judge, Revision einer KO-Seite ZWISCHEN Judge-Rückkehr und
//     Insert, Freigabe des alten Laufs ⇒ KEIN offener Altbefund (Konflikt- UND Overlap-Seite),
//     genau die NEUE Version wird geprüft, kein stale Board-/Badge-Eintrag. Zusätzlich der
//     CAS-Fenster-Beweis (Nachvalidierung nach dem Insert) auf Service-Ebene und der Routen-Sweep.
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAiCheckRunner } from "../../services/app/src/ai-check-worker";
import { type AppServices, buildApp, buildServices } from "../../services/app/src/build-app";
import { type ModelClient, ModelProvider, Reasoner } from "../../services/reasoner";

type FakeReasoner = AppServices["reasoner"];

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

// App + eingeloggter Nutzer für die ECHTEN Routen (revise-Sweep, Board-Abfragen).
async function appWithUser(services: AppServices) {
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
  return { app, headers: { authorization: `Bearer ${(login.json() as { token: string }).token}` } };
}

const KEIN_KONFLIKT = {
  relation: "kein_konflikt",
  older: null,
  confidence: 0.9,
  begruendung: "ok",
  zitat_a: "a",
  zitat_b: "b",
};

const VERSCHIEDEN = {
  beziehung: "verschieden",
  aspects: [],
  nurInA: "",
  nurInB: "",
  empfehlung: "getrennt_lassen",
  confidence: 0.9,
  begruendung: "kein Duplikat",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("V2 (Pedi D-V2=a): beide Schichten je Kandidat — Merge-Vertrag über den echten Runner", () => {
  it("fast-wortgleicher Kandidat + zulässiges Modell ⇒ deterministischer Treffer BLEIBT und der Duplikat-Judge wurde aufgerufen (KI-Einordnung additiv)", async () => {
    const services = buildServices();
    let conflictJudge = 0;
    let duplicateJudge = 0;
    const client = {
      name: "spy",
      complete: async (system: string) => {
        if (system.includes('"relation"')) {
          conflictJudge += 1;
          return JSON.stringify(KEIN_KONFLIKT);
        }
        duplicateJudge += 1;
        // Die KI ordnet die hohe Textdeckung als „ähnlich, kein Duplikat" ein — der
        // deterministische Treffer darf dadurch NICHT verschwinden (Zusammenführungsvertrag).
        return '{"beziehung":"verschieden","gemeinsame_aussagen":[],"nur_in_a":"","nur_in_b":"","empfehlung":"getrennt_lassen","confidence":0.8,"begruendung":"aehnlich, kein Duplikat"}';
      },
    } as unknown as ModelClient;
    services.reasoner = new Reasoner(new ModelProvider(client));
    const run = runnerFor(services);

    await makeKo(services, {
      title: "Pumpe P2 Druckverlust",
      statement: "Bei Pumpe P2 faellt der Druck an Ventil V4.",
    });
    const second = await makeKo(services, {
      title: "Pumpe P2 Druckverlust",
      statement: "Bei Pumpe P2 faellt der Druck an Ventil V4.",
    });
    const out = await run(second.id);

    expect(out.ok).toBe(true);
    // Der Duplikat-Judge lief ZUSÄTZLICH für das wortgleiche Paar (getrennte Zähler).
    expect(duplicateJudge).toBe(1);
    expect(conflictJudge).toBeGreaterThanOrEqual(1);
    // Der deterministische Treffer blieb erhalten — mit der additiv notierten KI-Einordnung.
    const open = await services.overlaps.unresolved();
    expect(open).toHaveLength(1);
    expect(open[0]?.detector?.method).toBe("deterministic");
    expect(open[0]?.detector?.rationale).toBe("aehnlich, kein Duplikat");
    expect(open[0]?.detector?.confidence).toBe(0.8);
  });

  it("KI BESTÄTIGT ein Duplikat unterhalb der Schwelle ⇒ Modell-Profil trägt den Eintrag (wie bisher)", async () => {
    const services = buildServices();
    const client = {
      name: "spy",
      complete: async (system: string) =>
        system.includes('"relation"')
          ? JSON.stringify(KEIN_KONFLIKT)
          : '{"beziehung":"teilweise","gemeinsame_aussagen":[{"beschreibung":"Kernsatz","zitat_a":"gemeinsamer kernsatz","zitat_b":"gemeinsamer kernsatz"}],"nur_in_a":"","nur_in_b":"","empfehlung":"zusammenfuehren_pruefen","confidence":0.9,"begruendung":"ueberlappt"}',
    } as unknown as ModelClient;
    services.reasoner = new Reasoner(new ModelProvider(client));
    const run = runnerFor(services);

    await makeKo(services, {
      title: "Pumpe entlueften",
      statement: "Gemeinsamer Kernsatz zur Pumpe.",
    });
    const second = await makeKo(services, {
      title: "Anfahrprozedur komplett anders",
      statement: "Gemeinsamer Kernsatz zur Pumpe, aber mit voellig anderen weiteren Details.",
    });
    await run(second.id);
    const open = await services.overlaps.unresolved();
    expect(open).toHaveLength(1);
    expect(open[0]?.detector?.method).toBe("model");
    expect(open[0]?.relation).toBe("teilweise");
  });

  it("ECHTER No-Model-Runner-Test: Provider-/complete-Aufrufe EXAKT 0 (Fetch-Spy), Status ehrlich 'no-model', deterministische Ebene trägt allein", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const services = buildServices();
    // Der ECHTE Reasoner ohne Modell — die no-model-Ausgänge kommen aus dem echten
    // Outcome-Vertrag (failure:"no-model"), nicht aus einem {verdict:null}-Fake.
    services.reasoner = new Reasoner() as unknown as FakeReasoner;
    const run = runnerFor(services);

    await makeKo(services, {
      title: "Pumpe P2 Druckverlust",
      statement: "Bei Pumpe P2 faellt der Druck an Ventil V4.",
    });
    const second = await makeKo(services, {
      title: "Pumpe P2 Druckverlust",
      statement: "Bei Pumpe P2 faellt der Druck an Ventil V4.",
    });
    const out = await run(second.id);

    // Ehrlicher Ausgang: kein Modell — NICHT done.
    expect(out).toEqual({ ok: false, fallbackReason: "no-model" });
    // Provider-/complete-Aufrufe EXAKT 0: kein einziger Netz-/Modellaufruf.
    expect(fetchSpy).not.toHaveBeenCalled();
    // Die deterministische Ebene hat ihren Treffer trotzdem erzeugt (Kernfunktion).
    const open = await services.overlaps.unresolved();
    expect(open).toHaveLength(1);
    expect(open[0]?.detector?.method).toBe("deterministic");
  });
});

describe("V5: echtes Interleaving — hängender Judge, Revision, Freigabe (Overlap-Seite)", () => {
  it("Revision ZWISCHEN Judge-Rückkehr und Insert ⇒ kein offener Altbefund; der Folgelauf prüft GENAU die neue Version", async () => {
    const services = buildServices();
    let release: (() => void) | null = null;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    services.reasoner = {
      status: () => ({ active: true, provider: "fake", mode: "model" }),
      judgeConflictOutcome: async () => ({ verdict: KEIN_KONFLIKT }),
      judgeDuplicateOutcome: async () => {
        await gate; // der Judge „hängt", bis der Test ihn freigibt
        return {
          verdict: {
            beziehung: "teilweise",
            aspects: [
              {
                beschreibung: "Kernsatz",
                zitatA: "gemeinsamer kernsatz",
                zitatB: "gemeinsamer kernsatz",
              },
            ],
            nurInA: "",
            nurInB: "",
            empfehlung: "zusammenfuehren_pruefen",
            confidence: 0.9,
            begruendung: "ueberlappt",
          },
        };
      },
    } as unknown as FakeReasoner;
    const { app, headers } = await appWithUser(services);
    const run = runnerFor(services);

    const a = await makeKo(services, {
      title: "Pumpe entlueften",
      statement: "Gemeinsamer Kernsatz zur Pumpe.",
    });
    const b = await makeKo(services, {
      title: "Anfahrprozedur komplett anders",
      statement: "Gemeinsamer Kernsatz zur Pumpe, aber mit voellig anderen weiteren Details.",
    });

    // Alter Lauf startet und bleibt im hängenden Duplikat-Judge stehen.
    const oldRun = run(b.id);
    await new Promise((r) => setTimeout(r, 0));

    // JETZT wird eine KO-Seite über die ECHTE Route revidiert (bumpt a auf Version 2 + Sweep).
    const revised = await app.inject({
      method: "PUT",
      url: `/api/kos/${a.id}`,
      headers,
      payload: {
        action: "revise",
        changes: { statement: "Gemeinsamer Kernsatz zur Pumpe — vollstaendig ueberarbeitet." },
      },
    });
    expect(revised.statusCode).toBe(200);

    // Alten Lauf freigeben: der Judge kehrt MIT einem anlegenden Urteil zurück …
    (release as unknown as () => void)();
    await oldRun;

    // … aber KEIN offener Altbefund bleibt aktiv/sichtbar (CAS-Versionsbindung griff).
    expect(await services.overlaps.unresolved()).toHaveLength(0);
    const board = await app.inject({ method: "GET", url: "/api/duplicates", headers });
    expect(board.json()).toEqual([]);
    expect(await services.overlaps.badgeCount()).toBe(0);

    // Der Folgelauf prüft GENAU die NEUE Version und bindet den Befund an sie.
    await run(b.id);
    const open = await services.overlaps.unresolved();
    expect(open).toHaveLength(1);
    const aNow = await services.ko.get(a.id);
    expect(aNow?.version).toBe((a.version ?? 0) + 1);
    expect(open[0]?.koAVersion).toBe(b.version);
    expect(open[0]?.koBVersion).toBe(aNow?.version);
  });
});

describe("V5: echtes Interleaving — hängender Judge, Revision, Freigabe (Konflikt-Seite)", () => {
  it("Revision während des hängenden Konflikt-Judges ⇒ kein offener Altkonflikt; Folgelauf bindet an die neue Version", async () => {
    const services = buildServices();
    let release: (() => void) | null = null;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    services.reasoner = {
      status: () => ({ active: true, provider: "fake", mode: "model" }),
      judgeConflictOutcome: async () => {
        await gate;
        return {
          verdict: {
            relation: "widerspruch",
            older: null,
            confidence: 0.9,
            begruendung: "Farbwiderspruch",
            zitat_a: "Das Ventil ist blau",
            zitat_b: "Das Ventil ist rot",
          },
        };
      },
      judgeDuplicateOutcome: async () => ({ verdict: VERSCHIEDEN }),
    } as unknown as FakeReasoner;
    const { app, headers } = await appWithUser(services);
    const run = runnerFor(services);

    const a = await makeKo(services, {
      title: "Ventilfarbe Anlage 3",
      statement: "Das Ventil ist rot.",
    });
    const b = await makeKo(services, {
      title: "Ventilkennzeichnung Halle",
      statement: "Das Ventil ist blau.",
    });

    const oldRun = run(b.id);
    await new Promise((r) => setTimeout(r, 0));

    const revised = await app.inject({
      method: "PUT",
      url: `/api/kos/${a.id}`,
      headers,
      payload: {
        action: "revise",
        changes: { statement: "Das Ventil ist rot und wurde neu geprueft." },
      },
    });
    expect(revised.statusCode).toBe(200);

    (release as unknown as () => void)();
    await oldRun;

    // Kein offener Altkonflikt — weder im Service noch auf dem Board.
    expect(await services.conflicts.unresolved()).toHaveLength(0);
    const board = await app.inject({ method: "GET", url: "/api/conflicts", headers });
    expect(board.json()).toEqual([]);

    // Folgelauf: der Konflikt entsteht für GENAU die neue Versionskombination.
    await run(b.id);
    const open = await services.conflicts.unresolved();
    expect(open).toHaveLength(1);
    const aNow = await services.ko.get(a.id);
    expect(open[0]?.koAVersion).toBe(b.version);
    expect(open[0]?.koBVersion).toBe(aNow?.version);
    expect(aNow?.version).toBe((a.version ?? 0) + 1);
  });
});

describe("V5: Routen-Sweep — ein bereits OFFENER Befund älterer Version wird bei Revision systemisch geschlossen", () => {
  it("offener Overlap- UND Konflikt-Befund zu a@1 ⇒ nach PUT revise(a) beide zu (superseded), Board/Badge leer", async () => {
    const services = buildServices();
    services.reasoner = {
      status: () => ({ active: true, provider: "fake", mode: "model" }),
      judgeConflictOutcome: async () => ({
        verdict: {
          relation: "widerspruch",
          older: null,
          confidence: 0.9,
          begruendung: "Farbwiderspruch",
          zitat_a: "Das Ventil ist blau",
          zitat_b: "Das Ventil ist rot",
        },
      }),
      judgeDuplicateOutcome: async () => ({ verdict: VERSCHIEDEN }),
    } as unknown as FakeReasoner;
    const { app, headers } = await appWithUser(services);
    const run = runnerFor(services);

    const a = await makeKo(services, {
      title: "Ventilfarbe Anlage 3",
      statement: "Das Ventil ist rot.",
    });
    const b = await makeKo(services, {
      title: "Ventilkennzeichnung Halle",
      statement: "Das Ventil ist blau.",
    });
    await run(b.id);
    const openBefore = await services.conflicts.unresolved();
    expect(openBefore).toHaveLength(1);
    const staleConflictId = openBefore[0]?.id as string;

    const revised = await app.inject({
      method: "PUT",
      url: `/api/kos/${a.id}`,
      headers,
      payload: { action: "revise", changes: { statement: "Die Kennzeichnung wurde geaendert." } },
    });
    expect(revised.statusCode).toBe(200);

    // Der offene Altbefund ist systemisch zu — Board/Badges zeigen nichts Veraltetes mehr.
    expect(await services.conflicts.unresolved()).toHaveLength(0);
    expect(await services.conflicts.badgeCount()).toBe(0);
    const board = await app.inject({ method: "GET", url: "/api/conflicts", headers });
    expect(board.json()).toEqual([]);
    // Der geschlossene Befund trägt den systemischen Grund "superseded" (kein menschlicher Entscheider).
    const closed = await services.conflicts.get(staleConflictId);
    expect(closed?.status).toBe("geloest");
    expect(closed?.resolutionReason).toBe("superseded");
    expect(closed?.decidedBy).toBeNull();
  });
});
