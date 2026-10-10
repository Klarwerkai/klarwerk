// ================================================================================================
// produkt:20261010:antwort-beanstandung-korrektur — DIE BEANSTANDUNG AM ECHTEN DIENST (im Speicher).
// ================================================================================================
//
// Gemessen am `AskService` mit echter Validierung (`ValidationService.pruefstandFuer`), echtem
// Wissensbestand, echtem Lückenspeicher, echtem Prüfprotokoll und echter Antwortbeleg-Ablage. Nur
// fiktive Inhalte und Personen: fachmann (Autor = verantwortlich), melda und melvin (melden), vera
// (verwaltet), dritte (unbeteiligt), pruefer-* (bewerten).
//
// Die fiktive FALSCHE Aussage steht in einer echten, zugeordneten Quelle: „Die Spindel SP-7 wird alle
// 40 Betriebsstunden im laufenden Betrieb geschmiert." Korrigiert lautet sie „… alle 400
// Betriebsstunden im Stillstand …".
//
//   B1 — PV-04-01 Bindung an Antwort, Aussage, Fundstelle und Quellfassung; Quittung und Meldekennung
//   B2 — PV-04-01 Gegenproben: veränderter Wortlaut, fremde Fundstelle, Beleg ohne Aussagefassung
//   B3 — PV-04-01/02 „Quelle fehlt": offen ohne Zuständigkeit, nichts verloren
//   B4 — PV-04-02 Zuständigkeit und Zusammenführung von Wiederholungen
//   B5 — PV-04-03 eigener Vorgang des Melders; zulässiger Kontext je Rolle
//   B6 — PV-04-04/05/07 Rückfrage → Korrektur → Freigabe → Abschluss → Rückmeldung
//   B7 — PV-04-06 historische Bindung bleibt; erneute Frage nutzt den neuen Stand
//   B8 — PV-04-04/05/07 begründete Zurückweisung
//   B9 — PV-04-07 Rechteentzug
import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  AskService,
  BEANSTANDUNG_FRAGE,
  type BeanstandungEingabe,
  InMemoryAnswerSnapshotRepo,
  InMemoryGapRepo,
  signAnswerReceipt,
} from "../../services/ask";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import { InMemoryKoRepo, type KnowledgeObject, KoService } from "../../services/knowledge-object";
import { Reasoner } from "../../services/reasoner";
import {
  InMemoryAssignmentRepo,
  InMemoryRatingRepo,
  ValidationService,
} from "../../services/validation";

const TITEL = "Spindel SP-7 schmieren";
const FALSCH = "Die Spindel SP-7 wird alle 40 Betriebsstunden im laufenden Betrieb geschmiert.";
const RICHTIG = "Die Spindel SP-7 wird alle 400 Betriebsstunden im Stillstand geschmiert.";
const ALLE = (): boolean => true;
const NIE = (): boolean => false;

