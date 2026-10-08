// ================================================================================================
// R-0466 · DAS INTERAKTIONSGEDÄCHTNIS — DER DIENST MIT GESTELLTER UHR.
// ================================================================================================
//
// Originalpunkt: „Frühere Fragen, Antworten und Vorlieben sollen als eigenes Gedächtnis geführt
// werden — mit Herkunft, Aufbewahrungsfrist und Vertraulichkeit."
//
// Geprüft wird je Satzteil am Dienst (`GedaechtnisDienst` + Speicherablage):
//   · Fragen/Antworten und Vorlieben → zwei Arten, jede mit ihren Pflichtfeldern;
//   · Herkunft                      → eigene Eingabe ODER eine GEPRÜFTE eigene Antwort; fremd,
//                                      System und unbekannt werden abgewiesen;
//   · Aufbewahrungsfrist            → nur wählbare Fristen; nach Ablauf nicht mehr geliefert und
//                                      vom Aufräumlauf endgültig gelöscht;
//   · Vertraulichkeit               → drei Stufen, ohne Angabe `vertraulich`.
import { describe, expect, it } from "vitest";
import {
  GEDAECHTNIS_MAX_EINTRAEGE,
  GedaechtnisDienst,
  GedaechtnisFehler,
  InMemoryGedaechtnisRepo,
} from "../../services/app/src/interaktionsgedaechtnis";
import { InMemoryAnswerSnapshotRepo } from "../../services/ask";

const START = Date.parse("2026-10-08T08:00:00.000Z");
const TAG = 24 * 60 * 60 * 1000;
const ANNA = "u-anna";
const BERT = "u-bert";

function aufbau() {
  let jetzt = START;
  let laufend = 0;
  const repo = new InMemoryGedaechtnisRepo();
  const antworten = new InMemoryAnswerSnapshotRepo();
  const dienst = new GedaechtnisDienst({
    repo,
    antworten,
    jetzt: () => jetzt,
    neueId: () => {
      laufend += 1;
      return `g-${laufend}`;
    },
  });
  return {
    repo,
    antworten,
    dienst,
    stelle: (ms: number) => {
      jetzt = ms;
    },
  };
}

async function fehlerVon(versuch: Promise<unknown>): Promise<GedaechtnisFehler> {
  try {
    await versuch;
  } catch (fehler) {
    if (fehler instanceof GedaechtnisFehler) {
      return fehler;
    }
    throw fehler;
  }
  throw new Error("Der Versuch hätte abgewiesen werden müssen.");
}

describe("R-0466 · Fragen, Antworten und Vorlieben als eigenes Gedächtnis", () => {
  it("eine Vorliebe trägt Herkunft, Frist und Vertraulichkeit — ohne Angabe 90 Tage, vertraulich", async () => {
    const { dienst } = aufbau();
    const e = await dienst.merken(ANNA, { art: "vorliebe", inhalt: "  Antworten bitte knapp.  " });
    expect(e).toEqual({
      id: "g-1",
      kontoId: ANNA,
      art: "vorliebe",
      inhalt: "Antworten bitte knapp.",
      antwort: null,
      herkunft: { art: "eigene_eingabe", antwortId: null, antwortAm: null },
      vertraulichkeit: "vertraulich",
      aufbewahrungTage: 90,
      angelegtAm: "2026-10-08T08:00:00.000Z",
      verfallAm: new Date(START + 90 * TAG).toISOString(),
    });
    expect(await dienst.eigene(ANNA)).toEqual([e]);
  });

  it("eine Frage mit Antwort hält beides fest; Frist und Vertraulichkeit sind wählbar", async () => {
    const { dienst } = aufbau();
    const e = await dienst.merken(ANNA, {
      art: "frage_antwort",
      inhalt: "Welcher Prüfdruck gilt für Leitung 7?",
      antwort: "Das 1,5-Fache des Betriebsdrucks.",
      vertraulichkeit: "streng_vertraulich",
      aufbewahrungTage: 30,
    });
    expect(e.antwort).toBe("Das 1,5-Fache des Betriebsdrucks.");
    expect(e.vertraulichkeit).toBe("streng_vertraulich");
    expect(e.verfallAm).toBe(new Date(START + 30 * TAG).toISOString());
  });

  it("die Liste ist je Konto getrennt und neueste zuerst", async () => {
    const { dienst, stelle } = aufbau();
    await dienst.merken(ANNA, { art: "vorliebe", inhalt: "erste" });
    stelle(START + 1000);
    await dienst.merken(ANNA, { art: "vorliebe", inhalt: "zweite" });
    await dienst.merken(BERT, { art: "vorliebe", inhalt: "fremde" });
    expect((await dienst.eigene(ANNA)).map((e) => e.inhalt)).toEqual(["zweite", "erste"]);
    expect((await dienst.eigene(BERT)).map((e) => e.inhalt)).toEqual(["fremde"]);
  });
});

