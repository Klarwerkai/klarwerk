import { describe, expect, it } from "vitest";
import { InMemoryKoRepo, KoService } from "../../knowledge-object";
import { InMemoryAnswerSnapshotRepo } from "./repo";
import { AskService } from "./service";

// ================================================================================================
// W3-C1 (Auftrag 76) — DER SNAPSHOT-SCHREIBWEG WIRD ERSTMALS PRODUKTIV
// ================================================================================================
//
// Bis hierher war der Beleg gebaut, getestet und migriert — und niemand konstruierte ihn. Die
// Tabellen entstanden beim Start und blieben leer (Prewrite 72 §1). Diese Faelle pinnen den
// Anschluss, und zwar OHNE die noch offene Produktentscheidung zur Validierungsreferenz
// vorwegzunehmen: `validationDecisionRef` bleibt ehrlich `null` mit einem Grund, der stimmt.

const REASONER = {
  answer: async () => ({
    answered: true,
    answer: "Alle 500 Stunden schmieren.",
    sources: ["ko-a", "ko-b"],
    citedSources: ["ko-a"],
    knowledgeClass: "validiert" as const,
  }),
  // Der Antwortweg benutzt nur `answer`; die uebrigen Reasoner-Faehigkeiten sind hier nicht im Spiel.
} as unknown as ConstructorParameters<typeof AskService>[0]["reasoner"];

/**
 * G27 R1: die Suche ist fail-closed. Ein direkter Testaufbau ohne Freigabe ist eine nicht in
 * Betrieb genommene Instanz — in der echten App tut das die Startorchestrierung. Dieselbe
 * mechanische Initialisierung ueber den Produktpfad wie im Bestandstest.
 */
async function koDienst(): Promise<KoService> {
  const koService = new KoService({ repo: new InMemoryKoRepo() });
  await koService.activateSearchProjectionV2();
  return koService;
}

async function aufbau(mitSnapshots: boolean) {
  const snapshots = new InMemoryAnswerSnapshotRepo();
  let n = 0;
  const dienst = new AskService({
    reasoner: REASONER,
    koService: await koDienst(),
    gaps: {
      insert: async () => {},
      findById: async () => undefined,
      update: async () => {},
      delete: async () => {},
      all: async () => [],
    },
    now: () => 1_754_121_600_000,
    genId: () => `id-${++n}`,
    ...(mitSnapshots ? { answerSnapshots: snapshots } : {}),
  });
  return { dienst, snapshots };
}

/**
 * AUFTRAG 89 (BEN 82, Befund 1) — EIN AUFBAU, DESSEN ABLAGE AN EINER GENAU BENANNTEN STELLE BRICHT.
 *
 * Die Ablage ist echt (`InMemoryAnswerSnapshotRepo`); nur die EINE gewaehlte Methode wirft. So misst
 * der Fall den Fehlerweg des DIENSTES und nicht den einer Attrappe, die ohnehin nichts kann.
 *
 * Der Audit-Zaehler reist mit, weil die eigentliche Frage nicht ist „faengt jemand den Fehler",
 * sondern „laeuft der Antwortlauf danach ZU ENDE". Der Beleg wird VOR dem Audit geschrieben
 * (service.ts): ein verschluckter Fehler nimmt dem Lauf also nachweisbar seinen Rest.
 */
async function aufbauMitDefekt(defekt: "createRecord" | "appendSnapshot") {
  const snapshots = new InMemoryAnswerSnapshotRepo();
  const kaputt = new Proxy(snapshots, {
    get(ziel, feld, empfaenger) {
      if (feld === defekt) {
        return async () => {
          throw new Error(`${defekt} ist ausgefallen`);
        };
      }
      return Reflect.get(ziel, feld, empfaenger);
    },
  }) as InMemoryAnswerSnapshotRepo;
  let auditEintraege = 0;
  let n = 0;
  const dienst = new AskService({
    reasoner: REASONER,
    koService: await koDienst(),
    gaps: {
      insert: async () => {},
      findById: async () => undefined,
      update: async () => {},
      delete: async () => {},
      all: async () => [],
    },
    audit: {
      record: async () => {
        auditEintraege += 1;
      },
      // `NonNullable`, weil `audit` optional ist und `exactOptionalPropertyTypes` ein `undefined`
      // im Werttyp nicht durchlaesst — der Compiler hat das gefangen, nachdem die Testlaeufe
      // laengst gruen waren. Genau dafuer steht das Build-Tor ueber dem Testtor.
    } as unknown as NonNullable<ConstructorParameters<typeof AskService>[0]["audit"]>,
    now: () => 1_754_121_600_000,
    genId: () => `id-${++n}`,
    answerSnapshots: kaputt,
  });
  return { dienst, snapshots, audit: () => auditEintraege };
}

