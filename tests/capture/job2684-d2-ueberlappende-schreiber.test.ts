// ================================================================================================
// JOB 2684 D2 (R2-17) — ZWEI SCHREIBVORGÄNGE, DIE SICH WIRKLICH ÜBERSCHNEIDEN.
// ================================================================================================
//
// BENs Korrekturpflicht 2 zu D1, wörtlich: „Den Versionsvergleich als atomaren Compare-and-Swap …
// ausführen. Erwarteter Beleg: deterministischer Überlappungstest, in dem von zwei Schreibern mit
// demselben Ausgangsstand genau einer gewinnt."
//
// D1 prüfte den Stand und schrieb danach — zwei Aufrufer, die sich ZWISCHEN Prüfung und Schreiben
// überlappen, kamen beide durch. Hier wird die Überlappung ERZWUNGEN, nicht erhofft: ein Tor im
// Repo hält jeden Leser fest, bis beide angekommen sind (oder eine kurze Frist abläuft). Beide
// lesen dann denselben Stand, beide halten ihn für aktuell — und nur die Sperre je Entwurf
// (`withDraftLock`, D2) entscheidet, ob der zweite trotzdem an `pruefeStand` fällt.
//
// Die KALIBRIERUNG unten schaltet die Sperre in einer Test-Unterklasse aus und zeigt, dass ohne sie
// beide durchkommen — sonst wäre nicht belegt, dass das Tor die Überlappung überhaupt erreicht.
import { describe, expect, it } from "vitest";
import { InMemoryDraftRepo } from "../../services/capture/src/repo";
import { CaptureService, DraftStaleError } from "../../services/capture/src/service";
import type { Draft } from "../../services/capture/src/types";

/** Ein Tor, das `erwartet` Leser sammelt und dann alle zugleich weiterlässt; danach offen. */
class Tor {
  private wartende: (() => void)[] = [];
  private offen = false;
  /** Wie viele Leser GLEICHZEITIG vor dem Tor standen, als es aufging. */
  gleichzeitig = 0;

  constructor(
    private readonly erwartet: number,
    private readonly fristMs: number,
  ) {}

  passieren(): Promise<void> {
    if (this.offen) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.wartende.push(resolve);
      if (this.wartende.length >= this.erwartet) {
        this.oeffnen();
        return;
      }
      // Mit Sperre kommt der zweite Leser nie, solange der erste wartet — die Frist lässt den
      // ersten dann allein weiter. Ohne Sperre kommt der zweite sofort, und das Tor geht vorher auf.
      setTimeout(() => this.oeffnen(), this.fristMs);
    });
  }

  private oeffnen(): void {
    if (this.offen) {
      return;
    }
    this.offen = true;
    this.gleichzeitig = this.wartende.length;
    for (const w of this.wartende) {
      w();
    }
    this.wartende = [];
  }
}

class TorRepo extends InMemoryDraftRepo {
  constructor(private readonly tor: Tor) {
    super();
  }

  override async findById(id: string): Promise<Draft | undefined> {
    await this.tor.passieren();
    return super.findById(id);
  }
}

/** Die Kalibrierung: derselbe Dienst OHNE die Sperre — der Stand von D1. */
class OhneSperre extends CaptureService {
  protected override withDraftLock<T>(_id: string, fn: () => Promise<T>): Promise<T> {
    return fn();
  }
}

/** JOB 2684 D3: die Ablage OHNE die Standbedingung — sie schreibt einfach (der Stand bis D2). */
class TorRepoOhneBedingung extends TorRepo {
  override async updateWennStand(draft: Draft, _erwarteterStand: string): Promise<boolean> {
    await this.update(draft);
    return true;
  }
}

async function zweiSchreiber(service: CaptureService) {
  const draft = await service.createDraft({ title: "T", statement: "Ursprung" }, "anna");
  const stand = draft.updatedAt; // BEIDE haben diesen Stand gesehen.
  const [a, b] = await Promise.allSettled([
    service.continueDraft(draft.id, { statement: "Fassung A" }, "anna", {
      expectedUpdatedAt: stand,
    }),
    service.continueDraft(draft.id, { statement: "Fassung B" }, "bob", {
      expectedUpdatedAt: stand,
    }),
  ]);
  const gespeichert = (await service.listDrafts()).find((d) => d.id === draft.id);
  return { a, b, gespeichert, stand };
}

