import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

// ================================================================================================
// JOB 3066 · F1 — DER LÖSCHBELEG NENNT SEINEN UMFANG.
// ================================================================================================
//
// `purgeKo` mischt die Rückgabe des transaktionsgebundenen Hakens in die Nutzlast des
// `ko.purged`-Belegs (services/knowledge-object/src/service.ts:3158-3166). Solange die
// Aufräumarbeit im NICHT transaktionsgebundenen `setPurgeCleanup` hängt, kommt von dort nichts
// zurück und der Beleg bezeugt einen Vorgang, dessen Umfang er nicht kennt.
//
// Dieser Test misst die von aussen sichtbare Wirkung der Lieferung: nach einer harten Endlöschung
// steht im Beleg, WIE VIEL sie geschlossen hat. Er läuft über die ECHTE Verdrahtung (buildApp
// bindet die Haken auf services.ko) und damit über denselben Weg wie
// `tests/ko/trash-e2e.test.ts:436-476`.
describe("JOB 3066 · F1: das ko.purged-Audit trägt den Umfang der Aufräumung", () => {
  async function zweiBeitraegeMitBefunden() {
    const services = buildServices();
    // Ohne diesen Schritt liefe die Aufräum-Kaskade nicht — das Wiring lebt in buildApp.
    buildApp(services);
    const a = await services.ko.create({
      title: "KO A",
      statement: "Pumpe entlüften alle 200h.",
      type: "best_practice",
      category: "Wartung",
      author: "anna",
    });
    const b = await services.ko.create({
      title: "KO B",
      statement: "Pumpe alle 200 Stunden entlüften.",
      type: "best_practice",
      category: "Wartung",
      author: "bob",
    });
    return { services, a, b };
  }

  async function offeneUeberschneidung(
    services: Awaited<ReturnType<typeof zweiBeitraegeMitBefunden>>["services"],
    koA: string,
    koB: string,
  ) {
    await services.overlaps.createAuto(
      {
        koA,
        koB,
        relation: "identisch",
        aspects: [{ beschreibung: "gleiche Anweisung", zitatA: "entlüften", zitatB: "entlüften" }],
        eigenanteilA: "",
        eigenanteilB: "",
        recommendation: "zusammenfuehren",
      },
      { trigger: "manual", method: "deterministic", lexicalScore: 0.95 },
      "system",
    );
  }

  async function purgeBeleg(
    services: Awaited<ReturnType<typeof zweiBeitraegeMitBefunden>>["services"],
    koId: string,
  ) {
    const belege = (await services.audit.list({ action: "ko.purged" })).filter(
      (e) => e.target === koId,
    );
    expect(belege).toHaveLength(1); // genau EIN Beleg je Vollzug
    return belege[0]?.payload ?? {};
  }

  it("ein offener Konflikt und eine offene Überschneidung ⇒ der Beleg nennt beide Zahlen", async () => {
    const { services, a, b } = await zweiBeitraegeMitBefunden();
    await offeneUeberschneidung(services, a.id, b.id);
    await services.conflicts.create(
      { koA: a.id, koB: b.id, type: "truth", description: "Widerspruch zur Frist" },
      "anna",
    );
    expect(await services.overlaps.unresolved()).toHaveLength(1);
    expect(await services.conflicts.unresolved()).toHaveLength(1);

    await services.ko.delete(a.id, "admin", { hard: true });

    expect(await purgeBeleg(services, a.id)).toMatchObject({
      reason: "hard",
      ueberschneidungenGeschlossen: 1,
      konflikteGeschlossen: 1,
    });
    // Und die Befunde sind wirklich zu — der Beleg behauptet nichts, was nicht geschah.
    expect(await services.overlaps.unresolved()).toHaveLength(0);
    expect(await services.conflicts.unresolved()).toHaveLength(0);
  });

  // Zustandsmodell §9: „nichts aufzuräumen" ist eine GEMESSENE Aussage (0), kein fehlendes Feld.
  it("keine offenen Befunde ⇒ die Zahlen stehen als 0 im Beleg, nicht als fehlendes Feld", async () => {
    const { services, a } = await zweiBeitraegeMitBefunden();

    await services.ko.delete(a.id, "admin", { hard: true });

    const payload = await purgeBeleg(services, a.id);
    expect(payload.ueberschneidungenGeschlossen).toBe(0);
    expect(payload.konflikteGeschlossen).toBe(0);
  });

  // Auch der automatische Papierkorb-Sweep läuft über denselben Chokepoint (service.ts:3202) —
  // sein Beleg trägt denselben Umfang, sonst hinge die Aussage am Löschweg statt am Vorgang.
  it("der Papierkorb-Sweep erzeugt denselben Beleg mit Umfang", async () => {
    const { services, a, b } = await zweiBeitraegeMitBefunden();
    await offeneUeberschneidung(services, a.id, b.id);
    await services.ko.delete(a.id, "erik"); // in den Papierkorb
    // Frist verstreichen lassen: der Sweep räumt nur wirklich abgelaufene Einträge.
    const abgelaufen = Date.now() + 400 * 86_400_000;
    const echtesJetzt = Date.now;
    Date.now = () => abgelaufen;
    try {
      expect(await services.ko.runTrashSweep("system")).toBe(1);
    } finally {
      Date.now = echtesJetzt;
    }

    expect(await purgeBeleg(services, a.id)).toMatchObject({
      reason: "trash-expired",
      ueberschneidungenGeschlossen: 1,
      konflikteGeschlossen: 0,
    });
  });
});
