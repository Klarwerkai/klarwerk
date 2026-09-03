import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  KLARA_DETERMINISTIC_MODEL,
  KLARA_DETERMINISTIC_PROVIDER,
  KLARA_EXTERNAL_EXECUTION_MIGRATED,
  KLARA_PAYLOAD_CLASS_QUESTION,
  KLARA_RESOLUTION_TTL_MS,
  type KlaraPolicyInput,
  klaraConfigurationVersion,
  klaraPolicyVersion,
  resolveKlaraPolicy,
} from "./klara-policy";

// ================================================================================================
// W1 S4 — DER KLARA POLICY RESOLVER (KW-S4-02/03/04)
// ================================================================================================
//
// Was hier geprüft wird, ist die eine Frage, die das Add-in NICHT beantworten darf: was rechnet
// gerade, warum weicht es von der Admin-Vorgabe ab, und darf überhaupt ausgeführt werden.

const JETZT = Date.parse("2026-08-02T09:00:00.000Z");

function eingabe(over: Partial<KlaraPolicyInput> = {}): KlaraPolicyInput {
  return {
    choice: "auto",
    source: "default",
    effectiveAnswerProvider: "deterministic",
    cloudConfigured: false,
    localConfigured: false,
    providerLabel: "Testanbieter",
    modelLabel: "test-modell-1",
    localProviderLabel: "Lokaler Testanbieter",
    externalConsentGranted: false,
    now: JETZT,
    resolutionId: "res-1",
    ...over,
  };
}

describe("W1 S4 · der Resolver bildet die Admin-Wahl auf die drei kanonischen Modi ab", () => {
  it("`deterministic` bleibt deterministisch — und trägt trotzdem Anbieter und Modell", () => {
    const r = resolveKlaraPolicy(
      eingabe({ choice: "deterministic", effectiveAnswerProvider: "deterministic" }),
    );
    expect(r.adminConfiguredMode).toBe("deterministic");
    expect(r.effectiveMode).toBe("deterministic");
    expect(r.deviation).toBe(false);
    expect(r.deviationReason).toBeNull();
    // KW-S4-04 §49-50: kein clientseitig zu erratendes `undefined`.
    expect(r.provider).toBe(KLARA_DETERMINISTIC_PROVIDER);
    expect(r.model).toBe(KLARA_DETERMINISTIC_MODEL);
    expect(r.executionAllowed).toBe(true);
  });

  it("`cloud` ohne verdrahteten Anbieter fällt auf deterministic — mit benanntem Grund", () => {
    const r = resolveKlaraPolicy(
      eingabe({
        choice: "cloud",
        cloudConfigured: false,
        effectiveAnswerProvider: "deterministic",
      }),
    );
    expect(r.adminConfiguredMode).toBe("external");
    expect(r.effectiveMode).toBe("deterministic");
    expect(r.deviation).toBe(true);
    expect(r.deviationReason).toBe("external_not_configured");
    // Fail-safe: nie still external (Auftrag §156).
    expect(r.effectiveMode).not.toBe("external");
  });

  it("`local` ohne verdrahtetes lokales Modell fällt auf deterministic", () => {
    const r = resolveKlaraPolicy(
      eingabe({
        choice: "local",
        localConfigured: false,
        effectiveAnswerProvider: "deterministic",
      }),
    );
    expect(r.adminConfiguredMode).toBe("internal");
    expect(r.effectiveMode).toBe("deterministic");
    expect(r.deviationReason).toBe("internal_not_configured");
  });

  it("`local` MIT verdrahtetem Modell bleibt internal und darf ausführen", () => {
    const r = resolveKlaraPolicy(
      eingabe({ choice: "local", localConfigured: true, effectiveAnswerProvider: "local" }),
    );
    expect(r.effectiveMode).toBe("internal");
    expect(r.executionAllowed).toBe(true);
    expect(r.externalConsentRequired).toBe(false);
    // BEN ROT-1: `internal` meldet den LOKALEN Anbieter. Bis R1 stand hier das Cloud-Label —
    // die Zusicherung hat den Fehler festgeschrieben, statt ihn zu fangen.
    expect(r.provider).toBe("Lokaler Testanbieter");
    expect(r.model).toBe("Lokaler Testanbieter");
    expect(r.provider).not.toBe("Testanbieter");
  });

  it("`auto` ohne jede Verdrahtung endet deterministisch — nie extern", () => {
    const r = resolveKlaraPolicy(
      eingabe({ choice: "auto", effectiveAnswerProvider: "deterministic" }),
    );
    expect(r.effectiveMode).toBe("deterministic");
    expect(r.effectiveMode).not.toBe("external");
  });
});