async function buehne(opts: { zustaendigVerfuegbar?: boolean } = {}) {
  const koService = new KoService({ repo: new InMemoryKoRepo() });
  await koService.activateSearchProjectionV2();
  const audit = new AuditService({ repo: new InMemoryAuditRepo() });
  const validation = new ValidationService({
    koService,
    ratings: new InMemoryRatingRepo(),
    assignments: new InMemoryAssignmentRepo(),
    audit,
  });
  const gaps = new InMemoryGapRepo();
  const answerSnapshots = new InMemoryAnswerSnapshotRepo();
  const receiptSecret = randomBytes(32);
  const ask = new AskService({
    reasoner: new Reasoner(),
    koService,
    gaps,
    audit,
    answerSnapshots,
    receiptSecret,
    pruefstand: (koId: string, v: number) => validation.pruefstandFuer(koId, v),
  });
  const quelle = await koService.create({
    title: TITEL,
    statement: FALSCH,
    type: "best_practice",
    category: "Instandhaltung",
    author: "fachmann",
    confidentiality: "intern",
  });
  // Die vorgeschriebene Fachfreigabe der AKTUELLEN Fassung — je Runde eigene fiktive Prüfende.
  const freigeben = async (runde: number): Promise<void> => {
    const ko = await koService.get(quelle.id);
    for (let i = 0; i < (ko?.neededValidations ?? 0); i++) {
      await validation.rate(quelle.id, `pruefer-${runde}-${i}`, "up");
    }
  };
  await freigeben(1);
  const frage = (wer: string, sichtbar: (ko: KnowledgeObject) => boolean = ALLE) =>
    ask.ask(TITEL, wer, "de", undefined, sichtbar);
  const optionen =
    opts.zustaendigVerfuegbar === undefined
      ? {}
      : { zustaendigVerfuegbar: async () => opts.zustaendigVerfuegbar ?? null };
  /** Die erste Aussage der Antwort samt ihrer ersten Fundstelle — kalibriert, sonst misst nichts. */
  const ersteAussage = (out: Awaited<ReturnType<typeof frage>>) => {
    expect(out.result.answered, "die Quelle muss die Frage beantworten").toBe(true);
    expect(out.result.citedSources, "die Quelle muss tragen").toContain(quelle.id);
    const aussage = out.aussagen?.aussagen[0];
    expect(aussage, "die Antwort muss eine gebundene Aussage tragen").toBeDefined();
    const fundstelle = aussage?.teile
      .flatMap((t) => t.fundstellen)
      .find((f) => f.koId === quelle.id);
    expect(fundstelle, "die Aussage muss eine Fundstelle in der Quelle haben").toBeDefined();
    return {
      aussageId: aussage?.aussageId ?? "",
      text: aussage?.text ?? "",
      fundstelleId: fundstelle?.fundstelleId ?? "",
    };
  };
  const beanstande = async (
    wer: string,
    begruendung: string,
    art: { fundstelle?: boolean; quelleFehlt?: boolean } = { fundstelle: true },
  ) => {
    const out = await frage(wer);
    const a = ersteAussage(out);
    const eingabe: BeanstandungEingabe = {
      aussageId: a.aussageId,
      aussageText: a.text,
      fundstelleId: art.fundstelle ? a.fundstelleId : null,
      quelleFehlt: art.quelleFehlt === true,
      begruendung,
    };
    const koId = art.quelleFehlt ? "" : quelle.id;
    const quittung = await ask.reportAnswer(
      out.receipt,
      koId,
      "antwort-falsch",
      wer,
      eingabe,
      optionen,
    );
    return { out, a, eingabe, quittung, koId };
  };
  return {
    ask,
    koService,
    validation,
    audit,
    gaps,
    answerSnapshots,
    receiptSecret,
    quelle,
    freigeben,
    frage,
    ersteAussage,
    beanstande,
    optionen,
  };
}

const fachmann = { id: "fachmann", verwaltend: false, sichtbar: ALLE };
const melda = { id: "melda", verwaltend: false, sichtbar: ALLE };
const melvin = { id: "melvin", verwaltend: false, sichtbar: ALLE };
const vera = { id: "vera", verwaltend: true, sichtbar: ALLE };
const dritte = { id: "dritte", verwaltend: false, sichtbar: ALLE };

const GRUND_MELDA = "Laut Herstellerblatt nur im Stillstand und alle 400 Stunden.";
const GRUND_MELVIN = "Im Betrieb zu schmieren ist an der SP-7 nicht zulässig.";

