import { describe, expect, it } from "vitest";
import { type AuditEntry, AuditService, InMemoryAuditRepo } from "../../audit";
import { type CreateKoInput, InMemoryKoRepo, KoService } from "../../knowledge-object";
import { InMemoryAssignmentRepo, InMemoryRatingRepo } from "./repo";
import { ValidationService } from "./service";
import { InMemoryValidationSettingsRepo } from "./settings";

// Die Pruefung selbst liegt im Audit-Modul (`pruefeValidationDecisionRef`), ist aber noch NICHT
// aus dessen Fassade ausgeleitet — `services/audit/index.ts` liegt ausserhalb des Scopes von
// Auftrag 67. Dieser Test prueft die Bindung deshalb an ihren Bestandteilen, nicht ueber die
// fremde Funktion; die Ausleitung ist als Restgrenze berichtet.
const ENTSCHEIDUNGEN = ["ko.rated", "ko.admin-validated", "ko.returned-to-author"];

function deckt(
  eintrag: AuditEntry | undefined,
  ref: { auditSeq: number; auditHash: string },
  koId: string,
  koVersion: number,
): boolean {
  return (
    !!eintrag &&
    eintrag.seq === ref.auditSeq &&
    eintrag.hash === ref.auditHash &&
    ENTSCHEIDUNGEN.includes(eintrag.action) &&
    eintrag.target === koId &&
    eintrag.payload.koVersion === koVersion
  );
}

// ================================================================================================
// W3-B (KW-W3-19) — DIE BINDUNG AN DIE ENTSCHEIDUNG
// ================================================================================================
//
// KW-W3-19: „ValidationService uebernimmt die Referenz UNMITTELBAR aus dem Rueckgabewert von
// AuditService.record()." Keine spaetere Suche, keine Rekonstruktion ueber Zeitpunkt, Actor,
// KO-Version oder aktuellen Status.
//
// Der zweite, ebenso wichtige Teil: NUR die drei Entscheidungen tragen eine Referenz. Eine
// Admin-Einstellung und eine Zuweisung sind keine Aussage darueber, ob etwas geprueft wurde
// (Preflight 64 §2).

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

async function aufbau(mitAudit = true) {
  const auditRepo = new InMemoryAuditRepo();
  const audit = new AuditService({ repo: auditRepo });
  const koService = new KoService({ repo: new InMemoryKoRepo() });
  const dienst = new ValidationService({
    koService,
    ratings: new InMemoryRatingRepo(),
    assignments: new InMemoryAssignmentRepo(),
    settings: new InMemoryValidationSettingsRepo(),
    ...(mitAudit ? { audit } : {}),
  });
  const ko = await koService.create(koInput());
  return { dienst, auditRepo, koService, koId: ko.id, version: ko.version };
}

describe("W3-B/67 · nur die drei Entscheidungen tragen eine Referenz", () => {
  it("rate liefert { auditSeq, auditHash } — und die Referenz loest wirklich auf", async () => {
    const { dienst, auditRepo, koId, version } = await aufbau();
    const ergebnis = await dienst.rate(koId, "bea", "up");
    const ref = ergebnis.validationDecisionRef;
    expect(ref, "rate muss die Referenz zurueckgeben").not.toBeNull();
    if (!ref) {
      throw new Error("keine Referenz");
    }
    // DER EIGENTLICHE BEWEIS: die Referenz zeigt auf einen Eintrag, der die Pruefung besteht.
    const eintrag = await auditRepo.findBySeq(ref.auditSeq);
    expect(deckt(eintrag, ref, koId, version)).toBe(true);
  });

  it("adminValidate liefert eine aufloesbare Referenz", async () => {
    const { dienst, auditRepo, koId, version } = await aufbau();
    const ergebnis = await dienst.adminValidate(koId, "admin");
    const ref = ergebnis.validationDecisionRef;
    if (!ref) {
      throw new Error("keine Referenz");
    }
    const eintrag = await auditRepo.findBySeq(ref.auditSeq);
    expect(deckt(eintrag, ref, koId, version)).toBe(true);
  });

  it("die Einstellung traegt KEINE Referenz — sie ist keine Entscheidung", async () => {
    const { dienst, auditRepo } = await aufbau();
    const wert = await dienst.setDefaultNeededValidations(3, "admin");
    expect(typeof wert).toBe("number");
    // Der Rueckgabewert ist unveraendert eine Zahl — hier entsteht keine Referenz, und der
    // Auditeintrag ist ausdruecklich KEINE Validierungsentscheidung.
    const alle = await auditRepo.all();
    const eintrag = alle.find((e) => e.action === "validation.defaultNeeded.set");
    expect(eintrag).toBeDefined();
    if (eintrag) {
      expect(
        deckt(eintrag, { auditSeq: eintrag.seq, auditHash: eintrag.hash }, "egal", 1),
        "eine Einstellung darf nie als Validierungsentscheidung durchgehen",
      ).toBe(false);
    }
  });

  it("die Zuweisung traegt KEINE Referenz — sie ist keine Entscheidung", async () => {
    const { dienst, auditRepo, koId } = await aufbau();
    await dienst.assign(koId, ["bea"], "admin");
    const alle = await auditRepo.all();
    const eintrag = alle.find((e) => e.action === "ko.assigned");
    expect(eintrag).toBeDefined();
    if (eintrag) {
      expect(
        deckt(eintrag, { auditSeq: eintrag.seq, auditHash: eintrag.hash }, koId, 1),
        "eine Zuweisung darf nie als Validierungsentscheidung durchgehen",
      ).toBe(false);
    }
  });

  it("ohne verdrahteten Audit bleibt die Referenz null — keine Rekonstruktion", async () => {
    const { dienst, koId } = await aufbau(false);
    const ergebnis = await dienst.rate(koId, "bea", "up");
    expect(ergebnis.validationDecisionRef).toBeNull();
    // Der fachliche Rueckgabewert bleibt vollstaendig — die fehlende Referenz macht die Bewertung
    // nicht ungueltig, sie macht sie nur unbelegt.
    expect(typeof ergebnis.trust).toBe("number");
  });

  it("die Entscheidung ist an die BEWERTETE KO-Version gebunden", async () => {
    const { dienst, auditRepo, koId, version } = await aufbau();
    const ergebnis = await dienst.rate(koId, "bea", "up");
    const ref = ergebnis.validationDecisionRef;
    if (!ref) {
      throw new Error("keine Referenz");
    }
    const eintrag = await auditRepo.findBySeq(ref.auditSeq);
    // Eine ANDERE Version wird nicht gedeckt — sonst waere die Bindung an die Fassung wertlos.
    expect(deckt(eintrag, ref, koId, version + 1)).toBe(false);
    // GEGENKONTROLLE: die bewertete Version wird sehr wohl gedeckt.
    expect(deckt(eintrag, ref, koId, version)).toBe(true);
  });
});
