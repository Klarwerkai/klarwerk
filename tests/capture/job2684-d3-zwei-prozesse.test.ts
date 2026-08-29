// ================================================================================================
// JOB 2684 D3 (R2-17) — ZWEI PROZESSE SIND NICHT EIN PROZESS: der Compare-and-Swap in der Ablage.
// ================================================================================================
//
// BEN an D2, wörtlich: „der kalibrierte Barrieretest belegt, dass zwei gleichzeitig gestartete
// Aufrufe innerhalb einer Service-Instanz genau einen Gewinner haben; er belegt weder zwei
// Service-Instanzen gegen dasselbe Repository noch den ungeschützten Dokumentweg."
//
// Zwei Serverprozesse sind hier ZWEI `CaptureService`-Instanzen — jede mit eigener Sperre im
// Prozess (die einander nicht sehen) — gegen EIN Repository. Das Tor im Repository zwingt beide,
// denselben Stand zu lesen, bevor eine schreibt. Entscheiden kann dann nur noch die Ablage:
// `updateWennStand` schreibt, wenn der gespeicherte Stand noch der gelesene ist (Pg: im WHERE
// derselben Anweisung; Speicher: synchron gespiegelt).
//
//   A · ZWEI INSTANZEN, MIT Stand: genau eine gewinnt, die andere DRAFT_STALE — und der Text der
//       Verliererin steht nirgends.
//   B · KALIBRIERUNG: dieselbe Anordnung mit einer Ablage, die die Bedingung NICHT prüft (der Stand
//       von D2): beide kommen durch, die zweite überschreibt die erste still. Damit ist belegt, dass
//       die Prozesssperre an der Prozessgrenze nichts hält und die Ablage es ist, die entscheidet.
//   C · ZWEI INSTANZEN, OHNE Stand (Mobil/Offline): beide kommen durch, KEIN Feld geht verloren —
//       die Verliererin liest neu, mischt neu, schreibt dann.
//   D · DIE PG-ANWEISUNG, gepinnt: die Bedingung steht im WHERE derselben Anweisung; `rowCount`
//       entscheidet.
//   E · DER DOKUMENTWEG IM STUDIO (Quellpin): `createFromDocument` trägt den gesehenen Stand.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { type DraftRepo, InMemoryDraftRepo } from "../../services/capture/src/repo";
import { DRAFT_UPDATE_WENN_STAND_SQL, PgDraftRepo } from "../../services/capture/src/repo-pg";
import { CaptureService, DraftStaleError } from "../../services/capture/src/service";
import type { Draft } from "../../services/capture/src/types";

/** Ein Tor, das `erwartet` Leser sammelt und dann alle zugleich weiterlässt; danach offen. */
class Tor {
  private wartende: (() => void)[] = [];
  private offen = false;
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

/** Das gemeinsame Repository, mit Tor vor dem Lesen: beide Prozesse lesen denselben Stand. */
class TorRepo extends InMemoryDraftRepo {
  schreibversuche: { erwartet: string; geschrieben: boolean }[] = [];

  constructor(private readonly tor: Tor) {
    super();
  }

  override async findById(id: string): Promise<Draft | undefined> {
    await this.tor.passieren();
    return super.findById(id);
  }

