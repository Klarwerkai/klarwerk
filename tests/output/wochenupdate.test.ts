// ================================================================================================
// RECHERCHE:pmo-fea-0004 (aufnahme:20260922:gesamt-wochenupdate) — AUFNAHME UND AUSGABEFORMAT.
// ================================================================================================
//
// Gemessen am Dienst selbst (`services/output/src/wochenupdate.ts`), ohne HTTP:
//   · AUFNAHME — nur validiert, nur nicht vertraulich; „neu" = im Zeitraum erfasst, „überarbeitet"
//     = früher erfasst, im Zeitraum neue Fassung; alles ausserhalb der sieben Tage bleibt draussen.
//   · AUSGABEFORMAT — Titel, Zeitraum, Zählzeile, Prüfhinweis, Kein-Versand-Satz, die Abschnitte,
//     die Rückfragen bei niedrigem Vertrauen und der Herkunftsblock; ein leerer Zeitraum sagt das.
//   · KEIN VERSAND — der Dienst liest ausschliesslich (`list`), er schreibt und verschickt nichts.
// Die HTTP-Tür misst `wochenupdate-route.test.ts`.
import { describe, expect, it } from "vitest";
import { InMemoryKoRepo, type KnowledgeObject, KoService } from "../../services/knowledge-object";
import {
  OUTPUT_NO_CHECK_NOTE,
  WOCHENUPDATE_KEIN_VERSAND,
  WOCHENUPDATE_TITEL,
  WochenupdateService,
} from "../../services/output";

function ko(p: Partial<KnowledgeObject> & { id: string }): KnowledgeObject {
  return {
    title: p.id,
    statement: `Aussage ${p.id}`,
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Anlage 1",
    tags: [],
    confidence: 0,
    trust: 80,
    status: "validiert",
    version: 1,
    originalAuthor: "anna",
    author: "anna",
    neededValidations: 3,
    assignments: [],
    asset: null,
    confidentiality: "intern",
    createdAt: "2026-01-01T08:00:00.000Z",
    history: [{ version: 1, at: "2026-01-01T08:00:00.000Z", author: "anna", note: "erstellt" }],
    ...p,
  } as KnowledgeObject;
}

// Heute = Freitag, 09.10.2026 → Zeitraum 03.10. bis 09.10. (sieben Tage einschliesslich).
const JETZT = Date.parse("2026-10-09T15:30:00Z");

const BESTAND = [
  ko({
    id: "NEU",
    title: "Ventil schließen",
    statement: "Bei Überdruck zuerst das Hauptventil schließen.",
    conditions: ["Druck über 6 bar"],
    measures: ["Hauptventil zudrehen", "Druck ablassen"],
    createdAt: "2026-10-07T09:00:00.000Z",
    author: "bob",
    originalAuthor: "bob",
  }),
  ko({ id: "RANDBEGINN", title: "Erster Tag", createdAt: "2026-10-03T00:00:01.000Z" }),
  ko({
    id: "UEBERARBEITET",
    title: "Schmierplan",
    version: 3,
    createdAt: "2026-09-01T08:00:00.000Z",
    history: [
      { version: 1, at: "2026-09-01T08:00:00.000Z", author: "anna", note: "erstellt" },
      { version: 2, at: "2026-10-04T10:00:00.000Z", author: "anna", note: "überarbeitet" },
      { version: 3, at: "2026-10-08T10:00:00.000Z", author: "anna", note: "überarbeitet" },
    ],
  }),
  ko({ id: "UNSICHER", title: "Lagerkühlung", trust: 40, createdAt: "2026-10-05T12:00:00.000Z" }),
  ko({ id: "ALT", title: "Alte Regel", createdAt: "2026-10-02T23:59:59.000Z" }),
  ko({
    id: "ALT_UEBERARBEITET",
    title: "Vor dem Zeitraum überarbeitet",
    version: 2,
    createdAt: "2026-08-01T08:00:00.000Z",
    history: [
      { version: 1, at: "2026-08-01T08:00:00.000Z", author: "anna", note: "erstellt" },
      { version: 2, at: "2026-09-20T08:00:00.000Z", author: "anna", note: "überarbeitet" },
    ],
  }),
  ko({ id: "OFFEN", title: "Noch offen", status: "offen", createdAt: "2026-10-08T08:00:00.000Z" }),
  ko({
    id: "GEHEIM",
    title: "Vertrauliche Rezeptur",
    confidentiality: "vertraulich",
    createdAt: "2026-10-08T08:00:00.000Z",
  }),
  ko({
    id: "STRENG",
    title: "Streng vertraulich",
    confidentiality: "streng_vertraulich",
    createdAt: "2026-10-08T08:00:00.000Z",
  }),
  ko({ id: "SPAETER", title: "Nach dem Zeitraum", createdAt: "2026-10-10T08:00:00.000Z" }),
];

