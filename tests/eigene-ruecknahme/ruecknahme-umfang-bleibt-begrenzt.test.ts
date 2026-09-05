import { describe, expect, it } from "vitest";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import {
  InMemoryOverlapRepo,
  type OverlapEntry,
  type OverlapRepo,
  OverlapService,
} from "../../services/conflicts";
import type { TxContext } from "../../services/db-tx";

// ================================================================================================
// JOB 3071 — DER UMFANGSVERTRAG AUS JOB 3066 GILT WEITER, UND DER PORT WÄCHST NICHT MIT.
// ================================================================================================
//
// JOB 3066 hat den Aufräumweg der Löschung auf EINE mengenbasierte Anweisung gebracht: `closeOpenForKo`
// sucht und schreibt in einem, dazu ein Beleg je geschlossenem Befund (overlap-service.ts:678-692,
// gemessen in tests/aufraeumen-atomar/aufraeumumfang-bleibt-begrenzt.test.ts). Die naheliegende
// Halbheit dieses Auftrags wäre, den Grund JE BEFUND abzuleiten — dann stünde der frisch gebaute
// mengenbasierte Weg wieder in einer Schleife, und der `PurgeTxCleanup`-Vertrag
// (knowledge-object/src/service.ts:248-255) wäre erneut verletzt.
//
// Dieser Fall misst deshalb an n = 5 offenen Befunden DESSELBEN Beitrags:
//   PORT       genau 1 Ruf je LÖSCHUNG (nicht je Befund) — der Grund entsteht einmal.
//   SCHLIESSEN genau 1 Anweisung, mengenbasiert.
//   BELEGE     genau n — die benannte, in JOB 3066 ausdrücklich als Rest ausgewiesene Grenze.
describe("JOB 3071: der Port wird einmal je Löschung gerufen, nicht einmal je Befund", () => {
  class ZaehlendesRepo implements OverlapRepo {
    readonly inner = new InMemoryOverlapRepo();
    schliessAnweisungen = 0;

    insert(entry: OverlapEntry): Promise<void> {
      return this.inner.insert(entry);
    }
    insertIfVersionsCurrent(
      entry: OverlapEntry,
      isCurrent: Parameters<OverlapRepo["insertIfVersionsCurrent"]>[1],
    ): Promise<boolean> {
      return this.inner.insertIfVersionsCurrent(entry, isCurrent);
    }
    supersedeIfOpen(id: string, patch: Partial<OverlapEntry>): Promise<boolean> {
      return this.inner.supersedeIfOpen(id, patch);
    }
    findById(id: string): Promise<OverlapEntry | undefined> {
      return this.inner.findById(id);
    }
    all(): Promise<OverlapEntry[]> {
      return this.inner.all();
    }
    update(entry: OverlapEntry): Promise<void> {
      return this.inner.update(entry);
    }
    closeOpenForKo(
      koId: string,
      patch: Partial<OverlapEntry>,
      tx?: TxContext,
    ): Promise<OverlapEntry[]> {
      this.schliessAnweisungen++;
      return this.inner.closeOpenForKo(koId, patch, tx);
    }
  }

  it("5 offene Befunde: 1 Port-Ruf, 1 Schreibanweisung, 5 Belege", async () => {
    const repo = new ZaehlendesRepo();
    const audit = new AuditService({ repo: new InMemoryAuditRepo() });
    let belege = 0;
    const echtesRecord = audit.record.bind(audit);
    audit.record = async (input, tx) => {
      belege++;
      return echtesRecord(input, tx);
    };
    const portRufe: string[] = [];
    const service = new OverlapService({
      repo,
      audit,
      eigeneRuecknahme: (koId) => {
        portRufe.push(koId);
        return Promise.resolve("nora");
      },
    });

    const n = 5;
    for (let i = 0; i < n; i++) {
      await service.createAuto(
        {
          koA: "ko-a",
          koB: `ko-b-${i}`,
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
    belege = 0; // die Anlagebelege zählen nicht zum Aufräumweg
    repo.schliessAnweisungen = 0;

    expect(await service.onKoRemoved("ko-a", "nora")).toBe(n);

    expect(portRufe, "der Grund wird genau EINMAL je Löschung abgeleitet").toEqual(["ko-a"]);
    expect(repo.schliessAnweisungen, "mengenbasiert: eine Anweisung").toBe(1);
    expect(belege, "ein Beleg je geschlossenem Befund").toBe(n);

    // Und die Wirkung ist an allen fünf dieselbe — inklusive des EINEN Zeitstempels je Vorgang
    // (JOB 3066: der Patch entsteht einmal vor der Anweisung, nicht zweimal je Eintrag).
    const alle = await repo.all();
    expect(alle).toHaveLength(n);
    for (const eintrag of alle) {
      expect(eintrag.resolution?.reason).toBe("withdrawn_own");
      expect(eintrag.resolution?.by).toBe("nora");
    }
    expect(new Set(alle.map((e) => e.resolution?.at)).size).toBe(1);
  });

  // ==============================================================================================
  // JOB 3071 R2 (bens Korrekturpflicht 2): IM TRANSAKTIONSKÖRPER SIND ES NULL RUFE.
  // ==============================================================================================
  //
  // Der Umfangsvertrag von JOB 3066 sagt nicht nur „wie oft", sondern auch „woher": im Fenster einer
  // FREMDEN Transaktion darf nichts am Pool fahren. Der Dienst erzwingt das strukturell und nicht
  // per Verabredung — wer `tx` übergibt, bekommt den Port gar nicht erst gerufen; die Auskunft kann
  // dort NUR vorab gelesen hereinkommen. Ein Verhaltenstest allein sähe das nicht: mit einem
  // schnellen Port sind beide Wege äusserlich gleich.
  it("mit tx: der Port wird NICHT gerufen — die Auskunft kommt vorab gelesen herein", async () => {
    const repo = new ZaehlendesRepo();
    const portRufe: string[] = [];
    const service = new OverlapService({
      repo,
      eigeneRuecknahme: (koId) => {
        portRufe.push(koId);
        return Promise.resolve("nora");
      },
    });
    await service.createAuto(
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
    const derKontext: TxContext = { brand: "TxContext" };

    // (a) mit vorab gelesener Auskunft: die Wahrheit steht im Befund, ohne einen einzigen Port-Ruf.
    expect(
      await service.onKoRemoved("ko-a", "nora", derKontext, { zurueckgezogenVon: "nora" }),
    ).toBe(1);
    expect(portRufe, "im Transaktionskörper fragt der Dienst nicht selbst nach").toEqual([]);
    const [eintrag] = await repo.all();
    expect(eintrag?.resolution?.reason).toBe("withdrawn_own");
    expect(eintrag?.resolution?.by).toBe("nora");
  });

  it("mit tx, aber ohne vorab gelesene Auskunft: kein Port-Ruf, ehrlich der schwächere Grund", async () => {
    const repo = new ZaehlendesRepo();
    const portRufe: string[] = [];
    const service = new OverlapService({
      repo,
      eigeneRuecknahme: (koId) => {
        portRufe.push(koId);
        return Promise.resolve("nora");
      },
    });
    await service.createAuto(
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

    expect(await service.onKoRemoved("ko-a", "nora", { brand: "TxContext" })).toBe(1);

    // Kein Ruf — und deshalb auch keine Behauptung: gelesen wurde nichts.
    expect(portRufe).toEqual([]);
    const [eintrag] = await repo.all();
    expect(eintrag?.resolution?.reason).toBe("participant_deleted");
    expect(eintrag?.resolution?.by).toBeNull();
  });
});
