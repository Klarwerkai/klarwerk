// ================================================================================================
// R-1175 (aufnahme:20260922:gesamt-rechte-inventar) · Nacharbeit 3 — DIE DIENSTWEGE FAHREN DIE EINE
// SICHTBARKEITSENTSCHEIDUNG, GEMESSEN AM VERHALTEN.
// ================================================================================================
//
// Der Lesewege-Sammler (`mega74-lesewege-sammler.test.ts`) weist im Syntaxbaum nach, dass die Route
// `sichtbarkeitsfilterFuer` bildet und der Dienst den übergebenen Filter aufruft. Diese Datei misst
// an zwei Stellvertretern, dass das auch WIRKT: ein nicht vertraulicher Eintrag in einem Space, den
// der Betrachter nicht lesen darf, verlässt den Output-Weg nicht mehr (vorher entschied dort allein
// die Vertraulichkeitsstufe), und der Schlüssel-Betrachter von `/api/ask` sieht genau das, was die
// alte Zeile („ohne Space oder offener Space") durchliess — ohne Vertrauliches.
import { describe, expect, it } from "vitest";
import type { SessionUser } from "../../services/app/src/http";
import {
  darfSehen,
  schluesselBetrachter,
  sichtbarkeitsfilterFuer,
} from "../../services/app/src/sichtbarkeit";
import { InMemoryKoRepo, type KnowledgeObject, KoService } from "../../services/knowledge-object";
import { OutputService } from "../../services/output";

function ko(p: Partial<KnowledgeObject> & { id: string }): KnowledgeObject {
  return {
    title: p.id,
    statement: "Aussage",
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
    createdAt: "2026-01-01",
    history: [],
    ...p,
  } as KnowledgeObject;
}

async function aufbau(): Promise<OutputService> {
  const repo = new InMemoryKoRepo();
  await repo.insert(ko({ id: "OFFEN" }));
  await repo.insert(ko({ id: "GESCHLOSSEN", spaceId: "space-geschlossen" } as never));
  return new OutputService({ koService: new KoService({ repo }) });
}

const LESER: SessionUser = { id: "lena", role: "viewer", spaceLesbar: new Set<string>() };

describe("R-1175 · Output-Weg fährt die zentrale Sichtbarkeitsentscheidung", () => {
  it("die Quellenliste lässt den Eintrag aus dem fremden Space weg — ohne Betrachter bleibt er", async () => {
    const output = await aufbau();
    const mitSicht = await output.listEligible(sichtbarkeitsfilterFuer(LESER));
    expect(mitSicht.map((q) => q.id)).toEqual(["OFFEN"]);
    // GEGENPROBE: ohne die Entscheidung (Systemaufruf) wäre er da — die Wirkung kommt von ihr.
    const ohneSicht = await output.listEligible();
    expect(ohneSicht.map((q) => q.id).sort()).toEqual(["GESCHLOSSEN", "OFFEN"]);
  });

  it("das Erzeugen antwortet für den unsichtbaren Eintrag wie für einen unbekannten", async () => {
    const output = await aufbau();
    const sicht = sichtbarkeitsfilterFuer(LESER);
    await expect(
      output.generate({ kind: "instruction", koIds: ["GESCHLOSSEN"] }, sicht),
    ).rejects.toMatchObject({ code: "UNKNOWN_KO" });
    await expect(
      output.generate({ kind: "instruction", koIds: ["GIBT-ES-NICHT"] }, sicht),
    ).rejects.toMatchObject({ code: "UNKNOWN_KO" });
    // GEGENPROBE: der sichtbare Eintrag erzeugt ein Dokument.
    await expect(
      output.generate({ kind: "instruction", koIds: ["OFFEN"] }, sicht),
    ).resolves.toMatchObject({ kind: "instruction" });
  });

  // Nacharbeit 18 (Integration main): das Wissensupdate (RECHERCHE:pmo-fea-0004) kam mit main und
  // filterte nur nach Status und Vertraulichkeit — der Titel aus dem fremden Space stand im Update.
  it("das Wissensupdate nennt den Eintrag aus dem fremden Space nicht — ohne Betrachter bleibt er", async () => {
    const output = await aufbau();
    const zeitraum = { bis: "2026-01-03" };
    const mitSicht = await output.wochenupdate(zeitraum, sichtbarkeitsfilterFuer(LESER));
    expect(mitSicht.eintraege.map((e) => e.koId)).toEqual(["OFFEN"]);
    expect(mitSicht.markdown).not.toContain("GESCHLOSSEN");
    expect(mitSicht.provenance.map((p) => p.koId)).toEqual(["OFFEN"]);
    // GEGENPROBE: ohne die Entscheidung (Systemaufruf) wäre er da — die Wirkung kommt von ihr.
    const ohneSicht = await output.wochenupdate(zeitraum);
    expect(ohneSicht.eintraege.map((e) => e.koId).sort()).toEqual(["GESCHLOSSEN", "OFFEN"]);
  });
});

describe("R-1175 · der Schlüssel-Betrachter von /api/ask", () => {
  const offen = new Set(["space-offen"]);
  const betrachter = schluesselBetrachter(offen);
  const faelle: Array<[string, Partial<KnowledgeObject>, boolean]> = [
    ["ohne Space, intern", { confidentiality: "intern" }, true],
    ["offener Space", { spaceId: "space-offen" } as never, true],
    ["geschlossener Space", { spaceId: "space-zu" } as never, false],
    ["vertraulich", { confidentiality: "vertraulich" }, false],
    ["vertraulich, Autor leer", { confidentiality: "vertraulich", author: "" }, false],
  ];
  for (const [name, felder, erwartet] of faelle) {
    it(`${name} → ${erwartet ? "sichtbar" : "verborgen"}`, () => {
      expect(darfSehen(betrachter, ko({ id: name, ...felder }))).toBe(erwartet);
    });
  }
});
