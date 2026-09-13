// ================================================================================================
// JOB 3789 — „ALS WAHR KENNZEICHNEN" GILT DER FASSUNG, DIE DER ADMIN GELESEN HAT.
// ================================================================================================
//
// WARUM ES DIESE DATEI GIBT. `adminValidate` las das Objekt und schrieb den Validierungsstatus
// danach OHNE Compare-and-Set — als einziger Schreibweg des Validierungsdienstes. Lief dazwischen
// ein `revise`, sprangen „validiert" und Vertrauen 99 auf einen Text ueber, den nie ein Mensch
// geprueft hat; der Verweis auf den Beleg unterblieb (sein CAS greift schon), und uebrig blieb der
// schlimmste Mischzustand: hoechste Evidenzstufe ohne aufloesbaren Beleg.
//
// WELCHE BESTELLUNG SIE ERFUELLT. `jobs/3667/runde-2/RUECKGABE.md:87`, Punkt 1 der „ZIELPFADE, DIE
// FUER DEN VOLLSTAENDIGEN SCHLUSS FEHLEN": „`adminValidate` nimmt kein `expectedVersion` und reicht
// keines an `setValidationState` durch (das CAS existiert dort bereits als Option)."
//
// WELCHE STELLE SIE FESTNAGELT. `services/validation/src/service.ts`, `adminValidate`: die Bindung
// des Schreibvorgangs an die gelesene Fassung UND die Auswertung des Rueckgabewerts — kein Beleg,
// kein Verweis, keine Validatorin und keine „validiert"-Antwort fuer eine Validierung, die nicht
// stattgefunden hat.
//
// WAS SIE NICHT MISST. Echte Nebenlaeufigkeit zweier Verbindungen gegen echtes Postgres. Der
// Wettlauf wird ueber eine Huelle um den `KoService` GESTELLT (deren `get` genau einmal einen
// Zwischenschritt faehrt) — dieselbe Grenze, die `setValidationState` selbst hat.
import { describe, expect, it } from "vitest";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import {
  type CreateKoInput,
  InMemoryKoRepo,
  type KnowledgeObject,
  KoService,
} from "../../services/knowledge-object";
import { InMemoryAssignmentRepo, InMemoryRatingRepo } from "../../services/validation/src/repo";
import { ValidationService } from "../../services/validation/src/service";
import { ValidationError } from "../../services/validation/src/types";

const ADMIN = "adam-admin";
const FREMDE = "frieda-fremde";

function koInput(overrides: Partial<CreateKoInput> = {}): CreateKoInput {
  return {
    title: "Wartung der Spezialpresse",
    statement: "Alle 500 Stunden schmieren.",
    type: "best_practice",
    category: "Technik",
    author: "anna",
    neededValidations: 2,
    ...overrides,
  };
}

/**
 * DIE HUELLE, die den Wettlauf stellt: nach einem `get` laeuft GENAU EINMAL der scharf gemachte
 * Zwischenschritt. Der Aufrufer haelt dann die alte Fassung in der Hand, waehrend die gespeicherte
 * schon weiter ist — genau das Fenster zwischen `get` und `setValidationState` in `adminValidate`.
 *
 * Ein Unterklassen-Aufsatz und keine Attrappe: so laufen Sperre, Versionszaehlung und
 * Compare-and-Set des echten `KoService` mit. Eine nachgebaute Attrappe koennte den No-op nur
 * behaupten.
 */
class WettlaufKoService extends KoService {
  private zwischenschritt: (() => Promise<void>) | null = null;

  /** Der naechste `get` zieht diesen Schritt nach sich — danach entwaffnet sich die Huelle selbst. */
  scharf(schritt: () => Promise<void>): void {
    this.zwischenschritt = schritt;
  }

  override async get(id: string): Promise<KnowledgeObject | undefined> {
    const gelesen = await super.get(id);
    const schritt = this.zwischenschritt;
    if (gelesen && schritt) {
      this.zwischenschritt = null; // GENAU EINMAL — sonst liefe der Schritt auch in jedem Folgelesen.
      await schritt();
    }
    return gelesen;
  }
}

async function aufbau() {
  const auditRepo = new InMemoryAuditRepo();
  const audit = new AuditService({ repo: auditRepo });
  const koService = new WettlaufKoService({ repo: new InMemoryKoRepo() });
  const dienst = new ValidationService({
    koService,
    ratings: new InMemoryRatingRepo(),
    assignments: new InMemoryAssignmentRepo(),
    audit,
  });
  const ko = await koService.create(koInput());
  return { dienst, audit, auditRepo, koService, koId: ko.id, version: ko.version };
}

