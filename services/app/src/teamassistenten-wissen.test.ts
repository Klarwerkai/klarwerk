import { describe, expect, it, vi } from "vitest";
import {
  AskError,
  type AskResult,
  type AskService,
  bindeAntworttext,
  bindungsQuelleAus,
} from "../../ask";
import type { SessionUser } from "../../auth";
import type { Conflict } from "../../conflicts";
import { type KnowledgeObject, halbwertszeitenAusVerlauf } from "../../knowledge-object";
import {
  type TeamDefinition,
  type TeamSprache,
  baueTeamassistentWissen,
  pruefeTeamAntwortVorAuslieferung,
} from "./teamassistenten-wissen";

const ohneLernwerte = async () => halbwertszeitenAusVerlauf([]);
const user: SessionUser = {
  id: "lea",
  role: "viewer",
  freigabe: "intern",
  spaceLesbar: new Set(["service"]),
};
const beispiel: TeamDefinition = {
  name: "Service",
  aufgabe: "Field service",
  quellen: ["a"],
  beispiele: [],
};
const guest = "Guest Wi-Fi must not provide access to the internal staff network.";

function artikel(statement: string, extras: Partial<KnowledgeObject> = {}): KnowledgeObject {
  return {
    id: "a",
    title: "Handbook",
    statement,
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Service",
    tags: [],
    confidence: 90,
    trust: 90,
    status: "validiert",
    version: 3,
    originalAuthor: "team",
    author: "team",
    neededValidations: 1,
    assignments: [],
    asset: null,
    createdAt: new Date().toISOString(),
    history: [],
    comments: [],
    attachments: [],
    sources: [],
    confidentiality: "intern",
    ...extras,
  };
}

function wissen(
  artikel: KnowledgeObject[],
  konflikte: Conflict[] = [],
  ask?: Pick<AskService, "ask"> &
    Partial<Pick<AskService, "kiStand" | "kiSperreVorFrage" | "kiSperreVorAuslieferung">>,
) {
  return baueTeamassistentWissen({
    ko: {
      gelernteHalbwertszeiten: ohneLernwerte,
      get: async (id) => artikel.find((ko) => ko.id === id),
    },
    conflicts: { unresolved: async () => konflikte },
    ...(ask
      ? {
          ask: {
            kiStand: () => 0,
            kiSperreVorFrage: () => {},
            kiSperreVorAuslieferung: () => {},
            ...ask,
          },
        }
      : {}),
  });
}

function modellAntwort(ko: KnowledgeObject): AskResult {
  const result: AskResult["result"] = {
    answer: ko.statement,
    answered: true,
    knowledgeClass: "gesichert",
    trust: 90,
    sources: [ko.id],
    citedSources: [ko.id],
    captionSources: [],
    steps: [],
    demo: false,
  };
  const aussagen = bindeAntworttext(result, new Map([[ko.id, bindungsQuelleAus(ko, undefined)]]));
  if (!aussagen) throw new Error("Testquelle ist unbelegt");
  return {
    result,
    aussagen,
    answerId: null,
    gap: null,
    receipt: "",
    quellenStand: { [ko.id]: ko.version },
  };
}