describe("W1 S4 / JOB 3033 · der externe Weg hängt an EINER benannten Entscheidung", () => {
  // ==============================================================================================
  // DER PIN IST AB JETZT EIN STRUKTURPIN, KEIN WERTPIN — und das ist die Verschärfung, nicht die
  // Aufweichung.
  // ==============================================================================================
  //
  // Hier stand `expect(KLARA_EXTERNAL_EXECUTION_MIGRATED).toBe(false)` — und der Wertpin bleibt
  // unten stehen, weil der Wert HEUTE eine Aussage ist. Daneben tritt ab JOB 3033 (03.09.2026) ein
  // STRUKTURPIN, und der ist die eigentliche Verschärfung: der Wertpin allein hätte auch eine
  // Bauform durchgelassen, in der die Sperre an fünf verstreuten Stellen hängt.
  //
  // WAS DIE BAUFORM LEISTEN MUSS: genau eine benannte Konstante, genau eine Stelle, die sie liest,
  // keine Umgebungsvariable und kein vom Client gesetzter Wert. Nur so ist die Freischaltung EINE
  // Entscheidung an EINER Stelle — und nur so können die vier Sperrgründe aus JOB 3033
  // (`tests/ka4-freischaltung/ka4-einwilligung-wirkt.test.ts`) an genau diesen einen Wert gebunden
  // werden. Wer die Bedingung streut, eine zweite Fassung anlegt oder sie über `process.env`
  // steuerbar macht, wird hier rot.
  const QUELLE = readFileSync(
    resolve(process.cwd(), "services/reasoner/src/klara-policy.ts"),
    "utf8",
  );

  it("GENAU EINE benannte Konstante an GENAU EINER Stelle — kein verstreutes `if`, kein Client-Bool", () => {
    // (1) Eine einzige Deklaration.
    expect(QUELLE.match(/export const KLARA_EXTERNAL_EXECUTION_MIGRATED\s*=/g) ?? []).toHaveLength(
      1,
    );
    // (2) Eine einzige lesende Stelle (die Deklaration mitgezählt: zwei Vorkommen im Code).
    const vorkommenImCode = QUELLE.split("\n")
      .filter((z) => !z.trimStart().startsWith("*") && !z.trimStart().startsWith("//"))
      .join("\n")
      .match(/KLARA_EXTERNAL_EXECUTION_MIGRATED/g);
    expect(vorkommenImCode ?? []).toHaveLength(2);
    expect(QUELLE).toContain("if (!KLARA_EXTERNAL_EXECUTION_MIGRATED)");
    // (3) Kein zweiter Schalter: keine Umgebungsvariable, kein Argument, kein Eingabefeld.
    expect(QUELLE).not.toMatch(/process\.env/);
    expect(QUELLE).not.toMatch(/externalExecutionMigrated|allowExternal|migrated\s*[?:]/i);
    // (4) Und der Resolver bleibt rein: die Entscheidung fällt hier, nicht im HTTP-Layer.
    expect(QUELLE).not.toMatch(/\bfetch\(|require\(/);
  });

  it("die Migrationsschranke steht ausdrücklich auf AUS", () => {
    // JOB 3033 (03.09.2026): Die OWNERENTSCHEIDUNG, freizuschalten, ist gefallen — die
    // FREISCHALTUNG nicht. Runde 1 hat den Wert umgelegt und dabei vier Stellen freigelegt, an
    // denen der Bestand etwas anderes tut oder sagt, als die Einwilligung verspricht (Frist,
    // Empfänger, Nutzlastumfang, Panelvertrag; im Kopf von `klara-policy.ts` einzeln benannt).
    // Der Wert steht deshalb weiter auf `false`, und die vier Sperrgründe sind in
    // `tests/ka4-freischaltung/ka4-einwilligung-wirkt.test.ts` an genau diesen Wert gebunden:
    // sie werden rot, sobald jemand ihn umlegt, ohne sie zu beheben.
    expect(KLARA_EXTERNAL_EXECUTION_MIGRATED).toBe(false);
  });

  it("`cloud` MIT verdrahtetem Anbieter bleibt external, wird aber ehrlich blockiert", () => {
    const r = resolveKlaraPolicy(
      eingabe({ choice: "cloud", cloudConfigured: true, effectiveAnswerProvider: "cloud" }),
    );
    // Der Modus wird NICHT stillschweigend auf deterministic gedreht — die Anzeige sagt die
    // Wahrheit, und der Grund steht daneben (Auftrag §145).
    expect(r.effectiveMode).toBe("external");
    expect(r.executionAllowed).toBe(false);
    expect(r.blockedReason).toBe("external_not_migrated");
    expect(r.deviation).toBe(true);
    // Solange nicht ausgeführt wird, zeigt die Auflösung den deterministischen Anbieter — angezeigt
    // wird, was rechnet.
    expect(r.provider).toBe(KLARA_DETERMINISTIC_PROVIDER);
  });

  it("auch MIT erteilter Zustimmung bleibt der externe Weg blockiert", () => {
    const r = resolveKlaraPolicy(
      eingabe({
        choice: "cloud",
        cloudConfigured: true,
        effectiveAnswerProvider: "cloud",
        externalConsentGranted: true,
      }),
    );
    expect(r.externalConsentRequired).toBe(true);
    expect(r.externalConsentGranted).toBe(true);
    // Zustimmung allein erzeugt keinen Egress — die Migration fehlt weiterhin.
    expect(r.executionAllowed).toBe(false);
    expect(r.blockedReason).toBe("external_not_migrated");
  });

  it("ohne benennbaren Anbieter bleibt es deterministisch — die Konstante ändert daran nichts", () => {
    // JOB 3033: die Bedingung, die UNABHÄNGIG von der Konstante gilt und nach einer Freischaltung
    // die wichtigste bleibt — die Konstante darf keine Bindung erfinden, die es nicht gibt.
    const r = resolveKlaraPolicy(
      eingabe({
        choice: "cloud",
        cloudConfigured: true,
        effectiveAnswerProvider: "cloud",
        externalConsentGranted: true,
        providerLabel: "",
      }),
    );
    expect(r.effectiveMode).toBe("deterministic");
    expect(r.deviationReason).toBe("policy_incomplete");
    expect(r.provider).toBe(KLARA_DETERMINISTIC_PROVIDER);
  });

  it("Admin-Auswahl allein erzeugt nie eine Cloud-Freigabe (KW-S4-04 §212)", () => {
    for (const choice of ["auto", "model", "cloud"] as const) {
      const r = resolveKlaraPolicy(
        eingabe({ choice, cloudConfigured: true, effectiveAnswerProvider: "cloud" }),
      );
      expect(r.executionAllowed, `choice=${choice}`).toBe(false);
    }
  });
});

describe("W1 S4 · der Vertrag ist vollständig und stabil", () => {
  // FORTGESCHRIEBEN NACH BEN-35 BEFUND 1: aus 16 werden 17 Felder. Die Erweiterung ist KEINE
  // Lockerung des Vertrags — sie ist der Vertrag: BEN hat belegt, dass die Auflösung die
  // Nutzlastklassen, an die eine Zustimmung gebunden werden soll, gar nicht ausdrücken konnte.
  // Der Fall bleibt eine exakte Mengengleichheit, damit ein 18. Feld weiterhin auffällt.
  it("liefert GENAU die 17 Statusfelder des Vertrags", () => {
    const r = resolveKlaraPolicy(eingabe());
    expect(Object.keys(r).sort()).toEqual(
      [
        "adminConfiguredMode",
        "blockedReason",
        "configurationVersion",
        "deviation",
        "deviationReason",
        "effectiveMode",
        "effectivePayloadClasses",
        "executionAllowed",
        "expiresAt",
        "externalConsentGranted",
        "externalConsentRequired",
        "mode",
        "model",
        "policyVersion",
        "provider",
        "resolutionId",
        "resolvedAt",
      ].sort(),
    );
  });

  it("`mode` und `effectiveMode` können nicht auseinanderlaufen", () => {
    for (const choice of ["auto", "model", "cloud", "local", "deterministic"] as const) {
      const r = resolveKlaraPolicy(
        eingabe({
          choice,
          cloudConfigured: true,
          localConfigured: true,
          effectiveAnswerProvider: "cloud",
        }),
      );
      expect(r.mode, `choice=${choice}`).toBe(r.effectiveMode);
    }
  });

  it("die Auflösung ist kurzlebig und trägt ihren Ablauf mit", () => {
    const r = resolveKlaraPolicy(eingabe());
    expect(Date.parse(r.expiresAt) - Date.parse(r.resolvedAt)).toBe(KLARA_RESOLUTION_TTL_MS);
  });

  it("jede Auflösung trägt eine resolutionId — Status ohne sie gibt es nicht", () => {
    expect(resolveKlaraPolicy(eingabe()).resolutionId).toBe("res-1");
  });
});

describe("W1 S4 · die Versionen sind abgeleitet, nicht erfunden", () => {
  it("dieselbe Konfiguration ergibt dieselben Versionen — stabil über Neustarts", () => {
    const a = resolveKlaraPolicy(eingabe());
    const b = resolveKlaraPolicy(eingabe({ now: JETZT + 60_000, resolutionId: "res-2" }));
    expect(b.policyVersion).toBe(a.policyVersion);
    expect(b.configurationVersion).toBe(a.configurationVersion);
  });

  it("eine geänderte Admin-Wahl ändert die policyVersion", () => {
    expect(klaraPolicyVersion({ choice: "cloud", source: "db" })).not.toBe(
      klaraPolicyVersion({ choice: "deterministic", source: "db" }),
    );
  });

  it("eine geänderte Verdrahtung ändert die configurationVersion", () => {
    const basis = {
      effectiveAnswerProvider: "deterministic" as const,
      cloudConfigured: false,
      localConfigured: false,
      providerLabel: "A",
      modelLabel: "m",
    };
    expect(klaraConfigurationVersion(basis)).not.toBe(
      klaraConfigurationVersion({ ...basis, providerLabel: "B" }),
    );
    expect(klaraConfigurationVersion(basis)).not.toBe(
      klaraConfigurationVersion({ ...basis, cloudConfigured: true }),
    );
  });

  it("die Versionen tragen kein Secret — nur Labels und Schalter", () => {
    const r = resolveKlaraPolicy(
      eingabe({
        providerLabel: "OpenAI",
        modelLabel: "gpt-x",
        effectiveAnswerProvider: "cloud",
        cloudConfigured: true,
      }),
    );
    for (const feld of [r.policyVersion, r.configurationVersion]) {
      expect(feld).not.toMatch(/sk-|secret|token|key=/i);
    }
  });
});

// ================================================================================================
// BEN-35 BEFUND 1 — DIE AUFLOESUNG MUSS IHRE EFFEKTIVEN PAYLOAD-KLASSEN SELBST NENNEN
// ================================================================================================
//
// BEN hat belegt, dass `KlaraResolution` das Feld gar nicht besass und die Deckungspruefung
// stattdessen gegen eine hart codierte Klasse verglich. Damit war die Nutzlastsemantik, die eine
// Zustimmung binden soll, in der tatsaechlich verwendeten Auflösung NICHT ausdrueckbar.
//
// Der Fall prueft hier die Quelle, nicht den Vergleich: was die Auflösung sagt, muss aus der
// Auflösung kommen — und es muss fuer jeden Modus eine benannte, nichtleere Antwort geben. Eine
// leere Menge waere die stille Variante desselben Fehlers: sie wuerde jede Bindung trivial decken.
describe("W1 S4 · BEN-35/1: die Auflösung nennt ihre effektiven Payload-Klassen", () => {
  it("jede Auflösung trägt eine benannte, nichtleere Klassenmenge", () => {
    for (const binding of ["deterministic", "local", "cloud"] as const) {
      const r = resolveKlaraPolicy(
        eingabe({ effectiveAnswerProvider: binding, cloudConfigured: true, localConfigured: true }),
      );
      expect(r.effectivePayloadClasses, binding).toBeDefined();
      expect(r.effectivePayloadClasses.length, binding).toBeGreaterThan(0);
      expect(
        r.effectivePayloadClasses.every((k) => typeof k === "string" && k.trim().length > 0),
        binding,
      ).toBe(true);
    }
  });

  it("die Klassen sind der im Bestand einzige tatsächlich versendete Nutzlasttyp", () => {
    // KEINE erfundene Erweiterung: der Server schreibt heute genau eine Klasse, und die Auflösung
    // benennt exakt diese. Waechst die Menge spaeter, faellt dieser Fall auf — als Erinnerung,
    // dass eine neue Klasse eine Zustimmungsentscheidung ist und keine Nebenwirkung.
    expect(resolveKlaraPolicy(eingabe()).effectivePayloadClasses).toEqual([
      KLARA_PAYLOAD_CLASS_QUESTION,
    ]);
  });

  it("die Klassen hängen nicht an Consent oder Blockade — sie sagen, WAS gesendet würde", () => {
    // Sonst wäre die Bindung zirkulär: eine blockierte Auflösung „sendet nichts" und würde jede
    // Zustimmung decken. Was gesendet WÜRDE, ist unabhängig davon, ob gesendet werden DARF.
    const blockiert = resolveKlaraPolicy(
      eingabe({ effectiveAnswerProvider: "cloud", cloudConfigured: true, choice: "cloud" }),
    );
    expect(blockiert.executionAllowed).toBe(false);
    expect(blockiert.effectivePayloadClasses).toEqual([KLARA_PAYLOAD_CLASS_QUESTION]);
    expect(
      resolveKlaraPolicy(eingabe({ externalConsentGranted: true })).effectivePayloadClasses,
    ).toEqual([KLARA_PAYLOAD_CLASS_QUESTION]);
  });
});
