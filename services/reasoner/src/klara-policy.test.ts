import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  KLARA_DETERMINISTIC_MODEL,
  KLARA_DETERMINISTIC_PROVIDER,
  KLARA_EXTERNAL_EXECUTION_MIGRATED,
  KLARA_PAYLOAD_CLASS_CANDIDATE_TEXTS,
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
    // NACHGEFÜHRT DURCH JOB 3767. Seit `klara-policy.ts` die zentrale Adminfreigabe fail-closed
    // liest (`zentralFreigegeben === true`), ist ein weggelassenes Feld die Aussage „gesperrt".
    // Diese Datei misst NICHT die Freigabe — sie misst Modusabbildung, Anbieterbindung,
    // Zustimmung und Versionen. Ohne diese Zeile stünde vor jedem ihrer Fälle eine Adminsperre,
    // und sie prüften alle dasselbe statt ihres eigenen Gegenstands. Die Freigabe selbst misst
    // `tests/admin-ki-klara/zentrale-freigabe.test.ts`.
    zentralFreigegeben: true,
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

  it("die Migrationsschranke steht ausdrücklich auf AN", () => {
    // JOB 3079 (05.09.2026): Die vier Sperrgründe aus JOB 3033 (Frist, Empfänger, Nutzlastumfang,
    // Panelvertrag) sind behoben — im Kopf von `klara-policy.ts` einzeln mit ihrer Fundstelle
    // benannt —, und Pedi hat am 05.09. um 12:03 mit „JA" freigegeben (Entscheidung 15). Der
    // Vertrag der Freischaltung steht unverändert in
    // `tests/ka4-freischaltung/ka4-einwilligung-wirkt.test.ts`: die Fälle S1 bis S4 messen BEIDE
    // Zustände dieses Wertes, ein Zurücklegen auf `false` kippt sie geschlossen in den
    // Sperrzustand. Der Schalter bleibt damit eine Bedingung und wird kein Wort.
    expect(KLARA_EXTERNAL_EXECUTION_MIGRATED).toBe(true);
  });

  it("`cloud` MIT verdrahtetem Anbieter, OHNE Zustimmung: external, ehrlich blockiert", () => {
    const r = resolveKlaraPolicy(
      eingabe({ choice: "cloud", cloudConfigured: true, effectiveAnswerProvider: "cloud" }),
    );
    // Der Modus wird NICHT stillschweigend auf deterministic gedreht — die Anzeige sagt die
    // Wahrheit, und der Grund steht daneben (Auftrag §145).
    expect(r.effectiveMode).toBe("external");
    expect(r.executionAllowed).toBe(false);
    // JOB 3079: der Grund heisst jetzt, was er ist. Bis zur Freischaltung verdeckte
    // `external_not_migrated` die fehlende Zustimmung — es war schlicht der frühere Riegel.
    expect(r.blockedReason).toBe("external_consent_missing");
    expect(r.deviation).toBe(true);
    // Solange nicht ausgeführt wird, zeigt die Auflösung den deterministischen Anbieter — angezeigt
    // wird, was rechnet.
    expect(r.provider).toBe(KLARA_DETERMINISTIC_PROVIDER);
  });

  it("MIT erteilter Zustimmung führt der externe Weg AUS — und nennt den Cloud-Anbieter", () => {
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
    // JOB 3079 · das Nutzerversprechen in EINER Zeile: die Zustimmung wirkt.
    expect(r.executionAllowed).toBe(true);
    expect(r.blockedReason).toBeNull();
    // Und „angezeigt wird, was rechnet" heisst jetzt: der Cloud-Anbieter, nicht der Ersatzwert.
    expect(r.provider).not.toBe(KLARA_DETERMINISTIC_PROVIDER);
    expect(r.provider).toBe(eingabe().providerLabel);
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

  // ==============================================================================================
  // JOB 3079 RUNDE 2 (BEN-Korrekturpflicht 3) — WIDERSPRÜCHLICHE POLICY GIBT NICHTS FREI.
  // ==============================================================================================
  //
  // DER BEFUND war exakt reproduzierbar: der Resolver nannte `deviationReason: "policy_incomplete"`
  // UND gab mit `executionAllowed: true` frei. Er BENANNTE den Widerspruch und liess ihn passieren.
  // Bis zur Freischaltung war das folgenlos, weil `external_not_migrated` davorstand — die
  // Freischaltung machte den Fehler wirksam. Genau deshalb steht der Fall hier und nicht in einer
  // Wunschliste.
  //
  // ZWEI WIDERSPRÜCHE, EINE REGEL: externe Ausführung verlangt eine Admin-Wahl, die extern ergibt,
  // UND eine verdrahtete Cloud. Beide Fälle werden mit ERTEILTER Zustimmung gemessen — die
  // Zustimmung des Nutzers darf eine fehlende Admin-Wahl nicht ersetzen.
  it("Admin will NICHT extern, die Bindung zeigt trotzdem auf Cloud ⇒ gesperrt, trotz Zustimmung", () => {
    for (const choice of ["deterministic", "local"] as const) {
      const r = resolveKlaraPolicy(
        eingabe({
          choice,
          cloudConfigured: true,
          localConfigured: true,
          effectiveAnswerProvider: "cloud",
          externalConsentGranted: true,
        }),
      );
      // Der Modus wird NICHT stillschweigend gedreht — die Anzeige sagt weiter die Wahrheit über
      // die Bindung. Aber ausgeführt wird nicht, und der Grund benennt den Widerspruch.
      expect(r.effectiveMode, `choice=${choice}`).toBe("external");
      expect(r.executionAllowed, `choice=${choice}`).toBe(false);
      expect(r.blockedReason, `choice=${choice}`).toBe("policy_incomplete");
      // Und es gibt keinen Empfänger, den eine Zustimmung freischalten würde: hier hilft kein Ja.
      expect(r.externalConsentProvider, `choice=${choice}`).toBeNull();
      expect(r.provider, `choice=${choice}`).toBe(KLARA_DETERMINISTIC_PROVIDER);
    }
  });

  it("effektive Cloud-Bindung OHNE verdrahtete Cloud ⇒ gesperrt, trotz Zustimmung", () => {
    // Dieselbe Konfiguration sagt an zwei Stellen Verschiedenes. Welche recht hat, kann diese reine
    // Funktion nicht wissen — also führt sie nicht aus.
    const r = resolveKlaraPolicy(
      eingabe({
        choice: "cloud",
        cloudConfigured: false,
        effectiveAnswerProvider: "cloud",
        externalConsentGranted: true,
      }),
    );
    expect(r.effectiveMode).toBe("external");
    expect(r.executionAllowed).toBe(false);
    expect(r.blockedReason).toBe("policy_incomplete");
    expect(r.externalConsentProvider).toBeNull();
  });

  it("KALIBRIERUNG: dieselbe Lage MIT Admin-Wahl und verdrahteter Cloud gibt frei", () => {
    // Ohne diese Zeile wären die beiden Fälle darüber auch dann grün, wenn der Resolver GAR NICHTS
    // mehr freigäbe — „gesperrt" muss der Unterschied sein, nicht der Normalzustand.
    const r = resolveKlaraPolicy(
      eingabe({
        choice: "cloud",
        cloudConfigured: true,
        effectiveAnswerProvider: "cloud",
        externalConsentGranted: true,
      }),
    );
    expect(r.executionAllowed).toBe(true);
    expect(r.blockedReason).toBeNull();
  });

  // ==============================================================================================
  // JOB 3079 RUNDE 2 (BEN-Korrekturpflicht 1) — DER EMPFÄNGER STEHT VOR DER ZUSTIMMUNG FEST.
  // ==============================================================================================
  //
  // `provider` beantwortet „was rechnet JETZT" und meldet vor der Zustimmung die deterministischen
  // Ersatzwerte — richtig für die KI-Zeile, falsch für den Zustimmungskasten. BEN hat gemessen, was
  // daraus im echten Panel wurde: „Deine Frage und die Texte der gefundenen Einträge gehen an
  // Klarwerk (deterministisch)." Die Auflösung beantwortet die zweite Frage jetzt selbst.
  it("vor der Zustimmung nennt die Auflösung den Empfänger, den ein JA freischalten würde", () => {
    const ohne = resolveKlaraPolicy(
      eingabe({ choice: "cloud", cloudConfigured: true, effectiveAnswerProvider: "cloud" }),
    );
    // Die alte Frage, unverändert beantwortet: es rechnet nichts extern.
    expect(ohne.executionAllowed).toBe(false);
    expect(ohne.provider).toBe(KLARA_DETERMINISTIC_PROVIDER);
    // Die neue Frage: an WEN ginge es bei einem JA.
    expect(ohne.externalConsentProvider).toBe("Testanbieter");
    expect(ohne.externalConsentModel).toBe("test-modell-1");

    // NACH der Zustimmung stimmen beide überein — sonst nennte das Panel vor und nach dem Klick
    // verschiedene Empfänger.
    const mit = resolveKlaraPolicy(
      eingabe({
        choice: "cloud",
        cloudConfigured: true,
        effectiveAnswerProvider: "cloud",
        externalConsentGranted: true,
      }),
    );
    expect(mit.externalConsentProvider).toBe(mit.provider);
    expect(mit.externalConsentModel).toBe(mit.model);
  });

  it("wo eine Zustimmung nichts bewirken würde, gibt es auch keinen Empfänger", () => {
    // Drei Lagen, in denen ein Zustimmungsknopf eine Falschauskunft wäre. `null` ist hier die
    // Aussage „hier hilft kein Ja" — kein fehlender Wert.
    const internal = resolveKlaraPolicy(
      eingabe({ choice: "local", localConfigured: true, effectiveAnswerProvider: "local" }),
    );
    expect(internal.externalConsentProvider).toBeNull();
    const deterministisch = resolveKlaraPolicy(eingabe());
    expect(deterministisch.externalConsentProvider).toBeNull();
    const widerspruch = resolveKlaraPolicy(
      eingabe({ choice: "deterministic", cloudConfigured: true, effectiveAnswerProvider: "cloud" }),
    );
    expect(widerspruch.externalConsentProvider).toBeNull();
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
  //
  // JOB 3079 R2 (BEN-Korrekturpflicht 1): aus 17 werden 19. Wieder keine Lockerung, wieder ein
  // Loch im Vertrag: die Auflösung konnte nicht ausdrücken, WEM der Mensch zustimmt, bevor er
  // zustimmt. Sie sagte nur, wer GERADE rechnet — und das ist vor der Zustimmung die
  // deterministische Verarbeitung. Das Add-in hat den Empfänger deshalb im Zustimmungssatz falsch
  // genannt, und ableiten durfte es ihn nicht (No-Go 1). Der Fall bleibt eine exakte
  // Mengengleichheit, damit ein 20. Feld weiterhin auffällt.
  it("liefert GENAU die 19 Statusfelder des Vertrags", () => {
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
        "externalConsentModel",
        "externalConsentProvider",
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

  it("die Klassen sind die im Bestand tatsächlich versendeten Nutzlasttypen", () => {
    // KEINE erfundene Erweiterung: der Antwortweg übergibt dem Modell die Frage UND die Kandidaten
    // mit Titel, Aussage, Dokumenttext und Bild-Fußnoten (`services/ask/src/service.ts`, Aufruf
    // `this.reasoner.answer(question, candidates, …)`). Waechst die Menge weiter, faellt dieser
    // Fall auf — als Erinnerung, dass eine neue Klasse eine Zustimmungsentscheidung ist und keine
    // Nebenwirkung.
    //
    // JOB 3079 (05.09.2026): aus einer Klasse werden zwei. Das IST die Zustimmungsentscheidung,
    // die dieser Fall erzwingen sollte — getroffen von Pedi am 05.09. („JA", Entscheidung 15) und
    // gemessen in `tests/ka4-freischaltung/ka4-einwilligung-wirkt.test.ts`, Fall S3: dort wird das
    // vollständige Feld für Feld erhobene Modell-Eingangsdatum gegen genau diese Menge gehalten.
    expect(resolveKlaraPolicy(eingabe()).effectivePayloadClasses).toEqual([
      KLARA_PAYLOAD_CLASS_QUESTION,
      KLARA_PAYLOAD_CLASS_CANDIDATE_TEXTS,
    ]);
  });

  it("die Klassen hängen nicht an Consent oder Blockade — sie sagen, WAS gesendet würde", () => {
    // Sonst wäre die Bindung zirkulär: eine blockierte Auflösung „sendet nichts" und würde jede
    // Zustimmung decken. Was gesendet WÜRDE, ist unabhängig davon, ob gesendet werden DARF.
    const erwartet = [KLARA_PAYLOAD_CLASS_QUESTION, KLARA_PAYLOAD_CLASS_CANDIDATE_TEXTS];
    const blockiert = resolveKlaraPolicy(
      eingabe({ effectiveAnswerProvider: "cloud", cloudConfigured: true, choice: "cloud" }),
    );
    expect(blockiert.executionAllowed).toBe(false);
    expect(blockiert.effectivePayloadClasses).toEqual(erwartet);
    expect(
      resolveKlaraPolicy(eingabe({ externalConsentGranted: true })).effectivePayloadClasses,
    ).toEqual(erwartet);
  });

  it("die Auflösung reicht KEINE gemeinsame Liste heraus, die ein Aufrufer verstellen könnte", () => {
    // JOB 3079: `effectivePayloadClasses` ist seit dieser Runde nicht mehr je Aufruf frisch
    // gebaut, sondern die eine benannte Konstante. Genau deshalb muss hier stehen, dass niemand
    // sie über eine Auflösung verändern kann — sonst wäre die Zustimmungsgrundlage prozessweit
    // beschreibbar. Der Vertrag ist `readonly string[]`; der Fall misst die LAUFZEIT.
    const r = resolveKlaraPolicy(eingabe());
    expect(() => {
      (r.effectivePayloadClasses as string[]).push("full_document");
    }).toThrow();
    expect(r.effectivePayloadClasses).toEqual([
      KLARA_PAYLOAD_CLASS_QUESTION,
      KLARA_PAYLOAD_CLASS_CANDIDATE_TEXTS,
    ]);
  });
});
