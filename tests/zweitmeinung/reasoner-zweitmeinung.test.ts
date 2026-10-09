// ================================================================================================
// AUFNAHME 20260922 (R-0305, R-1099) · DIESELBE FRAGE, ZWEI MODELLE — AM REASONER GEMESSEN.
// ================================================================================================
//
// R-0305: „Zu einer Antwort kann eine zweite, unabhängige Einschätzung eingeholt werden, damit man
// sich nicht auf einen einzigen Weg verlässt." R-1099: „… dieselbe Frage von zwei Modellen
// beantworten und die beiden Antworten gegenüberstellen. Weichen sie voneinander ab, ist das ein
// Warnzeichen, dem jemand nachgehen muss."
//
// Gemessen wird `Reasoner.answerMitZweitmeinung` mit zwei Attrappen-Modellen, die ihre Aufrufe
// zählen: ein externer Anbieter (openai) und das lokale Modell. Die Attrappen antworten mit festem
// Text, damit der Abgleich steuerbar ist — der echte `ModelProvider` ersetzt nicht gedeckte Zahlen
// durch den Quellenwortlaut, und dann gäbe es nichts zu vergleichen.
//
//   Z1 · zwei Modelle, verschiedene Zahlen ⇒ verglichen, abweichend, Stufen cloud/local, beide gefragt
//   Z2 · zwei Modelle, dieselbe Aussage ⇒ verglichen, keine Abweichung
//   Z3 · nichts gewählt ⇒ kein zweiter Empfänger, nur EIN Modellaufruf
//   Z4 · externes Zweitmodell ohne Adminfreigabe ⇒ nicht freigegeben, der Anbieter wird NIE gefragt
//   Z5 · erstes und zweites Modell sind dasselbe ⇒ nicht unabhängig, kein zweiter Lauf
//   Z6 · das zweite Modell scheitert ⇒ fehlgeschlagen, die erste Antwort bleibt
//   Z7 · beide Läufe stehen im Laufprotokoll
//   Z8 · die Wahl: weglassen = unverändert, `null` = aus, Unbekanntes = Fehler, Neustart überlebt
import { describe, expect, it } from "vitest";
import { InMemoryModelRunRepo } from "../../services/model-runs";
import { InMemoryReasonerPolicyRepo, type KnowledgeRef, Reasoner } from "../../services/reasoner";
import { mitKiFreigabe } from "../../services/reasoner/src/testhelfer-ki-freigabe";
import { attrappe } from "./attrappe";

const FRAGE = "Bei welchem Druck wird Ventil X geschlossen?";
const KONTEXT: KnowledgeRef[] = [
  {
    id: "ko-ventil",
    title: "Ventil X bei Überdruck schließen",
    statement: "Ventil X wird bei Überdruck geschlossen.",
    status: "validiert",
    trust: 90,
  },
];

function aufbau(openaiText: string | Error, lokalText: string | Error) {
  const openai = attrappe("cloud:openai:attrappe", openaiText);
  const lokal = attrappe("local:attrappe", lokalText);
  const runs = new InMemoryModelRunRepo();
  const policy = new InMemoryReasonerPolicyRepo();
  const reasoner = new Reasoner(undefined, undefined, runs, undefined, lokal.provider, policy, {
    anbieter: { openai: openai.provider },
  });
  return { reasoner, openai, lokal, runs, policy };
}

