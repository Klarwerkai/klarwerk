// ================================================================================================
// produkt:20261010:wissenskreislauf-schliessen — DER VORGANG AM ECHTEN DIENST (im Speicher).
// ================================================================================================
//
// Gemessen am `AskService` mit der ECHTEN Validierung (`ValidationService.pruefstandFuer`), dem
// echten Wissensbestand und dem echten Lückenspeicher — keine Attrappe des Prüfstands. Fiktive
// Personen: frida (fragt), fritz (fragt dieselbe Frage), fachmann (zuständig), vera (verwaltet),
// pruefer-* (bewerten).
//
//   A — Fachlicher Abschluss nur mit nutzbarem Eintrag: nicht freigegeben, Verwalterfreigabe ohne
//       Bewertungen, rote Stimme, veränderte Fassung, abgelaufen, kein Zugriff — alles verweigert.
//   B — Mehrere Fragende einer Lücke: eine Lücke, beide zugeordnet, keine fremden Kennungen.
//   C — Doppelaktion: doppelte Zuordnung, doppelter und gleichzeitiger Abschluss → je EIN Eintrag.
//   D — Administrative Rücknahme ist getrennt: kein „gelöst", keine Erfolgsmeldung.
//   E — Meldungen: je Fragendem genau eine; Rechteentzug und neue Fassung → keine Erfolgsmeldung.
//   F — Wiederholungsfrage nutzt denselben gültigen Eintrag; trägt er nicht mehr, wird sie wieder
//       eine Lücke (Wiederaufnahme).
//   G — Rückfrage und Neuzuordnung über die Rollen.
//   H — Überlappende Schritte am Lückendatensatz.
//   I — Neue Fassung, Bewertung oder Neuzuordnung zwischen Fachprüfung und Schreiben des Abschlusses.
//   J — Kein vorläufiger Abschluss: paralleler Zweitaufruf, Lesefehler und Abbruch im Prüffenster.
import { describe, expect, it } from "vitest";
import { AskService, type Gap, type GapRepo, InMemoryGapRepo } from "../../services/ask";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import { InMemoryKoRepo, type KnowledgeObject, KoService } from "../../services/knowledge-object";
import { Reasoner } from "../../services/reasoner";
import {
  InMemoryAssignmentRepo,
  InMemoryRatingRepo,
  ValidationService,
} from "../../services/validation";

const FRAGE = "Wie stelle ich den Kühlkreislauf der Presse Zeta nach dem Stillstand neu ein?";
const ALLE = (): boolean => true;
const ZEHN_JAHRE = 10 * 365 * 24 * 60 * 60 * 1000;

/**
 * Der echte Speicheradapter — mit einer Klammer für die Überlappungsproben (Ben, Nacharbeit 3):
 * `halteLesen(n)` lässt das n-te folgende `findById` den Stand lesen und DANN warten, bis `weiter()`
 * kommt. So lässt sich genau das Fenster zwischen „Stand gelesen" und „geschrieben" öffnen, in dem
 * eine zweite Änderung landet. Ohne Klammer verhält sich die Ablage wie `InMemoryGapRepo`.
 */
class HaltbareAblage extends InMemoryGapRepo {
  private halt: { rest: number; gelesen: () => void; weiter: Promise<void> } | null = null;

  halteLesen(n: number): { gelesen: Promise<void>; weiter: () => void } {
    let weiter: () => void = () => {};
    let gelesen: () => void = () => {};
    const weiterP = new Promise<void>((r) => {
      weiter = r;
    });
    const gelesenP = new Promise<void>((r) => {
      gelesen = r;
    });
    this.halt = { rest: n, gelesen, weiter: weiterP };
    return { gelesen: gelesenP, weiter };
  }

  override async findById(id: string): Promise<Gap | undefined> {
    const stand = await super.findById(id);
    const halt = this.halt;
    if (halt) {
      halt.rest -= 1;
      if (halt.rest === 0) {
        this.halt = null;
        halt.gelesen();
        await halt.weiter;
      }
    }
    return stand;
  }
}