describe("B1 · PV-04-01 die Beanstandung ist an Antwort, Aussage und Quellfassung gebunden", () => {
  it("Quittung mit Meldekennung, Vorgang und damaliger Fassung; Protokoll ohne Freitext", async () => {
    const b = await buehne();
    const { out, a, quittung } = await b.beanstande("melda", GRUND_MELDA);
    expect(out.answerId, "ein Antwortbeleg wurde gespeichert").toBeTruthy();
    expect(quittung).toMatchObject({
      koId: b.quelle.id,
      koTitle: TITEL,
      grund: "antwort-falsch",
      zugestelltAn: "author-fallback",
      bereitsGemeldet: false,
      beanstandung: {
        answerId: out.answerId,
        aussageId: a.aussageId,
        koVersion: 1,
        fundstelleId: a.fundstelleId,
        quelleFehlt: false,
        zusammengefuehrt: false,
        zustaendigkeit: "zugeordnet",
      },
    });
    expect(quittung.meldungId).toMatch(/^M-[0-9A-F]{10}$/);
    expect(quittung.beanstandung?.aussageFingerabdruck).toMatch(/^[0-9a-f]{24}$/);

    // Die bestehende Meldung (`answer.reported`) — mit Kennungen und Fingerabdruck, ohne Freitext.
    const eintraege = await b.audit.list({ action: "answer.reported", target: b.quelle.id });
    expect(eintraege).toHaveLength(1);
    expect(eintraege[0]).toMatchObject({
      actor: "melda",
      payload: {
        meldungId: quittung.meldungId,
        responsible: "fachmann",
        aussageId: a.aussageId,
        aussageFingerabdruck: quittung.beanstandung?.aussageFingerabdruck,
        answerId: out.answerId,
        koVersion: 1,
        fundstelleId: a.fundstelleId,
      },
    });
    const protokoll = JSON.stringify(eintraege);
    expect(protokoll).not.toContain(GRUND_MELDA);
    expect(protokoll).not.toContain("40 Betriebsstunden");

    // Der Vorgang trägt dieselbe Meldekennung und die damalige Fassung.
    const gap = await b.gaps.findById(quittung.beanstandung?.vorgangId ?? "");
    expect(gap?.beanstandung).toMatchObject({
      koId: b.quelle.id,
      aussageText: a.text,
      meldungen: [
        {
          meldungId: quittung.meldungId,
          von: "melda",
          answerId: out.answerId,
          aussageId: a.aussageId,
          koVersion: 1,
          begruendung: GRUND_MELDA,
        },
      ],
    });
  });

  it("Meldung und Bindung ändern den Wissensbestand nicht (PV-04-04)", async () => {
    const b = await buehne();
    const vorher = await b.koService.get(b.quelle.id);
    await b.beanstande("melda", GRUND_MELDA);
    const nachher = await b.koService.get(b.quelle.id);
    expect(nachher?.version).toBe(vorher?.version);
    expect(nachher?.status).toBe("validiert");
    expect(nachher?.trust).toBe(vorher?.trust);
    expect(nachher?.statement).toBe(FALSCH);
  });
});

