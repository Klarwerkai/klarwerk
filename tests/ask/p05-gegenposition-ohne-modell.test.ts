// ================================================================================================
// P05-AC08 · Claude-Prüfnachtrag B-02 (RF-01) und B-05 (RF-02) — DER MODELLFREIE ANTWORTWEG.
// ================================================================================================
//
// Gemessen am echten Weg OHNE Modell: KoService (aktive Suchprojektion) → fachliche Bestätigung über
// den echten Bewertungsweg (ValidationService) → AskService → Reasoner (keine KI-Freigabe, also der
// deterministische Ersatz). Alle Inhalte sind FIKTIVE Testdaten dieses Prüfstands.
//
//   G1  RF-01 P1: nur K1 bestätigt, KF1 unbestätigt → Antwort aus K1, „gesichert" (unverändert).
//   G2  RF-01 P2 (B-02): KF1 irrtümlich bestätigt, K1 bestätigt → beide Positionen im Wortlaut,
//       Grenze „keine Widerspruchsprüfung ohne Modell" sichtbar, NICHT „gesichert".
//   G3  RF-02 (B-05): zwei bestätigte Testblätter VT-1 Rev A/Rev B und die DGUV-Notiz → gezielte
//       Typ-/Revisionsrückfrage, beide Blätter genannt, jeder Nm-Wert nur hinter seinem Blatt,
//       das neuere Blatt erhält keinen Vorrang.
//   G4  Gegenfall: zwei bestätigte Quellen mit gleichem Wortlaut → keine Gegenüberstellung.
//   G5  Gegenfall: der wörtliche Add-in-Weg (`retrievalOnly`) bleibt unberührt.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { InMemoryGapRepo } from "../../services/ask/src/repo";
import { AskService } from "../../services/ask/src/service";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import { Reasoner } from "../../services/reasoner";
import {
  InMemoryAssignmentRepo,
  InMemoryRatingRepo,
  ValidationService,
} from "../../services/validation";

const VORGEFUNDEN = process.env.KLARWERK_SKIP_KEYCHAIN;
beforeAll(() => {
  process.env.KLARWERK_SKIP_KEYCHAIN = "1";
});
afterAll(() => {
  if (VORGEFUNDEN === undefined) {
    delete process.env.KLARWERK_SKIP_KEYCHAIN;
  } else {
    process.env.KLARWERK_SKIP_KEYCHAIN = VORGEFUNDEN;
  }
});

async function aufbau() {
  const koService = new KoService({ repo: new InMemoryKoRepo() });
  const validation = new ValidationService({
    koService,
    ratings: new InMemoryRatingRepo(),
    assignments: new InMemoryAssignmentRepo(),
  });
  await koService.activateSearchProjectionV2();
  const ask = new AskService({
    reasoner: new Reasoner(),
    koService,
    gaps: new InMemoryGapRepo(),
    audit: new AuditService({ repo: new InMemoryAuditRepo() }),
    pruefstand: (koId, koVersion) => validation.pruefstandFuer(koId, koVersion),
  });
  const anlegen = async (title: string, statement: string): Promise<string> =>
    (
      await koService.create({
        title,
        statement,
        type: "technik",
        category: "Instandhaltung",
        author: "experte",
      })
    ).id;
  /** Fachliche Bestätigung über den echten Bewertungsweg (controller-Stimmen). */
  const bestaetigen = async (koId: string): Promise<void> => {
    const ko = await koService.get(koId);
    for (let i = 0; i < (ko?.neededValidations ?? 0); i++) {
      await validation.rate(koId, `controller-${i}`, "up");
    }
    expect((await koService.get(koId))?.status).toBe("validiert");
  };
  return { ask, anlegen, bestaetigen };
}

// RF-01 · fiktive Inhalte (K1 frei nach dem DGUV-Bericht, KF1 als FIKTIVER TESTFEHLER markiert).
const K1_TITEL = "Hubtisch-Absturz nach Motortausch";
const K1_AUSSAGE =
  "Der Hubtisch ist auch bei abgeschaltetem Motor nicht sicher: ein Teilvakuum im Zylinder ließ zu wenig Öl nachfließen, der Hubtisch senkte sich ab; nur mechanische Stützen sichern ihn.";