async function buehne(opts: { now?: () => number } = {}) {
  const koService = new KoService({ repo: new InMemoryKoRepo() });
  await koService.activateSearchProjectionV2();
  const audit = new AuditService({ repo: new InMemoryAuditRepo() });
  const validation = new ValidationService({
    koService,
    ratings: new InMemoryRatingRepo(),
    assignments: new InMemoryAssignmentRepo(),
    audit,
  });
  const gaps = new HaltbareAblage();
  // Ben, Nacharbeit 5: dieselbe Klammer am Fachprüfstand. `halteNachPruefstand(n)` lässt die n-te
  // folgende Abfrage ihren Stand ERHEBEN und dann warten — das Fenster zwischen geprüftem Eintrag und
  // Schreiben der Lücke, in dem eine neue Fassung, eine Bewertung oder eine Neuzuordnung landet.
  let pruefstandHalt: { rest: number; gelesen: () => void; weiter: Promise<void> } | null = null;
  const halteNachPruefstand = (n: number): { gelesen: Promise<void>; weiter: () => void } => {
    let weiter: () => void = () => {};
    let gelesen: () => void = () => {};
    const weiterP = new Promise<void>((r) => {
      weiter = r;
    });
    const gelesenP = new Promise<void>((r) => {
      gelesen = r;
    });
    pruefstandHalt = { rest: n, gelesen, weiter: weiterP };
    return { gelesen: gelesenP, weiter };
  };
  const deps = {
    reasoner: new Reasoner(),
    koService,
    gaps,
    audit,
    pruefstand: async (koId: string, v: number) => {
      const stand = await validation.pruefstandFuer(koId, v);
      const halt = pruefstandHalt;
      if (halt) {
        halt.rest -= 1;
        if (halt.rest === 0) {
          pruefstandHalt = null;
          halt.gelesen();
          await halt.weiter;
        }
      }
      return stand;
    },
  };
  const ask = new AskService({ ...deps, ...(opts.now ? { now: opts.now } : {}) });
  // Ein Eintrag, dessen Wortlaut die Frage NICHT trägt — so bleibt die Frage für die Antwortsuche
  // unbeantwortet, und der Vorgang ist der einzige Weg zum Wissen.
  const antwort = await koService.create({
    title: "Kälteanlage im Wiederanlauf hochfahren",
    statement: "Ventil V7 erst bei Druckausgleich öffnen, dann Pumpe P2 starten.",
    type: "best_practice",
    category: "Instandhaltung",
    author: "fachmann",
  });
  const freigeben = async (koId: string, rot = false): Promise<void> => {
    const ko = await koService.get(koId);
    for (let i = 0; i < (ko?.neededValidations ?? 0); i++) {
      await validation.rate(koId, `pruefer-${i}`, "up");
    }
    if (rot) {
      await validation.rate(koId, "pruefer-rot", "down");
    }
  };
  const frage = async (wer: string, sichtbar: (ko: KnowledgeObject) => boolean = ALLE) =>
    ask.ask(FRAGE, wer, "de", undefined, sichtbar);
  return {
    ask,
    koService,
    validation,
    audit,
    gaps,
    antwort,
    freigeben,
    frage,
    deps,
    halteNachPruefstand,
  };
}

const fachmann = { id: "fachmann", verwaltend: false, sichtbar: ALLE };
const frida = { id: "frida", verwaltend: false, sichtbar: ALLE };
const fritz = { id: "fritz", verwaltend: false, sichtbar: ALLE };

describe("A · fachlicher Abschluss nur mit nutzbarem, freigegebenem Eintrag", () => {
  it("A1 ein Entwurf ohne Fachfreigabe schliesst nicht — die Lücke bleibt offen", async () => {
    const b = await buehne();
    const { gap } = await b.frage("frida");
    const id = gap?.id ?? "";
    await expect(b.ask.closeGap(id, b.antwort.id, fachmann)).rejects.toMatchObject({
      code: "BAD_REQUEST",
      gruende: expect.arrayContaining(["nicht_freigegeben", "bewertungen_fehlen"]),
    });
    expect((await b.gaps.findById(id))?.status).toBe("offen");
  });

  it("A2 eine Verwalterfreigabe OHNE die vorgeschriebenen Bewertungen schliesst nicht", async () => {
    const b = await buehne();
    const { gap } = await b.frage("frida");
    await b.validation.adminValidate(b.antwort.id, "vera");
    expect((await b.koService.get(b.antwort.id))?.status).toBe("validiert");
    await expect(b.ask.closeGap(gap?.id ?? "", b.antwort.id, fachmann)).rejects.toMatchObject({
      gruende: ["bewertungen_fehlen"],
    });
  });

  it("A3 eine rote Stimme der aktuellen Fassung sperrt", async () => {
    const b = await buehne();
    const { gap } = await b.frage("frida");
    await b.freigeben(b.antwort.id, true);
    await expect(b.ask.closeGap(gap?.id ?? "", b.antwort.id, fachmann)).rejects.toMatchObject({
      gruende: expect.arrayContaining(["negative_bewertung"]),
    });
  });

  it("A4 alte Bewertungen einer inzwischen veränderten Fassung reichen nicht", async () => {
    const b = await buehne();
    const { gap } = await b.frage("frida");
    await b.freigeben(b.antwort.id);
    await b.koService.revise(b.antwort.id, { statement: "Geänderte Anweisung." }, "fachmann");
    // Selbst eine erneute Verwalterfreigabe der neuen Fassung ersetzt die Bewertungen nicht.
    await b.validation.adminValidate(b.antwort.id, "vera");
    await expect(b.ask.closeGap(gap?.id ?? "", b.antwort.id, fachmann)).rejects.toMatchObject({
      gruende: ["bewertungen_fehlen"],
    });
  });

  it("A5 eine abgelaufene Gültigkeit und ein fehlender Zugriff schliessen nicht", async () => {
    const b = await buehne();
    const { gap } = await b.frage("frida");
    await b.freigeben(b.antwort.id);
    const spaeter = new AskService({ ...b.deps, now: () => Date.now() + ZEHN_JAHRE });
    await expect(spaeter.closeGap(gap?.id ?? "", b.antwort.id, fachmann)).rejects.toMatchObject({
      gruende: ["abgelaufen"],
    });
    const ohneRecht = { id: "fachmann", sichtbar: (): boolean => false };
    await expect(b.ask.closeGap(gap?.id ?? "", b.antwort.id, ohneRecht)).rejects.toMatchObject({
      gruende: ["kein_zugriff"],
    });
    expect((await b.gaps.findById(gap?.id ?? ""))?.status).toBe("offen");
  });

  it("A6 mit vorgeschriebener Freigabe: geschlossen, Fassung festgehalten, Ergebnis verlinkt", async () => {
    const b = await buehne();
    const { gap } = await b.frage("frida");
    await b.freigeben(b.antwort.id);
    const zu = await b.ask.closeGap(gap?.id ?? "", b.antwort.id, fachmann);
    expect(zu.status).toBe("geschlossen");
    expect(zu.abschluss).toMatchObject({ art: "fachlich", koId: b.antwort.id, koVersion: 1 });
    const sicht = await b.ask.gapVorgang(gap?.id ?? "", frida);
    expect(sicht.phase).toBe("geloest");
    expect(sicht.naechsterSchritt).toBe("ergebnis_lesen");
    expect(sicht.ergebnis).toMatchObject({
      koId: b.antwort.id,
      eigentuemer: "fachmann",
      nutzbarkeit: { nutzbar: true, gruen: 3, benoetigt: 3, rot: 0 },
    });
  });
});

