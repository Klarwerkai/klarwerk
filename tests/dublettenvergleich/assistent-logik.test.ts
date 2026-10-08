// ================================================================================================
// AUFNAHME 20260922 · GESAMT-DUBLETTENVERGLEICH — DIE LOGIK DES ASSISTENTEN, OHNE DOM.
// ================================================================================================
//
// `apps/web/src/lib/dublettenZusammenfuehrung.ts` entscheidet, was die Fläche zeigt und was nach der
// Freigabe an den Server geht. Gemessen werden die Zusagen aus R-1107, R-0201 und R-0565:
//   · der Vorschlag für den Führungsartikel ist erklärt und umkehrbar,
//   · je Feld ist sichtbar, ob es übereinstimmt, abweicht oder nur eine Seite es trägt,
//   · die Vorschau erfindet nichts und nennt, was nicht übernommen wird,
//   · der Auftrag trägt die ausdrückliche Freigabe und nur Werte beider Seiten,
//   · ein Autor einer Seite bekommt den Assistenten gesperrt, mit Grund.
import { describe, expect, it } from "vitest";
import type { KnowledgeObject, OverlapEntry } from "../../apps/web/src/api/types";
import {
  ASSISTENT_SCHRITTE,
  auftragAus,
  fassungGeaendert,
  feldLage,
  fliesstextLage,
  fuehrungsVorschlag,
  listenPositionen,
  startAuswahl,
  umschalten,
  vorschau,
  zusammenfuehrenGesperrt,
} from "../../apps/web/src/lib/dublettenZusammenfuehrung";

function ko(teil: Partial<KnowledgeObject> & { id: string }): KnowledgeObject {
  return {
    title: `Titel ${teil.id}`,
    statement: `Aussage ${teil.id}`,
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Instandhaltung",
    tags: [],
    confidence: 0.8,
    trust: 0,
    status: "offen",
    version: 1,
    originalAuthor: "autor",
    author: "autor",
    neededValidations: 2,
    assignments: [],
    asset: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    history: [],
    sources: [],
    ...teil,
  } as KnowledgeObject;
}

const quelle = (id: string, label: string) =>
  ({
    id,
    label,
    url: null,
    excerpt: null,
    kind: "external",
    peerValidated: false,
    author: "x",
    at: "2026-08-01T00:00:00.000Z",
  }) as never;

const A = ko({
  id: "a",
  version: 4,
  title: "Pumpe P3 entlüften",
  statement: "Nach dem Anfahren entlüften.",
  conditions: ["Nur bei Stillstand"],
  measures: ["Ventil öffnen"],
  sources: [quelle("qa", "Handbuch P3")],
  createdAt: "2026-05-01T00:00:00.000Z",
});
const B = ko({
  id: "b",
  version: 2,
  title: "Pumpe P3 entlüften",
  statement: "Beim Start Luft ablassen, bis Medium austritt.",
  conditions: ["Nur bei Stillstand", "Mit  Schutzbrille "],
  measures: [],
  sources: [quelle("qb1", "Betriebsanweisung"), quelle("qb2", "Foto")],
  createdAt: "2026-06-01T00:00:00.000Z",
});
type EntryLage = Pick<OverlapEntry, "relation" | "status">;
const ENTRY = { relation: "teilweise", status: "offen" } as EntryLage;

describe("R-1107 · vier Schritte, in fester Reihenfolge", () => {
  it("die Schritte heissen und folgen wie verlangt", () => {
    expect(ASSISTENT_SCHRITTE).toEqual(["fuehrung", "inhalte", "quellen", "vorschau"]);
  });
});