describe("W3-C1/76 · ein Antwortlauf persistiert genau einen Snapshot", () => {
  it("stabile Identitaet: ein Record, Revision 1 — und ein zweiter Lauf ist eine ANDERE Antwort", async () => {
    const { dienst, snapshots } = await aufbau(true);
    const erste = await dienst.ask("Wie oft schmieren?", "anna", "de");
    expect(erste.answerId, "der Antwortlauf muss seine Identitaet ausweisen").not.toBeNull();
    if (!erste.answerId) {
      throw new Error("keine answerId");
    }
    expect(await snapshots.findRecord(erste.answerId)).toBeDefined();
    const revisionen = await snapshots.listSnapshots(erste.answerId);
    expect(revisionen.map((s) => s.snapshotRevision)).toEqual([1]);

    // GEGENKONTROLLE: ohne sie waere der Positivbefund blind gegen eine fest verdrahtete Kennung.
    const zweite = await dienst.ask("Wie oft schmieren?", "anna", "de");
    expect(zweite.answerId).not.toBe(erste.answerId);
  });

  it("der Snapshot bindet citedSources, nicht alle Kandidaten", async () => {
    const { dienst, snapshots } = await aufbau(true);
    const out = await dienst.ask("Frage", "anna", "de");
    if (!out.answerId) {
      throw new Error("keine answerId");
    }
    const s = await snapshots.findSnapshot(out.answerId, 1);
    expect(s?.citedSources).toEqual(["ko-a"]);
    expect(s?.citedSources).not.toContain("ko-b");
  });

  // ============================================================================================
  // JOB 541 D3 — DIESE ZUSICHERUNG WURDE SACHLICH FORTGESCHRIEBEN, NICHT GELOESCHT.
  // ============================================================================================
  //
  // Hier stand bis D3: `validationDecisionRefReason === "w3c_no_decision_carrier"` — „es gibt
  // keinen Traeger von der Entscheidung zur Antwort". Dieser Satz war bei Auftrag 76 richtig und
  // ist es heute NICHT mehr: `KnowledgeObject.validationDecisionRef` existiert und wird von
  // `setValidationDecisionRef` geschrieben. BEN hat den ueberholten Grund in der D2-Pruefung
  // ausdruecklich benannt.
  //
  // Die Zusicherung wird deshalb ersetzt und nicht bloss entfernt: Das obere Feld bleibt leer —
  // aber jetzt, WEIL die Referenz nach KW-W3-23 je Evidence liegt, und nicht, weil es keine gaebe.
  // Der Unterschied ist der ganze Fortschritt dieses Durchgangs.
  it("das top-level Feld bleibt leer — jetzt WEIL die Referenz je Evidence liegt", async () => {
    const { dienst, snapshots } = await aufbau(true);
    const out = await dienst.ask("Frage", "anna", "de");
    if (!out.answerId) {
      throw new Error("keine answerId");
    }
    const s = await snapshots.findSnapshot(out.answerId, 1);
    expect(s?.validationDecisionRef).toBeNull();
    // Beide ueberholten Gruende duerfen an einem NEUEN Snapshot nicht mehr stehen.
    expect(s?.validationDecisionRefReason).not.toBe("w3b_findbyseq_missing");
    expect(s?.validationDecisionRefReason).not.toBe("w3c_no_decision_carrier");
    expect(s?.validationDecisionRefReason).toBe("w3_23_ref_liegt_je_evidence");
    // Und die neue Wahrheit steht unten: jede Evidence traegt genau eines von beidem.
    for (const e of s?.evidence ?? []) {
      const hatRef = e.validationDecisionRef !== undefined;
      const hatGrund = e.validationReferenceAbsenceReason !== undefined;
      expect(hatRef !== hatGrund).toBe(true);
    }
  });

  it("resolutionId und sourceRecordId bleiben unveraendert leer mit ihren eigenen Gruenden", async () => {
    const { dienst, snapshots } = await aufbau(true);
    const out = await dienst.ask("Frage", "anna", "de");
    if (!out.answerId) {
      throw new Error("keine answerId");
    }
    const s = await snapshots.findSnapshot(out.answerId, 1);
    expect(s?.resolutionId).toBeNull();
    expect(s?.resolutionIdReason).toBe("w1_not_on_answer_path");
    for (const e of s?.evidence ?? []) {
      expect(e.sourceRecordId).toBeNull();
      expect(e.sourceRecordIdReason).toBe("w2a_not_wired");
    }
  });

  // ==============================================================================================
  // AUFTRAG 89 (BEN 82, Befund 2) — HIER STAND EINE ZUSICHERUNG, DIE NICHTS ZUGESICHERT HAT.
  // ==============================================================================================
  //
  // Der Fall hiess „hoechstens PARTIAL" und prueft nur `not.toBe("COMPLETE")`. Das laesst die
  // gefaehrlichste Mutation durch, die es an dieser Stelle gibt: eine ERFUNDENE KO-Fassung. Setzt
  // der Schreibweg `knowledgeObjectVersion` auf einen Wert, wird jede Evidenz primaergebunden
  // (types.ts primaerGebunden); weil `resolutionId` und `validationDecisionRef` weiterhin `null`
  // sind, ergibt der Status dann PARTIAL — und PARTIAL ist nicht COMPLETE. Die Zusicherung hielt,
  // die Probe schwieg.
  //
  // GEPINNT WAR DIE FUNKTION, UNGEPINNT DIE VERDRAHTUNG. `answer-snapshot-w3a-56.test.ts` pinnt
  // `answerSnapshotStatus` bereits auf INCOMPLETE — aber an einer SELBST GEBAUTEN Vorlage. Was der
  // DIENST schreibt, hat bis hierher niemand gemessen. Genau das tut dieser Fall jetzt, und zwar an
  // beiden Enden: an der Fassung selbst und an dem Status, den sie erzwingt.
  it("der Dienst erfindet keine KO-Fassung — Version null, Status exakt INCOMPLETE", async () => {
    const { dienst, snapshots } = await aufbau(true);
    const out = await dienst.ask("Frage", "anna", "de");
    if (!out.answerId) {
      throw new Error("keine answerId");
    }
    const s = await snapshots.findSnapshot(out.answerId, 1);
    // V1 — die Fassung ist ehrlich ungebunden. `null` heisst „nicht gebunden", nicht „Fassung 0".
    expect(s?.evidence.length, "ohne Evidenz waere die Aussage leer").toBeGreaterThan(0);
    for (const e of s?.evidence ?? []) {
      expect(e.knowledgeObjectVersion, "eine erfundene Fassung waere eine Luege").toBeNull();
    }
    // V2 — der Status folgt daraus ZWINGEND. Exakt, nicht „irgendetwas ausser COMPLETE".
    expect(s?.status).toBe("INCOMPLETE");
    // Die alte, schwaechere Zusage bleibt zusaetzlich stehen — sie ist nicht falsch, nur zu wenig.
    expect(s?.status).not.toBe("COMPLETE");
  });

  it("ohne verdrahtetes Repo bleibt der Antwortweg unveraendert — fremde Aufbauten sind kompatibel", async () => {
    const { dienst } = await aufbau(false);
    const out = await dienst.ask("Frage", "anna", "de");
    // Die Antwort selbst bleibt vollstaendig; nur der Beleg entsteht nicht.
    expect(out.result.answered).toBe(true);
    expect(out.answerId).toBeNull();
  });

  it("das Schreiben sucht nicht — kein Lesen von Bestandsbelegen, und der Zaehler kann zaehlen", async () => {
    // PRAEZISE FORMULIERT, NACHDEM DER ERSTE ANLAUF DAS FALSCHE MASS NAHM: ein Zaehler auf
    // `listSnapshots` schlaegt hier zwangslaeufig an — nicht weil der DIENST sucht, sondern weil
    // `appendSnapshot` INTERN die Revisionskette prueft (Freeze 59). Diese eine Auflistung ist
    // Teil des Schreibens, nicht eine Suche nach Evidence.
    //
    // Gemessen wird deshalb, was der Dienst wirklich nicht tun darf: einen VORHANDENEN Beleg
    // lesen, um daraus den neuen zu bauen. `findSnapshot` und `findRecord` benutzt der
    // Schreibpfad des Repos nachweislich nicht — ihr Zaehler ist damit eine ehrliche Aussage
    // ueber den Dienst.
    const snapshots = new InMemoryAnswerSnapshotRepo();
    let leseAufrufe = 0;
    let listAufrufe = 0;
    const beobachtet = new Proxy(snapshots, {
      get(ziel, feld, empfaenger) {
        if (feld === "findSnapshot" || feld === "findRecord") {
          leseAufrufe += 1;
        }
        if (feld === "listSnapshots") {
          listAufrufe += 1;
        }
        return Reflect.get(ziel, feld, empfaenger);
      },
    }) as InMemoryAnswerSnapshotRepo;
    let n = 0;
    const dienst = new AskService({
      reasoner: REASONER,
      koService: await koDienst(),
      gaps: {
        insert: async () => {},
        findById: async () => undefined,
        update: async () => {},
        delete: async () => {},
        all: async () => [],
      },
      now: () => 1_754_121_600_000,
      genId: () => `id-${++n}`,
      answerSnapshots: beobachtet,
    });
    await dienst.ask("Frage", "anna", "de");
    expect(leseAufrufe, "der Dienst darf keinen vorhandenen Beleg lesen").toBe(0);
    // Die EINE Auflistung ist der interne Kettencheck des Repos — benannt, nicht wegdefiniert.
    expect(listAufrufe, "genau eine interne Kettenpruefung, keine zweite").toBe(1);
    // POSITIVKONTROLLE: beide Zaehler MUESSEN zaehlen koennen, sonst beweist die 0 nichts.
    await beobachtet.findSnapshot("egal", 1);
    await beobachtet.listSnapshots("egal");
    expect(leseAufrufe).toBe(1);
    expect(listAufrufe).toBe(2);
  });
});