describe("B · mehrere Fragende einer wiederholten Lücke", () => {
  it("B1 eine Lücke, beide Fragenden zugeordnet, keine fremde Kennung in der Antwort", async () => {
    const b = await buehne();
    const erste = await b.frage("frida");
    const zweite = await b.frage("fritz");
    expect(zweite.gap?.id).toBe(erste.gap?.id);
    expect(zweite.gap?.askCount).toBe(2);
    // Fritz erfährt nicht, wer zuerst fragte.
    expect(zweite.gap?.createdBy).toBeUndefined();
    expect(JSON.stringify(zweite.gap)).not.toContain("frida");
    const gespeichert = await b.gaps.findById(erste.gap?.id ?? "");
    expect(gespeichert?.weitereFragende).toEqual(["fritz"]);
    // Dieselbe Person noch einmal: keine Kopie.
    await b.frage("fritz");
    expect((await b.gaps.findById(erste.gap?.id ?? ""))?.weitereFragende).toEqual(["fritz"]);
    // Beide sehen ihren Vorgang mit Fragetext, eine Dritte nicht.
    expect((await b.ask.gapVorgang(erste.gap?.id ?? "", fritz)).question).toBe(FRAGE);
    await expect(
      b.ask.gapVorgang(erste.gap?.id ?? "", { id: "dritte", verwaltend: false, sichtbar: ALLE }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const verwaltung = await b.ask.gapVorgang(erste.gap?.id ?? "", {
      id: "vera",
      verwaltend: true,
      sichtbar: ALLE,
    });
    expect(verwaltung.question).toBe("");
    expect(verwaltung.fragende).toBe(2);
  });
});

describe("C · Doppelaktion erzeugt nichts doppelt", () => {
  it("C1 doppelte Zuordnung, doppelter und gleichzeitiger Abschluss", async () => {
    const b = await buehne();
    const { gap } = await b.frage("frida");
    const id = gap?.id ?? "";
    await b.ask.assignGap(id, "fachmann", "vera");
    await b.ask.assignGap(id, "fachmann", "vera");
    expect((await b.gaps.findById(id))?.zuordnungen).toHaveLength(1);
    await b.freigeben(b.antwort.id);
    const [eins, zwei] = await Promise.all([
      b.ask.closeGap(id, b.antwort.id, fachmann),
      b.ask.closeGap(id, b.antwort.id, fachmann),
    ]);
    expect(eins.abschluss).toEqual(zwei.abschluss);
    await b.ask.closeGap(id, b.antwort.id, fachmann);
    expect(await b.audit.list({ action: "gap.closed" })).toHaveLength(1);
    expect(await b.audit.list({ action: "gap.assigned" })).toHaveLength(1);
  });
});

describe("D · administrative Rücknahme bleibt getrennt", () => {
  it("D1 zurückgenommen ist nicht gelöst und meldet keinen Erfolg", async () => {
    const b = await buehne();
    const { gap } = await b.frage("frida");
    const zu = await b.ask.withdrawGap(gap?.id ?? "", "ausser_zustaendigkeit", "vera");
    expect(zu.abschluss).toMatchObject({ art: "administrativ", grund: "ausser_zustaendigkeit" });
    expect(zu.koId).toBeUndefined();
    const sicht = await b.ask.gapVorgang(gap?.id ?? "", frida);
    expect(sicht.phase).toBe("zurueckgenommen");
    expect(sicht.ergebnis).toBeNull();
    expect(await b.ask.gapMeldungenFuer("frida", ALLE)).toEqual([]);
    // Ein Abschluss danach ist keiner: die Lücke ist schon geschlossen.
    await b.freigeben(b.antwort.id);
    await expect(b.ask.closeGap(gap?.id ?? "", b.antwort.id, fachmann)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});

describe("E · Rückmeldung an die Fragenden", () => {
  it("E1 je Fragendem genau eine Erfolgsmeldung mit dem nutzbaren Eintrag", async () => {
    const b = await buehne();
    const { gap } = await b.frage("frida");
    await b.frage("fritz");
    await b.freigeben(b.antwort.id);
    await b.ask.closeGap(gap?.id ?? "", b.antwort.id, fachmann);
    for (const wer of ["frida", "fritz"]) {
      const m = (await b.ask.gapMeldungenFuer(wer, ALLE)).filter((x) => x.art === "geloest");
      expect(m, wer).toHaveLength(1);
      expect(m[0]).toMatchObject({ koId: b.antwort.id, title: b.antwort.title });
    }
    // Ein Neuaufbau (Neustart) leitet dieselbe Kennung ab — keine zweite Meldung.
    const vorher = await b.ask.gapMeldungenFuer("frida", ALLE);
    const nachher = await b.ask.gapMeldungenFuer("frida", ALLE);
    expect(nachher.map((m) => m.id)).toEqual(vorher.map((m) => m.id));
    expect(await b.ask.gapMeldungenFuer("dritte", ALLE)).toEqual([]);
  });

  it("E2 Rechteentzug oder eine neue, ungeprüfte Fassung erzeugen keine Erfolgsmeldung", async () => {
    const b = await buehne();
    const { gap } = await b.frage("frida");
    await b.freigeben(b.antwort.id);
    await b.ask.closeGap(gap?.id ?? "", b.antwort.id, fachmann);
    expect(await b.ask.gapMeldungenFuer("frida", () => false)).toEqual([]);
    const ohneRecht = await b.ask.gapVorgang(gap?.id ?? "", { ...frida, sichtbar: () => false });
    expect(ohneRecht.ergebnis).toEqual({ zugaenglich: false });
    await b.koService.revise(b.antwort.id, { statement: "Neue Anweisung." }, "fachmann");
    expect(await b.ask.gapMeldungenFuer("frida", ALLE)).toEqual([]);
    const sicht = await b.ask.gapVorgang(gap?.id ?? "", frida);
    expect(sicht.ergebnis).toMatchObject({ nutzbarkeit: { nutzbar: false } });
  });
});

describe("F · Wiederholungsfrage", () => {
  it("F1 dieselbe Frage nutzt den gültigen Eintrag — keine neue Lücke", async () => {
    const b = await buehne();
    const { gap } = await b.frage("frida");
    await b.freigeben(b.antwort.id);
    await b.ask.closeGap(gap?.id ?? "", b.antwort.id, fachmann);
    const wieder = await b.frage("fritz");
    expect(wieder.gap).toBeNull();
    expect(wieder.geloesteLuecke).toEqual({
      koId: b.antwort.id,
      koVersion: 1,
      titel: b.antwort.title,
    });
    expect(await b.ask.listGaps()).toHaveLength(1);
  });

  it("F2 trägt der Eintrag nicht mehr (kein Zugriff), wird die Frage wieder eine Lücke", async () => {
    const b = await buehne();
    const { gap } = await b.frage("frida");
    await b.freigeben(b.antwort.id);
    await b.ask.closeGap(gap?.id ?? "", b.antwort.id, fachmann);
    const wieder = await b.frage("fritz", () => false);
    expect(wieder.geloesteLuecke).toBeUndefined();
    expect(wieder.gap?.id).toBeTruthy();
    expect(wieder.gap?.id).not.toBe(gap?.id);
    expect(wieder.gap?.status).toBe("offen");
  });
});

describe("G · Rückfrage und Neuzuordnung", () => {
  it("G1 nur die zuständige Person fragt zurück, Fragende antworten, Meldungen in beide Richtungen", async () => {
    const b = await buehne();
    const { gap } = await b.frage("frida");
    const id = gap?.id ?? "";
    await expect(b.ask.askGapFollowUp(id, frida, "Welche Presse?")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await b.ask.handOverGap(id, "fachmann", frida, null);
    await b.ask.askGapFollowUp(id, fachmann, "Welche Baureihe der Presse Zeta?");
    // Doppelklick: dieselbe Rückfrage entsteht nicht zweimal.
    await b.ask.askGapFollowUp(id, fachmann, "Welche Baureihe der Presse Zeta?");
    expect((await b.gaps.findById(id))?.rueckfragen).toHaveLength(1);
    expect((await b.ask.gapVorgang(id, frida)).naechsterSchritt).toBe("rueckfrage_beantworten");
    expect((await b.ask.gapMeldungenFuer("frida", ALLE)).map((m) => m.art)).toEqual(["rueckfrage"]);
    const rueckfrageId = (await b.gaps.findById(id))?.rueckfragen?.[0]?.id ?? "";
    await expect(
      b.ask.answerGapFollowUp(id, rueckfrageId, fachmann, "Baureihe 4"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await b.ask.answerGapFollowUp(id, rueckfrageId, frida, "Baureihe 4");
    expect((await b.ask.gapVorgang(id, fachmann)).phase).toBe("in_bearbeitung");
    expect((await b.ask.gapMeldungenFuer("fachmann", ALLE)).map((m) => m.art)).toEqual([
      "rueckfrage_beantwortet",
    ]);
  });

  it("G2 eine verfügbare Zuständigkeit nimmt ein Fragender nicht weg; eine nicht verfügbare schon", async () => {
    const b = await buehne();
    const { gap } = await b.frage("frida");
    const id = gap?.id ?? "";
    await b.ask.assignGap(id, "fachmann", "vera");
    await expect(b.ask.handOverGap(id, "andere", frida, true)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(b.ask.handOverGap(id, "andere", fritz, false)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    const neu = await b.ask.handOverGap(id, "andere", frida, false);
    expect(neu.assignee).toBe("andere");
    expect(neu.zuordnungen?.map((z) => z.art)).toEqual(["zuordnung", "neuzuordnung"]);
    const sicht = await b.ask.gapVorgang(id, frida, async (p) => p === "andere");
    expect(sicht.zuordnungen).toHaveLength(2);
    expect(JSON.stringify(sicht.zuordnungen)).not.toContain("vera");
  });
});

// ================================================================================================
// H — ÜBERLAPPENDE SCHRITTE (Ben, Nacharbeit 3). Jeder Fall öffnet mit `halteLesen` genau das
// Fenster zwischen „Stand gelesen" und „geschrieben" und lässt darin eine zweite Änderung landen.
// Vor der Korrektur überschrieb die alte Momentaufnahme diese Änderung.
// ================================================================================================
describe("H · überlappende Schritte verlieren nichts und öffnen nichts wieder", () => {
  it("H1 wer während des Abschlusses dieselbe Frage stellt, bleibt Fragender und wird benachrichtigt", async () => {
    const b = await buehne();
    const { gap } = await b.frage("frida");
    const id = gap?.id ?? "";
    await b.freigeben(b.antwort.id);
    // closeGap liest zweimal: Vorprüfung, dann den Stand, an dem geschrieben wird — den hält die Probe.
    const halt = b.gaps.halteLesen(2);
    const abschluss = b.ask.closeGap(id, b.antwort.id, fachmann);
    await halt.gelesen;
    await b.frage("fritz");
    halt.weiter();
    const zu = await abschluss;
    expect(zu.status).toBe("geschlossen");
    expect(zu.weitereFragende).toEqual(["fritz"]);
    expect(zu.askCount).toBe(2);
    // Zurück kommt der GESPEICHERTE Stand.
    expect(await b.gaps.findById(id)).toEqual(zu);
    const meldung = (await b.ask.gapMeldungenFuer("fritz", ALLE)).filter(
      (m) => m.art === "geloest",
    );
    expect(meldung).toHaveLength(1);
    expect((await b.ask.gapVorgang(id, fritz)).phase).toBe("geloest");
    expect(await b.audit.list({ action: "gap.closed" })).toHaveLength(1);
  });

  it("H2 eine verspätete Rückfrageantwort entfernt keinen fachlichen Abschluss", async () => {
    const b = await buehne();
    const { gap } = await b.frage("frida");
    const id = gap?.id ?? "";
    await b.ask.handOverGap(id, "fachmann", frida, null);
    await b.ask.askGapFollowUp(id, fachmann, "Welche Baureihe?");
    const rueckfrageId = (await b.gaps.findById(id))?.rueckfragen?.[0]?.id ?? "";
    await b.freigeben(b.antwort.id);
    // Die Antwort hat den offenen Stand gelesen; dann schliesst der Fachmann.
    const halt = b.gaps.halteLesen(1);
    const spaet = b.ask.answerGapFollowUp(id, rueckfrageId, frida, "Baureihe 4");
    await halt.gelesen;
    const zu = await b.ask.closeGap(id, b.antwort.id, fachmann);
    halt.weiter();
    await expect(spaet).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const danach = await b.gaps.findById(id);
    expect(danach?.status).toBe("geschlossen");
    expect(danach?.abschluss).toEqual(zu.abschluss);
    // Kein zweiter fachlicher Abschluss möglich, keine zweite Meldung.
    await b.ask.closeGap(id, b.antwort.id, fachmann);
    expect(await b.audit.list({ action: "gap.closed" })).toHaveLength(1);
    expect(
      (await b.ask.gapMeldungenFuer("frida", ALLE)).filter((m) => m.art === "geloest"),
    ).toHaveLength(1);
  });

  it("H3 eine verspätete Rückfrage öffnet den Vorgang nicht wieder; Priorität behält den Abschluss", async () => {
    const b = await buehne();
    const { gap } = await b.frage("frida");
    const id = gap?.id ?? "";
    await b.ask.handOverGap(id, "fachmann", frida, null);
    await b.freigeben(b.antwort.id);

    const halt = b.gaps.halteLesen(1);
    const rueckfrage = b.ask.askGapFollowUp(id, fachmann, "Noch eine Frage?");
    await halt.gelesen;
    const zu = await b.ask.closeGap(id, b.antwort.id, fachmann);
    halt.weiter();
    await expect(rueckfrage).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect((await b.gaps.findById(id))?.rueckfragen ?? []).toEqual([]);

    // Eine Prioritätsänderung nach dem Abschluss behält Abschluss und Fragende.
    const prio = await b.ask.setGapPriority(id, "hoch", "vera");
    expect(prio.status).toBe("geschlossen");
    expect(prio.abschluss).toEqual(zu.abschluss);
    expect(await b.gaps.findById(id)).toEqual(prio);
    expect(await b.audit.list({ action: "gap.closed" })).toHaveLength(1);
  });

  it("H4 eine verspätete Entwurfsverknüpfung öffnet den Vorgang nicht wieder", async () => {
    const b = await buehne();
    const { gap } = await b.frage("frida");
    const id = gap?.id ?? "";
    await b.ask.handOverGap(id, "fachmann", frida, null);
    await b.freigeben(b.antwort.id);
    // linkGapDraft liest zweimal (Vorprüfung, Schreibstand) — gehalten wird der Schreibstand.
    const halt = b.gaps.halteLesen(2);
    const entwurf = b.ask.linkGapDraft(id, b.antwort.id, fachmann);
    await halt.gelesen;
    const zu = await b.ask.closeGap(id, b.antwort.id, fachmann);
    halt.weiter();
    await expect(entwurf).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const danach = await b.gaps.findById(id);
    expect(danach?.status).toBe("geschlossen");
    expect(danach?.abschluss).toEqual(zu.abschluss);
  });

  it("H5 der Rückfall ohne Vergleichsmethode der Ablage schützt ebenso", async () => {
    // Eine Ablage OHNE `ersetzeWenn` (Testattrappen): der Dienst vergleicht selbst direkt davor.
    const b = await buehne();
    const { gap } = await b.frage("frida");
    const id = gap?.id ?? "";
    await b.freigeben(b.antwort.id);
    const ohne: GapRepo = {
      insert: (g) => b.gaps.insert(g),
      findById: (i) => b.gaps.findById(i),
      update: (g) => b.gaps.update(g),
      delete: (i) => b.gaps.delete(i),
      all: () => b.gaps.all(),
      insertOrIncrement: (g, v) => b.gaps.insertOrIncrement(g, v),
    };
    const ask = new AskService({ ...b.deps, gaps: ohne });
    const halt = b.gaps.halteLesen(2);
    const abschluss = ask.closeGap(id, b.antwort.id, fachmann);
    await halt.gelesen;
    await b.frage("fritz");
    halt.weiter();
    const zu = await abschluss;
    expect(zu.weitereFragende).toEqual(["fritz"]);
    expect((await b.gaps.findById(id))?.status).toBe("geschlossen");
  });
});

// ================================================================================================
// I — ÄNDERUNGEN AM EINTRAG, AN DEN BEWERTUNGEN UND AN DER ZUORDNUNG WÄHREND DES ABSCHLUSSES
// (Ben, Nacharbeit 5/8). Vor der Korrektur schloss die Lücke mit einem alten positiven Prüfstand bzw.
// durch die frühere zuständige Person. Seit Nacharbeit 8 laufen Prüfung und Schreiben in der
// Schreibklammer des Eintrags: eine Änderung VOR der letzten Prüfung verhindert den Abschluss (I1/I2),
// eine Änderung WÄHREND der letzten Prüfung wird erst nach dem Schreiben gespeichert (I3/I6).
// ================================================================================================
describe("I · der Abschluss gilt nur für den Stand, der beim Schreiben gilt", () => {
  const geloesteMeldungen = async (b: Awaited<ReturnType<typeof buehne>>, wer: string) =>
    (await b.ask.gapMeldungenFuer(wer, ALLE)).filter((m) => m.art === "geloest");

  // Ben, Nacharbeit 8: Prüfung und Schreiben laufen in der Schreibklammer des Eintrags. Gehalten wird
  // jetzt entweder VOR ihr (erstes Lesen der Lücke — dann sieht die Prüfung die Änderung) oder IN ihr
  // (Fachprüfabfrage — dann kann die Änderung bis zum Schreiben nicht gespeichert werden).
  const fenster = (): Promise<void> => new Promise((weiter) => setTimeout(weiter, 25));

  it("I1 eine rote Stimme vor der letzten Prüfung verhindert den Abschluss", async () => {
    const b = await buehne();
    const { gap } = await b.frage("frida");
    const id = gap?.id ?? "";
    await b.freigeben(b.antwort.id);
    const halt = b.gaps.halteLesen(1);
    const abschluss = b.ask.closeGap(id, b.antwort.id, fachmann);
    await halt.gelesen;
    await b.validation.rate(b.antwort.id, "pruefer-rot", "down");
    halt.weiter();
    await expect(abschluss).rejects.toMatchObject({
      code: "BAD_REQUEST",
      gruende: expect.arrayContaining(["negative_bewertung"]),
    });
    const danach = await b.gaps.findById(id);
    expect(danach?.status).toBe("offen");
    expect(danach?.abschluss).toBeUndefined();
    expect(danach?.koId).toBeUndefined();
    expect(await b.audit.list({ action: "gap.closed" })).toHaveLength(0);
    expect(await geloesteMeldungen(b, "frida")).toEqual([]);
  });

  it("I2 eine neue Fassung vor der letzten Prüfung verhindert den Abschluss mit den alten Bewertungen", async () => {
    const b = await buehne();
    const { gap } = await b.frage("frida");
    const id = gap?.id ?? "";
    await b.freigeben(b.antwort.id);
    const halt = b.gaps.halteLesen(1);
    const abschluss = b.ask.closeGap(id, b.antwort.id, fachmann);
    await halt.gelesen;
    await b.koService.revise(b.antwort.id, { statement: "Geänderte Anweisung." }, "fachmann");
    halt.weiter();
    await expect(abschluss).rejects.toMatchObject({
      gruende: expect.arrayContaining(["bewertungen_fehlen"]),
    });
    expect((await b.gaps.findById(id))?.status).toBe("offen");
    expect(await b.audit.list({ action: "gap.closed" })).toHaveLength(0);
    // Wiederholungsfrage: kein „gelöst" mit der ungeprüften Fassung — sie bleibt dieselbe offene Lücke.
    const wieder = await b.frage("fritz");
    expect(wieder.geloesteLuecke).toBeUndefined();
    expect(wieder.gap?.id).toBe(id);
  });

  it("I3 (Bens Gegenprobe) rote Stimme während der letzten Prüfstanderhebung: sie wird erst NACH dem Schreiben gespeichert", async () => {
    const b = await buehne();
    const { gap } = await b.frage("frida");
    const id = gap?.id ?? "";
    await b.freigeben(b.antwort.id);
    const halt = b.halteNachPruefstand(1);
    const abschluss = b.ask.closeGap(id, b.antwort.id, fachmann);
    await halt.gelesen;
    let gespeichert = false;
    const rot = b.validation.rate(b.antwort.id, "pruefer-rot", "down").then((r) => {
      gespeichert = true;
      return r;
    });
    await fenster();
    // Zwischen Prüfung und Schreiben kommt die Stimme NICHT in die Ablage — sie wartet.
    expect(gespeichert).toBe(false);
    expect((await b.validation.pruefstandFuer(b.antwort.id, 1)).votes.down).toBe(0);
    expect((await b.gaps.findById(id))?.status).toBe("offen");
    halt.weiter();
    const zu = await abschluss;
    await rot;
    // Geschlossen mit genau dem geprüften Stand; die Stimme ist eine Änderung NACH dem Abschluss.
    expect(zu.abschluss).toMatchObject({ art: "fachlich", koId: b.antwort.id, koVersion: 1 });
    expect(await b.audit.list({ action: "gap.closed" })).toHaveLength(1);
    expect((await b.validation.pruefstandFuer(b.antwort.id, 1)).votes.down).toBe(1);
    // Ab jetzt trägt der Eintrag nicht: keine Erfolgsmeldung, kein „gelöst" für die Wiederholung.
    expect(await geloesteMeldungen(b, "frida")).toEqual([]);
    expect((await b.ask.gapVorgang(id, frida)).ergebnis).toMatchObject({
      nutzbarkeit: { nutzbar: false },
    });
    expect((await b.frage("fritz")).geloesteLuecke).toBeUndefined();
  });

  it("I6 (Bens Gegenprobe) neue Fassung während der letzten Prüfstanderhebung: sie wird erst NACH dem Schreiben gespeichert", async () => {
    const b = await buehne();
    const { gap } = await b.frage("frida");
    const id = gap?.id ?? "";
    await b.freigeben(b.antwort.id);
    const halt = b.halteNachPruefstand(1);
    const abschluss = b.ask.closeGap(id, b.antwort.id, fachmann);
    await halt.gelesen;
    let gespeichert = false;
    const neueFassung = b.koService
      .revise(b.antwort.id, { statement: "Geänderte Anweisung." }, "fachmann")
      .then((r) => {
        gespeichert = true;
        return r;
      });
    await fenster();
    expect(gespeichert).toBe(false);
    expect((await b.koService.get(b.antwort.id))?.version).toBe(1);
    halt.weiter();
    const zu = await abschluss;
    await neueFassung;
    expect(zu.abschluss).toMatchObject({ koVersion: 1 });
    expect((await b.koService.get(b.antwort.id))?.version).toBe(2);
    expect(await b.audit.list({ action: "gap.closed" })).toHaveLength(1);
    expect(await geloesteMeldungen(b, "frida")).toEqual([]);
  });

  it("I4 nach einer Neuzuordnung im Fenster schliesst die frühere zuständige Person nicht ab", async () => {
    const b = await buehne();
    const { gap } = await b.frage("frida");
    const id = gap?.id ?? "";
    await b.ask.assignGap(id, "fachmann", "vera");
    await b.freigeben(b.antwort.id);
    const halt = b.halteNachPruefstand(1);
    const abschluss = b.ask.closeGapAlsBeteiligter(id, b.antwort.id, fachmann);
    await halt.gelesen;
    await b.ask.assignGap(id, "andere", "vera");
    halt.weiter();
    await expect(abschluss).rejects.toMatchObject({ code: "FORBIDDEN" });
    const danach = await b.gaps.findById(id);
    expect(danach?.status).toBe("offen");
    expect(danach?.assignee).toBe("andere");
    expect(await b.audit.list({ action: "gap.closed" })).toHaveLength(0);
    // Ohne Halt ebenso: die frühere zuständige Person ist nicht mehr berechtigt.
    await expect(b.ask.closeGapAlsBeteiligter(id, b.antwort.id, fachmann)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    // Gegenprobe: die neue zuständige Person und Verwaltende dürfen abschliessen.
    const andere = { id: "andere", verwaltend: false, sichtbar: ALLE };
    const zu = await b.ask.closeGapAlsBeteiligter(id, b.antwort.id, andere);
    expect(zu.status).toBe("geschlossen");
    expect(await b.audit.list({ action: "gap.closed" })).toHaveLength(1);
  });

  it("I5 Verwaltende behalten ihr Abschlussrecht auch bei einer Neuzuordnung im Fenster", async () => {
    const b = await buehne();
    const { gap } = await b.frage("frida");
    const id = gap?.id ?? "";
    await b.ask.assignGap(id, "fachmann", "vera");
    await b.freigeben(b.antwort.id);
    const vera = { id: "vera", verwaltend: true, sichtbar: ALLE };
    const halt = b.halteNachPruefstand(1);
    const abschluss = b.ask.closeGapAlsBeteiligter(id, b.antwort.id, vera);
    await halt.gelesen;
    await b.ask.assignGap(id, "andere", "vera");
    halt.weiter();
    const zu = await abschluss;
    expect(zu.status).toBe("geschlossen");
    expect(zu.assignee).toBe("andere");
    expect(await b.audit.list({ action: "gap.closed" })).toHaveLength(1);
  });
});

// ================================================================================================
// J — KEIN VORLÄUFIGER ABSCHLUSS (Ben, Nacharbeit 7/8). Gehalten wird die Fachprüfabfrage IN der
// Schreibklammer. Bis zur Korrektur in Nacharbeit 7 stand die Lücke in diesem Fenster bereits als
// „geschlossen" in der Ablage; jetzt wird vor dem Schreiben nichts an ihr verändert.
// ================================================================================================
describe("J · ein Abschluss wird erst mit dem Schreiben sichtbar — vorher steht nichts in der Ablage", () => {
  const geloesteMeldungen = async (b: Awaited<ReturnType<typeof buehne>>, wer: string) =>
    (await b.ask.gapMeldungenFuer(wer, ALLE)).filter((m) => m.art === "geloest");
  const fenster = (): Promise<void> => new Promise((weiter) => setTimeout(weiter, 25));

  /** Im Prüffenster ist für niemanden etwas abgeschlossen. */
  const nichtsAbgeschlossen = async (
    b: Awaited<ReturnType<typeof buehne>>,
    ask: AskService,
    id: string,
  ): Promise<void> => {
    const stand = await b.gaps.findById(id);
    expect(stand?.status).toBe("offen");
    expect(stand?.abschluss).toBeUndefined();
    expect((await ask.gapVorgang(id, frida)).phase).not.toBe("geloest");
    expect((await ask.gapVorgang(id, frida)).ergebnis).toBeNull();
    const meldungen = await ask.gapMeldungenFuer("frida", ALLE);
    expect(meldungen.filter((m) => m.art === "geloest")).toEqual([]);
    expect(await b.audit.list({ action: "gap.closed" })).toHaveLength(0);
  };

  it("J1 ein paralleler Zweitaufruf wartet und bekommt nie einen vorläufigen Stand", async () => {
    const b = await buehne();
    const { gap } = await b.frage("frida");
    const id = gap?.id ?? "";
    await b.freigeben(b.antwort.id);
    const vorher = await b.gaps.findById(id);
    const halt = b.halteNachPruefstand(1);
    const erster = b.ask.closeGap(id, b.antwort.id, fachmann);
    await halt.gelesen;
    let zweiterFertig = false;
    const zweiter = b.ask.closeGap(id, b.antwort.id, fachmann).then((g) => {
      zweiterFertig = true;
      return g;
    });
    await fenster();
    // Geprüft, aber noch nicht geschrieben: die Ablage ist unverändert, der Zweitaufruf wartet.
    expect(zweiterFertig).toBe(false);
    expect(await b.gaps.findById(id)).toEqual(vorher);
    await nichtsAbgeschlossen(b, b.ask, id);
    halt.weiter();
    const [eins, zwei] = await Promise.all([erster, zweiter]);
    expect(eins.status).toBe("geschlossen");
    expect(zwei.abschluss).toEqual(eins.abschluss);
    expect(await b.gaps.findById(id)).toEqual(eins);
    expect(await b.audit.list({ action: "gap.closed" })).toHaveLength(1);
    expect(await geloesteMeldungen(b, "frida")).toHaveLength(1);
  });

  it("J2 ein Lesefehler bei der Prüfung hinterlässt nichts", async () => {
    const b = await buehne();
    const { gap } = await b.frage("frida");
    const id = gap?.id ?? "";
    await b.freigeben(b.antwort.id);
    const vorher = await b.gaps.findById(id);
    const echt = b.koService.get.bind(b.koService);
    b.koService.get = async () => {
      throw new Error("Lesefehler im Wissensbestand");
    };
    await expect(b.ask.closeGap(id, b.antwort.id, fachmann)).rejects.toThrow(
      "Lesefehler im Wissensbestand",
    );
    b.koService.get = echt;
    expect(await b.gaps.findById(id)).toEqual(vorher);
    await nichtsAbgeschlossen(b, b.ask, id);
    // Danach schliesst ein regulärer Aufruf ungehindert.
    const zu = await b.ask.closeGap(id, b.antwort.id, fachmann);
    expect(zu.status).toBe("geschlossen");
    expect(await b.audit.list({ action: "gap.closed" })).toHaveLength(1);
  });

  it("J3 bricht der Abschluss vor dem Schreiben ab (Neustart), steht nichts in der Ablage", async () => {
    const b = await buehne();
    const { gap } = await b.frage("frida");
    const id = gap?.id ?? "";
    await b.freigeben(b.antwort.id);
    const vorher = await b.gaps.findById(id);
    const halt = b.halteNachPruefstand(1);
    const unterwegs = b.ask.closeGap(id, b.antwort.id, fachmann);
    await halt.gelesen;
    // Eine neue Dienstinstanz liest die Ablage, wie sie nach einem Abbruch an dieser Stelle stünde.
    const neu = new AskService({ ...b.deps });
    expect(await b.gaps.findById(id)).toEqual(vorher);
    await nichtsAbgeschlossen(b, neu, id);
    halt.weiter();
    await unterwegs;
  });
});
