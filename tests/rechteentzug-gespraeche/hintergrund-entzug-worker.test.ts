// ================================================================================================
// produkt:20261010:rechteentzug-gespraeche-belege — NACHARBEIT 35 (Befund Ben an b248276; PV-05-04,
// AW04-K02): ENTZUG IM BEREITS LAUFENDEN HINTERGRUNDWORKER.
// ================================================================================================
//
// Befund: der Prüflauf liest Subjekt und Vergleichspool vorab (conflict-detection.ts) und ruft den
// Anbieter danach Vergleich für Vergleich. Wurde das Subjekt WÄHREND des Laufs auf vertraulich
// hochgestuft, begann trotzdem ein weiterer Anbieteraufruf mit seinem Inhalt und der alten Freigabe.
//
// Gemessen am ECHTEN Worker (`createAiCheckWorker`) mit dem ECHTEN Runner (`createAiCheckRunner`),
// echtem Wissensobjekt- und Konfliktdienst und echtem Reasoner. Nur der Anbieter ist ein
// ausdrücklich fiktiver Testanbieter: er protokolliert jeden Aufruf und hält den ersten
// Konfliktvergleich an, bis die Probe den Entzug gesetzt hat. Alle Inhalte sind erfunden.
//
// H1 · Entzug des Subjekts mitten im Lauf: kein weiterer Aufruf mit dem Subjektinhalt; das Urteil des
//      bereits laufenden Aufrufs wird nicht übernommen (kein Befund).
// H2 · Gegenfall ohne Entzug: alle Vergleiche laufen, derselbe Befund entsteht.
// H3 · Gegenfall unbeteiligt: wird nur ein Kandidat hochgestuft, gehen die übrigen Vergleiche des
//      Subjekts weiter — nur dieser Kandidat geht nicht mehr hinaus.
import { describe, expect, it } from "vitest";
import { createAiCheckRunner, createAiCheckWorker } from "../../services/app/src/ai-check-worker";
import { buildServices } from "../../services/app/src/build-app";
import { type ModelClient, ModelProvider, Reasoner } from "../../services/reasoner";
import { erteileKiFreigabe } from "../../services/reasoner/src/testhelfer-ki-freigabe";
import { GOOD_CONFLICT, GOOD_DUPLICATE } from "../review26-teilpruefung-ursache/fixture";

const SUBJEKT_MARKE = "Fiktivventil-S7";
const kandidatenMarke = (i: number) => `Fiktivpumpe-K${i}`;
const SATZ = "muss vor der Wartung geschlossen werden";
// Der angehaltene Vergleich urteilt „Widerspruch" — so wird sichtbar, ob sein Urteil übernommen wird.
const WIDERSPRUCH = JSON.stringify({
  relation: "widerspruch",
  older: null,
  confidence: 0.95,
  begruendung: "fiktiver Widerspruch",
  zitat_a: SATZ,
  zitat_b: SATZ,
});

type Aufruf = { text: string; nachEntzug: boolean };