describe("R-0466 · Herkunft", () => {
  it("eine eigene Antwort wird als Herkunft übernommen — mit ihrem Zeitpunkt aus dem Datensatz", async () => {
    const { dienst, antworten } = aufbau();
    await antworten.createRecord({
      answerId: "ans-anna",
      askExecutionId: "exec-1",
      createdAt: "2026-10-07T12:00:00.000Z",
      schemaVersion: 1,
      owner: { kind: "user", userId: ANNA },
    });
    const e = await dienst.merken(ANNA, {
      art: "frage_antwort",
      inhalt: "Frage",
      antwort: "Antwort",
      antwortId: "ans-anna",
    });
    expect(e.herkunft).toEqual({
      art: "antwort",
      antwortId: "ans-anna",
      antwortAm: "2026-10-07T12:00:00.000Z",
    });
  });

  it("fremde, System- und unbekannte Antworten werden abgewiesen — gleich, ohne Auskunft", async () => {
    const { dienst, antworten, repo } = aufbau();
    await antworten.createRecord({
      answerId: "ans-bert",
      askExecutionId: "exec-2",
      createdAt: "2026-10-07T12:00:00.000Z",
      schemaVersion: 1,
      owner: { kind: "user", userId: BERT },
    });
    await antworten.createRecord({
      answerId: "ans-system",
      askExecutionId: "exec-3",
      createdAt: "2026-10-07T12:00:00.000Z",
      schemaVersion: 1,
      owner: { kind: "system" },
    });
    for (const antwortId of ["ans-bert", "ans-system", "ans-gibt-es-nicht"]) {
      const fehler = await fehlerVon(
        dienst.merken(ANNA, { art: "frage_antwort", inhalt: "F", antwort: "A", antwortId }),
      );
      expect([fehler.status, fehler.grund, fehler.message]).toEqual([
        404,
        "antwort_unbekannt",
        "Antwort nicht gefunden.",
      ]);
    }
    expect(await repo.eigene(ANNA, new Date(START).toISOString())).toEqual([]);
  });

  it("ohne Antwortablage gibt es keine Herkunft `antwort`", async () => {
    const dienst = new GedaechtnisDienst({ repo: new InMemoryGedaechtnisRepo() });
    const fehler = await fehlerVon(
      dienst.merken(ANNA, { art: "frage_antwort", inhalt: "F", antwort: "A", antwortId: "x" }),
    );
    expect(fehler.status).toBe(404);
  });
});

describe("R-0466 · Aufbewahrungsfrist", () => {
  it("nur die wählbaren Fristen — kein „für immer“ durch eine große Zahl", async () => {
    const { dienst } = aufbau();
    for (const aufbewahrungTage of [0, 7, 3650, "90", -30, 90.5]) {
      const fehler = await fehlerVon(
        dienst.merken(ANNA, { art: "vorliebe", inhalt: "x", aufbewahrungTage }),
      );
      expect([fehler.status, fehler.grund]).toEqual([400, "eingabe"]);
    }
    for (const aufbewahrungTage of [30, 90, 365]) {
      const e = await dienst.merken(ANNA, { art: "vorliebe", inhalt: "x", aufbewahrungTage });
      expect(e.aufbewahrungTage).toBe(aufbewahrungTage);
    }
  });

  it("nach Ablauf wird der Eintrag nicht mehr geliefert und vom Aufräumlauf ENDGÜLTIG gelöscht", async () => {
    const { dienst, repo, stelle } = aufbau();
    await dienst.merken(ANNA, { art: "vorliebe", inhalt: "kurz", aufbewahrungTage: 30 });
    await dienst.merken(ANNA, { art: "vorliebe", inhalt: "lang", aufbewahrungTage: 365 });

    stelle(START + 30 * TAG - 1);
    expect((await dienst.eigene(ANNA)).map((e) => e.inhalt).sort()).toEqual(["kurz", "lang"]);
    expect(await dienst.raeumeAbgelaufeneAuf()).toBe(0);

    // Genau auf der Frist: abgelaufen.
    stelle(START + 30 * TAG);
    expect((await dienst.eigene(ANNA)).map((e) => e.inhalt)).toEqual(["lang"]);
    expect(await dienst.raeumeAbgelaufeneAuf()).toBe(1);

    // Gelöscht, nicht ausgeblendet: auch mit zurückgestellter Uhr kommt er nicht wieder.
    const rest = await repo.eigene(ANNA, new Date(START).toISOString());
    expect(rest.map((e) => e.inhalt)).toEqual(["lang"]);
  });
});