const KF1_TITEL = "FIKTIVER TESTFEHLER KF1: Hubtisch bei abgeschaltetem Motor";
const KF1_AUSSAGE = "Ist der Motor abgeschaltet, ist der Hubtisch sicher.";
const FRAGE_RF01 = "Ist der Hubtisch sicher, wenn der Motor aus ist?";

// RF-02 · fiktive Testblätter (Werte als FIKTIVER TESTWERT gekennzeichnet) und die DGUV-Notiz K2.
const K2_TITEL = "Anziehdrehmoment am Ventil (DGUV 209-070, 4.6)";
const K2_AUSSAGE =
  "Für das Anziehdrehmoment am Ventil gilt das Datenblatt des konkreten Ventiltyps; die DGUV nennt keinen allgemeinen Wert.";
const REV_A_TITEL = "Testblatt Ventil VT-1 Rev A";
const REV_A_AUSSAGE = "FIKTIVER TESTWERT: Anziehdrehmoment Ventil VT-1 10 Nm.";
const REV_B_TITEL = "Testblatt Ventil VT-1 Rev B";
const REV_B_AUSSAGE = "FIKTIVER TESTWERT: Anziehdrehmoment Ventil VT-1 100 Nm.";
const FRAGE_RF02 = "Welches Anziehdrehmoment hat Ventil VT-1?";

describe("P05-AC08 · B-02 — bestätigter Fehler gegen bestätigte Gegenquelle (RF-01)", () => {
  it("G1 nur K1 bestätigt, KF1 unbestätigt: Antwort aus K1, gesichert — KF1 nicht behauptet", async () => {
    const a = await aufbau();
    const k1 = await a.anlegen(K1_TITEL, K1_AUSSAGE);
    await a.anlegen(KF1_TITEL, KF1_AUSSAGE);
    await a.bestaetigen(k1);

    const { result } = await a.ask.ask(FRAGE_RF01, "viewer");
    expect(result.answered).toBe(true);
    expect(result.answer).toBe(K1_AUSSAGE);
    expect(result.citedSources).toEqual([k1]);
    expect(result.knowledgeClass).toBe("gesichert");
    expect(result.answer).not.toContain(KF1_AUSSAGE);
  });

  it("G2 KF1 irrtümlich bestätigt: Gegenposition und Grenze sichtbar, nicht gesichert", async () => {
    const a = await aufbau();
    const k1 = await a.anlegen(K1_TITEL, K1_AUSSAGE);
    const kf1 = await a.anlegen(KF1_TITEL, KF1_AUSSAGE);
    await a.bestaetigen(k1);
    await a.bestaetigen(kf1);

    const { result, gap } = await a.ask.ask(FRAGE_RF01, "viewer");
    expect(result.demo).toBe(true);
    expect(result.answered).toBe(true);
    expect(gap).toBeNull();
    const text = result.answer ?? "";
    // Beide Positionen im Wortlaut, jeweils hinter ihrem Titel.
    expect(text).toContain(`${K1_TITEL}: ${K1_AUSSAGE}`);
    expect(text).toContain(`${KF1_TITEL}: ${KF1_AUSSAGE}`);
    // Die Grenze: keine Widerspruchsprüfung ohne Modell, Bestätigung ersetzt sie nicht.
    expect(text).toContain("Ohne KI-Modell fand keine Widerspruchsprüfung statt");
    expect(text).toContain("eine fachliche Bestätigung ersetzt sie nicht");
    // Nicht still gewählt, nicht gesichert.
    expect(text).not.toBe(KF1_AUSSAGE);
    expect(result.knowledgeClass).not.toBe("gesichert");
    expect([...result.citedSources].sort()).toEqual([k1, kf1].sort());
    expect([...result.sources].sort()).toEqual([k1, kf1].sort());
    expect(result.steps.map((s) => s.sourceId).sort()).toEqual([k1, kf1].sort());
  });
});

