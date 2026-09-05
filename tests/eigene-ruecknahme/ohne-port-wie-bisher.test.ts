import { describe, expect, it } from "vitest";
import { InMemoryOverlapRepo, OverlapService } from "../../services/conflicts";

// ================================================================================================
// JOB 3071 — DAS ZUSTANDSMODELL DER EINEN NEUEN AUSKUNFT (§9 des Auftrags).
// ================================================================================================
//
// Zwei Zustände, die niemals zu einer geratenen Autorschaft führen dürfen:
//
//   PORT FEHLT (nicht verdrahtet)  — heutiges Verhalten, unverändert, OHNE Meldung. Das ist die
//                                    vereinbarte Kompositionsfreiheit (Muster `currentVersion`):
//                                    Testkompositionen und Ablagen ohne Verdrahtung sollen sich
//                                    exakt wie vorher verhalten, nicht wie ein Fehlerfall.
//   PORT WIRFT / ANTWORTET NICHT   — wie „erfolgreich leer", ZUSÄTZLICH `onError`. Die Löschung
//                                    geht durch; eine Rücknahme ohne belegte Autorschaft wird
//                                    niemals als solche geschrieben (Lieferung 5, fail-safe statt
//                                    Raten).
describe("JOB 3071: ohne belegte Autorschaft wird nichts behauptet", () => {
  async function paar(service: OverlapService) {
    return service.createAuto(
      {
        koA: "ko-a",
        koB: "ko-b",
        relation: "identisch",
        aspects: [{ beschreibung: "gleich", zitatA: "x", zitatB: "x" }],
        eigenanteilA: "",
        eigenanteilB: "",
        recommendation: "zusammenfuehren",
      },
      { trigger: "manual", method: "deterministic", lexicalScore: 0.9 },
      "system",
    );
  }

  it("ohne verdrahteten Port: participant_deleted / by null, ohne jede Meldung", async () => {
    const meldungen: string[] = [];
    const service = new OverlapService({
      repo: new InMemoryOverlapRepo(),
      onError: (context) => meldungen.push(context),
    });
    const eintrag = await paar(service);

    expect(await service.onKoRemoved("ko-a", "nora")).toBe(1);

    const stored = await service.get(eintrag.id);
    expect(stored?.resolution?.reason).toBe("participant_deleted");
    expect(stored?.resolution?.by).toBeNull();
    expect(meldungen).toEqual([]);
  });

  it("werfender Port: die Löschung geht durch, der Fehler erscheint auf onError", async () => {
    const meldungen: { context: string; error: unknown }[] = [];
    const service = new OverlapService({
      repo: new InMemoryOverlapRepo(),
      eigeneRuecknahme: () => Promise.reject(new Error("Bestand antwortet nicht")),
      onError: (context, error) => meldungen.push({ context, error }),
    });
    const eintrag = await paar(service);

    // Die Löschung wird NICHT abgebrochen — der Befund wird geschlossen.
    expect(await service.onKoRemoved("ko-a", "nora")).toBe(1);

    const stored = await service.get(eintrag.id);
    expect(stored?.status).toBe("geschlossen");
    expect(stored?.resolution?.reason).toBe("participant_deleted");
    expect(stored?.resolution?.by).toBeNull();

    expect(meldungen).toHaveLength(1);
    expect(meldungen[0]?.context).toContain("ko-a");
    expect((meldungen[0]?.error as Error).message).toBe("Bestand antwortet nicht");
  });

  // JOB 3071 R3 (bens Korrekturpflicht 1 zu R2): DER FÜNFTE ZUSTAND — DER PORT WIRFT SYNCHRON.
  // Der Fall oben benutzt `Promise.reject(...)`: da GIBT es eine Zusage, nur eine abgelehnte. Wirft
  // der Port schon beim Aufruf, gibt es gar keine — und ein Fehlerhandler, der erst am Ergebnis
  // hängt, greift nicht. R2 liess den Fehler dadurch aus `onKoRemoved` heraus; die Löschung brach
  // ab, nachdem das weiche Löschen schon geschrieben war.
  it("synchron werfender Port: die Löschung geht durch, der Fehler erscheint auf onError", async () => {
    const meldungen: { context: string; error: unknown }[] = [];
    const service = new OverlapService({
      repo: new InMemoryOverlapRepo(),
      eigeneRuecknahme: () => {
        throw new Error("Bestand nicht ansprechbar");
      },
      onError: (context, error) => meldungen.push({ context, error }),
    });
    const eintrag = await paar(service);

    expect(await service.onKoRemoved("ko-a", "nora")).toBe(1);

    const stored = await service.get(eintrag.id);
    expect(stored?.status).toBe("geschlossen");
    expect(stored?.resolution?.reason).toBe("participant_deleted");
    expect(stored?.resolution?.by).toBeNull();

    expect(meldungen).toHaveLength(1);
    expect(meldungen[0]?.context).toContain("ko-a");
    expect((meldungen[0]?.error as Error).message).toBe("Bestand nicht ansprechbar");
  });

  // ==============================================================================================
  // JOB 3071 R2 (bens Korrekturpflicht 1 und 3): DER VIERTE ZUSTAND — DER PORT SCHWEIGT.
  // ==============================================================================================
  //
  // Runde 1 kannte drei Zustände: „fehlt", „wirft", „leer". Sie hatte KEINEN für die Zusage, die
  // sich weder erfüllt noch verwirft — und wartete dort unbegrenzt. Die Frist ist übergebbar, damit
  // dieser Fall in Millisekunden gemessen wird statt in der Vorgabe des Dienstes; gemessen wird
  // aber dasselbe Verhalten, das die gebaute App zeigt (s. port-antwortet-nicht.test.ts).
  it("schweigender Port: nach der Frist participant_deleted, genau eine Meldung", async () => {
    const meldungen: { context: string; error: unknown }[] = [];
    const service = new OverlapService({
      repo: new InMemoryOverlapRepo(),
      eigeneRuecknahme: () => new Promise<string | null>(() => undefined),
      eigeneRuecknahmeFrist: 20,
      onError: (context, error) => meldungen.push({ context, error }),
    });
    const eintrag = await paar(service);

    const begonnen = Date.now();
    expect(await service.onKoRemoved("ko-a", "nora")).toBe(1);
    // Die Begrenzung ist der Punkt: ohne sie kehrte dieser Aufruf nie zurück.
    expect(Date.now() - begonnen).toBeLessThan(2_000);

    const stored = await service.get(eintrag.id);
    expect(stored?.status).toBe("geschlossen");
    expect(stored?.resolution?.reason).toBe("participant_deleted");
    expect(stored?.resolution?.by).toBeNull();

    expect(meldungen).toHaveLength(1);
    expect(meldungen[0]?.context).toContain("ko-a");
    expect((meldungen[0]?.error as Error).message).toContain("20 ms");
  });

  // Eine Ablehnung NACH abgelaufener Frist ist kein zweiter Fehler, sondern derselbe. Sie darf
  // weder ein zweites Mal melden noch als unbehandelte Ablehnung den Prozess erreichen.
  it("späte Ablehnung nach abgelaufener Frist meldet kein zweites Mal", async () => {
    const meldungen: string[] = [];
    const service = new OverlapService({
      repo: new InMemoryOverlapRepo(),
      eigeneRuecknahme: () =>
        new Promise<string | null>((_, ablehnen) => {
          setTimeout(() => ablehnen(new Error("Bestand meldet sich spät")), 40);
        }),
      eigeneRuecknahmeFrist: 10,
      onError: (context) => meldungen.push(context),
    });
    const eintrag = await paar(service);

    expect(await service.onKoRemoved("ko-a", "nora")).toBe(1);
    expect(meldungen).toHaveLength(1);

    await new Promise((weiter) => setTimeout(weiter, 120));
    expect(meldungen).toHaveLength(1);
    expect((await service.get(eintrag.id))?.resolution?.reason).toBe("participant_deleted");
  });

  // Eine „Frist", die keine ist, wäre die stille Abschaltung der Begrenzung — dort gilt die Vorgabe
  // des Dienstes weiter. Gemessen an einem Port, der ANTWORTET: der Fall darf nicht 2 s dauern.
  it("unbrauchbare Frist (0) schaltet die Begrenzung nicht ab", async () => {
    const service = new OverlapService({
      repo: new InMemoryOverlapRepo(),
      eigeneRuecknahme: () => Promise.resolve("nora"),
      eigeneRuecknahmeFrist: 0,
      onError: () => undefined,
    });
    const eintrag = await paar(service);

    expect(await service.onKoRemoved("ko-a", "nora")).toBe(1);
    const stored = await service.get(eintrag.id);
    expect(stored?.resolution?.reason).toBe("withdrawn_own");
    expect(stored?.resolution?.by).toBe("nora");
  });

  it("Port antwortet leer (null): positive Aussage, kein Fehlerfall", async () => {
    const meldungen: string[] = [];
    const service = new OverlapService({
      repo: new InMemoryOverlapRepo(),
      eigeneRuecknahme: () => Promise.resolve(null),
      onError: (context) => meldungen.push(context),
    });
    const eintrag = await paar(service);

    expect(await service.onKoRemoved("ko-a", "nora")).toBe(1);
    expect((await service.get(eintrag.id))?.resolution?.reason).toBe("participant_deleted");
    expect(meldungen).toEqual([]);
  });
});
