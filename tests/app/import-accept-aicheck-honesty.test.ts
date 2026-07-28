// ================================================================================================
// AUFTRAG-mega29 BLOCK A (bens M28-1) — DER `done`-STATUS, DER VOLLSTÄNDIGKEIT BEHAUPTETE.
// ================================================================================================
//
// DER BEFUND (mega28 hat seinen eigenen Ehrlichkeitsvertrag gebrochen). Die Import-Accept-Kante rief
// die BESTANDSFASSADE `judgeConflict`/`judgeDuplicate` auf. Die gibt aus dem strukturierten Ausgang
// nur `.verdict` zurück — kein verfügbares Modell, ein vertraulich gesperrtes Paar und ein normaler
// Provider-/Parsefehler verdichten sich alle zu `null`, der Grund fällt weg. Die Route wertete danach
// nur `aborted`/`skipped` als unvollständig. Ein `null` ist keins von beidem → sie schrieb `done`.
// Ein abgeschlossener, vollständiger Lauf also, in dem kein einziges inhaltliches Urteil fiel.
//
// DIE TESTSCHWÄCHE, die das gedeckt hat: der alte erste Fall hieß „sauberer Lauf → done" und belegte
// mit KEINER Zusicherung, dass überhaupt ein Modell aktiv war oder ein Urteil geliefert wurde. Er
// pinnte den Fehler fest. Er ist ersetzt: der Positivfall belegt jetzt ZAHLEN (attempted/completed)
// und die tatsächliche Zahl der Urteilsaufrufe — ein Lauf ohne Urteil kann ihn nicht mehr bestehen.
//
// Gepinnt wird end-to-end über HTTP, je Ausfallart EINZELN:
//   • sauberer Lauf → done, MIT belegten Urteilen (A2-Positivkontrolle),
//   • Reasoner offline (no-model) → NICHT done,
//   • vertraulich gesperrt (confidential) → NICHT done,
//   • normaler Providerfehler (429) → NICHT done, mit ehrlicher Feinursache,
//   • Kapazitätsabbruch → NICHT done, Abbruch im Protokoll,
//   • einzeln übersprungene Kandidaten → NICHT done, skipped im Protokoll,
//   • der Accept selbst gelingt in ALLEN Fällen — die Erkennung kippt ihn nie.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AI_CHECK_JOB_TIMEOUT_MS } from "../../services/app/src/ai-check-worker";
import { type AppServices, buildApp, buildServices } from "../../services/app/src/build-app";

const ENV_KEYS = ["KLARWERK_CONFLUENCE_IMPORT", "KLARWERK_SKIP_KEYCHAIN"] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
  }
  process.env.KLARWERK_SKIP_KEYCHAIN = "1";
  // Die Erkennung am Accept-Pfad hängt an diesem Flag — ohne es gäbe es nichts zu berichten.
  process.env.KLARWERK_CONFLUENCE_IMPORT = "1";
});

afterEach(() => {
  // Sicherheitsnetz: ein per Test-Timeout abgebrochener Fake-Timer-Lauf darf den Folgetest nicht
  // mitreißen (genau das ist beim ersten Anlauf von Block D passiert).
  vi.useRealTimers();
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = saved[k];
    }
  }
});

const IMPORTED = {
  title: "Urlaubsregelung",
  statement: "Der Urlaub betraegt 30 Tage pro Jahr.",
  type: "best_practice" as const,
  category: "Personal",
  confidentiality: "intern" as const,
};

const POOL_SIZE = 4;

// Der Ausgang EINES Urteilsversuchs — strukturgleich zum echten Reasoner-Vertrag
// (services/reasoner/src/service.ts judgeConflictOutcome/judgeDuplicateOutcome).
interface FakeOutcome {
  verdict: unknown;
  failure?: "no-model" | "confidential" | "model-error" | "model-timeout";
  providerFailure?: { failureClass: string; status?: number };
}