async function dienst(kos: KnowledgeObject[] = BESTAND) {
  const repo = new InMemoryKoRepo();
  for (const k of kos) {
    await repo.insert(k);
  }
  const echt = new KoService({ repo });
  // Jede Methode, die der Dienst am KoService anfasst, wird mitgeschrieben.
  const aufrufe: string[] = [];
  const koService = new Proxy(echt, {
    get(ziel, name, empfaenger) {
      const wert = Reflect.get(ziel, name, empfaenger);
      if (typeof wert === "function") {
        return (...args: unknown[]) => {
          aufrufe.push(String(name));
          return wert.apply(ziel, args);
        };
      }
      return wert;
    },
  });
  return { svc: new WochenupdateService({ koService, now: () => JETZT }), aufrufe, repo };
}

describe("RECHERCHE:pmo-fea-0004 · Aufnahme", () => {
  it("nimmt im Zeitraum Erfasstes als neu und im Zeitraum neu Gefasstes als überarbeitet auf", async () => {
    const { svc } = await dienst();
    const u = await svc.erzeuge();
    expect(u.von).toBe("2026-10-03");
    expect(u.bis).toBe("2026-10-09");
    expect(u.eintraege.map((e) => [e.koId, e.art, e.am])).toEqual([
      ["UEBERARBEITET", "ueberarbeitet", "2026-10-08"],
      ["NEU", "neu", "2026-10-07"],
      ["UNSICHER", "neu", "2026-10-05"],
      ["RANDBEGINN", "neu", "2026-10-03"],
    ]);
  });

  it("lässt Offenes, Vertrauliches und alles ausserhalb der sieben Tage draussen", async () => {
    const { svc } = await dienst();
    const u = await svc.erzeuge();
    const drin = new Set(u.eintraege.map((e) => e.koId));
    for (const id of ["ALT", "ALT_UEBERARBEITET", "OFFEN", "GEHEIM", "STRENG", "SPAETER"]) {
      expect(drin.has(id), id).toBe(false);
    }
    for (const verboten of ["Noch offen", "Vertrauliche Rezeptur", "Streng vertraulich"]) {
      expect(u.markdown).not.toContain(verboten);
    }
  });

  it("ein gewähltes `bis` verschiebt den Zeitraum — Späteres zählt dann nicht", async () => {
    const { svc } = await dienst();
    const u = await svc.erzeuge({ bis: "2026-10-05" });
    expect([u.von, u.bis]).toEqual(["2026-09-29", "2026-10-05"]);
    expect(u.eintraege.map((e) => [e.koId, e.art])).toEqual([
      ["UNSICHER", "neu"],
      ["UEBERARBEITET", "ueberarbeitet"],
      ["RANDBEGINN", "neu"],
      ["ALT", "neu"],
    ]);
    expect(u.eintraege.find((e) => e.koId === "UEBERARBEITET")?.am).toBe("2026-10-04");
  });

  it("weist ein unlesbares `bis` ab, statt einen Zeitraum zu raten", async () => {
    const { svc } = await dienst();
    for (const bis of ["09.10.2026", "2026-02-30", "morgen", 20261009]) {
      await expect(svc.erzeuge({ bis })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
  });
});

describe("RECHERCHE:pmo-fea-0004 · Ausgabeformat", () => {
  it("Kopf, Prüfhinweis, Kein-Versand-Satz, Abschnitte und Herkunft in fester Reihenfolge", async () => {
    const { svc } = await dienst();
    const md = (await svc.erzeuge()).markdown;
    const reihenfolge = [
      `# ${WOCHENUPDATE_TITEL}`,
      "_Zeitraum: 2026-10-03 bis 2026-10-09 · erzeugt am 2026-10-09T15:30:00.000Z · 3 neu validiert · 1 überarbeitet_",
      OUTPUT_NO_CHECK_NOTE,
      WOCHENUPDATE_KEIN_VERSAND,
      "## Neu validiert",
      "### 1. Ventil schließen",
      "## Überarbeitet",
      "### 1. Schmierplan (jetzt v3)",
      "## Fürs Gespräch: noch unsicher",
      "- Lagerkühlung (Trust 40)",
      "## Herkunft & Nachweis",
    ];
    let ab = -1;
    for (const teil of reihenfolge) {
      const stelle = md.indexOf(teil, ab + 1);
      expect(stelle, `fehlt oder steht falsch: ${teil}`).toBeGreaterThan(ab);
      ab = stelle;
    }
  });

  it("je Erkenntnis Kernaussage, Bedingung, Maßnahme und Einordnung — ohne Personen im Rumpf", async () => {
    const { svc } = await dienst();
    const md = (await svc.erzeuge()).markdown;
    expect(md).toContain("Bei Überdruck zuerst das Hauptventil schließen.");
    expect(md).toContain("- **Wann es gilt:** Druck über 6 bar");
    expect(md).toContain("- **Was zu tun ist:** Hauptventil zudrehen; Druck ablassen");
    expect(md).toContain("_Anlage 1 · best_practice · erfasst am 2026-10-07 · Trust 80_");
    expect(md).toContain("überarbeitet am 2026-10-08");
    expect(md).toContain("⚠︎ niedriges Vertrauen");
    // Personen stehen nur im Herkunftsblock (wie bei jedem Output), nicht im Überblick.
    const rumpf = md.slice(0, md.indexOf("## Herkunft & Nachweis"));
    expect(rumpf).not.toContain("bob");
    expect(md.slice(md.indexOf("## Herkunft & Nachweis"))).toContain("`NEU`");
  });

  it("ein Zeitraum ohne neues Wissen sagt das — ohne leere Abschnitte und ohne Herkunftsblock", async () => {
    const { svc } = await dienst([ko({ id: "ALT", createdAt: "2026-01-01T08:00:00.000Z" })]);
    const u = await svc.erzeuge();
    expect(u.eintraege).toEqual([]);
    expect(u.provenance).toEqual([]);
    expect(u.markdown).toContain(
      "In diesem Zeitraum ist kein neues oder überarbeitetes validiertes Wissen hinzugekommen.",
    );
    expect(u.markdown).toContain(WOCHENUPDATE_KEIN_VERSAND);
    expect(u.markdown).not.toContain("## Neu validiert");
    expect(u.markdown).not.toContain("## Herkunft & Nachweis");
  });
});

describe("RECHERCHE:pmo-fea-0004 · kein Versand, keine Schreibwirkung", () => {
  it("der Dienst liest nur — der Bestand ist danach Zeichen für Zeichen derselbe", async () => {
    const { svc, aufrufe, repo } = await dienst();
    const vorher = structuredClone(await repo.list({}));
    await svc.erzeuge();
    await svc.erzeuge({ bis: "2026-10-05" });
    expect([...new Set(aufrufe)]).toEqual(["list"]);
    expect(await repo.list({})).toEqual(vorher);
  });
});
