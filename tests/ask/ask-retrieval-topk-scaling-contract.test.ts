import { describe, expect, it } from "vitest";
import { InMemoryGapRepo } from "../../services/ask/src/repo";
import { AskService } from "../../services/ask/src/service";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import type { KnowledgeObject, KoCandidateQuery, KoService } from "../../services/knowledge-object";
import { DEFAULT_TOP_K, Reasoner, queryTokens } from "../../services/reasoner";

// ================================================================================================
// JOB 531 · ASK-TOPK-SCALING — DER SKALIERUNGSVERTRAG DER KANDIDATEN-VORAUSWAHL.
// ================================================================================================
//
// DER BEFUND, DEN DIESER VERTRAG FESTHÄLT. Die Ask-Vorauswahl ist gedeckelt (gut), aber sie war
// darauf angewiesen, dass die Datenquelle RELEVANZ-bewusst deckelt. Genau das tun die beiden
// Adapter UNTERSCHIEDLICH:
//
//   · InMemoryKoRepo.findCandidates sortiert nach (Term-Trefferzahl ↓, validiert, Trust ↓) und
//     schneidet DANACH auf `limit`. Ein hochrelevanter Treffer überlebt den Deckel immer.
//   · PgKoRepo.findCandidates sortiert `ORDER BY (status='validiert') DESC, trust DESC LIMIT n` —
//     OHNE Relevanzmaß. Wächst der Bestand, füllen schwach relevante, validierte Objekte mit
//     hohem Trust das Limit, und der eigentlich passende Treffer fällt aus der Vorauswahl.
//
// Das ist keine Testlücke, sondern eine Verhaltensdifferenz zwischen Test-/Dev-Adapter und dem
// Produktionsadapter: dieselbe Frage, derselbe Bestand, ein anderes Ergebnis — und zwar erst
// AB einer bestimmten Bestandsgröße, also genau dann, wenn niemand mehr hinsieht.
//
// DER VERTRAG, den dieser Test bindet, ist deshalb adapterunabhängig formuliert:
//   Die Vorauswahl von Ask muss einen Treffer, der MEHR Fragetoken abdeckt als die Störer,
//   auch dann erreichen, wenn die Datenquelle ausschließlich nach (validiert, Trust) deckelt.
// Die Deckelung selbst bleibt Pflicht: es wird nie der ganze Bestand geladen.
//
// Der Doppelgänger unten bildet die Pg-Rangfolge exakt nach (ODER-Match, dann validiert/Trust,
// dann hartes Limit). Er ist bewusst kein Mock mit Wunschverhalten, sondern die ehrliche
// Nachbildung des Produktionsadapters.

const FRAGE = "Wie wird der Spezialzylinder SPZ42 gewartet?";
// Die Texte der Objekte werden AUS den echten Fragetoken gebaut. Damit hängt der Vertrag nicht an
// der Stemming-/Stoppwortlogik: er gilt für genau die Terme, die der Service wirklich abschickt.
const TERME = queryTokens(FRAGE);

// So viele schwach relevante Objekte, dass sie jede vernünftige Deckelung allein füllen.
const STOERER = 300;

interface Aufruf {
  terms: readonly string[];
  limit: number;
}

/**
 * Doppelgänger des PRODUKTIONSADAPTERS (PgKoRepo-Semantik):
 * ODER-Treffer über die Terme, Rangfolge (validiert zuerst, Trust absteigend), hartes Limit.
 * KEIN Relevanzmaß — genau das ist der Unterschied zum In-Memory-Adapter.
 */
function pgAehnlicherKoService(bestand: readonly KnowledgeObject[]): {
  koService: KoService;
  aufrufe: Aufruf[];
  geladeneZeilen: () => number;
} {
  const aufrufe: Aufruf[] = [];
  let geladen = 0;
  const koService = {
    findCandidates(query: KoCandidateQuery): Promise<KnowledgeObject[]> {
      const terms = query.terms.map((t) => t.trim().toLowerCase()).filter((t) => t.length > 0);
      aufrufe.push({ terms, limit: query.limit });
      if (terms.length === 0) {
        return Promise.resolve([]);
      }
      const treffer = bestand.filter((ko) => {
        const text = `${ko.title} ${ko.statement}`.toLowerCase();
        return terms.some((term) => text.includes(term));
      });
      const sortiert = [...treffer].sort(
        (a, b) =>
          Number(b.status === "validiert") - Number(a.status === "validiert") || b.trust - a.trust,
      );
      const seite = sortiert.slice(0, Math.max(0, Math.floor(query.limit)));
      geladen += seite.length;
      return Promise.resolve(seite);
    },
    // Der Ask-Pfad darf den Gesamtbestand NIE laden. Ein Aufruf hier ist ein Vertragsbruch.
    list(): Promise<KnowledgeObject[]> {
      throw new Error("ask darf den Gesamtbestand nicht laden (koService.list)");
    },
    // JOB 2614 D3 (Weiterführung): der Refs-Bau liest seither je Kandidat die Suchprojektion
    // (`bodyText` in den Vergleichstext, ask/service.ts). Diese Attrappe misst die QUELLABFRAGEN
    // der Kandidatensuche — der Projektionsread bleibt hier bewusst leer (Refs ohne `bodyText`,
    // wie ein nicht nachgezogener Altbestand) und geht NICHT in die `aufrufe`-Zählung ein.
    searchProjectionOf(): Promise<undefined> {
      return Promise.resolve(undefined);
    },
  } as unknown as KoService;
  return { koService, aufrufe, geladeneZeilen: () => geladen };
}