  override async updateWennStand(draft: Draft, erwarteterStand: string): Promise<boolean> {
    const geschrieben = await super.updateWennStand(draft, erwarteterStand);
    this.schreibversuche.push({ erwartet: erwarteterStand, geschrieben });
    return geschrieben;
  }
}

/** KALIBRIERUNG — der Stand von D2: die Ablage prüft die Bedingung nicht, sie schreibt einfach. */
class OhneBedingung extends TorRepo {
  override async updateWennStand(draft: Draft, _erwarteterStand: string): Promise<boolean> {
    await this.update(draft);
    return true;
  }
}

/** Zwei Prozesse: zwei Instanzen, zwei Sperren, ein Repository. */
function zweiProzesse(repo: DraftRepo): [CaptureService, CaptureService] {
  return [new CaptureService({ repo }), new CaptureService({ repo })];
}

async function ueberlappend(
  repo: DraftRepo,
  mitStand: boolean,
): Promise<{
  a: PromiseSettledResult<Draft>;
  b: PromiseSettledResult<Draft>;
  gespeichert: Draft | undefined;
  stand: string;
}> {
  const [p1, p2] = zweiProzesse(repo);
  const draft = await p1.createDraft({ title: "T", statement: "Ursprung" }, "anna");
  const stand = draft.updatedAt; // BEIDE Prozesse haben diesen Stand gesehen.
  const opts = mitStand ? { expectedUpdatedAt: stand } : {};
  const [a, b] = await Promise.allSettled([
    p1.continueDraft(draft.id, { statement: "Fassung aus Prozess 1" }, "anna", opts),
    p2.continueDraft(draft.id, { tags: ["aus-prozess-2"] }, "bob", opts),
  ]);
  const gespeichert = await repo.findById(draft.id);
  return { a, b, gespeichert, stand };
}

describe("JOB 2684 D3 · A · zwei Service-Instanzen gegen dasselbe Repository, mit gesehenem Stand", () => {
  it("genau EINE gewinnt, die andere bekommt DRAFT_STALE mit dem gespeicherten Stand — und ihr Text steht nirgends", async () => {
    const tor = new Tor(2, 30);
    const repo = new TorRepo(tor);
    const { a, b, gespeichert, stand } = await ueberlappend(repo, true);

    // Beide standen zugleich vor dem Tor: zwei Prozesse, keine gemeinsame Sperre.
    expect(tor.gleichzeitig).toBe(2);
    const erfolge = [a, b].filter((r) => r.status === "fulfilled");
    const konflikte = [a, b].filter(
      (r) => r.status === "rejected" && r.reason instanceof DraftStaleError,
    );
    expect(erfolge, `Ergebnisse: ${JSON.stringify([a.status, b.status])}`).toHaveLength(1);
    expect(konflikte).toHaveLength(1);
    const gewinner = (erfolge[0] as PromiseFulfilledResult<Draft>).value;
    expect(gespeichert?.updatedAt).toBe(gewinner.updatedAt);
    expect(gespeichert?.lastEditor).toBe(gewinner.lastEditor);
    // Die Verliererin nennt den Stand, gegen den nach dem Neuladen geschrieben wird.
    const verlierer = (konflikte[0] as PromiseRejectedResult).reason as DraftStaleError;
    expect(verlierer.currentUpdatedAt).toBe(gewinner.updatedAt);
    // Beide haben mit demselben gelesenen Stand geschrieben; die Ablage hat genau einen genommen.
    expect(repo.schreibversuche.map((v) => v.erwartet)).toEqual([stand, stand]);
    expect(repo.schreibversuche.map((v) => v.geschrieben).sort()).toEqual([false, true]);
    // Der Text der Verliererin ist nirgends: entweder Fassung 1 ODER die Tags — nie beides.
    const hatText = gespeichert?.payload.statement === "Fassung aus Prozess 1";
    const hatTags = (gespeichert?.payload.tags ?? []).includes("aus-prozess-2");
    expect(hatText !== hatTags).toBe(true);
  });
});

describe("JOB 2684 D3 · B · KALIBRIERUNG — ohne die Bedingung in der Ablage (der Stand von D2)", () => {
  it("dieselben zwei Prozesse kommen BEIDE durch, und die zweite überschreibt die erste still — die Prozesssperre hält an der Prozessgrenze nichts", async () => {
    const tor = new Tor(2, 30);
    const repo = new OhneBedingung(tor);
    const { a, b, gespeichert } = await ueberlappend(repo, true);
    expect(tor.gleichzeitig).toBe(2);
    expect(a.status).toBe("fulfilled");
    expect(b.status).toBe("fulfilled");
    // Genau der Schaden: ein Schreiber ist trotz „richtigem" Stand überschrieben worden.
    const hatText = gespeichert?.payload.statement === "Fassung aus Prozess 1";
    const hatTags = (gespeichert?.payload.tags ?? []).includes("aus-prozess-2");
    expect(hatText && hatTags, "ohne Bedingung fehlt genau eine der beiden Änderungen").toBe(false);
  });
});

describe("JOB 2684 D3 · C · zwei Prozesse OHNE Stand (Mobil, Offline-Warteschlange)", () => {
  it("beide kommen durch, kein Feld geht verloren: die Verliererin liest neu, mischt neu und schreibt dann", async () => {
    const tor = new Tor(2, 30);
    const repo = new TorRepo(tor);
    const { a, b, gespeichert } = await ueberlappend(repo, false);
    expect(tor.gleichzeitig).toBe(2);
    expect(a.status).toBe("fulfilled");
    expect(b.status).toBe("fulfilled");
    // BEIDE Änderungen stehen im Bestand — kein stilles Überschreiben mehr.
    expect(gespeichert?.payload.statement).toBe("Fassung aus Prozess 1");
    expect(gespeichert?.payload.tags).toEqual(["aus-prozess-2"]);
    // Drei Schreibversuche: zwei mit dem alten Stand (einer verliert), einer mit dem neuen.
    expect(repo.schreibversuche).toHaveLength(3);
    expect(repo.schreibversuche.filter((v) => v.geschrieben)).toHaveLength(2);
  });

  it("und ein Entwurf, der zwischen Lesen und Schreiben verschwindet, ist NOT_FOUND — kein Wiederbeleben durch Neuschreiben", async () => {
    const repo = new InMemoryDraftRepo();
    const [p1] = zweiProzesse(repo);
    const draft = await p1.createDraft({ title: "T", statement: "U" }, "anna");
    const loeschend: DraftRepo = {
      insert: (d) => repo.insert(d),
      findById: async (id) => {
        const d = await repo.findById(id);
        await repo.delete(id);
        return d;
      },
      update: (d) => repo.update(d),
      updateWennStand: (d, s) => repo.updateWennStand(d, s),
      delete: (id) => repo.delete(id),
      list: () => repo.list(),
      // 2684 D6: `listByAuthor` kam mit 2696 in die Schnittstelle — nur durchgereicht, nicht benutzt.
      listByAuthor: (autor) => repo.listByAuthor(autor),
    };
    const p = new CaptureService({ repo: loeschend });
    await expect(p.continueDraft(draft.id, { statement: "X" }, "anna")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(await repo.list()).toEqual([]);
  });
});

describe("JOB 2684 D3 · D · die Pg-Anweisung, gepinnt", () => {
  it("die Bedingung steht im WHERE derselben Anweisung, die schreibt; rowCount entscheidet — 1 = geschrieben, 0 = nicht", async () => {
    expect(DRAFT_UPDATE_WENN_STAND_SQL).toMatch(
      /^UPDATE drafts SET data=\$2 WHERE id=\$1 AND data->>'updatedAt' = \$3$/,
    );
    const gesehen: { sql: string; params: unknown[] }[] = [];
    const poolMit = (rowCount: number) =>
      ({
        query: async (sql: string, params: unknown[]) => {
          gesehen.push({ sql, params });
          return { rows: [], rowCount };
        },
      }) as unknown as ConstructorParameters<typeof PgDraftRepo>[0];
    const draft = {
      id: "d-1",
      payload: { title: "T" },
      originalAuthor: "anna",
      lastEditor: "anna",
      createdAt: "2026-08-29T05:00:00.000Z",
      updatedAt: "2026-08-29T05:00:01.000Z",
    } as Draft;
    expect(
      await new PgDraftRepo(poolMit(1)).updateWennStand(draft, "2026-08-29T05:00:00.000Z"),
    ).toBe(true);
    expect(
      await new PgDraftRepo(poolMit(0)).updateWennStand(draft, "2026-08-29T05:00:00.000Z"),
    ).toBe(false);
    for (const g of gesehen) {
      expect(g.sql).toBe(DRAFT_UPDATE_WENN_STAND_SQL);
      expect(g.params).toEqual(["d-1", JSON.stringify(draft), "2026-08-29T05:00:00.000Z"]);
    }
    // Ehrlich: ob Postgres die Anweisung so ausführt, ist hier NICHT gemessen (kein Postgres in
    // dieser Umgebung) — gepinnt ist der Text und die Auswertung von rowCount.
  });
});

describe("JOB 2684 D3 · E · der Dokumentweg im Studio trägt den Stand (Quellpin, kein Mount)", () => {
  it("`createFromDocument` mit `draftId` sendet `expectedUpdatedAt` aus dem geladenen Stand — derselbe Verweis wie beim Promote", () => {
    // Pfad relativ zur Projektwurzel (vitest läuft dort). Der Dokumentweg braucht importierte
    // Ankerdokumente, die ein gemounteter Test in jsdom nicht erzeugt — deshalb ein Quellpin, als
    // solcher benannt; die Route ist in tests/app/job2684-d3-dokumentweg-route.test.ts belegt.
    const studio = readFileSync("apps/web/src/pages/Capture.tsx", "utf8");
    const aufruf = studio.indexOf(
      "endpoints.ko.createFromDocument({\n            operationId,\n            draftId,",
    );
    expect(aufruf, "der Dokumentweg mit draftId").toBeGreaterThan(0);
    const block = studio.slice(aufruf, studio.indexOf("});", aufruf));
    expect(block).toContain("expectedUpdatedAt: loadedUpdatedAtRef.current");
  });
});