describe("P05-AC08 · B-05 — widersprüchliche VT-1-Revisionen (RF-02)", () => {
  it("G3 gezielte Typ-/Revisionsrückfrage, beide Blätter genannt, kein Nm-Wert ohne Blattbindung", async () => {
    const a = await aufbau();
    const k2 = await a.anlegen(K2_TITEL, K2_AUSSAGE);
    const revA = await a.anlegen(REV_A_TITEL, REV_A_AUSSAGE);
    // Rev B ist das NEUERE Blatt — angelegt und bestätigt nach Rev A.
    const revB = await a.anlegen(REV_B_TITEL, REV_B_AUSSAGE);
    await a.bestaetigen(k2);
    await a.bestaetigen(revA);
    await a.bestaetigen(revB);

    const { result } = await a.ask.ask(FRAGE_RF02, "viewer");
    expect(result.answered).toBe(true);
    const text = result.answer ?? "";
    // Die Blätter werden nicht verschwiegen.
    expect(text).toContain(`${REV_A_TITEL}: ${REV_A_AUSSAGE}`);
    expect(text).toContain(`${REV_B_TITEL}: ${REV_B_AUSSAGE}`);
    expect(result.citedSources).toEqual(expect.arrayContaining([revA, revB]));
    // Gezielte Rückfrage nach Typ/Revision; ein neueres Datum allein entscheidet nicht.
    expect(text).toContain("Rückfrage: Welche dieser Quellen gilt für Ihren Fall?");
    expect(text).toContain("Typ, Revision");
    expect(text).toContain(
      "Ein neueres Datum oder eine höhere Revision allein entscheidet das nicht",
    );
    // Jeder Nm-Wert steht ausschließlich hinter dem Titel seines Testblatts — nie als Antwort.
    const absaetze = text.split("\n\n");
    const mitWert = absaetze.filter((z) => /\d+\s*Nm/.test(z));
    expect(mitWert).toHaveLength(2);
    for (const z of mitWert) {
      expect(z.startsWith(REV_A_TITEL) || z.startsWith(REV_B_TITEL)).toBe(true);
    }
    expect(absaetze[0]).not.toMatch(/\d+\s*Nm/);
    expect(absaetze.find((z) => z.includes("100 Nm"))?.startsWith(REV_B_TITEL)).toBe(true);
    expect(absaetze.find((z) => z.includes("10 Nm."))?.startsWith(REV_A_TITEL)).toBe(true);
    expect(result.knowledgeClass).not.toBe("gesichert");
  });
});

describe("P05-AC08 · Negation ist ein bedeutungstragender Unterschied (Ben, Nacharbeit 3)", () => {
  // Bis Kandidat 779f02cf lief der Wortlautvergleich über die Suchtokenisierung; „nicht" fiel als
  // Stoppwort heraus, beide Aussagen galten als gleich, und die Antwort blieb „gesichert".
  const MIT_NEGATION = "Bei abgeschaltetem Motor ist der Hubtisch nicht sicher.";
  const OHNE_NEGATION = "Bei abgeschaltetem Motor ist der Hubtisch sicher.";

  it("G6 sonst gleiche bestätigte Aussagen mit und ohne „nicht“: beide sichtbar, Rückfrage, nicht gesichert", async () => {
    const a = await aufbau();
    const nein = await a.anlegen("Hubtisch Motor abgeschaltet (Notiz A)", MIT_NEGATION);
    const ja = await a.anlegen("Hubtisch Motor abgeschaltet (Notiz B)", OHNE_NEGATION);
    await a.bestaetigen(nein);
    await a.bestaetigen(ja);

    const { result, gap } = await a.ask.ask(FRAGE_RF01, "viewer");
    expect(result.answered).toBe(true);
    expect(gap).toBeNull();
    const text = result.answer ?? "";
    expect(text).toContain(`: ${MIT_NEGATION}`);
    expect(text).toContain(`: ${OHNE_NEGATION}`);
    expect(text).toContain("Ohne KI-Modell fand keine Widerspruchsprüfung statt");
    expect(text).toContain("Rückfrage: Welche dieser Quellen gilt für Ihren Fall?");
    expect(result.knowledgeClass).not.toBe("gesichert");
    expect([...result.citedSources].sort()).toEqual([nein, ja].sort());
  });
});

