import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type AppServices,
  assembleServices,
  buildApp,
  inMemoryRepos,
} from "../../services/app/src/build-app";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import type { TxContext } from "../../services/db-tx";
import { InMemoryKoRepo, KoService, type WithTx } from "../../services/knowledge-object";

// ================================================================================================
// JOB 3071 R3 · bens KORREKTURPFLICHT 2 — DIE VORABLESUNG IST EINE ZUGABE, KEINE BEDINGUNG.
// ================================================================================================
//
// Runde 2 hat die Auskunft „hat der Autor selbst zurückgezogen?" richtigerweise VOR die
// Purge-Transaktion gezogen (der Pool darf nicht angesprochen werden, während sie ihn hält) — und
// sie dort dann ROH abgewartet. Damit war eine Nebenauskunft plötzlich eine Vorbedingung der
// Endlöschung. Bens Messungen, wörtlich:
//   `BEN_PURGE http=500 imPapierkorb=true befund=offen`        (die Auskunft lehnte ab)
//   `BEN_PURGE_TIMEOUT ergebnis=blockiert befund=offen`        (die Auskunft schwieg)
// In beiden Fällen blieb der Beitrag im Papierkorb stehen und sein Dublettenbefund offen — wegen
// einer Zusatzangabe ÜBER IHN, die gerade nicht zu haben war.
//
// Nach diesem Auftrag hat die Vorablesung dieselbe Härte wie der Port im Befund-Dienst: sie darf
// werfen, ablehnen oder schweigen; die Endlöschung läuft in jedem Fall zu Ende, mit dem
// systemischen Grund und GENAU EINER Meldung. Und im Transaktionskörper bleibt es dabei bei NULL
// Nachschlägen — das war ja der Grund, warum sie überhaupt vorgezogen wurde.
describe("JOB 3071 R3: eine ausfallende Vorablesung hält die Endlöschung nicht an", () => {
  const AUTORIN = "nora";

  afterEach(() => {
    vi.restoreAllMocks();
  });

  interface Welt {
    services: AppServices;
    txGehalten: () => boolean;
  }

  function aufbau(): Welt {
    const repos = inMemoryRepos();
    const derKontext: TxContext = { brand: "TxContext" };
    let gehalten = false;
    const withTx: WithTx = async (fn) => {
      gehalten = true;
      try {
        return await fn(derKontext);
      } finally {
        gehalten = false;
      }
    };
    const services = assembleServices(repos, { withTx });
    buildApp(services); // die Aufräum-Haken der Endlöschung leben in der Kompositionswurzel
    return { services, txGehalten: () => gehalten };
  }

  /** Läuft der Vorgang zu Ende, oder hängt er? Ohne diese Schranke bliebe der Test selbst stehen. */
  async function laeuftDurch(
    vorgang: Promise<unknown>,
    schranke: number,
  ): Promise<"fertig" | "gescheitert" | "blockiert"> {
    let uhr: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        vorgang.then(
          () => "fertig" as const,
          () => "gescheitert" as const,
        ),
        new Promise<"blockiert">((fertig) => {
          uhr = setTimeout(() => fertig("blockiert"), schranke);
        }),
      ]);
    } finally {
      clearTimeout(uhr);
    }
  }

  async function lageMitOffenemBefund(services: AppServices) {
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
    // Die Autorin legt ihren eigenen Beitrag in den Papierkorb — der Befund bleibt bis zur
    // Endlöschung offen, denn diese Komposition hat keinen Nachlauf am weichen Löschen.
    await services.ko.delete(a.id, AUTORIN);
    expect((await services.overlaps.get(eintrag.id))?.status).toBe("offen");
    return { a, b, eintrag };
  }

  /** KO-, Befund- und Audit-Wirkung, vollständig — der Massstab aus bens Korrekturpflicht 2. */
  async function wirkungIstVollstaendig(
    services: AppServices,
    a: string,
    eintrag: string,
  ): Promise<void> {
    // KO: endgültig weg, nicht mehr im Papierkorb.
    expect(await services.ko.get(a)).toBeUndefined();
    expect((await services.ko.trashed()).map((k) => k.id)).not.toContain(a);
    // Befund: geschlossen, mit dem ehrlichen schwächeren Grund — gelesen wurde nichts.
    const stored = await services.overlaps.get(eintrag);
    expect(stored?.status).toBe("geschlossen");
    expect(stored?.resolution?.reason).toBe("participant_deleted");
    expect(stored?.resolution?.by).toBeNull();
    // Audit: der Endlöschbeleg UND der Beleg am Befund.
    const belege = await services.audit.list({});
    expect(belege.filter((e) => e.action === "ko.purged" && e.target === a)).toHaveLength(1);
    expect(
      belege.filter((e) => e.action === "overlap.participant-removed" && e.target === eintrag),
    ).toHaveLength(1);
  }

  it("die Vorablesung wirft synchron: die Endlöschung läuft trotzdem vollständig durch", async () => {
    const { services, txGehalten } = aufbau();
    const { a, eintrag } = await lageMitOffenemBefund(services);
    const konsole = vi.spyOn(console, "error").mockImplementation(() => undefined);

    let rufeInDerTransaktion = 0;
    services.ko.eigeneRuecknahmeVon = () => {
      if (txGehalten()) {
        rufeInDerTransaktion++;
      }
      throw new Error("Bestand nicht ansprechbar");
    };

    expect(await laeuftDurch(services.ko.purgeTrashed(a.id, "admin"), 2_500)).toBe("fertig");
    await wirkungIstVollstaendig(services, a.id, eintrag.id);
    expect(rufeInDerTransaktion, "im Transaktionskörper wird nie nachgeschlagen").toBe(0);

    const meldungen = konsole.mock.calls.filter((args) => String(args[0]).includes("Rücknahme"));
    expect(meldungen).toHaveLength(1);
    expect(String(meldungen[0]?.[0])).toContain(a.id);
  });

  it("die Vorablesung lehnt ab: die Endlöschung läuft trotzdem vollständig durch", async () => {
    const { services, txGehalten } = aufbau();
    const { a, eintrag } = await lageMitOffenemBefund(services);
    const konsole = vi.spyOn(console, "error").mockImplementation(() => undefined);

    let rufeInDerTransaktion = 0;
    services.ko.eigeneRuecknahmeVon = () => {
      if (txGehalten()) {
        rufeInDerTransaktion++;
      }
      return Promise.reject(new Error("Verbindung verloren"));
    };

    expect(await laeuftDurch(services.ko.purgeTrashed(a.id, "admin"), 2_500)).toBe("fertig");
    await wirkungIstVollstaendig(services, a.id, eintrag.id);
    expect(rufeInDerTransaktion).toBe(0);

    const meldungen = konsole.mock.calls.filter((args) => String(args[0]).includes("Rücknahme"));
    expect(meldungen).toHaveLength(1);
    expect((meldungen[0]?.[1] as Error).message).toBe("Verbindung verloren");
  });

  // Dieser Fall läuft bewusst gegen die VORGABEFRIST der gebauten Komposition (2000 ms) und nicht
  // gegen eine im Test kleingestellte: er soll zeigen, dass die Begrenzung dort wirkt, wo sie im
  // Betrieb steht. Deshalb dauert er rund zwei Sekunden — das ist der gemessene Preis, nicht ein
  // Versehen.
  it("die Vorablesung schweigt: nach der Vorgabefrist läuft die Endlöschung vollständig durch", async () => {
    const { services, txGehalten } = aufbau();
    const { a, eintrag } = await lageMitOffenemBefund(services);
    const konsole = vi.spyOn(console, "error").mockImplementation(() => undefined);

    let rufeInDerTransaktion = 0;
    services.ko.eigeneRuecknahmeVon = () => {
      if (txGehalten()) {
        rufeInDerTransaktion++;
      }
      return new Promise<string | null>(() => undefined);
    };

    expect(await laeuftDurch(services.ko.purgeTrashed(a.id, "admin"), 8_000)).toBe("fertig");
    await wirkungIstVollstaendig(services, a.id, eintrag.id);
    expect(rufeInDerTransaktion).toBe(0);

    const meldungen = konsole.mock.calls.filter((args) => String(args[0]).includes("Rücknahme"));
    expect(meldungen).toHaveLength(1);
    expect((meldungen[0]?.[1] as Error).message).toContain("2000 ms");
  }, 30_000);

  // Die Frist ist übergebbar — sonst wäre sie im Betrieb nicht kalibrierbar und in Tests nur mit
  // Wartezeit messbar. Hier zusätzlich der Beleg, dass die ausgefallene Auskunft als `null` in den
  // Haken reist und die Endlöschung ihn WIRKLICH noch erreicht.
  it("die Frist ist übergebbar, und die ausgefallene Auskunft reist als null in den Haken", async () => {
    const audit = new AuditService({ repo: new InMemoryAuditRepo() });
    const meldungen: string[] = [];
    const ko = new KoService({
      repo: new InMemoryKoRepo(),
      audit,
      ruecknahmeFrist: 30,
      onError: (context) => meldungen.push(context),
    });
    const gesehen: ({ zurueckgezogenVon: string | null } | undefined)[] = [];
    ko.setPurgeTxCleanup(async (_koId, _actor, _tx, ruecknahme) => {
      gesehen.push(ruecknahme);
      return { ueberschneidungenGeschlossen: 0 };
    });
    const a = await ko.create({
      title: "Ventil V3 zuerst",
      statement: "Bei Überdruck Ventil V3 schließen.",
      type: "best_practice",
      category: "Anlage 1",
      author: AUTORIN,
    });
    await ko.delete(a.id, AUTORIN);
    ko.eigeneRuecknahmeVon = () => new Promise<string | null>(() => undefined);

    const begonnen = Date.now();
    expect(await laeuftDurch(ko.purgeTrashed(a.id, "admin"), 1_000)).toBe("fertig");
    // Die übergebene Frist gilt, nicht die Vorgabe von 2000 ms.
    expect(Date.now() - begonnen).toBeLessThan(1_500);

    expect(gesehen).toEqual([{ zurueckgezogenVon: null }]);
    expect(meldungen).toHaveLength(1);
    expect(meldungen[0]).toContain(a.id);
    expect(await ko.get(a.id)).toBeUndefined();
    expect(await ko.trashed()).toEqual([]);
  });
});
