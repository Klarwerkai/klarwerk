import { describe, expect, it } from "vitest";
import { buildServices } from "./build-app";

// ================================================================================================
// W3-C1 (Auftrag 76) — DIE ECHTE KOMPOSITION SCHREIBT WIRKLICH
// ================================================================================================
//
// Die Modultests in `services/ask/**` beweisen den Vertrag mit einem injizierten Repo. Sie
// beweisen NICHT, dass die produktive Kompositionswurzel eines injiziert — und genau daran hing
// W3-C bisher: das Repo war gebaut, getestet und migriert, und niemand konstruierte es
// (Prewrite 72 §1). Dieser eine Fall schliesst die Luecke am realen `buildServices()`.
//
// Er ist bewusst der EINZIGE Test unter services/app/** in diesem Auftrag: mehr braucht die
// Zusage nicht, und die Dateigrenze erlaubt genau einen.

describe("W3-C1/76 · buildServices verdrahtet den Answer-Beleg produktiv", () => {
  it("ein echter Antwortlauf ueber die Kompositionswurzel liefert eine Snapshot-Identitaet", async () => {
    const services = buildServices();
    await services.ko.activateSearchProjectionV2();

    const out = await services.ask.ask("Gibt es dazu etwas?", "anna", "de");

    // Der Kern: die Kompositionswurzel hat ein Repo injiziert, also entstand ein Beleg.
    expect(out.answerId, "buildServices muss den Beleg-Schreibweg verdrahten").not.toBeNull();
    expect(typeof out.answerId).toBe("string");
  });

  it("zwei Antwortlaeufe sind zwei Antworten — die Identitaet ist nicht fest verdrahtet", async () => {
    const services = buildServices();
    await services.ko.activateSearchProjectionV2();

    const a = await services.ask.ask("Frage A", "anna", "de");
    const b = await services.ask.ask("Frage B", "anna", "de");
    expect(a.answerId).not.toBeNull();
    expect(b.answerId).not.toBeNull();
    expect(a.answerId).not.toBe(b.answerId);
  });
});