// ================================================================================================
// AUFTRAG-mega31 A1 — WARUM DER POSITIVFALL VORHER EIN UNMÖGLICHES ERGEBNIS NACHSTELLTE.
// ================================================================================================
// Der Fake gab für den „sauberen Nicht-Treffer" `{ verdict: null }` zurück. Genau das gibt es im
// echten Reasoner NICHT: „verdict null OHNE failure gibt es nicht (ein echtes `kein_konflikt`/
// `verschieden` ist ein NICHT-null-verdict)" — services/reasoner/src/types.ts. Ein gültiges
// Nicht-Treffer-Urteil kommt als OBJEKT; `null` ist ausnahmslos ein Fehlerausgang.
//
// Solange der Positivfall das verwechselte, konnte er die Umkehr aus A1 gar nicht bestätigen: er
// hätte einen Urteilsausfall als abgeschlossenen Vergleich durchgewinkt und damit denselben Fehler
// festgepinnt, den er belegen sollte. Jetzt liefert er echte Nicht-Treffer-Urteile — und wird damit
// zur Gegenprobe: ein gültiges „kein Konflikt"/„verschieden" zählt sehr wohl als `completed`.
const KEIN_KONFLIKT = {
  relation: "kein_konflikt",
  older: null,
  confidence: 0.9,
  begruendung: "Unterschiedlicher Geltungsbereich.",
  zitat_a: "",
  zitat_b: "",
};

const VERSCHIEDEN = {
  beziehung: "verschieden",
  aspects: [],
  nurInA: "",
  nurInB: "",
  empfehlung: "getrennt_lassen",
  confidence: 0.9,
  begruendung: "Andere Sachverhalte.",
};

// ================================================================================================
// DER FAKE-REASONER TRÄGT BEIDE FLÄCHEN — und genau das macht diesen Test scharf.
// ================================================================================================
// Er bildet den ECHTEN Reasoner nach: die strukturierte Fläche (judge*Outcome) UND die
// Bestandsfassade (judge*), die daraus nur `.verdict` weiterreicht und den Grund verwirft.
// Ein Fake, der NUR die strukturierte Fläche trüge, würde gegen den alten Code an einer fehlenden
// Methode scheitern — und der Test wäre aus dem FALSCHEN Grund grün. So aber läuft der alte Weg
// über die Fassade sauber durch (null, kein Wurf) und behauptet `done`; nur ein Aufrufer, der den
// strukturierten Ausgang liest, sieht die Ursache.
function fakeReasoner(opts: {
  active?: boolean;
  conflict: () => Promise<FakeOutcome>;
  duplicate: () => Promise<FakeOutcome>;
}): AppServices["reasoner"] {
  return {
    status: () => ({ active: opts.active ?? true, provider: "spy", mode: "model" }),
    judgeConflictOutcome: opts.conflict,
    judgeDuplicateOutcome: opts.duplicate,
    judgeConflict: async () => (await opts.conflict()).verdict,
    judgeDuplicate: async () => (await opts.duplicate()).verdict,
  } as unknown as AppServices["reasoner"];
}

async function setup(services: AppServices) {
  const app = buildApp(services);
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
  return { app, headers: { authorization: `Bearer ${login.json().token}` } };
}

// Bestand anlegen, damit die Erkennung überhaupt Kandidaten hat.
async function seedPool(services: AppServices, n: number): Promise<void> {
  for (let i = 0; i < n; i++) {
    await services.ko.create({
      title: `Bestand ${i}`,
      statement: `Regel Nummer ${i} zum Urlaub im Personalbereich.`,
      type: "best_practice",
      category: "Personal",
      author: "u1",
      confidentiality: "intern",
    });
  }
}