describe("B2 · PV-04-01 Gegenproben der Bindung", () => {
  it("veränderter Wortlaut, fremde Aussage, fremde Fundstelle, fremder Beleg → abgewiesen, nichts angelegt", async () => {
    const b = await buehne();
    const out = await b.frage("melda");
    const a = b.ersteAussage(out);
    const basis: BeanstandungEingabe = {
      aussageId: a.aussageId,
      aussageText: a.text,
      fundstelleId: null,
      quelleFehlt: false,
      begruendung: GRUND_MELDA,
    };
    const faelle: Array<[string, string, BeanstandungEingabe, string]> = [
      ["melda", out.receipt, { ...basis, aussageText: `${a.text} Zusatz` }, "FORBIDDEN"],
      ["melda", out.receipt, { ...basis, aussageId: "aus_unbekannt" }, "FORBIDDEN"],
      ["melda", out.receipt, { ...basis, fundstelleId: "fs_fremd" }, "FORBIDDEN"],
      ["dritte", out.receipt, basis, "FORBIDDEN"],
    ];
    for (const [wer, beleg, eingabe, code] of faelle) {
      await expect(
        b.ask.reportAnswer(beleg, b.quelle.id, "antwort-falsch", wer, eingabe),
        JSON.stringify(eingabe),
      ).rejects.toMatchObject({ code });
    }
    expect(await b.ask.listGaps()).toEqual([]);
    expect(await b.audit.list({ action: "answer.reported" })).toEqual([]);
  });

  it("ein Beleg OHNE Aussagefassung trägt keine Beanstandung — der gleiche Titel ersetzt sie nicht", async () => {
    const b = await buehne();
    const out = await b.frage("melda");
    const a = b.ersteAussage(out);
    // Ein gültig signierter Beleg der alten Bauart: Nutzer und Quelle, keine Aussagefassung.
    const alt = signAnswerReceipt(b.receiptSecret, "melda", [b.quelle.id], Date.now());
    await expect(
      b.ask.reportAnswer(alt, b.quelle.id, "antwort-falsch", "melda", {
        aussageId: a.aussageId,
        aussageText: a.text,
        fundstelleId: null,
        quelleFehlt: false,
        begruendung: GRUND_MELDA,
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("Aussagefassung"),
    });
    // Die einfache Meldung mit demselben alten Beleg bleibt, wie sie war.
    const einfach = await b.ask.reportAnswer(alt, b.quelle.id, "antwort-falsch", "melda");
    expect(einfach.beanstandung).toBeUndefined();
    expect(await b.ask.listGaps()).toEqual([]);
  });
});

describe("B3 · „Quelle fehlt“ ohne Quelle bleibt sichtbar offen", () => {
  it("keine Zuständigkeit, kein Empfänger erfunden — der Vorgang steht offen", async () => {
    const b = await buehne();
    const { quittung } = await b.beanstande("melda", "Für die 40 Stunden gibt es keinen Beleg.", {
      quelleFehlt: true,
    });
    expect(quittung).toMatchObject({
      koId: "",
      zugestelltAn: "niemand",
      beanstandung: { quelleFehlt: true, koVersion: null, zustaendigkeit: "offen" },
    });
    const id = quittung.beanstandung?.vorgangId ?? "";
    const sicht = await b.ask.gapVorgang(id, melda);
    expect(sicht).toMatchObject({
      phase: "ohne_zustaendigkeit",
      zustaendig: null,
      beanstandung: { quelleFehlt: true, meldungen: 1 },
    });
    // Ohne `responsible` erfindet die Glocke keinen Empfänger.
    const [eintrag] = await b.audit.list({ action: "answer.reported" });
    expect(eintrag?.payload.responsible).toBeUndefined();
    expect(eintrag?.payload.quelleFehlt).toBe(true);
  });
});

describe("B4 · PV-04-02 Zuständigkeit und Wiederholungen", () => {
  it("die verantwortliche Person wird zuständig; dieselbe Aussage bleibt EIN Vorgang", async () => {
    const b = await buehne();
    const erste = await b.beanstande("melda", GRUND_MELDA);
    const id = erste.quittung.beanstandung?.vorgangId ?? "";
    expect((await b.gaps.findById(id))?.assignee).toBe("fachmann");

    const zweite = await b.beanstande("melvin", GRUND_MELVIN);
    expect(zweite.quittung.beanstandung).toMatchObject({ vorgangId: id, zusammengefuehrt: true });
    expect(zweite.quittung.meldungId).not.toBe(erste.quittung.meldungId);

    // Derselbe Klick ein zweites Mal: dieselbe Kennung, nichts doppelt.
    const nochmal = await b.ask.reportAnswer(
      erste.out.receipt,
      b.quelle.id,
      "antwort-falsch",
      "melda",
      erste.eingabe,
    );
    expect(nochmal).toMatchObject({
      meldungId: erste.quittung.meldungId,
      bereitsGemeldet: true,
      beanstandung: { vorgangId: id, zusammengefuehrt: false },
    });

    const gap = await b.gaps.findById(id);
    expect(gap?.askCount).toBe(2);
    expect(gap?.weitereFragende).toEqual(["melvin"]);
    expect(gap?.beanstandung?.meldungen.map((m) => m.meldungId)).toEqual([
      erste.quittung.meldungId,
      zweite.quittung.meldungId,
    ]);
    expect((await b.ask.listGaps()).filter((g) => g.beanstandung)).toHaveLength(1);
    expect(await b.audit.list({ action: "gap.assigned" })).toHaveLength(1);
  });

  it("ist die verantwortliche Person heute nicht berechtigt, bleibt der Vorgang offen ohne Zuständigkeit", async () => {
    const b = await buehne({ zustaendigVerfuegbar: false });
    const { quittung } = await b.beanstande("melda", GRUND_MELDA);
    expect(quittung.beanstandung?.zustaendigkeit).toBe("offen");
    const id = quittung.beanstandung?.vorgangId ?? "";
    expect((await b.gaps.findById(id))?.assignee).toBeNull();
    expect((await b.ask.gapVorgang(id, vera)).naechsterSchritt).toBe("zustaendigkeit_zuordnen");
  });
});

describe("B5 · PV-04-03 eigener Vorgang des Melders, zulässiger Kontext je Rolle", () => {
  it("Melder sehen ihre eigenen Meldungen; die zuständige Person Aussage und Begründungen ohne Melderkennung", async () => {
    const b = await buehne();
    const erste = await b.beanstande("melda", GRUND_MELDA);
    await b.beanstande("melvin", GRUND_MELVIN);
    const id = erste.quittung.beanstandung?.vorgangId ?? "";

    const gap = await b.gaps.findById(id);
    expect(gap?.question).toBe(BEANSTANDUNG_FRAGE);

    const fuerMelda = await b.ask.gapVorgang(id, melda);
    expect(fuerMelda.rollen).toEqual(["fragend"]);
    expect(fuerMelda.phase).toBe("in_bearbeitung");
    expect(fuerMelda.beanstandung).toMatchObject({
      aussage: erste.a.text,
      aussageZurueckgehalten: false,
      meldungen: 2,
      fassungenDamals: [1],
      begruendungen: [],
    });
    expect(fuerMelda.beanstandung?.eigeneMeldungen).toEqual([
      expect.objectContaining({ meldungId: erste.quittung.meldungId, begruendung: GRUND_MELDA }),
    ]);
    expect(JSON.stringify(fuerMelda)).not.toContain(GRUND_MELVIN);
    expect(JSON.stringify(fuerMelda)).not.toContain("melvin");

    // Gegenprobe: der zweite Melder (zusammengeführt) sieht ebenso nur seine eigene Meldung.
    const fuerMelvin = await b.ask.gapVorgang(id, melvin);
    expect(fuerMelvin.rollen).toEqual(["fragend"]);
    expect(fuerMelvin.beanstandung?.eigeneMeldungen.map((m) => m.begruendung)).toEqual([
      GRUND_MELVIN,
    ]);
    expect(JSON.stringify(fuerMelvin)).not.toContain(GRUND_MELDA);

    const fuerFachmann = await b.ask.gapVorgang(id, fachmann);
    expect(fuerFachmann.rollen).toEqual(["zustaendig"]);
    expect(fuerFachmann.beanstandung?.aussage).toBe(erste.a.text);
    expect(fuerFachmann.beanstandung?.begruendungen.map((g) => g.text)).toEqual([
      GRUND_MELDA,
      GRUND_MELVIN,
    ]);
    expect(fuerFachmann.beanstandung?.eigeneMeldungen).toEqual([]);
    const fachText = JSON.stringify(fuerFachmann);
    expect(fachText).not.toContain("melda");
    expect(fachText).not.toContain("melvin");

    // Ohne Zugriff auf die Quelle: Aussage und Begründungen zurückgehalten.
    const ohneZugriff = await b.ask.gapVorgang(id, { ...fachmann, sichtbar: NIE });
    expect(ohneZugriff.beanstandung).toMatchObject({
      aussage: "",
      aussageZurueckgehalten: true,
      begruendungen: [],
      koId: null,
    });
    // Verwaltende ohne eigene Rolle: Ablauf ja, Text nein.
    const fuerVera = await b.ask.gapVorgang(id, vera);
    expect(fuerVera.beanstandung).toMatchObject({ aussage: "", begruendungen: [] });
    // Unbeteiligte erfahren nichts.
    await expect(b.ask.gapVorgang(id, dritte)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("B6 · PV-04-04/05/07 melden → zuweisen → rückfragen → korrigieren → freigeben → rückmelden", () => {
  it("der durchgängige Korrekturvorgang", async () => {
    const b = await buehne();
    const { quittung } = await b.beanstande("melda", GRUND_MELDA);
    const id = quittung.beanstandung?.vorgangId ?? "";

    // Rückfrage der zuständigen Person, Antwort des Melders.
    await b.ask.askGapFollowUp(id, fachmann, "Welches Herstellerblatt, welche Ausgabe?");
    expect((await b.ask.gapVorgang(id, melda)).naechsterSchritt).toBe("rueckfrage_beantworten");
    expect((await b.ask.gapMeldungenFuer("melda", ALLE)).map((m) => m.art)).toEqual(["rueckfrage"]);
    const rueckfrageId = (await b.gaps.findById(id))?.rueckfragen?.[0]?.id ?? "";
    await b.ask.answerGapFollowUp(id, rueckfrageId, melda, "Wartungsblatt SP-7, Ausgabe 3.");

    // Dieselbe Quelle in der beanstandeten Fassung ist keine Korrektur.
    await expect(b.ask.closeGapAlsBeteiligter(id, b.quelle.id, fachmann)).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("keine Korrektur"),
    });

    // Korrektur über die vorhandene Überarbeitung: eine neue Fassung — noch ungeprüft.
    await b.koService.revise(b.quelle.id, { statement: RICHTIG }, "fachmann");
    const entwurf = await b.koService.get(b.quelle.id);
    expect(entwurf?.version).toBe(2);
    await b.ask.linkGapDraft(id, b.quelle.id, fachmann);
    await expect(b.ask.closeGapAlsBeteiligter(id, undefined, fachmann)).rejects.toMatchObject({
      gruende: expect.arrayContaining(["bewertungen_fehlen"]),
    });
    expect((await b.gaps.findById(id))?.status).toBe("offen");
    expect(
      (await b.ask.gapMeldungenFuer("melda", ALLE)).filter((m) => m.art === "geloest"),
    ).toEqual([]);

    // Vorgeschriebene Fachfreigabe der neuen Fassung → fachlicher Abschluss mit Fassung 2.
    await b.freigeben(2);
    const zu = await b.ask.closeGapAlsBeteiligter(id, undefined, fachmann);
    expect(zu.abschluss).toMatchObject({ art: "fachlich", koId: b.quelle.id, koVersion: 2 });

    const sicht = await b.ask.gapVorgang(id, melda);
    expect(sicht).toMatchObject({
      phase: "geloest",
      naechsterSchritt: "ergebnis_lesen",
      ergebnis: { koId: b.quelle.id, koVersion: 2, nutzbarkeit: { nutzbar: true } },
      beanstandung: { fassungenDamals: [1] },
    });
    const rueck = (await b.ask.gapMeldungenFuer("melda", ALLE)).filter((m) => m.art === "geloest");
    expect(rueck).toHaveLength(1);
    expect(rueck[0]).toMatchObject({ gapId: id, koId: b.quelle.id });
  });
});

describe("B7 · PV-04-06 historische Bindung bleibt, die erneute Frage nutzt den neuen Stand", () => {
  it("alter Antwortbeleg und Meldung behalten Fassung 1; die neue Antwort steht auf Fassung 2", async () => {
    const b = await buehne();
    const { out, quittung } = await b.beanstande("melda", GRUND_MELDA);
    const id = quittung.beanstandung?.vorgangId ?? "";
    await b.koService.revise(b.quelle.id, { statement: RICHTIG }, "fachmann");
    await b.freigeben(2);
    await b.ask.closeGapAlsBeteiligter(id, b.quelle.id, fachmann);

    const wieder = await b.frage("melda");
    expect(wieder.quellenStand?.[b.quelle.id]).toBe(2);
    expect(wieder.result.answer ?? "").toContain("400");
    expect(wieder.result.answer ?? "").not.toContain("40 Betriebsstunden im laufenden");

    // Historie unverändert: Meldung, Vorgang und Antwortbeleg der ersten Antwort zeigen Fassung 1.
    expect((await b.gaps.findById(id))?.beanstandung?.meldungen[0]?.koVersion).toBe(1);
    const alt = await b.answerSnapshots.latestSnapshot(out.answerId ?? "");
    expect(
      alt?.evidence.find((e) => e.knowledgeObjectId === b.quelle.id)?.knowledgeObjectVersion,
    ).toBe(1);
    expect(alt?.snapshotRevision).toBe(1);
  });
});

describe("B8 · PV-04-04/05/07 begründete Zurückweisung", () => {
  it("die Aussage bleibt, der Melder bekommt die Begründung — kein „gelöst“, keine Änderung", async () => {
    const b = await buehne();
    const { quittung } = await b.beanstande("melda", GRUND_MELDA);
    const id = quittung.beanstandung?.vorgangId ?? "";
    const BEGRUENDUNG =
      "Für SP-7 Baujahr 2024 gilt laut Wartungsblatt Ausgabe 4 das 40-Stunden-Intervall.";

    await expect(b.ask.rejectBeanstandung(id, dritte, BEGRUENDUNG)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(b.ask.rejectBeanstandung(id, fachmann, "  ")).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    const zu = await b.ask.rejectBeanstandung(id, fachmann, BEGRUENDUNG);
    // Doppelklick: derselbe Abschluss, kein zweiter Protokolleintrag.
    await b.ask.rejectBeanstandung(id, fachmann, BEGRUENDUNG);
    expect(zu.abschluss).toMatchObject({
      art: "zurueckgewiesen",
      begruendung: BEGRUENDUNG,
      koId: b.quelle.id,
      koVersion: 1,
    });
    const protokoll = await b.audit.list({ action: "gap.beanstandung-zurueckgewiesen" });
    expect(protokoll).toHaveLength(1);
    expect(JSON.stringify(protokoll)).not.toContain(BEGRUENDUNG);

    const sicht = await b.ask.gapVorgang(id, melda);
    expect(sicht).toMatchObject({
      phase: "zurueckgewiesen",
      naechsterSchritt: "begruendung_lesen",
      ergebnis: null,
      abschluss: { art: "zurueckgewiesen", begruendung: BEGRUENDUNG, koVersion: 1 },
    });
    const fuerVera = await b.ask.gapVorgang(id, vera);
    expect(fuerVera.abschluss).toMatchObject({ art: "zurueckgewiesen", begruendung: "" });

    const meldungen = await b.ask.gapMeldungenFuer("melda", ALLE);
    expect(meldungen.map((m) => m.art)).toEqual(["zurueckgewiesen"]);
    expect((await b.ask.gapMeldungenFuer("melda", ALLE)).map((m) => m.id)).toEqual(
      meldungen.map((m) => m.id),
    );
    expect(await b.koService.get(b.quelle.id)).toMatchObject({ version: 1, statement: FALSCH });

    // Eine gewöhnliche Wissenslücke wird nicht „zurückgewiesen", sondern zurückgenommen.
    const ZYRLAX = "Wie justiere ich den Zyrlax-Taster?";
    const luecke = await b.ask.ask(ZYRLAX, "melda", "de", undefined, ALLE);
    await expect(
      b.ask.rejectBeanstandung(luecke.gap?.id ?? "", vera, BEGRUENDUNG),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("B9 · PV-04-07 Rechteentzug", () => {
  it("ohne heutiges Leserecht: keine Erfolgsmeldung, Ergebnis und Quelle nicht zugänglich", async () => {
    const b = await buehne();
    const { quittung } = await b.beanstande("melda", GRUND_MELDA);
    const id = quittung.beanstandung?.vorgangId ?? "";
    await b.koService.revise(b.quelle.id, { statement: RICHTIG }, "fachmann");
    await b.freigeben(2);
    await b.ask.closeGapAlsBeteiligter(id, b.quelle.id, fachmann);

    expect(await b.ask.gapMeldungenFuer("melda", NIE)).toEqual([]);
    const ohneRecht = await b.ask.gapVorgang(id, { ...melda, sichtbar: NIE });
    expect(ohneRecht.ergebnis).toEqual({ zugaenglich: false });
    expect(ohneRecht.beanstandung).toMatchObject({ koId: null, quelleZugaenglich: false });
    expect(JSON.stringify(ohneRecht)).not.toContain(RICHTIG);
    // Die eigene, damals ausgelieferte Aussage und Begründung bleiben dem Melder lesbar.
    expect(ohneRecht.beanstandung?.eigeneMeldungen[0]?.begruendung).toBe(GRUND_MELDA);
  });

  it("eine neu zugeordnete Person ohne Zugriff auf die Quelle sieht die Aussage nicht", async () => {
    const b = await buehne();
    const { quittung } = await b.beanstande("melda", GRUND_MELDA);
    const id = quittung.beanstandung?.vorgangId ?? "";
    await b.ask.assignGap(id, "vertretung", "vera");
    const vertretung = { id: "vertretung", verwaltend: false, sichtbar: NIE };
    const sicht = await b.ask.gapVorgang(id, vertretung);
    expect(sicht.rollen).toEqual(["zustaendig"]);
    expect(sicht.beanstandung).toMatchObject({ aussage: "", aussageZurueckgehalten: true });
    expect(sicht.question).toBe(BEANSTANDUNG_FRAGE);
  });
});