describe("R-0305/R-1099 · Reasoner.answerMitZweitmeinung", () => {
  it("Z1 · verschiedene Zahlen: verglichen, abweichend — beide Modelle wurden gefragt", async () => {
    const { reasoner, openai, lokal } = aufbau(
      "Ventil X wird ab 5 bar geschlossen [1].",
      "Ventil X wird ab 7 bar geschlossen [1].",
    );
    await reasoner.setTaskConfig(
      mitKiFreigabe({ global: "openai", perTask: {}, zweitmeinung: "local" }),
    );
    const { erste, zweitmeinung } = await reasoner.answerMitZweitmeinung(FRAGE, KONTEXT, "de");
    expect(erste.answer).toBe("Ventil X wird ab 5 bar geschlossen [1].");
    expect(erste.aiGenerated).toBeDefined();
    expect(zweitmeinung.status).toBe("verglichen");
    if (zweitmeinung.status !== "verglichen") {
      return;
    }
    expect(zweitmeinung.ersteStufe).toBe("cloud");
    expect(zweitmeinung.zweiteStufe).toBe("local");
    expect(zweitmeinung.zweite.answer).toBe("Ventil X wird ab 7 bar geschlossen [1].");
    expect(zweitmeinung.zweite.citedSources).toEqual(["ko-ventil"]);
    expect(zweitmeinung.abweichend).toBe(true);
    expect(zweitmeinung.abweichungen).toEqual(["zahlen"]);
    expect(openai.rufe()).toBe(1);
    expect(lokal.rufe()).toBe(1);
  });

  it("Z2 · dieselbe Aussage aus derselben Quelle: verglichen, keine Abweichung", async () => {
    const { reasoner } = aufbau(
      "Ab 5 bar wird Ventil X geschlossen [1].",
      "Ventil X schließt man bei 5 bar [1].",
    );
    await reasoner.setTaskConfig(
      mitKiFreigabe({ global: "openai", perTask: {}, zweitmeinung: "local" }),
    );
    const { zweitmeinung } = await reasoner.answerMitZweitmeinung(FRAGE, KONTEXT, "de");
    expect(zweitmeinung).toMatchObject({
      status: "verglichen",
      abweichend: false,
      abweichungen: [],
    });
  });

  it("Z3 · ohne gewähltes Zweitmodell gibt es keinen zweiten Empfänger", async () => {
    const { reasoner, openai, lokal } = aufbau("A [1].", "B [1].");
    await reasoner.setTaskConfig(mitKiFreigabe({ global: "openai", perTask: {} }));
    const { erste, zweitmeinung } = await reasoner.answerMitZweitmeinung(FRAGE, KONTEXT, "de");
    expect(erste.answer).toBe("A [1].");
    expect(zweitmeinung).toEqual({ status: "nicht_moeglich", grund: "nicht_eingerichtet" });
    expect(openai.rufe()).toBe(1);
    expect(lokal.rufe()).toBe(0);
  });

  it("Z4 · externes Zweitmodell ohne Adminfreigabe: der Anbieter wird nie gefragt", async () => {
    const { reasoner, openai, lokal } = aufbau("A [1].", "B [1].");
    // Zuordnung lokal, Zweitmeinung extern — aber KEINE Freigabe für öffentliche KI.
    await reasoner.setTaskConfig({ global: "local", perTask: {}, zweitmeinung: "openai" });
    const { erste, zweitmeinung } = await reasoner.answerMitZweitmeinung(FRAGE, KONTEXT, "de");
    expect(erste.answer).toBe("B [1].");
    expect(zweitmeinung).toEqual({ status: "nicht_moeglich", grund: "nicht_freigegeben" });
    expect(openai.rufe()).toBe(0);
    expect(lokal.rufe()).toBe(1);
  });

  it("Z5 · hat schon das Zweitmodell geantwortet, ist eine Wiederholung keine Zweitmeinung", async () => {
    const { reasoner, lokal } = aufbau("A [1].", "B [1].");
    await reasoner.setTaskConfig({ global: "local", perTask: {}, zweitmeinung: "local" });
    const { zweitmeinung } = await reasoner.answerMitZweitmeinung(FRAGE, KONTEXT, "de");
    expect(zweitmeinung).toEqual({ status: "nicht_moeglich", grund: "nicht_unabhaengig" });
    expect(lokal.rufe()).toBe(1);
  });

  it("Z6 · scheitert das zweite Modell, bleibt die erste Antwort und der Grund wird genannt", async () => {
    const { reasoner, lokal } = aufbau("A [1].", new Error("lokales Modell nicht erreichbar"));
    await reasoner.setTaskConfig(
      mitKiFreigabe({ global: "openai", perTask: {}, zweitmeinung: "local" }),
    );
    const { erste, zweitmeinung } = await reasoner.answerMitZweitmeinung(FRAGE, KONTEXT, "de");
    expect(erste.answer).toBe("A [1].");
    expect(zweitmeinung).toEqual({ status: "nicht_moeglich", grund: "fehlgeschlagen" });
    // Kein Ausweichen auf den deterministischen Ersatz: er ist kein zweites Modell.
    expect(lokal.rufe()).toBe(1);
  });

  it("Z7 · beide Läufe stehen als Antwortlauf im Laufprotokoll", async () => {
    const { reasoner, runs } = aufbau("A 5 [1].", "B 7 [1].");
    await reasoner.setTaskConfig(
      mitKiFreigabe({ global: "openai", perTask: {}, zweitmeinung: "local" }),
    );
    await reasoner.answerMitZweitmeinung(FRAGE, KONTEXT, "de", false, { actor: "pedi" });
    const laeufe = (await runs.recent()).filter((lauf) => lauf.task === "answer");
    expect(laeufe.map((lauf) => lauf.provider).sort()).toEqual([
      "cloud:openai:attrappe",
      "local:attrappe",
    ]);
    expect(laeufe.every((lauf) => lauf.status === "success")).toBe(true);
  });

  it("Z9 · Ben (Nacharbeit 2): lokale Erstantwort + externes Zweitmodell kann kosten", async () => {
    const { reasoner } = aufbau("A [1].", "B [1].");
    // Ohne gewähltes Zweitmodell: nur der Antwortweg zählt, und der ist lokal.
    await reasoner.setTaskConfig(mitKiFreigabe({ global: "local", perTask: {} }));
    expect(reasoner.publicStatus().billable.answer).toBe(false);
    expect(reasoner.publicStatus().zweitmeinungBillable).toBe(false);
    // Externes Zweitmodell, freigegeben: der Antwortweg bleibt kostenlos, der Klick nicht.
    await reasoner.setTaskConfig(
      mitKiFreigabe({ global: "local", perTask: {}, zweitmeinung: "openai" }),
    );
    expect(reasoner.publicStatus().billable.answer).toBe(false);
    expect(reasoner.publicStatus().zweitmeinungBillable).toBe(true);
    // Lokales Zweitmodell kostet nichts.
    await reasoner.setTaskConfig({ global: "local", perTask: {}, zweitmeinung: "local" });
    expect(reasoner.publicStatus().zweitmeinungBillable).toBe(false);
  });

  it("Z10 · ohne Adminfreigabe geht nichts hinaus — also auch keine Kostenbehauptung", async () => {
    const { reasoner } = aufbau("A [1].", "B [1].");
    await reasoner.setTaskConfig({ global: "local", perTask: {}, zweitmeinung: "openai" });
    expect(reasoner.getTaskConfig().kiFreigabe).toBeUndefined();
    expect(reasoner.publicStatus().zweitmeinungBillable).toBe(false);
  });

  it("Z11 · Ben (Nacharbeit 17): die KI-Marke nur bei Modellherkunft — für beide Seiten", async () => {
    // A meldet sich wie der deterministische Rückfall (`demo: true`), B ist ein Modell.
    const openai = attrappe("cloud:openai:attrappe", "Ab 5 bar schließen [1].", true);
    const lokal = attrappe("local:attrappe", "Bei 5 bar schließen [1].");
    const reasoner = new Reasoner(
      undefined,
      undefined,
      undefined,
      undefined,
      lokal.provider,
      undefined,
      { anbieter: { openai: openai.provider } },
    );
    await reasoner.setTaskConfig(
      mitKiFreigabe({ global: "openai", perTask: {}, zweitmeinung: "local" }),
    );
    const { erste, zweitmeinung } = await reasoner.answerMitZweitmeinung(FRAGE, KONTEXT, "de");
    // Dieselbe Regel wie `answer` (R-0604): keine Marke am deterministischen Ergebnis.
    expect(erste.aiGenerated).toBeUndefined();
    expect(zweitmeinung.status).toBe("verglichen");
    if (zweitmeinung.status !== "verglichen") {
      return;
    }
    // Die verglichene Antwort A wird mitgeliefert — mit derselben Herkunft wie die Antwort selbst.
    expect(zweitmeinung.erste.answer).toBe(erste.answer);
    expect(zweitmeinung.erste.demo).toBe(true);
    expect(zweitmeinung.erste.aiGenerated).toBeUndefined();
    expect(zweitmeinung.zweite.aiGenerated).toMatchObject({
      aiGenerated: true,
      task: "answer",
      mode: "model",
    });
  });

  it("Z8 · die Wahl: weglassen = unverändert, null = aus, Unbekanntes = Fehler, Neustart überlebt", async () => {
    const { reasoner, policy } = aufbau("A [1].", "B [1].");
    await reasoner.setTaskConfig({ global: "auto", perTask: {}, zweitmeinung: "local" });
    expect(reasoner.getTaskConfig().zweitmeinung).toBe("local");
    // Ein Speichern der Zuordnung, das von der Zweitmeinung nichts weiß, lässt sie stehen.
    await reasoner.setTaskConfig({ global: "openai", perTask: {} });
    expect(reasoner.getTaskConfig().zweitmeinung).toBe("local");
    // Neustart: die gespeicherte Wahl wird wieder geladen.
    const neu = new Reasoner(undefined, undefined, undefined, undefined, undefined, policy);
    await neu.loadPersistedPolicy();
    expect(neu.getTaskConfig().zweitmeinung).toBe("local");
    // Ausschalten.
    await reasoner.setTaskConfig({ global: "openai", perTask: {}, zweitmeinung: null });
    expect(reasoner.getTaskConfig().zweitmeinung).toBeUndefined();
    // Ein unbekannter Wert wird abgewiesen und ändert nichts.
    await expect(
      reasoner.setTaskConfig({
        global: "openai",
        perTask: {},
        zweitmeinung: "deterministic" as unknown as "local",
      }),
    ).rejects.toThrow("Zweitmeinung");
    expect(reasoner.getTaskConfig().zweitmeinung).toBeUndefined();
  });
});
