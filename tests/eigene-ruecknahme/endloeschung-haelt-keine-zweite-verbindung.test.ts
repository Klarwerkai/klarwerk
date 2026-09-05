import { describe, expect, it } from "vitest";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import type { TxContext } from "../../services/db-tx";
import type { WithTx } from "../../services/knowledge-object";

// ================================================================================================
// JOB 3071 R2 · bens KORREKTURPFLICHT 2 — DIE ENDLÖSCHUNG FRAGT NICHT AM POOL, WÄHREND SIE IHN HÄLT.
// ================================================================================================
//
// Der Vertrag von `PurgeTxCleanup` (knowledge-object/src/service.ts) lässt im Transaktionskörper
// ausschliesslich Anweisungen zu, die auf DEMSELBEN Client fahren wie `repo.delete` und
// `audit.record`. Runde 1 verstiess dagegen: der Rücknahme-Port las über `KoRepo.findById` am POOL,
// mitten in der gehaltenen Transaktion — und der Kommentar dort behauptete, das verlängere die
// gehaltene Sperre nicht. Das war falsch. Bei erschöpftem Pool wartet dieser Lesegang auf eine
// Verbindung, die erst der Commit DERSELBEN Transaktion freigibt; bei Poolgröße 1 wartet er auf
// sich selbst, und die Endlöschung endet nie.
//
// WIE DIESER TEST DIE POOLGRÖSSE 1 OHNE POSTGRES NACHSTELLT — die Regel, die eine Poolgröße von 1
// erzeugt, ist genau eine: solange die Transaktion läuft, ist keine Verbindung mehr frei. Der
// nachgestellte Bestand macht daraus eine Zusage, die nie eingelöst wird — dasselbe, was `pg.Pool`
// dort tut, nur ohne Wartewarteschlange. Ein Lesegang aus dem Transaktionskörper hängt damit; ein
// Lesegang davor läuft.
//
// Die Frist des Ports (Korrekturpflicht 1) rettet diesen Fall AUSDRÜCKLICH NICHT zur Wahrheit: sie
// beendete das Warten zwar, aber mit `participant_deleted` — die eigene Rücknahme wäre im Protokoll
// verloren, und jede Endlöschung kostete die volle Frist. Deshalb wird hier die Herkunft geprüft,
// nicht nur das Ende: der Befund trägt am Schluss `withdrawn_own` mit der Kennung der Autorin.
describe("JOB 3071 R2: die Endlöschung läuft mit einer einzigen Verbindung zu Ende", () => {
  const AUTORIN = "nora";

  function aufbau() {
    const repos = inMemoryRepos();
    const derKontext: TxContext = { brand: "TxContext" };
    let verbindungGehalten = false;

    // Der Bestand mit genau EINER Verbindung: eine Punktabfrage, die kommt, während die Transaktion
    // sie hält, bekommt keine — und wartet.
    const echterFindById = repos.koRepo.findById.bind(repos.koRepo);
    repos.koRepo.findById = (id: string) => {
      if (verbindungGehalten) {
        return new Promise(() => undefined);
      }
      return echterFindById(id);
    };

    const withTx: WithTx = async (fn) => {
      verbindungGehalten = true;
      try {
        return await fn(derKontext);
      } finally {
        verbindungGehalten = false;
      }
    };

    const services = assembleServices(repos, { withTx });
    buildApp(services); // die Aufräum-Haken der Endlöschung leben in der Kompositionswurzel
    return services;
  }

  /** Läuft der Vorgang zu Ende, oder hängt er? Ohne diese Schranke bliebe der Test selbst stehen. */
  async function laeuftDurch(vorgang: Promise<unknown>): Promise<"fertig" | "blockiert"> {
    let uhr: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        vorgang.then(() => "fertig" as const),
        new Promise<"blockiert">((fertig) => {
          uhr = setTimeout(() => fertig("blockiert"), 2_500);
        }),
      ]);
    } finally {
      clearTimeout(uhr);
    }
  }

  it("Poolgröße 1: KO-, Befund- und Audit-Wirkung entstehen vollständig", async () => {
    const services = aufbau();
    const a = await services.ko.create({
      title: "Ventil V3 zuerst",
      statement: "Bei Überdruck Ventil V3 schließen.",
      type: "best_practice",
      category: "Anlage 1",
      author: AUTORIN,
    });
    const b = await services.ko.create({
      title: "Pumpe entlüften",
      statement: "Die Pumpe alle 200 Stunden entlüften.",
      type: "best_practice",
      category: "Anlage 1",
      author: AUTORIN,
    });
    const eintrag = await services.overlaps.createAuto(
      {
        koA: a.id,
        koB: b.id,
        relation: "identisch",
        aspects: [{ beschreibung: "gleiche Anweisung", zitatA: "entlüften", zitatB: "entlüften" }],
        eigenanteilA: "",
        eigenanteilB: "",
        recommendation: "zusammenfuehren",
      },
      { trigger: "manual", method: "deterministic", lexicalScore: 0.95 },
      "system",
    );

    // Die Autorin legt ihren eigenen Beitrag in den Papierkorb (deletedBy === author) …
    await services.ko.delete(a.id, AUTORIN);
    expect((await services.overlaps.get(eintrag.id))?.status).toBe("offen");

    // … und die Endlöschung räumt danach auf, in EINER Transaktion, mit EINER Verbindung.
    expect(await laeuftDurch(services.ko.purgeTrashed(a.id, "admin"))).toBe("fertig");

    // KO-Wirkung: der Beitrag ist endgültig weg (nicht mehr im Papierkorb).
    expect((await services.ko.trashed()).map((k) => k.id)).not.toContain(a.id);
    expect(await services.ko.get(a.id)).toBeUndefined();

    // Befund-Wirkung: geschlossen — und mit der Wahrheit, nicht mit dem Notgrund. Genau das wäre
    // verloren, wenn man den Pool-Lesegang nur mit einer Frist abgeschnitten hätte.
    const stored = await services.overlaps.get(eintrag.id);
    expect(stored?.status).toBe("geschlossen");
    expect(stored?.resolution?.reason).toBe("withdrawn_own");
    expect(stored?.resolution?.by).toBe(AUTORIN);

    // Audit-Wirkung: der Endlöschbeleg UND der Beleg am Befund, beide vorhanden.
    const belege = await services.audit.list({});
    expect(belege.filter((e) => e.action === "ko.purged" && e.target === a.id)).toHaveLength(1);
    expect(
      belege.filter((e) => e.action === "overlap.withdrawn-own" && e.target === eintrag.id),
    ).toHaveLength(1);
  });

  it("die Gegenseite überlebt die Endlöschung unverändert", async () => {
    const services = aufbau();
    const a = await services.ko.create({
      title: "Ventil V3 zuerst",
      statement: "Bei Überdruck Ventil V3 schließen.",
      type: "best_practice",
      category: "Anlage 1",
      author: AUTORIN,
    });
    const b = await services.ko.create({
      title: "Pumpe entlüften",
      statement: "Die Pumpe alle 200 Stunden entlüften.",
      type: "best_practice",
      category: "Anlage 1",
      author: AUTORIN,
    });
    const vorher = await services.ko.get(b.id);

    await services.ko.delete(a.id, AUTORIN);
    expect(await laeuftDurch(services.ko.purgeTrashed(a.id, "admin"))).toBe("fertig");

    expect(await services.ko.get(b.id)).toEqual(vorher);
  });
});