describe("R-1107 · Schritt 1 — der Vorschlag ist erklärt", () => {
  it("der geprüfte Artikel führt vor dem ungeprüften", () => {
    const v = fuehrungsVorschlag(ENTRY, A, { ...B, status: "validiert" });
    expect(v).toEqual({ seite: "b", grundKey: "dublettenvergleich.vorschlag.geprueft" });
  });
  it("ohne Prüfunterschied führt der umfassendere (laut Erkennung)", () => {
    expect(fuehrungsVorschlag({ relation: "b_enthaelt_a" }, A, B).seite).toBe("b");
    expect(fuehrungsVorschlag({ relation: "a_enthaelt_b" }, A, B).grundKey).toBe(
      "dublettenvergleich.vorschlag.umfassender",
    );
  });
  it("sonst der ältere", () => {
    expect(fuehrungsVorschlag(ENTRY, A, B)).toEqual({
      seite: "a",
      grundKey: "dublettenvergleich.vorschlag.aelter",
    });
    expect(fuehrungsVorschlag(ENTRY, B, A).seite).toBe("b");
  });
});

describe("R-0201 · je Feld sichtbar: übereinstimmend, abweichend, unsicher", () => {
  it("feldLage unterscheidet die vier Lagen", () => {
    expect(feldLage("Pumpe  P3", "Pumpe P3")).toBe("gleich");
    expect(feldLage("Pumpe P3", "Pumpe P4")).toBe("abweichend");
    expect(feldLage("Pumpe P3", "  ")).toBe("nur_eine_seite");
    expect(feldLage("", "")).toBe("beide_leer");
  });
  it("Listenpositionen tragen ihre Herkunft, ohne Dopplung, Führungsartikel zuerst", () => {
    expect(listenPositionen(A.conditions, B.conditions)).toEqual([
      { text: "Nur bei Stillstand", herkunft: "beide" },
      { text: "Mit Schutzbrille", herkunft: "aufgehend" },
    ]);
  });
});

describe("R-1107 / R-0201 · Auswahl, Vorschau, Auftrag", () => {
  it("der Anfang: Titel/Kernaussage vom Führungsartikel, Listen als Vereinigung, alle Quellen an", () => {
    expect(startAuswahl("a", A, B)).toEqual({
      fuehrung: "a",
      titel: "fuehrend",
      kernaussage: "fuehrend",
      bedingungen: ["Nur bei Stillstand", "Mit Schutzbrille"],
      massnahmen: ["Ventil öffnen"],
      quellen: ["qb1", "qb2"],
    });
  });

  it("die Vorschau übernimmt nur Gewähltes und nennt das Übrige", () => {
    let auswahl = startAuswahl("a", A, B);
    auswahl = { ...auswahl, kernaussage: "aufgehend" };
    auswahl = {
      ...auswahl,
      bedingungen: umschalten(auswahl.bedingungen, "Mit Schutzbrille", [
        "Nur bei Stillstand",
        "Mit Schutzbrille",
      ]),
      quellen: ["qb1"],
    };
    const v = vorschau(A, B, auswahl);
    expect(v.titel).toBe(A.title);
    expect(v.kernaussage).toBe(B.statement);
    expect(v.bedingungen).toEqual(["Nur bei Stillstand"]);
    expect(v.quellen.map((q) => q.id)).toEqual(["qa", "qb1"]); // die eigene Quelle bleibt IMMER
    expect(v.neueFassung).toBe(5);
    expect(v.nichtUebernommen.bedingungen).toEqual(["Mit Schutzbrille"]);
    expect(v.nichtUebernommen.quellen.map((q) => q.id)).toEqual(["qb2"]);
  });

  it("der Auftrag trägt die ausdrückliche Freigabe, die gesehenen Fassungen und nur Vorhandenes", () => {
    const auswahl = { ...startAuswahl("b", A, B), quellen: ["qa"] };
    const auftrag = auftragAus(A, B, auswahl, "  Vermerk  ");
    expect(auftrag).toEqual({
      fuehrend: { id: "b", version: 2 },
      aufgehend: { id: "a", version: 4 },
      titel: "fuehrend",
      kernaussage: "fuehrend",
      bedingungen: ["Nur bei Stillstand", "Mit Schutzbrille"],
      massnahmen: ["Ventil öffnen"],
      quellen: ["qa"],
      bestaetigt: true,
      vermerk: "Vermerk",
    });
  });
});

