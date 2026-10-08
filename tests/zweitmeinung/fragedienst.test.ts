// ================================================================================================
// AUFNAHME 20260922 (R-0305, R-1099) · DIE ZWEITMEINUNG AM FRAGEDIENST — DIESELBE GRUNDLAGE.
// ================================================================================================
//
// Die echte Kette KoService → AskService → Reasoner; nur die beiden Modelle sind Attrappen.
//
//   F1 · beide Modelle bekommen GENAU dieselben Kandidaten; die erste Antwort ist die Antwort der
//        Frage wie sonst, die zweite steht daneben; die Abweichung ist ein Warnzeichen im Ergebnis
//        und im Prüfprotokoll (ohne Frage- und Antworttext, ohne Anbieter- oder Modellnamen)
//   F2 · der Weg des Add-ins (`retrievalOnly`) bleibt unberührt — kein Modell, kein Feld
//   F3 · ohne Anforderung fragt der Dienst nur das eine Modell und trägt kein Feld
import { describe, expect, it } from "vitest";
import { InMemoryGapRepo } from "../../services/ask/src/repo";
import { AskService } from "../../services/ask/src/service";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import { Reasoner } from "../../services/reasoner";
import { mitKiFreigabe } from "../../services/reasoner/src/testhelfer-ki-freigabe";
import { attrappe } from "./attrappe";

const FRAGE = "Bei welchem Druck wird das Ventil Kranichsee geschlossen?";

async function aufbau() {
  const koService = new KoService({ repo: new InMemoryKoRepo() });
  await koService.activateSearchProjectionV2();
  // R-0473: jeder Fragebegriff muss in der Quelle stehen — sonst wird sie gar nicht Kandidat.
  const ventil = await koService.create({
    title: "Ventil Kranichsee: Druck beim Schließen",
    statement: "Das Ventil Kranichsee wird bei hohem Druck geschlossen.",
    type: "best_practice",
    category: "Anlage 1",
    author: "anna",
  });
  await koService.setValidationState(ventil.id, { trust: 90, status: "validiert" });
  const openai = attrappe("cloud:openai:attrappe", "Ab 5 bar schließen [1].");
  const lokal = attrappe("local:attrappe", "Ab 7 bar schließen [1].");
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
  const audit = new AuditService({ repo: new InMemoryAuditRepo() });
  const ask = new AskService({ reasoner, koService, gaps: new InMemoryGapRepo(), audit });
  return { ask, audit, openai, lokal, ventil };
}

describe("R-0305/R-1099 · AskService mit Zweitmeinung", () => {
  it("F1 · dieselben Kandidaten, zwei Antworten, Warnzeichen in Ergebnis und Protokoll", async () => {
    const { ask, audit, openai, lokal, ventil } = await aufbau();
    const aus = await ask.ask(FRAGE, "pedi", "de", { zweitmeinung: true });

    expect(openai.kandidaten()).toEqual([[ventil.id]]);
    expect(lokal.kandidaten()).toEqual(openai.kandidaten());
    expect(aus.result.answer).toBe("Ab 5 bar schließen [1].");
    expect(aus.result.citedSources).toEqual([ventil.id]);
    expect(aus.zweitmeinung).toMatchObject({
      status: "verglichen",
      ersteStufe: "cloud",
      zweiteStufe: "local",
      abweichend: true,
      abweichungen: ["zahlen"],
      zweite: { answered: true, answer: "Ab 7 bar schließen [1].", citedSources: [ventil.id] },
    });

    const eintraege = await audit.list({ action: "ask.zweitmeinung" });
    expect(eintraege).toHaveLength(1);
    expect(eintraege[0]?.target).toBe(ventil.id);
    expect(eintraege[0]?.payload).toEqual({
      status: "verglichen",
      abweichend: true,
      abweichungen: "zahlen",
      ersteStufe: "cloud",
      zweiteStufe: "local",
    });
    const roh = JSON.stringify(eintraege[0]);
    for (const verboten of ["Kranichsee", "bar", "attrappe", "openai"]) {
      expect(roh, `„${verboten}" steht im Prüfprotokoll`).not.toContain(verboten);
    }
  });

  it("F2 · der Weg des Add-ins bleibt ohne Modell und ohne Feld", async () => {
    const { ask, openai, lokal } = await aufbau();
    const aus = await ask.ask(FRAGE, "pedi", "de", {
      validatedOnly: true,
      retrievalOnly: true,
      zweitmeinung: true,
    });
    expect(Object.keys(aus)).not.toContain("zweitmeinung");
    expect(openai.rufe()).toBe(0);
    expect(lokal.rufe()).toBe(0);
  });

  it("F3 · ohne Anforderung: ein Modell, kein Feld, kein Protokolleintrag", async () => {
    const { ask, audit, openai, lokal } = await aufbau();
    const aus = await ask.ask(FRAGE, "pedi", "de");
    expect(Object.keys(aus)).not.toContain("zweitmeinung");
    expect(openai.rufe()).toBe(1);
    expect(lokal.rufe()).toBe(0);
    expect(await audit.list({ action: "ask.zweitmeinung" })).toEqual([]);
  });
});
