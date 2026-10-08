// ================================================================================================
// aufnahme:20260922:gesamt-wissen-frische (R-0248) — NACH FRISTENDE IN ANTWORTEN NICHT MEHR GESICHERT.
// ================================================================================================
//
// Zwei Ebenen, beide mit Gegenprobe:
//   1 die Einstufungsregel selbst (`answerStanding`): eine tragende Quelle mit abgelaufener
//     Haltbarkeit hebt „gesichert" auf — validiert allein reicht dann nicht;
//   2 der echte Fragepfad (`AskService.ask`) mit EINER Uhr für Bestand und Frage: dieselbe
//     validierte Quelle trägt vor Fristende „gesichert", danach nicht mehr.
import { describe, expect, it } from "vitest";
import { InMemoryGapRepo } from "../../services/ask/src/repo";
import { AskService } from "../../services/ask/src/service";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import { Reasoner } from "../../services/reasoner";
import { answerStanding } from "../../services/reasoner/src/provider";

const TAG = 24 * 60 * 60 * 1000;
const START = Date.parse("2026-01-01T00:00:00.000Z");
// best_practice: 365 Tage Halbwertszeit (services/knowledge-object/src/frische.ts).
const VOR_FRISTENDE = START + 100 * TAG;
const NACH_FRISTENDE = START + 400 * TAG;

describe("R-0248 · die Einstufungsregel", () => {
  it("validiert und haltbar → gesichert; validiert, aber abgelaufen → ungeprüft", () => {
    expect(answerStanding([{ status: "validiert", trust: 90 }]).knowledgeClass).toBe("gesichert");
    expect(
      answerStanding([{ status: "validiert", trust: 90, haltbarkeitAbgelaufen: true }])
        .knowledgeClass,
    ).toBe("ungeprueft");
    // Eine einzige abgelaufene Quelle unter mehreren genügt.
    expect(
      answerStanding([
        { status: "validiert", trust: 90 },
        { status: "validiert", trust: 80, haltbarkeitAbgelaufen: true },
      ]).knowledgeClass,
    ).toBe("ungeprueft");
  });
});

async function aufbau(frageZeit: number) {
  const koRepo = new InMemoryKoRepo();
  const koService = new KoService({ repo: koRepo, now: () => START });
  await koService.activateSearchProjectionV2();
  const angelegt = await koService.create({
    title: "Ventil bei Überdruck schließen",
    statement: "Bei Überdruck Ventil X manuell schließen.",
    type: "best_practice",
    category: "Anlage 1",
    author: "anna",
  });
  // Den Prüfstand direkt in der Ablage setzen — der Prüfweg selbst ist nicht Gegenstand dieses Falls.
  const gespeichert = await koRepo.findById(angelegt.id);
  if (!gespeichert) {
    throw new Error("Aufbau: das angelegte Objekt fehlt in der Ablage.");
  }
  await koRepo.update({ ...gespeichert, status: "validiert", trust: 90 });
  const ask = new AskService({
    reasoner: new Reasoner(),
    koService,
    gaps: new InMemoryGapRepo(),
    audit: new AuditService({ repo: new InMemoryAuditRepo() }),
    now: () => frageZeit,
  });
  return { ask, id: angelegt.id };
}

describe("R-0248 · der Fragepfad", () => {
  it("VORBEDINGUNG: vor Fristende trägt die validierte Quelle „gesichert“", async () => {
    const { ask, id } = await aufbau(VOR_FRISTENDE);
    const { result } = await ask.ask("Was tun bei Überdruck am Ventil?");
    expect(result.answered).toBe(true);
    expect(result.citedSources).toContain(id);
    expect(result.knowledgeClass).toBe("gesichert");
  });

  it("nach Fristende gilt dieselbe Quelle nicht mehr als gesichert", async () => {
    const { ask, id } = await aufbau(NACH_FRISTENDE);
    const { result } = await ask.ask("Was tun bei Überdruck am Ventil?");
    expect(result.answered).toBe(true);
    expect(result.citedSources).toContain(id);
    expect(result.knowledgeClass).toBe("ungeprueft");
  });
});