describe("Nacharbeit 2 (Ben, R-0201) · der Fliesstext reist sichtbar mit der Kernaussage", () => {
  const MIT_RUMPF_A = { ...A, bodyHtml: "<p>Ventil V2 zuerst öffnen.</p>" };
  const MIT_RUMPF_B = { ...B, bodyHtml: "<p>Erst Auffangschale, dann Ventil.</p>" };

  it("die Vorschau zeigt den Fliesstext, der wirklich entsteht — je nach Kernaussagenwahl", () => {
    const start = startAuswahl("a", MIT_RUMPF_A, MIT_RUMPF_B);
    expect(vorschau(MIT_RUMPF_A, MIT_RUMPF_B, start).fliesstext).toBe(MIT_RUMPF_A.bodyHtml);
    const gewechselt = { ...start, kernaussage: "aufgehend" as const };
    const v = vorschau(MIT_RUMPF_A, MIT_RUMPF_B, gewechselt);
    expect(v.fliesstext).toBe(MIT_RUMPF_B.bodyHtml);
    expect(v.nichtUebernommen.fliesstextFuehrend).toBe(true);
  });

  it("ohne Fliesstext der Gegenseite wird der bisherige ersetzt — auch das steht in der Vorschau", () => {
    const auswahl = { ...startAuswahl("a", MIT_RUMPF_A, B), kernaussage: "aufgehend" as const };
    const v = vorschau(MIT_RUMPF_A, { ...B, bodyHtml: null }, auswahl);
    expect(v.fliesstext).toBeNull();
    expect(v.nichtUebernommen.fliesstextFuehrend).toBe(true);
  });

  it("fliesstextLage vergleicht den lesbaren Text, nicht das Markup", () => {
    expect(fliesstextLage("<p>Ventil öffnen</p>", "<div>Ventil öffnen</div>")).toBe("gleich");
    expect(fliesstextLage("<p>Ventil öffnen</p>", "<p>Ventil schließen</p>")).toBe("abweichend");
    expect(fliesstextLage(null, "<p>x</p>")).toBe("nur_eine_seite");
  });
});

describe("Nacharbeit 2 (Ben, R-0201) · die Freigabe gilt den gesehenen Fassungen", () => {
  it("eine neue Fassung einer Seite wird erkannt", () => {
    expect(fassungGeaendert({ a: A, b: B }, { a: A, b: B })).toBe(false);
    expect(fassungGeaendert({ a: A, b: B }, { a: { ...A, version: 5 }, b: B })).toBe(true);
    expect(fassungGeaendert({ a: A, b: B }, { a: A, b: { ...B, version: 3 } })).toBe(true);
  });
  it("der Auftrag trägt die Fassungen, aus denen er gebaut wurde", () => {
    const auftrag = auftragAus(A, B, startAuswahl("a", A, B));
    expect(auftrag.fuehrend.version).toBe(4);
    expect(auftrag.aufgehend.version).toBe(2);
  });
});

describe("R-0565 · der Assistent ist kuratorisch", () => {
  const lage = (teil: Partial<Parameters<typeof zusammenfuehrenGesperrt>[0]>) =>
    zusammenfuehrenGesperrt({
      userId: "kurator",
      role: "controller",
      entry: { status: "offen" },
      a: A,
      b: B,
      ...teil,
    });

  it("ein Kurator, der keine Seite verfasst hat, darf", () => {
    expect(lage({})).toBeNull();
    expect(lage({ role: "admin" })).toBeNull();
  });
  it("wer eine Seite verfasst hat, ist gesperrt — auch als Admin", () => {
    expect(lage({ userId: "autor" })).toBe("eigeneSeite");
    expect(lage({ userId: "autor", role: "admin" })).toBe("eigeneSeite");
    expect(lage({ b: { ...B, author: "kurator" } })).toBe("eigeneSeite");
  });
  it("ohne Prüfrecht, bei geschlossenem, aufgegangenem oder redigiertem Paar ist gesperrt", () => {
    expect(lage({ role: "experte" })).toBe("keinRecht");
    expect(lage({ entry: { status: "geschlossen" } })).toBe("geschlossen");
    expect(
      lage({ a: { ...A, mergedInto: { koId: "x", version: 1, overlapId: "o", at: "", by: "" } } }),
    ).toBe("aufgegangen");
    expect(lage({ entry: { status: "offen", redacted: true } })).toBe("redigiert");
  });
});