function ko(
  id: string,
  title: string,
  statement: string,
  status: "validiert" | "offen",
  trust: number,
): KnowledgeObject {
  return { id, title, statement, status, trust } as unknown as KnowledgeObject;
}

function bestandMitEinemPassendenTreffer(): {
  bestand: KnowledgeObject[];
  zielId: string;
} {
  const bestand: KnowledgeObject[] = [];
  const schwacherTerm = TERME[0] ?? "";
  // Störer: treffen NUR den ersten Fragebegriff, sind aber validiert und maximal vertrauenswürdig.
  for (let i = 0; i < STOERER; i += 1) {
    bestand.push(
      ko(
        `stoerer-${i}`,
        `Sammelhinweis ${i}`,
        `Allgemeiner Hinweis ${i} zu ${schwacherTerm} ohne weiteren Zusammenhang.`,
        "validiert",
        99,
      ),
    );
  }
  // Der eigentlich passende Treffer: deckt ALLE Fragebegriffe ab, ist validiert, hat aber einen
  // niedrigeren Trust als die Störer — im reinen (validiert, Trust)-Ranking landet er hinten.
  const zielId = "ziel-spz42";
  bestand.push(
    ko(
      zielId,
      "Spezialzylinder SPZ42 warten",
      `Vor der Wartung ${TERME.join(" ")} drucklos machen und den Druckspeicher entleeren.`,
      "validiert",
      60,
    ),
  );
  return { bestand, zielId };
}

function askMit(koService: KoService) {
  const audit = new AuditService({ repo: new InMemoryAuditRepo() });
  const ask = new AskService({
    reasoner: new Reasoner(),
    koService,
    gaps: new InMemoryGapRepo(),
    audit,
  });
  return { ask, audit };
}

describe("JOB 531: Ask-Kandidatenvorauswahl skaliert adapterunabhängig", () => {
  it("findet den passenden Treffer auch dann, wenn die Datenquelle nur nach (validiert, Trust) deckelt", async () => {
    // Kalibrierung: ohne mehrere Fragebegriffe prüft der Vertrag nichts.
    expect(TERME.length).toBeGreaterThanOrEqual(2);

    const { bestand, zielId } = bestandMitEinemPassendenTreffer();
    const { koService, aufrufe } = pgAehnlicherKoService(bestand);
    const { ask } = askMit(koService);

    const { result, gap } = await ask.ask(FRAGE);

    // Das Nutzerversprechen: der passende Treffer wird gefunden, obwohl 300 hoch-vertrauenswürdige
    // Störer die reine (validiert, Trust)-Rangfolge anführen.
    expect(result.answered).toBe(true);
    expect(result.sources).toEqual([zielId]);
    expect(gap).toBeNull();

    // Die Deckelung bleibt Pflicht: jede Abfrage an die Datenquelle trägt ein hartes Limit, und
    // keine einzelne Abfrage fordert den gesamten Bestand an.
    expect(aufrufe.length).toBeGreaterThan(0);
    for (const aufruf of aufrufe) {
      expect(aufruf.limit).toBeGreaterThan(0);
      expect(aufruf.limit).toBeLessThan(STOERER);
    }
  });

  it("hält die Anzahl der Quellabfragen unabhängig von der Fragelänge beschränkt", async () => {
    const { bestand } = bestandMitEinemPassendenTreffer();
    const { koService, aufrufe } = pgAehnlicherKoService(bestand);
    const { ask } = askMit(koService);

    // Eine absichtlich sehr lange Frage darf die Datenquelle nicht beliebig oft anfragen.
    const langeFrage = `${FRAGE} ${Array.from({ length: 40 }, (_v, i) => `Zusatzbegriff${i}`).join(" ")}`;
    await ask.ask(langeFrage);

    expect(aufrufe.length).toBeGreaterThan(0);
    expect(aufrufe.length).toBeLessThanOrEqual(DEFAULT_TOP_K + 1);
  });

  it("ohne thematischen Treffer bleibt es bei der ehrlichen Wissenslücke (kein Raten, kein Vollscan)", async () => {
    const bestand: KnowledgeObject[] = [];
    for (let i = 0; i < 120; i += 1) {
      bestand.push(
        ko(`filter-${i}`, `Filter F${i} wechseln`, `Filter F${i} tauschen.`, "validiert", 90),
      );
    }
    const { koService } = pgAehnlicherKoService(bestand);
    const { ask } = askMit(koService);

    const { result, gap } = await ask.ask("Wie hoch ist der aktuelle Wechselkurs?");
    expect(result.answered).toBe(false);
    expect(result.sources).toEqual([]);
    expect(gap).not.toBeNull();
  });
});