describe("R-0466 · Vertraulichkeit und Eingabeprüfung", () => {
  it("nur die drei Stufen der Wissensobjekte", async () => {
    const { dienst } = aufbau();
    for (const vertraulichkeit of ["geheim", "", 1, "INTERN"]) {
      const fehler = await fehlerVon(
        dienst.merken(ANNA, { art: "vorliebe", inhalt: "x", vertraulichkeit }),
      );
      expect(fehler.status).toBe(400);
    }
    for (const vertraulichkeit of ["intern", "vertraulich", "streng_vertraulich"]) {
      const e = await dienst.merken(ANNA, { art: "vorliebe", inhalt: "x", vertraulichkeit });
      expect(e.vertraulichkeit).toBe(vertraulichkeit);
    }
  });

  it("jede Art verlangt genau ihre Felder", async () => {
    const { dienst } = aufbau();
    const falsch = [
      { art: "notiz", inhalt: "x" },
      { art: "vorliebe", inhalt: "   " },
      { art: "vorliebe", inhalt: "x".repeat(2001) },
      { art: "vorliebe", inhalt: "x", antwort: "eine Vorliebe hat keine Antwort" },
      { art: "vorliebe", inhalt: "x", antwortId: "ans-1" },
      { art: "frage_antwort", inhalt: "Frage ohne Antwort" },
      { art: "frage_antwort", inhalt: "F", antwort: "x".repeat(8001) },
      { art: "frage_antwort", inhalt: "F", antwort: "A", antwortId: "  " },
    ];
    for (const eingabe of falsch) {
      const fehler = await fehlerVon(dienst.merken(ANNA, eingabe));
      expect(fehler.status, JSON.stringify(eingabe)).toBe(400);
    }
    expect(await dienst.eigene(ANNA)).toEqual([]);
  });

  it("das Gedächtnis ist begrenzt; abgelaufene Einträge zählen nicht mit", async () => {
    const { dienst, stelle } = aufbau();
    for (let i = 0; i < GEDAECHTNIS_MAX_EINTRAEGE; i++) {
      await dienst.merken(ANNA, { art: "vorliebe", inhalt: `v${i}`, aufbewahrungTage: 30 });
    }
    const voll = await fehlerVon(dienst.merken(ANNA, { art: "vorliebe", inhalt: "zu viel" }));
    expect([voll.status, voll.grund]).toEqual([409, "voll"]);
    // Ein anderes Konto ist davon unberührt.
    await dienst.merken(BERT, { art: "vorliebe", inhalt: "frei" });
    stelle(START + 30 * TAG);
    await dienst.merken(ANNA, { art: "vorliebe", inhalt: "wieder Platz" });
  });
});

describe("R-0466 · Löschbarkeit", () => {
  it("einzeln und ganz — und nur im eigenen Gedächtnis", async () => {
    const { dienst } = aufbau();
    const a1 = await dienst.merken(ANNA, { art: "vorliebe", inhalt: "a1" });
    await dienst.merken(ANNA, { art: "vorliebe", inhalt: "a2" });
    const b1 = await dienst.merken(BERT, { art: "vorliebe", inhalt: "b1" });

    expect(await dienst.vergessen(ANNA, b1.id)).toBe(false);
    expect((await dienst.eigene(BERT)).map((e) => e.id)).toEqual([b1.id]);

    expect(await dienst.vergessen(ANNA, a1.id)).toBe(true);
    expect(await dienst.vergessen(ANNA, a1.id)).toBe(false);
    expect((await dienst.eigene(ANNA)).map((e) => e.inhalt)).toEqual(["a2"]);

    expect(await dienst.allesVergessen(ANNA)).toBe(1);
    expect(await dienst.eigene(ANNA)).toEqual([]);
    expect((await dienst.eigene(BERT)).map((e) => e.id)).toEqual([b1.id]);
  });
});