async function acceptCandidate(
  app: Awaited<ReturnType<typeof setup>>["app"],
  headers: Record<string, string>,
): Promise<string> {
  const created = await app.inject({
    method: "POST",
    url: "/api/library/import/candidates",
    headers,
    payload: { items: [IMPORTED] },
  });
  expect(created.statusCode).toBe(201);
  const accepted = await app.inject({
    method: "PUT",
    url: `/api/library/import/candidates/${created.json()[0].id}`,
    headers,
    payload: { action: "accept" },
  });
  expect(accepted.statusCode).toBe(200);
  // Der Accept gelingt IMMER — die Erkennung darf ihn nie kippen.
  expect(accepted.json().status).toBe("angenommen");
  return accepted.json().koId as string;
}

// Ein Lauf gegen einen frisch aufgebauten Bestand, mit dem gegebenen Reasoner.
async function runAccept(reasoner: AppServices["reasoner"]) {
  const services = buildServices();
  await seedPool(services, POOL_SIZE);
  services.reasoner = reasoner;
  const { app, headers } = await setup(services);
  const koId = await acceptCandidate(app, headers);
  const ko = await services.ko.get(koId);
  await app.close();
  return ko;
}

describe("mega29 A · Import-Accept: `done` nur bei einem Lauf, der wirklich geurteilt hat", () => {
  it("sauberer Lauf → done, und die Zahlen BELEGEN, dass geurteilt wurde (A2-Positivkontrolle)", async () => {
    let conflictCalls = 0;
    let duplicateCalls = 0;
    const ko = await runAccept(
      fakeReasoner({
        conflict: async () => {
          conflictCalls += 1;
          return { verdict: KEIN_KONFLIKT }; // gültiges Nicht-Treffer-URTEIL — nicht null.
        },
        duplicate: async () => {
          duplicateCalls += 1;
          return { verdict: VERSCHIEDEN };
        },
      }),
    );

    expect(ko?.aiCheck?.status).toBe("done");
    // Der alte Test endete hier. Genau das war die Lücke: `done` ohne einen einzigen Beleg, dass
    // überhaupt ein Modell befragt wurde. Beide Wege müssen jeden Kandidaten vorgelegt haben.
    expect(conflictCalls).toBe(POOL_SIZE);
    expect(duplicateCalls).toBe(POOL_SIZE);
    expect(ko?.aiCheck?.coverage?.available).toBe(POOL_SIZE);
    expect(ko?.aiCheck?.coverage?.attempted).toBe(POOL_SIZE);
    expect(ko?.aiCheck?.coverage?.completed).toBe(POOL_SIZE);
    expect(ko?.aiCheck?.coverage?.skipped).toBe(0);
    expect(ko?.aiCheck?.coverage?.alreadyOpen).toBe(0);
    expect(ko?.aiCheck?.coverage?.aborted).toBe(false);
  });

  it("Reasoner offline (no-model) → NICHT done (vorher: done ohne ein einziges Urteil)", async () => {
    const ko = await runAccept(
      fakeReasoner({
        active: false,
        conflict: async () => ({ verdict: null, failure: "no-model" }),
        duplicate: async () => ({ verdict: null, failure: "no-model" }),
      }),
    );

    expect(ko?.aiCheck?.status).not.toBe("done");
    expect(ko?.aiCheck?.status).toBe("failed");
    expect(ko?.aiCheck?.fallbackReason).toBe("no-model");
    // AUFTRAG-mega31 A5 (bens ROT-1): hier endete der Test — und genau deshalb blieb der Befund
    // verborgen. Der STATUS war ehrlich, die ABDECKUNG nicht: dieselben vier Kandidaten standen
    // als fehlerfrei verglichen im Protokoll. Ein Lauf ohne befragbares Modell hat NICHTS
    // abgeschlossen; jeder vorgelegte Kandidat ist ausgelassen.
    expect(ko?.aiCheck?.coverage?.completed).toBe(0);
    // Auslassungen werden über BEIDE Wege SUMMIERT (mergeCoverage: „ein Ausfall auf einem Weg ist
    // ein echter Ausfall") — hier fiel jeder der vier Kandidaten auf beiden Wegen aus.
    expect(ko?.aiCheck?.coverage?.skipped).toBe(2 * POOL_SIZE);
  });

  it("vertraulich gesperrt (confidential) → NICHT done (vorher: done, KI-Ebene lief nie)", async () => {
    const ko = await runAccept(
      fakeReasoner({
        conflict: async () => ({ verdict: null, failure: "confidential" }),
        duplicate: async () => ({ verdict: null, failure: "confidential" }),
      }),
    );

    expect(ko?.aiCheck?.status).not.toBe("done");
    expect(ko?.aiCheck?.status).toBe("failed");
    expect(ko?.aiCheck?.fallbackReason).toBe("confidential");
    // mega31 A5: ein vertraulich gesperrtes Paar hat kein Urteil bekommen — die KI-Ebene lief nie.
    expect(ko?.aiCheck?.coverage?.completed).toBe(0);
    expect(ko?.aiCheck?.coverage?.skipped).toBe(2 * POOL_SIZE);
  });

  it("normaler Providerfehler (429) → NICHT done, mit ehrlicher Feinursache (vorher: done)", async () => {
    const ko = await runAccept(
      fakeReasoner({
        conflict: async () => ({
          verdict: null,
          failure: "model-error",
          providerFailure: { failureClass: "http", status: 429 },
        }),
        duplicate: async () => ({
          verdict: null,
          failure: "model-error",
          providerFailure: { failureClass: "http", status: 429 },
        }),
      }),
    );

    expect(ko?.aiCheck?.status).not.toBe("done");
    expect(ko?.aiCheck?.status).toBe("failed");
    // RT-001: die strukturierte Klasse gewinnt vor der groben Ursache — dieselbe Feinunterscheidung,
    // die der normale Worker liefert. Die Accept-Kante ist damit keine zweite Auslegung mehr.
    expect(ko?.aiCheck?.fallbackReason).toBe("rate-limit");
    // mega31 A5: der 429 ist der Fall, an dem ben die Umkehr festgemacht hat — der Aufruf kehrt
    // NORMAL zurück (kein Wurf), nur eben ohne Urteil. Genau deshalb zählte er als `completed`.
    expect(ko?.aiCheck?.coverage?.completed).toBe(0);
    expect(ko?.aiCheck?.coverage?.skipped).toBe(2 * POOL_SIZE);
  });

  it("Kapazitätsabbruch → NICHT done, Abbruch steht im Protokoll (bens JR-2)", async () => {
    const capacityError = Object.assign(new Error("busy"), { name: "ModelCapacityError" });
    const ko = await runAccept(
      fakeReasoner({
        conflict: async () => ({ verdict: KEIN_KONFLIKT }),
        // Der Duplikat-Judge läuft in den Rückstau — SCRUM-498 B2 reicht ModelCapacityError durch.
        duplicate: async () => {
          throw capacityError;
        },
      }),
    );

    expect(ko?.aiCheck?.status).toBe("failed");
    // mega29 A1: die Accept-Kante klassifiziert nicht mehr selbst („capacity"), sondern nimmt EXAKT
    // die Ursache des Runners — ben M28-4/Punkt 4: eine Ursache, eine Bedeutung, ein Weg.
    expect(ko?.aiCheck?.fallbackReason).toBe("model-error");
    expect(ko?.aiCheck?.coverage?.aborted).toBe(true);
  });

  it("einzeln übersprungene Kandidaten → NICHT done, skipped und completed getrennt ausgewiesen", async () => {
    const ko = await runAccept(
      fakeReasoner({
        // Der Konfliktweg schluckt jeden Kandidatenfehler einzeln und läuft weiter
        // (Bestandsverhalten, absichtlich unverändert) — er meldet den Teilausfall aber.
        conflict: async () => {
          throw new Error("Modell antwortete nicht verwertbar");
        },
        duplicate: async () => ({ verdict: VERSCHIEDEN }),
      }),
    );

    expect(ko?.aiCheck?.status).toBe("failed");
    expect(ko?.aiCheck?.coverage?.skipped).toBe(POOL_SIZE);
    // mega29 B1: „versucht" und „abgeschlossen" sind NICHT dasselbe. Der Konfliktweg hat alle vier
    // Paare versucht und keines abgeschlossen; die zusammengefasste Zahl nimmt die schwächere Seite.
    expect(ko?.aiCheck?.coverage?.attempted).toBe(POOL_SIZE);
    expect(ko?.aiCheck?.coverage?.completed).toBe(0);
    expect(ko?.aiCheck?.coverage?.aborted).toBe(false);
  });

  // ==============================================================================================
  // AUFTRAG-mega31 BLOCK D (bens GELB-1) — DIE KANTE, DIE HÄNGEN KONNTE.
  // ==============================================================================================
  //
  // Der reguläre Worker kapselt den Runner in `runWithTimeout` und schließt nach Fristablauf mit
  // `failed/timeout` ab. Die Import-Accept-Route wartete direkt und synchron: ein Provider, der nie
  // antwortet, hielt sie unbegrenzt fest — ohne dass je ein Abschlussstatus entstand. Kein zweiter
  // Regelausleger, aber eine echte abweichende Fehlerbehandlung.
  //
  // Der Test hängt den Konflikt-Judge ECHT auf (ein Promise, das nie settlet) und lässt die Frist
  // per Fake-Timer ablaufen. Ohne die übernommene Zeitgrenze läuft er in den Test-Timeout.
  it("D: ein hängender Provider läuft in die Frist — failed/timeout, Status GENAU EINMAL geschrieben", async () => {
    const services = buildServices();
    await seedPool(services, POOL_SIZE);
    services.reasoner = fakeReasoner({
      // Antwortet nie — genau bens Fall.
      conflict: () => new Promise<FakeOutcome>(() => {}),
      duplicate: async () => ({ verdict: VERSCHIEDEN }),
    });

    // Den Statusschreib zählen: „eindeutig UND einmalig" ist die Auflage aus Block D.
    let writes = 0;
    const record = services.ko.recordAiCheckOutcome.bind(services.ko);
    services.ko.recordAiCheckOutcome = async (id, outcome) => {
      writes += 1;
      return record(id, outcome);
    };

    // Aufbau (Registrierung/Anmeldung/Kandidat) läuft mit ECHTEN Timern — die Fake-Timer werden
    // erst um den Accept gelegt, sonst hängt schon das Passwort-Hashing daran.
    const { app, headers } = await setup(services);
    const created = await app.inject({
      method: "POST",
      url: "/api/library/import/candidates",
      headers,
      payload: { items: [IMPORTED] },
    });

    vi.useFakeTimers();
    let res: Awaited<ReturnType<typeof app.inject>>;
    try {
      const accepted = app.inject({
        method: "PUT",
        url: `/api/library/import/candidates/${created.json()[0].id}`,
        headers,
        payload: { action: "accept" },
      });
      // Die Frist des regulären Workers — dieselbe Konstante, keine zweite.
      await vi.advanceTimersByTimeAsync(AI_CHECK_JOB_TIMEOUT_MS);
      res = await accepted;
    } finally {
      vi.useRealTimers();
    }

    // Der Accept gelingt weiterhin; die Erkennung kippt ihn nie.
    expect(res.statusCode).toBe(200);
    const ko = await services.ko.get(res.json().koId as string);
    expect(ko?.aiCheck?.status).toBe("failed");
    expect(ko?.aiCheck?.fallbackReason).toBe("timeout");
    expect(writes).toBe(1);
    await app.close();
  });

  it("Flag AUS → kein Lauf, also auch KEIN Status (nichts behauptet)", async () => {
    delete process.env.KLARWERK_CONFLUENCE_IMPORT;
    const services = buildServices();
    await seedPool(services, POOL_SIZE);
    const { app, headers } = await setup(services);

    const koId = await acceptCandidate(app, headers);
    const ko = await services.ko.get(koId);
    expect(ko?.aiCheck).toBeUndefined();
    await app.close();
  });
});