describe("Wissensgrundlage der Teamassistenten", () => {
  it("belegt den vollständigen Satz mit Version und wortgenauem Direktlink", async () => {
    const w = wissen([artikel("Summary", { bodyHtml: `<p>${guest}</p>` })]);
    const ergebnis = await w.fragen(user, beispiel, guest, "en");
    expect(ergebnis.stand).toBe("belegt");
    expect(ergebnis.text).toContain(guest);
    const quelle = ergebnis.quellen[0];
    expect(quelle).toMatchObject({ id: "a", version: 3, auszug: guest });
    const url = new URL(quelle?.href ?? "", "http://klarwerk.test");
    expect(url.searchParams.get("fassung")).toBe("3");
    expect(url.searchParams.get("stelle")).toBe(guest);
  });

  it.each([
    [
      "de",
      "Die Bestellung erfordert eine Unterschrift.",
      "Die Bestellung erfordert keine Unterschrift.",
      "Die Bestellung erfordert keine andere Freigabe.",
    ],
    [
      "nl",
      "De bestelling vereist een handtekening.",
      "De bestelling vereist geen handtekening.",
      "De bestelling vereist geen ander besluit.",
    ],
  ] as const)(
    "unterscheidet eine verneinte Anforderung von einem anderen Gegenstand (%s)",
    async (sprache, regel, gegen, anders) => {
      const w = wissen([artikel(regel)]);
      expect((await w.fragen(user, beispiel, gegen, sprache)).stand).toBe("widerspruch");
      expect((await w.fragen(user, beispiel, anders, sprache)).stand).toBe("offen");
    },
  );

  it.each<[TeamSprache, string, string, string, string]>([
    [
      "de",
      "Der Gästerechner darf den Drucker nicht nutzen.",
      "Darf der Gästerechner den Drucker nutzen?",
      "Darf der Gästerechner den Drucker nicht nutzen?",
      "Nein.",
    ],
    [
      "en",
      guest,
      "Must guest Wi-Fi provide access to the internal staff network?",
      "Must guest Wi-Fi not provide access to the internal staff network?",
      "No.",
    ],
    [
      "nl",
      "De bezoeker mag de printer niet gebruiken.",
      "Mag de bezoeker de printer gebruiken?",
      "Mag de bezoeker de printer niet gebruiken?",
      "Nee.",
    ],
  ])("prüft echte Ja-/Nein-Fragen in %s", async (sprache, satz, gegen, gleich, nein) => {
    const w = wissen([artikel(satz)]);
    const a = await w.fragen(user, beispiel, gegen, sprache);
    expect(a.stand).toBe("widerspruch");
    expect(a.text.startsWith(nein)).toBe(true);
    expect((await w.fragen(user, beispiel, gleich, sprache)).stand).toBe("belegt");
  });

  it("beantwortet die Fristfrage eines Mitarbeiters ohne wortgleichen Fragesatz", async () => {
    const s = "Travel expenses must be submitted within 14 days of returning.";
    const w = wissen([artikel(s)]);
    const a = await w.fragen(
      user,
      beispiel,
      "How long do I have to submit my travel expenses?",
      "en",
    );
    expect(a).toMatchObject({ stand: "belegt", quellen: [{ auszug: s }] });
    expect(
      (await w.fragen(user, beispiel, "How long do I have to submit my dental expenses?", "en"))
        .stand,
    ).toBe("offen");
    expect(
      (await w.fragen(user, beispiel, "Travel expenses may be paid in diamonds.", "en")).stand,
    ).toBe("offen");
  });

  it("nutzt den konfigurierten fachlichen Schwerpunkt bei gleich passenden Fundstellen", async () => {
    const ko1 = artikel("The warranty lasts 2 years.", { title: "Hardware" });
    const ko2 = artikel("The warranty lasts 5 years.", { id: "b", title: "Software" });
    const w = wissen([ko1, ko2]);
    const frage = "What is the warranty?";
    for (const [aufgabe, quelle] of [
      ["Hardware", "a"],
      ["Software", "b"],
    ] as const) {
      const a = await w.fragen(user, { ...beispiel, quellen: ["a", "b"], aufgabe }, frage, "en");
      expect(a.quellen.map((q) => q.id)).toEqual([quelle]);
    }
  });

  it("unterscheidet fehlende Deckung von einer gegenteiligen Aussage und ignoriert Beispielurteile als Antwortquelle", async () => {
    const w = wissen([artikel(guest), artikel("Diamonds are mandatory.", { id: "outside" })]);
    const d: TeamDefinition = {
      ...beispiel,
      beispiele: [{ frage: "Diamonds are mandatory.", erwartet: "belegt" }],
    };
    expect(await w.fragen(user, d, "Diamonds are mandatory.", "en")).toMatchObject({
      stand: "offen",
      quellen: [],
    });
    expect((await w.fragen(user, d, guest.replace("must not", "must"), "en")).stand).toBe(
      "widerspruch",
    );
    expect((await w.fragen(user, d, guest.replace("staff", "vendor"), "en")).stand).toBe("offen");
  });

  it("verbirgt fremde, nicht freigegebene, veraltete und nachträglich entzogene Quellen", async () => {
    const geheim = artikel("Restricted.", { id: "b", spaceId: "finanzen" });
    const ungueltig: Partial<KnowledgeObject>[] = [
      { status: "offen" },
      { deletedAt: "2026-01-01" },
      { createdAt: "2010-01-01" },
      { confidentiality: "streng_vertraulich" },
      { spaceId: "finanzen" },
      { quellrechte: { stufe: "intern", leser: ["jemand-anders"] } },
      { schutzdatenQuarantaene: { seit: "2026-01-01", arten: ["personalnummer"] } },
    ];
    for (const extras of ungueltig) {
      const w = wissen([artikel(guest, extras)]);
      expect(await w.quellstand(user, beispiel)).toBeNull();
      expect(await w.fragen(user, beispiel, guest, "en")).toMatchObject({
        stand: "offen",
        quellen: [],
      });
    }
    const d = { ...beispiel, quellen: ["a", "b"] };
    const w = wissen([artikel(guest), geheim]);
    expect(await w.quellstand(user, d)).toBeNull();
    expect((await w.fragen(user, d, guest, "en")).quellen.map((q) => q.id)).toEqual(["a"]);
    expect((await w.fragen(user, d, guest, "en", { a: 2, b: 3 })).stand).toBe("offen");
    const get = vi
      .fn()
      .mockResolvedValueOnce(artikel(guest))
      .mockResolvedValueOnce(artikel(guest, { spaceId: "finanzen" }));
    const wechsel = baueTeamassistentWissen({
      ko: { get, gelernteHalbwertszeiten: ohneLernwerte },
      conflicts: { unresolved: async () => [] },
    });
    expect(await wechsel.fragen(user, beispiel, guest, "en")).toMatchObject({
      stand: "offen",
      quellen: [],
    });
  });

  it("beachtet die gelernte Kategorienfrist beim Binden, Fragen und nochmals vor der Ausgabe", async () => {
    const datum = (tage: number) => new Date(Date.now() - tage * 86_400_000).toISOString();
    const ko = artikel(guest, { createdAt: datum(50) });
    const kurz = halbwertszeitenAusVerlauf(
      [1, 2, 3].map((n) => ({
        koId: String(n),
        ende: datum(70),
        erfasst: datum(69),
        kategorie: "service",
        tage: 30,
        oeffentlich: true,
      })),
    );
    const lesen = vi.fn(ohneLernwerte).mockResolvedValue(kurz);
    const w = baueTeamassistentWissen({
      ko: { get: async () => ko, gelernteHalbwertszeiten: lesen },
      conflicts: { unresolved: async () => [] },
    });
    expect(await w.quellstand(user, beispiel)).toBeNull();
    expect(await w.fragen(user, beispiel, guest, "en")).toMatchObject({
      stand: "offen",
      quellen: [],
    });
    lesen.mockResolvedValueOnce(halbwertszeitenAusVerlauf([]));
    expect(await w.fragen(user, beispiel, guest, "en")).toMatchObject({
      stand: "offen",
      quellen: [],
    });
  });

  it("vergleicht identische und verschiedene Beträge, lässt mehrdeutige Gruppierungen offen", async () => {
    const w = wissen([artikel("The device costs 100.00 euros.")]);
    for (const [betrag, stand] of [
      ["100", "belegt"],
      ["100,00", "belegt"],
      ["120", "widerspruch"],
      ["100.000", "offen"],
    ] as const) {
      expect(
        (await w.fragen(user, beispiel, `The device costs ${betrag} euros.`, "en")).stand,
      ).toBe(stand);
    }
  });

  it("erklärt den aktuellen Widerspruch aus zwei freigegebenen und lesbaren Artikeln", async () => {
    const a = artikel("Delivery takes six days.");
    const b = artikel("Delivery takes two days.", { id: "b" });
    const k: Conflict = {
      id: "k",
      createdAt: new Date().toISOString(),
      koA: "a",
      koB: "b",
      koAVersion: 3,
      koBVersion: 3,
      type: "truth",
      description: "Lieferdauer",
      status: "offen",
      secondOpinion: null,
      decidedBy: null,
      decision: null,
    };
    const d = { ...beispiel, quellen: ["a", "b"] };
    for (const [artikelB, version, stand] of [
      [b, 3, "widerspruch"],
      [{ ...b, spaceId: "finanzen" }, 3, "belegt"],
      [b, 2, "belegt"],
    ] as const) {
      const w = wissen([a, artikelB], [{ ...k, koBVersion: version }]);
      for (const eingabe of ["What is the delivery?", "Delivery takes six days."]) {
        const antwort = await w.fragen(user, d, eingabe, "en");
        expect(antwort.stand).toBe(stand);
        expect(antwort.quellen.map((q) => q.id)).toEqual(stand === "belegt" ? ["a"] : ["a", "b"]);
      }
    }
  });

  it("verwirft bei KI-Abschaltung vor dem Modellaufruf sowie zwischen Antwort und Auslieferung", async () => {
    const ko = artikel(guest);
    const frage = "How should I set up internet access for visiting contractors?";
    let epoche = 0;
    const tor = (start: number | undefined) => {
      if (start !== epoche) throw new AskError("KI_ABGESCHALTET", "Ausgeschaltet");
    };
    const ask = vi.fn(async () => modellAntwort(ko));
    const w = wissen([ko], [], {
      ask,
      kiStand: () => epoche,
      kiSperreVorFrage: tor,
      kiSperreVorAuslieferung: tor,
    });
    expect(
      (
        await w.fragen(user, beispiel, frage, "en", { a: 3 }, async () => {
          epoche++;
        })
      ).stand,
    ).toBe("offen");
    expect(ask).not.toHaveBeenCalled();
    const antwort = await w.fragen(user, beispiel, frage, "en", { a: 3 }, async () => {});
    expect(antwort.stand).toBe("belegt");
    epoche++;
    expect(pruefeTeamAntwortVorAuslieferung(antwort)).toMatchObject({
      stand: "offen",
      quellen: [],
    });
    expect(JSON.stringify(antwort)).not.toContain("Auslieferung");
  });

  it("nutzt bei freier Sachfrage den regulären eingegrenzten Ask-Weg und seine wortgebundene Fundstelle", async () => {
    const ko = artikel(guest);
    const fremd = artikel("Other.", { id: "outside" });
    const getModel = vi.fn<AskService["ask"]>(
      async (_frage, _user, _sprache, optionen, sichtbar) => {
        expect(optionen?.validatedOnly).toBe(true);
        expect(sichtbar?.(ko)).toBe(true);
        expect(sichtbar?.(fremd)).toBe(false);
        expect(sichtbar?.({ ...ko, version: 4 })).toBe(false);
        expect(sichtbar?.({ ...ko, spaceId: "finanzen" })).toBe(false);
        return modellAntwort(ko);
      },
    );
    const w = wissen([ko, fremd], [], { ask: getModel });
    const pruefe = vi.fn(async () => {});
    const frage = "How should I set up internet access for visiting contractors?";
    const a = await w.fragen(user, beispiel, frage, "en", { a: 3 }, pruefe);
    expect(pruefe).toHaveBeenCalledOnce();
    expect(a).toMatchObject({
      stand: "belegt",
      quellen: [{ id: ko.id, version: 3, auszug: guest }],
    });
    getModel.mockResolvedValueOnce(modellAntwort(fremd));
    expect(await w.fragen(user, beispiel, frage, "en", { a: 3 }, pruefe)).toMatchObject({
      stand: "offen",
      quellen: [],
    });
    expect(
      await w.fragen(user, { ...beispiel, sachfragen: false }, frage, "en", { a: 3 }, pruefe),
    ).toMatchObject({ stand: "offen" });
    expect(
      await w.fragen(user, { ...beispiel, sachfragen: false }, guest, "en", { a: 3 }, pruefe),
    ).toMatchObject({ stand: "belegt" });
    expect(getModel).toHaveBeenCalledTimes(2);
  });
});