async function buehne() {
  const services = buildServices();
  const aufrufe: Aufruf[] = [];
  const zustand = { entzogen: false, angehalten: false };
  const haken = { erster: () => {}, weiter: () => {} };
  const ersterAufruf = new Promise<void>((fertig) => {
    haken.erster = fertig;
  });
  const sperre = new Promise<void>((fertig) => {
    haken.weiter = fertig;
  });
  const client: ModelClient = {
    name: "fiktiver-testanbieter",
    rejectsConfidential: true,
    async complete(system, user) {
      aufrufe.push({ text: `${system}\n${user}`, nachEntzug: zustand.entzogen });
      const konflikt = system.includes('"relation"');
      if (konflikt && !zustand.angehalten) {
        zustand.angehalten = true;
        haken.erster();
        await sperre;
        return WIDERSPRUCH;
      }
      return konflikt ? GOOD_CONFLICT : GOOD_DUPLICATE;
    },
  };
  services.reasoner = new Reasoner(new ModelProvider(client));
  await erteileKiFreigabe(services.reasoner);
  const kandidaten: string[] = [];
  for (let i = 0; i < 3; i += 1) {
    const ko = await services.ko.create({
      title: `${kandidatenMarke(i)} im Kühlkreis`,
      statement: `Die ${kandidatenMarke(i)} ${SATZ}.`,
      type: "best_practice",
      category: "Betrieb",
      author: "u1",
      confidentiality: "intern",
    });
    kandidaten.push(ko.id);
  }
  const subjekt = await services.ko.create({
    title: `${SUBJEKT_MARKE} im Kühlkreis`,
    statement: `Das ${SUBJEKT_MARKE} ${SATZ}.`,
    type: "best_practice",
    category: "Betrieb",
    author: "u1",
    confidentiality: "intern",
  });
  const worker = createAiCheckWorker({
    ko: services.ko,
    run: createAiCheckRunner(services),
    log: () => undefined,
  });
  /** Der Hintergrundlauf: Vollabgleich (jeder Kandidat wird verglichen); `mitten` läuft im Halt. */
  const lauf = async (mitten: () => Promise<void>) => {
    expect(await services.ko.markAiCheckPending(subjekt.id)).toBe(true);
    const version = (await services.ko.get(subjekt.id))?.aiCheck?.koVersion;
    worker.enqueue(subjekt.id, version, "vollstaendig");
    await ersterAufruf;
    await mitten();
    zustand.entzogen = true;
    haken.weiter();
    await worker.idle();
  };
  const befundeZumSubjekt = async () =>
    (await services.conflicts.unresolved()).filter(
      (c) => c.koA === subjekt.id || c.koB === subjekt.id,
    );
  return { services, aufrufe, kandidaten, subjekt, lauf, befundeZumSubjekt };
}

const mit = (aufrufe: readonly Aufruf[], marke: string) =>
  aufrufe.filter((a) => a.text.includes(marke));

describe("Nacharbeit 35 · Entzug im laufenden Hintergrundworker", () => {
  it("H1 · Hochstufung des Subjekts mitten im Lauf: kein weiterer Aufruf mit seinem Inhalt, kein übernommenes Urteil", async () => {
    const b = await buehne();
    await b.lauf(async () => {
      await b.services.ko.setConfidentiality(b.subjekt.id, "vertraulich", "u1");
    });
    // Vor dem Entzug lief genau der angehaltene Vergleich mit dem Subjekt.
    expect(
      mit(
        b.aufrufe.filter((a) => !a.nachEntzug),
        SUBJEKT_MARKE,
      ),
    ).toHaveLength(1);
    // Nach dem Entzug: kein Aufruf, der den Subjektinhalt trägt.
    expect(
      mit(
        b.aufrufe.filter((a) => a.nachEntzug),
        SUBJEKT_MARKE,
      ),
    ).toEqual([]);
    // Das Urteil des bereits laufenden Aufrufs wird nicht übernommen.
    expect(await b.befundeZumSubjekt()).toEqual([]);
    // Der Lauf gilt nicht als vollständig geprüft.
    expect((await b.services.ko.get(b.subjekt.id))?.aiCheck?.status).not.toBe("done");
  });

  it("H2 · Gegenfall ohne Entzug: alle Vergleiche laufen, der Befund entsteht", async () => {
    const b = await buehne();
    await b.lauf(async () => undefined);
    // Jeder der drei Kandidaten wurde mit dem Subjekt verglichen.
    for (let i = 0; i < 3; i += 1) {
      const paar = mit(mit(b.aufrufe, SUBJEKT_MARKE), kandidatenMarke(i));
      expect(paar.length, `Kandidat ${i}`).toBeGreaterThanOrEqual(1);
    }
    expect((await b.befundeZumSubjekt()).length).toBeGreaterThanOrEqual(1);
  });

  it("H3 · Gegenfall unbeteiligt: nur der hochgestufte Kandidat geht nicht mehr hinaus", async () => {
    const b = await buehne();
    const gesperrt = 2;
    await b.lauf(async () => {
      await b.services.ko.setConfidentiality(b.kandidaten[gesperrt] ?? "", "vertraulich", "u1");
    });
    const danach = b.aufrufe.filter((a) => a.nachEntzug);
    expect(mit(danach, kandidatenMarke(gesperrt))).toEqual([]);
    // Die übrigen Vergleiche des Subjekts gehen weiter.
    expect(mit(danach, SUBJEKT_MARKE).length).toBeGreaterThanOrEqual(1);
  });
});