describe("JOB 3789 · A — der Wettlauf: ein `revise` zwischen Lesen und Schreiben gewinnt", () => {
  it("A · das Objekt behaelt den Stand, den das `revise` gesetzt hat — kein Status, kein Beleg", async () => {
    const { dienst, audit, koService, koId, version } = await aufbau();
    expect(version, "Vorbedingung: das Objekt steht auf Fassung 1").toBe(1);
    expect((await koService.get(koId))?.status, "Vorbedingung: offen").toBe("offen");

    koService.scharf(async () => {
      await koService.revise(koId, { statement: "Alle 250 Stunden schmieren." }, FREMDE);
    });
    await dienst.adminValidate(koId, ADMIN);

    const gespeichert = await koService.get(koId);
    expect(gespeichert?.version, "die Fassung des `revise` gilt").toBe(2);
    expect(
      gespeichert?.status,
      "der Admin-Status ist auf eine ungelesene Fassung uebergesprungen",
    ).toBe("offen");
    expect(
      gespeichert?.trust,
      "das Vertrauen steht auf dem Wert, den das `revise` gesetzt hat — nicht auf 99",
    ).toBe(0);
    expect(
      gespeichert?.validationDecisionRef,
      "ein Verweis auf eine Entscheidung, die nicht wirkte",
    ).toBeUndefined();

    // Der Beleg ist das Versprechen: ueber eine Validierung, die nicht stattfand, darf keiner stehen.
    expect(await audit.list({ action: "ko.admin-validated" })).toHaveLength(0);
    expect(
      gespeichert?.ownership?.validators,
      "das Aggregat nennt eine Validatorin fuer eine Entscheidung ohne Wirkung",
    ).toBeUndefined();
  });
});

describe("JOB 3789 · B — die Rueckgabe luegt nicht", () => {
  it("B · sie traegt den wirklich gespeicherten Stand und keinen Verweis", async () => {
    const { dienst, koService, koId } = await aufbau();
    koService.scharf(async () => {
      await koService.revise(koId, { statement: "Alle 250 Stunden schmieren." }, FREMDE);
    });

    const ergebnis = await dienst.adminValidate(koId, ADMIN);
    const gespeichert = await koService.get(koId);
    expect(ergebnis.status, "die Antwort behauptet eine Validierung, die es nicht gab").toBe(
      "offen",
    );
    expect(ergebnis.status).toBe(gespeichert?.status);
    expect(ergebnis.trust).toBe(gespeichert?.trust);
    expect(ergebnis.trust).not.toBe(99);
    expect(
      ergebnis.validationDecisionRef,
      "eine Referenz ohne Entscheidung waere ein Verweis ins Leere",
    ).toBeNull();
  });

  it("B2 · die Stimmenzahlen der Antwort sind GEMESSEN, nicht feste Nullen", async () => {
    const { dienst, koService, koId } = await aufbau();
    // Der Zwischenschritt setzt die neue Fassung UND eine Stimme auf sie: haette die Antwort feste
    // Nullen, bliebe dieser Unterschied unsichtbar.
    koService.scharf(async () => {
      await koService.revise(koId, { statement: "Alle 250 Stunden schmieren." }, FREMDE);
      await dienst.rate(koId, "paula-prueferin", "up");
    });

    const ergebnis = await dienst.adminValidate(koId, ADMIN);
    const gespeichert = await koService.get(koId);
    expect(ergebnis.up, "die gruene Stimme der gueltigen Fassung fehlt in der Antwort").toBe(1);
    expect(ergebnis.warn).toBe(0);
    expect(ergebnis.down).toBe(0);
    expect(ergebnis.trust, "auch das Vertrauen kommt aus dem gespeicherten Objekt").toBe(
      gespeichert?.trust,
    );
    expect(ergebnis.status).toBe("offen");
  });
});

describe("JOB 3789 · C — KALIBRIERUNG: der Normalfall bleibt Zeichen fuer Zeichen derselbe", () => {
  it("C · ohne nebenlaeufiges `revise` wird validiert, belegt, verwiesen und fortgeschrieben", async () => {
    const { dienst, audit, auditRepo, koService, koId, version } = await aufbau();
    const ergebnis = await dienst.adminValidate(koId, ADMIN);

    expect(ergebnis.status).toBe("validiert");
    expect(ergebnis.trust).toBe(99);
    const ref = ergebnis.validationDecisionRef;
    expect(ref, "der Normalfall muss die Referenz liefern").not.toBeNull();
    if (!ref) {
      throw new Error("keine Referenz");
    }

    const gespeichert = await koService.get(koId);
    expect(gespeichert?.version, "der Normalfall aendert die Fassung nicht").toBe(version);
    expect(gespeichert?.status).toBe("validiert");
    expect(gespeichert?.trust).toBe(99);
    expect(gespeichert?.validationDecisionRef).toEqual({
      auditSeq: ref.auditSeq,
      auditHash: ref.auditHash,
    });

    // Der Beleg existiert, gilt DIESER Fassung und ist ueber die Referenz aufloesbar.
    const eintraege = await audit.list({ action: "ko.admin-validated" });
    expect(eintraege).toHaveLength(1);
    expect(eintraege[0]?.actor).toBe(ADMIN);
    expect(eintraege[0]?.payload.koVersion).toBe(version);
    const aufgeloest = await auditRepo.findBySeq(ref.auditSeq);
    expect(aufgeloest?.hash).toBe(ref.auditHash);
    expect(aufgeloest?.target).toBe(koId);

    expect(gespeichert?.ownership?.validators).toContain(ADMIN);
  });
});

describe("JOB 3789 · D — NICHT GEFUNDEN bleibt NICHT GEFUNDEN", () => {
  it("D · eine unbekannte Kennung wirft weiterhin ValidationError(NOT_FOUND)", async () => {
    const { dienst } = await aufbau();
    await expect(dienst.adminValidate("gibt-es-nicht", ADMIN)).rejects.toThrow(ValidationError);
    await expect(dienst.adminValidate("gibt-es-nicht", ADMIN)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