// ================================================================================================
// AUFTRAG 89 (BEN 82, Befund 1) — DIE ZUSAGE IM QUELLTEXT WIRD ZUR ZUSICHERUNG IM TEST
// ================================================================================================
//
// `service.ts` verspricht ausdruecklich: „Fehler hier duerfen die Antwort nicht verschlucken; der
// Beleg ist eine Zugabe, keine Vorbedingung." Die Laufzeit hielt das nicht — der Aufruf lag in
// keinem Fangzweig, und ein Ausfall der Ablage erreichte den Fragenden als Ausnahme.
//
// EINE ZUSAGE OHNE ZUSICHERUNG IST EINE BEHAUPTUNG. Diese vier Faelle machen daraus eine Aussage,
// die man widerlegen kann. Sie waren rot, bevor der Fangzweig entstand.
describe("W3-C1/89 · ein Ausfall der Ablage nimmt dem Fragenden nicht die Antwort", () => {
  it("E1 · createRecord faellt aus — die Antwort kommt, die Kennung ist ehrlich null", async () => {
    const { dienst } = await aufbauMitDefekt("createRecord");
    const out = await dienst.ask("Wie oft schmieren?", "anna", "de");
    expect(out.result.answered).toBe(true);
    expect(out.result.answer).toContain("500");
    // `null` heisst hier genau das, was es seit Auftrag 76 heisst: es wurde nichts persistiert.
    expect(out.answerId).toBeNull();
    // Der Beleg des Antwortvorgangs bleibt nutzbar — sonst waere die Antwort nur halb geliefert.
    expect(out.receipt.length).toBeGreaterThan(0);
  });

  it("E2 · appendSnapshot faellt aus — dieselbe Zusage, eine Stufe spaeter", async () => {
    const { dienst } = await aufbauMitDefekt("appendSnapshot");
    const out = await dienst.ask("Wie oft schmieren?", "anna", "de");
    expect(out.result.answered).toBe(true);
    expect(out.answerId).toBeNull();
    expect(out.receipt.length).toBeGreaterThan(0);
  });

  it("E3 · Positivkontrolle: ohne Ausfall traegt derselbe Aufbau eine Kennung", async () => {
    // OHNE DIESEN FALL BEWIESE DAS NULL AUS E1/E2 NICHTS: es koennte auch heissen, dass der Aufbau
    // ueberhaupt keine Belege schreibt. Erst der Gegenfall macht die beiden Nullen zu einer Aussage.
    const { dienst, snapshots } = await aufbau(true);
    const out = await dienst.ask("Wie oft schmieren?", "anna", "de");
    expect(out.answerId).not.toBeNull();
    if (!out.answerId) {
      throw new Error("keine answerId");
    }
    expect(await snapshots.findRecord(out.answerId)).toBeDefined();
  });

  it("E4 · der Lauf endet trotzdem — das Audit des Antwortvorgangs bleibt genau einmal geschrieben", async () => {
    // DIE EIGENTLICHE FRAGE. „Kein Absturz" waere zu wenig: der Beleg wird VOR dem Audit
    // geschrieben, also haette ein durchgereichter Fehler dem Lauf seinen REST genommen — Audit,
    // Wissensluecke, Rueckgabeweg. Gemessen wird deshalb nicht die Abwesenheit einer Ausnahme,
    // sondern die Anwesenheit dessen, was NACH der Ablage kommt.
    const { dienst, audit } = await aufbauMitDefekt("appendSnapshot");
    const out = await dienst.ask("Wie oft schmieren?", "anna", "de");
    expect(out.answerId).toBeNull();
    expect(audit(), "der Antwortlauf muss zu Ende laufen, nicht nur ueberleben").toBe(1);
    // Eine beantwortete Frage erzeugt keine Wissensluecke — der Ausfall aendert daran nichts.
    expect(out.gap).toBeNull();
  });
});
