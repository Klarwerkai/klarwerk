import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { askRoutes } from "../../services/app/src/routes/ask-routes";
import { AskService, InMemoryGapRepo } from "../../services/ask";
import { getippteAussage } from "../../services/ask/src/getippte-aussage";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import { ModelProvider, Reasoner } from "../../services/reasoner";
import { mitKiFreigabe } from "../../services/reasoner/src/testhelfer-ki-freigabe";

const karte = {
  titel: "Prüfblatt für die Eintrittskarte",
  beleg:
    "Nur für diesen Test: Die Eintrittskarte für das fiktive Puppentheater trägt einen violetten Stern.",
  falsch:
    "Nur für diesen Test: Die Eintrittskarte für das fiktive Puppentheater trägt einen grünen Stern.",
  frage: "Stimmt diese Aussage laut dem Pilottest zur Eintrittskarte für das Puppentheater?",
  locale: "de",
} as const;
const vuurtoren = {
  titel: "De voet van de vuurtorenmaquette",
  beleg: "Uitsluitend voor deze pilot: de voet van de fictieve vuurtorenmaquette is zeshoekig.",
  falsch: "Uitsluitend voor deze pilot: de voet van de fictieve vuurtorenmaquette is driehoekig.",
  frage: "Klopt deze uitspraak volgens de pilottest over de vuurtorenmaquette?",
  locale: "nl",
} as const;

async function aufbau(antwort: { urteil: string; belege: string }) {
  const ko = new KoService({ repo: new InMemoryKoRepo() });
  await ko.activateSearchProjectionV2();
  const quellen = await Promise.all(
    [karte, vuurtoren].map(async (fall) => {
      const objekt = await ko.create({
        title: fall.titel,
        statement: fall.beleg,
        type: "best_practice",
        category: "Technical",
        author: "pilot",
        confidentiality: "intern",
      });
      await ko.setValidationState(objekt.id, { status: "validiert", trust: 90 });
      return objekt;
    }),
  );
  await ko.create({
    title: karte.titel,
    statement: karte.falsch,
    type: "best_practice",
    category: "Technical",
    author: "pilot",
    confidentiality: "intern",
  });
  const prompts: string[] = [];
  const reasoner = new Reasoner(
    new ModelProvider({
      name: "cloud:openai:test",
      complete: async (_system, prompt) => {
        prompts.push(prompt);
        return JSON.stringify(antwort);
      },
    }),
  );
  await reasoner.setTaskConfig(mitKiFreigabe({ global: "openai", perTask: {} }));
  const ask = new AskService({ koService: ko, reasoner, gaps: new InMemoryGapRepo() });
  const app = Fastify();
  app.register(
    askRoutes({ ask, ko, conflicts: { unresolved: async () => [] } as never }, {
      requireUser: async () => ({ id: "pilot", role: "admin" }),
      requirePermission: async () => ({ id: "pilot", role: "admin" }),
    } as never),
  );
  await app.ready();
  return { app, prompts, quellen };
}

describe("Klara, ohne Dokument fragen", () => {
  it.each(
    [karte, vuurtoren].flatMap((fall) =>
      [true, false].map((stimmt) => ({
        fall,
        stimmt,
        bezeichnung: `${fall.locale} ${stimmt ? "richtig" : "falsch"}`,
      })),
    ),
  )(
    "prüft $bezeichnung über den normalen HTTP-Eingang gegen die freigegebene Fassung",
    async ({ fall, stimmt }) => {
      // Nur der Modelltransport ist kontrolliert. Auswahl, Rechte, Quellenprüfung, Fassung
      // und Auslieferung durchlaufen den produktiven HTTP-Pfad, einschließlich Gesprächsfaden.
      const art = stimmt ? "bestaetigt" : "widersprochen";
      const { app, prompts, quellen } = await aufbau({ urteil: art, belege: `${fall.beleg} [1]` });
      try {
        const aussage = stimmt ? fall.beleg : fall.falsch;
        const frage = `${fall.frage} ${fall.locale === "de" ? "„" : "“"}${aussage}${fall.locale === "de" ? "“" : "”"}`;
        const res = await app.inject({
          method: "POST",
          url: "/api/ask",
          payload: {
            question: frage,
            locale: fall.locale,
            getippteAussagePruefen: true,
            thread: ["Welche Temperatur gilt am Ventil F3?"],
          },
        });
        expect(res.statusCode, res.body).toBe(200);
        const antwort = res.json();
        const id = quellen.find((q) => q.title === fall.titel)?.id;
        expect(id).toBeDefined();
        expect(antwort.result).toMatchObject({
          answered: true,
          dokumentUrteil: { art },
          citedSources: [id],
        });
        expect(antwort.result.answer).toContain(fall.beleg);
        expect(antwort.quellenStand).toEqual({ [id!]: 1 });
        expect(prompts).toHaveLength(1);
        expect(prompts[0]).toContain(aussage);
        expect(prompts[0]).not.toContain("Ventil F3");
        expect(prompts[0]).toContain(`[1] ${fall.titel}: ${fall.beleg}`);
        expect(prompts[0]).not.toContain(`: ${karte.falsch}`);
      } finally {
        await app.close();
      }
    },
  );

  it("gibt einem reinen Suchaufruf auch mit dem freien Schalter keinen Modellzugang", async () => {
    const { app, prompts } = await aufbau({ urteil: "bestaetigt", belege: `${karte.beleg} [1]` });
    try {
      const res = await app.inject({
        method: "POST",
        url: "/api/ask",
        payload: {
          question: `${karte.frage} „${karte.falsch}“`,
          getippteAussagePruefen: true,
          mode: "retrieval-only",
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().result.dokumentUrteil).toBeUndefined();
      expect(prompts).toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  it.each([
    ["belegloses Modellurteil", "bestaetigt", "Die Eintrittskarte trägt einen Stern aus Gold. [1]"],
    ["Wortlaut ohne Urteil", "sachfrage", `${karte.beleg} [1]`],
  ])("lässt %s offen", async (_name, urteil, belege) => {
    const { app } = await aufbau({ urteil, belege });
    try {
      const res = await app.inject({
        method: "POST",
        url: "/api/ask",
        payload: {
          question: `${karte.frage} „${karte.falsch}“`,
          getippteAussagePruefen: true,
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().result).toMatchObject({ answered: false, citedSources: [] });
      expect(res.json().result.dokumentUrteil).toBeUndefined();
    } finally {
      await app.close();
    }
  });
  it.each([
    [
      "Is the following claim correct according to company knowledge? “The lamps use amber glass.”",
      "The lamps use amber glass.",
    ],
    ["Stimmt es, dass alle Lampen gelb leuchten?", "alle Lampen gelb leuchten"],
    ["Klopt het dat de lampen geel zijn?", "de lampen geel zijn"],
    ["Is it true that the lamps are yellow?", "the lamps are yellow"],
  ])("trennt den Auftrag von der konkret getippten Behauptung: %s", (frage, aussage) => {
    expect(getippteAussage(frage)?.aussage).toBe(aussage);
  });
  it.each([
    "Wer hat „Das Prüfblatt“ freigegeben?",
    "Is this correct?",
    "Klopt dit? “ ”",
    "Is that not correct? “The lamps are yellow.”",
    "Wie viele Lampen sind im Lager?",
  ])(
    "lässt eine allgemeine Frage oder einen fehlenden Sachbezug im normalen Frageweg: %s",
    (frage) => expect(getippteAussage(frage)).toBeUndefined(),
  );
});