describe("JOB 2684 D2 · zwei überlappende Schreiber mit demselben Ausgangsstand", () => {
  it("MIT der Sperre je Entwurf gewinnt GENAU EINER — der andere bekommt DRAFT_STALE, sein Text wird nie geschrieben", async () => {
    const tor = new Tor(2, 30);
    const service = new CaptureService({ repo: new TorRepo(tor) });
    const { a, b, gespeichert } = await zweiSchreiber(service);

    const erfolge = [a, b].filter((r) => r.status === "fulfilled");
    const konflikte = [a, b].filter(
      (r) => r.status === "rejected" && r.reason instanceof DraftStaleError,
    );
    expect(erfolge, `Ergebnisse: ${JSON.stringify([a.status, b.status])}`).toHaveLength(1);
    expect(konflikte).toHaveLength(1);
    // Gespeichert ist der Gewinner, unversehrt — und sein zurückgegebener Stand ist der gespeicherte.
    const gewinner = (erfolge[0] as PromiseFulfilledResult<Draft>).value;
    expect(gespeichert?.payload.statement).toBe(gewinner.payload.statement);
    expect(gespeichert?.updatedAt).toBe(gewinner.updatedAt);
    expect(gespeichert?.lastEditor).toBe(gewinner.lastEditor);
    // Der Verlierer nennt den Stand, gegen den nach dem Neuladen geschrieben wird.
    const verlierer = (konflikte[0] as PromiseRejectedResult).reason as DraftStaleError;
    expect(verlierer.currentUpdatedAt).toBe(gewinner.updatedAt);
    // Mit Sperre stand nie mehr als EIN Leser gleichzeitig vor dem Tor — die Überlappung ist
    // konstruktiv ausgeschlossen, nicht nur zufällig ausgeblieben.
    expect(tor.gleichzeitig).toBe(1);
  });

  it("D3: OHNE die Sperre im Prozess gewinnt trotzdem genau einer — die Bedingung in der ABLAGE entscheidet (zwei Prozesse: tests/capture/job2684-d3-zwei-prozesse)", async () => {
    const tor = new Tor(2, 30);
    const service = new OhneSperre({ repo: new TorRepo(tor) });
    const { a, b } = await zweiSchreiber(service);
    // Die Überlappung ist da (beide zugleich vor dem Tor) — und die Ablage lässt nur einen durch.
    expect(tor.gleichzeitig).toBe(2);
    expect([a, b].filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      [a, b].filter((r) => r.status === "rejected" && r.reason instanceof DraftStaleError),
    ).toHaveLength(1);
  });

  it("KALIBRIERUNG — OHNE die Sperre UND ohne Bedingung in der Ablage (der Stand von D1) erreicht das Tor die Überlappung, und BEIDE kommen durch: der Letzte gewinnt still", async () => {
    const tor = new Tor(2, 30);
    const service = new OhneSperre({ repo: new TorRepoOhneBedingung(tor) });
    const { a, b, gespeichert } = await zweiSchreiber(service);

    // Beide Leser standen zugleich vor dem Tor — das ist die Überlappung, die D1 nicht abfing.
    expect(tor.gleichzeitig).toBe(2);
    expect(a.status).toBe("fulfilled");
    expect(b.status).toBe("fulfilled");
    // Und einer von beiden ist trotz „richtigem" Stand überschrieben worden — genau der Schaden.
    const statements = [a, b]
      .map((r) => (r as PromiseFulfilledResult<Draft>).value.payload.statement)
      .sort();
    expect(statements).toEqual(["Fassung A", "Fassung B"]);
    expect(["Fassung A", "Fassung B"]).toContain(gespeichert?.payload.statement);
  });

  it("die Sperre serialisiert nur DENSELBEN Entwurf — zwei verschiedene Entwürfe schreiben weiter nebeneinander", async () => {
    const tor = new Tor(2, 30);
    const service = new CaptureService({ repo: new TorRepo(tor) });
    const d1 = await service.createDraft({ title: "Eins", statement: "U1" }, "anna");
    const d2 = await service.createDraft({ title: "Zwei", statement: "U2" }, "bob");
    const [a, b] = await Promise.allSettled([
      service.continueDraft(d1.id, { statement: "A" }, "anna", { expectedUpdatedAt: d1.updatedAt }),
      service.continueDraft(d2.id, { statement: "B" }, "bob", { expectedUpdatedAt: d2.updatedAt }),
    ]);
    expect(a.status).toBe("fulfilled");
    expect(b.status).toBe("fulfilled");
    // Beide Leser standen zugleich vor dem Tor — verschiedene Kennungen sperren einander nicht.
    expect(tor.gleichzeitig).toBe(2);
  });

  it("NACH dem Konflikt: wer neu lädt, schreibt mit dem aktuellen Stand durch", async () => {
    const service = new CaptureService({ repo: new InMemoryDraftRepo() });
    const { b, gespeichert } = await zweiSchreiber(service);
    // Ohne Tor gewinnt A (erster in der Kette); B holt den Stand neu und schreibt dann.
    expect(b.status).toBe("rejected");
    const neu = await service.continueDraft(
      gespeichert?.id ?? "",
      { statement: "Fassung B, neu geladen" },
      "bob",
      { expectedUpdatedAt: gespeichert?.updatedAt ?? "" },
    );
    expect(neu.payload.statement).toBe("Fassung B, neu geladen");
  });
});