describe("P05-AC08 · Vorzeichen sind ein bedeutungstragender Unterschied (Ben, Nacharbeit 4)", () => {
  // Bis Kandidat 710c0bb4 entfernte der Wortlautvergleich alle Nicht-Buchstaben/-Ziffern; „-10 °C"
  // und „+10 °C" galten als gleich, die abweichende bestätigte Quelle wurde übersprungen.
  const MINUS = "Zulässige Umgebungstemperatur am Hubtisch: -10 °C.";
  const PLUS = "Zulässige Umgebungstemperatur am Hubtisch: +10 °C.";

  it("G7 sonst gleiche bestätigte Aussagen mit -10 °C und +10 °C: beide sichtbar, Rückfrage, nicht gesichert", async () => {
    const a = await aufbau();
    const minus = await a.anlegen("Hubtisch Umgebungstemperatur (Notiz A)", MINUS);
    const plus = await a.anlegen("Hubtisch Umgebungstemperatur (Notiz B)", PLUS);
    await a.bestaetigen(minus);
    await a.bestaetigen(plus);

    const { result, gap } = await a.ask.ask(
      "Welche Umgebungstemperatur ist am Hubtisch zulässig?",
      "viewer",
    );
    expect(result.answered).toBe(true);
    expect(gap).toBeNull();
    const text = result.answer ?? "";
    expect(text).toContain(`: ${MINUS}`);
    expect(text).toContain(`: ${PLUS}`);
    expect(text).toContain("Ohne KI-Modell fand keine Widerspruchsprüfung statt");
    expect(text).toContain("Rückfrage: Welche dieser Quellen gilt für Ihren Fall?");
    expect(result.knowledgeClass).not.toBe("gesichert");
    expect([...result.citedSources].sort()).toEqual([minus, plus].sort());
  });
});

describe("P05-AC08 · Groß-/Kleinschreibung trägt Bedeutung (Ben, Nacharbeit 6)", () => {
  // Bis Kandidat 6bc37e1a glich der Wortlautvergleich die Schreibung an; „10 mW" und „10 MW"
  // galten als gleich, die abweichende bestätigte Quelle wurde übersprungen.
  const MILLI = "Maximale Leistung am Hubtisch-Antrieb: 10 mW.";
  const MEGA = "Maximale Leistung am Hubtisch-Antrieb: 10 MW.";

  it("G8 sonst gleiche bestätigte Aussagen mit 10 mW und 10 MW: beide sichtbar, Rückfrage, nicht gesichert", async () => {
    const a = await aufbau();
    const milli = await a.anlegen("Hubtisch-Antrieb Leistung (Notiz A)", MILLI);
    const mega = await a.anlegen("Hubtisch-Antrieb Leistung (Notiz B)", MEGA);
    await a.bestaetigen(milli);
    await a.bestaetigen(mega);

    const { result, gap } = await a.ask.ask(
      "Welche maximale Leistung hat der Hubtisch-Antrieb?",
      "viewer",
    );
    expect(result.answered).toBe(true);
    expect(gap).toBeNull();
    const text = result.answer ?? "";
    expect(text).toContain(`: ${MILLI}`);
    expect(text).toContain(`: ${MEGA}`);
    expect(text).toContain("Ohne KI-Modell fand keine Widerspruchsprüfung statt");
    expect(text).toContain("Rückfrage: Welche dieser Quellen gilt für Ihren Fall?");
    expect(result.knowledgeClass).not.toBe("gesichert");
    expect([...result.citedSources].sort()).toEqual([milli, mega].sort());
  });
});

describe("P05-AC08 · Gegenfälle", () => {
  it("G4 zwei bestätigte Quellen mit gleichem Wortlaut: keine Gegenüberstellung", async () => {
    const a = await aufbau();
    const eins = await a.anlegen(K1_TITEL, K1_AUSSAGE);
    const zwei = await a.anlegen(`${K1_TITEL} (Kopie Werk 2)`, K1_AUSSAGE);
    await a.bestaetigen(eins);
    await a.bestaetigen(zwei);

    const { result } = await a.ask.ask(FRAGE_RF01, "viewer");
    expect(result.answer).toBe(K1_AUSSAGE);
    expect(result.citedSources).toHaveLength(1);
    expect(result.knowledgeClass).toBe("gesichert");
  });

  it("G5 der wörtliche Add-in-Weg (retrievalOnly) bleibt unberührt", async () => {
    const a = await aufbau();
    const k1 = await a.anlegen(K1_TITEL, K1_AUSSAGE);
    const kf1 = await a.anlegen(KF1_TITEL, KF1_AUSSAGE);
    await a.bestaetigen(k1);
    await a.bestaetigen(kf1);

    const { result } = await a.ask.ask(FRAGE_RF01, "addin", "de", {
      retrievalOnly: true,
      validatedOnly: true,
      gapPolicy: "count_only",
    });
    expect(result.answer ?? "").not.toContain("Widerspruchsprüfung");
  });
});
